package com.snuffles.tradeflow.web.controller;

import com.snuffles.tradeflow.service.HoldingsService;
import com.snuffles.tradeflow.service.TradeService;
import com.snuffles.tradeflow.web.dto.HoldingsSummaryDto;
import com.snuffles.tradeflow.web.dto.TradeDto;
import com.snuffles.tradeflow.web.dto.UnrealizedHoldingDto;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class TradeController {

    private final TradeService tradeService;
    private final HoldingsService holdingsService;

    @PostMapping("/trades")
    public ResponseEntity<TradeDto> createTrade(@Valid @RequestBody TradeDto tradeDto) {
        TradeDto createdTrade = tradeService.createTrade(tradeDto);
        return new ResponseEntity<>(createdTrade, HttpStatus.CREATED);
    }

    @GetMapping("/trades")
    public ResponseEntity<List<TradeDto>> getAllTrades() {
        return ResponseEntity.ok(tradeService.getAllTrades());
    }

    @PutMapping("/trades/{id}")
    public ResponseEntity<TradeDto> updateTrade(@PathVariable Long id, @Valid @RequestBody TradeDto tradeDto) {
        return ResponseEntity.ok(tradeService.updateTrade(id, tradeDto));
    }

    @DeleteMapping("/trades/{id}")
    public ResponseEntity<Void> deleteTrade(@PathVariable Long id) {
        tradeService.deleteTrade(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/holdings")
    public ResponseEntity<List<UnrealizedHoldingDto>> getAllHoldings() {
        return ResponseEntity.ok(holdingsService.getAllHoldings());
    }

    @GetMapping("/holdings-summary")
    public ResponseEntity<HoldingsSummaryDto> getHoldingsSummary() {
        return ResponseEntity.ok(holdingsService.getHoldingsSummary());
    }
}
