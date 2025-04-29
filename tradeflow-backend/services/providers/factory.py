from datetime import datetime
from datetime import timezone
from typing import Optional

from app.models import Stock
from services.providers.base_finance_provider import BaseFinanceProvider
from services.providers.base_finance_provider import ChangeToday
from services.providers.google_finance_provider import GoogleFinanceProvider
from services.providers.yahoo_finance_provider import YahooFinanceProvider
from utils.logger import log

CACHE_DURATION = 60 * 3  # 3 minutes


class ProviderFactory:
    def __init__(
        self,
        providers: list[BaseFinanceProvider] = None,
        cache_duration: int = CACHE_DURATION,
    ):
        """
        Initialize the factory with a list of providers and a cache_duration (in seconds).
        """
        self.cache_duration = cache_duration
        # Factory-level cache (ticker -> Stock object). Route has DB cache.
        self.cache: dict[str, tuple[Stock, datetime]] = {}

        if providers is not None:
            self.providers = providers
        else:
            # Default providers
            self.providers = [
                GoogleFinanceProvider(),
                YahooFinanceProvider(),
            ]

    def get_stock(
        self,
        symbol: str,
        market_identifier: Optional[str] = None,
        provider_source_hint: Optional[str] = None,
    ) -> Optional[Stock]:
        """
        Fetch the Stock data for the symbol, optionally using hints.
        Checks factory cache first, then iterates over providers.
        Uses market_identifier hint only if the provider matches provider_source_hint.
        """
        now = datetime.now(timezone.utc)
        # Cache key still based on market identifier if provided, as it affects the Google query
        cache_key = f"{market_identifier}:{symbol}" if market_identifier else symbol

        # Check cache
        if cache_key in self.cache:
            cached_stock, cached_time_dt = self.cache[cache_key]

            # Ensure cached time is timezone-aware for comparison
            if cached_time_dt.tzinfo is None:
                # Fallback: Assume older cached times were naive but represented UTC
                log.warning(
                    f"Factory cache for {cache_key} has naive timestamp, assuming UTC."
                )
                cached_time_dt = cached_time_dt.replace(tzinfo=timezone.utc)

            elapsed = (now - cached_time_dt).total_seconds()
            if elapsed < self.cache_duration:
                log.info(f"Returning factory cached stock for {cache_key}")
                return cached_stock
            else:
                log.debug(f"Factory cache expired for {cache_key}")
                del self.cache[cache_key]
        else:
            log.debug(f"Factory cache miss for {cache_key}")

        last_exception = None
        for provider in self.providers:
            try:
                # Determine if we should use the market identifier hint for this provider
                current_provider_name = (
                    provider.__class__.__name__
                )  # e.g., "GoogleFinanceProvider"
                use_market_hint = False
                if provider_source_hint and market_identifier:
                    # Compare provider name (case-insensitive) from hint with current provider
                    # Assuming provider_source_hint stores something like 'google' or 'yahoo'
                    if provider_source_hint.lower() in current_provider_name.lower():
                        use_market_hint = True

                effective_market_identifier = (
                    market_identifier if use_market_hint else None
                )

                log.debug(
                    f"Attempting fetch for {symbol} with effective hint '{effective_market_identifier}' "
                    f"(Hint Provider: {provider_source_hint}) using {current_provider_name}"
                )

                # Call provider with the potentially nulled-out hint
                stock = provider.get_stock(
                    symbol, market_identifier=effective_market_identifier
                )

                if stock:
                    log.info(
                        f"Fetched stock for {symbol} using {current_provider_name}"
                    )
                    # Cache update logic (remains the same)
                    final_cache_key = (
                        f"{stock.market_identifier}:{symbol}"
                        if stock.market_identifier
                        else symbol
                    )
                    self.cache[final_cache_key] = (stock, stock.last_updated)
                    return stock
                else:
                    log.warning(
                        f"Provider {current_provider_name} could not find data for {symbol} "
                        f"with effective hint '{effective_market_identifier}'"
                    )
            except Exception as e:
                log.warning(
                    f"Provider {current_provider_name} failed for {symbol} "
                    f"(effective hint: '{effective_market_identifier}'): {e}",
                    exc_info=False,
                )
                last_exception = e

        # If all providers failed or returned None
        log.error(
            f"All providers failed for {symbol} "
            f"(market hint: '{market_identifier}', provider hint: '{provider_source_hint}')"
        )
        if last_exception:
            raise last_exception
        else:
            return None

    def get_price(self, symbol: str) -> Optional[float]:
        """
        Convenience method to get the last price for a symbol.
        Returns None if stock not found.
        """
        stock = self.get_stock(symbol)  # Doesn't use hint here, maybe it should?
        return stock.price if stock else None

    def get_change_today(self, symbol: str) -> Optional[ChangeToday]:
        """
        Convenience method to get today's change for a symbol.
        Returns None if stock not found.
        """
        stock = self.get_stock(symbol)  # Doesn't use hint here, maybe it should?
        if stock:
            return ChangeToday(
                change=stock.change_today,
                change_percentage=stock.change_today_percentage,
            )
        return None
