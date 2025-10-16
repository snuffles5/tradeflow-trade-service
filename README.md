# TradeFlow Backend (Spring Boot)

This is the Spring Boot backend for the TradeFlow application.

## Prerequisites

- Java 21
- Maven 3.8+
- Docker & Docker Compose

## Getting Started

1.  **Create a `.env` file**

    Copy the contents of `.env.example` to a new file named `.env` and fill in the values for your local environment.

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

    You can view the API documentation at `http://localhost:9090/swagger-ui.html`.

## Running Tests

To run the tests, execute the following command:

```bash
mvn test
```

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
# tradeflow-trade-service
