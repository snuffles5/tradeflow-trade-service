import time
import logging
from datetime import datetime
from typing import List, Tuple

from app.models import Stock
from services.providers.base_finance_provider import BaseFinanceProvider, ChangeToday
from services.providers.google_finance_provider import GoogleFinanceProvider
from services.providers.yahoo_finance_provider import YahooFinanceProvider


class ProviderFactory:
    def __init__(self, providers: List[BaseFinanceProvider] = None, cache_duration: int = 300):
        """
        Initialize the factory with a list of providers and a cache_duration (in seconds).
        """
        self.cache_duration = cache_duration
        # Cache mapping: symbol -> Stock object
        self.cache: dict[str, Stock] = {}

        if providers is not None:
            self.providers = providers
        else:
            self.providers = [
                GoogleFinanceProvider(),
                YahooFinanceProvider(),
            ]

    def get_stock(self, symbol: str) -> Stock:
        """
        Fetch the Stock data for the symbol.
        First, check if there's a valid cached Stock; if not, iterate over providers.
        """
        now = datetime.now()

        # Check if the symbol is in the cache and not expired
        if symbol in self.cache:
            cached_stock = self.cache[symbol]
            elapsed = (now - cached_stock.last_updated).total_seconds()
            if elapsed < self.cache_duration:
                logging.info(f"Returning cached stock for {symbol}")
                return cached_stock
            else:
                del self.cache[symbol]

        last_exception = None
        for provider in self.providers:
            try:
                # Assume provider.get_price(symbol) returns a float price.
                stock = provider.get_stock(symbol)
                self.cache[symbol] = stock
                return stock
            except Exception as e:
                logging.warning(f"Provider {provider.__class__.__name__} failed for {symbol}: {e}")
                last_exception = e

        raise last_exception

    def get_price(self, symbol: str) -> float:
        """
        Convenience method to get the last price for a symbol.
        """
        return self.get_stock(symbol).price

    def get_change_today(self, symbol: str) -> ChangeToday:
        """
        Convenience method to get today's change and change percentage for a symbol.
        Returns ChangeToday namedtuple.
        """
        stock = self.get_stock(symbol)
        return ChangeToday(change=stock.change_today, change_percentage=stock.change_today_percentage)
