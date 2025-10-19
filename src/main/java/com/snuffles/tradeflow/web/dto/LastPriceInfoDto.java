package com.snuffles.tradeflow.web.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.time.Instant;

@Data
public class LastPriceInfoDto {
    private String ticker;
    private BigDecimal lastPrice;
    private BigDecimal changeToday;
    private BigDecimal changeTodayPercentage;
    private String marketIdentifier;
    private String providerSource;
    private Instant lastUpdated;
}
