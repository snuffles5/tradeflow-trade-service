import logging
import os

# Define a new log level TRACE that is lower than DEBUG.
TRACE_LEVEL_NUM = 5
logging.addLevelName(TRACE_LEVEL_NUM, "TRACE")

def trace(self, message, *args, **kws):
    if self.isEnabledFor(TRACE_LEVEL_NUM):
        # Yes, logger takes its '*args' as 'args'.
        self._log(TRACE_LEVEL_NUM, message, args, **kws)

logging.Logger.trace = trace

# Determine if we're running locally or in AWS.
# A common practice is to check an environment variable. For AWS, 'AWS_EXECUTION_ENV' is typically present.
if os.environ.get("AWS_EXECUTION_ENV"):
    log_level = logging.INFO
else:
    # Running locally (or not in AWS), use TRACE
    log_level = TRACE_LEVEL_NUM

# Configure the root logger.
logging.basicConfig(
    level=log_level,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
)

log = logging.getLogger(__name__)
