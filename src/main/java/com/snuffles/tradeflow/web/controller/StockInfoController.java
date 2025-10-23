package com.snuffles.tradeflow.web.controller;

import com.snuffles.tradeflow.service.StockInfoService;
import com.snuffles.tradeflow.web.dto.LastPriceInfoDto;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Optional;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
@Tag(name = "Stock Info", description = "Endpoints for latest stock price info")
public class StockInfoController {

    private final StockInfoService stockInfoService;

    @GetMapping("/stock-info/{ticker}")
    @Operation(summary = "Get latest stock info", description = "Returns last known price info for the given ticker. Uses cache TTL.")
    @ApiResponse(responseCode = "200", description = "Stock info fetched", content = @Content(schema = @Schema(implementation = LastPriceInfoDto.class)))
    public ResponseEntity<LastPriceInfoDto> getStockInfo(@PathVariable String ticker) {
        Optional<LastPriceInfoDto> result = stockInfoService.getStockInfo(ticker);
        return result.map(ResponseEntity::ok).orElseGet(() -> ResponseEntity.notFound().build());
    }
}
