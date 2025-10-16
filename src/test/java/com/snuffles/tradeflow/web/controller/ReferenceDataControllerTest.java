package com.snuffles.tradeflow.web.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.snuffles.tradeflow.domain.TradeOwner;
import com.snuffles.tradeflow.domain.TradeSource;
import com.snuffles.tradeflow.repository.TradeOwnerRepository;
import com.snuffles.tradeflow.repository.TradeSourceRepository;
import com.snuffles.tradeflow.web.dto.TradeOwnerDto;
import com.snuffles.tradeflow.web.dto.TradeSourceDto;
import com.snuffles.tradeflow.web.mapper.TradeOwnerMapper;
import com.snuffles.tradeflow.web.mapper.TradeSourceMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = ReferenceDataController.class)
class ReferenceDataControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private TradeOwnerRepository tradeOwnerRepository;

    @MockBean
    private TradeSourceRepository tradeSourceRepository;

    @MockBean
    private TradeOwnerMapper tradeOwnerMapper;

    @MockBean
    private TradeSourceMapper tradeSourceMapper;

    @Test
    void getAllTradeOwnersReturnsMappedDtos() throws Exception {
        TradeOwner owner = new TradeOwner();
        owner.setId(1L);
        owner.setName("Alice");
        TradeOwnerDto ownerDto = new TradeOwnerDto();
        ownerDto.setId(1L);
        ownerDto.setName("Alice");

        given(tradeOwnerRepository.findAll()).willReturn(List.of(owner));
        given(tradeOwnerMapper.toDto(owner)).willReturn(ownerDto);

        mockMvc.perform(get("/api/trade-owners")
                .accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$", hasSize(1)))
            .andExpect(jsonPath("$[0].name", is("Alice")));
    }

    @Test
    void getAllTradeSourcesReturnsMappedDtos() throws Exception {
        TradeSource source = new TradeSource();
        source.setId(2L);
        source.setName("Broker");
        TradeSourceDto sourceDto = new TradeSourceDto();
        sourceDto.setId(2L);
        sourceDto.setName("Broker");

        given(tradeSourceRepository.findAll()).willReturn(List.of(source));
        given(tradeSourceMapper.toDto(source)).willReturn(sourceDto);

        mockMvc.perform(get("/api/trade-sources")
                .accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$", hasSize(1)))
            .andExpect(jsonPath("$[0].name", is("Broker")));
    }
}
