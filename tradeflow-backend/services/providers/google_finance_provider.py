import time

import requests
from bs4 import BeautifulSoup

from services.providers.base_finance_provider import BaseFinanceProvider
from utils.logger import log
from services.providers.retry_decorator import retry


class GoogleFinanceProvider(BaseFinanceProvider):
    """
    A price provider that fetches stock prices from Google Finance.
    """

    def __init__(self, cache_duration=300):
        """
        :param cache_duration: Number of seconds to cache the price for a given ticker.
        """
        self.cache_duration = cache_duration
        self.cache = {}
        log.debug(f"GooglePriceProvider initialized with cache_duration={cache_duration}")

    @retry(exceptions=(requests.RequestException,), max_attempts=5, delay=3, backoff=2)
    def fetch_from_provider(self, ticker: str) -> float:
        """
        Scrapes Google Finance search results to get the latest stock price.
        """
        url = f"https://www.google.com/finance/quote/{ticker}:NASDAQ"
        log.trace(f"Fetching price from Google for '{ticker}'. Request URL: {url}")

        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) "
                          "Chrome/91.0.4472.124 Safari/537.36"
        }
        response = requests.get(url, headers=headers, timeout=5)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, "lxml")

        # Find the stock price element
        price_element = soup.find("div", class_="YMlKec fxKbKc")
        if not price_element:
            raise ValueError(f"Could not find stock price for {ticker}")

        price = float(price_element.text.replace("$", "").replace(",", ""))
        log.info(f"Got price {price} for '{ticker}' from Google Finance.")
        return price

    def get_price(self, ticker: str) -> float:
        """
        Retrieves the price for a given ticker, using caching.
        """
        current_time = time.time()
        if ticker in self.cache:
            cached_price, cached_time = self.cache[ticker]
            if current_time - cached_time < self.cache_duration:
                log.debug(f"Cache hit for '{ticker}', returning cached price: {cached_price}")
                return cached_price

        log.debug(f"Cache miss for '{ticker}', fetching new price...")
        fresh_price = self.fetch_from_provider(ticker)
        self.cache[ticker] = (fresh_price, current_time)
        return fresh_price
