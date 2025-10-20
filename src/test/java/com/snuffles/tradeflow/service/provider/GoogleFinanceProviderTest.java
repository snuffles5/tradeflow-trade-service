package com.snuffles.tradeflow.service.provider;

import com.snuffles.tradeflow.service.provider.MarketDataProvider.ProviderQuote;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;

import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

@ExtendWith(MockitoExtension.class)
class GoogleFinanceProviderTest {

    private final GoogleFinanceProvider provider = new GoogleFinanceProvider();

    static class StubGoogleFinanceProvider extends GoogleFinanceProvider {
        private final List<String> marketsTried = new ArrayList<>();
        private final String successMarket;

        StubGoogleFinanceProvider(String successMarket) {
            this.successMarket = successMarket;
        }

        @Override
        protected Optional<ProviderQuote> fetchFromMarket(String ticker, String market) {
            marketsTried.add(market);
            if (market.equals(successMarket)) {
                return Optional.of(ProviderQuote.builder()
                    .ticker(ticker)
                    .lastPrice(new BigDecimal("100.00"))
                    .changeToday(BigDecimal.ZERO)
                    .changeTodayPercentage(BigDecimal.ZERO)
                    .marketIdentifier(market)
                    .providerName("GoogleFinance")
                    .build());
            }
            return Optional.empty();
        }

        List<String> getMarketsTried() {
            return marketsTried;
        }
    }

    @Test
    void getQuote_withNullTicker_returnsEmpty() {
        Optional<ProviderQuote> result = provider.getQuote(null, Optional.empty());
        assertTrue(result.isEmpty());
    }

    @Test
    void getQuote_withBlankTicker_returnsEmpty() {
        Optional<ProviderQuote> result = provider.getQuote("", Optional.empty());
        assertTrue(result.isEmpty());
    }

    @Test
    void getQuote_withWhitespaceTicker_returnsEmpty() {
        Optional<ProviderQuote> result = provider.getQuote("   ", Optional.empty());
        assertTrue(result.isEmpty());
    }

    @Test
    void parseQuoteFromDocument_withValidHtml_returnsQuote() {
        String html = "<html><body><div class='YMlKec fxKbKc'>150.25</div><div class='P6K39c'>+2.50 (+1.69%)</div></body></html>";
        Document doc = Jsoup.parse(html);
        Optional<ProviderQuote> result = provider.parseQuoteFromDocument(doc, "AAPL", "NASDAQ");
        assertTrue(result.isPresent());
        ProviderQuote quote = result.get();
        assertEquals("AAPL", quote.getTicker());
        assertEquals(new BigDecimal("150.25"), quote.getLastPrice());
        assertEquals(new BigDecimal("2.50"), quote.getChangeToday());
        assertEquals(new BigDecimal("1.69"), quote.getChangeTodayPercentage());
        assertEquals("NASDAQ", quote.getMarketIdentifier());
        assertEquals("GoogleFinance", quote.getProviderName());
    }

    @Test
    void parseQuoteFromDocument_withMissingPrice_returnsEmpty() {
        String html = "<html><body></body></html>";
        Document doc = Jsoup.parse(html);
        Optional<ProviderQuote> result = provider.parseQuoteFromDocument(doc, "AAPL", "NASDAQ");
        assertTrue(result.isEmpty());
    }

    @Test
    void parseQuoteFromDocument_withNoChangeElement_returnsQuoteWithZeroChange() {
        String html = "<html><body><div class='YMlKec fxKbKc'>150.25</div></body></html>";
        Document doc = Jsoup.parse(html);
        Optional<ProviderQuote> result = provider.parseQuoteFromDocument(doc, "AAPL", "NASDAQ");
        assertTrue(result.isPresent());
        ProviderQuote quote = result.get();
        assertEquals(new BigDecimal("150.25"), quote.getLastPrice());
        assertEquals(BigDecimal.ZERO, quote.getChangeToday());
        assertEquals(BigDecimal.ZERO, quote.getChangeTodayPercentage());
    }

    @Test
    void getQuote_triesConfiguredMarketsUntilSuccess() {
        StubGoogleFinanceProvider stub = new StubGoogleFinanceProvider("NASDAQ");
        ReflectionTestUtils.setField(stub, "configuredMarkets", "NYSEARCA,NASDAQ");

        Optional<ProviderQuote> result = stub.getQuote("SPY", Optional.empty());

        assertTrue(result.isPresent());
        assertEquals("NASDAQ", result.get().getMarketIdentifier());
        assertEquals(List.of("NYSEARCA", "NASDAQ"), stub.getMarketsTried());
    }

    @Test
    void resolveMarkets_mergesHintsWithConfiguredOrder() {
        GoogleFinanceProvider provider = new GoogleFinanceProvider();
        ReflectionTestUtils.setField(provider, "configuredMarkets", "NASDAQ,NYSE");

        List<String> markets = provider.resolveMarkets(Optional.of("nysearca NASDAQ"));

        assertEquals(List.of("NYSEARCA", "NASDAQ", "NYSE"), markets);
    }
}
