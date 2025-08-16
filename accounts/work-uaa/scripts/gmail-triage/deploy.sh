#!/bin/bash

# Gmail Triage Deployment Script
# Usage: ./deploy.sh [test|production]

set -e

ENV=${1:-test}

echo "=========================================="
echo "Deploying Gmail Triage Script"
echo "Environment: $ENV"
echo "=========================================="

# Ensure we're in the right account
echo "Checking gcloud configuration..."
CURRENT_CONFIG=$(gcloud config get-value account 2>/dev/null || echo "none")
if [[ "$CURRENT_CONFIG" != *"alaska.edu"* ]]; then
    echo "⚠️  Not in UAA account. Running: gcloud-switch alaska-edu"
    gcloud-switch alaska-edu
fi

# Push to Apps Script
echo "Pushing code to Apps Script..."
clasp push

if [ "$ENV" == "production" ]; then
    echo "Creating production deployment..."
    clasp deploy --description "Production deployment $(date +'%Y-%m-%d %H:%M')"
    
    echo ""
    echo "✅ Production deployment complete!"
    echo ""
    echo "Next steps:"
    echo "1. Open script: clasp open"
    echo "2. Verify script properties are set"
    echo "3. Create or verify trigger (every 30 minutes)"
    echo "4. Run setup() if first deployment"
    
elif [ "$ENV" == "test" ]; then
    echo "Test deployment complete."
    echo ""
    echo "To test:"
    echo "1. clasp open"
    echo "2. Run setup() function"
    echo "3. Run processInbox() manually"
    echo "4. Check logs for results"
else
    echo "Unknown environment: $ENV"
    echo "Usage: ./deploy.sh [test|production]"
    exit 1
fi

echo ""
echo "Deployment script finished."