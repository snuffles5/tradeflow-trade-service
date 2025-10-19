package com.snuffles.tradeflow.service;

import com.snuffles.tradeflow.domain.Trade;
import com.snuffles.tradeflow.domain.TradeOwner;
import com.snuffles.tradeflow.domain.TradeSource;
import com.snuffles.tradeflow.domain.UnrealizedHolding;
import com.snuffles.tradeflow.repository.TradeOwnerRepository;
import com.snuffles.tradeflow.repository.TradeRepository;
import com.snuffles.tradeflow.repository.TradeSourceRepository;
import com.snuffles.tradeflow.service.exception.ResourceNotFoundException;
import com.snuffles.tradeflow.service.exception.ValidationException;
import com.snuffles.tradeflow.web.dto.TradeDto;
import com.snuffles.tradeflow.web.mapper.TradeMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TradeServiceTest {

    @Mock
    private TradeRepository tradeRepository;

    @Mock
    private TradeOwnerRepository tradeOwnerRepository;

    @Mock
    private TradeSourceRepository tradeSourceRepository;

    @Mock
    private HoldingsService holdingsService;

    @Mock
    private TradeMapper tradeMapper;

    @InjectMocks
    private TradeService tradeService;

    private TradeDto tradeDto;
    private Trade tradeEntity;
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
        source.getOwners().add(owner);

        tradeDto = new TradeDto();
        tradeDto.setTransactionType(Trade.TransactionType.Buy);
        tradeDto.setTicker("AAPL");
        tradeDto.setQuantity(new BigDecimal("10"));
        tradeDto.setPricePerUnit(new BigDecimal("150"));
        tradeDto.setTradeDate(Instant.parse("2024-01-01T00:00:00Z"));
        tradeDto.setTradeOwnerId(1L);
        tradeDto.setTradeSourceId(2L);

        tradeEntity = new Trade();
        tradeEntity.setTransactionType(Trade.TransactionType.Buy);
        tradeEntity.setTicker("AAPL");
        tradeEntity.setQuantity(new BigDecimal("10"));
        tradeEntity.setPricePerUnit(new BigDecimal("150"));
        tradeEntity.setTradeDate(tradeDto.getTradeDate());
    }

    @Test
    void createTradePersistsAndReturnsDto() {
        Trade savedTrade = new Trade();
        savedTrade.setId(5L);
        savedTrade.setTransactionType(tradeEntity.getTransactionType());
        savedTrade.setTicker(tradeEntity.getTicker());
        savedTrade.setQuantity(tradeEntity.getQuantity());
        savedTrade.setPricePerUnit(tradeEntity.getPricePerUnit());
        savedTrade.setTradeDate(tradeEntity.getTradeDate());
        savedTrade.setOwner(owner);
        savedTrade.setSource(source);

        TradeDto expectedResponse = new TradeDto();
        expectedResponse.setId(5L);
        expectedResponse.setTicker("AAPL");

        given(tradeOwnerRepository.findById(1L)).willReturn(Optional.of(owner));
        given(tradeSourceRepository.findById(2L)).willReturn(Optional.of(source));
        given(tradeMapper.toEntity(tradeDto)).willReturn(tradeEntity);
        given(tradeRepository.save(tradeEntity)).willReturn(savedTrade);
        given(tradeMapper.toDto(savedTrade)).willReturn(expectedResponse);

        TradeDto result = tradeService.createTrade(tradeDto);

        assertThat(result).isEqualTo(expectedResponse);
        assertThat(tradeEntity.getOwner()).isEqualTo(owner);
        assertThat(tradeEntity.getSource()).isEqualTo(source);
        verify(holdingsService).processNewTrade(savedTrade);
    }

    @Test
    void createTradeThrowsWhenOwnerMissing() {
        given(tradeOwnerRepository.findById(1L)).willReturn(Optional.empty());

        assertThatThrownBy(() -> tradeService.createTrade(tradeDto))
            .isInstanceOf(ResourceNotFoundException.class)
            .hasMessage("TradeOwner not found");
    }

    @Test
    void createTradeThrowsWhenSourceMissing() {
        given(tradeOwnerRepository.findById(1L)).willReturn(Optional.of(owner));
        given(tradeSourceRepository.findById(2L)).willReturn(Optional.empty());

        assertThatThrownBy(() -> tradeService.createTrade(tradeDto))
            .isInstanceOf(ResourceNotFoundException.class)
            .hasMessage("TradeSource not found");
    }

    @Test
    void createTradeThrowsWhenOwnerNotAssociatedToSource() {
        TradeSource otherSource = new TradeSource();
        otherSource.setId(3L);
        otherSource.setName("Other");

        given(tradeOwnerRepository.findById(1L)).willReturn(Optional.of(owner));
        given(tradeSourceRepository.findById(2L)).willReturn(Optional.of(otherSource));

        assertThatThrownBy(() -> tradeService.createTrade(tradeDto))
            .isInstanceOf(ValidationException.class)
            .hasMessage("Owner not associated with source");
    }

    @Test
    void getAllTradesReturnsMappedDtos() {
        Trade trade = new Trade();
        trade.setId(9L);

        TradeDto dto = new TradeDto();
        dto.setId(9L);

        given(tradeRepository.findAll()).willReturn(List.of(trade));
        given(tradeMapper.toDto(trade)).willReturn(dto);

        List<TradeDto> result = tradeService.getAllTrades();

        assertThat(result).containsExactly(dto);
    }

    @Test
    void deleteTradeRemovesEntityAndRecalculatesHolding() {
        Trade trade = new Trade();
        trade.setId(11L);
        trade.setOwner(owner);
        trade.setSource(source);

        UnrealizedHolding holding = new UnrealizedHolding();
        holding.setId(40L);
        trade.setHolding(holding);

        given(tradeRepository.findById(11L)).willReturn(Optional.of(trade));

        tradeService.deleteTrade(11L);

        verify(tradeRepository).delete(trade);
        verify(holdingsService).recalculateHolding(40L);
    }

    @Test
    void deleteTradeThrowsWhenNotFound() {
        given(tradeRepository.findById(11L)).willReturn(Optional.empty());

        assertThatThrownBy(() -> tradeService.deleteTrade(11L))
            .isInstanceOf(ResourceNotFoundException.class)
            .hasMessage("Trade not found");
    }

    @Test
    void updateTradeRecalculatesWhenHoldingUnchanged() {
        Trade existingTrade = new Trade();
        existingTrade.setId(12L);
        existingTrade.setTransactionType(Trade.TransactionType.Buy);
        existingTrade.setTicker("AAPL");
        existingTrade.setQuantity(new BigDecimal("5"));
        existingTrade.setPricePerUnit(new BigDecimal("120"));
        existingTrade.setTradeDate(Instant.parse("2024-01-01T00:00:00Z"));
        existingTrade.setOwner(owner);
        existingTrade.setSource(source);

        UnrealizedHolding holding = new UnrealizedHolding();
        holding.setId(50L);
        existingTrade.setHolding(holding);

        TradeDto updateDto = new TradeDto();
        updateDto.setTransactionType(Trade.TransactionType.Sell);
        updateDto.setTicker("AAPL");
        updateDto.setQuantity(new BigDecimal("3"));
        updateDto.setPricePerUnit(new BigDecimal("130"));
        updateDto.setTradeDate(Instant.parse("2024-01-02T00:00:00Z"));
        updateDto.setTradeOwnerId(1L);
        updateDto.setTradeSourceId(2L);

        TradeDto responseDto = new TradeDto();
        responseDto.setId(12L);

        given(tradeRepository.findById(12L)).willReturn(Optional.of(existingTrade));
        given(tradeOwnerRepository.findById(1L)).willReturn(Optional.of(owner));
        given(tradeSourceRepository.findById(2L)).willReturn(Optional.of(source));
        given(tradeRepository.save(existingTrade)).willReturn(existingTrade);
        given(tradeMapper.toDto(existingTrade)).willReturn(responseDto);

        TradeDto result = tradeService.updateTrade(12L, updateDto);

        assertThat(result).isEqualTo(responseDto);
        assertThat(existingTrade.getTransactionType()).isEqualTo(Trade.TransactionType.Sell);
        assertThat(existingTrade.getQuantity()).isEqualByComparingTo(new BigDecimal("3"));
        assertThat(existingTrade.getPricePerUnit()).isEqualByComparingTo(new BigDecimal("130"));
        assertThat(existingTrade.getTradeDate()).isEqualTo(updateDto.getTradeDate());
        assertThat(existingTrade.getOwner()).isEqualTo(owner);
        assertThat(existingTrade.getSource()).isEqualTo(source);

        verify(tradeRepository).save(existingTrade);
        verify(holdingsService).recalculateHolding(50L);
        verify(holdingsService, never()).processNewTrade(any());
    }

    @Test
    void updateTradeMovesHoldingWhenDetailsChange() {
        Trade existingTrade = new Trade();
        existingTrade.setId(13L);
        existingTrade.setTransactionType(Trade.TransactionType.Buy);
        existingTrade.setTicker("AAPL");
        existingTrade.setQuantity(new BigDecimal("5"));
        existingTrade.setPricePerUnit(new BigDecimal("120"));
        existingTrade.setTradeDate(Instant.parse("2024-01-01T00:00:00Z"));
        existingTrade.setOwner(owner);
        existingTrade.setSource(source);

        UnrealizedHolding holding = new UnrealizedHolding();
        holding.setId(60L);
        existingTrade.setHolding(holding);

        TradeOwner newOwner = new TradeOwner();
        newOwner.setId(3L);
        newOwner.setName("Bob");

        TradeSource newSource = new TradeSource();
        newSource.setId(4L);
        newSource.setName("Other");
        newSource.getOwners().add(newOwner);

        TradeDto updateDto = new TradeDto();
        updateDto.setTransactionType(Trade.TransactionType.Sell);
        updateDto.setTicker("MSFT");
        updateDto.setQuantity(new BigDecimal("8"));
        updateDto.setPricePerUnit(new BigDecimal("250"));
        updateDto.setTradeDate(Instant.parse("2024-01-03T00:00:00Z"));
        updateDto.setTradeOwnerId(3L);
        updateDto.setTradeSourceId(4L);

        TradeDto responseDto = new TradeDto();
        responseDto.setId(13L);

        given(tradeRepository.findById(13L)).willReturn(Optional.of(existingTrade));
        given(tradeOwnerRepository.findById(3L)).willReturn(Optional.of(newOwner));
        given(tradeSourceRepository.findById(4L)).willReturn(Optional.of(newSource));
        given(tradeRepository.save(existingTrade)).willReturn(existingTrade);
        given(tradeMapper.toDto(existingTrade)).willReturn(responseDto);

        TradeDto result = tradeService.updateTrade(13L, updateDto);

        assertThat(result).isEqualTo(responseDto);
        assertThat(existingTrade.getTicker()).isEqualTo("MSFT");
        assertThat(existingTrade.getOwner()).isEqualTo(newOwner);
        assertThat(existingTrade.getSource()).isEqualTo(newSource);

        verify(holdingsService).recalculateHolding(60L);
        verify(holdingsService).processNewTrade(existingTrade);
    }

    @Test
    void updateTradeThrowsWhenNotFound() {
        given(tradeRepository.findById(99L)).willReturn(Optional.empty());

        assertThatThrownBy(() -> tradeService.updateTrade(99L, tradeDto))
            .isInstanceOf(ResourceNotFoundException.class)
            .hasMessage("Trade not found");
    }

    @Test
    void updateTradeThrowsWhenOwnerNotAssociated() {
        Trade existingTrade = new Trade();
        existingTrade.setId(14L);
        existingTrade.setOwner(owner);
        existingTrade.setSource(source);
        existingTrade.setHolding(new UnrealizedHolding());

        TradeSource otherSource = new TradeSource();
        otherSource.setId(5L);
        otherSource.setName("Other");

        given(tradeRepository.findById(14L)).willReturn(Optional.of(existingTrade));
        given(tradeOwnerRepository.findById(1L)).willReturn(Optional.of(owner));
        given(tradeSourceRepository.findById(2L)).willReturn(Optional.of(otherSource));

        assertThatThrownBy(() -> tradeService.updateTrade(14L, tradeDto))
            .isInstanceOf(ValidationException.class)
            .hasMessage("Owner not associated with source");
    }
}
