package com.snuffles.tradeflow.web.mapper;

import com.snuffles.tradeflow.domain.LastPriceInfo;
import com.snuffles.tradeflow.web.dto.LastPriceInfoDto;
import javax.annotation.processing.Generated;
import org.springframework.stereotype.Component;

@Generated(
    value = "org.mapstruct.ap.MappingProcessor",
    date = "2025-10-15T23:00:00+0300",
    comments = "version: 1.5.5.Final, compiler: javac, environment: Java 23.0.2 (Homebrew)"
)
@Component
public class LastPriceInfoMapperImpl implements LastPriceInfoMapper {

    @Override
    public LastPriceInfoDto toDto(LastPriceInfo lastPriceInfo) {
        if ( lastPriceInfo == null ) {
            return null;
        }

        LastPriceInfoDto lastPriceInfoDto = new LastPriceInfoDto();

        lastPriceInfoDto.setTicker( lastPriceInfo.getTicker() );
        lastPriceInfoDto.setLastPrice( lastPriceInfo.getLastPrice() );
        lastPriceInfoDto.setChangeToday( lastPriceInfo.getChangeToday() );
        lastPriceInfoDto.setChangeTodayPercentage( lastPriceInfo.getChangeTodayPercentage() );
        lastPriceInfoDto.setMarketIdentifier( lastPriceInfo.getMarketIdentifier() );
        lastPriceInfoDto.setProviderSource( lastPriceInfo.getProviderSource() );
        lastPriceInfoDto.setLastUpdated( lastPriceInfo.getLastUpdated() );

        return lastPriceInfoDto;
    }
}
