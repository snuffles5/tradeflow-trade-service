class StockNotFoundException(Exception):
    """Custom exception for when a stock price cannot be found on any exchange."""

    pass


class TradeNotFoundException(Exception):
    """Custom exception for when a trade cannot be found in the database."""

    pass


class UnrealizedHoldingRecalculationError(Exception):
    """Raised when an error occurs during the recalculation of an unrealized holding."""

    pass


class HoldingRetrievalError(Exception):
    """Raised when an error occurs while retrieving an active holding."""

    pass
