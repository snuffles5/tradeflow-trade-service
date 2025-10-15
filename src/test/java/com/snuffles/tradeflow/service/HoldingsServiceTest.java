package com.snuffles.tradeflow.service;

import com.snuffles.tradeflow.domain.Trade;
import com.snuffles.tradeflow.domain.UnrealizedHolding;
import com.snuffles.tradeflow.repository.TradeRepository;
import com.snuffles.tradeflow.repository.UnrealizedHoldingRepository;
import com.snuffles.tradeflow.web.mapper.UnrealizedHoldingMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

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

    @Test
    void shouldRecalculateHolding() {
        UnrealizedHolding holding = new UnrealizedHolding();
        holding.setId(1L);

        Trade buyTrade = new Trade();
        buyTrade.setTransactionType(Trade.TransactionType.Buy);
        buyTrade.setQuantity(new BigDecimal("10"));
        buyTrade.setPricePerUnit(new BigDecimal("100"));

        Trade sellTrade = new Trade();
        sellTrade.setTransactionType(Trade.TransactionType.Sell);
        sellTrade.setQuantity(new BigDecimal("5"));
        sellTrade.setPricePerUnit(new BigDecimal("120"));

        when(holdingRepository.findById(1L)).thenReturn(Optional.of(holding));
        when(tradeRepository.findByHoldingIdOrderByTradeDateAsc(1L)).thenReturn(List.of(buyTrade, sellTrade));

        holdingsService.recalculateHolding(1L);

        verify(holdingRepository).save(holding);
        // Add assertions here to check the state of the holding object
    }
}
