import time
from datetime import datetime
from typing import Optional

import requests
from app.models import Stock
from bs4 import BeautifulSoup
from exceptions import StockNotFoundException
from services.providers.base_finance_provider import BaseFinanceProvider
from services.providers.base_finance_provider import ChangeToday
from services.providers.retry_decorator import retry
from utils.consts import EXCHANGES  # List of known exchanges
from utils.logger import log


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
        log.debug(
            f"GooglePriceProvider initialized with cache_duration={cache_duration}"
        )

    def _parse_price(self, soup: BeautifulSoup) -> float:
        """
        Private helper that parses the stock price from the BeautifulSoup object.
        """
        price_element = soup.find("div", class_="YMlKec fxKbKc")
        if not price_element:
            log.warning("Price element not found.")
            return None
        price_text = price_element.text.strip()
        try:
            return float(price_text.replace("$", "").replace(",", ""))
        except ValueError:
            log.warning(f"Invalid price format: {price_text}")
            return None

    def _parse_previous_close(self, soup: BeautifulSoup) -> Optional[float]:
        """
        Private helper that searches the page for the "Previous close" field and returns its price.
        Example snippet:
          <div class="gyFHrc">
            <span ...>
              <div class="mfs7Fc" ...>Previous close</div>
              <div class="EY8ABd-OWXEXe-TAWMXe" ...>The last closing price</div>
            </span>
            <div class="P6K39c">$241.84</div>
          </div>
        """
        # Find all containers that might hold the "Previous close" info
        containers = soup.find_all("div", class_="gyFHrc")
        for container in containers:
            label = container.find("div", class_="mfs7Fc")
            if label and "Previous close" in label.text:
                price_div = container.find("div", class_="P6K39c")
                if price_div:
                    price_text = (
                        price_div.text.strip().replace("$", "").replace(",", "")
                    )
                    try:
                        return float(price_text)
                    except ValueError:
                        log.warning(f"Invalid price format: {price_text}")
                        return None
        log.warning("Previous close element not found.")
        return None

    @retry(exceptions=(requests.RequestException,), max_attempts=2, delay=3, backoff=2)
    def get_stock(self, ticker: str) -> Stock:
        """
        Retrieves and caches the full stock data (using the previous close as the price)
        for a given ticker by scraping Google Finance.

        Since only the previous close is available on the page, today's change and change percentage
        are set to 0.
        """
        current_time = time.time()
        if ticker in self.cache:
            cached_stock, cached_time = self.cache[ticker]
            if current_time - cached_time < self.cache_duration:
                log.debug(f"Cache hit for '{ticker}', returning cached stock data.")
                return cached_stock

        log.debug(f"Cache miss for '{ticker}', scraping stock data...")
        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
            )
        }
        for exchange in EXCHANGES:
            try:
                url = f"https://www.google.com/finance/quote/{ticker}:{exchange}"
                log.trace(f"Fetching URL: {url}")
                response = requests.get(url, headers=headers, timeout=5)
                response.raise_for_status()
                soup = BeautifulSoup(response.text, "html.parser")
                change_today, change_today_percentage = 0.0, 0.0
                price = self._parse_price(soup)
                if price is None:
                    log.warning(f"Could not parse price for {ticker} on {exchange}.")
                    continue

                previous_close = self._parse_previous_close(soup)
                if previous_close is None:
                    log.warning(
                        f"Could not parse previous close for {ticker} on {exchange}."
                    )
                    continue
                else:
                    change_today = price - previous_close
                    change_today_percentage = (change_today / previous_close) * 100

                # Since we only have previous close, we set today's change as 0
                stock = Stock(
                    price=price,
                    change_today=change_today,
                    change_today_percentage=change_today_percentage,
                    last_updated=datetime.now(),
                )
                log.debug(
                    f"Successfully scraped stock data for '{ticker}' from {exchange}. "
                    f" Price: {stock.price}, Previous close: {previous_close}"
                    f" Change today: {stock.change_today}, Change percentage: {stock.change_today_percentage}"
                )
                self.cache[ticker] = (stock, current_time)
                return stock
            except Exception as e:
                log.warning(f"Exchange {exchange} failed for '{ticker}': {e}")
                continue

        log.error(f"Failed to scrape stock data for '{ticker}' from all exchanges.")
        raise StockNotFoundException(f"Could not retrieve stock data for '{ticker}'.")

    def get_price(self, ticker: str) -> float:
        """
        Convenience method returning only the last price from get_stock.
        """
        return self.get_stock(ticker).price

    def get_change_today(self, symbol: str) -> ChangeToday:
        """
        Convenience method returning today's change and change percentage as a ChangeToday namedtuple.
        """
        stock = self.get_stock(symbol)
        return ChangeToday(
            change=stock.change_today, change_percentage=stock.change_today_percentage
        )
