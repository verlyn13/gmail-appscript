# CLASP (Command Line Apps Script) Complete Guide

## Overview
CLASP is Google's official command-line tool for developing and managing Apps Script projects locally. It enables version control, local development, and automated deployments.

## Installation & Setup

### Global Installation
```bash
# Install via npm (already completed)
npm install -g @google/clasp

# Verify installation
clasp --version
```

### Authentication

#### Initial Login
```bash
# Default login (saves to ~/.clasprc.json)
clasp login

# Login with specific credentials file
clasp login --creds ~/.clasprc-alaska.json

# Login without launching browser
clasp login --no-localhost
```

#### Account Switching
```bash
# Switch gcloud configuration first
gcloud-switch alaska-edu  # or: gcloud config configurations activate alaska-edu

# Then use clasp with that account's credentials
clasp login  # Will use the active gcloud account
```

## Core Commands

### Project Management

#### List Projects
```bash
# List all Apps Script projects for current account
clasp list

# Current UAA account projects:
# 1. Gmail Triage - 1nLhSsknNMLMG7z5-oEOGMdEEZxFmWWflMknW2lq2QXvMDVswg7DupDgT
# 2. Collector - 1gBLPOg9NYgSzJtz_10Svh_TGOrjdeZTuIhqK1K5pC_mHb2n5D5Reohh7
# 3. Email Automate - 1kgVKABkexh8LmWsJuklNwSpi8rP_LwKIbXxKVXA0oMKDh3KPYiw_w22d
# 4. Directory List - 1g2JiuQG6X7ei8CMDccthOxYL59QgIVFc1XubKPnyPF2f77Fui34CwvWM
```

#### Create New Project
```bash
# Create standalone script
clasp create --title "My New Script" --type standalone

# Create bound script types
clasp create --title "Sheet Script" --type sheets
clasp create --title "Doc Script" --type docs
clasp create --title "Form Script" --type forms
clasp create --title "Slide Script" --type slides

# Create web app
clasp create --title "Web App" --type webapp

# Create API executable
clasp create --title "API Script" --type api

# Create in specific folder
clasp create --title "My Script" --rootDir ./src
```

#### Clone Existing Project
```bash
# Clone by script ID
clasp clone <scriptId>

# Clone with specific version
clasp clone <scriptId> --versionNumber 2

# Clone to specific directory
clasp clone <scriptId> --rootDir ./my-script
```

### Development Workflow

#### Open in Browser
```bash
# Open script editor
clasp open

# Open specific deployment
clasp open --webapp
clasp open --deploymentId <id>
```

#### Push Changes
```bash
# Push all files
clasp push

# Push and watch for changes
clasp push --watch

# Force push (overwrites remote)
clasp push --force
```

#### Pull Changes
```bash
# Pull from remote
clasp pull

# Pull specific version
clasp pull --versionNumber 3
```

#### Status Check
```bash
# Check if logged in
clasp status

# Show current script ID
clasp status --json
```

### File Management

#### Project Configuration (.clasp.json)
```json
{
  "scriptId": "1nLhSsknNMLMG7z5-oEOGMdEEZxFmWWflMknW2lq2QXvMDVswg7DupDgT",
  "rootDir": "./src",
  "fileExtension": "js",
  "filePushOrder": ["src/utils.js", "src/main.js"],
  "ignoredFiles": ["**/*.test.js", "node_modules/**"]
}
```

#### Ignored Files (.claspignore)
```
# Similar to .gitignore
node_modules/**
*.test.js
.env
**/*.md
```

### Deployment & Versions

#### Create Version
```bash
# Create new version
clasp version "Initial release"

# List all versions
clasp versions
```

#### Deploy Script
```bash
# Create new deployment
clasp deploy --description "Production deployment"

# Deploy specific version
clasp deploy --versionNumber 3 --description "v3 deployment"

# Deploy as web app
clasp deploy --deploymentId <id>

# List all deployments
clasp deployments

# Undeploy
clasp undeploy <deploymentId>
```

### Execution & Testing

#### Run Functions
```bash
# Run a function
clasp run myFunction

# Run with parameters
clasp run myFunction --params '["param1", "param2"]'

# Run in development mode
clasp run myFunction --dev
```

#### View Logs
```bash
# Stream logs (real-time)
clasp logs

# View recent logs
clasp logs --json

# Watch logs continuously
clasp logs --watch

# Simplified output
clasp logs --simplified
```

### Advanced Features

#### API Management
```bash
# Enable/disable APIs
clasp apis enable drive
clasp apis disable gmail

# List enabled APIs
clasp apis list

# Open API console
clasp apis --open
```

#### Settings
```bash
# Set project settings
clasp setting scriptId <newId>
clasp setting rootDir ./src

# Reset authentication
clasp logout
clasp login --creds ~/.clasprc-custom.json
```

## Working with Multiple Accounts

### Account Structure
```bash
accounts/
├── personal-jeffrey/      # jeffreyverlynjohnson@gmail.com
├── work-uaa/              # jjohnson47@alaska.edu (CURRENT)
├── business-happy-patterns/ # jeffrey@happy-patterns.com
└── personal-ahniel/       # ahnielitecky@gmail.com
```

### Switching Between Accounts
```bash
# 1. Switch gcloud configuration
gcloud-switch alaska-edu    # for jjohnson47@alaska.edu
gcloud-switch personal       # for jeffreyverlynjohnson@gmail.com

# 2. Ensure clasp is using correct account
clasp logout
clasp login

# 3. Work in appropriate account directory
cd accounts/work-uaa/scripts/
```

### Per-Account Credentials
```bash
# Store separate credentials
~/.clasprc.json              # Default/personal
~/.clasprc-alaska.json       # UAA work account
~/.clasprc-business.json    # Business account

# Use specific credentials
export CLASP_CREDENTIALS=~/.clasprc-alaska.json
clasp list
```

## Integration with Existing Scripts

### Gmail Triage Script
```bash
# Clone and set up
mkdir -p accounts/work-uaa/scripts/gmail-triage
cd accounts/work-uaa/scripts/gmail-triage
clasp clone 1nLhSsknNMLMG7z5-oEOGMdEEZxFmWWflMknW2lq2QXvMDVswg7DupDgT

# Work on it locally
code .  # Open in editor

# Deploy changes
clasp push
clasp deploy --description "Updated triage rules"
```

### Email Automate Script
```bash
# Clone and set up
mkdir -p accounts/work-uaa/scripts/email-automate
cd accounts/work-uaa/scripts/email-automate
clasp clone 1kgVKABkexh8LmWsJuklNwSpi8rP_LwKIbXxKVXA0oMKDh3KPYiw_w22d

# Make changes and test
clasp push
clasp run testFunction
clasp logs --watch
```

## Project Structure Best Practices

### Recommended Directory Layout
```
script-name/
├── .clasp.json          # Clasp configuration
├── .claspignore         # Files to ignore
├── appsscript.json      # Apps Script manifest
├── src/
│   ├── Code.js          # Main script file
│   ├── Utils.js         # Utility functions
│   └── Config.js        # Configuration
├── test/
│   └── test.js          # Local tests
└── README.md            # Documentation
```

### Apps Script Manifest (appsscript.json)
```json
{
  "timeZone": "America/Anchorage",
  "dependencies": {
    "enabledAdvancedServices": [
      {
        "userSymbol": "Gmail",
        "version": "v1",
        "serviceId": "gmail"
      },
      {
        "userSymbol": "Drive",
        "version": "v2",
        "serviceId": "drive"
      }
    ]
  },
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8",
  "webapp": {
    "executeAs": "USER_DEPLOYING",
    "access": "MYSELF"
  }
}
```

## TypeScript Support

### Setup TypeScript
```bash
# Install TypeScript and types
npm install -D typescript @types/google-apps-script

# Create tsconfig.json
{
  "compilerOptions": {
    "target": "ES2019",
    "module": "None",
    "lib": ["ES2019"],
    "types": ["google-apps-script"]
  }
}

# Use .ts extension
clasp create --title "TS Script" --rootDir ./src --type standalone
```

### Push TypeScript Files
```bash
# Clasp automatically transpiles .ts to .gs
clasp push

# Watch mode with TypeScript
clasp push --watch
```

## Troubleshooting

### Common Issues

#### Authentication Problems
```bash
# Reset authentication
clasp logout
rm ~/.clasprc.json
clasp login

# Check current auth
clasp status
```

#### Permission Errors
```bash
# Ensure correct OAuth scopes
clasp login --creds creds.json --scopes "https://www.googleapis.com/auth/script.projects https://www.googleapis.com/auth/drive"
```

#### Push/Pull Conflicts
```bash
# Force push (careful!)
clasp push --force

# Pull and merge manually
clasp pull
# Resolve conflicts in editor
clasp push
```

### Debug Mode
```bash
# Enable verbose output
export CLASP_DEBUG=true
clasp push

# Check logs
clasp logs --watch --simplified
```

## CI/CD Integration

### GitHub Actions Example
```yaml
name: Deploy Apps Script
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup Node
        uses: actions/setup-node@v2
        with:
          node-version: '18'
          
      - name: Install clasp
        run: npm install -g @google/clasp
        
      - name: Setup credentials
        run: echo "${{ secrets.CLASP_CREDS }}" > ~/.clasprc.json
        
      - name: Deploy
        run: |
          cd accounts/work-uaa/scripts/gmail-triage
          clasp push
          clasp deploy --description "Auto-deploy from GitHub"
```

## Security Considerations

### For University Account (jjohnson47@alaska.edu)
- **Restricted Scopes**: Only approved Google Workspace APIs
- **Audit Logging**: All operations are logged by organization
- **Data Retention**: Follow 7-year retention policy
- **No External Services**: Cannot connect to non-Google services
- **Approval Required**: Some APIs may need admin approval

### Best Practices
1. Never commit `.clasprc.json` files
2. Use environment variables for sensitive data
3. Implement proper error handling
4. Test in development before production
5. Use version control for all scripts
6. Document all deployments

## Quick Reference

```bash
# Essential commands
clasp login                          # Authenticate
clasp list                           # List all scripts
clasp create --title "Name"          # Create new
clasp clone <id>                     # Clone existing
clasp push                           # Upload changes
clasp pull                           # Download changes
clasp open                           # Open in browser
clasp deploy                         # Create deployment
clasp run <function>                 # Execute function
clasp logs --watch                   # View logs
clasp status                         # Check status
clasp logout                         # Sign out

# Account switching
gcloud-switch alaska-edu             # Switch to UAA
gcloud-switch personal               # Switch to personal
clasp logout && clasp login          # Re-authenticate
```

## Resources

- [Official CLASP Documentation](https://github.com/google/clasp)
- [Apps Script Reference](https://developers.google.com/apps-script/reference)
- [Google Workspace APIs](https://developers.google.com/workspace)
- [Apps Script Samples](https://github.com/googleworkspace/apps-script-samples)