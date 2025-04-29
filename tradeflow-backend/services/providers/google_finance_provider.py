from datetime import datetime
from datetime import timezone
from typing import Optional

import requests
from app.models import Stock
from bs4 import BeautifulSoup
from services.providers.base_finance_provider import BaseFinanceProvider
from services.providers.base_finance_provider import ChangeToday
from services.providers.retry_decorator import retry
from utils.logger import log

# Define common exchanges to try if no hint is provided
COMMON_EXCHANGES = ["NASDAQ", "NYSE", "NYSEAMERICAN", "OTC", "OTCMKTS", "BATS"]


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

    def _parse_price(self, soup: BeautifulSoup) -> Optional[float]:
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
    def get_stock(
        self, ticker: str, market_identifier: Optional[str] = None
    ) -> Optional[Stock]:
        """
        Retrieves and caches the full stock data for a given ticker by scraping Google Finance.
        Uses market_identifier hint if provided, otherwise tries common exchanges.
        Returns a Stock object on success, None if not found after trying.
        """
        # Note: Internal cache in provider is less useful now with DB cache at route level,
        # but keep it for potential direct uses or slight performance gain within a single request.
        current_time_dt = datetime.now(timezone.utc)
        cache_key = f"{market_identifier}:{ticker}" if market_identifier else ticker

        if cache_key in self.cache:
            cached_stock, cached_time_dt = self.cache[cache_key]
            if (current_time_dt - cached_time_dt).total_seconds() < self.cache_duration:
                log.debug(
                    f"Provider cache hit for '{cache_key}', returning cached stock."
                )
                return cached_stock
            else:
                log.debug(f"Provider cache expired for {cache_key}")
                del self.cache[cache_key]

        log.debug(f"Provider cache miss for '{cache_key}', scraping stock data...")
        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
            )
        }

        # Determine which exchanges/identifiers to try
        exchanges_to_try = []
        query_ticker = ticker  # Ticker used in query URL
        used_market_identifier = None  # Track the one that worked

        if market_identifier:
            # If a hint is provided, try it first
            exchanges_to_try.append(market_identifier)
            log.debug(f"Using provided market identifier hint: {market_identifier}")
        else:
            # No hint, try common exchanges
            exchanges_to_try.extend(COMMON_EXCHANGES)
            log.debug(
                f"No market identifier hint, trying common exchanges: {COMMON_EXCHANGES}"
            )

        for exchange in exchanges_to_try:
            try:
                # Format query for Google Finance
                query_ticker = f"{exchange}:{ticker}"
                url = f"https://www.google.com/finance/quote/{query_ticker}"
                log.trace(f"Fetching URL: {url}")
                response = requests.get(url, headers=headers, timeout=7)
                response.raise_for_status()
                soup = BeautifulSoup(response.text, "html.parser")

                # Attempt to parse required fields
                price = self._parse_price(soup)
                if price is None:
                    log.warning(
                        f"Could not parse current price for {query_ticker}. Trying next..."
                    )
                    continue  # Price is essential

                previous_close = self._parse_previous_close(soup)
                if previous_close is None:
                    log.warning(
                        f"Could not parse previous close for {query_ticker}. Trying next..."
                    )
                    continue  # Previous close is needed for change calculation

                # Calculate change
                change_today = price - previous_close
                change_today_percentage = (
                    (change_today / previous_close * 100)
                    if previous_close != 0
                    else 0.0
                )

                # Success! Record the exchange that worked
                used_market_identifier = exchange
                log.debug(
                    f"Successfully scraped data for '{ticker}' using identifier '{used_market_identifier}'. "
                    f"Price: {price}, Prev Close: "
                    f"{previous_close}, Change: {change_today:.2f} ({change_today_percentage:.2f}%)"
                )

                # Create Stock object, including the identifier that worked and provider name
                stock = Stock(
                    price=price,
                    change_today=round(change_today, 4),
                    change_today_percentage=round(change_today_percentage, 4),
                    last_updated=current_time_dt,  # Use consistent timestamp
                    market_identifier=used_market_identifier,
                    provider_name="google",  # Hardcode provider name
                )

                # Update provider cache with the key that worked
                final_cache_key = f"{used_market_identifier}:{ticker}"
                self.cache[final_cache_key] = (stock, current_time_dt)
                log.debug(f"Updated provider cache for '{final_cache_key}'")

                return stock  # Return the successful stock object

            except requests.exceptions.HTTPError as http_err:
                if http_err.response.status_code == 404:
                    log.debug(
                        f"Ticker '{query_ticker}' not found (404). Trying next..."
                    )
                else:
                    log.warning(
                        f"HTTP error for '{query_ticker}': {http_err}. Trying next..."
                    )
                continue  # Try next exchange
            except Exception as e:
                log.warning(
                    f"Error fetching/parsing for '{query_ticker}': {e}. Trying next...",
                    exc_info=False,
                )
                continue  # Try next exchange

        # If loop completes without returning, ticker was not found with any identifier
        log.warning(
            f"Failed to scrape stock data for '{ticker}' using hint '{market_identifier}' or common exchanges."
        )
        # Return None to indicate not found, rather than raising StockNotFoundException
        # The factory and route handler will manage the 404 response.
        return None

    def get_price(self, ticker: str) -> Optional[float]:
        """
        Convenience method returning only the last price from get_stock.
        Returns None if stock not found.
        """
        stock = self.get_stock(ticker)  # Doesn't pass hint here
        return stock.price if stock else None

    def get_change_today(self, symbol: str) -> Optional[ChangeToday]:
        """
        Convenience method returning today's change as a ChangeToday namedtuple.
        Returns None if stock not found.
        """
        stock = self.get_stock(symbol)  # Doesn't pass hint here
        if stock:
            return ChangeToday(
                change=stock.change_today,
                change_percentage=stock.change_today_percentage,
            )
        return None
