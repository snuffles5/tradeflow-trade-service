# services/providers/yahoo_finance_provider.py
import logging
from datetime import datetime

import requests

from app.models import Stock
from services.providers.base_finance_provider import BaseFinanceProvider, ChangeToday
from services.providers.retry_decorator import retry


def parse_price(text):
    result = text.split("price: ")[1].split("<")[0]
    return float(result)


class YahooFinanceProvider(BaseFinanceProvider):

    def get_stock(self, symbol: str) -> Stock:
        # Your Yahoo Finance fetching logic here
        # If there's a failure, raise an exception to trigger the retry
        logging.info(f"Fetching price from Yahoo for {symbol}...")
        url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?interval=1m"
        response = requests.get(url, timeout=5)
        if response.status_code != 200:
            raise Exception("Yahoo provider failed")
        price = parse_price(response.text)
        stock = Stock(price=price, change_today=0.0, change_today_percentage=0.0, last_updated=datetime.now())
        return stock

    @retry(exceptions=(Exception,), max_attempts=1, delay=1, backoff=2)
    def get_price(self, symbol: str) -> float:
        stock = self.get_stock(symbol)
        return stock.price

    def get_change_today(self, symbol: str) -> ChangeToday:
        stock = self.get_stock(symbol)
        return ChangeToday(change=stock.change_today, change_percentage=stock.change_today_percentage)
