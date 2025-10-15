package com.snuffles.tradeflow.repository;

import com.snuffles.tradeflow.domain.TradeOwner;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface TradeOwnerRepository extends JpaRepository<TradeOwner, Long> {
    Optional<TradeOwner> findByName(String name);
}
