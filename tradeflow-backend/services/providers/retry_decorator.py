import time
from functools import wraps


def retry(exceptions, tries=3, delay=1, backoff=2):
    """
    Retry decorator that catches specified exceptions and retries the function.

    :param exceptions: An exception or tuple of exceptions that trigger a retry.
    :param tries: Number of attempts before giving up.
    :param delay: Initial delay between attempts (in seconds).
    :param backoff: Multiplier by which the delay increases after each retry.
    """

    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            _tries, _delay = tries, delay
            while _tries > 1:
                try:
                    return func(*args, **kwargs)
                except exceptions as e:
                    print(f"Exception: {e}. Retrying in {_delay} seconds...")
                    time.sleep(_delay)
                    _tries -= 1
                    _delay *= backoff
            # Final attempt; let any exception bubble up
            return func(*args, **kwargs)

        return wrapper

    return decorator
