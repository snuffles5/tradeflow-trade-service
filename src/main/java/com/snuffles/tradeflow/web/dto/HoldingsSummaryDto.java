package com.snuffles.tradeflow.web.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data
@AllArgsConstructor
public class HoldingsSummaryDto {

    private OverallSummaryDto overall;
    private List<NetCashBreakdownDto> netCashBreakdown;

    @Data
    @AllArgsConstructor
    public static class OverallSummaryDto {
        private BigDecimal totalNetCost;
    }

    @Data
    @AllArgsConstructor
    public static class NetCashBreakdownDto {
        private String combination;
        private BigDecimal netCost;
    }
}
