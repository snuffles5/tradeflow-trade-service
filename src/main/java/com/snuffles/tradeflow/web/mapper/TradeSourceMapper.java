package com.snuffles.tradeflow.web.mapper;

import com.snuffles.tradeflow.domain.TradeSource;
import com.snuffles.tradeflow.web.dto.TradeSourceDto;
import org.mapstruct.Mapper;

@Mapper(componentModel = "spring", uses = TradeOwnerMapper.class)
public interface TradeSourceMapper {
    TradeSourceDto toDto(TradeSource tradeSource);
}
