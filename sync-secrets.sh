#!/bin/bash

# Exit on error
set -e

# Ensure we are in the script's directory (though typically run from root)
# Let's assume the user runs it from root like ./sync-secrets.sh
cd "$(dirname "$0")"

echo "Syncing secrets to GitHub Repo..."
REPO_NAME=$(gh repo view --json nameWithOwner -q .nameWithOwner)
echo "Target Repo: $REPO_NAME"

# 1. Upload Service Account
if [ -f "server/admin.json" ]; then
    echo "🚀 Uploading FIREBASE_SERVICE_ACCOUNT_FINDER_FOR_FOOOOOD..."
    gh secret set FIREBASE_SERVICE_ACCOUNT_FINDER_FOR_FOOOOOD < server/admin.json
else
    echo "⚠️  Warning: server/admin.json not found. Skipping Service Account."
fi

# 2. Upload SERVER_ENV from server/.env
if [ -f "server/.env" ]; then
    echo "--- server/.env CONTENT START ---"
    cat server/.env
    echo "--- server/.env CONTENT END ---"
    echo "🚀 Uploading SERVER_ENV..."
    gh secret set SERVER_ENV < server/.env
else
    echo "⚠️  Warning: server/.env not found."
fi

# 3. Upload CLIENT_ENV from client/.env.production or client/.env
# Prefer production env if available
CLIENT_ENV_FILE=""
if [ -f "client/.env.production" ]; then
    CLIENT_ENV_FILE="client/.env.production"
elif [ -f "client/.env" ]; then
    CLIENT_ENV_FILE="client/.env"
fi

if [ ! -z "$CLIENT_ENV_FILE" ]; then
    echo "--- $CLIENT_ENV_FILE CONTENT START ---"
    cat "$CLIENT_ENV_FILE"
    echo "--- $CLIENT_ENV_FILE CONTENT END ---"
    echo "🚀 Uploading CLIENT_ENV..."
    gh secret set CLIENT_ENV < "$CLIENT_ENV_FILE"
else
    echo "⚠️  Warning: No client environment file found (client/.env.production or client/.env)."
fi

echo "✅ Secrets sync complete."
