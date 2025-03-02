# price_provider.py
import time
import random
import requests  # In a real implementation, use this to fetch from an API

class PriceProvider:
    def __init__(self, cache_duration=300):
        """
        cache_duration: Number of seconds to cache the price for a given ticker.
        """
        self.cache = {}
        self.cache_duration = cache_duration

    def get_price(self, ticker):
        current_time = time.time()
        # Check if we have a cached price that is still valid
        if ticker in self.cache:
            price, timestamp = self.cache[ticker]
            if current_time - timestamp < self.cache_duration:
                return price
        # Otherwise, fetch a new price
        price = self.fetch_from_provider(ticker)
        # Cache the result
        self.cache[ticker] = (price, current_time)
        return price

    def fetch_from_provider(self, ticker):
        # In a real implementation, replace the following lines with an API request.
        # For example:
        # response = requests.get(f"https://api.example.com/price/{ticker}")
        # return response.json()['price']
        # For now, we simulate a price:
        return round(random.uniform(100, 500), 2)
