from abc import ABC, abstractmethod

class BasePriceProvider(ABC):
    """
    An abstract base class for all price providers.
    """
    @abstractmethod
    def get_price(self, ticker: str) -> float:
        """
        Return the current price for the specified ticker.
        """
        pass
