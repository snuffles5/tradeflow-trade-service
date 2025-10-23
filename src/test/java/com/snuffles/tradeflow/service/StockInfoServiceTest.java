package com.snuffles.tradeflow.service;

import com.snuffles.tradeflow.domain.LastPriceInfo;
import com.snuffles.tradeflow.repository.LastPriceInfoRepository;
import com.snuffles.tradeflow.service.provider.MarketDataProvider;
import com.snuffles.tradeflow.service.provider.MarketDataProvider.ProviderQuote;
import com.snuffles.tradeflow.web.dto.LastPriceInfoDto;
import com.snuffles.tradeflow.web.mapper.LastPriceInfoMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.atLeastOnce;

@ExtendWith(MockitoExtension.class)
class StockInfoServiceTest {

    @Mock
    private LastPriceInfoRepository lastPriceInfoRepository;

    @Mock
    private LastPriceInfoMapper lastPriceInfoMapper;

    @Mock
    private MarketDataProvider marketDataProvider;

    @InjectMocks
    private StockInfoService stockInfoService;

    private LastPriceInfo cachedEntity;
    private LastPriceInfoDto dto;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(stockInfoService, "cacheTtlSeconds", 300L);

        cachedEntity = new LastPriceInfo();
        cachedEntity.setTicker("SPY");
        cachedEntity.setLastPrice(new BigDecimal("500.12"));
        cachedEntity.setLastUpdated(Instant.now());

        dto = new LastPriceInfoDto();
        dto.setTicker("SPY");
        dto.setLastPrice(new BigDecimal("500.12"));
    }

    @Test
    void getStockInfoReturnsEmptyWhenTickerMissing() {
        assertThat(stockInfoService.getStockInfo(null)).isEmpty();
        assertThat(stockInfoService.getStockInfo("   ")).isEmpty();
        verify(lastPriceInfoRepository, never()).findByTicker("SPY");
    }

    @Test
    void getStockInfoReturnsFreshCachedDataWhenWithinTtl() {
        when(lastPriceInfoRepository.findByTicker("SPY")).thenReturn(Optional.of(cachedEntity));
        when(lastPriceInfoMapper.toDto(cachedEntity)).thenReturn(dto);

        Optional<LastPriceInfoDto> result = stockInfoService.getStockInfo("spy");

        assertThat(result).contains(dto);
        verify(lastPriceInfoRepository).findByTicker("SPY");
        verify(lastPriceInfoMapper).toDto(cachedEntity);
    }

    @Test
    void getStockInfoReturnsStaleCachedDataWhenOutOfTtl() {
        cachedEntity.setLastUpdated(Instant.now().minusSeconds(500));
        when(lastPriceInfoRepository.findByTicker("SPY")).thenReturn(Optional.of(cachedEntity));
        when(lastPriceInfoMapper.toDto(cachedEntity)).thenReturn(dto);

        Optional<LastPriceInfoDto> result = stockInfoService.getStockInfo("SPY");

        assertThat(result).contains(dto);
        verify(lastPriceInfoRepository).findByTicker("SPY");
        verify(lastPriceInfoMapper).toDto(cachedEntity);
    }

    @Test
    void getStockInfoReturnsEmptyWhenCacheMissing() {
        when(lastPriceInfoRepository.findByTicker("SPY")).thenReturn(Optional.empty());
        when(marketDataProvider.getQuote("SPY", Optional.empty())).thenReturn(Optional.empty());

        Optional<LastPriceInfoDto> result = stockInfoService.getStockInfo("SPY");

        assertThat(result).isEmpty();
        verify(lastPriceInfoRepository).findByTicker("SPY");
    }

    @Test
    void getStockInfoReturnsFetchedDataWhenCacheMissingAndProviderSucceeds() {
        ProviderQuote providerQuote = ProviderQuote.builder()
            .ticker("SPY")
            .lastPrice(new BigDecimal("500.00"))
            .changeToday(new BigDecimal("5.00"))
            .changeTodayPercentage(new BigDecimal("1.01"))
            .marketIdentifier("NASDAQ")
            .providerName("TestProvider")
            .build();

        when(lastPriceInfoRepository.findByTicker("SPY")).thenReturn(Optional.empty());
        when(marketDataProvider.getQuote("SPY", Optional.empty())).thenReturn(Optional.of(providerQuote));
        when(lastPriceInfoRepository.save(any(LastPriceInfo.class))).thenReturn(cachedEntity);
        when(lastPriceInfoMapper.toDto(cachedEntity)).thenReturn(dto);

        Optional<LastPriceInfoDto> result = stockInfoService.getStockInfo("SPY");

        assertThat(result).contains(dto);
        verify(lastPriceInfoRepository, atLeastOnce()).findByTicker("SPY");
        verify(marketDataProvider).getQuote("SPY", Optional.empty());
        verify(lastPriceInfoRepository).save(any(LastPriceInfo.class));
        verify(lastPriceInfoMapper).toDto(cachedEntity);
    }
}
