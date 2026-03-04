# TaxWise Deployment Guide

Complete guide to deploying TaxWise with Supabase backend.

## 📋 Prerequisites

- Node.js 18+ installed
- Supabase account (free tier works)
- OpenAI account with API key
- Paystack account (for payments)

---

## 🚀 Step 1: Supabase Setup

### 1.1 Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Sign in or create an account
3. Click **"New Project"**
4. Enter project details:
   - Name: `taxwise-production`
   - Database Password: (save this securely)
   - Region: Choose closest to Nigeria (e.g., Frankfurt)
5. Wait for project to be created (~2 minutes)

### 1.2 Run Database Migration

1. In Supabase Dashboard, go to **SQL Editor**
2. Click **"New Query"**
3. Copy the entire contents of `supabase/migrations/001_initial_schema.sql`
4. Paste into the SQL Editor
5. Click **"Run"**
6. Verify tables are created in **Table Editor**

### 1.3 Create Storage Buckets

1. Go to **Storage** in Supabase Dashboard
2. Create these buckets:
   - `documents` (Private) - for uploaded invoices/receipts
   - `avatars` (Public) - for profile pictures
   - `logos` (Public) - for organization logos

### 1.4 Get API Credentials

1. Go to **Settings → API**
2. Copy these values:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon/public key**: `eyJhbGc...`

---

## 🔧 Step 2: Deploy Edge Functions

### 2.1 Install Supabase CLI

```bash
# macOS
brew install supabase/tap/supabase

# Windows (using Scoop)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# Or using npm
npm install -g supabase
```

### 2.2 Login to Supabase CLI

```bash
supabase login
```

### 2.3 Link to Your Project

```bash
cd taxwise-desktop
supabase link --project-ref YOUR_PROJECT_REF
```

> Find your project ref in Settings → General → Reference ID

### 2.4 Set Environment Variables (Secrets)

```bash
# OpenAI API Key (for document AI extraction)
supabase secrets set OPENAI_API_KEY=sk-your-openai-api-key

# Paystack Secret Key (for payment processing)
supabase secrets set PAYSTACK_SECRET_KEY=sk_live_your-paystack-secret-key

# App URL (for callbacks)
supabase secrets set APP_URL=https://taxwise.com.ng
```

### 2.5 Deploy Edge Functions

```bash
supabase functions deploy extract-document
supabase functions deploy paystack
```

### 2.6 Verify Deployment

In Supabase Dashboard → **Edge Functions**, you should see:
- `extract-document` - Active
- `paystack` - Active

---

## 💳 Step 3: Paystack Setup

### 3.1 Create Paystack Account

1. Go to [paystack.com](https://paystack.com)
2. Sign up for a business account
3. Complete verification

### 3.2 Create Subscription Plans

In Paystack Dashboard → **Products → Plans**:

1. Create **SME Plan**:
   - Name: `TaxWise SME`
   - Plan Code: `taxwise_sme`
   - Amount: ₦24,999
   - Interval: Monthly

2. Create **Enterprise Plan**:
   - Name: `TaxWise Enterprise`
   - Plan Code: `taxwise_enterprise`
   - Amount: ₦49,999
   - Interval: Monthly

### 3.3 Configure Webhook

1. Go to **Settings → API Keys & Webhooks**
2. Add Webhook URL:
   ```
   https://YOUR_PROJECT_REF.supabase.co/functions/v1/paystack/webhook
   ```
3. Select events: `charge.success`, `subscription.create`, `subscription.disable`

---

## 🤖 Step 4: OpenAI Setup

1. Go to [platform.openai.com](https://platform.openai.com)
2. Create an API key
3. Set usage limits (recommended: $20-50/month)

---

## 💻 Step 5: Configure & Build the App

### 5.1 Install Dependencies

```bash
cd taxwise-desktop
npm install
```

### 5.2 Configure Supabase Credentials

**Open `src/config.js` and update with your credentials:**

```javascript
const config = {
  SUPABASE_URL: 'https://your-project-id.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  APP_NAME: 'TaxWise',
  APP_VERSION: '1.0.0'
};
```

### 5.3 Development Mode

```bash
npm run dev
```

### 5.4 Build for Production

```bash
npm run build:win   # Windows
npm run build:mac   # macOS
npm run build:linux # Linux
```

---

## 📁 Configuration Summary

| Location | Config | Description |
|----------|--------|-------------|
| `src/config.js` | `SUPABASE_URL` | Your Supabase project URL |
| `src/config.js` | `SUPABASE_ANON_KEY` | Your Supabase anon/public key |
| Supabase CLI | `OPENAI_API_KEY` | OpenAI API key (secret) |
| Supabase CLI | `PAYSTACK_SECRET_KEY` | Paystack secret key (secret) |

---

## ✅ Deployment Checklist

- [ ] Supabase project created
- [ ] Database migration run
- [ ] Storage buckets created
- [ ] Edge Functions deployed via CLI
- [ ] `OPENAI_API_KEY` secret set
- [ ] `PAYSTACK_SECRET_KEY` secret set
- [ ] Paystack plans created
- [ ] Paystack webhook configured
- [ ] `src/config.js` updated with Supabase credentials
- [ ] App built and tested
