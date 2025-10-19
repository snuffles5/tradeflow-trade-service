package com.snuffles.tradeflow.web.controller;

import com.snuffles.tradeflow.service.HoldingsService;
import com.snuffles.tradeflow.service.TradeService;
import com.snuffles.tradeflow.web.dto.HoldingsSummaryDto;
import com.snuffles.tradeflow.web.dto.TradeDto;
import com.snuffles.tradeflow.web.dto.UnrealizedHoldingDto;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
@Tag(name = "Trades", description = "Operations for managing trades and holdings")
public class TradeController {

    private final TradeService tradeService;
    private final HoldingsService holdingsService;

    @PostMapping("/trades")
    @Operation(summary = "Create a trade", description = "Creates a trade and updates the associated holding metrics.")
    @ApiResponses({
        @ApiResponse(responseCode = "201", description = "Trade successfully created", content = @Content(schema = @Schema(implementation = TradeDto.class))),
        @ApiResponse(responseCode = "400", description = "Validation error", content = @Content)
    })
    public ResponseEntity<TradeDto> createTrade(@Valid @RequestBody TradeDto tradeDto) {
        TradeDto createdTrade = tradeService.createTrade(tradeDto);
        return new ResponseEntity<>(createdTrade, HttpStatus.CREATED);
    }

    @GetMapping("/trades")
    @Operation(summary = "List trades", description = "Returns all trades ordered by creation time.")
    @ApiResponse(responseCode = "200", description = "Trades fetched", content = @Content(schema = @Schema(implementation = TradeDto.class)))
    public ResponseEntity<List<TradeDto>> getAllTrades() {
        return ResponseEntity.ok(tradeService.getAllTrades());
    }

    @PutMapping("/trades/{id}")
    @Operation(summary = "Update a trade", description = "Updates an existing trade and recalculates holdings as needed.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Trade updated", content = @Content(schema = @Schema(implementation = TradeDto.class))),
        @ApiResponse(responseCode = "400", description = "Validation error", content = @Content),
        @ApiResponse(responseCode = "404", description = "Trade not found", content = @Content)
    })
    public ResponseEntity<TradeDto> updateTrade(@PathVariable Long id, @Valid @RequestBody TradeDto tradeDto) {
        return ResponseEntity.ok(tradeService.updateTrade(id, tradeDto));
    }

    @DeleteMapping("/trades/{id}")
    @Operation(summary = "Delete a trade", description = "Deletes a trade and reconciles its holding if required.")
    @ApiResponses({
        @ApiResponse(responseCode = "204", description = "Trade removed", content = @Content),
        @ApiResponse(responseCode = "404", description = "Trade not found", content = @Content)
    })
    public ResponseEntity<Void> deleteTrade(@PathVariable Long id) {
        tradeService.deleteTrade(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/holdings")
    @Operation(summary = "List holdings", description = "Returns a view of all unrealized holdings, including calculated metrics.")
    @ApiResponse(responseCode = "200", description = "Holdings fetched", content = @Content(schema = @Schema(implementation = UnrealizedHoldingDto.class)))
    public ResponseEntity<List<UnrealizedHoldingDto>> getAllHoldings() {
        return ResponseEntity.ok(holdingsService.getAllHoldings());
    }

    @GetMapping("/holdings-summary")
    @Operation(summary = "Holding summary", description = "Provides aggregated net cash metrics grouped by owner and source.")
    @ApiResponse(responseCode = "200", description = "Summary fetched", content = @Content(schema = @Schema(implementation = HoldingsSummaryDto.class)))
    public ResponseEntity<HoldingsSummaryDto> getHoldingsSummary() {
        return ResponseEntity.ok(holdingsService.getHoldingsSummary());
    }
}
