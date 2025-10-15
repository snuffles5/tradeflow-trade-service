package com.snuffles.tradeflow.repository;

import com.snuffles.tradeflow.domain.TradeSource;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface TradeSourceRepository extends JpaRepository<TradeSource, Long> {
    Optional<TradeSource> findByName(String name);
}
