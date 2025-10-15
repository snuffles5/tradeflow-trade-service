package com.snuffles.tradeflow.repository;

import com.snuffles.tradeflow.domain.LastPriceInfo;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface LastPriceInfoRepository extends JpaRepository<LastPriceInfo, Long> {
    Optional<LastPriceInfo> findByTicker(String ticker);
}
