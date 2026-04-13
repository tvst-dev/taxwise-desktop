/**
 * TaxWise Data Sync Service
 * Loads and syncs data between Supabase and local stores
 */

import * as db from './supabase';
import {
  useEntriesStore,
  useTaxStore,
  useRemindersStore,
  useDeductionsStore,
  usePOSStore,
  useDocumentsStore,
  useTeamStore,
  useBankStore,
  useSettingsStore
} from '../store';

/**
 * Load all organization data from Supabase
 * Call this after user login
 */
export const loadOrganizationData = async (organizationId) => {
  if (!organizationId) {
    console.warn('No organization ID provided');
    return;
  }

  try {
    // Load entries
    const entries = await db.getEntries(organizationId);
    useEntriesStore.getState().setEntries(entries);

    // Load tax calculations
    const calculations = await db.getTaxCalculations(organizationId);
    useTaxStore.getState().setCalculations(calculations);

    // Load reminders
    const reminders = await db.getReminders(organizationId);
    useRemindersStore.getState().setReminders(reminders);

    // Load products — normalize DB column names to local store field names
    const rawProducts = await db.getProducts(organizationId);
    const products = rawProducts.map(p => ({
      ...p,
      stock: p.stock_quantity,
      vatApplicable: p.is_vat_applicable
    }));
    usePOSStore.getState().setProducts(products);

    // Load deductions — merge with any local-only fallback items (ids start with 'ded_')
    const deductions = await db.getDeductions(organizationId);
    const localOnlyDeductions = useDeductionsStore.getState().deductions
      .filter(d => typeof d.id === 'string' && d.id.startsWith('ded_'));
    useDeductionsStore.getState().setDeductions([...deductions, ...localOnlyDeductions]);

    // Load documents
    const documents = await db.getDocuments(organizationId);
    useDocumentsStore.getState().setDocuments(documents);

    // Load bank accounts
    try {
      const accounts = await db.getBankAccounts(organizationId);
      useBankStore.getState().setAccounts(accounts || []);
    } catch (e) {
      console.warn('Bank accounts load failed:', e.message);
    }

    // Load team members
    try {
      const members = await db.getTeamMembers(organizationId);
      useTeamStore.getState().setMembers(members || []);
    } catch (e) {
      console.warn('Team members load failed:', e.message);
    }

    // Load pending invitations
    try {
      const invitations = await db.getInvitations(organizationId);
      useTeamStore.getState().setInvitations(invitations || []);
    } catch (e) {
      console.warn('Invitations load failed:', e.message);
    }

    console.log('Organization data loaded successfully');

  } catch (error) {
    console.error('Error loading organization data:', error);
    throw error;
  }
};

/**
 * Clear all local data (on logout) - wipes every persisted store
 */
export const clearLocalData = () => {
  useEntriesStore.getState().setEntries([]);
  useTaxStore.getState().setCalculations([]);
  useRemindersStore.getState().setReminders([]);
  useDeductionsStore.getState().setDeductions([]);
  usePOSStore.getState().setProducts([]);
  usePOSStore.getState().clearCart();
  useDocumentsStore.getState().setDocuments([]);
  useTeamStore.getState().setMembers([]);
  useBankStore.getState().setAccounts([]);
  useBankStore.getState().setTransactions([]);
  useSettingsStore.getState().resetSettings();
};

/**
 * Sync helpers for individual operations
 */

// Entries
export const syncCreateEntry = async (entryData, organizationId) => {
  const entry = await db.createEntry({
    ...entryData,
    organization_id: organizationId
  });
  useEntriesStore.getState().addEntry(entry);
  return entry;
};

export const syncUpdateEntry = async (entryId, updates) => {
  const entry = await db.updateEntry(entryId, updates);
  useEntriesStore.getState().updateEntry(entryId, entry);
  return entry;
};

export const syncDeleteEntry = async (entryId) => {
  await db.deleteEntry(entryId);
  useEntriesStore.getState().removeEntry(entryId);
};

// Tax Calculations
export const syncCreateTaxCalculation = async (calcData, organizationId) => {
  const calc = await db.createTaxCalculation({
    ...calcData,
    organization_id: organizationId
  });
  useTaxStore.getState().addCalculation(calc);
  return calc;
};

// Reminders
export const syncCreateReminder = async (reminderData, organizationId) => {
  const reminder = await db.createReminder({
    ...reminderData,
    organization_id: organizationId
  });
  useRemindersStore.getState().addReminder(reminder);
  return reminder;
};

export const syncUpdateReminder = async (reminderId, updates) => {
  const reminder = await db.updateReminder(reminderId, updates);
  useRemindersStore.getState().updateReminder(reminderId, reminder);
  return reminder;
};

export const syncDeleteReminder = async (reminderId) => {
  await db.deleteReminder(reminderId);
  useRemindersStore.getState().removeReminder(reminderId);
};

// Products
export const syncCreateProduct = async (productData, organizationId) => {
  const product = await db.createProduct({
    ...productData,
    organization_id: organizationId
  });
  usePOSStore.getState().addProduct(product);
  return product;
};

export const syncUpdateProduct = async (productId, updates) => {
  const product = await db.updateProduct(productId, updates);
  usePOSStore.getState().updateProduct(productId, product);
  return product;
};

export const syncDeleteProduct = async (productId) => {
  await db.deleteProduct(productId);
  usePOSStore.getState().removeProduct(productId);
};

// POS Transactions
export const syncCreatePOSTransaction = async (transactionData, organizationId) => {
  const transaction = await db.createPOSTransaction({
    ...transactionData,
    organization_id: organizationId
  });
  usePOSStore.getState().addTransaction(transaction);
  
  // Also create an income entry for the sale
  const entry = await db.createEntry({
    organization_id: organizationId,
    entry_type: 'income',
    category: 'Sales',
    amount: transactionData.total,
    date: new Date().toISOString().split('T')[0],
    description: `POS Sale - ${transactionData.items?.length || 0} items`,
    reference_number: transactionData.reference,
    vat_amount: transactionData.vat || 0,
    status: 'approved',
    metadata: { source: 'pos' }
  });
  useEntriesStore.getState().addEntry(entry);
  
  return transaction;
};

// Documents
export const syncCreateDocument = async (docData, organizationId) => {
  const doc = await db.createDocument({
    ...docData,
    organization_id: organizationId
  });
  useDocumentsStore.getState().addDocument(doc);
  return doc;
};

export const syncUpdateDocument = async (docId, updates) => {
  const doc = await db.updateDocument(docId, updates);
  useDocumentsStore.getState().updateDocument(docId, doc);
  return doc;
};

export const syncDeleteDocument = async (docId) => {
  await db.deleteDocument(docId);
  useDocumentsStore.getState().removeDocument(docId);
};

export default {
  loadOrganizationData,
  clearLocalData,
  syncCreateEntry,
  syncUpdateEntry,
  syncDeleteEntry,
  syncCreateTaxCalculation,
  syncCreateReminder,
  syncUpdateReminder,
  syncDeleteReminder,
  syncCreateProduct,
  syncUpdateProduct,
  syncDeleteProduct,
  syncCreatePOSTransaction,
  syncCreateDocument,
  syncUpdateDocument,
  syncDeleteDocument
};
