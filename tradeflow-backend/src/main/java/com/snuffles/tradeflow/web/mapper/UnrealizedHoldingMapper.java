package com.snuffles.tradeflow.web.mapper;

import com.snuffles.tradeflow.domain.UnrealizedHolding;
import com.snuffles.tradeflow.web.dto.UnrealizedHoldingDto;
import org.mapstruct.Mapper;

@Mapper(componentModel = "spring", uses = {TradeOwnerMapper.class, TradeSourceMapper.class})
public interface UnrealizedHoldingMapper {
    UnrealizedHoldingDto toDto(UnrealizedHolding unrealizedHolding);
}
