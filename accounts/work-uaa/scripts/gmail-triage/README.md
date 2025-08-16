# Gmail Triage Script

## Overview
Automated email triage system that classifies and organizes inbox emails using historical patterns from the Collector analysis spreadsheet.

## Features
- **VIP Detection**: Automatically stars emails from important senders
- **Rule-based Classification**: Uses historical patterns to label emails
- **Smart Archiving**: Archives emails with high confidence classifications
- **UAA Compliance**: Respects university email retention policies

## Configuration

### Script Properties Required
```
ANALYSIS_SHEET_ID=1OIY5GfzoRGDKgZHXTxf2QvDcXesC3-THSjBGZEunnDY
TRIAGE_VIP_SENDERS=provost@alaska.edu,dean@alaska.edu
TRIAGE_VIP_DOMAINS=alaska.edu,ua.edu
TRIAGE_KEEP_DOMAINS=alaska.edu
```

### Labels Created
- `_Triage/Processed` - Marks processed emails
- `VIP` - High priority senders
- `Students` - Student communications
- `Department` - Department business
- `Meetings` - Meeting requests
- `Newsletters` - Newsletters and marketing

## Deployment

### Initial Setup
```bash
# Switch to UAA account
gcloud-switch alaska-edu

# Navigate to script directory
cd accounts/work-uaa/scripts/gmail-triage/

# Push to Apps Script
clasp push

# Open in browser to configure
clasp open
```

### Configure Script Properties
1. Open script in browser
2. Go to Project Settings → Script Properties
3. Add the required properties listed above
4. Save

### Run Setup Function
1. In Apps Script editor, run `setup()` function
2. This creates all necessary labels

### Create Trigger
1. Go to Triggers (clock icon)
2. Add Trigger:
   - Function: `processInbox`
   - Event: Time-driven
   - Type: Minutes timer
   - Interval: Every 30 minutes

## Usage

### Manual Run
```javascript
processInbox()  // Process inbox emails
```

### Clear Cache
```javascript
clearCache()  // Force reload of historical data
```

## How It Works

1. **Loads Historical Data**: Fetches sender patterns from analysis spreadsheet
2. **Processes Inbox**: Queries unprocessed inbox emails
3. **Classifies Emails**:
   - Checks VIP list
   - Matches historical patterns
   - Falls back to rule-based classification
4. **Takes Action**:
   - Stars VIP emails
   - Labels by category
   - Archives with high confidence
5. **Sends Summary**: Email report for large batches

## Safety Features
- Never processes starred emails
- Skips chat messages
- Respects protected domains
- Rate limiting (100ms pause every 10 emails)
- Maximum 200 emails per run

## Monitoring
- Check logs: View → Logs in Apps Script editor
- Email summaries sent for 20+ processed emails
- All actions logged with emojis for clarity

## Troubleshooting

### Script Not Running
- Check trigger is active
- Verify script properties are set
- Look for errors in logs

### Emails Not Being Processed
- Check SAFE_GUARD_QUERY filters
- Verify labels exist
- Ensure spreadsheet is accessible

### Cache Issues
- Run `clearCache()` to force reload
- Cache expires after 6 hours automatically