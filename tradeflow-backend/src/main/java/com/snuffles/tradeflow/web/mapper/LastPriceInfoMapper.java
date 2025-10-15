package com.snuffles.tradeflow.web.mapper;

import com.snuffles.tradeflow.domain.LastPriceInfo;
import com.snuffles.tradeflow.web.dto.LastPriceInfoDto;
import org.mapstruct.Mapper;

@Mapper(componentModel = "spring")
public interface LastPriceInfoMapper {
    LastPriceInfoDto toDto(LastPriceInfo lastPriceInfo);
}
