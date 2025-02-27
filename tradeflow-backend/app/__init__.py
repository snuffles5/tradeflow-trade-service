# app/__init__.py
import os
from flask import Flask
from flask_cors import CORS  # Import flask-cors
from .database import db
from .routes.trades import trades_bp


def create_app():
    app = Flask(__name__)

    # Configure secret and database from environment variables
    app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "default_secret_key")
    app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv(
        "SQLALCHEMY_DATABASE_URI", "mysql://user:pass@localhost:3306/tradeflow"
    )
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    # Enable CORS for all routes
    CORS(app)

    # Initialize the database
    db.init_app(app)

    # Register the blueprint for trade routes
    app.register_blueprint(trades_bp, url_prefix="/api")

    # Set up basic logging
    import logging
    logging.basicConfig(level=logging.INFO)
    app.logger.info("Application initialized and CORS enabled.")

    return app
