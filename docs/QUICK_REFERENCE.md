# Quick Reference

## Account Switching

```bash
gcloud-switch alaska-edu    # UAA work account
gcloud-switch default        # Personal account
```

## Common Commands

### Clone & Push Scripts
```bash
clasp clone <script-id>      # Download script
clasp push                   # Upload changes
clasp pull                   # Download latest
clasp open                   # Open in browser
```

### Testing
```bash
pnpm test                    # Run tests
pnpm test:watch             # Watch mode
pnpm test:coverage          # Coverage report
```

### Deployment
```bash
./deployment/deploy.sh <account> <script> <env>
# Example: ./deployment/deploy.sh work-uaa gmail-triage production
```

## Script IDs

### UAA Scripts
- Gmail Triage: `1nLhSsknNMLMG7z5-oEOGMdEEZxFmWWflMknW2lq2QXvMDVswg7DupDgT`
- Collector: `1gBLPOg9NYgSzJtz_10Svh_TGOrjdeZTuIhqK1K5pC_mHb2n5D5Reohh7`
- Email Automate: `1kgVKABkexh8LmWsJuklNwSpi8rP_LwKIbXxKVXA0oMKDh3KPYiw_w22d`
- Directory List: `1g2JiuQG6X7ei8CMDccthOxYL59QgIVFc1XubKPnyPF2f77Fui34CwvWM`

## File Locations

- Shared libraries: `/shared/libraries/`
- Account scripts: `/accounts/<account>/scripts/`
- Tests: `/tests/unit/`
- Config: `/config/`