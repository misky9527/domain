#!/bin/bash
# Backend start script
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

if [ ! -d "dist" ]; then
  echo "Building TypeScript..."
  npx tsc
fi

node dist/index.js
