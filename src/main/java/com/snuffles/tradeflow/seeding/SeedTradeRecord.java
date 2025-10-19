package com.snuffles.tradeflow.seeding;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.math.BigDecimal;

public record SeedTradeRecord(
    @JsonProperty("trade_date") String tradeDate,
    String ticker,
    @JsonProperty("transaction_type") String transactionType,
    BigDecimal quantity,
    @JsonProperty("price_per_unit") BigDecimal pricePerUnit,
    String owner,
    String source
) {
}
