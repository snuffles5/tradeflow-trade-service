package com.snuffles.tradeflow.web.controller;

import com.snuffles.tradeflow.domain.TradeOwner;
import com.snuffles.tradeflow.domain.TradeSource;
import com.snuffles.tradeflow.repository.TradeOwnerRepository;
import com.snuffles.tradeflow.repository.TradeSourceRepository;
import com.snuffles.tradeflow.web.dto.TradeOwnerDto;
import com.snuffles.tradeflow.web.dto.TradeSourceDto;
import com.snuffles.tradeflow.web.mapper.TradeOwnerMapper;
import com.snuffles.tradeflow.web.mapper.TradeSourceMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class ReferenceDataController {

    private final TradeOwnerRepository tradeOwnerRepository;
    private final TradeSourceRepository tradeSourceRepository;
    private final TradeOwnerMapper tradeOwnerMapper;
    private final TradeSourceMapper tradeSourceMapper;

    @GetMapping("/trade-owners")
    public ResponseEntity<List<TradeOwnerDto>> getAllTradeOwners() {
        List<TradeOwner> owners = tradeOwnerRepository.findAll();
        return ResponseEntity.ok(owners.stream().map(tradeOwnerMapper::toDto).toList());
    }

    @GetMapping("/trade-sources")
    public ResponseEntity<List<TradeSourceDto>> getAllTradeSources() {
        List<TradeSource> sources = tradeSourceRepository.findAll();
        return ResponseEntity.ok(sources.stream().map(tradeSourceMapper::toDto).toList());
    }
}
