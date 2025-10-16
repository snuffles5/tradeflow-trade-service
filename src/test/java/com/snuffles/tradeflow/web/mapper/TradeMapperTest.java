package com.snuffles.tradeflow.web.mapper;

import com.snuffles.tradeflow.domain.Trade;
import com.snuffles.tradeflow.domain.TradeOwner;
import com.snuffles.tradeflow.domain.TradeSource;
import com.snuffles.tradeflow.web.dto.TradeDto;
import com.snuffles.tradeflow.web.dto.TradeOwnerDto;
import com.snuffles.tradeflow.web.dto.TradeSourceDto;
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
    TradeMapperImpl.class,
    TradeOwnerMapperImpl.class,
    TradeSourceMapperImpl.class
})
class TradeMapperTest {

    @Autowired
    private TradeMapper tradeMapper;

    @Test
    void toDtoMapsNestedFields() {
        TradeOwner owner = new TradeOwner();
        owner.setId(1L);
        owner.setName("Alice");

        TradeSource source = new TradeSource();
        source.setId(2L);
        source.setName("Broker");

        Trade trade = new Trade();
        trade.setId(10L);
        trade.setTransactionType(Trade.TransactionType.Buy);
        trade.setTicker("AAPL");
        trade.setQuantity(new BigDecimal("5"));
        trade.setPricePerUnit(new BigDecimal("150"));
        trade.setTradeDate(LocalDate.of(2024, 1, 1));
        trade.setOwner(owner);
        trade.setSource(source);

        TradeDto dto = tradeMapper.toDto(trade);

        assertThat(dto.getId()).isEqualTo(10L);
        assertThat(dto.getTransactionType()).isEqualTo(Trade.TransactionType.Buy);
        assertThat(dto.getTradeOwnerId()).isEqualTo(1L);
        assertThat(dto.getTradeSourceId()).isEqualTo(2L);
        assertThat(dto.getOwner()).isNotNull();
        assertThat(dto.getOwner().getName()).isEqualTo("Alice");
        assertThat(dto.getSource()).isNotNull();
        assertThat(dto.getSource().getName()).isEqualTo("Broker");
    }

    @Test
    void toEntityIgnoresAssociations() {
        TradeOwnerDto ownerDto = new TradeOwnerDto();
        ownerDto.setId(1L);
        ownerDto.setName("Alice");

        TradeSourceDto sourceDto = new TradeSourceDto();
        sourceDto.setId(2L);
        sourceDto.setName("Broker");

        TradeDto dto = new TradeDto();
        dto.setId(99L);
        dto.setTransactionType(Trade.TransactionType.Sell);
        dto.setTicker("MSFT");
        dto.setQuantity(new BigDecimal("3"));
        dto.setPricePerUnit(new BigDecimal("200"));
        dto.setTradeDate(LocalDate.of(2024, 2, 2));
        dto.setTradeOwnerId(1L);
        dto.setTradeSourceId(2L);
        dto.setOwner(ownerDto);
        dto.setSource(sourceDto);

        Trade entity = tradeMapper.toEntity(dto);

        assertThat(entity.getId()).isNull();
        assertThat(entity.getTransactionType()).isEqualTo(Trade.TransactionType.Sell);
        assertThat(entity.getTicker()).isEqualTo("MSFT");
        assertThat(entity.getQuantity()).isEqualByComparingTo(new BigDecimal("3"));
        assertThat(entity.getPricePerUnit()).isEqualByComparingTo(new BigDecimal("200"));
        assertThat(entity.getTradeDate()).isEqualTo(LocalDate.of(2024, 2, 2));
        assertThat(entity.getOwner()).isNull();
        assertThat(entity.getSource()).isNull();
        assertThat(entity.getHolding()).isNull();
    }
}
