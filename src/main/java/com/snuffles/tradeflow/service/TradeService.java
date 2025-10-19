package com.snuffles.tradeflow.service;

import com.snuffles.tradeflow.domain.Trade;
import com.snuffles.tradeflow.domain.TradeOwner;
import com.snuffles.tradeflow.domain.TradeSource;
import com.snuffles.tradeflow.repository.TradeOwnerRepository;
import com.snuffles.tradeflow.repository.TradeRepository;
import com.snuffles.tradeflow.repository.TradeSourceRepository;
import com.snuffles.tradeflow.service.exception.ResourceNotFoundException;
import com.snuffles.tradeflow.service.exception.ValidationException;
import com.snuffles.tradeflow.web.dto.TradeDto;
import com.snuffles.tradeflow.web.mapper.TradeMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class TradeService {

    private final TradeRepository tradeRepository;
    private final TradeOwnerRepository tradeOwnerRepository;
    private final TradeSourceRepository tradeSourceRepository;
    private final HoldingsService holdingsService;
    private final TradeMapper tradeMapper;

    @Transactional
    public TradeDto createTrade(TradeDto tradeDto) {
        TradeOwner owner = tradeOwnerRepository.findById(tradeDto.getTradeOwnerId())
            .orElseThrow(() -> new ResourceNotFoundException("TradeOwner not found"));

        TradeSource source = tradeSourceRepository.findById(tradeDto.getTradeSourceId())
            .orElseThrow(() -> new ResourceNotFoundException("TradeSource not found"));

        if (!source.getOwners().contains(owner)) {
            throw new ValidationException("Owner not associated with source");
        }

        Trade trade = tradeMapper.toEntity(tradeDto);
        trade.setOwner(owner);
        trade.setSource(source);

        Trade savedTrade = tradeRepository.save(trade);
        holdingsService.processNewTrade(savedTrade);

        return tradeMapper.toDto(savedTrade);
    }

    @Transactional(readOnly = true)
    public List<TradeDto> getAllTrades() {
        return tradeRepository.findAll().stream()
            .map(tradeMapper::toDto)
            .toList();
    }

    @Transactional
    public void deleteTrade(Long id) {
        Trade trade = tradeRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Trade not found"));

        tradeRepository.delete(trade);
        holdingsService.recalculateHolding(trade.getHolding().getId());
    }

    @Transactional
    public TradeDto updateTrade(Long id, TradeDto tradeDto) {
        Trade trade = tradeRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Trade not found"));

        Long oldHoldingId = trade.getHolding().getId();

        trade.setTransactionType(tradeDto.getTransactionType());
        trade.setTicker(tradeDto.getTicker());
        trade.setQuantity(tradeDto.getQuantity());
        trade.setPricePerUnit(tradeDto.getPricePerUnit());
        trade.setTradeDate(tradeDto.getTradeDate());

        TradeOwner owner = tradeOwnerRepository.findById(tradeDto.getTradeOwnerId())
            .orElseThrow(() -> new ResourceNotFoundException("TradeOwner not found"));

        TradeSource source = tradeSourceRepository.findById(tradeDto.getTradeSourceId())
            .orElseThrow(() -> new ResourceNotFoundException("TradeSource not found"));

        if (!source.getOwners().contains(owner)) {
            throw new ValidationException("Owner not associated with source");
        }

        boolean holdingChanged = !trade.getOwner().equals(owner) || !trade.getSource().equals(source) || !trade.getTicker().equals(tradeDto.getTicker());

        trade.setOwner(owner);
        trade.setSource(source);

        Trade updatedTrade = tradeRepository.save(trade);

        if (holdingChanged) {
            holdingsService.recalculateHolding(oldHoldingId);
            holdingsService.processNewTrade(updatedTrade);
        } else {
            holdingsService.recalculateHolding(updatedTrade.getHolding().getId());
        }

        return tradeMapper.toDto(updatedTrade);
    }
}
