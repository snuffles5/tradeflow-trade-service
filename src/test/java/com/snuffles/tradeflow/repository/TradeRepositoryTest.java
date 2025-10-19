package com.snuffles.tradeflow.repository;

import com.snuffles.tradeflow.domain.Trade;
import com.snuffles.tradeflow.domain.TradeOwner;
import com.snuffles.tradeflow.domain.TradeSource;
import com.snuffles.tradeflow.domain.UnrealizedHolding;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.junit.jupiter.SpringExtension;
import org.springframework.test.context.TestPropertySource;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
@ExtendWith(SpringExtension.class)
@ActiveProfiles("test")
@TestPropertySource(properties = "spring.flyway.enabled=false")
class TradeRepositoryTest {

    @Autowired
    private TradeRepository tradeRepository;

    @Autowired
    private TradeOwnerRepository tradeOwnerRepository;

    @Autowired
    private TradeSourceRepository tradeSourceRepository;

    @Autowired
    private UnrealizedHoldingRepository unrealizedHoldingRepository;

    @Test
    void findByHoldingIdOrderByTradeDateAscReturnsChronologicalTrades() {
        TradeOwner owner = new TradeOwner();
        owner.setName("Alice");
        owner = tradeOwnerRepository.save(owner);

        TradeSource source = new TradeSource();
        source.setName("Broker");
        source.getOwners().add(owner);
        source = tradeSourceRepository.save(source);

        UnrealizedHolding holding = new UnrealizedHolding();
        holding.setTicker("AAPL");
        holding.setOwner(owner);
        holding.setSource(source);
        holding.setNetQuantity(BigDecimal.ZERO);
        holding.setAverageCost(BigDecimal.ZERO);
        holding.setNetCost(BigDecimal.ZERO);
        holding.setLatestTradePrice(new BigDecimal("0"));
        holding.setTotalBuyQuantity(BigDecimal.ZERO);
        holding.setTotalBuyCost(BigDecimal.ZERO);
        holding.setTotalSellQuantity(BigDecimal.ZERO);
        holding.setTotalSellValue(BigDecimal.ZERO);
        holding.setOpenDate(LocalDate.of(2024, 1, 1));
        holding = unrealizedHoldingRepository.saveAndFlush(holding);

        Trade olderTrade = createTrade(owner, source, holding, LocalDate.of(2024, 1, 1), new BigDecimal("5"));
        Trade newerTrade = createTrade(owner, source, holding, LocalDate.of(2024, 2, 1), new BigDecimal("3"));

        tradeRepository.saveAll(List.of(newerTrade, olderTrade));

        List<Trade> trades = tradeRepository.findByHoldingIdOrderByTradeDateAsc(holding.getId());

        assertThat(trades).hasSize(2);
        assertThat(trades.get(0).getTradeDate()).isEqualTo(LocalDate.of(2024, 1, 1).atStartOfDay(ZoneOffset.UTC).toInstant());
        assertThat(trades.get(1).getTradeDate()).isEqualTo(LocalDate.of(2024, 2, 1).atStartOfDay(ZoneOffset.UTC).toInstant());
    }

    private Trade createTrade(TradeOwner owner, TradeSource source, UnrealizedHolding holding, LocalDate tradeDate, BigDecimal quantity) {
        Trade trade = new Trade();
        trade.setTransactionType(Trade.TransactionType.Buy);
        trade.setTicker("AAPL");
        trade.setQuantity(quantity);
        trade.setPricePerUnit(new BigDecimal("100"));
        trade.setTradeDate(tradeDate.atStartOfDay(ZoneOffset.UTC).toInstant());
        trade.setOwner(owner);
        trade.setSource(source);
        trade.setHolding(holding);
        return trade;
    }
}
