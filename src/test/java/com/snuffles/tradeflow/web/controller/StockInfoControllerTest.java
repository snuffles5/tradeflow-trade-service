package com.snuffles.tradeflow.web.controller;

import com.snuffles.tradeflow.service.StockInfoService;
import com.snuffles.tradeflow.web.dto.LastPriceInfoDto;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = StockInfoController.class)
class StockInfoControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private StockInfoService stockInfoService;

    @Test
    void getStockInfoReturnsDataWhenPresent() throws Exception {
        LastPriceInfoDto dto = new LastPriceInfoDto();
        dto.setTicker("SPY");
        dto.setLastPrice(new BigDecimal("509.12"));
        dto.setChangeToday(new BigDecimal("-2.50"));
        dto.setLastUpdated(Instant.parse("2024-01-01T00:00:00Z"));

        given(stockInfoService.getStockInfo(eq("SPY"))).willReturn(Optional.of(dto));

        mockMvc.perform(get("/api/stock-info/SPY").accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.ticker").value("SPY"))
            .andExpect(jsonPath("$.lastPrice").value(509.12));
    }

    @Test
    void getStockInfoReturns404WhenMissing() throws Exception {
        given(stockInfoService.getStockInfo(eq("QQQ"))).willReturn(Optional.empty());

        mockMvc.perform(get("/api/stock-info/QQQ"))
            .andExpect(status().isNotFound());
    }
}
