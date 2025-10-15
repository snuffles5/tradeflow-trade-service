package com.snuffles.tradeflow.seeding;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.snuffles.tradeflow.domain.Trade;
import com.snuffles.tradeflow.domain.TradeOwner;
import com.snuffles.tradeflow.domain.TradeSource;
import com.snuffles.tradeflow.repository.TradeOwnerRepository;
import com.snuffles.tradeflow.repository.TradeSourceRepository;
import com.snuffles.tradeflow.service.TradeService;
import com.snuffles.tradeflow.web.dto.TradeDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class DataSeedingService implements ApplicationRunner {

    private final TradeOwnerRepository tradeOwnerRepository;
    private final TradeSourceRepository tradeSourceRepository;
    private final TradeService tradeService;
    private final ObjectMapper objectMapper;

    @Override
    public void run(ApplicationArguments args) throws Exception {
        if (tradeOwnerRepository.count() > 0) {
            log.info("Database already seeded. Skipping.");
            return;
        }

        log.info("Database is empty. Seeding data...");

        try (InputStream inputStream = new ClassPathResource("seed-data.json").getInputStream()) {
            List<Map<String, Object>> seedData = objectMapper.readValue(inputStream, new TypeReference<>() {});

            seedData.sort(Comparator.comparing(data -> LocalDate.parse((String) data.get("trade_date"), DateTimeFormatter.ofPattern("MM/dd/yyyy"))));

            for (Map<String, Object> data : seedData) {
                String ownerName = (String) data.get("owner");
                String sourceName = (String) data.get("source");

                TradeOwner owner = tradeOwnerRepository.findByName(ownerName)
                    .orElseGet(() -> tradeOwnerRepository.save(new TradeOwner() {{ setName(ownerName); }}));

                TradeSource source = tradeSourceRepository.findByName(sourceName)
                    .orElseGet(() -> tradeSourceRepository.save(new TradeSource() {{ setName(sourceName); }}));

                if (!source.getOwners().contains(owner)) {
                    source.getOwners().add(owner);
                    tradeSourceRepository.save(source);
                }

                TradeDto tradeDto = new TradeDto();
                tradeDto.setTicker((String) data.get("ticker"));
                tradeDto.setTransactionType(Trade.TransactionType.valueOf((String) data.get("transaction_type")));
                tradeDto.setQuantity(new BigDecimal(data.get("quantity").toString()));
                tradeDto.setPricePerUnit(new BigDecimal(data.get("price_per_unit").toString()));
                tradeDto.setTradeDate(LocalDate.parse((String) data.get("trade_date"), DateTimeFormatter.ofPattern("MM/dd/yyyy")));
                tradeDto.setTradeOwnerId(owner.getId());
                tradeDto.setTradeSourceId(source.getId());

                tradeService.createTrade(tradeDto);
            }

            log.info("Data seeding completed successfully.");
        } catch (Exception e) {
            log.error("Failed to seed database", e);
        }
    }
}
