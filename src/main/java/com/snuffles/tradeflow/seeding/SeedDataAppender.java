package com.snuffles.tradeflow.seeding;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.snuffles.tradeflow.domain.Trade;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.Reader;
import java.io.Writer;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.locks.ReentrantLock;

@Component
@Slf4j
public class SeedDataAppender {

    private static final DateTimeFormatter SEED_DATE_FORMATTER =
        DateTimeFormatter.ofPattern("MM/dd/yyyy", Locale.US);

    private final ObjectMapper objectMapper;
    private final Path seedDataPath;
    private final ReentrantLock lock = new ReentrantLock();

    public SeedDataAppender(
        ObjectMapper objectMapper,
        @Value("${tradeflow.seed-data-path:src/main/resources/seed-data.json}") String seedDataPath
    ) {
        this.objectMapper = objectMapper;
        this.seedDataPath = Path.of(seedDataPath);
    }

    public void appendTrade(Trade trade) {
        if (trade == null) {
            return;
        }
        lock.lock();
        try {
            List<ObjectNode> trades = readExistingTrades();
            ObjectNode candidate = convertTrade(trade);
            if (!contains(trades, candidate)) {
                trades.add(candidate);
                writeTrades(trades);
            }
        } catch (IOException ex) {
            log.error("Failed to append trade {} to seed data", trade.getId(), ex);
        } finally {
            lock.unlock();
        }
    }

    private List<ObjectNode> readExistingTrades() throws IOException {
        if (Files.exists(seedDataPath)) {
            try (Reader reader = Files.newBufferedReader(seedDataPath)) {
                return objectMapper.readValue(reader, new TypeReference<List<ObjectNode>>() {});
            }
        }
        ensureParentDirectory();
        return new ArrayList<>();
    }

    private void writeTrades(List<ObjectNode> trades) throws IOException {
        ensureParentDirectory();
        try (Writer writer = Files.newBufferedWriter(seedDataPath)) {
            objectMapper.writerWithDefaultPrettyPrinter().writeValue(writer, trades);
        }
    }

    private void ensureParentDirectory() throws IOException {
        Path parent = seedDataPath.getParent();
        if (parent != null && !Files.exists(parent)) {
            Files.createDirectories(parent);
        }
    }

    private ObjectNode convertTrade(Trade trade) {
        ObjectNode node = objectMapper.createObjectNode();
        putText(node, "trade_date", formatTradeDate(trade.getTradeDate()));
        putText(node, "ticker", trade.getTicker());
        putText(node, "transaction_type", trade.getTransactionType() != null ? trade.getTransactionType().name() : null);
        putBigDecimal(node, "quantity", trade.getQuantity());
        putBigDecimal(node, "price_per_unit", trade.getPricePerUnit());
        putText(node, "owner", trade.getOwner() != null ? trade.getOwner().getName() : null);
        putText(node, "source", trade.getSource() != null ? trade.getSource().getName() : null);
        return node;
    }

    private boolean contains(List<ObjectNode> trades, ObjectNode candidate) {
        for (ObjectNode existing : trades) {
            if (nodesEqual(existing, candidate)) {
                return true;
            }
        }
        return false;
    }

    private boolean nodesEqual(ObjectNode a, ObjectNode b) {
        return equalsText(a, b, "trade_date")
            && equalsText(a, b, "ticker")
            && equalsText(a, b, "transaction_type")
            && equalsDecimal(a, b, "quantity")
            && equalsDecimal(a, b, "price_per_unit")
            && equalsText(a, b, "owner")
            && equalsText(a, b, "source");
    }

    private boolean equalsText(ObjectNode a, ObjectNode b, String field) {
        String left = a.hasNonNull(field) ? a.get(field).asText() : null;
        String right = b.hasNonNull(field) ? b.get(field).asText() : null;
        return left == null ? right == null : left.equals(right);
    }

    private boolean equalsDecimal(ObjectNode a, ObjectNode b, String field) {
        BigDecimal left = a.hasNonNull(field) ? a.get(field).decimalValue() : null;
        BigDecimal right = b.hasNonNull(field) ? b.get(field).decimalValue() : null;
        return left == null ? right == null : left.compareTo(right) == 0;
    }

    private String formatTradeDate(Instant instant) {
        if (instant == null) {
            return null;
        }
        LocalDate localDate = instant.atZone(ZoneOffset.UTC).toLocalDate();
        return SEED_DATE_FORMATTER.format(localDate);
    }

    private void putBigDecimal(ObjectNode node, String field, BigDecimal value) {
        if (value != null) {
            node.put(field, value);
        } else {
            node.putNull(field);
        }
    }

    private void putText(ObjectNode node, String field, String value) {
        if (value != null) {
            node.put(field, value);
        } else {
            node.putNull(field);
        }
    }
}
