package com.snuffles.tradeflow.service.provider;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;
import java.util.Optional;

public interface MarketDataProvider {

    @Value
    @Builder
    class ProviderQuote {
        String ticker;
        BigDecimal lastPrice;
        BigDecimal changeToday;
        BigDecimal changeTodayPercentage;
        String marketIdentifier;
        String providerName;
    }

    Optional<ProviderQuote> getQuote(String ticker, Optional<String> marketHint);
}
