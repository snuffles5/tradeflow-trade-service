package com.snuffles.tradeflow.service;

import com.snuffles.tradeflow.domain.Trade;
import com.snuffles.tradeflow.domain.UnrealizedHolding;
import com.snuffles.tradeflow.repository.TradeRepository;
import com.snuffles.tradeflow.repository.UnrealizedHoldingRepository;
import com.snuffles.tradeflow.web.dto.HoldingsSummaryDto;
import com.snuffles.tradeflow.web.dto.UnrealizedHoldingDto;
import com.snuffles.tradeflow.web.mapper.UnrealizedHoldingMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class HoldingsService {

    private final UnrealizedHoldingRepository holdingRepository;
    private final TradeRepository tradeRepository;
    private final UnrealizedHoldingMapper holdingMapper;

    @Transactional
    public void processNewTrade(Trade trade) {
        log.debug(
            "Processing new trade {} for ticker {} (owner={}, source={})",
            trade.getId(),
            trade.getTicker(),
            trade.getOwner() != null ? trade.getOwner().getId() : null,
            trade.getSource() != null ? trade.getSource().getId() : null
        );

        UnrealizedHolding holding = holdingRepository.findByTickerAndOwnerIdAndSourceIdAndCloseDateIsNull(
            trade.getTicker(),
            trade.getOwner().getId(),
            trade.getSource().getId()
        ).orElseGet(() -> createNewHolding(trade));

        boolean newHolding = holding.getId() == null;
        log.debug(
            "Using {} holding{} for ticker {}",
            newHolding ? "new" : "existing",
            newHolding ? "" : " id=" + holding.getId(),
            trade.getTicker()
        );

        updateHoldingWithTrade(holding, trade);
        trade.setHolding(holding);
        holdingRepository.save(holding);
        log.debug(
            "Updated holding{} for ticker {}: netQty={}, netCost={}, avgCost={}, latestPrice={}",
            holding.getId() != null ? " id=" + holding.getId() : "",
            trade.getTicker(),
            holding.getNetQuantity(),
            holding.getNetCost(),
            holding.getAverageCost(),
            holding.getLatestTradePrice()
        );
    }

    @Transactional
    public void recalculateHolding(Long holdingId) {
        UnrealizedHolding holding = holdingRepository.findById(holdingId).orElse(null);
        if (holding == null) {
            log.warn("Requested recalculation for missing holding id={}", holdingId);
            return;
        }

        log.debug("Recalculating holding id={} for ticker {}", holdingId, holding.getTicker());

        List<Trade> trades = tradeRepository.findByHoldingIdOrderByTradeDateAsc(holdingId);

        if (trades.isEmpty()) {
            log.info("No trades remain for holding id={}; deleting", holdingId);
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
        holding.setOpenDate(toUtcDate(trade.getTradeDate()));
        resetHolding(holding);
        log.debug(
            "Created new holding draft for ticker {} (owner={}, source={})",
            trade.getTicker(),
            trade.getOwner() != null ? trade.getOwner().getId() : null,
            trade.getSource() != null ? trade.getSource().getId() : null
        );
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
        log.trace("Reset holding state for ticker {}", holding.getTicker());
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
            holding.setCloseDate(toUtcDate(trade.getTradeDate()));
            BigDecimal realizedPnl = holding.getTotalSellValue().subtract(holding.getTotalBuyCost());
            holding.setRealizedPnl(realizedPnl);
            if (holding.getTotalBuyCost().compareTo(BigDecimal.ZERO) > 0) {
                BigDecimal pnlPercentage = realizedPnl.divide(holding.getTotalBuyCost(), 4, RoundingMode.HALF_UP).multiply(BigDecimal.valueOf(100));
                holding.setRealizedPnlPercentage(pnlPercentage);
            }
            log.debug(
                "Holding for ticker {} closed on {} with realizedPnL={} ({}%)",
                trade.getTicker(),
                holding.getCloseDate(),
                holding.getRealizedPnl(),
                holding.getRealizedPnlPercentage()
            );
        } else {
            log.trace(
                "Holding for ticker {} updated: netQty={}, avgCost={}, latestPrice={}",
                trade.getTicker(),
                holding.getNetQuantity(),
                holding.getAverageCost(),
                holding.getLatestTradePrice()
            );
        }
    }

    @Transactional(readOnly = true)
    public List<UnrealizedHoldingDto> getAllHoldings() {
        List<UnrealizedHoldingDto> holdings = holdingRepository.findAll().stream()
            .map(this::toDto)
            .collect(Collectors.toList());
        log.debug("Fetched {} holdings", holdings.size());
        return holdings;
    }

    private UnrealizedHoldingDto toDto(UnrealizedHolding holding) {
        UnrealizedHoldingDto dto = holdingMapper.toDto(holding);
        dto.setHoldingPeriod(ChronoUnit.DAYS.between(holding.getOpenDate(), holding.getCloseDate() != null ? holding.getCloseDate() : LocalDate.now(ZoneOffset.UTC)));
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

        log.debug("Computed holdings summary with {} groups and total net cost {}", breakdown.size(), totalNetCost);
        return new HoldingsSummaryDto(new HoldingsSummaryDto.OverallSummaryDto(totalNetCost), breakdown);
    }

    private LocalDate toUtcDate(Instant instant) {
        return instant == null ? null : instant.atZone(ZoneOffset.UTC).toLocalDate();
    }
}
