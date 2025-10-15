# app/__init__.py
import logging
import os

from dotenv import load_dotenv
from flask import Flask
from flask_cors import CORS
from flask_migrate import Migrate
from sqlalchemy import inspect
from utils.logger import log

from .commands import register_commands
from .database import db
from .routes.trades import trades_bp


def _build_database_uri():
    explicit_uri = os.getenv("SQLALCHEMY_DATABASE_URI")
    if explicit_uri:
        return explicit_uri

    db_user = os.getenv("DB_USER")
    db_password = os.getenv("DB_PASSWORD")
    db_host = os.getenv("DB_HOST", "localhost")
    db_port = os.getenv("DB_PORT", "3306")
    db_name = os.getenv("DB_NAME")

    check_values = {
        "user": db_user,
        "password": db_password,
        "name": db_name,
    }
    if any(
        value in {None, "", "root", "password", "changeme"}
        for value in check_values.values()
    ):
        raise RuntimeError(
            "Database configuration is not secure. "
            "Set SQLALCHEMY_DATABASE_URI or non-default DB_USER/DB_PASSWORD/DB_NAME."
        )

    return f"mysql+pymysql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"


def create_app():
    load_dotenv()

    app = Flask(__name__)

    # Configure secret key and database
    app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "default_secret_key")
    app.config["SQLALCHEMY_DATABASE_URI"] = _build_database_uri()
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    # Enable CORS, explicitly allowing the frontend development server
    # You might keep the env var for production flexibility
    allowed_origins = [os.getenv("FRONTEND_URL"), "http://localhost:3000"]
    # Filter out None values in case FRONTEND_URL is not set
    allowed_origins = [origin for origin in allowed_origins if origin]
    if not allowed_origins:
        allowed_origins = "*"  # Fallback if no origins are specified

    CORS(app, resources={r"/api/*": {"origins": allowed_origins}})

    # Initialize database
    db.init_app(app)

    # Check database tables safely
    with app.app_context():
        inspector = inspect(db.engine)
        tables = inspector.get_table_names()
        log.debug(
            f"{tables} tables found in the database."
            if tables
            else "No tables found in the database."
        )

    # Initialize Flask-Migrate
    Migrate(app, db)

    register_commands(app)

    # Register blueprints
    app.register_blueprint(trades_bp, url_prefix="/api")

    # Set up basic logging
    logging.basicConfig(level=logging.INFO)
    app.logger.info("Application initialized and CORS enabled.")

    return app
