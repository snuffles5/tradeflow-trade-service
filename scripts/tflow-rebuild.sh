#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${PROJECT_DIR}" || exit 1

function log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

function ensure_docker_running() {
  if ! docker info >/dev/null 2>&1; then
    log "Docker daemon not available. Please start Docker Desktop and retry."
    exit 1
  fi
}

function stop_existing_stack() {
  if docker compose ps --services >/dev/null 2>&1; then
    log "Stopping existing containers..."
    docker compose down
  fi
}

function build_and_test() {
  log "Running mvn clean verify..."
  mvn clean verify
}

function start_stack() {
  log "Starting containers with docker compose up --build..."
  docker compose up --build -d
}

ensure_docker_running
stop_existing_stack
build_and_test
start_stack

log "Rebuild complete. Application running at http://localhost:9090"
