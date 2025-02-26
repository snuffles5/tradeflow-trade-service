# app/main.py
from flask import Flask
from . import create_app

app = create_app()

if __name__ == "__main__":
    # For local development
    app.run(debug=True, host="0.0.0.0", port=5000)
