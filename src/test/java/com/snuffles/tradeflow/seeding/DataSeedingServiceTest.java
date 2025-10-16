package com.snuffles.tradeflow.seeding;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.snuffles.tradeflow.domain.TradeOwner;
import com.snuffles.tradeflow.domain.TradeSource;
import com.snuffles.tradeflow.repository.TradeOwnerRepository;
import com.snuffles.tradeflow.repository.TradeSourceRepository;
import com.snuffles.tradeflow.service.TradeService;
import com.snuffles.tradeflow.web.dto.TradeDto;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.boot.DefaultApplicationArguments;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DataSeedingServiceTest {

    @Mock
    private TradeOwnerRepository tradeOwnerRepository;

    @Mock
    private TradeSourceRepository tradeSourceRepository;

    @Mock
    private TradeService tradeService;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private DataSeedingService seedingService;

    @BeforeEach
    void init() {
        seedingService = new DataSeedingService(
            tradeOwnerRepository, tradeSourceRepository, tradeService, objectMapper
        );
    }

    @Test
    void runSeedsDataWhenDbEmpty() throws Exception {
        given(tradeOwnerRepository.count()).willReturn(0L);

        // Owner save returns same instance with id
        when(tradeOwnerRepository.findByName(any())).thenReturn(Optional.empty());
        when(tradeOwnerRepository.save(any(TradeOwner.class))).thenAnswer(inv -> {
            TradeOwner o = inv.getArgument(0);
            o.setId(1L);
            return o;
        });

        when(tradeSourceRepository.findByName(any())).thenReturn(Optional.empty());
        when(tradeSourceRepository.save(any(TradeSource.class))).thenAnswer(inv -> {
            TradeSource s = inv.getArgument(0);
            if (s.getId() == null) s.setId(2L);
            return s;
        });

        seedingService.run(new DefaultApplicationArguments());

        ArgumentCaptor<TradeDto> dtoCaptor = ArgumentCaptor.forClass(TradeDto.class);
        verify(tradeService, atLeastOnce()).createTrade(dtoCaptor.capture());
        // From test fixture (src/test/resources/seed-data.json) we expect 2 items
        assertThat(dtoCaptor.getAllValues().size()).isEqualTo(2);
    }

    @Test
    void runSkipsWhenDbAlreadySeeded() throws Exception {
        given(tradeOwnerRepository.count()).willReturn(1L);

        seedingService.run(new DefaultApplicationArguments());

        verifyNoInteractions(tradeService);
    }
}
