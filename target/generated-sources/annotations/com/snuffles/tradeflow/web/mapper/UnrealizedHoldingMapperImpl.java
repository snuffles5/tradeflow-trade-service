package com.snuffles.tradeflow.web.mapper;

import com.snuffles.tradeflow.domain.UnrealizedHolding;
import com.snuffles.tradeflow.web.dto.UnrealizedHoldingDto;
import javax.annotation.processing.Generated;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

@Generated(
    value = "org.mapstruct.ap.MappingProcessor",
    date = "2025-10-15T23:00:00+0300",
    comments = "version: 1.5.5.Final, compiler: javac, environment: Java 23.0.2 (Homebrew)"
)
@Component
public class UnrealizedHoldingMapperImpl implements UnrealizedHoldingMapper {

    @Autowired
    private TradeOwnerMapper tradeOwnerMapper;
    @Autowired
    private TradeSourceMapper tradeSourceMapper;

    @Override
    public UnrealizedHoldingDto toDto(UnrealizedHolding unrealizedHolding) {
        if ( unrealizedHolding == null ) {
            return null;
        }

        UnrealizedHoldingDto unrealizedHoldingDto = new UnrealizedHoldingDto();

        unrealizedHoldingDto.setId( unrealizedHolding.getId() );
        unrealizedHoldingDto.setTicker( unrealizedHolding.getTicker() );
        unrealizedHoldingDto.setNetQuantity( unrealizedHolding.getNetQuantity() );
        unrealizedHoldingDto.setNetCost( unrealizedHolding.getNetCost() );
        unrealizedHoldingDto.setAverageCost( unrealizedHolding.getAverageCost() );
        unrealizedHoldingDto.setSource( tradeSourceMapper.toDto( unrealizedHolding.getSource() ) );
        unrealizedHoldingDto.setOwner( tradeOwnerMapper.toDto( unrealizedHolding.getOwner() ) );
        unrealizedHoldingDto.setRealizedPnl( unrealizedHolding.getRealizedPnl() );
        unrealizedHoldingDto.setRealizedPnlPercentage( unrealizedHolding.getRealizedPnlPercentage() );
        unrealizedHoldingDto.setLatestTradePrice( unrealizedHolding.getLatestTradePrice() );
        unrealizedHoldingDto.setTotalBuyQuantity( unrealizedHolding.getTotalBuyQuantity() );
        unrealizedHoldingDto.setTotalBuyCost( unrealizedHolding.getTotalBuyCost() );
        unrealizedHoldingDto.setTotalSellQuantity( unrealizedHolding.getTotalSellQuantity() );
        unrealizedHoldingDto.setTotalSellValue( unrealizedHolding.getTotalSellValue() );
        unrealizedHoldingDto.setOpenDate( unrealizedHolding.getOpenDate() );
        unrealizedHoldingDto.setCloseDate( unrealizedHolding.getCloseDate() );

        return unrealizedHoldingDto;
    }
}
