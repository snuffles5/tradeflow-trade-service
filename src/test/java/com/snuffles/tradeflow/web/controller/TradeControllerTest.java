package com.snuffles.tradeflow.web.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.snuffles.tradeflow.service.HoldingsService;
import com.snuffles.tradeflow.service.TradeService;
import com.snuffles.tradeflow.web.dto.HoldingsSummaryDto;
import com.snuffles.tradeflow.web.dto.TradeDto;
import com.snuffles.tradeflow.web.dto.UnrealizedHoldingDto;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = TradeController.class)
class TradeControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private TradeService tradeService;

    @MockBean
    private HoldingsService holdingsService;

    @Test
    void createTradeReturnsCreatedTrade() throws Exception {
        TradeDto request = new TradeDto();
        request.setTransactionType(com.snuffles.tradeflow.domain.Trade.TransactionType.Buy);
        request.setTicker("AAPL");
        request.setQuantity(new BigDecimal("10"));
        request.setPricePerUnit(new BigDecimal("150"));
        request.setTradeDate(LocalDate.of(2024, 1, 1));
        request.setTradeOwnerId(1L);
        request.setTradeSourceId(2L);

        TradeDto response = new TradeDto();
        response.setId(5L);
        response.setTicker("AAPL");

        given(tradeService.createTrade(any(TradeDto.class))).willReturn(response);

        mockMvc.perform(post("/api/trades")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id", is(5)));

        verify(tradeService).createTrade(any(TradeDto.class));
    }

    @Test
    void getAllTradesReturnsList() throws Exception {
        TradeDto trade = new TradeDto();
        trade.setId(7L);
        given(tradeService.getAllTrades()).willReturn(List.of(trade));

        mockMvc.perform(get("/api/trades"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$", hasSize(1)))
            .andExpect(jsonPath("$[0].id", is(7)));
    }

    @Test
    void updateTradeReturnsUpdatedTrade() throws Exception {
        TradeDto request = new TradeDto();
        request.setTransactionType(com.snuffles.tradeflow.domain.Trade.TransactionType.Sell);
        request.setTicker("AAPL");
        request.setQuantity(new BigDecimal("5"));
        request.setPricePerUnit(new BigDecimal("200"));
        request.setTradeDate(LocalDate.of(2024, 1, 2));
        request.setTradeOwnerId(1L);
        request.setTradeSourceId(2L);

        TradeDto response = new TradeDto();
        response.setId(9L);
        given(tradeService.updateTrade(eq(9L), any(TradeDto.class))).willReturn(response);

        mockMvc.perform(put("/api/trades/9")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id", is(9)));
    }

    @Test
    void deleteTradeReturnsNoContent() throws Exception {
        mockMvc.perform(delete("/api/trades/3"))
            .andExpect(status().isNoContent());

        verify(tradeService).deleteTrade(3L);
    }

    @Test
    void createTradeFailsValidationForMissingFields() throws Exception {
        // Missing required fields: ticker, quantity, pricePerUnit, tradeDate, tradeOwnerId, tradeSourceId
        TradeDto invalid = new TradeDto();
        invalid.setTransactionType(com.snuffles.tradeflow.domain.Trade.TransactionType.Buy);

        mockMvc.perform(post("/api/trades")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(invalid)))
            .andExpect(status().isBadRequest());
    }

    @Test
    void createTradeFailsValidationForNegativeNumbers() throws Exception {
        TradeDto invalid = new TradeDto();
        invalid.setTransactionType(com.snuffles.tradeflow.domain.Trade.TransactionType.Buy);
        invalid.setTicker("AAPL");
        invalid.setQuantity(new BigDecimal("-1"));
        invalid.setPricePerUnit(new BigDecimal("0"));
        invalid.setTradeDate(LocalDate.of(2024, 1, 1));
        invalid.setTradeOwnerId(1L);
        invalid.setTradeSourceId(2L);

        mockMvc.perform(post("/api/trades")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(invalid)))
            .andExpect(status().isBadRequest());
    }

    @Test
    void getAllHoldingsReturnsHoldings() throws Exception {
        UnrealizedHoldingDto holding = new UnrealizedHoldingDto();
        holding.setId(1L);
        given(holdingsService.getAllHoldings()).willReturn(List.of(holding));

        mockMvc.perform(get("/api/holdings"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$", hasSize(1)))
            .andExpect(jsonPath("$[0].id", is(1)));
    }

    @Test
    void getHoldingsSummaryReturnsSummary() throws Exception {
        HoldingsSummaryDto summary = new HoldingsSummaryDto(
            new HoldingsSummaryDto.OverallSummaryDto(new BigDecimal("1000")),
            List.of(new HoldingsSummaryDto.NetCashBreakdownDto("Alice - Broker", new BigDecimal("1000")))
        );

        given(holdingsService.getHoldingsSummary()).willReturn(summary);

        mockMvc.perform(get("/api/holdings-summary"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.overall.totalNetCost", is(1000)));
    }
}
