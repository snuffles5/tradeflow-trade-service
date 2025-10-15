package com.snuffles.tradeflow.web.mapper;

import com.snuffles.tradeflow.domain.TradeOwner;
import com.snuffles.tradeflow.domain.TradeSource;
import com.snuffles.tradeflow.web.dto.TradeOwnerDto;
import com.snuffles.tradeflow.web.dto.TradeSourceDto;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import javax.annotation.processing.Generated;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

@Generated(
    value = "org.mapstruct.ap.MappingProcessor",
    date = "2025-10-15T22:59:59+0300",
    comments = "version: 1.5.5.Final, compiler: javac, environment: Java 23.0.2 (Homebrew)"
)
@Component
public class TradeSourceMapperImpl implements TradeSourceMapper {

    @Autowired
    private TradeOwnerMapper tradeOwnerMapper;

    @Override
    public TradeSourceDto toDto(TradeSource tradeSource) {
        if ( tradeSource == null ) {
            return null;
        }

        TradeSourceDto tradeSourceDto = new TradeSourceDto();

        tradeSourceDto.setId( tradeSource.getId() );
        tradeSourceDto.setName( tradeSource.getName() );
        tradeSourceDto.setOwners( tradeOwnerSetToTradeOwnerDtoList( tradeSource.getOwners() ) );

        return tradeSourceDto;
    }

    protected List<TradeOwnerDto> tradeOwnerSetToTradeOwnerDtoList(Set<TradeOwner> set) {
        if ( set == null ) {
            return null;
        }

        List<TradeOwnerDto> list = new ArrayList<TradeOwnerDto>( set.size() );
        for ( TradeOwner tradeOwner : set ) {
            list.add( tradeOwnerMapper.toDto( tradeOwner ) );
        }

        return list;
    }
}
