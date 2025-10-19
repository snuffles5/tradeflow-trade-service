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
@Table(name = "unrealized_holdings")
@SQLDelete(sql = "UPDATE unrealized_holdings SET deleted_at = NOW() WHERE id = ?")
@Where(clause = "deleted_at IS NULL")
public class UnrealizedHolding extends BaseEntity {

    @Column(nullable = false)
    private String ticker;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "trade_owner_id", nullable = false)
    private TradeOwner owner;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "trade_source_id", nullable = false)
    private TradeSource source;

    @Column(name = "net_quantity", nullable = false, precision = 19, scale = 4)
    private BigDecimal netQuantity;

    @Column(name = "average_cost", nullable = false, precision = 19, scale = 4)
    private BigDecimal averageCost;

    @Column(name = "net_cost", nullable = false, precision = 19, scale = 4)
    private BigDecimal netCost;

    @Column(name = "latest_trade_price", nullable = false, precision = 19, scale = 4)
    private BigDecimal latestTradePrice;

    @Column(name = "open_date", nullable = false)
    private LocalDate openDate;

    @Column(name = "close_date")
    private LocalDate closeDate;

    @Column(name = "stop_loss", precision = 19, scale = 4)
    private BigDecimal stopLoss;

    @Column(name = "realized_pnl", precision = 19, scale = 4)
    private BigDecimal realizedPnl;

    @Column(name = "realized_pnl_percentage", precision = 19, scale = 4)
    private BigDecimal realizedPnlPercentage;

    @Column(name = "total_buy_quantity", precision = 19, scale = 4)
    private BigDecimal totalBuyQuantity = BigDecimal.ZERO;

    @Column(name = "total_buy_cost", precision = 19, scale = 4)
    private BigDecimal totalBuyCost = BigDecimal.ZERO;

    @Column(name = "total_sell_quantity", precision = 19, scale = 4)
    private BigDecimal totalSellQuantity = BigDecimal.ZERO;

    @Column(name = "total_sell_value", precision = 19, scale = 4)
    private BigDecimal totalSellValue = BigDecimal.ZERO;

    @Column(name = "deleted_at")
    private Instant deletedAt;
}
