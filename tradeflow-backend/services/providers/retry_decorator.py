# services/providers/retry_decorator.py
import time
import functools
import logging


def retry(exceptions, max_attempts=3, delay=1, backoff=2):
    """
    Retry decorator that retries a function up to `max_attempts`
    times with a sleep of `delay` seconds between attempts.
    """

    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            attempt = 0
            last_exception = None
            while attempt < max_attempts:
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    logging.warning(f"Attempt {attempt + 1} failed with {e}")
                    last_exception = e
                    attempt += 1
                    time.sleep(delay)
            # If we get here, all attempts failed
            raise last_exception

        return wrapper

    return decorator
