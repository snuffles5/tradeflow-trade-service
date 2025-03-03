# services/providers/yahoo_finance_provider.py
import logging

import requests

from services.providers.base_finance_provider import BaseFinanceProvider
from services.providers.retry_decorator import retry


def parse_price(text):
    result = text.split("price: ")[1].split("<")[0]
    return float(result)


class YahooFinanceProvider(BaseFinanceProvider):
    @retry(exceptions=(Exception,), max_attempts=1, delay=1, backoff=2)
    def get_price(self, symbol: str) -> float:
        # Your Yahoo Finance fetching logic here
        # If there's a failure, raise an exception to trigger the retry
        logging.info(f"Fetching price from Yahoo for {symbol}...")
        url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?interval=1m"
        response = requests.get(url, timeout=5)
        if response.status_code != 200:
            raise Exception("Yahoo provider failed")
        price = parse_price(response.text)
        return price
