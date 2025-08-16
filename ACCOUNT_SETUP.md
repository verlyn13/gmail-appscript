# Account Setup & Management Guide

## Current Account Configuration

### Active Google Accounts

| Account | Email | gcloud Config | Project | Status |
|---------|-------|---------------|---------|--------|
| Personal | jeffreyverlynjohnson@gmail.com | `personal` | gcloud-management-202508 | ✅ Configured |
| Work/UAA | jjohnson47@alaska.edu | `alaska-edu` | gmail-organizer-469202 | ✅ Configured |
| Business | jeffrey@happy-patterns.com | - | - | ❌ Not configured |
| Family | ahnielitecky@gmail.com | - | - | ❌ Not configured |

## Account Switching

### Using gcloud-switch Helper
```bash
# Interactive menu
gcloud-switch

# Direct switch
gcloud-switch personal      # Personal account
gcloud-switch alaska-edu    # University account

# Add new account
gcloud-switch add
```

### Manual Switching
```bash
# List configurations
gcloud config configurations list

# Switch configuration
gcloud config configurations activate alaska-edu

# Verify current account
gcloud config get-value account
```

## Work Account (UAA) - jjohnson47@alaska.edu

### Configuration Details
- **Organization**: University of Alaska Anchorage
- **Domain**: alaska.edu
- **Project**: gmail-organizer-469202
- **Restrictions**: Managed by organization policies

### Available Apps Script Projects
1. **Gmail Triage** (`1nLhSsknNMLMG7z5-oEOGMdEEZxFmWWflMknW2lq2QXvMDVswg7DupDgT`)
   - Purpose: Email organization and triage
   - Status: Active
   
2. **Collector** (`1gBLPOg9NYgSzJtz_10Svh_TGOrjdeZTuIhqK1K5pC_mHb2n5D5Reohh7`)
   - Purpose: Data collection and aggregation
   - Status: Active

3. **Email Automate** (`1kgVKABkexh8LmWsJuklNwSpi8rP_LwKIbXxKVXA0oMKDh3KPYiw_w22d`)
   - Purpose: Email automation workflows
   - Status: Active

4. **Directory List** (`1g2JiuQG6X7ei8CMDccthOxYL59QgIVFc1XubKPnyPF2f77Fui34CwvWM`)
   - Purpose: Directory and contact management
   - Status: Active

### Working with UAA Scripts
```bash
# Switch to UAA account
gcloud-switch alaska-edu

# Verify clasp is using correct account
clasp logout
clasp login

# List available scripts
clasp list

# Clone a specific script
cd accounts/work-uaa/scripts/
mkdir gmail-triage && cd gmail-triage
clasp clone 1nLhSsknNMLMG7z5-oEOGMdEEZxFmWWflMknW2lq2QXvMDVswg7DupDgT
```

## Personal Account - jeffreyverlynjohnson@gmail.com

### Configuration Details
- **Project**: gcloud-management-202508
- **Purpose**: Managing gcloud configurations and personal projects
- **Full Access**: No organizational restrictions

### Setup Commands
```bash
# Switch to personal account
gcloud-switch personal

# Work with personal scripts
cd accounts/personal-jeffrey/scripts/
```

## Setting Up Additional Accounts

### Business Account (jeffrey@happy-patterns.com)
```bash
# Create configuration
gcloud config configurations create happy-patterns --account=jeffrey@happy-patterns.com

# Authenticate
gcloud auth login jeffrey@happy-patterns.com

# Set project (if available)
gcloud projects list
gcloud config set project <project-id>

# Setup clasp
clasp logout
clasp login
```

### Family Account (ahnielitecky@gmail.com)
```bash
# Create configuration
gcloud config configurations create personal-ahniel --account=ahnielitecky@gmail.com

# Authenticate with restricted scopes
gcloud auth login ahnielitecky@gmail.com

# Note: Requires consent for any operations
```

## Directory Structure for Accounts

```
accounts/
├── work-uaa/
│   ├── account.json         # Account metadata
│   ├── scripts/
│   │   ├── gmail-triage/    # Cloned from Apps Script
│   │   ├── collector/       # Cloned from Apps Script
│   │   ├── email-automate/  # Cloned from Apps Script
│   │   └── directory-list/  # Cloned from Apps Script
│   ├── config/              # Account-specific config
│   ├── filters/             # Email filters
│   └── templates/           # Email templates
│
├── personal-jeffrey/
│   ├── account.json
│   ├── scripts/
│   ├── config/
│   ├── filters/
│   └── templates/
│
├── business-happy-patterns/
│   └── [To be configured]
│
└── personal-ahniel/
    └── [To be configured]
```

## Account Metadata (account.json)

### Example for UAA Account
```json
{
  "email": "jjohnson47@alaska.edu",
  "name": "Jeffrey Johnson - UAA",
  "type": "work",
  "organization": "University of Alaska Anchorage",
  "domain": "alaska.edu",
  "restrictions": {
    "managed": true,
    "retentionYears": 7,
    "auditLogging": true,
    "externalServices": false
  },
  "projects": {
    "primary": "gmail-organizer-469202",
    "available": [
      "fluent-horizon-281415",
      "gmail-organizer-469202",
      "rosy-clover-281419"
    ]
  },
  "scripts": {
    "gmail-triage": {
      "id": "1nLhSsknNMLMG7z5-oEOGMdEEZxFmWWflMknW2lq2QXvMDVswg7DupDgT",
      "purpose": "Email organization and triage",
      "lastUpdated": "2024-12-16"
    },
    "collector": {
      "id": "1gBLPOg9NYgSzJtz_10Svh_TGOrjdeZTuIhqK1K5pC_mHb2n5D5Reohh7",
      "purpose": "Data collection",
      "lastUpdated": "2024-12-16"
    },
    "email-automate": {
      "id": "1kgVKABkexh8LmWsJuklNwSpi8rP_LwKIbXxKVXA0oMKDh3KPYiw_w22d",
      "purpose": "Email automation",
      "lastUpdated": "2024-12-16"
    },
    "directory-list": {
      "id": "1g2JiuQG6X7ei8CMDccthOxYL59QgIVFc1XubKPnyPF2f77Fui34CwvWM",
      "purpose": "Directory management",
      "lastUpdated": "2024-12-16"
    }
  },
  "credentials": {
    "clasp": "~/.clasprc-alaska.json",
    "gcloud": "alaska-edu"
  }
}
```

## Authentication Flow

### Initial Setup
1. Create gcloud configuration
2. Authenticate with gcloud
3. Set default project
4. Login with clasp
5. Verify access to scripts

### Daily Workflow
1. Check current account: `gcloud config get-value account`
2. Switch if needed: `gcloud-switch <config>`
3. Work with scripts: `clasp push/pull`
4. Deploy changes: `clasp deploy`

## Troubleshooting

### Issue: Wrong Account Active
```bash
# Check current
gcloud config list
clasp status

# Fix
gcloud-switch <correct-config>
clasp logout && clasp login
```

### Issue: Permission Denied
```bash
# For UAA account - check organizational policies
# May need to request access from IT admin

# For personal accounts - re-authenticate
gcloud auth login
clasp login
```

### Issue: Can't See Scripts
```bash
# Ensure correct account
clasp logout
clasp login

# List available scripts
clasp list

# If empty, check account has Apps Script projects
```

## Security Notes

### UAA Account Restrictions
- Cannot access external (non-Google) services
- All activities are audited
- 7-year data retention policy applies
- Some APIs may require admin approval

### Personal Account Best Practices
- Use for personal projects only
- Don't mix with work data
- Regular credential rotation

### Credential Storage
- gcloud credentials: `~/.config/gcloud/`
- clasp credentials: `~/.clasprc.json` (default)
- Custom clasp: `~/.clasprc-<account>.json`

## Quick Commands Reference

```bash
# Check current account
gcloud config get-value account

# Switch accounts
gcloud-switch              # Interactive
gcloud-switch personal     # Personal
gcloud-switch alaska-edu   # UAA

# Work with scripts
clasp list                 # List all scripts
clasp clone <id>           # Clone script
clasp push                 # Upload changes
clasp pull                 # Download changes
clasp open                  # Open in browser
clasp logs --watch         # Monitor logs

# Project navigation
cd ~/Projects/verlyn13/gmail-appscript/accounts/work-uaa/scripts/
```