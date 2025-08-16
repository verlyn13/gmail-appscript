# UAA Work Account Scripts

## Active Scripts

| Script | ID | Purpose |
|--------|----|---------| 
| Gmail Triage | `1nLhSsknNMLMG7z5-oEOGMdEEZxFmWWflMknW2lq2QXvMDVswg7DupDgT` | Email organization |
| Collector | `1gBLPOg9NYgSzJtz_10Svh_TGOrjdeZTuIhqK1K5pC_mHb2n5D5Reohh7` | Data aggregation |
| Email Automate | `1kgVKABkexh8LmWsJuklNwSpi8rP_LwKIbXxKVXA0oMKDh3KPYiw_w22d` | Workflow automation |
| Directory List | `1g2JiuQG6X7ei8CMDccthOxYL59QgIVFc1XubKPnyPF2f77Fui34CwvWM` | Contact management |

## Setup

```bash
# Switch to UAA account
gcloud-switch alaska-edu

# Clone a script
cd scripts/
clasp clone <script-id>

# Deploy changes
clasp push
```

## Compliance

- 7-year retention policy
- Audit logging enabled
- Domain restrictions: alaska.edu, ua.edu