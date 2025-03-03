import time
import requests
from bs4 import BeautifulSoup

from exceptions import StockNotFoundException
from services.providers.base_finance_provider import BaseFinanceProvider
from utils.consts import EXCHANGES  # List of known exchanges
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

    @retry(exceptions=(requests.RequestException,), max_attempts=2, delay=3, backoff=2)
    def fetch_from_provider(self, ticker: str, exchange: str) -> float:
        """
        Scrapes Google Finance search results to get the latest stock price.
        """
        url = f"https://www.google.com/finance/quote/{ticker}:{exchange}"
        log.trace(f"Fetching price from Google for '{ticker}' on exchange '{exchange}'. Request URL: {url}")

        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) "
                          "Chrome/91.0.4472.124 Safari/537.36"
        }
        response = requests.get(url, headers=headers, timeout=5)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, "html.parser")

        # Try to locate the stock price element
        price_element = soup.find("div", class_="YMlKec fxKbKc")

        if not price_element:
            log.warning(f"Could not find stock price for {ticker} on {exchange}, trying next exchange...")
            return None  # Move to the next exchange

        # Clean up the price string
        price_text = price_element.text.strip()
        try:
            price = float(price_text.replace("$", "").replace(",", ""))
        except ValueError:
            log.warning(f"Invalid price format extracted: {price_text} from {exchange}")
            return None  # Move to the next exchange

        log.info(f"Got price {price} for '{ticker}' from {exchange}.")
        return price

    def get_price(self, ticker: str) -> float:
        """
        Retrieves the price for a given ticker, trying all known exchanges.
        """
        current_time = time.time()
        if ticker in self.cache:
            cached_price, cached_time = self.cache[ticker]
            if current_time - cached_time < self.cache_duration:
                log.debug(f"Cache hit for '{ticker}', returning cached price: {cached_price}")
                return cached_price

        log.debug(f"Cache miss for '{ticker}', attempting exchanges...")

        for exchange in EXCHANGES:
            price = self.fetch_from_provider(ticker, exchange)
            if price is not None:  # If a valid price is found, cache and return it
                self.cache[ticker] = (price, current_time)
                return price

        log.error(f"Failed to get stock price for '{ticker}' after checking all exchanges.")
        raise StockNotFoundException(f"Could not retrieve stock price for '{ticker}' from any exchange.")
