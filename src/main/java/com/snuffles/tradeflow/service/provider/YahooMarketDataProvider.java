package com.snuffles.tradeflow.service.provider;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.retry.annotation.Backoff;
import org.springframework.retry.annotation.Retryable;
import org.springframework.stereotype.Component;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.math.BigDecimal;
import java.util.Optional;

/**
 * Yahoo Finance provider using the public quote endpoint.
 * Note: Basic quotes typically do not require OAuth. Credentials are accepted
 * via configuration for future-secure flows but are not required for this endpoint.
 */
@Component
@Slf4j
public class YahooMarketDataProvider implements MarketDataProvider {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${yahoo.base-url:https://query1.finance.yahoo.com}")
    private String baseUrl;

    // Provided for future OAuth-secured flows if needed
    @Value("${YAHOO_APP_ID:}")
    private String appId;
    @Value("${YAHOO_CLIENT_ID:}")
    private String clientId;
    @Value("${YAHOO_CLIENT_SECRET:}")
    private String clientSecret;
    @Value("${YAHOO_REDIRECT_URI:}")
    private String redirectUri;

    private HttpClient httpClient;

    public YahooMarketDataProvider() {
        this.httpClient = HttpClient.newHttpClient();
    }

    // For testing
    void setHttpClient(HttpClient httpClient) {
        this.httpClient = httpClient;
    }

    private static class RateLimitException extends RuntimeException {
        public RateLimitException(String message) {
            super(message);
        }
    }

    @Override
    @Retryable(value = {RateLimitException.class}, backoff = @Backoff(delay = 1000, multiplier = 2, maxDelay = 10000), maxAttempts = 5)
    public Optional<ProviderQuote> getQuote(String ticker, Optional<String> marketHint) {
        if (ticker == null || ticker.isBlank()) {
            return Optional.empty();
        }
        String normalized = ticker.toUpperCase();
        String url = baseUrl + "/v7/finance/quote?symbols=" + normalized;
        HttpRequest request = HttpRequest.newBuilder(URI.create(url))
            .GET()
            .header(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE)
            .build();
        try {
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 429) {
                throw new RateLimitException("Rate limited by Yahoo for " + normalized);
            }
            if (response.statusCode() / 100 != 2) {
                log.warn("Yahoo quote HTTP {} for {}", response.statusCode(), normalized);
                return Optional.empty();
            }
            JsonNode root = objectMapper.readTree(response.body());
            JsonNode result = root.path("quoteResponse").path("result");
            if (!result.isArray() || result.size() == 0) {
                log.info("Yahoo returned empty result for {}", normalized);
                return Optional.empty();
            }
            JsonNode q = result.get(0);
            BigDecimal last = asBigDecimal(q, "regularMarketPrice");
            BigDecimal change = asBigDecimal(q, "regularMarketChange");
            BigDecimal changePct = asBigDecimal(q, "regularMarketChangePercent");
            String exchange = textOrNull(q, "fullExchangeName");
            if (exchange == null) exchange = textOrNull(q, "exchange");

            if (last == null) {
                log.info("Yahoo result missing regularMarketPrice for {}", normalized);
                return Optional.empty();
            }
            ProviderQuote quote = ProviderQuote.builder()
                .ticker(normalized)
                .lastPrice(last)
                .changeToday(change)
                .changeTodayPercentage(changePct)
                .marketIdentifier(exchange)
                .providerName("YahooFinance")
                .build();
            return Optional.of(quote);
        } catch (IOException | InterruptedException e) {
            log.error("Yahoo quote request failed for {}: {}", normalized, e.toString());
            return Optional.empty();
        }
    }

    private static BigDecimal asBigDecimal(JsonNode node, String field) {
        JsonNode n = node.get(field);
        if (n == null || n.isNull()) return null;
        try {
            return new BigDecimal(n.asText());
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private static String textOrNull(JsonNode node, String field) {
        JsonNode n = node.get(field);
        return (n == null || n.isNull()) ? null : n.asText();
    }
}
