package com.snuffles.tradeflow.service.provider;

import lombok.extern.slf4j.Slf4j;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.springframework.retry.annotation.Backoff;
import org.springframework.retry.annotation.Retryable;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.math.BigDecimal;
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

    @Override
    @Retryable(value = {RateLimitException.class, IOException.class}, backoff = @Backoff(delay = 1000, multiplier = 2, maxDelay = 10000), maxAttempts = 5)
    public Optional<ProviderQuote> getQuote(String ticker, Optional<String> marketHint) {
        if (ticker == null || ticker.isBlank()) {
            return Optional.empty();
        }
        String normalized = ticker.toUpperCase();
        String url = "https://www.google.com/finance/quote/" + normalized + ":NASDAQ"; // Assume NASDAQ, or use marketHint
        try {
            Document doc = Jsoup.connect(url)
                .userAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36")
                .get();
            return parseQuoteFromDocument(doc, normalized);
        } catch (IOException e) {
            log.error("Google Finance request failed for {}: {}", normalized, e.toString());
            throw new RateLimitException("Failed to fetch from Google Finance: " + e.getMessage());
        }
    }

    Optional<ProviderQuote> parseQuoteFromDocument(Document doc, String ticker) {
        // Parse the price
        Element priceElement = doc.selectFirst("div.YMlKec.fxKbKc"); // Example selector, may need adjustment
        if (priceElement == null) {
            log.info("Google Finance price element not found for {}", ticker);
            return Optional.empty();
        }
        String priceText = priceElement.text().replace(",", "").replace("$", "");
        BigDecimal lastPrice = new BigDecimal(priceText);

        // Parse change
        Element changeElement = doc.selectFirst("div.P6K39c"); // Example
        BigDecimal change = BigDecimal.ZERO;
        BigDecimal changePct = BigDecimal.ZERO;
        if (changeElement != null) {
            String changeText = changeElement.text();
            // Parse +1.23 (+0.85%) or something
            // Simplified
            change = parseChange(changeText);
            changePct = parseChangePct(changeText);
        }

        ProviderQuote quote = ProviderQuote.builder()
            .ticker(ticker)
            .lastPrice(lastPrice)
            .changeToday(change)
            .changeTodayPercentage(changePct)
            .marketIdentifier("NASDAQ") // Hardcoded
            .providerName("GoogleFinance")
            .build();
        return Optional.of(quote);
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
