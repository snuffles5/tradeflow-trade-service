import time
import logging
from typing import List, Tuple

from services.providers.base_finance_provider import BaseFinanceProvider
from services.providers.google_finance_provider import GoogleFinanceProvider
from services.providers.yahoo_finance_provider import YahooFinanceProvider


class ProviderFactory:
    def __init__(self, providers: List[BaseFinanceProvider] = None, cache_duration: int = 300):
        """
        Initialize the factory with a list of providers and a cache_duration (in seconds).
        """
        self.cache_duration = cache_duration
        self.cache: dict[str, Tuple[float, float]] = {}  # mapping: symbol -> (price, timestamp)

        if providers is not None:
            self.providers = providers
        else:
            self.providers = [
                YahooFinanceProvider(),
                GoogleFinanceProvider(),
            ]

    def get_price(self, symbol: str) -> float:
        """
        Fetch the price for the symbol.
        First check if there's a valid-cached value; if not, iterate over providers.
        """
        current_time = time.time()

        # Check if the symbol is in the cache and not expired
        if symbol in self.cache:
            cached_price, timestamp = self.cache[symbol]
            if current_time - timestamp < self.cache_duration:
                logging.info(f"Returning cached price for {symbol}")
                return cached_price
            else:
                # Cache expired; remove entry
                del self.cache[symbol]

        # Iterate over providers
        last_exception = None
        for provider in self.providers:
            try:
                price = provider.get_price(symbol)
                # Update cache with new value and current timestamp
                self.cache[symbol] = (price, current_time)
                return price
            except Exception as e:
                logging.warning(f"Provider {provider.__class__.__name__} failed for {symbol}: {e}")
                last_exception = e

        # If all providers fail, raise the last encountered exception
        raise last_exception
