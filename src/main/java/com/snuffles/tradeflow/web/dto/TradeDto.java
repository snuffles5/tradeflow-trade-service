package com.snuffles.tradeflow.web.dto;

import com.snuffles.tradeflow.domain.Trade;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class TradeDto {

    private Long id;

    @NotNull
    private Trade.TransactionType transactionType;

    @NotBlank
    private String ticker;

    @NotNull
    @Positive
    private BigDecimal quantity;

    @NotNull
    @Positive
    private BigDecimal pricePerUnit;

    @NotNull
    private LocalDate tradeDate;

    @NotNull
    private Long tradeOwnerId;

    @NotNull
    private Long tradeSourceId;

    private Long holdingId;
    private TradeOwnerDto owner;
    private TradeSourceDto source;
}
