import os
from flask import Flask
from .database import db
from .routes.trades import trades_bp

def create_app():
    app = Flask(__name__)

    # Pull sensitive settings from environment variables
    app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "default_secret_key")
    app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv(
        "SQLALCHEMY_DATABASE_URI", "mysql://user:pass@localhost:3306/tradeflow"
    )
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    db.init_app(app)
    app.register_blueprint(trades_bp, url_prefix="/api")

    return app
