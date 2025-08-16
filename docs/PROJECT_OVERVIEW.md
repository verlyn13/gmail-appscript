# Gmail AppScript Management - Project Overview

## 🎯 Purpose

This repository provides a centralized, professional infrastructure for managing Gmail automation across multiple accounts with proper separation of concerns, shared libraries, and deployment workflows.

## 📊 Current Status

### Active Accounts

| Account | Email | Scripts | Status |
|---------|-------|---------|--------|
| Personal - Jeffrey | jeffreyverlynjohnson@gmail.com | 0 | Ready |
| **Work - UAA** | **jjohnson47@alaska.edu** | **4 active** | **In Production** |
| Business - Happy Patterns | jeffrey@happy-patterns.com | 0 | Ready |
| Personal - Ahniel | ahnielitecky@gmail.com | 0 | Ready |

### UAA Account - Active Scripts

1. **Gmail Triage** - Email organization and triage automation
2. **Collector** - Data collection and aggregation from emails  
3. **Email Automate** - Automated email workflows and responses
4. **Directory List** - University directory and contact management

## 🏗️ Repository Structure

```
gmail-appscript/
├── accounts/                    # Account-specific implementations
│   ├── personal-jeffrey/       
│   ├── work-uaa/               # 4 active scripts in production
│   ├── business-happy-patterns/
│   └── personal-ahniel/        
├── shared/                     # Shared resources
│   ├── libraries/             # GmailUtils, FilterBuilder
│   ├── utilities/             # Logger, error handling
│   └── templates/             # Script templates
├── docs/                       # Documentation
│   ├── guides/                # How-to guides
│   ├── reference/             # API references
│   └── workflows/             # Automation workflows
├── config/                     # Configuration
├── deployment/                 # Deployment tools
└── tests/                      # Vitest test suites
```

## 🔧 Technology Stack

- **Package Manager**: pnpm 10.14.0+ (enforced)
- **Testing Framework**: Vitest 3.2.4 (latest)
- **Apps Script Tool**: clasp 3.0.6-alpha
- **Type Definitions**: TypeScript 5.9.2
- **Node Version**: 18.19.0+
- **Account Management**: gcloud configurations

## 🚀 Quick Start Commands

### Account Switching
```bash
# Switch to UAA account for work scripts
gcloud-switch alaska-edu

# Switch to personal account
gcloud-switch default
```

### Working with Scripts
```bash
# List all scripts in UAA account
cd accounts/work-uaa/scripts/
clasp list

# Clone existing script locally
clasp clone <script-id>

# Create new script
clasp create --title "Script Name" --type standalone

# Deploy changes
./deployment/deploy.sh work-uaa script-name production
```

### Development & Testing
```bash
# Install dependencies
pnpm install

# Run tests
pnpm test

# Watch mode for development
pnpm test:watch

# Coverage reports
pnpm test:coverage

# Interactive test UI
pnpm test:ui
```

## 📚 Key Documentation

| Document | Purpose |
|----------|---------|
| [CLASP_GUIDE.md](./docs/guides/CLASP_GUIDE.md) | Complete clasp tool reference |
| [ACCOUNT_SETUP.md](./docs/guides/ACCOUNT_SETUP.md) | Account switching guide |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System design and patterns |
| [UAA Scripts](./accounts/work-uaa/docs/) | UAA-specific documentation |

## 🔐 Security & Compliance

### Work Account (UAA)
- **Retention**: 7-year policy enforced
- **Audit Logging**: All operations tracked
- **Domain Restrictions**: alaska.edu, ua.edu only
- **Data Classification**: public, internal, confidential, restricted

### Personal & Family Accounts
- **Permissions**: Consent-based for family account
- **Operations**: Restricted delete/forward for spouse account
- **Privacy**: Separate label systems

## 🎯 Current Priorities

1. **Migrate UAA Scripts** - Bring 4 existing scripts into repository
2. **Standardize Code** - Apply shared libraries to existing scripts
3. **Add Testing** - Create tests for production scripts
4. **Documentation** - Complete script-specific documentation
5. **CI/CD Pipeline** - Automate testing and deployment

## 📈 Metrics & Goals

- **Test Coverage**: Target 80% (currently building)
- **Scripts Managed**: 4 active, 12+ planned
- **Deployment Time**: < 2 minutes per script
- **Error Rate**: < 0.1% target

## 🤝 Contributing

See [CONTRIBUTING.md](./docs/CONTRIBUTING.md) for guidelines on:
- Code standards
- Testing requirements
- Documentation expectations
- Review process

## 📞 Support

- **Primary Contact**: jeffreyverlynjohnson@gmail.com
- **UAA Support**: jjohnson47@alaska.edu
- **Repository**: https://github.com/verlyn13/gmail-appscript

---

*Last Updated: January 2025*