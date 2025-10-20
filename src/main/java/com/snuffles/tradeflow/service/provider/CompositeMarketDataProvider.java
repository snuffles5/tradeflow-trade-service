package com.snuffles.tradeflow.service.provider;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;

import java.util.Optional;

/**
 * Composite provider that tries Google first, then Yahoo.
 */
@Component
@Primary
@Slf4j
public class CompositeMarketDataProvider implements MarketDataProvider {

    private final MarketDataProvider google;
    private final MarketDataProvider yahoo;

    public CompositeMarketDataProvider(
        @Qualifier("googleFinanceProvider") MarketDataProvider google,
        @Qualifier("yahooMarketDataProvider") MarketDataProvider yahoo
    ) {
        this.google = google;
        this.yahoo = yahoo;
    }

    @Override
    public Optional<ProviderQuote> getQuote(String ticker, Optional<String> marketHint) {
        if (ticker == null || ticker.isBlank()) {
            return Optional.empty();
        }
        // Try Google first
        try {
            Optional<ProviderQuote> g = google.getQuote(ticker, marketHint);
            if (g.isPresent()) {
                return g;
            }
        } catch (Exception ex) {
            log.warn("Google provider failed for {}: {}", ticker, ex.toString());
        }
        // Fallback to Yahoo
        try {
            return yahoo.getQuote(ticker, marketHint);
        } catch (Exception ex) {
            log.warn("Yahoo provider failed for {}: {}", ticker, ex.toString());
            return Optional.empty();
        }
    }
}
