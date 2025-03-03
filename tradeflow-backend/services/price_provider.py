import random
import time
from utils.logger import log
from services.providers.factory import PriceProviderFactory


class PriceProvider:
    def __init__(self, cache_duration=300):
        """
        cache_duration: Number of seconds to cache the price for a given ticker.
        """
        self.cache = {}
        self.cache_duration = cache_duration
        self.yahoo_provider = PriceProviderFactory.get_provider("yahoo")
        log.debug(f"PriceProvider initialized with cache_duration={cache_duration}.")

    def get_price(self, ticker):
        current_time = time.time()
        log.trace(f"Attempting to get price for '{ticker}' in PriceProvider cache.")

        if ticker in self.cache:
            price, timestamp = self.cache[ticker]
            age = current_time - timestamp
            if age < self.cache_duration:
                log.debug(
                    f"Cache hit for '{ticker}' in PriceProvider. "
                    f"Price={price}, age={age:.1f}s."
                )
                return price
            else:
                log.debug(
                    f"Cache entry for '{ticker}' in PriceProvider expired. Age={age:.1f}s."
                )

        log.debug(f"Cache miss for '{ticker}' in PriceProvider. Fetching from Yahoo provider.")
        price = self.fetch_from_provider(ticker)
        self.cache[ticker] = (price, current_time)
        log.info(f"Price for '{ticker}' is {price}. Cached in PriceProvider.")
        return price

    def fetch_from_provider(self, ticker):
        log.trace(f"Delegating fetch for '{ticker}' to YahooPriceProvider.")
        try:
            time.sleep(random.uniform(0.3, 2))  # Simulate network latency
            return 0.01
            return self.yahoo_provider.get_price(ticker)
        except Exception as e:
            log.error(f"Failed to fetch price for '{ticker}' from Yahoo: {str(e)}")
