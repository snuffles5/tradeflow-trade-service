package com.snuffles.tradeflow.service.provider;

import lombok.extern.slf4j.Slf4j;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.retry.annotation.Backoff;
import org.springframework.retry.annotation.Retryable;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.math.RoundingMode;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Google Finance provider using web scraping.
 */
@Component
@Slf4j
public class GoogleFinanceProvider implements MarketDataProvider {

    private static class RateLimitException extends RuntimeException {
        public RateLimitException(String message) {
            super(message);
        }
    }

    // Comma or space-separated list of market identifiers to try in order.
    // Defaults ordered with common US exchanges; NYSEARCA first to help ETFs like SPY.
    @Value("${market.provider.google.markets:NYSEARCA,NASDAQ,NYSE,AMEX,NYSEAMERICAN,OTCMKTS}")
    private String configuredMarkets;

    private static final Pattern NUMERIC_PATTERN = Pattern.compile("[+\\-−\\u2212]?\\d+(?:\\.\\d+)?");
    private static final Pattern PERCENT_PATTERN = Pattern.compile("([+\\-−\\u2212]?\\d+(?:\\.\\d+)?)%");
    private static final BigDecimal ONE_HUNDRED = new BigDecimal("100");
    private static final int CALCULATION_SCALE = 8;

    @Override
    @Retryable(value = {RateLimitException.class, IOException.class}, backoff = @Backoff(delay = 1000, multiplier = 2, maxDelay = 10000), maxAttempts = 5)
    public Optional<ProviderQuote> getQuote(String ticker, Optional<String> marketHint) {
        if (ticker == null || ticker.isBlank()) {
            return Optional.empty();
        }
        String normalized = ticker.toUpperCase();
        List<String> marketsToTry = resolveMarkets(marketHint);
        for (String market : marketsToTry) {
            try {
                Optional<ProviderQuote> quote = fetchFromMarket(normalized, market);
                if (quote.isPresent()) {
                    return quote;
                }
            } catch (RateLimitException ex) {
                // Bubble up to let retry/backoff handle
                throw ex;
            } catch (IOException ex) {
                log.debug("Google Finance request failed for {} on {}: {}", normalized, market, ex.toString());
            }
        }
        log.info("Google Finance returned no quote for {} across markets {}", normalized, marketsToTry);
        return Optional.empty();
    }

    Optional<ProviderQuote> parseQuoteFromDocument(Document doc, String ticker, String market) {
        // Parse the price
        Element priceElement = doc.selectFirst("div.YMlKec.fxKbKc"); // Selector may require maintenance
        if (priceElement == null) {
            log.info("Google Finance price element not found for {} on {}", ticker, market);
            return Optional.empty();
        }
        String priceText = priceElement.text().replace(",", "").replace("$", "");
        BigDecimal lastPrice = new BigDecimal(priceText);

        String changeText = extractChangeText(doc);
        String changeValueText = selectText(doc, "span[jsname=qRSVye]");
        String changePercentText = selectText(doc, "span[jsname=rfaVEf]");

        if (log.isDebugEnabled()) {
            log.debug("Google Finance raw texts for {} on {}: price='{}', changeSection='{}', changeValue='{}', changePercent='{}'",
                ticker, market, priceElement.text(), changeText, changeValueText, changePercentText);
        }

        // Prefer explicit span-based values
        BigDecimal change = parseChange(changeValueText);
        BigDecimal changePct = parseChangePct(changePercentText);

        // If spans missing, fall back to combined text, but only for percent (since it includes %)
        if (changePct == null) {
            changePct = parsePercentFromText(changeText);
        }

        if (change == null && changePct == null) {
            log.info("Google Finance change values missing for {} on {}. Falling back to zero.", ticker, market);
        }

        // Attempt to derive from Previous close which is reliable on the page
        BigDecimal previousClose = parsePreviousClose(doc);
        if (previousClose != null && previousClose.compareTo(BigDecimal.ZERO) != 0) {
            BigDecimal derivedChange = lastPrice.subtract(previousClose).setScale(CALCULATION_SCALE, RoundingMode.HALF_UP);
            BigDecimal derivedPct = derivedChange
                .multiply(ONE_HUNDRED)
                .divide(previousClose, CALCULATION_SCALE, RoundingMode.HALF_UP);
            if (log.isDebugEnabled()) {
                log.debug("Google Finance derived from previousClose for {} on {}: prevClose={}, dChange={}, dPct={}",
                    ticker, market, previousClose, derivedChange, derivedPct);
            }
            // Always prefer derived values when previous close is present to avoid mis-parsing unrelated fields
            change = derivedChange;
            changePct = derivedPct;
        } else {
            // Without previous close, derive missing one from the other
            if (change == null && changePct != null && lastPrice.compareTo(BigDecimal.ZERO) != 0) {
                change = lastPrice.multiply(changePct)
                    .divide(ONE_HUNDRED, CALCULATION_SCALE, RoundingMode.HALF_UP);
            }
            if (changePct == null && change != null && lastPrice.compareTo(BigDecimal.ZERO) != 0) {
                changePct = change
                    .multiply(ONE_HUNDRED)
                    .divide(lastPrice, CALCULATION_SCALE, RoundingMode.HALF_UP);
            }
        }

        if (change == null) {
            change = BigDecimal.ZERO;
        }

        if (changePct == null) {
            changePct = BigDecimal.ZERO;
        }

        if (log.isDebugEnabled()) {
            log.debug("Google Finance parsed values for {} on {}: price={}, change={}, changePct={}",
                ticker, market, lastPrice, change, changePct);
        }

        ProviderQuote quote = ProviderQuote.builder()
            .ticker(ticker)
            .lastPrice(lastPrice)
            .changeToday(change)
            .changeTodayPercentage(changePct)
            .marketIdentifier(market)
            .providerName("GoogleFinance")
            .build();
        return Optional.of(quote);
    }

    protected Optional<ProviderQuote> fetchFromMarket(String ticker, String market) throws IOException {
        String url = "https://www.google.com/finance/quote/" + ticker + ":" + market + "?hl=en&gl=US";
        try {
            if (log.isDebugEnabled()) {
                log.debug("Google Finance fetching URL for {} on {}: {}", ticker, market, url);
            }
            Document doc = Jsoup.connect(url)
                .userAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36")
                .get();
            return parseQuoteFromDocument(doc, ticker, market);
        } catch (org.jsoup.HttpStatusException ex) {
            if (ex.getStatusCode() == 429) {
                throw new RateLimitException("Rate limited by Google for " + ticker + " on " + market);
            }
            log.debug("Google Finance HTTP {} for {} on {}", ex.getStatusCode(), ticker, market);
            return Optional.empty();
        }
    }

    List<String> resolveMarkets(Optional<String> marketHint) {
        LinkedHashSet<String> ordered = new LinkedHashSet<>();
        marketHint.ifPresent(h -> Arrays.stream(h.split("[,\\s]+"))
            .map(String::trim)
            .filter(part -> !part.isEmpty())
            .map(String::toUpperCase)
            .forEach(ordered::add));
        if (configuredMarkets != null && !configuredMarkets.isBlank()) {
            Arrays.stream(configuredMarkets.split("[,\\s]+"))
                .map(String::trim)
                .filter(part -> !part.isEmpty())
                .map(String::toUpperCase)
                .forEach(ordered::add);
        }
        if (ordered.isEmpty()) {
            ordered.add("NASDAQ");
        }
        return new ArrayList<>(ordered);
    }

    private String extractChangeText(Document doc) {
        // Only build combined from the two known spans to avoid capturing unrelated fields
        Element changeValue = doc.selectFirst("span[jsname=qRSVye]");
        Element percentValue = doc.selectFirst("span[jsname=rfaVEf]");
        if (changeValue != null && percentValue != null) {
            return changeValue.text() + " (" + percentValue.text() + ")";
        }
        if (changeValue != null) {
            return changeValue.text();
        }
        if (percentValue != null) {
            return percentValue.text();
        }
        return null;
    }

    private BigDecimal parsePreviousClose(Document doc) {
        // Look for Previous close label and its value in nearby container
        for (Element container : doc.select("div.gyFHrc")) {
            Element label = container.selectFirst("div.mfs7Fc");
            Element valueNode = container.selectFirst("div.P6K39c, div.yNNSlb");
            if (log.isDebugEnabled()) {
                log.debug("GF summary row: label='{}' value='{}'", label != null ? label.text() : null, valueNode != null ? valueNode.text() : null);
            }
            if (label != null && label.text() != null && label.text().toLowerCase().contains("previous close")) {
                Element priceDiv = valueNode != null ? valueNode : container.selectFirst("div.P6K39c, div.yNNSlb");
                if (priceDiv != null) {
                    String token = normalizeNumericToken(priceDiv.text());
                    try {
                        return new BigDecimal(token);
                    } catch (Exception ignored) {
                        // continue searching
                    }
                }
            }
        }
        // Some pages present key/value pairs differently
        Element altLabel = doc.selectFirst("div.mfs7Fc:matchesOwn(^Previous close$)");
        if (altLabel != null) {
            Element parent = altLabel.parent();
            if (parent != null) {
                Element priceDiv = parent.selectFirst("div.P6K39c, div.yNNSlb");
                if (priceDiv != null) {
                    String token = normalizeNumericToken(priceDiv.text());
                    try {
                        return new BigDecimal(token);
                    } catch (Exception ignored) {}
                }
            }
        }
        return null;
    }

    private BigDecimal parseChange(String text) {
        BigDecimal direct = parseNumericToken(text);
        if (direct != null) {
            return direct;
        }
        if (text == null || text.isBlank()) {
            return null;
        }

        String[] tokens = text.split("\\s+");
        for (int i = tokens.length - 1; i >= 0; i--) {
            String token = tokens[i];
            if (!containsDigit(token) || token.contains("%")) {
                continue;
            }
            BigDecimal parsed = parseNumericToken(token);
            if (parsed != null) {
                return parsed;
            }
        }

        Matcher matcher = NUMERIC_PATTERN.matcher(text);
        while (matcher.find()) {
            String candidate = matcher.group();
            BigDecimal parsed = parseNumericToken(candidate);
            if (parsed != null) {
                return parsed;
            }
        }

        log.debug("Unable to parse change amount from '{}'", text);
        return null;
    }

    private BigDecimal parseChangePct(String text) {
        if (text == null || text.isBlank()) {
            return null;
        }
        if (!text.contains("%")) {
            return null;
        }
        Matcher matcher = PERCENT_PATTERN.matcher(text);
        if (matcher.find()) {
            return parseNumericToken(matcher.group(1));
        }
        // Fallback token scan only for tokens containing '%'
        String[] tokens = text.split("\\s+");
        for (int i = tokens.length - 1; i >= 0; i--) {
            String token = tokens[i];
            if (!token.contains("%")) {
                continue;
            }
            BigDecimal parsed = parseNumericToken(token);
            if (parsed != null) {
                return parsed;
            }
        }
        log.debug("Unable to parse change percent from '{}'", text);
        return null;
    }

    private BigDecimal parsePercentFromText(String text) {
        return parseChangePct(text);
    }

    private BigDecimal parseNumericToken(String token) {
        if (token == null) {
            return null;
        }
        String normalized = normalizeNumericToken(token);
        if (normalized.isBlank()) {
            return null;
        }
        try {
            return new BigDecimal(normalized);
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private boolean containsDigit(String value) {
        if (value == null) {
            return false;
        }
        for (char c : value.toCharArray()) {
            if (Character.isDigit(c)) {
                return true;
            }
        }
        return false;
    }

    private BigDecimal firstNonNull(BigDecimal primary, BigDecimal fallback) {
        return primary != null ? primary : fallback;
    }

    private String selectText(Document doc, String selector) {
        Element element = doc.selectFirst(selector);
        return element != null ? element.text() : null;
    }

    private String normalizeNumericToken(String value) {
        String sanitized = value
            .replace("\u2212", "-")
            .replace("−", "-")
            .replace("+", "")
            .replace("$", "")
            .replace(",", "")
            .replace("%", "")
            .trim();
        if (sanitized.startsWith("(")) {
            sanitized = sanitized.substring(1);
        }
        if (sanitized.endsWith(")")) {
            sanitized = sanitized.substring(0, sanitized.length() - 1);
        }
        return sanitized;
    }
}
