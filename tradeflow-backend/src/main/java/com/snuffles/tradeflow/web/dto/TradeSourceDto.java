package com.snuffles.tradeflow.web.dto;

import lombok.Data;

import java.util.List;

@Data
public class TradeSourceDto {
    private Long id;
    private String name;
    private List<TradeOwnerDto> owners;
}
