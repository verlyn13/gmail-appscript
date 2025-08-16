#!/bin/bash

# Gmail AppScript Deployment Script
# Usage: ./deploy.sh <account> <script> [environment]

set -e

ACCOUNT=$1
SCRIPT=$2
ENV=${3:-development}

if [ -z "$ACCOUNT" ] || [ -z "$SCRIPT" ]; then
    echo "Usage: ./deploy.sh <account> <script> [environment]"
    echo "Accounts: personal-jeffrey, work-uaa, business-happy-patterns, personal-ahniel"
    echo "Environment: development (default), staging, production"
    exit 1
fi

SCRIPT_DIR="accounts/$ACCOUNT/scripts/$SCRIPT"
CONFIG_FILE="config/environments/$ENV.json"

if [ ! -d "$SCRIPT_DIR" ]; then
    echo "Error: Script directory not found: $SCRIPT_DIR"
    exit 1
fi

if [ ! -f "$CONFIG_FILE" ]; then
    echo "Error: Environment config not found: $CONFIG_FILE"
    exit 1
fi

echo "==========================================="
echo "Deploying: $SCRIPT"
echo "Account: $ACCOUNT"
echo "Environment: $ENV"
echo "==========================================="

# Load account configuration
ACCOUNT_CONFIG="accounts/$ACCOUNT/account.json"
if [ ! -f "$ACCOUNT_CONFIG" ]; then
    echo "Error: Account config not found: $ACCOUNT_CONFIG"
    exit 1
fi

# Check for .clasp.json in script directory
if [ ! -f "$SCRIPT_DIR/.clasp.json" ]; then
    echo "Error: .clasp.json not found. Run 'clasp create' first."
    exit 1
fi

cd "$SCRIPT_DIR"

# Pull latest version from Apps Script
echo "Pulling latest version..."
clasp pull

# Run tests if they exist
if [ -f "test.js" ]; then
    echo "Running tests..."
    pnpm test || { echo "Tests failed!"; exit 1; }
fi

# Push to Apps Script
echo "Pushing to Apps Script..."
clasp push

# Deploy based on environment
if [ "$ENV" == "production" ]; then
    echo "Creating production deployment..."
    clasp deploy --description "Production deployment $(date)"
else
    echo "Creating $ENV deployment..."
    clasp deploy --description "$ENV deployment $(date)"
fi

# Show deployment info
echo "Deployment complete!"
clasp deployments

cd - > /dev/null

echo "==========================================="
echo "Deployment successful!"
echo "==========================================="