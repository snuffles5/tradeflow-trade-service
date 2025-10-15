package com.snuffles.tradeflow;

import com.snuffles.tradeflow.web.dto.TradeDto;
import com.snuffles.tradeflow.web.dto.UnrealizedHoldingDto;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

public class TradeControllerIT extends ITBase {

    @Autowired
    private TestRestTemplate restTemplate;

    private Long ownerId;
    private Long sourceId;

    @BeforeEach
    void setUp() {
        // Assuming reference data controller is working and can be used to set up
        // For a more isolated test, you could directly use repositories to set up data
        ownerId = 1L; // Assuming seeding creates this
        sourceId = 1L; // Assuming seeding creates this
    }

    @Test
    void shouldCreateTradeAndHolding() {
        TradeDto tradeDto = new TradeDto();
        tradeDto.setTicker("AAPL");
        tradeDto.setTransactionType(com.snuffles.tradeflow.domain.Trade.TransactionType.Buy);
        tradeDto.setQuantity(new BigDecimal("10"));
        tradeDto.setPricePerUnit(new BigDecimal("150.00"));
        tradeDto.setTradeDate(LocalDate.now());
        tradeDto.setTradeOwnerId(ownerId);
        tradeDto.setTradeSourceId(sourceId);

        ResponseEntity<TradeDto> createResponse = restTemplate.postForEntity("/api/trades", tradeDto, TradeDto.class);
        assertThat(createResponse.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(createResponse.getBody()).isNotNull();
        assertThat(createResponse.getBody().getId()).isNotNull();

        ResponseEntity<UnrealizedHoldingDto[]> holdingsResponse = restTemplate.getForEntity("/api/holdings", UnrealizedHoldingDto[].class);
        assertThat(holdingsResponse.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(holdingsResponse.getBody()).hasSize(1);

        UnrealizedHoldingDto holding = holdingsResponse.getBody()[0];
        assertThat(holding.getTicker()).isEqualTo("AAPL");
        assertThat(holding.getNetQuantity()).isEqualByComparingTo(new BigDecimal("10"));
        assertThat(holding.getAverageCost()).isEqualByComparingTo(new BigDecimal("150.00"));
    }
}
