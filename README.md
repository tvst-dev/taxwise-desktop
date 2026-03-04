# TaxWise Desktop Application

A comprehensive Nigerian tax management and compliance system built with Electron, React, and SQLite.

![TaxWise](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Mac%20%7C%20Linux-lightgrey.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## 🚀 Quick Start

```bash
# Install dependencies (no Python or build tools required!)
npm install

# Run in development mode
npm run dev

# Build for Windows
npm run build:win
```

**Note:** This app uses `sql.js` (pure JavaScript SQLite) - no Python or Visual Studio Build Tools needed.

## ✨ Features

### Core Tax Calculators
- **PAYE (Personal Income Tax)**: Progressive tax bands, CRA, and statutory deductions
- **CIT (Company Income Tax)**: Small, medium, and large company support with education tax
- **VAT (Value Added Tax)**: 7.5% rate with input/output calculation and credit carry-forward
- **WHT (Withholding Tax)**: Transaction-specific rates for various payment types
- **CGT (Capital Gains Tax)**: 10% rate on chargeable gains

### Financial Management
- **Entries Management**: Track income, expenses, and transfers
- **Cash Flow Dashboard**: Visual analytics of financial health
- **Bank Integration**: Auto-Bank Tracking for automatic transaction sync
- **Document AI**: AI-powered extraction from invoices and receipts

### Compliance & Reporting
- **Audit Module**: Compliance scoring and risk assessment
- **Tax History**: Complete calculation records with audit trail
- **Deductions Management**: Track statutory and voluntary deductions
- **Reminders & Schedules**: Never miss tax deadlines

### Enterprise Features
- **Point of Sale (POS)**: Retail sales with automatic VAT calculation
- **Team Management**: Multi-user access with role-based permissions
- **API Access**: RESTful API for system integrations

### Export & Reports
- **PDF Reports**: Professional tax calculation reports
- **Excel Exports**: Data exports for external analysis
- **Word Documents**: Formatted documents for submissions

## 🛠 Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, Zustand |
| Desktop | Electron 27 |
| Database | SQLite (sql.js) |
| Styling | Custom CSS, Dark Theme |
| Icons | Lucide React |

## 📁 Project Structure

```
taxwise-desktop/
├── main.js                 # Electron main process
├── preload.js              # Electron preload script (IPC bridge)
├── webpack.config.js       # Webpack bundler configuration
├── package.json            # Dependencies and scripts
├── database/
│   └── schema.sql          # SQLite database schema (25+ tables)
└── src/
    ├── App.jsx             # Main React application
    ├── index.jsx           # React entry point
    ├── index.html          # HTML template
    ├── assets/             # Icons and images
    ├── components/
    │   ├── Analytics/      # Financial analytics dashboard
    │   ├── API/            # API access management
    │   ├── Audit/          # Compliance and audit module
    │   ├── Auth/           # Login and registration
    │   ├── CashFlow/       # Cash flow management
    │   ├── Dashboard/      # Main dashboard
    │   ├── Deductions/     # Deductions management
    │   ├── Documents/      # Document upload and extraction
    │   ├── Entries/        # Financial entries
    │   ├── History/        # Tax calculation history
    │   ├── Layout/         # App layout, sidebar, titlebar
    │   ├── Modals/         # Reusable modal components
    │   ├── POS/            # Point of sale system
    │   ├── Reminders/      # Reminders and schedules
    │   ├── Settings/       # Application settings (6 tabs)
    │   ├── TaxCalculator/  # Interactive tax calculators
    │   ├── Team/           # Team management
    │   └── common/         # Shared components
    ├── services/
    │   ├── database.js     # Database operations
    │   ├── export.js       # Report generation
    │   ├── paystack.js     # Payment integration
    │   └── taxCalculator.js # Nigerian tax calculation engine
    ├── store/
    │   └── index.js        # Zustand state stores (12 stores)
    └── styles/
        └── global.css      # Global styles
```

## 💻 Installation

### Prerequisites
- Node.js 18+ (LTS recommended)
- npm or yarn

### Setup

1. Extract the zip file or clone the repository:
```bash
cd taxwise-desktop
```

2. Install dependencies:
```bash
npm install
```

3. Start development server:
```bash
npm run dev
```

4. Build for production:
```bash
npm run build:win    # Windows (.exe installer)
npm run build:mac    # macOS
npm run build:linux  # Linux
```

The Windows installer will be created in the `release/` folder.

## 🔌 Backend Integration

This application is ready for backend integration. Key integration points:

### Authentication (Supabase recommended)
```javascript
// src/components/Auth/LoginPage.jsx
// Replace the temporary auth with:
const { data, error } = await supabase.auth.signInWithPassword({
  email: formData.email,
  password: formData.password
});
```

### Payment Processing (Paystack)
- Configure in `src/services/paystack.js`
- PCI-DSS compliant subscription management
- Add your Paystack public key

### Bank Integration
- Auto-Bank Tracking ready for integration
- Configure API endpoints in Settings

### AI Document Extraction
- OpenAI/Claude API integration ready
- Configure in `src/services/ai.js`

## 📊 Nigerian Tax Compliance

### PAYE Calculation Rules
| Annual Income | Tax Rate |
|--------------|----------|
| First ₦300,000 | 7% |
| Next ₦300,000 | 11% |
| Next ₦500,000 | 15% |
| Next ₦500,000 | 19% |
| Next ₦1,600,000 | 21% |
| Above ₦3,200,000 | 24% |

**Relief Allowances:**
- CRA: MAX(₦200,000, 1% of Gross) + 20% of Gross
- Pension: 8% employee contribution
- NHF: 2.5% of basic salary
- NHIS: Variable

### CIT Calculation Rules
| Company Size | Turnover | Rate |
|-------------|----------|------|
| Small | ≤₦25m | 0% |
| Medium | ₦25m-₦100m | 20% |
| Large | >₦100m | 30% |

Plus 2.5% Education Tax on assessable profit.

### VAT Rules
- Standard rate: 7.5%
- VAT Payable = Output VAT - Input VAT
- Negative balance carries forward as credit

## 💼 Subscription Plans

### Free Trial
- Basic tax calculators
- Single user
- 7-day trial

### SME Plan (₦24,999/month)
- Full tax calculators
- Up to 5 users
- Single-account banking integration
- Document AI
- POS features

### Enterprise Plan (₦49,999/month)
- Multi-branch calculations
- Unlimited users
- Multi-account banking integration
- Advanced AI insights
- Multi-terminal POS
- API access

## 🔐 Security

- PCI-DSS compliant payment processing via Paystack
- No raw card data stored locally
- Token-based recurring billing
- Encrypted local database
- Role-based access control

## 🎨 User Roles & Permissions

| Role | Permissions |
|------|-------------|
| Owner | Full access to all features |
| Admin | Full access to all features |
| Manager | View, create, edit, approve, export, calculate, POS, team view |
| Accountant | View, create, edit, export, calculate |
| Cashier | View, create, POS |
| Viewer | Read-only access |

## 📝 Feature Toggles

Enable/disable features in Settings → Features:
- **POS System**: Point of sale functionality
- **Multi-User**: Team management and invitations
- **Auto-Bank Tracking**: Automatic transaction sync
- **API Access**: REST API integration
- **Document AI**: AI-powered document extraction

## 📜 License

MIT License - See LICENSE file for details.

## 🤝 Support

- Email: support@taxwise.ng
- Documentation: docs.taxwise.ng
- Website: taxwise.com.ng

---

Built with ❤️ for Nigerian businesses
