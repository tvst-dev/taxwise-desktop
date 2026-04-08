/**
 * TaxWise Supabase Service - Production
 */

import { createClient } from '@supabase/supabase-js';
import config from '../config';

// Initialize Supabase client
const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  }
});

export { supabase };
export const getSupabase = () => supabase;
export const isSupabaseConnected = () => !!supabase;

// ==================== AUTH ====================

export const signUp = async (email, password, metadata = {}) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: metadata,
      // Redirect confirmation emails to the Electron app, not localhost:3000
      emailRedirectTo: 'https://www.taxwise.com.ng'
    }
  });
  if (error) throw error;
  return data;
};

export const signIn = async (email, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

export const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  return user;
};

export const getCurrentSession = async () => {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  return session;
};

export const onAuthStateChange = (callback) => {
  return supabase.auth.onAuthStateChange(callback);
};

// ==================== ORGANIZATIONS ====================

export const createOrganization = async (orgData) => {
  const { data, error } = await supabase.from('organizations').insert([orgData]).select().single();
  if (error) throw error;
  return data;
};

export const getOrganization = async (orgId) => {
  const { data, error } = await supabase.from('organizations').select('*').eq('id', orgId).single();
  if (error) throw error;
  return data;
};

export const updateOrganization = async (orgId, updates) => {
  const { data, error } = await supabase.from('organizations').update(updates).eq('id', orgId).select().single();
  if (error) throw error;
  return data;
};

// ==================== USER PROFILES ====================

export const createUserProfile = async (profileData) => {
  const { data, error } = await supabase
    .from('users')
    .upsert([profileData], { onConflict: 'id' })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const getUserProfile = async (userId) => {
  const { data, error } = await supabase.from('users').select('*, organization:organizations(*)').eq('id', userId).single();
  if (error) throw error;
  return data;
};

export const updateUserProfile = async (userId, updates) => {
  const { data, error } = await supabase.from('users').update(updates).eq('id', userId).select().single();
  if (error) throw error;
  return data;
};

// ==================== ENTRIES ====================

export const getEntries = async (orgId, filters = {}) => {
  let query = supabase.from('entries').select('*').eq('organization_id', orgId).order('date', { ascending: false });
  if (filters.entry_type) query = query.eq('entry_type', filters.entry_type);
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.startDate) query = query.gte('date', filters.startDate);
  if (filters.endDate) query = query.lte('date', filters.endDate);
  if (filters.limit) query = query.limit(filters.limit);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

export const createEntry = async (entryData) => {
  const { data, error } = await supabase.from('entries').insert([entryData]).select().single();
  if (error) throw error;
  return data;
};

export const updateEntry = async (entryId, updates) => {
  const { data, error } = await supabase.from('entries').update(updates).eq('id', entryId).select().single();
  if (error) throw error;
  return data;
};

export const deleteEntry = async (entryId) => {
  const { error } = await supabase.from('entries').delete().eq('id', entryId);
  if (error) throw error;
};

// ==================== TAX CALCULATIONS ====================

export const getTaxCalculations = async (orgId, filters = {}) => {
  let query = supabase.from('tax_calculations').select('*').eq('organization_id', orgId).order('created_at', { ascending: false });
  if (filters.tax_type) query = query.eq('tax_type', filters.tax_type);
  if (filters.limit) query = query.limit(filters.limit);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

export const createTaxCalculation = async (calcData) => {
  const { data, error } = await supabase.from('tax_calculations').insert([calcData]).select().single();
  if (error) throw error;
  return data;
};

export const deleteTaxCalculation = async (calcId) => {
  const { error } = await supabase.from('tax_calculations').delete().eq('id', calcId);
  if (error) throw error;
};

// ==================== DEDUCTIONS ====================

export const getDeductions = async (orgId) => {
  const { data, error } = await supabase.from('deductions').select('*').eq('organization_id', orgId).order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
};

export const createDeduction = async (deductionData) => {
  const { data, error } = await supabase.from('deductions').insert([deductionData]).select().single();
  if (error) throw error;
  return data;
};

export const updateDeduction = async (deductionId, updates) => {
  const { data, error } = await supabase.from('deductions').update(updates).eq('id', deductionId).select().single();
  if (error) throw error;
  return data;
};

export const deleteDeduction = async (deductionId) => {
  const { error } = await supabase.from('deductions').delete().eq('id', deductionId);
  if (error) throw error;
};

// ==================== DOCUMENTS ====================

export const getDocuments = async (orgId) => {
  const { data, error } = await supabase.from('documents').select('*').eq('organization_id', orgId).order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
};

export const createDocument = async (docData) => {
  const { data, error } = await supabase.from('documents').insert([docData]).select().single();
  if (error) throw error;
  return data;
};

export const updateDocument = async (docId, updates) => {
  const { data, error } = await supabase.from('documents').update(updates).eq('id', docId).select().single();
  if (error) throw error;
  return data;
};

export const deleteDocument = async (docId) => {
  const { error } = await supabase.from('documents').delete().eq('id', docId);
  if (error) throw error;
};

// ==================== BANK ACCOUNTS ====================

export const getBankAccounts = async (orgId) => {
  const { data, error } = await supabase.from('bank_accounts').select('*').eq('organization_id', orgId);
  if (error) throw error;
  return data || [];
};

export const createBankAccount = async (accountData) => {
  const { data, error } = await supabase.from('bank_accounts').insert([accountData]).select().single();
  if (error) throw error;
  return data;
};

export const getBankTransactions = async (accountId, filters = {}) => {
  let query = supabase.from('bank_transactions').select('*').eq('bank_account_id', accountId).order('date', { ascending: false });
  if (filters.limit) query = query.limit(filters.limit);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

// ==================== POS ====================

export const getProducts = async (orgId) => {
  const { data, error } = await supabase.from('pos_products').select('*').eq('organization_id', orgId).order('name');
  if (error) throw error;
  return data || [];
};

export const createProduct = async (productData) => {
  const { data, error } = await supabase.from('pos_products').insert([productData]).select().single();
  if (error) throw error;
  return data;
};

export const updateProduct = async (productId, updates) => {
  const { data, error } = await supabase.from('pos_products').update(updates).eq('id', productId).select().single();
  if (error) throw error;
  return data;
};

export const deleteProduct = async (productId) => {
  const { error } = await supabase.from('pos_products').delete().eq('id', productId);
  if (error) throw error;
};

export const createPOSTransaction = async (transactionData) => {
  const { data, error } = await supabase.from('pos_transactions').insert([transactionData]).select().single();
  if (error) throw error;
  return data;
};

export const getPOSTransactions = async (orgId, filters = {}) => {
  let query = supabase.from('pos_transactions').select('*').eq('organization_id', orgId).order('created_at', { ascending: false });
  if (filters.limit) query = query.limit(filters.limit);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

// ==================== REMINDERS ====================

export const getReminders = async (orgId) => {
  const { data, error } = await supabase.from('reminders').select('*').eq('organization_id', orgId).order('due_date');
  if (error) throw error;
  return data || [];
};

export const createReminder = async (reminderData) => {
  const { data, error } = await supabase.from('reminders').insert([reminderData]).select().single();
  if (error) throw error;
  return data;
};

export const updateReminder = async (reminderId, updates) => {
  const { data, error } = await supabase.from('reminders').update(updates).eq('id', reminderId).select().single();
  if (error) throw error;
  return data;
};

export const deleteReminder = async (reminderId) => {
  const { error } = await supabase.from('reminders').delete().eq('id', reminderId);
  if (error) throw error;
};

// ==================== TEAM ====================

export const getTeamMembers = async (orgId) => {
  const { data, error } = await supabase.from('users').select('*').eq('organization_id', orgId);
  if (error) throw error;
  return data || [];
};

export const inviteTeamMember = async (orgId, email, role, invitedBy = null) => {
  const token = crypto.randomUUID();
  const { data, error } = await supabase
    .from('team_invitations')
    .insert([{
      organization_id: orgId,
      email,
      role,
      status: 'pending',
      token,
      invited_by: invitedBy,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    }])
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const getInvitations = async (orgId) => {
  const { data, error } = await supabase
    .from('team_invitations')
    .select('*')
    .eq('organization_id', orgId)
    .eq('status', 'pending');
  if (error) throw error;
  return data || [];
};

export const cancelInvitation = async (invitationId) => {
  const { error } = await supabase
    .from('team_invitations')
    .update({ status: 'cancelled' })
    .eq('id', invitationId);
  if (error) throw error;
};

export const sendTeamInvite = async (email, role, organizationId, organizationName, inviterName) => {
  // send-invite uses the SERVICE_ROLE_KEY internally and does not need user-level auth.
  // Always use the anon key as the Bearer token — it is a long-lived (2036) valid JWT
  // signed by this project and never expires the way user access tokens do.
  // Using the user's access_token caused "Invalid JWT" when the session was stale.
  const response = await fetch(`${config.SUPABASE_URL}/functions/v1/send-invite`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': config.SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${config.SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ email, role, organizationId, organizationName, inviterName }),
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    const msg = errBody.error_description || errBody.msg || errBody.error || errBody.message || `Invite failed (${response.status})`;
    throw new Error(msg);
  }
  return response.json();
};

export const acceptInvitation = async (email) => {
  // Mark any pending invitation for this email as accepted
  const { error } = await supabase
    .from('team_invitations')
    .update({ status: 'accepted' })
    .eq('email', email)
    .eq('status', 'pending');
  if (error) console.warn('acceptInvitation error:', error.message);
};

// ==================== SUBSCRIPTIONS ====================

export const getSubscription = async (orgId) => {
  const { data, error } = await supabase.from('subscriptions').select('*').eq('organization_id', orgId).eq('status', 'active').single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
};

export const createSubscription = async (subscriptionData) => {
  const { data, error } = await supabase.from('subscriptions').insert([subscriptionData]).select().single();
  if (error) throw error;
  return data;
};

// ==================== EDGE FUNCTIONS ====================

export const extractDocument = async (imageBase64, mimeType, documentType) => {
  // Get current session for auth token
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('Not authenticated');
  }
  
  const response = await fetch(`${config.SUPABASE_URL}/functions/v1/extract-document`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
      'apikey': config.SUPABASE_ANON_KEY
    },
    body: JSON.stringify({ imageBase64, mimeType, documentType })
  });
  
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Extraction failed' }));
    throw new Error(err.error || 'Document extraction failed');
  }
  return response.json();
};

export const initializePayment = async (email, amount, planCode, metadata = {}) => {
  // Get current session for auth token
  const { data: { session } } = await supabase.auth.getSession();
  
  const headers = {
    'Content-Type': 'application/json',
    'apikey': config.SUPABASE_ANON_KEY
  };
  
  // Add auth token if logged in
  if (session) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }
  
  const response = await fetch(`${config.SUPABASE_URL}/functions/v1/paystack`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action: 'initialize', email, amount, plan: planCode, metadata })
  });
  
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Payment failed' }));
    throw new Error(err.error || 'Payment initialization failed');
  }
  return response.json();
};

export const verifyPayment = async (reference) => {
  const response = await fetch(`${config.SUPABASE_URL}/functions/v1/paystack`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      'apikey': config.SUPABASE_ANON_KEY
    },
    body: JSON.stringify({ action: 'verify', reference })
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Verification failed' }));
    throw new Error(err.error || 'Payment verification failed');
  }
  return response.json();
};

// ==================== ANALYTICS ====================

export const getEntrySummary = async (orgId, startDate, endDate) => {
  const { data, error } = await supabase.from('entries').select('entry_type, category, amount, date').eq('organization_id', orgId).gte('date', startDate).lte('date', endDate);
  if (error) throw error;
  const entries = data || [];
  const income = entries.filter(e => e.entry_type === 'income').reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
  const expenses = entries.filter(e => e.entry_type === 'expense').reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
  return { income, expenses, net: income - expenses, entries };
};

// ==================== AI CHAT ASSISTANT ====================

export const chatWithAssistant = async (messages, context = {}) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

  // Only send the last 10 messages to avoid huge payloads
  const recentMessages = messages.slice(-10);

  try {
    const response = await fetch(`${config.SUPABASE_URL}/functions/v1/chat-assistant`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
        'apikey': config.SUPABASE_ANON_KEY
      },
      body: JSON.stringify({ messages: recentMessages, context }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Chat failed' }));
      throw new Error(err.error || 'Chat assistant unavailable');
    }
    return response.json();
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('Request timed out. Please try again.');
    }
    throw err;
  }
};

// ==================== PASSWORD RESET ====================

export const resetPasswordRequest = async (email) => {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: 'https://www.taxwise.com.ng'
  });
  if (error) throw error;
  return data;
};

export const updatePassword = async (newPassword) => {
  const { data, error } = await supabase.auth.updateUser({
    password: newPassword
  });
  if (error) throw error;
  return data;
};

// Handle taxwise:// deep link — extract tokens and establish session
export const handleDeepLink = async (url) => {
  const hashIndex = url.indexOf('#');
  if (hashIndex === -1) return null;

  const params = new URLSearchParams(url.slice(hashIndex + 1));
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  const type = params.get('type'); // 'recovery' | 'signup' | 'magiclink'

  if (!accessToken || !refreshToken) return null;

  const { data, error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken
  });
  if (error) throw error;

  return { session: data.session, type };
};

export default supabase;
