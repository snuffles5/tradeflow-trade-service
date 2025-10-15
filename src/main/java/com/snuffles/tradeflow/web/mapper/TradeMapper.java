package com.snuffles.tradeflow.web.mapper;

import com.snuffles.tradeflow.domain.Trade;
import com.snuffles.tradeflow.web.dto.TradeDto;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring", uses = {TradeOwnerMapper.class, TradeSourceMapper.class})
public interface TradeMapper {

    @Mapping(source = "owner.id", target = "tradeOwnerId")
    @Mapping(source = "source.id", target = "tradeSourceId")
    TradeDto toDto(Trade trade);

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    @Mapping(target = "owner", ignore = true)
    @Mapping(target = "source", ignore = true)
    @Mapping(target = "holding", ignore = true)
    @Mapping(target = "deletedAt", ignore = true)
    Trade toEntity(TradeDto tradeDto);
}
