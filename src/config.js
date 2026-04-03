/**
 * TaxWise Production Configuration
 */

const config = {
  // Supabase - Production Credentials
  SUPABASE_URL: 'https://xgicdlwxjkqtarfytbgz.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhnaWNkbHd4amtxdGFyZnl0Ymd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzNzU0NzcsImV4cCI6MjA4NTk1MTQ3N30.tDNwtvRXLA5-BSJgQnsiOFAw2XFK7vBXaOLL5qh3GlU',
  // Service role key — used only for admin operations (team invites).
  // Get this from: Supabase Dashboard → Settings → API → service_role (secret)
  SUPABASE_SERVICE_ROLE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhnaWNkbHd4amtxdGFyZnl0Ymd6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDM3NTQ3NywiZXhwIjoyMDg1OTUxNDc3fQ.iygHYyAs71V7Tp4VFMoOZGFVU2HqwPCVEkO34zNvewM',

  // Mono Bank Integration
  // Configure these when available, then set MONO_CONFIGURED to true
  MONO_PUBLIC_KEY: '',
  MONO_CONFIGURED: false,

  // App Info
  APP_NAME: 'TaxWise',
  APP_VERSION: '1.0.0',

  // Web Auth URL — hosted URL for invite acceptance & password reset
  // After deploying web/ to Vercel/Netlify, paste the URL here (no trailing slash)
  // Example: 'https://taxwise-auth.vercel.app'
  WEB_AUTH_URL: 'https://taxwise-auth.vercel.app',

  // Subscription Plans (Paystack plan codes)
  PLANS: {
    startup:   { id: 'taxwise_startup',   name: 'Startup',   price: 10000, interval: 'monthly' },
    sme:       { id: 'taxwise_sme',       name: 'SME',       price: 25000, interval: 'monthly' },
    corporate: { id: 'taxwise_corporate', name: 'Corporate', price: 60000, interval: 'monthly' }
  },

  // Trial period in days
  TRIAL_DAYS: 14,

  // Card verification amount for trial signup (₦100 — Paystack minimum)
  CARD_VERIFICATION_AMOUNT: 100
};

export default config;
