import logging
import os


class Logger:
    TRACE_LEVEL_NUM = 5  # Define a new TRACE log level

    def __init__(self):
        self._setup_trace_level()
        self.log_level = self._determine_log_level()
        self._configure_logging()
        self._configure_flask_migrate_logging()

    def _setup_trace_level(self):
        """Adds a custom TRACE log level to logging."""
        logging.addLevelName(self.TRACE_LEVEL_NUM, "TRACE")

        def trace(self, message, *args, **kws):
            if self.isEnabledFor(Logger.TRACE_LEVEL_NUM):
                self._log(Logger.TRACE_LEVEL_NUM, message, args, **kws)

        logging.Logger.trace = trace

    def _determine_log_level(self):
        """Determines the log level based on the execution environment."""
        if os.environ.get("AWS_EXECUTION_ENV"):
            return logging.INFO  # Running in AWS
        return self.TRACE_LEVEL_NUM  # Running locally

    def _configure_logging(self):
        """Configures the root logger."""
        logging.basicConfig(
            level=self.log_level,
            format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        )

    def _configure_flask_migrate_logging(self):
        """Ensures Flask-Migrate logging follows the same log level."""
        logging.getLogger("flask_migrate").setLevel(self.log_level)


# Initialize Logger
Logger()

# Use log as the main logger instance outside the class
log = logging.getLogger(__name__)
