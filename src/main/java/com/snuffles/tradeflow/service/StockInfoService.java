package com.snuffles.tradeflow.service;

import com.snuffles.tradeflow.domain.LastPriceInfo;
import com.snuffles.tradeflow.repository.LastPriceInfoRepository;
import com.snuffles.tradeflow.web.dto.LastPriceInfoDto;
import com.snuffles.tradeflow.web.mapper.LastPriceInfoMapper;
import com.snuffles.tradeflow.service.provider.MarketDataProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class StockInfoService {

    private final LastPriceInfoRepository lastPriceInfoRepository;
    private final LastPriceInfoMapper lastPriceInfoMapper;
    private final MarketDataProvider marketDataProvider;

    // Default 300 seconds (5 minutes) if not provided
    @Value("${stock.cache.ttl-seconds:300}")
    private long cacheTtlSeconds;

    public Optional<LastPriceInfoDto> getStockInfo(String ticker) {
        if (ticker == null || ticker.isBlank()) {
            log.warn("Requested stock info with empty ticker input");
            return Optional.empty();
        }
        String normalized = ticker.toUpperCase();
        log.debug("Fetching stock info for {}", normalized);

        Optional<LastPriceInfo> cachedOpt = lastPriceInfoRepository.findByTicker(normalized);
        if (cachedOpt.isEmpty()) {
            log.info("No cached stock info found for {}", normalized);
            // Try provider fetch
            return fetchFromProviderAndPersist(normalized);
        }

        LastPriceInfo cached = cachedOpt.get();
        Instant lastUpdated = cached.getLastUpdated();
        if (lastUpdated != null) {
            Instant now = Instant.now();
            long ageSeconds = Duration.between(lastUpdated, now).getSeconds();
            if (ageSeconds <= cacheTtlSeconds) {
                // Fresh cache
                log.debug(
                    "Returning fresh cached stock info for {} (age={}s, ttl={}s)",
                    normalized,
                    ageSeconds,
                    cacheTtlSeconds
                );
                return Optional.of(lastPriceInfoMapper.toDto(cached));
            }
            log.info(
                "Cached stock info for {} is stale (age={}s > ttl={}s); returning stale data until provider refresh implemented",
                normalized,
                ageSeconds,
                cacheTtlSeconds
            );
            // Stale: attempt provider refresh
            Optional<LastPriceInfoDto> refreshed = fetchFromProviderAndPersist(normalized);
            if (refreshed.isPresent()) {
                return refreshed;
            }
        } else {
            log.warn("Cached stock info for {} is missing lastUpdated timestamp", normalized);
            // Attempt refresh when timestamp missing
            Optional<LastPriceInfoDto> refreshed = fetchFromProviderAndPersist(normalized);
            if (refreshed.isPresent()) {
                return refreshed;
            }
        }

        // Provider failed; return best-effort cached data
        log.debug("Provider refresh failed; providing best-effort cached stock info for {} despite staleness", normalized);
        return Optional.of(lastPriceInfoMapper.toDto(cached));
    }

    private Optional<LastPriceInfoDto> fetchFromProviderAndPersist(String normalizedTicker) {
        try {
            return marketDataProvider.getQuote(normalizedTicker, Optional.empty())
                .map(quote -> {
                    Instant now = Instant.now();
                    LastPriceInfo entity = lastPriceInfoRepository.findByTicker(normalizedTicker)
                        .orElseGet(LastPriceInfo::new);
                    entity.setTicker(normalizedTicker);
                    entity.setLastPrice(quote.getLastPrice());
                    entity.setChangeToday(quote.getChangeToday());
                    entity.setChangeTodayPercentage(quote.getChangeTodayPercentage());
                    entity.setMarketIdentifier(quote.getMarketIdentifier());
                    entity.setProviderSource(quote.getProviderName());
                    entity.setLastUpdated(now);
                    LastPriceInfo saved = lastPriceInfoRepository.save(entity);
                    log.debug("Persisted provider quote for {} via {}", normalizedTicker, quote.getProviderName());
                    return lastPriceInfoMapper.toDto(saved);
                });
        } catch (Exception ex) {
            log.error("Provider fetch failed for {}: {}", normalizedTicker, ex.toString());
            return Optional.empty();
        }
    }
}
