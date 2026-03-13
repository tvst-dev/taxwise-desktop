-- =====================================================
-- Migration 002: Trial columns, card storage, subscriptions table
-- Safe to run on fresh or existing DB — uses IF NOT EXISTS / IF EXISTS
-- Run: paste into Supabase Dashboard > SQL Editor
-- =====================================================

-- ─── 1. Add missing columns to organizations ─────────────────────────────────
-- These are written by the Paystack edge function after card verification

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paystack_customer_code VARCHAR(100),
  ADD COLUMN IF NOT EXISTS paystack_authorization_code TEXT,
  ADD COLUMN IF NOT EXISTS paystack_subscription_code VARCHAR(100),
  ADD COLUMN IF NOT EXISTS card_last4 VARCHAR(4),
  ADD COLUMN IF NOT EXISTS card_brand VARCHAR(50),
  ADD COLUMN IF NOT EXISTS card_exp_month VARCHAR(2),
  ADD COLUMN IF NOT EXISTS card_exp_year VARCHAR(4);

-- ─── 2. Relax subscription_tier to support new tiers ─────────────────────────
-- 001_initial_schema had no CHECK constraint on this column, so DROP is a no-op
ALTER TABLE organizations
  DROP CONSTRAINT IF EXISTS organizations_subscription_tier_check;

ALTER TABLE organizations
  ADD CONSTRAINT organizations_subscription_tier_check
  CHECK (subscription_tier IN ('free', 'startup', 'sme', 'corporate', 'enterprise'));

-- ─── 3. Relax subscription_status to support trial / past_due ────────────────
ALTER TABLE organizations
  DROP CONSTRAINT IF EXISTS organizations_subscription_status_check;

ALTER TABLE organizations
  ADD CONSTRAINT organizations_subscription_status_check
  CHECK (subscription_status IN ('pending', 'trial', 'active', 'past_due', 'expired', 'cancelled'));

-- ─── 4. Create subscriptions table ───────────────────────────────────────────
-- Stores the current subscription state per organisation (one row per org).
-- The edge function upserts here on verify / charge_authorization / webhook.

CREATE TABLE IF NOT EXISTS subscriptions (
  id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id             UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  plan_code                   VARCHAR(100),
  paystack_customer_code      VARCHAR(100),
  paystack_authorization_code TEXT,
  paystack_subscription_code  VARCHAR(100),
  status                      VARCHAR(50) DEFAULT 'trial',
  current_period_start        TIMESTAMPTZ,
  current_period_end          TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_org ON subscriptions(organization_id);

-- updated_at trigger
DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── 5. RLS on subscriptions ──────────────────────────────────────────────────
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subscriptions_select" ON subscriptions;
DROP POLICY IF EXISTS "subscriptions_insert" ON subscriptions;
DROP POLICY IF EXISTS "subscriptions_update" ON subscriptions;

CREATE POLICY "subscriptions_select" ON subscriptions
  FOR SELECT USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "subscriptions_insert" ON subscriptions
  FOR INSERT WITH CHECK (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "subscriptions_update" ON subscriptions
  FOR UPDATE USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));
