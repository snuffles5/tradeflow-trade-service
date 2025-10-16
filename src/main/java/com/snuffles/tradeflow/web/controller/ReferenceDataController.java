package com.snuffles.tradeflow.web.controller;

import com.snuffles.tradeflow.domain.TradeOwner;
import com.snuffles.tradeflow.domain.TradeSource;
import com.snuffles.tradeflow.repository.TradeOwnerRepository;
import com.snuffles.tradeflow.repository.TradeSourceRepository;
import com.snuffles.tradeflow.web.dto.TradeOwnerDto;
import com.snuffles.tradeflow.web.dto.TradeSourceDto;
import com.snuffles.tradeflow.web.mapper.TradeOwnerMapper;
import com.snuffles.tradeflow.web.mapper.TradeSourceMapper;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
@Tag(name = "Reference Data", description = "Lookup endpoints for trade owners and sources")
public class ReferenceDataController {

    private final TradeOwnerRepository tradeOwnerRepository;
    private final TradeSourceRepository tradeSourceRepository;
    private final TradeOwnerMapper tradeOwnerMapper;
    private final TradeSourceMapper tradeSourceMapper;

    @GetMapping("/trade-owners")
    @Operation(summary = "List trade owners", description = "Returns all trade owners available for trade association.")
    @ApiResponse(responseCode = "200", description = "Owners fetched", content = @Content(schema = @Schema(implementation = TradeOwnerDto.class)))
    public ResponseEntity<List<TradeOwnerDto>> getAllTradeOwners() {
        List<TradeOwner> owners = tradeOwnerRepository.findAll();
        return ResponseEntity.ok(owners.stream().map(tradeOwnerMapper::toDto).toList());
    }

    @GetMapping("/trade-sources")
    @Operation(summary = "List trade sources", description = "Returns all trade sources with their metadata.")
    @ApiResponse(responseCode = "200", description = "Sources fetched", content = @Content(schema = @Schema(implementation = TradeSourceDto.class)))
    public ResponseEntity<List<TradeSourceDto>> getAllTradeSources() {
        List<TradeSource> sources = tradeSourceRepository.findAll();
        return ResponseEntity.ok(sources.stream().map(tradeSourceMapper::toDto).toList());
    }
}
