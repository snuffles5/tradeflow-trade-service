package com.snuffles.tradeflow.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;

@Getter
@Setter
@Entity
@Table(name = "last_price_info")
public class LastPriceInfo extends BaseEntity {

    @Column(nullable = false, unique = true)
    private String ticker;

    @Column(name = "last_price", precision = 19, scale = 4)
    private BigDecimal lastPrice;

    @Column(name = "change_today", precision = 19, scale = 4)
    private BigDecimal changeToday;

    @Column(name = "change_today_percentage", precision = 19, scale = 4)
    private BigDecimal changeTodayPercentage;

    @Column(name = "market_identifier")
    private String marketIdentifier;

    @Column(name = "provider_source")
    private String providerSource;

    @Column(name = "last_updated")
    private Instant lastUpdated;
}
