package com.snuffles.tradeflow.service;

import com.snuffles.tradeflow.domain.Trade;
import com.snuffles.tradeflow.domain.TradeOwner;
import com.snuffles.tradeflow.domain.TradeSource;
import com.snuffles.tradeflow.domain.UnrealizedHolding;
import com.snuffles.tradeflow.repository.TradeRepository;
import com.snuffles.tradeflow.repository.UnrealizedHoldingRepository;
import com.snuffles.tradeflow.web.dto.HoldingsSummaryDto;
import com.snuffles.tradeflow.web.dto.UnrealizedHoldingDto;
import com.snuffles.tradeflow.web.mapper.UnrealizedHoldingMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class HoldingsServiceTest {

    @Mock
    private UnrealizedHoldingRepository holdingRepository;

    @Mock
    private TradeRepository tradeRepository;

    @Mock
    private UnrealizedHoldingMapper holdingMapper;

    @InjectMocks
    private HoldingsService holdingsService;

    private TradeOwner owner;
    private TradeSource source;

    @BeforeEach
    void setUp() {
        owner = new TradeOwner();
        owner.setId(1L);
        owner.setName("Alice");

        source = new TradeSource();
        source.setId(2L);
        source.setName("Broker");
    }

    @Test
    void processNewTradeCreatesHoldingWhenAbsent() {
        Trade trade = buildTrade(BigDecimal.TEN, new BigDecimal("100"), Trade.TransactionType.Buy);
        given(holdingRepository.findByTickerAndOwnerIdAndSourceIdAndCloseDateIsNull("AAPL", 1L, 2L))
            .willReturn(Optional.empty());
        given(holdingRepository.save(any(UnrealizedHolding.class)))
            .willAnswer(invocation -> invocation.getArgument(0));

        holdingsService.processNewTrade(trade);

        ArgumentCaptor<UnrealizedHolding> captor = ArgumentCaptor.forClass(UnrealizedHolding.class);
        verify(holdingRepository).save(captor.capture());

        UnrealizedHolding saved = captor.getValue();
        assertThat(saved.getTicker()).isEqualTo("AAPL");
        assertThat(saved.getOwner()).isEqualTo(owner);
        assertThat(saved.getSource()).isEqualTo(source);
        assertThat(saved.getOpenDate()).isEqualTo(trade.getTradeDate().atZone(ZoneOffset.UTC).toLocalDate());
        assertThat(saved.getTotalBuyQuantity()).isEqualByComparingTo(new BigDecimal("10"));
        assertThat(saved.getTotalBuyCost()).isEqualByComparingTo(new BigDecimal("1000"));
        assertThat(saved.getAverageCost()).isEqualByComparingTo(new BigDecimal("100.0000"));
        assertThat(saved.getNetQuantity()).isEqualByComparingTo(new BigDecimal("10"));
        assertThat(saved.getNetCost()).isEqualByComparingTo(new BigDecimal("1000"));
        assertThat(saved.getLatestTradePrice()).isEqualByComparingTo(new BigDecimal("100"));
        assertThat(saved.getCloseDate()).isNull();
        assertThat(trade.getHolding()).isSameAs(saved);
    }

    @Test
    void processNewTradeUpdatesExistingHolding() {
        UnrealizedHolding existing = baseHolding();
        existing.setTotalBuyQuantity(new BigDecimal("5"));
        existing.setTotalBuyCost(new BigDecimal("500"));
        existing.setNetQuantity(new BigDecimal("5"));
        existing.setNetCost(new BigDecimal("500"));

        Trade trade = buildTrade(new BigDecimal("5"), new BigDecimal("90"), Trade.TransactionType.Buy);

        given(holdingRepository.findByTickerAndOwnerIdAndSourceIdAndCloseDateIsNull("AAPL", 1L, 2L))
            .willReturn(Optional.of(existing));
        given(holdingRepository.save(existing)).willReturn(existing);

        holdingsService.processNewTrade(trade);

        assertThat(existing.getTotalBuyQuantity()).isEqualByComparingTo(new BigDecimal("10"));
        assertThat(existing.getTotalBuyCost()).isEqualByComparingTo(new BigDecimal("950"));
        assertThat(existing.getAverageCost()).isEqualByComparingTo(new BigDecimal("95.0000"));
        assertThat(existing.getNetQuantity()).isEqualByComparingTo(new BigDecimal("10"));
        assertThat(existing.getNetCost()).isEqualByComparingTo(new BigDecimal("950"));
        assertThat(existing.getLatestTradePrice()).isEqualByComparingTo(new BigDecimal("90"));
        assertThat(trade.getHolding()).isSameAs(existing);
    }

    @Test
    void recalculateHoldingDeletesWhenTradesMissing() {
        UnrealizedHolding holding = baseHolding();
        holding.setId(10L);

        given(holdingRepository.findById(10L)).willReturn(Optional.of(holding));
        given(tradeRepository.findByHoldingIdOrderByTradeDateAsc(10L)).willReturn(List.of());

        holdingsService.recalculateHolding(10L);

        verify(holdingRepository).delete(holding);
        verify(holdingRepository, never()).save(any());
    }

    @Test
    void recalculateHoldingRebuildsMetrics() {
        UnrealizedHolding holding = baseHolding();
        holding.setId(15L);
        holding.setTotalBuyQuantity(new BigDecimal("3"));
        holding.setTotalBuyCost(new BigDecimal("300"));
        holding.setTotalSellQuantity(new BigDecimal("1"));
        holding.setTotalSellValue(new BigDecimal("120"));
        holding.setNetQuantity(new BigDecimal("2"));
        holding.setNetCost(new BigDecimal("180"));

        Trade buyTrade = buildTrade(new BigDecimal("10"), new BigDecimal("100"), Trade.TransactionType.Buy);
        Trade sellTrade = buildTrade(new BigDecimal("5"), new BigDecimal("120"), Trade.TransactionType.Sell);

        given(holdingRepository.findById(15L)).willReturn(Optional.of(holding));
        given(tradeRepository.findByHoldingIdOrderByTradeDateAsc(15L)).willReturn(List.of(buyTrade, sellTrade));

        holdingsService.recalculateHolding(15L);

        verify(holdingRepository).save(holding);
        assertThat(holding.getTotalBuyQuantity()).isEqualByComparingTo(new BigDecimal("10"));
        assertThat(holding.getTotalBuyCost()).isEqualByComparingTo(new BigDecimal("1000"));
        assertThat(holding.getTotalSellQuantity()).isEqualByComparingTo(new BigDecimal("5"));
        assertThat(holding.getTotalSellValue()).isEqualByComparingTo(new BigDecimal("600"));
        assertThat(holding.getNetQuantity()).isEqualByComparingTo(new BigDecimal("5"));
        assertThat(holding.getNetCost()).isEqualByComparingTo(new BigDecimal("400"));
        assertThat(holding.getLatestTradePrice()).isEqualByComparingTo(new BigDecimal("120"));
        assertThat(holding.getRealizedPnl()).isNull();
        assertThat(holding.getCloseDate()).isNull();
    }

    @Test
    void getAllHoldingsMapsAdditionalFields() {
        UnrealizedHolding holding = baseHolding();
        holding.setId(5L);
        holding.setNetQuantity(BigDecimal.ONE);
        holding.setOpenDate(LocalDate.now().minusDays(5));

        UnrealizedHoldingDto dto = new UnrealizedHoldingDto();
        dto.setId(5L);
        dto.setTicker("AAPL");

        given(holdingRepository.findAll()).willReturn(List.of(holding));
        given(holdingMapper.toDto(holding)).willReturn(dto);
        given(tradeRepository.findByHoldingIdOrderByTradeDateAsc(5L)).willReturn(List.of(new Trade(), new Trade()));

        List<UnrealizedHoldingDto> result = holdingsService.getAllHoldings();

        assertThat(result).hasSize(1);
        UnrealizedHoldingDto produced = result.get(0);
        assertThat(produced.getHoldingPeriod()).isEqualTo(5);
        assertThat(produced.getTradeCount()).isEqualTo(2);
        assertThat(produced.getStatus()).isEqualTo("open");
    }

    @Test
    void getHoldingsSummaryAggregatesByOwnerAndSource() {
        UnrealizedHolding first = baseHolding();
        first.setNetCost(new BigDecimal("500"));

        UnrealizedHolding second = baseHolding();
        second.setNetCost(new BigDecimal("150"));
        second.getOwner().setName("Alice");
        second.getSource().setName("Broker");

        given(holdingRepository.findAll()).willReturn(List.of(first, second));

        HoldingsSummaryDto summary = holdingsService.getHoldingsSummary();

        assertThat(summary.getOverall().getTotalNetCost()).isEqualByComparingTo(new BigDecimal("650"));
        assertThat(summary.getNetCashBreakdown()).hasSize(1);
        HoldingsSummaryDto.NetCashBreakdownDto breakdown = summary.getNetCashBreakdown().get(0);
        assertThat(breakdown.getCombination()).isEqualTo("Alice - Broker");
        assertThat(breakdown.getNetCost()).isEqualByComparingTo(new BigDecimal("650"));
    }

    private Trade buildTrade(BigDecimal quantity, BigDecimal price, Trade.TransactionType type) {
        Trade trade = new Trade();
        trade.setTransactionType(type);
        trade.setTicker("AAPL");
        trade.setQuantity(quantity);
        trade.setPricePerUnit(price);
        trade.setTradeDate(Instant.parse("2024-01-01T00:00:00Z"));
        trade.setOwner(owner);
        trade.setSource(source);
        return trade;
    }

    private UnrealizedHolding baseHolding() {
        UnrealizedHolding holding = new UnrealizedHolding();
        holding.setTicker("AAPL");
        holding.setOwner(owner);
        holding.setSource(source);
        holding.setOpenDate(LocalDate.now().minusDays(10));
        holding.setLatestTradePrice(BigDecimal.ZERO);
        holding.setAverageCost(BigDecimal.ZERO);
        holding.setNetQuantity(BigDecimal.ZERO);
        holding.setNetCost(BigDecimal.ZERO);
        holding.setTotalBuyQuantity(BigDecimal.ZERO);
        holding.setTotalBuyCost(BigDecimal.ZERO);
        holding.setTotalSellQuantity(BigDecimal.ZERO);
        holding.setTotalSellValue(BigDecimal.ZERO);
        return holding;
    }
}
