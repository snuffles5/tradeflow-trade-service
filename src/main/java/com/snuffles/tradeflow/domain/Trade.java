package com.snuffles.tradeflow.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.Where;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

@Getter
@Setter
@Entity
@Table(name = "trades")
@SQLDelete(sql = "UPDATE trades SET deleted_at = NOW() WHERE id = ?")
@Where(clause = "deleted_at IS NULL")
public class Trade extends BaseEntity {

    @Enumerated(EnumType.STRING)
    @Column(name = "transaction_type", nullable = false)
    private TransactionType transactionType;

    @Column(nullable = false)
    private String ticker;

    @Column(nullable = false, precision = 19, scale = 4)
    private BigDecimal quantity;

    @Column(name = "price_per_unit", nullable = false, precision = 19, scale = 4)
    private BigDecimal pricePerUnit;

    @Column(name = "trade_date", nullable = false)
    private LocalDate tradeDate;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "trade_owner_id", nullable = false)
    private TradeOwner owner;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "trade_source_id", nullable = false)
    private TradeSource source;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "holding_id")
    private UnrealizedHolding holding;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    public enum TransactionType {
        Buy, Sell
    }
}
