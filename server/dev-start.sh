#!/bin/bash
export JWT_SECRET="dev-jwt-secret-for-local-dev-only-do-not-use-in-production"
export ENCRYPTION_KEY="dev-encryption-key-for-local-dev-only-2026"
exec node dist/index.js
