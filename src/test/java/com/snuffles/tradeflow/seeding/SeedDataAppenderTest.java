package com.snuffles.tradeflow.seeding;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.snuffles.tradeflow.domain.Trade;
import com.snuffles.tradeflow.domain.TradeOwner;
import com.snuffles.tradeflow.domain.TradeSource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class SeedDataAppenderTest {

    @TempDir
    Path tempDir;

    private ObjectMapper objectMapper;
    private Path seedFile;
    private SeedDataAppender seedDataAppender;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        seedFile = tempDir.resolve("seed-data.json");
        seedDataAppender = new SeedDataAppender(objectMapper, seedFile.toString());
    }

    @Test
    void appendTradeToNonExistentFileCreatesIt() throws IOException {
        Trade trade = createSampleTrade();

        assertThat(Files.exists(seedFile)).isFalse();

        seedDataAppender.appendTrade(trade);

        assertThat(Files.exists(seedFile)).isTrue();
        List<ObjectNode> records = readRecords();
        assertThat(records).hasSize(1);
        ObjectNode record = records.get(0);
        assertThat(record.get("ticker").asText()).isEqualTo("TEST");
        assertThat(record.get("trade_date").asText()).isEqualTo("01/15/2024");
        assertThat(record.get("quantity").decimalValue()).isEqualByComparingTo("100");
        assertThat(record.get("owner").asText()).isEqualTo("TestOwner");
        assertThat(record.get("source").asText()).isEqualTo("TestSource");
    }

    @Test
    void appendTradeToExistingFileAppendsNewRecord() throws IOException {
        Trade initial = createSampleTrade();
        seedDataAppender.appendTrade(initial);

        Trade second = createSampleTrade();
        second.setTicker("NEW");
        seedDataAppender.appendTrade(second);

        List<ObjectNode> records = readRecords();
        assertThat(records).hasSize(2);
        assertThat(records.get(1).get("ticker").asText()).isEqualTo("NEW");
    }

    @Test
    void appendDuplicateTradeDoesNotDuplicateRecord() throws IOException {
        Trade trade = createSampleTrade();
        seedDataAppender.appendTrade(trade);

        seedDataAppender.appendTrade(createSampleTrade());

        List<ObjectNode> records = readRecords();
        assertThat(records).hasSize(1);
    }

    @Test
    void appendNullTradeDoesNothing() throws IOException {
        seedDataAppender.appendTrade(null);

        assertThat(Files.exists(seedFile)).isFalse();
    }

    private Trade createSampleTrade() {
        Trade trade = new Trade();
        trade.setTradeDate(Instant.parse("2024-01-15T10:00:00Z"));
        trade.setTicker("TEST");
        trade.setTransactionType(Trade.TransactionType.Buy);
        trade.setQuantity(new BigDecimal("100"));
        trade.setPricePerUnit(new BigDecimal("12.50"));

        TradeOwner owner = new TradeOwner();
        owner.setName("TestOwner");
        trade.setOwner(owner);

        TradeSource source = new TradeSource();
        source.setName("TestSource");
        trade.setSource(source);

        return trade;
    }

    private List<ObjectNode> readRecords() throws IOException {
        return objectMapper.readValue(seedFile.toFile(), new TypeReference<List<ObjectNode>>() {});
    }
}
