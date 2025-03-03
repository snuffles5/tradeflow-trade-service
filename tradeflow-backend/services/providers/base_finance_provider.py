# services/providers/base_finance_provider.py
import abc


class BaseFinanceProvider(abc.ABC):
    @abc.abstractmethod
    def get_price(self, symbol: str) -> float:
        """
        Fetch the price for a given symbol.
        Must raise an exception if it cannot fetch.
        """
        pass
