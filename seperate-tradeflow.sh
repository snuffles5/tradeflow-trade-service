#!/usr/bin/env bash
set -euo pipefail

BACKEND_SERVICE_NAME="tradeflow-trade-service"
FRONTEND_REPO_NAME="tradeflow-web-client"

REPO_ROOT="$(pwd)"                                   # existing mono repo
PARENT_DIR="$(dirname "$REPO_ROOT")"

# 1. ensure clean working tree
git status --short
read -r -p "Working tree must be clean. Continue? [y/N] " CONFIRM
[[ "$CONFIRM" =~ ^[Yy]$ ]] || exit 1

# 2. move frontend out to a future repo location
mv "$REPO_ROOT/tradeflow-frontend" "$PARENT_DIR/$FRONTEND_REPO_NAME"

# 3. lift backend contents into repo root
rsync -a --remove-source-files "$REPO_ROOT/tradeflow-backend/" "$REPO_ROOT/"
find "$REPO_ROOT/tradeflow-backend" -type d -empty -delete
rm -rf "$REPO_ROOT/tradeflow-backend"

# 4. rename repo directory to match backend service
mv "$REPO_ROOT" "$PARENT_DIR/$BACKEND_SERVICE_NAME"

cd "$PARENT_DIR/$BACKEND_SERVICE_NAME"
git status
echo "Backend now lives at: $PARENT_DIR/$BACKEND_SERVICE_NAME"
echo "Frontend moved to:    $PARENT_DIR/$FRONTEND_REPO_NAME"