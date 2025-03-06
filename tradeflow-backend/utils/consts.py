from pathlib import Path

# Flask app configuration
PROJECT_NAME = "tradeflow"
BACKEND_FOLDER_NAME = "tradeflow-backend"


def find_project_root(marker_file="app"):
    """Drill up in parent folders until reaching the project folder.
    Args:
        marker_file (str): A folder or file that identifies the project root.
    Returns:
        Path: The absolute path to the project root.
    """
    current_path = Path(__file__).resolve().parent  # Start from current file location

    while current_path != current_path.root:  # Stop at the root directory
        if (current_path / marker_file).exists():  # Check for project identifier
            return current_path
        current_path = current_path.parent  # Move up one level

# PATHS
BACKEND_PROJECT_ROOT_PATH = find_project_root()
APP_FOLDER_PATH = BACKEND_PROJECT_ROOT_PATH / "app"
ROUTES_FOLDER_PATH = APP_FOLDER_PATH / "routes"
MIGRATIONS_FOLDER_PATH = BACKEND_PROJECT_ROOT_PATH / "migrations"
SCRIPTS_FOLDER_PATH = BACKEND_PROJECT_ROOT_PATH / "scripts"
SERVICES_FOLDER_PATH = BACKEND_PROJECT_ROOT_PATH / "services"
SERVICES_PROVIDERS_FOLDER_PATH = SERVICES_FOLDER_PATH / "providers"
DATA_FOLDER_PATH = BACKEND_PROJECT_ROOT_PATH / "data"
UTILS_FOLDER_PATH = BACKEND_PROJECT_ROOT_PATH / "utils"


EXCHANGES = ['NASDAQ', 'NYSEARCA', 'NYSE', 'AMEX']
