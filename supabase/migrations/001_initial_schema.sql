-- =====================================================
-- TAXWISE SUPABASE DATABASE SCHEMA
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. ORGANIZATIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  business_type VARCHAR(50) DEFAULT 'sole_proprietorship',
  tin VARCHAR(50),
  rc_number VARCHAR(50),
  address TEXT,
  state VARCHAR(100),
  industry VARCHAR(100),
  phone VARCHAR(20),
  email VARCHAR(255),
  logo_url TEXT,
  subscription_tier VARCHAR(50) DEFAULT 'free',
  subscription_status VARCHAR(50) DEFAULT 'active',
  subscription_expires_at TIMESTAMPTZ,
  paystack_customer_code VARCHAR(100),
  paystack_subscription_code VARCHAR(100),
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 2. USERS TABLE (extends Supabase auth.users)
-- =====================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  email VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  phone VARCHAR(20),
  avatar_url TEXT,
  role VARCHAR(50) DEFAULT 'owner',
  permissions JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 3. TEAM INVITATIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS team_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  role VARCHAR(50) DEFAULT 'viewer',
  invited_by UUID REFERENCES users(id),
  token VARCHAR(100) UNIQUE NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 4. ENTRIES TABLE (Income/Expenses)
-- =====================================================
CREATE TABLE IF NOT EXISTS entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  entry_type VARCHAR(50) NOT NULL CHECK (entry_type IN ('income', 'expense', 'transfer')),
  category VARCHAR(100),
  amount DECIMAL(15, 2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'NGN',
  date DATE NOT NULL,
  description TEXT,
  vendor_customer VARCHAR(255),
  reference_number VARCHAR(100),
  payment_method VARCHAR(50),
  tax_type VARCHAR(50),
  vat_amount DECIMAL(15, 2) DEFAULT 0,
  wht_amount DECIMAL(15, 2) DEFAULT 0,
  is_vat_inclusive BOOLEAN DEFAULT false,
  status VARCHAR(50) DEFAULT 'pending',
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  attachments JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 5. TAX CALCULATIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS tax_calculations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  tax_type VARCHAR(50) NOT NULL,
  calculation_name VARCHAR(255),
  fiscal_year INTEGER,
  fiscal_month INTEGER,
  input_data JSONB NOT NULL,
  result_data JSONB NOT NULL,
  gross_amount DECIMAL(15, 2),
  taxable_amount DECIMAL(15, 2),
  tax_payable DECIMAL(15, 2),
  relief_amount DECIMAL(15, 2) DEFAULT 0,
  net_tax_payable DECIMAL(15, 2),
  notes TEXT,
  status VARCHAR(50) DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 6. DEDUCTIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS deductions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  deduction_type VARCHAR(100) NOT NULL,
  description TEXT,
  amount DECIMAL(15, 2) NOT NULL,
  rate DECIMAL(5, 2),
  fiscal_year INTEGER,
  fiscal_month INTEGER,
  is_statutory BOOLEAN DEFAULT false,
  is_recurring BOOLEAN DEFAULT false,
  status VARCHAR(50) DEFAULT 'active',
  proof_document_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 7. REMINDERS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS reminders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  reminder_type VARCHAR(100),
  due_date DATE NOT NULL,
  due_time TIME,
  recurrence VARCHAR(50),
  priority VARCHAR(50) DEFAULT 'medium',
  status VARCHAR(50) DEFAULT 'active',
  completed_at TIMESTAMPTZ,
  notify_before_days INTEGER DEFAULT 7,
  notify_email BOOLEAN DEFAULT true,
  notify_push BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 8. DOCUMENTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  file_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(100),
  file_size INTEGER,
  file_url TEXT NOT NULL,
  storage_path TEXT,
  document_type VARCHAR(100),
  extracted_data JSONB,
  extraction_status VARCHAR(50) DEFAULT 'pending',
  extraction_confidence DECIMAL(3, 2),
  linked_entry_id UUID REFERENCES entries(id),
  tags JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 9. POS PRODUCTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS pos_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  price DECIMAL(15, 2) NOT NULL,
  cost_price DECIMAL(15, 2),
  sku VARCHAR(100),
  barcode VARCHAR(100),
  stock_quantity INTEGER,
  low_stock_threshold INTEGER DEFAULT 10,
  is_vat_applicable BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 10. POS TRANSACTIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS pos_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  reference VARCHAR(100) UNIQUE NOT NULL,
  items JSONB NOT NULL,
  subtotal DECIMAL(15, 2) NOT NULL,
  vat_amount DECIMAL(15, 2) DEFAULT 0,
  discount_amount DECIMAL(15, 2) DEFAULT 0,
  total_amount DECIMAL(15, 2) NOT NULL,
  payment_method VARCHAR(50),
  cash_received DECIMAL(15, 2),
  change_amount DECIMAL(15, 2),
  customer_name VARCHAR(255),
  customer_phone VARCHAR(20),
  status VARCHAR(50) DEFAULT 'completed',
  voided_by UUID REFERENCES users(id),
  voided_at TIMESTAMPTZ,
  void_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 11. BANK ACCOUNTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS bank_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  bank_name VARCHAR(255) NOT NULL,
  account_name VARCHAR(255),
  account_number_masked VARCHAR(20),
  account_type VARCHAR(50),
  currency VARCHAR(10) DEFAULT 'NGN',
  current_balance DECIMAL(15, 2) DEFAULT 0,
  is_primary BOOLEAN DEFAULT false,
  is_connected BOOLEAN DEFAULT false,
  connection_provider VARCHAR(50),
  connection_id VARCHAR(255),
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 12. BANK TRANSACTIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS bank_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bank_account_id UUID NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  transaction_id VARCHAR(255),
  date DATE NOT NULL,
  description TEXT,
  type VARCHAR(50),
  amount DECIMAL(15, 2) NOT NULL,
  balance DECIMAL(15, 2),
  category VARCHAR(100),
  is_categorized BOOLEAN DEFAULT false,
  linked_entry_id UUID REFERENCES entries(id),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 13. SUBSCRIPTION PAYMENTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS subscription_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  paystack_reference VARCHAR(100) UNIQUE,
  amount DECIMAL(15, 2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'NGN',
  plan VARCHAR(50),
  status VARCHAR(50),
  payment_method VARCHAR(50),
  paid_at TIMESTAMPTZ,
  invoice_url TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 14. AUDIT LOGS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100),
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address VARCHAR(50),
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 15. API KEYS TABLE (for API access feature)
-- =====================================================
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  key_hash VARCHAR(255) NOT NULL,
  key_prefix VARCHAR(20) NOT NULL,
  permissions JSONB DEFAULT '["read"]',
  rate_limit INTEGER DEFAULT 100,
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_users_org ON users(organization_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_entries_org ON entries(organization_id);
CREATE INDEX IF NOT EXISTS idx_entries_date ON entries(date);
CREATE INDEX IF NOT EXISTS idx_entries_type ON entries(entry_type);
CREATE INDEX IF NOT EXISTS idx_tax_calculations_org ON tax_calculations(organization_id);
CREATE INDEX IF NOT EXISTS idx_deductions_org ON deductions(organization_id);
CREATE INDEX IF NOT EXISTS idx_reminders_org ON reminders(organization_id);
CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders(due_date);
CREATE INDEX IF NOT EXISTS idx_documents_org ON documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_pos_products_org ON pos_products(organization_id);
CREATE INDEX IF NOT EXISTS idx_pos_transactions_org ON pos_transactions(organization_id);
CREATE INDEX IF NOT EXISTS idx_pos_transactions_date ON pos_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_org ON audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_calculations ENABLE ROW LEVEL SECURITY;
ALTER TABLE deductions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Users can only see their organization's data
CREATE POLICY "Users can view own organization" ON organizations
  FOR SELECT USING (id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can update own organization" ON organizations
  FOR UPDATE USING (id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

-- Users table policies
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (id = auth.uid() OR organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (id = auth.uid());

-- Entries policies
CREATE POLICY "Users can view org entries" ON entries
  FOR SELECT USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can insert entries" ON entries
  FOR INSERT WITH CHECK (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can update org entries" ON entries
  FOR UPDATE USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can delete org entries" ON entries
  FOR DELETE USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

-- Similar policies for other tables (simplified for brevity)
CREATE POLICY "tax_calculations_org_policy" ON tax_calculations
  FOR ALL USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "deductions_org_policy" ON deductions
  FOR ALL USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "reminders_org_policy" ON reminders
  FOR ALL USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "documents_org_policy" ON documents
  FOR ALL USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "pos_products_org_policy" ON pos_products
  FOR ALL USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "pos_transactions_org_policy" ON pos_transactions
  FOR ALL USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "bank_accounts_org_policy" ON bank_accounts
  FOR ALL USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "bank_transactions_org_policy" ON bank_transactions
  FOR ALL USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "subscription_payments_org_policy" ON subscription_payments
  FOR ALL USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "team_invitations_org_policy" ON team_invitations
  FOR ALL USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "api_keys_org_policy" ON api_keys
  FOR ALL USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "audit_logs_org_policy" ON audit_logs
  FOR SELECT USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

-- =====================================================
-- FUNCTIONS & TRIGGERS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables with updated_at
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_entries_updated_at BEFORE UPDATE ON entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tax_calculations_updated_at BEFORE UPDATE ON tax_calculations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_deductions_updated_at BEFORE UPDATE ON deductions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reminders_updated_at BEFORE UPDATE ON reminders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pos_products_updated_at BEFORE UPDATE ON pos_products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bank_accounts_updated_at BEFORE UPDATE ON bank_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to handle new user registration
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_org_id UUID;
BEGIN
  -- Create organization for new user
  INSERT INTO organizations (name, subscription_tier)
  VALUES (COALESCE(NEW.raw_user_meta_data->>'company_name', 'My Business'), 'free')
  RETURNING id INTO new_org_id;
  
  -- Create user profile
  INSERT INTO users (id, organization_id, email, first_name, last_name, role)
  VALUES (
    NEW.id,
    new_org_id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    'owner'
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user registration
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =====================================================
-- STORAGE BUCKETS (run in Supabase Dashboard → Storage)
-- =====================================================
-- Create these buckets manually in Supabase Dashboard:
-- 1. 'documents' - for uploaded invoices, receipts, etc.
-- 2. 'avatars' - for user profile pictures
-- 3. 'logos' - for organization logos

-- Storage policies (run after creating buckets):
-- INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('logos', 'logos', true);
