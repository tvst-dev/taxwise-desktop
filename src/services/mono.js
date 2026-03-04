/**
 * TaxWise Mono Bank Integration Service
 * 
 * Mono allows connecting Nigerian bank accounts for automatic transaction tracking.
 * Configure MONO_PUBLIC_KEY in src/config.js and MONO_SECRET_KEY via Supabase CLI.
 * 
 * Setup:
 * 1. Create account at mono.co
 * 2. Get your public key from dashboard
 * 3. Set in config.js: MONO_PUBLIC_KEY: 'live_pk_xxx'
 * 4. Set secret via CLI: supabase secrets set MONO_SECRET_KEY=live_sk_xxx
 */

import config from '../config';

// Check if Mono is configured
export const isMonoConfigured = () => {
  return config.MONO_PUBLIC_KEY && config.MONO_PUBLIC_KEY.length > 0;
};

// Get Mono public key for Connect widget
export const getMonoPublicKey = () => {
  return config.MONO_PUBLIC_KEY;
};

/**
 * Initialize Mono Connect widget
 * Returns a promise that resolves with the account code when user links account
 */
export const openMonoConnect = (onSuccess, onClose) => {
  return new Promise((resolve, reject) => {
    if (!isMonoConfigured()) {
      reject(new Error('Mono is not configured. Please set MONO_PUBLIC_KEY in config.js'));
      return;
    }

    // Load Mono Connect script if not already loaded
    if (!window.MonoConnect) {
      const script = document.createElement('script');
      script.src = 'https://connect.mono.co/connect.js';
      script.async = true;
      script.onload = () => initConnect(resolve, reject, onSuccess, onClose);
      script.onerror = () => reject(new Error('Failed to load Mono Connect'));
      document.body.appendChild(script);
    } else {
      initConnect(resolve, reject, onSuccess, onClose);
    }
  });
};

const initConnect = (resolve, reject, onSuccess, onClose) => {
  try {
    const monoConnect = new window.MonoConnect({
      key: config.MONO_PUBLIC_KEY,
      onSuccess: (data) => {
        // data.code is the account code to exchange for account ID
        if (onSuccess) onSuccess(data);
        resolve(data);
      },
      onClose: () => {
        if (onClose) onClose();
      },
      onEvent: (event, data) => {
        console.log('Mono event:', event, data);
      }
    });

    monoConnect.setup();
    monoConnect.open();
  } catch (error) {
    reject(error);
  }
};

/**
 * Exchange auth code for account ID (must be done server-side via Edge Function)
 */
export const exchangeToken = async (code) => {
  const response = await fetch(`${config.SUPABASE_URL}/functions/v1/mono`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      'apikey': config.SUPABASE_ANON_KEY
    },
    body: JSON.stringify({ action: 'exchange_token', code })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Exchange failed' }));
    throw new Error(error.error || 'Token exchange failed');
  }

  return response.json();
};

/**
 * Get account details
 */
export const getAccountDetails = async (accountId) => {
  const response = await fetch(`${config.SUPABASE_URL}/functions/v1/mono`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      'apikey': config.SUPABASE_ANON_KEY
    },
    body: JSON.stringify({ action: 'get_account', account_id: accountId })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to get account' }));
    throw new Error(error.error || 'Failed to get account details');
  }

  return response.json();
};

/**
 * Get account transactions
 */
export const getTransactions = async (accountId, options = {}) => {
  const response = await fetch(`${config.SUPABASE_URL}/functions/v1/mono`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      'apikey': config.SUPABASE_ANON_KEY
    },
    body: JSON.stringify({
      action: 'get_transactions',
      account_id: accountId,
      ...options
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to get transactions' }));
    throw new Error(error.error || 'Failed to get transactions');
  }

  return response.json();
};

/**
 * Manually refresh account data
 */
export const syncAccount = async (accountId) => {
  const response = await fetch(`${config.SUPABASE_URL}/functions/v1/mono`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      'apikey': config.SUPABASE_ANON_KEY
    },
    body: JSON.stringify({ action: 'sync', account_id: accountId })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Sync failed' }));
    throw new Error(error.error || 'Failed to sync account');
  }

  return response.json();
};

/**
 * Categorize a transaction for tax purposes
 */
export const categorizeTransaction = (transaction) => {
  const narration = (transaction.narration || '').toLowerCase();
  const type = transaction.type; // 'credit' or 'debit'

  // Tax-relevant categories
  const categories = {
    income: ['salary', 'wage', 'payment received', 'transfer from', 'credit alert'],
    business_expense: ['office', 'supplies', 'equipment', 'software', 'subscription'],
    transport: ['uber', 'bolt', 'fuel', 'petrol', 'transport', 'flight', 'airline'],
    utilities: ['electricity', 'nepa', 'ekedc', 'water', 'internet', 'mtn', 'airtel', 'glo'],
    professional: ['consulting', 'legal', 'accounting', 'audit'],
    bank_charges: ['charge', 'fee', 'stamp duty', 'vat', 'maintenance'],
    tax: ['firs', 'tax', 'irs', 'revenue']
  };

  for (const [category, keywords] of Object.entries(categories)) {
    if (keywords.some(kw => narration.includes(kw))) {
      return category;
    }
  }

  return type === 'credit' ? 'other_income' : 'other_expense';
};

export default {
  isMonoConfigured,
  getMonoPublicKey,
  openMonoConnect,
  exchangeToken,
  getAccountDetails,
  getTransactions,
  syncAccount,
  categorizeTransaction
};
