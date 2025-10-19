package com.snuffles.tradeflow.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "trade_owners")
public class TradeOwner extends BaseEntity {

    @Column(nullable = false, unique = true)
    private String name;
}
