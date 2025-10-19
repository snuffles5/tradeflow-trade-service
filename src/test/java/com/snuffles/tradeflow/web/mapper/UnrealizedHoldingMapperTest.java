package com.snuffles.tradeflow.web.mapper;

import com.snuffles.tradeflow.domain.TradeOwner;
import com.snuffles.tradeflow.domain.TradeSource;
import com.snuffles.tradeflow.domain.UnrealizedHolding;
import com.snuffles.tradeflow.web.dto.UnrealizedHoldingDto;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.context.junit.jupiter.SpringExtension;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

@ExtendWith(SpringExtension.class)
@ContextConfiguration(classes = {
    UnrealizedHoldingMapperImpl.class,
    TradeOwnerMapperImpl.class,
    TradeSourceMapperImpl.class
})
class UnrealizedHoldingMapperTest {

    @Autowired
    private UnrealizedHoldingMapper mapper;

    @Test
    void toDtoMapsAssociatedEntitiesAndFields() {
        TradeOwner owner = new TradeOwner();
        owner.setId(1L);
        owner.setName("Alice");

        TradeSource source = new TradeSource();
        source.setId(2L);
        source.setName("Broker");

        UnrealizedHolding holding = new UnrealizedHolding();
        holding.setId(5L);
        holding.setTicker("AAPL");
        holding.setOwner(owner);
        holding.setSource(source);
        holding.setNetQuantity(new BigDecimal("10"));
        holding.setNetCost(new BigDecimal("5000"));
        holding.setAverageCost(new BigDecimal("500"));
        holding.setLatestTradePrice(new BigDecimal("550"));
        holding.setTotalBuyQuantity(new BigDecimal("10"));
        holding.setTotalBuyCost(new BigDecimal("5000"));
        holding.setTotalSellQuantity(BigDecimal.ZERO);
        holding.setTotalSellValue(BigDecimal.ZERO);
        holding.setRealizedPnl(BigDecimal.ZERO);
        holding.setRealizedPnlPercentage(BigDecimal.ZERO);
        holding.setOpenDate(LocalDate.of(2024, 1, 1));
        holding.setCloseDate(null);

        UnrealizedHoldingDto dto = mapper.toDto(holding);

        assertThat(dto.getId()).isEqualTo(5L);
        assertThat(dto.getTicker()).isEqualTo("AAPL");
        assertThat(dto.getNetQuantity()).isEqualByComparingTo(new BigDecimal("10"));
        assertThat(dto.getOwner()).isNotNull();
        assertThat(dto.getOwner().getName()).isEqualTo("Alice");
        assertThat(dto.getSource()).isNotNull();
        assertThat(dto.getSource().getName()).isEqualTo("Broker");
        assertThat(dto.getLatestTradePrice()).isEqualByComparingTo(new BigDecimal("550"));
        assertThat(dto.getTotalBuyQuantity()).isEqualByComparingTo(new BigDecimal("10"));
        assertThat(dto.getTotalSellQuantity()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(dto.getOpenDate()).isEqualTo(LocalDate.of(2024, 1, 1));
    }
}
