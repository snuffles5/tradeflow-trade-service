# Remote Deployment Guide

This directory contains the assets required to run the TradeFlow backend on a remote host using Docker Compose.

## Prerequisites

1. Install Docker Engine and the Docker Compose plugin on the host.
2. Ensure the deploying user can run `docker` commands (e.g., belongs to the `docker` group).
3. Open the ports you plan to expose, typically `80/443` or the value specified in `APP_PORT`.
4. Confirm outbound access to `ghcr.io` and inbound SSH access for deployments.

## Secrets and Configuration

1. Copy `.env.example` to `.env` and set values for the environment. Keep this file on the server only.
2. Override `APP_IMAGE` if you need a tag other than the default `latest`.
3. Set database credentials and any additional Spring profiles or secrets.

## GHCR Authentication

If the GHCR package is private, log into the registry using a Personal Access Token with `read:packages` scope:

```bash
echo "$GHCR_PAT" | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
```

## Deployment

```bash
# Fetch the latest images
docker compose pull

# Start services in the background
docker compose up -d
```

The services are defined in `docker-compose.yml`. It waits for the database to become healthy before starting the application.

## Updating

For subsequent releases:

```bash
cd /opt/tradeflow

git pull # if this directory is under version control
docker compose pull
docker compose up -d
```

Docker will restart containers with the updated image tags while preserving volumes such as `db_data`.
