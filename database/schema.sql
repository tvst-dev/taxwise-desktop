-- TaxWise Database Schema
-- Version 1.0.0
-- Nigerian Tax Management System

-- ==================== CORE TABLES ====================

-- Organizations/Companies
CREATE TABLE IF NOT EXISTS organizations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    rc_number TEXT, -- Company Registration Number
    tin TEXT, -- Tax Identification Number
    entity_type TEXT NOT NULL CHECK(entity_type IN ('individual', 'sme', 'large_corporation')),
    industry TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    country TEXT DEFAULT 'Nigeria',
    phone TEXT,
    email TEXT,
    website TEXT,
    annual_turnover REAL DEFAULT 0,
    fiscal_year_start INTEGER DEFAULT 1, -- Month (1-12)
    subscription_tier TEXT CHECK(subscription_tier IN ('free', 'sme', 'large_corporation')),
    subscription_status TEXT DEFAULT 'active' CHECK(subscription_status IN ('active', 'pending', 'expired', 'cancelled')),
    subscription_expires_at TEXT,
    paystack_customer_code TEXT,
    paystack_authorization_code TEXT,
    mono_account_id TEXT,
    mono_enabled INTEGER DEFAULT 0,
    openai_enabled INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Users
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('owner', 'admin', 'manager', 'accountant', 'cashier', 'viewer')),
    department TEXT,
    branch TEXT,
    phone TEXT,
    avatar_url TEXT,
    is_active INTEGER DEFAULT 1,
    last_login_at TEXT,
    password_reset_token TEXT,
    password_reset_expires TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- ==================== TAXPAYER PROFILES ====================

CREATE TABLE IF NOT EXISTS taxpayer_profiles (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    user_id TEXT,
    profile_type TEXT NOT NULL CHECK(profile_type IN ('individual', 'business')),
    -- Personal Info (for individuals)
    title TEXT,
    first_name TEXT,
    last_name TEXT,
    middle_name TEXT,
    date_of_birth TEXT,
    gender TEXT,
    marital_status TEXT,
    nationality TEXT DEFAULT 'Nigerian',
    -- Business Info
    business_name TEXT,
    rc_number TEXT,
    -- Tax Identifiers
    tin TEXT,
    bvn TEXT,
    nin TEXT,
    -- Contact
    email TEXT,
    phone TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    lga TEXT,
    -- Employment (for individuals)
    employer_name TEXT,
    employer_tin TEXT,
    employment_status TEXT CHECK(employment_status IN ('employed', 'self_employed', 'unemployed', 'retired')),
    job_title TEXT,
    -- Financial
    annual_gross_income REAL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ==================== FINANCIAL ENTRIES ====================

CREATE TABLE IF NOT EXISTS entries (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    taxpayer_id TEXT,
    entry_type TEXT NOT NULL CHECK(entry_type IN ('income', 'expense', 'transfer', 'liability', 'asset')),
    category TEXT NOT NULL,
    sub_category TEXT,
    description TEXT NOT NULL,
    amount REAL NOT NULL,
    currency TEXT DEFAULT 'NGN',
    date TEXT NOT NULL,
    reference_number TEXT,
    vendor_customer TEXT,
    payment_method TEXT,
    bank_account TEXT,
    is_vatable INTEGER DEFAULT 0,
    vat_amount REAL DEFAULT 0,
    is_wht_applicable INTEGER DEFAULT 0,
    wht_rate REAL DEFAULT 0,
    wht_amount REAL DEFAULT 0,
    is_deductible INTEGER DEFAULT 1,
    receipt_url TEXT,
    notes TEXT,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'posted', 'voided', 'reconciled')),
    created_by TEXT,
    approved_by TEXT,
    approved_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (taxpayer_id) REFERENCES taxpayer_profiles(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Entry Categories
CREATE TABLE IF NOT EXISTS entry_categories (
    id TEXT PRIMARY KEY,
    organization_id TEXT,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('income', 'expense', 'transfer', 'liability', 'asset')),
    parent_id TEXT,
    color TEXT,
    icon TEXT,
    is_vatable INTEGER DEFAULT 0,
    default_vat_rate REAL DEFAULT 7.5,
    is_wht_applicable INTEGER DEFAULT 0,
    default_wht_rate REAL DEFAULT 0,
    is_deductible INTEGER DEFAULT 1,
    is_system INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES entry_categories(id) ON DELETE SET NULL
);

-- ==================== TAX CALCULATIONS ====================

CREATE TABLE IF NOT EXISTS tax_calculations (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    taxpayer_id TEXT,
    reference_id TEXT UNIQUE NOT NULL,
    tax_type TEXT NOT NULL CHECK(tax_type IN ('paye', 'cit', 'vat', 'wht', 'cgt', 'education_tax')),
    tax_year INTEGER NOT NULL,
    tax_period TEXT, -- e.g., 'monthly', 'quarterly', 'annually'
    period_start TEXT,
    period_end TEXT,
    -- Input values (stored as JSON for flexibility)
    input_data TEXT NOT NULL, -- JSON
    -- Calculation breakdown
    gross_amount REAL NOT NULL,
    deductions REAL DEFAULT 0,
    reliefs REAL DEFAULT 0,
    taxable_amount REAL NOT NULL,
    tax_rate REAL,
    tax_due REAL NOT NULL,
    credits_applied REAL DEFAULT 0,
    net_tax_payable REAL NOT NULL,
    -- Breakdown details (JSON)
    calculation_breakdown TEXT, -- JSON with step-by-step calculation
    -- Status
    status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'pending', 'filed', 'paid', 'amended')),
    filed_at TEXT,
    filed_by TEXT,
    payment_reference TEXT,
    payment_date TEXT,
    -- Audit
    notes TEXT,
    created_by TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (taxpayer_id) REFERENCES taxpayer_profiles(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (filed_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ==================== DEDUCTIONS ====================

CREATE TABLE IF NOT EXISTS deductions (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    taxpayer_id TEXT,
    tax_type TEXT NOT NULL CHECK(tax_type IN ('paye', 'cit', 'all')),
    deduction_type TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    amount REAL NOT NULL,
    percentage REAL, -- If it's a percentage-based deduction
    max_amount REAL, -- Maximum allowable amount
    tax_year INTEGER NOT NULL,
    effective_date TEXT,
    expiry_date TEXT,
    documentation_url TEXT,
    is_recurring INTEGER DEFAULT 0,
    recurrence_frequency TEXT CHECK(recurrence_frequency IN ('monthly', 'quarterly', 'annually')),
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'expired', 'pending_approval', 'rejected')),
    approved_by TEXT,
    approved_at TEXT,
    created_by TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (taxpayer_id) REFERENCES taxpayer_profiles(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Deduction Types (Lookup)
CREATE TABLE IF NOT EXISTS deduction_types (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    tax_type TEXT NOT NULL CHECK(tax_type IN ('paye', 'cit', 'all')),
    category TEXT NOT NULL, -- 'statutory', 'allowance', 'relief', 'capital_allowance'
    is_percentage INTEGER DEFAULT 0,
    default_rate REAL,
    max_amount REAL,
    requires_documentation INTEGER DEFAULT 0,
    is_system INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
);

-- ==================== VAT RECORDS ====================

CREATE TABLE IF NOT EXISTS vat_records (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    tax_period TEXT NOT NULL, -- e.g., '2024-01' for January 2024
    tax_year INTEGER NOT NULL,
    -- Output VAT (Sales)
    total_vatable_sales REAL DEFAULT 0,
    total_exempt_sales REAL DEFAULT 0,
    total_zero_rated_sales REAL DEFAULT 0,
    output_vat REAL DEFAULT 0,
    -- Input VAT (Purchases)
    total_vatable_purchases REAL DEFAULT 0,
    total_exempt_purchases REAL DEFAULT 0,
    input_vat REAL DEFAULT 0,
    -- Net Position
    vat_payable REAL DEFAULT 0, -- Positive = pay, Negative = credit
    vat_credit_brought_forward REAL DEFAULT 0,
    vat_credit_carried_forward REAL DEFAULT 0,
    -- Filing
    status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'filed', 'paid', 'amended')),
    filed_at TEXT,
    payment_reference TEXT,
    payment_date TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- ==================== WHT RECORDS ====================

CREATE TABLE IF NOT EXISTS wht_records (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    entry_id TEXT,
    transaction_type TEXT NOT NULL, -- 'rent', 'interest', 'dividends', 'professional_services', 'contracts', 'royalties', etc.
    vendor_name TEXT NOT NULL,
    vendor_tin TEXT,
    vendor_address TEXT,
    transaction_date TEXT NOT NULL,
    gross_amount REAL NOT NULL,
    wht_rate REAL NOT NULL,
    wht_amount REAL NOT NULL,
    net_amount REAL NOT NULL,
    -- Credit tracking
    is_credit_claimed INTEGER DEFAULT 0,
    credit_applied_to TEXT, -- Reference to tax calculation where credit was applied
    credit_applied_amount REAL DEFAULT 0,
    -- Certificate
    wht_certificate_number TEXT,
    wht_certificate_date TEXT,
    wht_certificate_url TEXT,
    -- Remittance
    remittance_status TEXT DEFAULT 'pending' CHECK(remittance_status IN ('pending', 'remitted', 'overdue')),
    remittance_date TEXT,
    remittance_reference TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE SET NULL
);

-- ==================== CAPITAL GAINS ====================

CREATE TABLE IF NOT EXISTS capital_assets (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    taxpayer_id TEXT,
    asset_type TEXT NOT NULL, -- 'land', 'building', 'shares', 'vehicle', 'equipment', etc.
    description TEXT NOT NULL,
    acquisition_date TEXT NOT NULL,
    acquisition_cost REAL NOT NULL,
    incidental_acquisition_costs REAL DEFAULT 0,
    improvements_cost REAL DEFAULT 0,
    disposal_date TEXT,
    disposal_proceeds REAL,
    incidental_disposal_costs REAL DEFAULT 0,
    chargeable_gain REAL,
    cgt_due REAL,
    is_exempt INTEGER DEFAULT 0,
    exemption_reason TEXT,
    status TEXT DEFAULT 'held' CHECK(status IN ('held', 'disposed', 'pending_cgt')),
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (taxpayer_id) REFERENCES taxpayer_profiles(id) ON DELETE SET NULL
);

-- ==================== PAYROLL (for PAYE) ====================

CREATE TABLE IF NOT EXISTS payroll_records (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    taxpayer_id TEXT NOT NULL, -- Employee
    pay_period TEXT NOT NULL, -- e.g., '2024-01' for January 2024
    tax_year INTEGER NOT NULL,
    -- Earnings
    basic_salary REAL NOT NULL,
    housing_allowance REAL DEFAULT 0,
    transport_allowance REAL DEFAULT 0,
    utility_allowance REAL DEFAULT 0,
    meal_allowance REAL DEFAULT 0,
    other_allowances REAL DEFAULT 0,
    bonus REAL DEFAULT 0,
    overtime REAL DEFAULT 0,
    benefits_in_kind REAL DEFAULT 0,
    gross_pay REAL NOT NULL,
    -- Statutory Deductions
    pension_employee REAL DEFAULT 0,
    pension_employer REAL DEFAULT 0,
    nhf REAL DEFAULT 0,
    nhis REAL DEFAULT 0,
    life_assurance REAL DEFAULT 0,
    -- Tax Calculation
    cra REAL DEFAULT 0, -- Consolidated Relief Allowance
    taxable_income REAL NOT NULL,
    paye_tax REAL NOT NULL,
    -- Net
    total_deductions REAL NOT NULL,
    net_pay REAL NOT NULL,
    -- Status
    status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'approved', 'paid', 'filed')),
    payment_date TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (taxpayer_id) REFERENCES taxpayer_profiles(id) ON DELETE CASCADE
);

-- ==================== POS / SALES ====================

CREATE TABLE IF NOT EXISTS pos_terminals (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    terminal_name TEXT NOT NULL,
    terminal_code TEXT UNIQUE NOT NULL,
    location TEXT,
    branch TEXT,
    is_active INTEGER DEFAULT 1,
    last_sync_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS pos_sales (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    terminal_id TEXT,
    receipt_number TEXT UNIQUE NOT NULL,
    sale_date TEXT NOT NULL,
    sale_time TEXT NOT NULL,
    -- Amounts
    subtotal REAL NOT NULL,
    vat_amount REAL DEFAULT 0,
    discount REAL DEFAULT 0,
    total REAL NOT NULL,
    -- Payment
    payment_method TEXT NOT NULL CHECK(payment_method IN ('cash', 'card', 'transfer', 'split')),
    amount_tendered REAL,
    change_given REAL DEFAULT 0,
    -- Customer (optional)
    customer_name TEXT,
    customer_phone TEXT,
    -- Status
    status TEXT DEFAULT 'completed' CHECK(status IN ('completed', 'voided', 'refunded')),
    voided_reason TEXT,
    cashier_id TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (terminal_id) REFERENCES pos_terminals(id) ON DELETE SET NULL,
    FOREIGN KEY (cashier_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS pos_sale_items (
    id TEXT PRIMARY KEY,
    sale_id TEXT NOT NULL,
    product_name TEXT NOT NULL,
    product_code TEXT,
    quantity REAL NOT NULL,
    unit_price REAL NOT NULL,
    discount REAL DEFAULT 0,
    is_vatable INTEGER DEFAULT 1,
    vat_rate REAL DEFAULT 7.5,
    vat_amount REAL DEFAULT 0,
    total REAL NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (sale_id) REFERENCES pos_sales(id) ON DELETE CASCADE
);

-- ==================== REMINDERS & SCHEDULES ====================

CREATE TABLE IF NOT EXISTS reminders (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    user_id TEXT,
    title TEXT NOT NULL,
    description TEXT,
    reminder_type TEXT NOT NULL CHECK(reminder_type IN ('tax_filing', 'payment', 'document', 'custom')),
    related_entity_type TEXT, -- 'tax_calculation', 'vat_record', etc.
    related_entity_id TEXT,
    due_date TEXT NOT NULL,
    remind_before_days INTEGER DEFAULT 7,
    is_recurring INTEGER DEFAULT 0,
    recurrence_pattern TEXT, -- 'daily', 'weekly', 'monthly', 'quarterly', 'annually'
    notification_sent INTEGER DEFAULT 0,
    notification_sent_at TEXT,
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'completed', 'dismissed', 'overdue')),
    completed_at TEXT,
    created_by TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ==================== DOCUMENTS ====================

CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    uploaded_by TEXT,
    document_type TEXT NOT NULL, -- 'payslip', 'invoice', 'receipt', 'bank_statement', 'tax_certificate', etc.
    original_filename TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    mime_type TEXT,
    -- AI Extraction
    extraction_status TEXT DEFAULT 'pending' CHECK(extraction_status IN ('pending', 'processing', 'completed', 'failed')),
    extracted_data TEXT, -- JSON
    extraction_confidence REAL,
    -- Linking
    linked_entry_id TEXT,
    linked_taxpayer_id TEXT,
    -- Meta
    tax_year INTEGER,
    tax_period TEXT,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (linked_entry_id) REFERENCES entries(id) ON DELETE SET NULL,
    FOREIGN KEY (linked_taxpayer_id) REFERENCES taxpayer_profiles(id) ON DELETE SET NULL
);

-- ==================== AUDIT LOGS ====================

CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    user_id TEXT,
    action TEXT NOT NULL, -- 'create', 'update', 'delete', 'view', 'export', 'login', 'logout'
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    old_values TEXT, -- JSON
    new_values TEXT, -- JSON
    ip_address TEXT,
    user_agent TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ==================== BANK INTEGRATION (MONO) ====================

CREATE TABLE IF NOT EXISTS bank_accounts (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    mono_account_id TEXT,
    bank_name TEXT NOT NULL,
    account_name TEXT NOT NULL,
    account_number TEXT NOT NULL,
    account_type TEXT, -- 'savings', 'current', 'domiciliary'
    currency TEXT DEFAULT 'NGN',
    current_balance REAL,
    available_balance REAL,
    is_primary INTEGER DEFAULT 0,
    last_sync_at TEXT,
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'disconnected')),
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS bank_transactions (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    bank_account_id TEXT NOT NULL,
    mono_transaction_id TEXT,
    transaction_date TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('credit', 'debit')),
    amount REAL NOT NULL,
    balance_after REAL,
    narration TEXT,
    category TEXT,
    -- Matching
    matched_entry_id TEXT,
    is_matched INTEGER DEFAULT 0,
    match_confidence REAL,
    -- Status
    is_reconciled INTEGER DEFAULT 0,
    reconciled_at TEXT,
    reconciled_by TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (bank_account_id) REFERENCES bank_accounts(id) ON DELETE CASCADE,
    FOREIGN KEY (matched_entry_id) REFERENCES entries(id) ON DELETE SET NULL
);

-- ==================== AI INSIGHTS ====================

CREATE TABLE IF NOT EXISTS ai_insights (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    user_id TEXT,
    insight_type TEXT NOT NULL, -- 'tax_tip', 'optimization', 'alert', 'recommendation', 'analysis'
    category TEXT, -- 'paye', 'cit', 'vat', 'deductions', 'cash_flow', 'compliance'
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    potential_savings REAL,
    priority TEXT CHECK(priority IN ('low', 'medium', 'high', 'critical')),
    action_required INTEGER DEFAULT 0,
    action_taken INTEGER DEFAULT 0,
    action_taken_at TEXT,
    dismissed INTEGER DEFAULT 0,
    dismissed_at TEXT,
    expires_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ==================== SUBSCRIPTION & BILLING ====================

CREATE TABLE IF NOT EXISTS subscription_history (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    tier TEXT NOT NULL CHECK(tier IN ('free', 'sme', 'large_corporation')),
    amount REAL NOT NULL,
    currency TEXT DEFAULT 'NGN',
    billing_cycle TEXT CHECK(billing_cycle IN ('monthly', 'annually')),
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    payment_status TEXT DEFAULT 'pending' CHECK(payment_status IN ('pending', 'success', 'failed', 'refunded')),
    paystack_reference TEXT,
    paystack_transaction_id TEXT,
    invoice_url TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- ==================== INDEXES ====================

CREATE INDEX IF NOT EXISTS idx_users_organization ON users(organization_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_entries_organization ON entries(organization_id);
CREATE INDEX IF NOT EXISTS idx_entries_date ON entries(date);
CREATE INDEX IF NOT EXISTS idx_entries_type ON entries(entry_type);
CREATE INDEX IF NOT EXISTS idx_entries_status ON entries(status);
CREATE INDEX IF NOT EXISTS idx_tax_calculations_organization ON tax_calculations(organization_id);
CREATE INDEX IF NOT EXISTS idx_tax_calculations_type ON tax_calculations(tax_type);
CREATE INDEX IF NOT EXISTS idx_tax_calculations_year ON tax_calculations(tax_year);
CREATE INDEX IF NOT EXISTS idx_deductions_organization ON deductions(organization_id);
CREATE INDEX IF NOT EXISTS idx_vat_records_organization ON vat_records(organization_id);
CREATE INDEX IF NOT EXISTS idx_wht_records_organization ON wht_records(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_organization ON audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_account ON bank_transactions(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_date ON bank_transactions(transaction_date);

-- ==================== DEFAULT DATA ====================

-- Insert default entry categories
INSERT OR IGNORE INTO entry_categories (id, name, type, color, icon, is_vatable, is_deductible, is_system) VALUES
('cat_salary', 'Salary & Wages', 'income', '#22C55E', 'briefcase', 0, 0, 1),
('cat_consulting', 'Consulting Income', 'income', '#3B82F6', 'users', 1, 0, 1),
('cat_sales', 'Sales Revenue', 'income', '#8B5CF6', 'shopping-cart', 1, 0, 1),
('cat_interest', 'Interest Income', 'income', '#F59E0B', 'trending-up', 0, 0, 1),
('cat_rent_income', 'Rent Received', 'income', '#EC4899', 'home', 0, 0, 1),
('cat_dividends', 'Dividends', 'income', '#06B6D4', 'pie-chart', 0, 0, 1),
('cat_other_income', 'Other Income', 'income', '#64748B', 'plus-circle', 0, 0, 1),
('cat_office', 'Office Supplies', 'expense', '#EF4444', 'package', 1, 1, 1),
('cat_software', 'Software & Tools', 'expense', '#F97316', 'code', 1, 1, 1),
('cat_utilities', 'Utilities', 'expense', '#FBBF24', 'zap', 0, 1, 1),
('cat_rent_expense', 'Rent & Lease', 'expense', '#84CC16', 'building', 0, 1, 1),
('cat_salaries', 'Staff Salaries', 'expense', '#22C55E', 'users', 0, 1, 1),
('cat_professional', 'Professional Services', 'expense', '#14B8A6', 'briefcase', 1, 1, 1),
('cat_marketing', 'Marketing & Advertising', 'expense', '#06B6D4', 'megaphone', 1, 1, 1),
('cat_travel', 'Travel & Transport', 'expense', '#3B82F6', 'map-pin', 1, 1, 1),
('cat_insurance', 'Insurance', 'expense', '#8B5CF6', 'shield', 0, 1, 1),
('cat_maintenance', 'Repairs & Maintenance', 'expense', '#A855F7', 'tool', 1, 1, 1),
('cat_bank', 'Bank Charges', 'expense', '#EC4899', 'credit-card', 0, 1, 1),
('cat_tax_payment', 'Tax Payments', 'liability', '#EF4444', 'file-text', 0, 0, 1),
('cat_vat_liability', 'VAT Liability', 'liability', '#F97316', 'percent', 0, 0, 1);

-- Insert default deduction types
INSERT OR IGNORE INTO deduction_types (id, code, name, description, tax_type, category, is_percentage, default_rate, requires_documentation, is_system) VALUES
('dt_pension', 'PENSION', 'Pension Contribution', 'Employee pension contribution (8% of basic + housing + transport)', 'paye', 'statutory', 1, 8.0, 0, 1),
('dt_nhf', 'NHF', 'National Housing Fund', 'NHF contribution (2.5% of basic salary)', 'paye', 'statutory', 1, 2.5, 0, 1),
('dt_nhis', 'NHIS', 'National Health Insurance', 'NHIS contribution', 'paye', 'statutory', 0, NULL, 0, 1),
('dt_life_assurance', 'LIFE_ASSURANCE', 'Life Assurance Premium', 'Life assurance premium payment', 'paye', 'allowance', 0, NULL, 1, 1),
('dt_cra', 'CRA', 'Consolidated Relief Allowance', 'MAX(₦200,000, 1% of Gross) + 20% of Gross', 'paye', 'relief', 0, NULL, 0, 1),
('dt_capital_allowance', 'CAPITAL_ALLOWANCE', 'Capital Allowance', 'Capital allowance on qualifying assets', 'cit', 'capital_allowance', 0, NULL, 1, 1),
('dt_investment_allowance', 'INVESTMENT_ALLOWANCE', 'Investment Allowance', 'Investment allowance on qualifying expenditure', 'cit', 'capital_allowance', 0, NULL, 1, 1);
