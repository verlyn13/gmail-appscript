# Gmail Triage Setup Instructions

## ✅ Prerequisites Complete
- gcloud configuration: alaska-edu
- Application Default Credentials: Fixed
- Script pushed to Apps Script

## 🚀 Final Setup Steps

### 1. Open Script in Browser
Click the link or copy to browser:
https://script.google.com/d/1nLhSsknNMLMG7z5-oEOGMdEEZxFmWWflMknW2lq2QXvMDVswg7DupDgT/edit

### 2. Configure Script Properties
1. Go to **Project Settings** (gear icon on left)
2. Scroll to **Script Properties**
3. Click **Add Script Property**
4. Add these properties:

| Property | Value |
|----------|-------|
| ANALYSIS_SHEET_ID | 1OIY5GfzoRGDKgZHXTxf2QvDcXesC3-THSjBGZEunnDY |
| TRIAGE_VIP_SENDERS | provost@alaska.edu,dean@alaska.edu |
| TRIAGE_VIP_DOMAINS | alaska.edu,ua.edu |
| TRIAGE_KEEP_DOMAINS | alaska.edu |

5. Click **Save script properties**

### 3. Run Initial Setup
1. Go to **Editor** (< > icon)
2. In the function dropdown, select `setup`
3. Click **Run**
4. Authorize when prompted
5. Check execution log for success

### 4. ⚠️ CRITICAL: Test Before Production

#### Step 1: Verify Intelligence Loading
```javascript
testIntelligenceLoading()
// Should show sender/keyword counts from spreadsheet
```

#### Step 2: Dry Run Test (SAFE - No changes)
```javascript
testDryRun()
// Shows what WOULD happen to 5 recent emails
// Review actions carefully
```

#### Step 3: Preview Mode Test
1. Add script property: `TRIAGE_PREVIEW_MODE` = `true`
2. Run `processInbox()`
3. Check emails with `_Triage/PREVIEW-` labels
4. Run `clearPreviewLabels()` to clean up

#### Step 4: Small Production Test
1. Remove `TRIAGE_PREVIEW_MODE` property
2. Add `TRIAGE_MAX_PER_RUN` = `10`
3. Run `processInbox()`
4. Verify results

#### Step 5: Full Production
1. Set `TRIAGE_MAX_PER_RUN` = `50` (or higher)
2. Remove `TRIAGE_DRY_RUN` if set

### 5. Create Automated Trigger (ONLY AFTER TESTING)
1. Click **Triggers** (clock icon on left)
2. Click **+ Add Trigger**
3. Configure:
   - Function: `processInbox`
   - Event source: Time-driven
   - Type: Minutes timer
   - Interval: Every 30 minutes
4. Click **Save**

## 📊 Monitoring

### Check Logs
- View → Execution log (in editor)
- Or: `clasp tail-logs` from terminal

### Email Summaries
- Automatically sent when 20+ emails processed
- Sent to: jjohnson47@alaska.edu

## 🛠️ Troubleshooting

### If emails aren't processing:
```javascript
// Run in Apps Script editor
clearCache();  // Clear cached data
setup();       // Recreate labels
processInbox(); // Try manual run
```

### Check spreadsheet access:
https://docs.google.com/spreadsheets/d/1OIY5GfzoRGDKgZHXTxf2QvDcXesC3-THSjBGZEunnDY/

## ✨ Ready!
Once the trigger is set, the script will automatically:
- Process inbox every 30 minutes
- Star VIP emails
- Label by category (Students, Department, Meetings, etc.)
- Archive with high confidence
- Send summaries for large batches