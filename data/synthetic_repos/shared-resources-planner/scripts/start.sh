#!/usr/bin/env bash
# Starts the Shared Resources Planner. Double-click-friendly on macOS/Linux
# (or run `./scripts/start.sh` from a terminal).
set -euo pipefail

# Resolve the project root regardless of where this script is invoked from.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed. Install it from https://nodejs.org/ (LTS version) and try again."
  exit 1
fi

if [ ! -d "node_modules" ]; then
  echo "Installing dependencies (first run only)..."
  npm install
fi

echo "Starting Shared Resources Planner..."
npm start
