package com.snuffles.tradeflow.repository;

import com.snuffles.tradeflow.domain.Trade;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TradeRepository extends JpaRepository<Trade, Long> {
    List<Trade> findByHoldingIdOrderByTradeDateAsc(Long holdingId);
}
