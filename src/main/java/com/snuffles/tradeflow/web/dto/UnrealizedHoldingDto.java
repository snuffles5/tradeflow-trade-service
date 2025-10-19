package com.snuffles.tradeflow.web.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class UnrealizedHoldingDto {
    private Long id;
    private String ticker;
    private BigDecimal netQuantity;
    private BigDecimal netCost;
    private BigDecimal averageCost;
    private long holdingPeriod;
    private int tradeCount;
    private TradeSourceDto source;
    private TradeOwnerDto owner;
    private String status;
    private BigDecimal realizedPnl;
    private BigDecimal realizedPnlPercentage;
    private BigDecimal latestTradePrice;
    private BigDecimal totalBuyQuantity;
    private BigDecimal totalBuyCost;
    private BigDecimal totalSellQuantity;
    private BigDecimal totalSellValue;
    private LocalDate openDate;
    private LocalDate closeDate;
}
