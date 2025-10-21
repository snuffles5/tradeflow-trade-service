package com.snuffles.tradeflow.service.provider;

import com.snuffles.tradeflow.service.provider.MarketDataProvider.ProviderQuote;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

class CompositeMarketDataProviderTest {

    static class StubProvider implements MarketDataProvider {
        private final Optional<ProviderQuote> result;
        private final RuntimeException toThrow;

        StubProvider(Optional<ProviderQuote> result) {
            this.result = result;
            this.toThrow = null;
        }

        StubProvider(RuntimeException toThrow) {
            this.result = Optional.empty();
            this.toThrow = toThrow;
        }

        @Override
        public Optional<ProviderQuote> getQuote(String ticker, Optional<String> marketHint) {
            if (toThrow != null) throw toThrow;
            return result;
        }
    }

    private ProviderQuote quote(String ticker, String market, String provider, String lastPrice, String change, String pct) {
        return ProviderQuote.builder()
            .ticker(ticker)
            .marketIdentifier(market)
            .providerName(provider)
            .lastPrice(new BigDecimal(lastPrice))
            .changeToday(new BigDecimal(change))
            .changeTodayPercentage(new BigDecimal(pct))
            .build();
    }

    @Test
    void getQuote_nullOrBlankTicker_returnsEmpty() {
        CompositeMarketDataProvider cmp = new CompositeMarketDataProvider(new StubProvider(Optional.empty()), new StubProvider(Optional.empty()));
        assertTrue(cmp.getQuote(null, Optional.empty()).isEmpty());
        assertTrue(cmp.getQuote("", Optional.empty()).isEmpty());
        assertTrue(cmp.getQuote("   ", Optional.empty()).isEmpty());
    }

    @Test
    void getQuote_googleSuccess_returnsGoogle() {
        ProviderQuote g = quote("AAPL", "NASDAQ", "GoogleFinance", "100", "1", "1");
        CompositeMarketDataProvider cmp = new CompositeMarketDataProvider(new StubProvider(Optional.of(g)), new StubProvider(Optional.empty()));
        Optional<ProviderQuote> res = cmp.getQuote("AAPL", Optional.of("NASDAQ"));
        assertTrue(res.isPresent());
        assertEquals("GoogleFinance", res.get().getProviderName());
    }

    @Test
    void getQuote_googleFails_yahooSuccess_returnsYahoo() {
        ProviderQuote y = quote("MSFT", "NASDAQ", "YahooFinance", "200", "2", "1");
        CompositeMarketDataProvider cmp = new CompositeMarketDataProvider(new StubProvider(new RuntimeException("boom")), new StubProvider(Optional.of(y)));
        Optional<ProviderQuote> res = cmp.getQuote("MSFT", Optional.of("NASDAQ"));
        assertTrue(res.isPresent());
        assertEquals("YahooFinance", res.get().getProviderName());
    }

    @Test
    void getQuote_bothEmpty_returnsEmpty() {
        CompositeMarketDataProvider cmp = new CompositeMarketDataProvider(new StubProvider(Optional.empty()), new StubProvider(Optional.empty()));
        Optional<ProviderQuote> res = cmp.getQuote("TSLA", Optional.empty());
        assertTrue(res.isEmpty());
    }

    @Test
    void getQuote_yahooThrows_returnsEmpty() {
        CompositeMarketDataProvider cmp = new CompositeMarketDataProvider(new StubProvider(Optional.empty()), new StubProvider(new RuntimeException("down")));
        Optional<ProviderQuote> res = cmp.getQuote("FAIL", Optional.empty());
        assertTrue(res.isEmpty());
    }
}
