# services/providers/base_finance_provider.py
import abc
from collections import namedtuple

from app.models import Stock


# Named tuple for today's change
class ChangeToday(namedtuple("ChangeToday", ["change", "change_percentage"])):
    __slots__ = ()


class BaseFinanceProvider(abc.ABC):
    @abc.abstractmethod
    def get_price(self, symbol: str) -> float:
        """
        Fetch the price for a given symbol.
        Must raise an exception if it cannot fetch.
        """
        pass

    @abc.abstractmethod
    def get_change_today(self, symbol: str) -> ChangeToday:
        """
        Fetch today's change and change percentage for a given symbol.
        Must raise an exception if it cannot fetch.
        Returns a ChangeToday namedtuple.
        """
        pass

    @abc.abstractmethod
    def get_stock(self, symbol: str) -> Stock:
        """
        Fetch full stock data for a given symbol.
        Must raise an exception if it cannot fetch.
        """
        pass
