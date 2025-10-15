package com.snuffles.tradeflow.repository;

import com.snuffles.tradeflow.domain.UnrealizedHolding;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UnrealizedHoldingRepository extends JpaRepository<UnrealizedHolding, Long> {
    Optional<UnrealizedHolding> findByTickerAndOwnerIdAndSourceIdAndCloseDateIsNull(String ticker, Long ownerId, Long sourceId);
}
