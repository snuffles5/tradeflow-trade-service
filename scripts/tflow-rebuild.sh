#!/usr/bin/env bash
set -euo pipefail

RESET_DB=false

function usage() {
  cat <<'EOF'
Usage: ./scripts/tflow-rebuild.sh [options]

Options:
  --reset-db    Drop the MySQL data volume before rebuilding (requires double confirmation).
  -h, --help    Show this help message.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --reset-db)
      RESET_DB=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      usage
      exit 1
      ;;
  esac
done

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

function confirm_reset_db() {
  log "WARNING: --reset-db will DROP all data in the MySQL volume. This cannot be undone."
  read -r -p "Type 'DROP' to continue: " first_confirmation
  if [[ "${first_confirmation}" != "DROP" ]]; then
    log "Confirmation failed. Aborting rebuild."
    exit 1
  fi

  log "Confirmation received. Proceeding with database reset."
}

function stop_existing_stack() {
  log "Stopping existing containers..."
  if [[ "${RESET_DB}" == true ]]; then
    log "Dropping MySQL data volume as part of reset..."
    docker compose down --volumes
  else
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

if [[ "${RESET_DB}" == true ]]; then
  confirm_reset_db
fi

stop_existing_stack
build_and_test
start_stack

log "Rebuild complete. Application running at http://localhost:9090"
