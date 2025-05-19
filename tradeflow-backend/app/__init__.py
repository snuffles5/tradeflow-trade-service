# app/__init__.py
import logging
import os

from flask import Flask
from flask_cors import CORS
from flask_migrate import Migrate
from sqlalchemy import inspect
from utils.logger import log

from .database import db
from .routes.trades import trades_bp


def create_app():
    from dotenv import load_dotenv

    load_dotenv("dev.env")
    app = Flask(__name__)

    # Configure secret key and database
    app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "default_secret_key")
    app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv(
        "SQLALCHEMY_DATABASE_URI",
        "mysql://root:DanielEni1606!@localhost:3306/tradeflow",
    )
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

    # Register blueprints
    app.register_blueprint(trades_bp, url_prefix="/api")

    # Set up basic logging
    logging.basicConfig(level=logging.INFO)
    app.logger.info("Application initialized and CORS enabled.")

    return app
