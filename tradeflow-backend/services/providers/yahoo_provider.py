import os
import time
import requests
import urllib.parse
from utils.logger import log
from services.providers.base_provider import BasePriceProvider
from services.providers.retry_decorator import retry


class YahooPriceProvider(BasePriceProvider):
    """
    A price provider that authenticates via Yahoo OAuth2 and retrieves stock prices.
    Uses Authorization Code Flow with automatic login and token refreshing.
    """

    def __init__(self, cache_duration=300):
        """
        :param cache_duration: Number of seconds to cache the price for a given ticker.
        """
        self.cache_duration = cache_duration
        self.cache = {}

        # Read credentials from environment
        self.client_id = os.getenv("YAHOO_CLIENT_ID")
        self.client_secret = os.getenv("YAHOO_CLIENT_SECRET")
        self.redirect_uri = os.getenv("YAHOO_REDIRECT_URI")
        self.app_id = os.getenv("YAHOO_APP_ID")

        # OAuth token storage
        self.access_token = None
        self.refresh_token = None
        self.token_expires_at = 0

        if not all([self.client_id, self.client_secret, self.redirect_uri, self.app_id]):
            raise ValueError("Missing required Yahoo credentials in .env file")

        log.debug(f"YahooPriceProvider initialized with cache_duration={cache_duration}")


    @retry(exceptions=(requests.RequestException,), tries=5, delay=3, backoff=2)
    def fetch_from_provider(self, ticker: str) -> float:
        """
        Fetches the latest stock price from Yahoo Finance API.
        """
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "X-Yahoo-App-Id": self.app_id
        }

        url = f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}?interval=1m"
        log.trace(f"Fetching price from Yahoo for '{ticker}'. Request URL: {url}")

        response = requests.get(url, headers=headers, timeout=5)
        response.raise_for_status()

        data = response.json()
        result = data["chart"]["result"][0]
        current_price = result["meta"]["regularMarketPrice"]

        log.info(f"Got price {current_price} for '{ticker}' from Yahoo Finance.")
        return float(current_price)

    def get_price(self, ticker: str) -> float:
        """
        Retrieves the price for a given ticker, using caching and refreshing access tokens.
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
