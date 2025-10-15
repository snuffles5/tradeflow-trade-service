package com.snuffles.tradeflow.web.mapper;

import com.snuffles.tradeflow.domain.TradeOwner;
import com.snuffles.tradeflow.web.dto.TradeOwnerDto;
import javax.annotation.processing.Generated;
import org.springframework.stereotype.Component;

@Generated(
    value = "org.mapstruct.ap.MappingProcessor",
    date = "2025-10-15T23:00:00+0300",
    comments = "version: 1.5.5.Final, compiler: javac, environment: Java 23.0.2 (Homebrew)"
)
@Component
public class TradeOwnerMapperImpl implements TradeOwnerMapper {

    @Override
    public TradeOwnerDto toDto(TradeOwner tradeOwner) {
        if ( tradeOwner == null ) {
            return null;
        }

        TradeOwnerDto tradeOwnerDto = new TradeOwnerDto();

        tradeOwnerDto.setId( tradeOwner.getId() );
        tradeOwnerDto.setName( tradeOwner.getName() );

        return tradeOwnerDto;
    }
}
