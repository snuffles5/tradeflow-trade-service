# TradeFlow (Frontend + Backend)

This repository contains:

1. A **React** frontend (the “tradeflow” React app).
2. A **Python/Flask** backend (the “tradeflow-backend”) that uses SQLAlchemy, MySQL, etc.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Project Structure](#project-structure)
3. [Local Setup](#local-setup)
   - [Clone the Repo](#clone-the-repo)
   - [Frontend Setup](#frontend-setup)
   - [Backend Setup](#backend-setup)
4. [Running the Apps Locally](#running-the-apps-locally)
   - [Starting the React Frontend](#starting-the-react-frontend)
   - [Starting the Flask Backend](#starting-the-flask-backend)
   - [Testing](#testing)
5. [Common Issues & Troubleshooting](#common-issues--troubleshooting)

---

## 1. Prerequisites

To run both the **React frontend** and the **Python backend** locally, you need:

- **Node.js** (14 or higher recommended) and **npm** (or yarn)
   - Check by running `node -v` and `npm -v` in your terminal.
- **Python 3.8+**
   - Check by running `python --version`.
- **Pip** (comes with Python)
   - Check by running `pip --version`.
- **MySQL** (optional if you want to mirror production; otherwise you can use SQLite):
   - On macOS, you can install via Homebrew:
     ```bash
     brew install mysql
     ```
     or
     ```bash
     brew install mysql-client
     ```
   - Then start MySQL (e.g., `mysql.server start` on macOS) and create a local DB:
     ```sql
     CREATE DATABASE tradeflow;
     ```

---

## 2. Project Structure

A typical structure if both frontend and backend are in the same repository might look like:

```
tradeflow/
  ├─ tradeflow-frontend/              # React frontend
  │   ├─ package.json
  │   ├─ src/
  │   └─ ...
  ├─ tradeflow-backend/      # Python/Flask backend
  │   ├─ app/
  │   ├─ requirements.txt
  │   ├─ runtime.txt
  │   └─ ...
  └─ README.md               # This file
```

(Your actual structure may vary slightly.)

---

## 3. Local Setup

### A. Clone the Repo

```bash
git clone https://github.com/yourusername/yourrepo.git
cd yourrepo
```

### B. Frontend Setup

1. **Install Node & npm** (if not already installed).
   - For macOS/Linux, you can use [nvm](https://github.com/nvm-sh/nvm) to install Node.
   - For Windows, download from [nodejs.org](https://nodejs.org).

2. **Install Dependencies**
   ```bash
   cd tradeflow-frontend
   npm install
   ```
   This installs `react`, `react-scripts`, and all other packages in `package.json`.

### C. Backend Setup

1. **Create a Virtual Environment** (recommended):
   ```bash
   cd ../tradeflow-backend
   python -m venv venv
   source venv/bin/activate  # Mac/Linux
   # or venv\Scripts\activate on Windows
   ```

2. **Install Python Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```
   This installs `Flask`, `Flask-Cors`, `Flask-SQLAlchemy`, `mysqlclient` or `PyMySQL`, etc.

3. **Configure Database** (if using MySQL locally):
   - Make sure MySQL is installed and running.
   - Create a DB named `tradeflow`:
     ```sql
     CREATE DATABASE tradeflow;
     ```
   - In `app/__init__.py`, you might see something like:
     ```python
     app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv(
         "SQLALCHEMY_DATABASE_URI", "mysql://user:pass@localhost:3306/tradeflow"
     )
     ```
     Update it with your local MySQL credentials or use an environment variable.

   - If you prefer **SQLite** for local dev, you could replace the URI with something like:
     ```python
     sqlite:///tradeflow.db
     ```

4. **Initialize Database** (if using SQLAlchemy):
   - You may have a script like `create_tables.py` that calls `db.create_all()`. For example:
     ```bash
     python create_tables.py
     ```
   - Alternatively, you can do this in a Python shell:
     ```python
     from app import create_app
     from app.database import db

     app = create_app()
     with app.app_context():
         db.create_all()
     ```

---

## 4. Running the Apps Locally

### A. Starting the React Frontend

1. **Navigate to the frontend folder**:
   ```bash
   cd ../tradeflow
   ```
2. **Run**:
   ```bash
   npm start
   ```
3. **Open** your browser to [http://localhost:3000](http://localhost:3000).
   - If you see an error like `react-scripts: command not found`, make sure you ran `npm install` first.

### B. Starting the Flask Backend

1. **Navigate to the backend folder**:
   ```bash
   cd ../tradeflow-backend
   source venv/bin/activate  # if not already active
   ```
2. **Run**:
   ```bash
   python -m flask --app app/main.py run
   ```
   or
   ```bash
   python app/main.py
   ```
3. **Open** your browser or Postman to [http://127.0.0.1:5000/api/trades](http://127.0.0.1:5000/api/trades).
   - You might get an empty JSON list `[]` if no trades are present yet.

### C. Testing

- **Submit a Trade** from the React form. The form should POST to your local backend at `http://127.0.0.1:5000/api/trades` (or wherever you configured).
- **Check Logs** in your Flask console to ensure the request is processed.
- **Check Database** if you’re using MySQL or SQLite to confirm the new record is saved.

---

## 5. Common Issues & Troubleshooting

1. **`react-scripts: command not found`**
   - Run `npm install` in the `tradeflow` folder to ensure `react-scripts` is installed.
2. **Local DB Connection Errors**
   - Verify your MySQL is running and credentials match. Or switch to SQLite for local dev.
   - Check that you updated `SQLALCHEMY_DATABASE_URI`.
3. **CORS Issues**
   - For local dev, you may need [Flask-CORS](https://flask-cors.readthedocs.io/) if your React app is served from a different port than the Flask backend.

---

