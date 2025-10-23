#!/bin/bash
set -e

# Script to manage deployments on the VPS
# Usage: ./deploy.sh [command] [service] [tag]

COMPOSE_FILE="docker-compose.prod.yml"

# --- Helper Functions ---
check_files() {
  if [ ! -f "$COMPOSE_FILE" ]; then
    echo "Error: Compose file '$COMPOSE_FILE' not found."
    exit 1
  fi
  # .env.prod is loaded by compose, so we don't need to check it here
}

# --- Commands ---
deploy() {
  SERVICE=$1
  TAG=$2

  if [ -z "$SERVICE" ] || [ -z "$TAG" ]; then
    echo "Usage: ./deploy.sh deploy <service_name> <image_tag>"
    echo "Example: ./deploy.sh deploy api feature-my-branch"
    exit 1
  fi

  echo "Deploying service '$SERVICE' with tag '$TAG'..."

  # Set the correct environment variable for the image tag
  local image_var_name
  if [ "$SERVICE" == "api" ]; then
    image_var_name="API_IMAGE_TAG"
  elif [ "$SERVICE" == "web" ]; then
    image_var_name="WEB_IMAGE_TAG"
  else
    echo "Error: Unknown service '$SERVICE'. Use 'api' or 'web'."
    exit 1
  fi

  # Pull the new image first by overriding the tag
  echo "Pulling new image..."
  eval "$image_var_name=$TAG" docker compose -f "$COMPOSE_FILE" pull "$SERVICE"

  # Recreate the service with the new image tag override
  echo "Recreating service..."
  eval "$image_var_name=$TAG" docker compose -f "$COMPOSE_FILE" up -d --force-recreate --no-deps "$SERVICE"

  echo "Deployment of '$SERVICE' with tag '$TAG' complete."
  echo "---"
  status
}

logs() {
  SERVICE=$1
  if [ -z "$SERVICE" ]; then
    docker compose -f "$COMPOSE_FILE" logs -f
  else
    docker compose -f "$COMPOSE_FILE" logs -f "$SERVICE"
  fi
}

status() {
  echo "Current status of services:"
  docker compose -f "$COMPOSE_FILE" ps
  echo ""
  echo "Running image versions:"
  echo "API: $(docker inspect --format='{{.Config.Image}}' tradeflow-api 2>/dev/null || echo 'not running')"
  echo "Web: $(docker inspect --format='{{.Config.Image}}' tradeflow-web 2>/dev/null || echo 'not running')"
}

# --- Main Logic ---
COMMAND=$1
shift # Remove the command from the arguments list

check_files

case "$COMMAND" in
  deploy)
    deploy "$@"
    ;;
  logs)
    logs "$@"
    ;;
  status)
    status
    ;;
  *)
    echo "Usage: $0 {deploy|logs|status} [options]"
    exit 1
    ;;
esac
