package com.snuffles.tradeflow.web.mapper;

import com.snuffles.tradeflow.domain.Trade;
import com.snuffles.tradeflow.domain.TradeOwner;
import com.snuffles.tradeflow.domain.TradeSource;
import com.snuffles.tradeflow.web.dto.TradeDto;
import javax.annotation.processing.Generated;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

@Generated(
    value = "org.mapstruct.ap.MappingProcessor",
    date = "2025-10-15T22:59:59+0300",
    comments = "version: 1.5.5.Final, compiler: javac, environment: Java 23.0.2 (Homebrew)"
)
@Component
public class TradeMapperImpl implements TradeMapper {

    @Autowired
    private TradeOwnerMapper tradeOwnerMapper;
    @Autowired
    private TradeSourceMapper tradeSourceMapper;

    @Override
    public TradeDto toDto(Trade trade) {
        if ( trade == null ) {
            return null;
        }

        TradeDto tradeDto = new TradeDto();

        tradeDto.setTradeOwnerId( tradeOwnerId( trade ) );
        tradeDto.setTradeSourceId( tradeSourceId( trade ) );
        tradeDto.setId( trade.getId() );
        tradeDto.setTransactionType( trade.getTransactionType() );
        tradeDto.setTicker( trade.getTicker() );
        tradeDto.setQuantity( trade.getQuantity() );
        tradeDto.setPricePerUnit( trade.getPricePerUnit() );
        tradeDto.setTradeDate( trade.getTradeDate() );
        tradeDto.setOwner( tradeOwnerMapper.toDto( trade.getOwner() ) );
        tradeDto.setSource( tradeSourceMapper.toDto( trade.getSource() ) );

        return tradeDto;
    }

    @Override
    public Trade toEntity(TradeDto tradeDto) {
        if ( tradeDto == null ) {
            return null;
        }

        Trade trade = new Trade();

        trade.setTransactionType( tradeDto.getTransactionType() );
        trade.setTicker( tradeDto.getTicker() );
        trade.setQuantity( tradeDto.getQuantity() );
        trade.setPricePerUnit( tradeDto.getPricePerUnit() );
        trade.setTradeDate( tradeDto.getTradeDate() );

        return trade;
    }

    private Long tradeOwnerId(Trade trade) {
        if ( trade == null ) {
            return null;
        }
        TradeOwner owner = trade.getOwner();
        if ( owner == null ) {
            return null;
        }
        Long id = owner.getId();
        if ( id == null ) {
            return null;
        }
        return id;
    }

    private Long tradeSourceId(Trade trade) {
        if ( trade == null ) {
            return null;
        }
        TradeSource source = trade.getSource();
        if ( source == null ) {
            return null;
        }
        Long id = source.getId();
        if ( id == null ) {
            return null;
        }
        return id;
    }
}
