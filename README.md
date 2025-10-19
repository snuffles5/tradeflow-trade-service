# TradeFlow Backend (Spring Boot)

This is the Spring Boot backend for the TradeFlow application.

## Prerequisites

- Java 21
- Maven 3.8+
- Docker & Docker Compose

## Getting Started

1.  **Create a `.env` file**

    Copy the contents of `.env.example` to a new file named `.env` and fill in the values for your local environment. The sample file contains the database credentials required by `docker-compose.yml` and by Spring Boot when running locally without Docker.

2.  **Build the application**

    ```bash
    mvn clean install
    ```

3.  **Run the application**

    You can run the application in two ways:

    -   **Using Docker Compose (recommended):**

        This will start both the application and a MySQL database.

        ```bash
        docker-compose up --build
        ```

    -   **Running the Spring Boot application directly:**

        Make sure you have a MySQL database running and have configured the connection details in your `.env` file.

        ```bash
        mvn spring-boot:run
        ```

4.  **Access the application**

    The application will be available at `http://localhost:9090`.

    * __Health check__: `http://localhost:9090/` or `http://localhost:9090/health`
    * __API documentation__: `http://localhost:9090/swagger-ui.html`

## Running Tests

To run the tests, execute the following command:

```bash
mvn test
```

## Container Images & GHCR

1.  **Local build**

    Build the image with Docker when testing locally:

    ```bash
    docker build -t tradeflow-trade-service:local .
    ```

2.  **GitHub Actions workflows**

    * __`docker-build.yml`__ (`.github/workflows/docker-build.yml`) verifies that the Docker image builds successfully on pushes and pull requests.
    * __`build-push.yml`__ (`.github/workflows/build-push.yml`) builds and pushes the image to GHCR on pushes to `main`, tags starting with `v`, or manual dispatches. Images are tagged automatically from branch, tag, and commit SHA metadata.

3.  **GHCR naming & authentication**

    * Images are published to `ghcr.io/<github-owner>/tradeflow-trade-service` as required by GHCR naming conventions. By default the workflow uses the repository owner for the namespace.
    * GitHub Actions authenticates with GHCR using `${{ secrets.GITHUB_TOKEN }}`—no Personal Access Token (PAT) is required.
    * To pull from outside GitHub (for example on a production server), create a Classic PAT with `read:packages` (and `write:packages` if you also push). On the server, log in:

      ```bash
      echo YOUR_PAT | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
      ```

4.  **Pulling the image**

    Once pushed, pull the image with:

    ```bash
    docker pull ghcr.io/<github-owner>/tradeflow-trade-service:<tag>
    ```

    Replace `<github-owner>` with your GitHub username or organization and `<tag>` with the desired tag (branch, tag, or SHA).

## Rebuild & Reload Stack

Use the helper script in `scripts/tflow-rebuild.sh` to rebuild the project and restart containers:

```bash
./scripts/tflow-rebuild.sh
```

The script will:

- __Clean & verify__: `mvn clean verify`
- __Recycle containers__: `docker compose down`
- __Rebuild & restart__: `docker compose up --build -d`

Make sure Docker Desktop is running before executing.

## Database Access

Use the credentials in `.env` to connect from IntelliJ/Datagrip or any MySQL client while the Docker compose stack is running:

* __Host__: `127.0.0.1`
* __Port__: value of `DB_PORT` (default `3306`)
* __Database__: value of `DB_NAME`
* __User__: value of `DB_USER` (default `admin@snuffles.com`)
* __Password__: value of `DB_PASSWORD`

If connection fails, verify the containers are up (`docker compose ps`) and no other MySQL instance is bound to the same port. You can also connect as root with the password in `DB_ROOT_PASSWORD` when needed.

## Seed Data

`DataSeedingService` (`src/main/java/com/snuffles/tradeflow/seeding/DataSeedingService.java`) runs automatically on application startup. It loads `src/main/resources/seed-data.json` and inserts owners, sources, and trades through `TradeService` when the database is empty (`trade_owner` table count is zero).

* If the database already contains owners, seeding is skipped. To force reseeding, stop the stack and remove the database volume: `docker compose down -v && ./scripts/tflow-rebuild.sh`.
* Adjust seed data by editing `seed-data.json`; keep dates in `MM/dd/yyyy` format.
* For production deployments, gate the seeder behind an environment profile or disable it entirely.
# tradeflow-trade-service
