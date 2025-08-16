# Gmail AppScript Architecture

## Design Principles

### 1. Account Isolation
Each account operates independently with its own:
- Configuration and permissions
- Script implementations
- Filter rules and labels
- Audit trails and logs

### 2. Code Reusability
Shared libraries provide common functionality:
- Gmail operations (search, label, archive)
- Filter building and management
- Logging and monitoring
- Error handling and retries

### 3. Security & Compliance

#### Personal Accounts
- Full automation capabilities
- Flexible filtering and processing
- Personal preference driven

#### Work Account (UAA)
- Strict retention policies (7 years)
- Audit logging for all operations
- Domain-based restrictions
- Approval workflows for sensitive operations

#### Business Account (Happy Patterns)
- CRM integration points
- Client data protection
- Invoice and payment processing
- Lead management workflows

#### Family Account (Ahniel)
- Consent-based management
- Operation restrictions (no delete/forward)
- Shared label system with privacy controls
- Activity logging for transparency

## Technical Architecture

### Directory Structure
```
accounts/
  [account-name]/
    account.json         # Account metadata and configuration
    scripts/            # Account-specific scripts
      [script-name]/
        Code.js         # Main script file
        Config.js       # Script configuration
        .clasp.json     # Apps Script project link
    filters/            # Filter definitions
    templates/          # Email templates
    config/            # Account-specific configs
```

### Shared Libraries Architecture
```
shared/
  libraries/           # Reusable code modules
    GmailUtils.js     # Core Gmail operations
    FilterBuilder.js  # Filter creation utilities
    LabelManager.js   # Label organization
  utilities/          # Helper functions
    Logger.js        # Logging framework
    Retry.js         # Retry logic
    Validator.js     # Input validation
  templates/         # Shared templates
  types/            # TypeScript definitions
```

## Data Flow

### Script Execution Flow
1. **Trigger** → Time-based or event-based trigger fires
2. **Initialize** → Load configuration and setup logger
3. **Authenticate** → Verify permissions for account
4. **Process** → Execute main logic with error handling
5. **Log** → Record operations and results
6. **Notify** → Send summaries or alerts as configured

### Error Handling Strategy
```javascript
try {
  // Main operation
} catch (error) {
  logger.error('Operation failed', error);
  
  if (isRetryable(error)) {
    return retry(operation, config.retryAttempts);
  }
  
  if (isCritical(error)) {
    notifyAdmin(error);
  }
  
  throw error;
}
```

## Integration Points

### External Services
- **Google Workspace APIs**: Gmail, Drive, Calendar
- **CRM Systems**: HubSpot, Salesforce
- **Accounting**: QuickBooks, FreshBooks
- **Analytics**: Custom dashboards, reporting

### Webhook Support
```javascript
function doPost(e) {
  const payload = JSON.parse(e.postData.contents);
  
  // Route to appropriate handler
  switch(payload.type) {
    case 'client_email':
      return handleClientEmail(payload);
    case 'invoice':
      return handleInvoice(payload);
    default:
      return handleGeneric(payload);
  }
}
```

## Performance Optimization

### Batch Processing
- Process emails in configurable batch sizes
- Implement pagination for large result sets
- Use Gmail API batch requests where possible

### Caching Strategy
- Cache frequently accessed labels
- Store processed message IDs to avoid reprocessing
- Implement time-based cache invalidation

### Rate Limiting
- Respect Gmail API quotas
- Implement exponential backoff
- Track daily quota usage

## Monitoring & Observability

### Logging Levels
- **ERROR**: Critical failures requiring immediate attention
- **WARN**: Issues that should be investigated
- **INFO**: Normal operational messages
- **DEBUG**: Detailed execution information
- **TRACE**: Full execution trace for debugging

### Metrics Collection
```javascript
const metrics = {
  execution_time: Date.now() - startTime,
  threads_processed: processedCount,
  errors_encountered: errorCount,
  api_calls_made: apiCallCount
};

logger.info('Execution metrics', metrics);
```

### Alert Conditions
- Script failures (3+ consecutive)
- Quota exhaustion warnings (>80% used)
- Unusual activity patterns
- Configuration drift detection

## Deployment Strategy

### Environment Progression
1. **Development** → Local testing with dry-run mode
2. **Staging** → Limited production data testing
3. **Production** → Full deployment with monitoring

### Rollback Procedures
```bash
# Revert to previous version
clasp deployments
clasp redeploy <deploymentId> <version>
```

### Configuration Management
- Environment-specific configs in `config/environments/`
- Secrets stored separately (never in code)
- Feature flags for gradual rollouts

## Testing Strategy

### Unit Tests
- Test individual functions in isolation
- Mock Gmail API responses
- Validate filter logic

### Integration Tests
- Test script execution end-to-end
- Verify label creation and application
- Check notification sending

### Account Validation
- Verify account configurations are valid
- Check permission models are enforced
- Validate quota limits are respected

## Maintenance Procedures

### Regular Tasks
- Weekly: Review error logs and fix issues
- Monthly: Audit filter effectiveness
- Quarterly: Review and optimize scripts
- Annually: Archive old logs and data

### Script Updates
1. Test changes in development environment
2. Review code changes for security implications
3. Deploy to staging for validation
4. Schedule production deployment during low-usage period
5. Monitor post-deployment metrics

## Disaster Recovery

### Backup Strategy
- Daily configuration backups
- Filter rule exports
- Label structure documentation
- Script version control in Git

### Recovery Procedures
1. Identify scope of issue
2. Rollback if necessary
3. Restore from backups if data loss
4. Verify account functionality
5. Document incident and resolution