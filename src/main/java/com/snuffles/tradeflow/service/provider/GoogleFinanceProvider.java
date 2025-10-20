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

        // Parse change
        Element changeElement = doc.selectFirst("div.P6K39c");
        BigDecimal change = BigDecimal.ZERO;
        BigDecimal changePct = BigDecimal.ZERO;
        if (changeElement != null) {
            String changeText = changeElement.text();
            change = parseChange(changeText);
            changePct = parseChangePct(changeText);
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
        String url = "https://www.google.com/finance/quote/" + ticker + ":" + market;
        try {
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

    private BigDecimal parseChange(String text) {
        // Simplified parsing
        try {
            String[] parts = text.split(" ");
            if (parts.length > 0) {
                return new BigDecimal(parts[0].replace("+", "").replace(",", ""));
            }
        } catch (Exception e) {
            log.warn("Failed to parse change: {}", text);
        }
        return BigDecimal.ZERO;
    }

    private BigDecimal parseChangePct(String text) {
        // Simplified
        try {
            int start = text.indexOf("(");
            int end = text.indexOf("%)");
            if (start != -1 && end != -1) {
                String pct = text.substring(start + 1, end);
                return new BigDecimal(pct.replace("%", ""));
            }
        } catch (Exception e) {
            log.warn("Failed to parse change pct: {}", text);
        }
        return BigDecimal.ZERO;
    }
}
