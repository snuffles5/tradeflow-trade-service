package com.snuffles.tradeflow.web.mapper;

import com.snuffles.tradeflow.domain.Trade;
import com.snuffles.tradeflow.web.dto.TradeDto;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring", uses = {TradeOwnerMapper.class, TradeSourceMapper.class})
public interface TradeMapper {

    @Mapping(source = "owner.id", target = "tradeOwnerId")
    @Mapping(source = "source.id", target = "tradeSourceId")
    @Mapping(source = "holding.id", target = "holdingId")
    @Mapping(source = "tradeDate", target = "tradeDate")
    @Mapping(source = "createdAt", target = "createdAt")
    @Mapping(source = "updatedAt", target = "updatedAt")
    TradeDto toDto(Trade trade);

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    @Mapping(target = "owner", ignore = true)
    @Mapping(target = "source", ignore = true)
    @Mapping(target = "holding", ignore = true)
    @Mapping(target = "deletedAt", ignore = true)
    @Mapping(source = "tradeDate", target = "tradeDate")
    Trade toEntity(TradeDto tradeDto);
}
