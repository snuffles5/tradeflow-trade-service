# TradeFlow – LLM Usage README

This document gives LLMs a fast, high-level understanding of this repository, its languages, frameworks, structure, and key files. It summarizes what matters so you rarely need to dive into each file.

## Overview
- Backend: Java Spring Boot 3 microservice (`tradeflow-backend/`) with Spring MVC, Spring Data JPA, MapStruct, Flyway, Testcontainers, MySQL (primary).
- Frontend: React (React 19 + react-scripts), Material UI, React Router.
- Purpose: Track trades and holdings, compute metrics (net cost, PnL), fetch live stock info via provider factory (legacy Python) or future Java adapters.

## Languages, Frameworks, Tooling
- Java 21 (Spring Boot 3.3, Spring MVC, Spring Data JPA, MapStruct, Flyway, Testcontainers, Lombok)
- DB: MySQL 8 (primary). ORM: Hibernate (Java) / SQLAlchemy (Python legacy).
- Node/React (react-scripts, React 19, MUI, React Router v7)
- Deployment: Java service packaged as fat jar / Docker
- Tooling: Maven, Docker Compose, ESLint (frontend)

## Top-level structure
- `tradeflow-backend/` – Spring Boot microservice
- `tradeflow-frontend/` – React app
- Root `README.md` – human setup guide
- `.gitignore`, `.DS_Store`, `.idea/` – typical local/dev artifacts

## Root files – notes
- `Procfile`: `web: gunicorn app.main:app --bind 0.0.0.0:$PORT` – Heroku/EB style. Requires `FLASK_APP` not needed because it imports via module path.
- `README.md`: Detailed setup (Node/React frontend, Flask backend, DB setup, local running). Good reference for developers.
- `.gitignore`: Standard ignores.
- `.idea/`, `.DS_Store`, `venv/`: IDE/macOS cache and local venv – not required by CI.

---

## Backend: `tradeflow-backend-java/`

### Notable files and purpose
- `pom.xml`
  - Spring Boot starter parent 3.3.0, Java 21
  - Dependencies: web, data-jpa, validation, Flyway (core + MySQL), MapStruct, Lombok, springdoc-openapi, MySQL connector, Testcontainers (junit-jupiter + mysql)
- `Dockerfile`
  - Multi-stage build (Maven builder → OpenJDK 17 runtime) producing runnable jar
- `docker-compose.yml`
  - Spins up MySQL 8 and the Spring Boot service; expects `.env` providing DB creds
- `.env.example`
  - Template for `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `FRONTEND_URL`
- `src/main/java/com/snuffles/tradeflow/`
  - `TradeflowApplication.java` – main application class
  - `domain/` – JPA entities (`Trade`, `TradeOwner`, `TradeSource`, `UnrealizedHolding`, `LastPriceInfo`) with soft delete via `@SQLDelete`/`@Where`
  - `repository/` – Spring Data JPA repositories
  - `service/` – core business logic (`TradeService`, `HoldingsService`), exceptions
  - `seeding/` – `DataSeedingService` (reads `seed-data.json` on startup)
  - `web/` – controllers (`TradeController`, `ReferenceDataController`), DTOs, MapStruct mappers
- `src/main/resources/`
  - `application.yml` – config (datasource, JPA, Flyway, springdoc), loads env vars
  - `db/migration/V1__baseline_schema.sql` – Flyway baseline schema matching holdings/trades model
  - `seed-data.json` – canonical seed dataset (owner/source names, numeric fields as numbers)

### Testing
- `src/test/java/`
  - `ITBase` – Testcontainers MySQL setup
  - `TradeControllerIT` – REST integration coverage
  - `HoldingsServiceTest` – unit test for holdings recalculation logic

### Running
- Local dev: `mvn spring-boot:run` (ensure `.env` or env vars set)
- With Docker Compose: `docker compose up --build` (requires `.env` with secure creds)
- Tests: `mvn test` (runs unit + Testcontainers integration tests)

---

## Legacy Backend: `tradeflow-backend/`

### Notable files and purpose
- `requirements.txt`
  - Flask 2.2.5, Flask-SQLAlchemy 3.0.5, Flask-Cors, Flask-Migrate, gunicorn
  - DB drivers: `mysqlclient` (or `PyMySQL` alternative), requests/bs4/lxml
  - `ib_insync` present but not used in reviewed endpoints
- `runtime.txt`: runtime spec for deployment (likely Python version)
- `dev.env`: example env values (not read automatically). Use for local env vars.
- `.pre-commit-config.yaml`: pre-commit hooks configuration (style/lint).
- `exceptions.py`: custom exceptions used by services/routes (e.g., `StockNotFoundException`, `TradeNotFoundException`, `UnrealizedHoldingRecalculationError`, `HoldingRetrievalError`).
- `gauge_longform.csv`, `raw_series.json`: data placeholders (empty in snapshot).

### App package: `app/`
- `app/__init__.py`
  - `create_app()` factory. Configures:
    - `SECRET_KEY` from env (default fallback)
    - `SQLALCHEMY_DATABASE_URI` from env, defaulting to MySQL `mysql://root:...@localhost:3306/tradeflow`
    - CORS for `/api/*` with `FRONTEND_URL` or `http://localhost:3000`
    - Initializes `db`, `Migrate`, registers blueprint `trades_bp` at `/api`
    - Logs DB tables using SQLAlchemy inspector
- `app/main.py`
  - WSGI entry: `app = create_app()`; local dev runner on port 5555
- `app/database.py`
  - Exposes `db = SQLAlchemy()`
  - Contains a local `create_engine` + `SessionLocal` for SQLite reference; the app actually uses `db` configured via `create_app()`
- `app/models.py`
  - SQLAlchemy models:
    - `TradeOwner` (names like Daniel/Shachar/Joint)
    - `TradeSource` (brokers like Interactive/One Zero/Blink)
    - `Trade` with relationships to owner/source and optional `holding_id`, soft-delete pattern via `SoftDeleteMixin` on holdings
    - `UnrealizedHolding` core aggregate fields (net_quantity, average_cost, net_cost, realized PnL, totals for buy/sell, open/close dates)
    - `LastPriceInfo` for route-level price caching
    - `TradeTransactionType` constants: `buy`/`sell`
    - Some `dataclass` for `Stock` used by providers
- `app/schemas.py` (Marshmallow)
  - Schemas for `TradeOwner`, `TradeSource`, `Trade`, `UnrealizedHolding`, `LastPriceInfo`
  - `TradeSchema` expects `trade_owner_id`, `trade_source_id`; provides nested owner/source on dump; `trade_date` defaulted to UTC now
- `app/routes/trades.py`
  - Blueprint `trades_bp` under `/api`
  - In-memory provider factory cache duration via `ProviderFactory` and `CACHE_DURATION`
  - Endpoints:
    - `POST /api/trades` (`create_trade()`)
      - Validates `trade_owner_id`/`trade_source_id`, ensures owner is valid for source
      - Converts camelCase->snake_case from request
      - Creates `Trade`, associates owner/source, processes via `process_new_trade()` to update holdings, persists and appends to JSON file at `utils.consts.TRADES_JSON_FILE_PATH`
    - `GET /api/trades` (`list_trades()`)
      - Returns active trades with nested owner/source using `TradeSchema` (camelCase response)
    - `GET /api/holdings` (`list_holdings()`)
      - Returns holdings with computed `holdingPeriod`, `tradeCount`, status open/closed, totals and realized PnL fields
    - `GET /api/holdings-summary` (`holdings_summary()`)
      - Aggregates net cost by Owner-Source combination and totals
    - `GET /api/stock-info/:ticker` (`get_stock_info()`)
      - DB cache read from `LastPriceInfo`, route-level freshness check; otherwise fetch via `ProviderFactory` (Google/Yahoo); updates DB cache with timezone-aware timestamps
    - Additional endpoints (not fully expanded here) for updating/deleting trades and listing owners/sources
- `app/commands.py`
  - Flask CLI command `reprocess-holdings` to recalc all `UnrealizedHolding`
  - `register_commands(app)` helper to attach commands to app
- `app/data/constants.json`
  - Static constants used by app (small JSON)

### Services: `services/`
- `services/db_queries.py`: query helpers (fetch trades, holdings, active holding, etc.) — used by routes/services
- `services/trade_holdings.py`
  - Core business logic for holdings:
    - `update_unrealized_holding(new_trade)`: create/update holding on each trade, adjust average cost, net quantity, close/reopen
    - `process_new_trade(new_trade)`: wraps update and triggers recalculation if holding closed
    - `recalc_unrealized_holding(holding)`: recomputes holding state from associated active trades; sets realized PnL when closed; returns `None` if holding soft-deleted
    - Utility functions: `get_holding_period`, `get_profit`, `get_profit_percentage`
  - Uses exceptions and `services.db_queries` helpers; commits handled by calling context
- `services/providers/`
  - `factory.py`: `ProviderFactory` that aggregates providers, adds in-memory cache (3 min), supports provider hinting and market hint usage, returns a `Stock` dataclass
  - `google_finance_provider.py`, `yahoo_finance_provider.py`, `base_finance_provider.py`: provider interfaces and implementations (fetch prices/changes)

### Utils: `utils/`
- `logger.py`: typed logger with levels and helpers (`log.debug/info/warn/error/trace`)
- `consts.py`: constants, notably `TRADES_JSON_FILE_PATH` used by `save_to_file()`
- `service_response.py`: wrapper struct for service responses
- `text_utils.py`: `dict_keys_to_camel`/`dict_keys_to_snake`

### Migrations: `migrations/`
- Alembic environment: `alembic.ini`, `env.py`, `script.py.mako`, `versions/` with historical migrations
- `migrate_json_trades.py`: migration helper to import legacy JSON trades

### Scripts: `scripts/`
- `create_tables.py`: quick table creation helper (minimal)
- `seed_data.py`: seeds initial data (owners/sources/trades) for local dev

### Environment variables (backend)
- `SECRET_KEY`
- `SQLALCHEMY_DATABASE_URI` (e.g., `mysql://user:pass@host:3306/tradeflow` or `sqlite:///tradeflow.db`)
- `FRONTEND_URL` for CORS allowlist

### Backend run modes
- Java: `mvn spring-boot:run` or packaged jar; Docker Compose for combined app + DB
- Legacy Python (if needed): `python app/main.py` (port 5555) or `flask --app app/main.py run`; production via `gunicorn app.main:app`

---

## Frontend: `tradeflow-frontend/`

### Notable files and purpose
- `package.json`
  - React 19, `react-scripts` 5, MUI v6, React Router v7
  - Scripts use `--openssl-legacy-provider` flag for compat
  - `start`, `build`, `test`, `eject`
- `.env.development.local`
  - Local environment overrides for dev (e.g., API base URL). Verify variable names expected by code (not shown here in `src/`).
- `eslint.config.js`
  - ESLint setup for the project with React rules
- `public/`
  - Static assets and `index.html`
- `src/`
  - `index.js`, `index.css`, `App.js`, `App.css`, `logo.svg`
  - `reportWebVitals.js`, `setupTests.js`, `App.test.js`
  - `components/`:
    - `SummaryPage.jsx` – renders holdings summary, likely calls `/api/holdings` and `/api/holdings-summary`
    - `TradeForm.jsx` – form to submit trades (posts to `/api/trades`), uses owner/source lists
    - `TradesList.jsx` – lists trades from `/api/trades`

### Environment variables (frontend)
- React uses `REACT_APP_*` env prefixed variables. If API base is configurable, expect something like `REACT_APP_API_BASE` in `.env.development.local`. If not present, default calls likely use same-origin or `http://localhost:5555/api`/`http://127.0.0.1:5000/api` depending on code.

### Frontend run
- `npm start` (port 3000 by default). Ensure backend CORS allows `http://localhost:3000`.

---

## API Quick Reference (LLM-useful)
- Base: `/api`
- Trades
  - `POST /api/trades`
    - Body (camelCase, converted server-side):
      - `ticker` (string, uppercased server-side)
      - `transactionType` ('Buy'|'Sell')
      - `quantity` (float)
      - `pricePerUnit` (float)
      - `tradeDate` (YYYY-MM-DD)
      - `tradeOwnerId` (int)
      - `tradeSourceId` (int)
    - Validates owner-source pairing. Creates/updates holding and persists JSON snapshot.
  - `GET /api/trades` – returns list with nested owner/source (camelCase keys)
- Holdings
  - `GET /api/holdings` – list holdings with computed metrics and totals
  - `GET /api/holdings-summary` – aggregated net cost per Owner-Source + overall total
- Stock info
  - `GET /api/stock-info/:ticker` – cached in DB (`LastPriceInfo`) and in provider factory; returns last price, change, %change, market id, provider, lastUpdated
- Owners/Sources
  - `GET /api/trade-owners` – list owners
  - `GET /api/trade-sources` – list sources and associated owners

Notes:
- Responses to frontend are converted to camelCase by utility.
- Route-level caching respects `CACHE_DURATION` from provider factory.

---

## Data and persistence
- DB schema via SQLAlchemy. Migrations in `migrations/` with Alembic.
- Trades may also be appended to a JSON file `utils.consts.TRADES_JSON_FILE_PATH` (path defined in `utils/consts.py`).
- Holdings recompute logic ensures realized PnL stored when a position closes.

## Common pitfalls (LLM)
- Use `create_app()` and `app.main:app` WSGI for production; direct `db.create_all()` is only for local/bootstrap.
- Ensure `owner` belongs to `source` when creating trades; otherwise 400.
- CORS origin list is derived from `FRONTEND_URL` or defaults to `http://localhost:3000`.
- Time handling in price cache is timezone-aware (UTC). Avoid naive datetimes when extending.

## Where to look for specific logic
- Request validation/serialization: `app/schemas.py`
- Business rules for holdings: `services/trade_holdings.py`
- Data queries: `services/db_queries.py`
- Price providers and caching: `services/providers/factory.py` + provider modules
- REST surface: `app/routes/trades.py`

## Extending the system
- Add new providers: implement `BaseFinanceProvider`, register in `ProviderFactory`.
- New fields on trades/holdings: add to `app/models.py`, create Alembic migration, update schemas and frontend components.
- Change persistence: adjust `save_to_file()` or remove if JSON log is not desired.

