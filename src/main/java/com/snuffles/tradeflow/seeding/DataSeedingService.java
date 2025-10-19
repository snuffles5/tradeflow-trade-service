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
import org.springframework.transaction.annotation.Transactional;

import java.io.InputStream;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.time.ZoneOffset;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Objects;

@Slf4j
@Service
@RequiredArgsConstructor
public class DataSeedingService implements ApplicationRunner {

    private static final DateTimeFormatter SEED_DATE_FORMATTER =
        DateTimeFormatter.ofPattern("MM/dd/yyyy", Locale.US);

    private final TradeOwnerRepository tradeOwnerRepository;
    private final TradeSourceRepository tradeSourceRepository;
    private final TradeService tradeService;
    private final ObjectMapper objectMapper;

    @Override
    @Transactional
    public void run(ApplicationArguments args) throws Exception {
        if (tradeOwnerRepository.count() > 0) {
            log.info("Database already seeded. Skipping.");
            return;
        }

        log.info("Database is empty. Seeding data...");

        try (InputStream inputStream = new ClassPathResource("seed-data.json").getInputStream()) {
            List<SeedTradeRecord> seedData = objectMapper.readValue(
                inputStream,
                new TypeReference<List<SeedTradeRecord>>() {}
            );

            seedData.stream()
                .filter(Objects::nonNull)
                .filter(this::isValidRecord)
                .sorted(Comparator.comparing(this::parseTradeInstant))
                .forEach(this::persistRecord);

            log.info("Data seeding completed successfully.");
        } catch (Exception e) {
            log.error("Failed to seed database", e);
        }
    }

    private boolean isValidRecord(SeedTradeRecord record) {
        if (record.tradeDate() == null || record.tradeDate().isBlank()) {
            log.warn("Skipping seed row without trade_date: {}", record);
            return false;
        }

        try {
            parseTradeInstant(record);
        } catch (DateTimeParseException ex) {
            log.warn("Skipping seed row with invalid date '{}': {}", record.tradeDate(), record);
            return false;
        }

        if (record.ticker() == null || record.ticker().isBlank()) {
            log.warn("Skipping seed row without ticker: {}", record);
            return false;
        }

        if (record.transactionType() == null || record.transactionType().isBlank()) {
            log.warn("Skipping seed row without transaction_type: {}", record);
            return false;
        }

        try {
            Trade.TransactionType.valueOf(record.transactionType());
        } catch (IllegalArgumentException ex) {
            log.warn("Skipping seed row with invalid transaction_type '{}': {}", record.transactionType(), record);
            return false;
        }

        if (record.quantity() == null || record.quantity().compareTo(BigDecimal.ZERO) <= 0) {
            log.warn("Skipping seed row with invalid quantity: {}", record);
            return false;
        }

        if (record.pricePerUnit() == null || record.pricePerUnit().compareTo(BigDecimal.ZERO) <= 0) {
            log.warn("Skipping seed row with invalid price_per_unit: {}", record);
            return false;
        }

        if (record.owner() == null || record.owner().isBlank()) {
            log.warn("Skipping seed row without owner: {}", record);
            return false;
        }

        if (record.source() == null || record.source().isBlank()) {
            log.warn("Skipping seed row without source: {}", record);
            return false;
        }

        return true;
    }

    private Instant parseTradeInstant(SeedTradeRecord record) {
        LocalDate localDate = LocalDate.parse(record.tradeDate(), SEED_DATE_FORMATTER);
        return localDate.atStartOfDay(ZoneOffset.UTC).toInstant();
    }

    private void persistRecord(SeedTradeRecord record) {
        Instant tradeDate = parseTradeInstant(record);

        TradeOwner owner = tradeOwnerRepository.findByName(record.owner())
            .orElseGet(() -> {
                TradeOwner newOwner = new TradeOwner();
                newOwner.setName(record.owner());
                return tradeOwnerRepository.save(newOwner);
            });

        TradeSource source = tradeSourceRepository.findByName(record.source())
            .orElseGet(() -> {
                TradeSource newSource = new TradeSource();
                newSource.setName(record.source());
                return tradeSourceRepository.save(newSource);
            });

        if (!source.getOwners().contains(owner)) {
            source.getOwners().add(owner);
            tradeSourceRepository.save(source);
        }

        TradeDto tradeDto = new TradeDto();
        tradeDto.setTicker(record.ticker());
        tradeDto.setTransactionType(Trade.TransactionType.valueOf(record.transactionType()));
        tradeDto.setQuantity(record.quantity());
        tradeDto.setPricePerUnit(record.pricePerUnit());
        tradeDto.setTradeDate(tradeDate);
        tradeDto.setTradeOwnerId(owner.getId());
        tradeDto.setTradeSourceId(source.getId());

        tradeService.createTrade(tradeDto);
    }
}
