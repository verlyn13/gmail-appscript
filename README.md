# Gmail AppScript Management

Expert-level repository for managing Gmail automation across multiple accounts with proper separation of concerns, shared libraries, and deployment infrastructure.

## 📋 Repository Structure

```
gmail-appscript/
├── accounts/                    # Account-specific implementations
│   ├── personal-jeffrey/        # jeffreyverlynjohnson@gmail.com
│   ├── work-uaa/                # jjohnson47@alaska.edu
│   ├── business-happy-patterns/ # jeffrey@happy-patterns.com
│   └── personal-ahniel/         # ahnielitecky@gmail.com
├── shared/                      # Shared resources
│   ├── libraries/              # Reusable code libraries
│   ├── utilities/              # Helper functions
│   ├── templates/              # Email/doc templates
│   └── types/                  # TypeScript definitions
├── config/                     # Configuration
│   ├── accounts.json           # Account registry
│   ├── environments/           # Environment configs
│   └── credentials/            # Encrypted credentials
├── deployment/                 # Deployment tools
├── tests/                      # Test suites
└── .github/workflows/          # CI/CD pipelines
```

## 🎯 Architecture

### Account Isolation
Each account maintains its own:
- **Scripts**: Account-specific automation scripts
- **Filters**: Custom email filtering rules
- **Templates**: Personalized response templates
- **Config**: Account-specific settings and permissions

### Shared Components
- **GmailUtils**: Common Gmail operations (search, label, archive)
- **FilterBuilder**: Programmatic filter creation
- **Logger**: Advanced logging with multiple destinations
- **Error Handling**: Consistent error management across accounts

### Security & Compliance
- **Work Account (UAA)**: 7-year retention, audit logging, domain restrictions
- **Business Account**: CRM integration, client management, invoice processing
- **Family Account**: Consent-based management, restricted operations
- **Personal Accounts**: Full automation capabilities

## 🚀 Quick Start

### Prerequisites
```bash
npm install -g @google/clasp
npm install
```

### Setup Account
```bash
# 1. Authenticate with Google
clasp login

# 2. Navigate to account directory
cd accounts/personal-jeffrey/scripts/

# 3. Create new script
mkdir my-script && cd my-script
clasp create --title "My Script" --type standalone

# 4. Develop your script
# Use shared libraries: ../../../shared/libraries/
```

### Deploy Script
```bash
# Deploy to development
./deployment/deploy.sh personal-jeffrey my-script development

# Deploy to production
./deployment/deploy.sh personal-jeffrey my-script production
```

## 📚 Account Details

### Personal - Jeffrey
- **Email**: jeffreyverlynjohnson@gmail.com
- **Features**: Full automation, inbox zero, newsletter management
- **Scripts**: inbox-zero, newsletter-organizer, attachment-backup

### Work - UAA
- **Email**: jjohnson47@alaska.edu
- **Organization**: University of Alaska Anchorage
- **Compliance**: 7-year retention, audit logging
- **Scripts**: student-inquiries, meeting-scheduler, compliance-tagger

### Business - Happy Patterns
- **Email**: jeffrey@happy-patterns.com
- **Organization**: Happy Patterns LLC
- **Integrations**: HubSpot CRM, QuickBooks
- **Scripts**: client-manager, invoice-processor, lead-capture

### Personal - Ahniel
- **Email**: ahnielitecky@gmail.com
- **Relationship**: Spouse
- **Permissions**: Consent-based, restricted operations
- **Scripts**: family-organizer, subscription-manager

## 🛠️ Common Scripts

### Inbox Zero Automation
```javascript
// accounts/personal-jeffrey/scripts/inbox-zero/Code.js
function processInbox() {
  const utils = GmailUtils;
  const threads = utils.searchThreads('in:inbox', 100);
  
  threads.forEach(thread => {
    // Apply rules and organize
  });
}
```

### Client Email Manager
```javascript
// accounts/business-happy-patterns/scripts/client-manager/Code.js
function manageClients() {
  const filter = new FilterBuilder()
    .from('*@client-domain.com')
    .addLabel('Clients/Active')
    .markAsImportant()
    .create();
}
```

## 🔧 Development

### Local Testing
```bash
# Run unit tests
npm test

# Test specific account
npm test -- --account=personal-jeffrey

# Validate configurations
npm run validate
```

### Environment Variables
```bash
# .env.local
ENVIRONMENT=development
DEBUG=true
DRY_RUN=true
```

### Using Shared Libraries
```javascript
// Import shared utilities
const { Logger } = require('../../../shared/utilities/Logger');
const { GmailUtils } = require('../../../shared/libraries/GmailUtils');

// Create logger instance
const logger = new Logger({
  prefix: 'MyScript',
  level: 'DEBUG'
});

// Use Gmail utilities
const threads = GmailUtils.searchThreads('is:unread');
```

## 📊 Monitoring

Each script includes:
- Execution logging
- Error tracking
- Performance metrics
- Daily summary reports

## 🔐 Security

### Credentials Management
- Store in `config/credentials/` (gitignored)
- Use environment-specific configs
- Implement OAuth2 for integrations

### Permission Model
```json
{
  "allowedOperations": ["read", "label", "archive"],
  "restrictedOperations": ["delete", "forward"],
  "requireConsent": true
}
```

## 📝 Best Practices

1. **Always use shared libraries** for common operations
2. **Test in development** before production deployment
3. **Implement proper error handling** with retry logic
4. **Log important operations** for audit trails
5. **Respect account permissions** and restrictions
6. **Use environment configs** for different stages
7. **Document script purposes** in account.json

## 🤝 Contributing

1. Create feature branch: `git checkout -b feature/script-name`
2. Develop in appropriate account directory
3. Add tests for new functionality
4. Update account.json with script metadata
5. Submit PR with description

## 📄 License

MIT - See LICENSE file

## 🆘 Support

- **Documentation**: See `/docs` directory
- **Issues**: GitHub Issues
- **Contact**: jeffreyverlynjohnson@gmail.com