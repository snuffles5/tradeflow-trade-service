# services/providers/yahoo_finance_provider.py
import logging
from datetime import datetime
from datetime import timezone
from typing import Optional

import requests
from app.models import Stock
from services.providers.base_finance_provider import BaseFinanceProvider
from services.providers.base_finance_provider import ChangeToday
from services.providers.retry_decorator import retry


def parse_price(text):
    result = text.split("price: ")[1].split("<")[0]
    return float(result)


class YahooFinanceProvider(BaseFinanceProvider):
    def get_stock(
        self, symbol: str, market_identifier: Optional[str] = None
    ) -> Optional[Stock]:
        # Your Yahoo Finance fetching logic here
        # If there's a failure, raise an exception to trigger the retry
        logging.info(
            f"Fetching stock data from Yahoo for {symbol}... (market hint ignored)"
        )
        # Yahoo generally doesn't need/use market identifiers in the same way as Google
        url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?interval=1m"
        try:
            response = requests.get(
                url, timeout=10, headers={"User-agent": "Mozilla/5.0"}
            )
            response.raise_for_status()  # Raise HTTPError for bad responses (4xx or 5xx)
            data = response.json()

            # Extract data from Yahoo's response structure
            chart_data = data.get("chart", {}).get("result", [{}])[0]
            meta = chart_data.get("meta", {})

            if not meta:
                logging.warning(f"No metadata found for {symbol} in Yahoo response.")
                return None

            current_price = meta.get("regularMarketPrice")
            previous_close = meta.get("previousClose")

            if current_price is None or previous_close is None:
                logging.warning(
                    f"Could not extract price/previous close for {symbol} from Yahoo. "
                    f"Price: {current_price}, PrevClose: {previous_close}"
                )
                return None

            change_today = current_price - previous_close
            change_today_percentage = (
                (change_today / previous_close * 100) if previous_close != 0 else 0.0
            )

            # Determine market identifier (Yahoo provides 'exchangeName')
            yahoo_exchange = meta.get("exchangeName")

            stock = Stock(
                price=float(current_price),
                change_today=round(change_today, 4),
                change_today_percentage=round(change_today_percentage, 4),
                last_updated=datetime.now(timezone.utc),  # Use timezone-aware
                market_identifier=yahoo_exchange,  # Use the exchange name from Yahoo
                provider_name="yahoo",  # Hardcode provider name
            )
            logging.info(f"Successfully fetched data for {symbol} from Yahoo.")
            return stock

        except requests.exceptions.HTTPError as http_err:
            if http_err.response.status_code == 404:
                logging.warning(f"Ticker {symbol} not found on Yahoo (404).")
            else:
                logging.error(f"HTTP error fetching {symbol} from Yahoo: {http_err}")
            return None  # Return None on error
        except Exception as e:
            logging.error(
                f"Error fetching or parsing {symbol} from Yahoo: {e}", exc_info=True
            )
            return None  # Return None on error

    @retry(exceptions=(Exception,), max_attempts=1, delay=1, backoff=2)
    def get_price(self, symbol: str) -> Optional[float]:
        stock = self.get_stock(symbol)
        return stock.price if stock else None

    def get_change_today(self, symbol: str) -> Optional[ChangeToday]:
        stock = self.get_stock(symbol)
        if stock:
            return ChangeToday(
                change=stock.change_today,
                change_percentage=stock.change_today_percentage,
            )
        return None
