# app/__init__.py
from flask import Flask
from .database import db
from .routes.trades import trades_bp

def create_app():
    app = Flask(__name__)

    # Example: set a secret key (not used much here, but recommended)
    app.config["SECRET_KEY"] = "replace_this_with_secure_key"

    # DB config (we'll override with environment variables on EB)
    # For local dev, you might do:
    app.config["SQLALCHEMY_DATABASE_URI"] = "mysql://root:thisismypassword@localhost:3306/tradeflow"
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    # Initialize the database
    db.init_app(app)

    # Register blueprints (routes)
    app.register_blueprint(trades_bp, url_prefix="/api")

    return app
