package com.snuffles.tradeflow.web.mapper;

import com.snuffles.tradeflow.domain.TradeOwner;
import com.snuffles.tradeflow.web.dto.TradeOwnerDto;
import org.mapstruct.Mapper;

@Mapper(componentModel = "spring")
public interface TradeOwnerMapper {
    TradeOwnerDto toDto(TradeOwner tradeOwner);
}
