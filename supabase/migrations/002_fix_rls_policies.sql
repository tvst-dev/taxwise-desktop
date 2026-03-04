-- =====================================================
-- FIX RLS POLICIES — Explicit INSERT WITH CHECK
-- =====================================================
-- Replaces all FOR ALL USING (...) shorthand policies
-- with explicit per-operation policies that include a
-- proper WITH CHECK clause for INSERT.
--
-- Special case: bank_transactions has no organization_id
-- column — it is secured via bank_account_id instead.
--
-- Idempotent: safe to re-run at any time.
-- Run this in: Supabase Dashboard → SQL Editor
-- =====================================================

-- ─── TAX CALCULATIONS ────────────────────────────────
DROP POLICY IF EXISTS "tax_calculations_org_policy" ON tax_calculations;
DROP POLICY IF EXISTS "tax_calculations_select" ON tax_calculations;
DROP POLICY IF EXISTS "tax_calculations_insert" ON tax_calculations;
DROP POLICY IF EXISTS "tax_calculations_update" ON tax_calculations;
DROP POLICY IF EXISTS "tax_calculations_delete" ON tax_calculations;

CREATE POLICY "tax_calculations_select" ON tax_calculations
  FOR SELECT USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "tax_calculations_insert" ON tax_calculations
  FOR INSERT WITH CHECK (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "tax_calculations_update" ON tax_calculations
  FOR UPDATE USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "tax_calculations_delete" ON tax_calculations
  FOR DELETE USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));


-- ─── DEDUCTIONS ──────────────────────────────────────
DROP POLICY IF EXISTS "deductions_org_policy" ON deductions;
DROP POLICY IF EXISTS "deductions_select" ON deductions;
DROP POLICY IF EXISTS "deductions_insert" ON deductions;
DROP POLICY IF EXISTS "deductions_update" ON deductions;
DROP POLICY IF EXISTS "deductions_delete" ON deductions;

CREATE POLICY "deductions_select" ON deductions
  FOR SELECT USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "deductions_insert" ON deductions
  FOR INSERT WITH CHECK (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "deductions_update" ON deductions
  FOR UPDATE USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "deductions_delete" ON deductions
  FOR DELETE USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));


-- ─── REMINDERS ───────────────────────────────────────
DROP POLICY IF EXISTS "reminders_org_policy" ON reminders;
DROP POLICY IF EXISTS "reminders_select" ON reminders;
DROP POLICY IF EXISTS "reminders_insert" ON reminders;
DROP POLICY IF EXISTS "reminders_update" ON reminders;
DROP POLICY IF EXISTS "reminders_delete" ON reminders;

CREATE POLICY "reminders_select" ON reminders
  FOR SELECT USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "reminders_insert" ON reminders
  FOR INSERT WITH CHECK (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "reminders_update" ON reminders
  FOR UPDATE USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "reminders_delete" ON reminders
  FOR DELETE USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));


-- ─── DOCUMENTS ───────────────────────────────────────
DROP POLICY IF EXISTS "documents_org_policy" ON documents;
DROP POLICY IF EXISTS "documents_select" ON documents;
DROP POLICY IF EXISTS "documents_insert" ON documents;
DROP POLICY IF EXISTS "documents_update" ON documents;
DROP POLICY IF EXISTS "documents_delete" ON documents;

CREATE POLICY "documents_select" ON documents
  FOR SELECT USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "documents_insert" ON documents
  FOR INSERT WITH CHECK (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "documents_update" ON documents
  FOR UPDATE USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "documents_delete" ON documents
  FOR DELETE USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));


-- ─── POS PRODUCTS ────────────────────────────────────
DROP POLICY IF EXISTS "pos_products_org_policy" ON pos_products;
DROP POLICY IF EXISTS "pos_products_select" ON pos_products;
DROP POLICY IF EXISTS "pos_products_insert" ON pos_products;
DROP POLICY IF EXISTS "pos_products_update" ON pos_products;
DROP POLICY IF EXISTS "pos_products_delete" ON pos_products;

CREATE POLICY "pos_products_select" ON pos_products
  FOR SELECT USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "pos_products_insert" ON pos_products
  FOR INSERT WITH CHECK (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "pos_products_update" ON pos_products
  FOR UPDATE USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "pos_products_delete" ON pos_products
  FOR DELETE USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));


-- ─── POS TRANSACTIONS ────────────────────────────────
DROP POLICY IF EXISTS "pos_transactions_org_policy" ON pos_transactions;
DROP POLICY IF EXISTS "pos_transactions_select" ON pos_transactions;
DROP POLICY IF EXISTS "pos_transactions_insert" ON pos_transactions;
DROP POLICY IF EXISTS "pos_transactions_update" ON pos_transactions;
DROP POLICY IF EXISTS "pos_transactions_delete" ON pos_transactions;

CREATE POLICY "pos_transactions_select" ON pos_transactions
  FOR SELECT USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "pos_transactions_insert" ON pos_transactions
  FOR INSERT WITH CHECK (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "pos_transactions_update" ON pos_transactions
  FOR UPDATE USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "pos_transactions_delete" ON pos_transactions
  FOR DELETE USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));


-- ─── BANK ACCOUNTS ───────────────────────────────────
DROP POLICY IF EXISTS "bank_accounts_org_policy" ON bank_accounts;
DROP POLICY IF EXISTS "bank_accounts_select" ON bank_accounts;
DROP POLICY IF EXISTS "bank_accounts_insert" ON bank_accounts;
DROP POLICY IF EXISTS "bank_accounts_update" ON bank_accounts;
DROP POLICY IF EXISTS "bank_accounts_delete" ON bank_accounts;

CREATE POLICY "bank_accounts_select" ON bank_accounts
  FOR SELECT USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "bank_accounts_insert" ON bank_accounts
  FOR INSERT WITH CHECK (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "bank_accounts_update" ON bank_accounts
  FOR UPDATE USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "bank_accounts_delete" ON bank_accounts
  FOR DELETE USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));


-- ─── BANK TRANSACTIONS (no organization_id — join via bank_accounts) ───────
DROP POLICY IF EXISTS "bank_transactions_org_policy" ON bank_transactions;
DROP POLICY IF EXISTS "bank_transactions_select" ON bank_transactions;
DROP POLICY IF EXISTS "bank_transactions_insert" ON bank_transactions;
DROP POLICY IF EXISTS "bank_transactions_update" ON bank_transactions;
DROP POLICY IF EXISTS "bank_transactions_delete" ON bank_transactions;

CREATE POLICY "bank_transactions_select" ON bank_transactions
  FOR SELECT USING (
    bank_account_id IN (
      SELECT id FROM bank_accounts
      WHERE organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    )
  );

CREATE POLICY "bank_transactions_insert" ON bank_transactions
  FOR INSERT WITH CHECK (
    bank_account_id IN (
      SELECT id FROM bank_accounts
      WHERE organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    )
  );

CREATE POLICY "bank_transactions_update" ON bank_transactions
  FOR UPDATE USING (
    bank_account_id IN (
      SELECT id FROM bank_accounts
      WHERE organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    )
  );

CREATE POLICY "bank_transactions_delete" ON bank_transactions
  FOR DELETE USING (
    bank_account_id IN (
      SELECT id FROM bank_accounts
      WHERE organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    )
  );


-- ─── SUBSCRIPTION PAYMENTS ───────────────────────────
DROP POLICY IF EXISTS "subscription_payments_org_policy" ON subscription_payments;
DROP POLICY IF EXISTS "subscription_payments_select" ON subscription_payments;
DROP POLICY IF EXISTS "subscription_payments_insert" ON subscription_payments;
DROP POLICY IF EXISTS "subscription_payments_update" ON subscription_payments;

CREATE POLICY "subscription_payments_select" ON subscription_payments
  FOR SELECT USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "subscription_payments_insert" ON subscription_payments
  FOR INSERT WITH CHECK (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "subscription_payments_update" ON subscription_payments
  FOR UPDATE USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));


-- ─── TEAM INVITATIONS ────────────────────────────────
DROP POLICY IF EXISTS "team_invitations_org_policy" ON team_invitations;
DROP POLICY IF EXISTS "team_invitations_select" ON team_invitations;
DROP POLICY IF EXISTS "team_invitations_insert" ON team_invitations;
DROP POLICY IF EXISTS "team_invitations_update" ON team_invitations;
DROP POLICY IF EXISTS "team_invitations_delete" ON team_invitations;

CREATE POLICY "team_invitations_select" ON team_invitations
  FOR SELECT USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "team_invitations_insert" ON team_invitations
  FOR INSERT WITH CHECK (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "team_invitations_update" ON team_invitations
  FOR UPDATE USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "team_invitations_delete" ON team_invitations
  FOR DELETE USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));


-- ─── API KEYS ────────────────────────────────────────
DROP POLICY IF EXISTS "api_keys_org_policy" ON api_keys;
DROP POLICY IF EXISTS "api_keys_select" ON api_keys;
DROP POLICY IF EXISTS "api_keys_insert" ON api_keys;
DROP POLICY IF EXISTS "api_keys_update" ON api_keys;
DROP POLICY IF EXISTS "api_keys_delete" ON api_keys;

CREATE POLICY "api_keys_select" ON api_keys
  FOR SELECT USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "api_keys_insert" ON api_keys
  FOR INSERT WITH CHECK (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "api_keys_update" ON api_keys
  FOR UPDATE USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "api_keys_delete" ON api_keys
  FOR DELETE USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));
