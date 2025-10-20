package com.snuffles.tradeflow.service.provider;

import com.snuffles.tradeflow.service.provider.MarketDataProvider;
import com.snuffles.tradeflow.service.provider.MarketDataProvider.ProviderQuote;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.io.IOException;
import java.math.BigDecimal;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class YahooMarketDataProviderTest {

    @Mock
    private HttpClient httpClient;

    @Mock
    private HttpResponse<String> httpResponse;

    @InjectMocks
    private YahooMarketDataProvider provider;

    private ObjectMapper objectMapper = new ObjectMapper();

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(provider, "baseUrl", "https://query1.finance.yahoo.com");
        ReflectionTestUtils.setField(provider, "appId", "");
        ReflectionTestUtils.setField(provider, "clientId", "");
        ReflectionTestUtils.setField(provider, "clientSecret", "");
        ReflectionTestUtils.setField(provider, "redirectUri", "");
        provider.setHttpClient(httpClient);
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
    void getQuote_withValidTicker_success() throws Exception {
        String jsonResponse = """
            {
                "quoteResponse": {
                    "result": [
                        {
                            "regularMarketPrice": "150.25",
                            "regularMarketChange": "2.50",
                            "regularMarketChangePercent": "1.69",
                            "fullExchangeName": "Nasdaq",
                            "exchange": "NMS"
                        }
                    ]
                }
            }
            """;
        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn(jsonResponse);
        doReturn(httpResponse).when(httpClient).send(any(HttpRequest.class), any());

        Optional<ProviderQuote> result = provider.getQuote("AAPL", Optional.empty());

        assertTrue(result.isPresent());
        ProviderQuote quote = result.get();
        assertEquals("AAPL", quote.getTicker());
        assertEquals(new BigDecimal("150.25"), quote.getLastPrice());
        assertEquals(new BigDecimal("2.50"), quote.getChangeToday());
        assertEquals(new BigDecimal("1.69"), quote.getChangeTodayPercentage());
        assertEquals("Nasdaq", quote.getMarketIdentifier());
        assertEquals("YahooFinance", quote.getProviderName());
    }

    @Test
    void getQuote_withHttpError_returnsEmpty() throws Exception {
        when(httpResponse.statusCode()).thenReturn(404);
        doReturn(httpResponse).when(httpClient).send(any(HttpRequest.class), any());

        Optional<ProviderQuote> result = provider.getQuote("INVALID", Optional.empty());

        assertTrue(result.isEmpty());
    }

    @Test
    void getQuote_withEmptyResult_returnsEmpty() throws Exception {
        String jsonResponse = """
            {
                "quoteResponse": {
                    "result": []
                }
            }
            """;
        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn(jsonResponse);
        doReturn(httpResponse).when(httpClient).send(any(HttpRequest.class), any());

        Optional<ProviderQuote> result = provider.getQuote("UNKNOWN", Optional.empty());

        assertTrue(result.isEmpty());
    }

    @Test
    void getQuote_withMissingPrice_returnsEmpty() throws Exception {
        String jsonResponse = """
            {
                "quoteResponse": {
                    "result": [
                        {
                            "regularMarketChange": "2.50"
                        }
                    ]
                }
            }
            """;
        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn(jsonResponse);
        doReturn(httpResponse).when(httpClient).send(any(HttpRequest.class), any());

        Optional<ProviderQuote> result = provider.getQuote("NOPRICE", Optional.empty());

        assertTrue(result.isEmpty());
    }

    @Test
    void getQuote_withIOException_returnsEmpty() throws Exception {
        when(httpClient.send(any(HttpRequest.class), any())).thenThrow(new IOException("Network error"));

        Optional<ProviderQuote> result = provider.getQuote("AAPL", Optional.empty());

        assertTrue(result.isEmpty());
    }
}
