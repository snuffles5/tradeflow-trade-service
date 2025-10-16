package com.snuffles.tradeflow.service;

import com.snuffles.tradeflow.domain.Trade;
import com.snuffles.tradeflow.domain.UnrealizedHolding;
import com.snuffles.tradeflow.repository.TradeRepository;
import com.snuffles.tradeflow.repository.UnrealizedHoldingRepository;
import com.snuffles.tradeflow.web.dto.HoldingsSummaryDto;
import com.snuffles.tradeflow.web.dto.UnrealizedHoldingDto;
import com.snuffles.tradeflow.web.mapper.UnrealizedHoldingMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class HoldingsService {

    private final UnrealizedHoldingRepository holdingRepository;
    private final TradeRepository tradeRepository;
    private final UnrealizedHoldingMapper holdingMapper;

    @Transactional
    public void processNewTrade(Trade trade) {
        UnrealizedHolding holding = holdingRepository.findByTickerAndOwnerIdAndSourceIdAndCloseDateIsNull(
            trade.getTicker(),
            trade.getOwner().getId(),
            trade.getSource().getId()
        ).orElseGet(() -> createNewHolding(trade));

        updateHoldingWithTrade(holding, trade);
        trade.setHolding(holding);
        holdingRepository.save(holding);
    }

    @Transactional
    public void recalculateHolding(Long holdingId) {
        UnrealizedHolding holding = holdingRepository.findById(holdingId).orElse(null);
        if (holding == null) return;

        List<Trade> trades = tradeRepository.findByHoldingIdOrderByTradeDateAsc(holdingId);

        if (trades.isEmpty()) {
            holdingRepository.delete(holding);
            return;
        }

        resetHolding(holding);

        trades.forEach(trade -> updateHoldingWithTrade(holding, trade));
        holdingRepository.save(holding);
    }

    private UnrealizedHolding createNewHolding(Trade trade) {
        UnrealizedHolding holding = new UnrealizedHolding();
        holding.setTicker(trade.getTicker());
        holding.setOwner(trade.getOwner());
        holding.setSource(trade.getSource());
        holding.setOpenDate(trade.getTradeDate());
        resetHolding(holding);
        return holding;
    }

    private void resetHolding(UnrealizedHolding holding) {
        holding.setNetQuantity(BigDecimal.ZERO);
        holding.setAverageCost(BigDecimal.ZERO);
        holding.setNetCost(BigDecimal.ZERO);
        holding.setTotalBuyQuantity(BigDecimal.ZERO);
        holding.setTotalBuyCost(BigDecimal.ZERO);
        holding.setTotalSellQuantity(BigDecimal.ZERO);
        holding.setTotalSellValue(BigDecimal.ZERO);
        holding.setRealizedPnl(null);
        holding.setRealizedPnlPercentage(null);
        holding.setCloseDate(null);
    }

    private void updateHoldingWithTrade(UnrealizedHolding holding, Trade trade) {
        BigDecimal tradeValue = trade.getQuantity().multiply(trade.getPricePerUnit());
        holding.setLatestTradePrice(trade.getPricePerUnit());

        if (trade.getTransactionType() == Trade.TransactionType.Buy) {
            BigDecimal newTotalBuyQuantity = holding.getTotalBuyQuantity().add(trade.getQuantity());
            BigDecimal newTotalBuyCost = holding.getTotalBuyCost().add(tradeValue);

            holding.setTotalBuyQuantity(newTotalBuyQuantity);
            holding.setTotalBuyCost(newTotalBuyCost);

            if (newTotalBuyQuantity.compareTo(BigDecimal.ZERO) > 0) {
                holding.setAverageCost(newTotalBuyCost.divide(newTotalBuyQuantity, 4, RoundingMode.HALF_UP));
            }
        } else { // Sell
            holding.setTotalSellQuantity(holding.getTotalSellQuantity().add(trade.getQuantity()));
            holding.setTotalSellValue(holding.getTotalSellValue().add(tradeValue));
        }

        BigDecimal netQuantity = holding.getTotalBuyQuantity().subtract(holding.getTotalSellQuantity());
        holding.setNetQuantity(netQuantity);
        holding.setNetCost(holding.getTotalBuyCost().subtract(holding.getTotalSellValue()));

        if (netQuantity.compareTo(BigDecimal.ZERO) == 0) {
            holding.setCloseDate(trade.getTradeDate());
            BigDecimal realizedPnl = holding.getTotalSellValue().subtract(holding.getTotalBuyCost());
            holding.setRealizedPnl(realizedPnl);
            if (holding.getTotalBuyCost().compareTo(BigDecimal.ZERO) > 0) {
                BigDecimal pnlPercentage = realizedPnl.divide(holding.getTotalBuyCost(), 4, RoundingMode.HALF_UP).multiply(BigDecimal.valueOf(100));
                holding.setRealizedPnlPercentage(pnlPercentage);
            }
        }
    }

    @Transactional(readOnly = true)
    public List<UnrealizedHoldingDto> getAllHoldings() {
        return holdingRepository.findAll().stream()
            .map(this::toDto)
            .collect(Collectors.toList());
    }

    private UnrealizedHoldingDto toDto(UnrealizedHolding holding) {
        UnrealizedHoldingDto dto = holdingMapper.toDto(holding);
        dto.setHoldingPeriod(ChronoUnit.DAYS.between(holding.getOpenDate(), holding.getCloseDate() != null ? holding.getCloseDate() : LocalDate.now()));
        dto.setTradeCount(tradeRepository.findByHoldingIdOrderByTradeDateAsc(holding.getId()).size());
        dto.setStatus(holding.getNetQuantity().compareTo(BigDecimal.ZERO) == 0 ? "closed" : "open");
        return dto;
    }

    @Transactional(readOnly = true)
    public HoldingsSummaryDto getHoldingsSummary() {
        BigDecimal totalNetCost = BigDecimal.ZERO;
        List<HoldingsSummaryDto.NetCashBreakdownDto> breakdown = holdingRepository.findAll().stream()
            .collect(Collectors.groupingBy(h -> h.getOwner().getName() + " - " + h.getSource().getName(),
                Collectors.reducing(BigDecimal.ZERO, UnrealizedHolding::getNetCost, BigDecimal::add)))
            .entrySet().stream()
            .map(entry -> new HoldingsSummaryDto.NetCashBreakdownDto(entry.getKey(), entry.getValue()))
            .collect(Collectors.toList());

        for (HoldingsSummaryDto.NetCashBreakdownDto dto : breakdown) {
            totalNetCost = totalNetCost.add(dto.getNetCost());
        }

        return new HoldingsSummaryDto(new HoldingsSummaryDto.OverallSummaryDto(totalNetCost), breakdown);
    }
}
