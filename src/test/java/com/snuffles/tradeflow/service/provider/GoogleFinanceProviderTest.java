package com.snuffles.tradeflow.service.provider;

import com.snuffles.tradeflow.service.provider.MarketDataProvider.ProviderQuote;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;

import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.math.RoundingMode;
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
    void parseQuoteFromDocument_withPreviousCloseAltStructure_yNNSlb_isParsed() {
        String html = "<html><body>" +
            "<div class='YMlKec fxKbKc'>250.00</div>" +
            "<div class='gyFHrc'>" +
            "  <div class='mfs7Fc'>Previous close</div>" +
            "  <div class='yNNSlb'>$249.50</div>" +
            "</div>" +
            "</body></html>";
        Document doc = Jsoup.parse(html);
        Optional<ProviderQuote> result = provider.parseQuoteFromDocument(doc, "ALT", "NASDAQ");
        assertTrue(result.isPresent());
        ProviderQuote quote = result.get();
        assertEquals(new BigDecimal("250.00"), quote.getLastPrice());
        assertEquals(new BigDecimal("0.50000000"), quote.getChangeToday().setScale(8));
        assertEquals(new BigDecimal("0.20040080"), quote.getChangeTodayPercentage().setScale(8));
    }

    @Test
    void parseQuoteFromDocument_withNoChangeAndNoPreviousClose_defaultsToZeroChange() {
        String html = "<html><body>" +
            "<div class='YMlKec fxKbKc'>123.45</div>" +
            "</body></html>";
        Document doc = Jsoup.parse(html);
        Optional<ProviderQuote> result = provider.parseQuoteFromDocument(doc, "ZERO", "NASDAQ");
        assertTrue(result.isPresent());
        ProviderQuote quote = result.get();
        assertEquals(new BigDecimal("123.45"), quote.getLastPrice());
        assertEquals(BigDecimal.ZERO, quote.getChangeToday());
        assertEquals(BigDecimal.ZERO, quote.getChangeTodayPercentage());
    }

    @Test
    void parseQuoteFromDocument_withPreviousCloseOnly_derivesValues() {
        String html = "<html><body>" +
            "<div class='YMlKec fxKbKc'>101.00</div>" +
            "<div class='gyFHrc'>" +
            "  <div class='mfs7Fc'>Previous close</div>" +
            "  <div class='P6K39c'>100.00</div>" +
            "</div>" +
            "</body></html>";
        Document doc = Jsoup.parse(html);
        Optional<ProviderQuote> result = provider.parseQuoteFromDocument(doc, "TEST", "NASDAQ");
        assertTrue(result.isPresent());
        ProviderQuote quote = result.get();
        assertEquals(new BigDecimal("101.00"), quote.getLastPrice());
        assertEquals(new BigDecimal("1.00000000"), quote.getChangeToday().setScale(8));
        assertEquals(new BigDecimal("1.00000000"), quote.getChangeTodayPercentage().setScale(8));
    }

    @Test
    void resolveMarkets_defaultsToNasdaqWhenNoConfigOrHint() {
        GoogleFinanceProvider p = new GoogleFinanceProvider();
        ReflectionTestUtils.setField(p, "configuredMarkets", " ");
        assertEquals(List.of("NASDAQ"), p.resolveMarkets(Optional.empty()));
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
        String html = "<html><body>" +
            "<div class='YMlKec fxKbKc'>150.25</div>" +
            "<span jsname='qRSVye'>+2.50</span>" +
            "<span jsname='rfaVEf'>(+1.69%)</span>" +
            "</body></html>";
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
    void parseQuoteFromDocument_withPercentOnly_derivesChangeAmount() {
        String html = "<html><body>" +
            "<div class='YMlKec fxKbKc'>200.00</div>" +
            "<span jsname='rfaVEf'>-1.50%</span>" +
            "</body></html>";
        Document doc = Jsoup.parse(html);
        Optional<ProviderQuote> result = provider.parseQuoteFromDocument(doc, "MSFT", "NASDAQ");
        assertTrue(result.isPresent());
        ProviderQuote quote = result.get();
        assertEquals(new BigDecimal("200.00"), quote.getLastPrice());
        // -1.50% of 200 = -3.00
        assertEquals(new BigDecimal("-3.00000000"), quote.getChangeToday().setScale(8));
        assertEquals(new BigDecimal("-1.50"), quote.getChangeTodayPercentage().setScale(2));
    }

    @Test
    void parseQuoteFromDocument_withAmountOnly_derivesPercent() {
        String html = "<html><body>" +
            "<div class='YMlKec fxKbKc'>50.00</div>" +
            "<span jsname='qRSVye'>+2.00</span>" +
            "</body></html>";
        Document doc = Jsoup.parse(html);
        Optional<ProviderQuote> result = provider.parseQuoteFromDocument(doc, "TSLA", "NASDAQ");
        assertTrue(result.isPresent());
        ProviderQuote quote = result.get();
        assertEquals(new BigDecimal("50.00"), quote.getLastPrice());
        assertEquals(new BigDecimal("2.00"), quote.getChangeToday());
        // 2 / 50 * 100 = 4%
        assertEquals(new BigDecimal("4.00000000"), quote.getChangeTodayPercentage().setScale(8));
    }

    @Test
    void parseQuoteFromDocument_withUnicodeMinus_isParsedAsNegative() {
        // Using Unicode minus (U+2212) in change value
        String html = "<html><body>" +
            "<div class='YMlKec fxKbKc'>120.00</div>" +
            "<span jsname='qRSVye'>\u22122.50</span>" +
            "<span jsname='rfaVEf'>(\u22122.08%)</span>" +
            "</body></html>";
        Document doc = Jsoup.parse(html);
        Optional<ProviderQuote> result = provider.parseQuoteFromDocument(doc, "NVDA", "NASDAQ");
        assertTrue(result.isPresent());
        ProviderQuote quote = result.get();
        assertEquals(new BigDecimal("120.00"), quote.getLastPrice());
        assertEquals(new BigDecimal("-2.50"), quote.getChangeToday());
        assertEquals(new BigDecimal("-2.08"), quote.getChangeTodayPercentage().setScale(2));
    }

    @Test
    void parseQuoteFromDocument_doesNotConfuseChangeWithLastPrice() {
        // Guard against bugs where change equals the last price or market value
        String html = "<html><body>" +
            "<div class='YMlKec fxKbKc'>300.00</div>" +
            "<span jsname='qRSVye'>+3.00</span>" +
            "<span jsname='rfaVEf'>(+1.00%)</span>" +
            "</body></html>";
        Document doc = Jsoup.parse(html);
        Optional<ProviderQuote> result = provider.parseQuoteFromDocument(doc, "AMZN", "NASDAQ");
        assertTrue(result.isPresent());
        ProviderQuote quote = result.get();
        assertEquals(new BigDecimal("300.00"), quote.getLastPrice());
        assertEquals(new BigDecimal("3.00"), quote.getChangeToday());
        assertNotEquals(quote.getLastPrice(), quote.getChangeToday());
    }

    @Test
    void parseQuoteFromDocument_withPreviousClose_derivesAndOverridesSpans() {
        // Price 672.14, Previous close 671.40 => change 0.74, pct ~ 0.1102%
        // Provide misleading spans to ensure previous close derivation overrides them
        String html = "<html><body>" +
            "<div class='YMlKec fxKbKc'>672.14</div>" +
            "<span jsname='qRSVye'>+237.50</span>" +
            "<span jsname='rfaVEf'>+4.75%</span>" +
            "<div class='gyFHrc'>" +
            "  <div class='mfs7Fc'>Previous close</div>" +
            "  <div class='P6K39c'>671.40</div>" +
            "</div>" +
            "</body></html>";
        Document doc = Jsoup.parse(html);
        Optional<ProviderQuote> result = provider.parseQuoteFromDocument(doc, "SPY", "NYSEARCA");
        assertTrue(result.isPresent());
        ProviderQuote quote = result.get();
        assertEquals(new BigDecimal("672.14"), quote.getLastPrice());
        assertEquals(new BigDecimal("0.74000000"), quote.getChangeToday().setScale(8));
        assertEquals(new BigDecimal("0.1102"), quote.getChangeTodayPercentage().setScale(4, RoundingMode.HALF_UP));
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

    @Test
    void getQuote_allMarketsReturnEmpty_returnsEmpty() {
        GoogleFinanceProvider stub = new GoogleFinanceProvider() {
            @Override
            protected Optional<ProviderQuote> fetchFromMarket(String ticker, String market) {
                return Optional.empty();
            }
        };
        ReflectionTestUtils.setField(stub, "configuredMarkets", "NYSEARCA,NASDAQ");
        Optional<ProviderQuote> result = stub.getQuote("EMPTY", Optional.empty());
        assertTrue(result.isEmpty());
    }
}
