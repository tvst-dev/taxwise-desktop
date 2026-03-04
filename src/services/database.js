/**
 * Database Service
 * Handles all database operations through Electron IPC
 */

const { v4: uuidv4 } = require('uuid');

// Access the electron API exposed via preload
const getDB = () => window.electronAPI?.db;

// ==================== GENERIC OPERATIONS ====================

export async function query(sql, params = []) {
  const db = getDB();
  if (!db) throw new Error('Database not available');
  return await db.query(sql, params);
}

export async function run(sql, params = []) {
  const db = getDB();
  if (!db) throw new Error('Database not available');
  return await db.run(sql, params);
}

export async function get(sql, params = []) {
  const db = getDB();
  if (!db) throw new Error('Database not available');
  return await db.get(sql, params);
}

export async function all(sql, params = []) {
  const db = getDB();
  if (!db) throw new Error('Database not available');
  return await db.all(sql, params);
}

// ==================== ORGANIZATION OPERATIONS ====================

export async function createOrganization(data) {
  const id = uuidv4();
  const sql = `
    INSERT INTO organizations (
      id, name, rc_number, tin, entity_type, industry, address, city, state,
      phone, email, website, annual_turnover, subscription_tier, subscription_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const params = [
    id, data.name, data.rcNumber, data.tin, data.entityType, data.industry,
    data.address, data.city, data.state, data.phone, data.email, data.website,
    data.annualTurnover || 0, data.subscriptionTier || 'free', 'active'
  ];
  
  await run(sql, params);
  return { id, ...data };
}

export async function getOrganization(id) {
  const result = await get('SELECT * FROM organizations WHERE id = ?', [id]);
  return result.data;
}

export async function updateOrganization(id, data) {
  const fields = Object.keys(data).map(key => `${key} = ?`).join(', ');
  const values = [...Object.values(data), id];
  await run(`UPDATE organizations SET ${fields}, updated_at = datetime('now') WHERE id = ?`, values);
}

// ==================== USER OPERATIONS ====================

export async function createUser(data) {
  const id = uuidv4();
  const bcrypt = require('bcryptjs');
  const passwordHash = await bcrypt.hash(data.password, 10);
  
  const sql = `
    INSERT INTO users (
      id, organization_id, email, password_hash, first_name, last_name,
      role, department, phone
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const params = [
    id, data.organizationId, data.email, passwordHash, data.firstName,
    data.lastName, data.role || 'viewer', data.department, data.phone
  ];
  
  await run(sql, params);
  return { id, email: data.email, firstName: data.firstName, lastName: data.lastName, role: data.role };
}

export async function getUserByEmail(email) {
  const result = await get('SELECT * FROM users WHERE email = ?', [email]);
  return result.data;
}

export async function getUser(id) {
  const result = await get('SELECT * FROM users WHERE id = ?', [id]);
  return result.data;
}

export async function getUsersByOrganization(organizationId) {
  const result = await all('SELECT * FROM users WHERE organization_id = ? ORDER BY created_at DESC', [organizationId]);
  return result.data || [];
}

export async function updateUser(id, data) {
  const allowedFields = ['first_name', 'last_name', 'role', 'department', 'phone', 'is_active', 'avatar_url'];
  const updateData = {};
  Object.keys(data).forEach(key => {
    const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    if (allowedFields.includes(snakeKey)) {
      updateData[snakeKey] = data[key];
    }
  });
  
  if (Object.keys(updateData).length === 0) return;
  
  const fields = Object.keys(updateData).map(key => `${key} = ?`).join(', ');
  const values = [...Object.values(updateData), id];
  await run(`UPDATE users SET ${fields}, updated_at = datetime('now') WHERE id = ?`, values);
}

export async function validatePassword(email, password) {
  const user = await getUserByEmail(email);
  if (!user) return null;
  
  const bcrypt = require('bcryptjs');
  const isValid = await bcrypt.compare(password, user.password_hash);
  if (!isValid) return null;
  
  // Update last login
  await run('UPDATE users SET last_login_at = datetime("now") WHERE id = ?', [user.id]);
  
  return user;
}

// ==================== TAXPAYER PROFILE OPERATIONS ====================

export async function createTaxpayerProfile(data) {
  const id = uuidv4();
  const sql = `
    INSERT INTO taxpayer_profiles (
      id, organization_id, user_id, profile_type, title, first_name, last_name,
      middle_name, date_of_birth, gender, marital_status, business_name, rc_number,
      tin, bvn, email, phone, address, city, state, lga, employer_name, employer_tin,
      employment_status, job_title, annual_gross_income
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const params = [
    id, data.organizationId, data.userId, data.profileType, data.title,
    data.firstName, data.lastName, data.middleName, data.dateOfBirth,
    data.gender, data.maritalStatus, data.businessName, data.rcNumber,
    data.tin, data.bvn, data.email, data.phone, data.address, data.city,
    data.state, data.lga, data.employerName, data.employerTin,
    data.employmentStatus, data.jobTitle, data.annualGrossIncome || 0
  ];
  
  await run(sql, params);
  return { id, ...data };
}

export async function getTaxpayerProfiles(organizationId, filters = {}) {
  let sql = 'SELECT * FROM taxpayer_profiles WHERE organization_id = ?';
  const params = [organizationId];
  
  if (filters.profileType) {
    sql += ' AND profile_type = ?';
    params.push(filters.profileType);
  }
  
  sql += ' ORDER BY created_at DESC';
  
  if (filters.limit) {
    sql += ' LIMIT ?';
    params.push(filters.limit);
  }
  
  const result = await all(sql, params);
  return result.data || [];
}

export async function getTaxpayerProfile(id) {
  const result = await get('SELECT * FROM taxpayer_profiles WHERE id = ?', [id]);
  return result.data;
}

// ==================== ENTRIES OPERATIONS ====================

export async function createEntry(data) {
  const id = uuidv4();
  const sql = `
    INSERT INTO entries (
      id, organization_id, taxpayer_id, entry_type, category, sub_category,
      description, amount, date, reference_number, vendor_customer, payment_method,
      bank_account, is_vatable, vat_amount, is_wht_applicable, wht_rate, wht_amount,
      is_deductible, notes, status, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const params = [
    id, data.organizationId, data.taxpayerId, data.entryType, data.category,
    data.subCategory, data.description, data.amount, data.date, data.referenceNumber,
    data.vendorCustomer, data.paymentMethod, data.bankAccount, data.isVatable ? 1 : 0,
    data.vatAmount || 0, data.isWhtApplicable ? 1 : 0, data.whtRate || 0,
    data.whtAmount || 0, data.isDeductible ? 1 : 0, data.notes, data.status || 'pending',
    data.createdBy
  ];
  
  await run(sql, params);
  return { id, ...data };
}

export async function getEntries(organizationId, filters = {}) {
  let sql = `
    SELECT e.*, c.name as category_name, c.color as category_color
    FROM entries e
    LEFT JOIN entry_categories c ON e.category = c.id
    WHERE e.organization_id = ?
  `;
  const params = [organizationId];
  
  if (filters.entryType) {
    sql += ' AND e.entry_type = ?';
    params.push(filters.entryType);
  }
  
  if (filters.status) {
    sql += ' AND e.status = ?';
    params.push(filters.status);
  }
  
  if (filters.startDate) {
    sql += ' AND e.date >= ?';
    params.push(filters.startDate);
  }
  
  if (filters.endDate) {
    sql += ' AND e.date <= ?';
    params.push(filters.endDate);
  }
  
  if (filters.category) {
    sql += ' AND e.category = ?';
    params.push(filters.category);
  }
  
  sql += ' ORDER BY e.date DESC, e.created_at DESC';
  
  if (filters.limit) {
    sql += ' LIMIT ?';
    params.push(filters.limit);
  }
  
  if (filters.offset) {
    sql += ' OFFSET ?';
    params.push(filters.offset);
  }
  
  const result = await all(sql, params);
  return result.data || [];
}

export async function getEntry(id) {
  const result = await get(`
    SELECT e.*, c.name as category_name, c.color as category_color
    FROM entries e
    LEFT JOIN entry_categories c ON e.category = c.id
    WHERE e.id = ?
  `, [id]);
  return result.data;
}

export async function updateEntry(id, data) {
  const allowedFields = [
    'entry_type', 'category', 'sub_category', 'description', 'amount', 'date',
    'reference_number', 'vendor_customer', 'payment_method', 'bank_account',
    'is_vatable', 'vat_amount', 'is_wht_applicable', 'wht_rate', 'wht_amount',
    'is_deductible', 'notes', 'status', 'approved_by', 'approved_at'
  ];
  
  const updateData = {};
  Object.keys(data).forEach(key => {
    const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    if (allowedFields.includes(snakeKey)) {
      updateData[snakeKey] = data[key];
    }
  });
  
  if (Object.keys(updateData).length === 0) return;
  
  const fields = Object.keys(updateData).map(key => `${key} = ?`).join(', ');
  const values = [...Object.values(updateData), id];
  await run(`UPDATE entries SET ${fields}, updated_at = datetime('now') WHERE id = ?`, values);
}

export async function deleteEntry(id) {
  await run('DELETE FROM entries WHERE id = ?', [id]);
}

export async function getEntrySummary(organizationId, startDate, endDate) {
  const sql = `
    SELECT 
      entry_type,
      SUM(amount) as total_amount,
      COUNT(*) as count
    FROM entries
    WHERE organization_id = ?
      AND date >= ?
      AND date <= ?
      AND status != 'voided'
    GROUP BY entry_type
  `;
  const result = await all(sql, [organizationId, startDate, endDate]);
  return result.data || [];
}

// ==================== ENTRY CATEGORIES ====================

export async function getEntryCategories(organizationId) {
  const result = await all(`
    SELECT * FROM entry_categories 
    WHERE organization_id IS NULL OR organization_id = ?
    ORDER BY is_system DESC, name ASC
  `, [organizationId]);
  return result.data || [];
}

export async function createEntryCategory(data) {
  const id = uuidv4();
  const sql = `
    INSERT INTO entry_categories (
      id, organization_id, name, type, parent_id, color, icon,
      is_vatable, default_vat_rate, is_wht_applicable, default_wht_rate, is_deductible
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const params = [
    id, data.organizationId, data.name, data.type, data.parentId,
    data.color, data.icon, data.isVatable ? 1 : 0, data.defaultVatRate || 7.5,
    data.isWhtApplicable ? 1 : 0, data.defaultWhtRate || 0, data.isDeductible ? 1 : 0
  ];
  
  await run(sql, params);
  return { id, ...data };
}

// ==================== TAX CALCULATIONS ====================

export async function saveTaxCalculation(data) {
  const id = uuidv4();
  const referenceId = data.referenceId || `#TAX-${new Date().getFullYear().toString().slice(-2)}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
  
  const sql = `
    INSERT INTO tax_calculations (
      id, organization_id, taxpayer_id, reference_id, tax_type, tax_year,
      tax_period, period_start, period_end, input_data, gross_amount, deductions,
      reliefs, taxable_amount, tax_rate, tax_due, credits_applied, net_tax_payable,
      calculation_breakdown, status, notes, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const params = [
    id, data.organizationId, data.taxpayerId, referenceId, data.taxType,
    data.taxYear, data.taxPeriod, data.periodStart, data.periodEnd,
    JSON.stringify(data.inputData), data.grossAmount, data.deductions || 0,
    data.reliefs || 0, data.taxableAmount, data.taxRate, data.taxDue,
    data.creditsApplied || 0, data.netTaxPayable, JSON.stringify(data.calculationBreakdown),
    data.status || 'draft', data.notes, data.createdBy
  ];
  
  await run(sql, params);
  return { id, referenceId, ...data };
}

export async function getTaxCalculations(organizationId, filters = {}) {
  let sql = 'SELECT * FROM tax_calculations WHERE organization_id = ?';
  const params = [organizationId];
  
  if (filters.taxType) {
    sql += ' AND tax_type = ?';
    params.push(filters.taxType);
  }
  
  if (filters.taxYear) {
    sql += ' AND tax_year = ?';
    params.push(filters.taxYear);
  }
  
  if (filters.status) {
    sql += ' AND status = ?';
    params.push(filters.status);
  }
  
  if (filters.taxpayerId) {
    sql += ' AND taxpayer_id = ?';
    params.push(filters.taxpayerId);
  }
  
  sql += ' ORDER BY created_at DESC';
  
  if (filters.limit) {
    sql += ' LIMIT ?';
    params.push(filters.limit);
  }
  
  const result = await all(sql, params);
  return (result.data || []).map(row => ({
    ...row,
    inputData: JSON.parse(row.input_data || '{}'),
    calculationBreakdown: JSON.parse(row.calculation_breakdown || '{}')
  }));
}

export async function getTaxCalculation(id) {
  const result = await get('SELECT * FROM tax_calculations WHERE id = ?', [id]);
  if (!result.data) return null;
  return {
    ...result.data,
    inputData: JSON.parse(result.data.input_data || '{}'),
    calculationBreakdown: JSON.parse(result.data.calculation_breakdown || '{}')
  };
}

export async function updateTaxCalculation(id, data) {
  const allowedFields = ['status', 'filed_at', 'filed_by', 'payment_reference', 'payment_date', 'notes'];
  const updateData = {};
  Object.keys(data).forEach(key => {
    const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    if (allowedFields.includes(snakeKey)) {
      updateData[snakeKey] = data[key];
    }
  });
  
  if (Object.keys(updateData).length === 0) return;
  
  const fields = Object.keys(updateData).map(key => `${key} = ?`).join(', ');
  const values = [...Object.values(updateData), id];
  await run(`UPDATE tax_calculations SET ${fields}, updated_at = datetime('now') WHERE id = ?`, values);
}

// ==================== DEDUCTIONS ====================

export async function createDeduction(data) {
  const id = uuidv4();
  const sql = `
    INSERT INTO deductions (
      id, organization_id, taxpayer_id, tax_type, deduction_type, name,
      description, amount, percentage, max_amount, tax_year, effective_date,
      expiry_date, is_recurring, recurrence_frequency, status, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const params = [
    id, data.organizationId, data.taxpayerId, data.taxType, data.deductionType,
    data.name, data.description, data.amount, data.percentage, data.maxAmount,
    data.taxYear, data.effectiveDate, data.expiryDate, data.isRecurring ? 1 : 0,
    data.recurrenceFrequency, data.status || 'active', data.createdBy
  ];
  
  await run(sql, params);
  return { id, ...data };
}

export async function getDeductions(organizationId, filters = {}) {
  let sql = 'SELECT * FROM deductions WHERE organization_id = ?';
  const params = [organizationId];
  
  if (filters.taxType) {
    sql += ' AND (tax_type = ? OR tax_type = "all")';
    params.push(filters.taxType);
  }
  
  if (filters.taxpayerId) {
    sql += ' AND taxpayer_id = ?';
    params.push(filters.taxpayerId);
  }
  
  if (filters.taxYear) {
    sql += ' AND tax_year = ?';
    params.push(filters.taxYear);
  }
  
  if (filters.status) {
    sql += ' AND status = ?';
    params.push(filters.status);
  }
  
  sql += ' ORDER BY created_at DESC';
  
  const result = await all(sql, params);
  return result.data || [];
}

export async function getDeductionTypes() {
  const result = await all('SELECT * FROM deduction_types ORDER BY category, name');
  return result.data || [];
}

// ==================== VAT RECORDS ====================

export async function saveVATRecord(data) {
  const id = uuidv4();
  const sql = `
    INSERT INTO vat_records (
      id, organization_id, tax_period, tax_year, total_vatable_sales,
      total_exempt_sales, total_zero_rated_sales, output_vat, total_vatable_purchases,
      total_exempt_purchases, input_vat, vat_payable, vat_credit_brought_forward,
      vat_credit_carried_forward, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const params = [
    id, data.organizationId, data.taxPeriod, data.taxYear, data.totalVatableSales,
    data.totalExemptSales, data.totalZeroRatedSales, data.outputVat,
    data.totalVatablePurchases, data.totalExemptPurchases, data.inputVat,
    data.vatPayable, data.vatCreditBroughtForward, data.vatCreditCarriedForward,
    data.status || 'draft'
  ];
  
  await run(sql, params);
  return { id, ...data };
}

export async function getVATRecords(organizationId, filters = {}) {
  let sql = 'SELECT * FROM vat_records WHERE organization_id = ?';
  const params = [organizationId];
  
  if (filters.taxYear) {
    sql += ' AND tax_year = ?';
    params.push(filters.taxYear);
  }
  
  sql += ' ORDER BY tax_period DESC';
  
  const result = await all(sql, params);
  return result.data || [];
}

// ==================== WHT RECORDS ====================

export async function saveWHTRecord(data) {
  const id = uuidv4();
  const sql = `
    INSERT INTO wht_records (
      id, organization_id, entry_id, transaction_type, vendor_name, vendor_tin,
      vendor_address, transaction_date, gross_amount, wht_rate, wht_amount,
      net_amount, remittance_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const params = [
    id, data.organizationId, data.entryId, data.transactionType, data.vendorName,
    data.vendorTin, data.vendorAddress, data.transactionDate, data.grossAmount,
    data.whtRate, data.whtAmount, data.netAmount, data.remittanceStatus || 'pending'
  ];
  
  await run(sql, params);
  return { id, ...data };
}

export async function getWHTRecords(organizationId, filters = {}) {
  let sql = 'SELECT * FROM wht_records WHERE organization_id = ?';
  const params = [organizationId];
  
  if (filters.remittanceStatus) {
    sql += ' AND remittance_status = ?';
    params.push(filters.remittanceStatus);
  }
  
  sql += ' ORDER BY transaction_date DESC';
  
  const result = await all(sql, params);
  return result.data || [];
}

// ==================== REMINDERS ====================

export async function createReminder(data) {
  const id = uuidv4();
  const sql = `
    INSERT INTO reminders (
      id, organization_id, user_id, title, description, reminder_type,
      related_entity_type, related_entity_id, due_date, remind_before_days,
      is_recurring, recurrence_pattern, status, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const params = [
    id, data.organizationId, data.userId, data.title, data.description,
    data.reminderType, data.relatedEntityType, data.relatedEntityId,
    data.dueDate, data.remindBeforeDays || 7, data.isRecurring ? 1 : 0,
    data.recurrencePattern, data.status || 'active', data.createdBy
  ];
  
  await run(sql, params);
  return { id, ...data };
}

export async function getReminders(organizationId, filters = {}) {
  let sql = 'SELECT * FROM reminders WHERE organization_id = ?';
  const params = [organizationId];
  
  if (filters.userId) {
    sql += ' AND (user_id = ? OR user_id IS NULL)';
    params.push(filters.userId);
  }
  
  if (filters.status) {
    sql += ' AND status = ?';
    params.push(filters.status);
  }
  
  if (filters.reminderType) {
    sql += ' AND reminder_type = ?';
    params.push(filters.reminderType);
  }
  
  sql += ' ORDER BY due_date ASC';
  
  const result = await all(sql, params);
  return result.data || [];
}

export async function updateReminder(id, data) {
  const allowedFields = ['status', 'notification_sent', 'notification_sent_at', 'completed_at'];
  const updateData = {};
  Object.keys(data).forEach(key => {
    const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    if (allowedFields.includes(snakeKey)) {
      updateData[snakeKey] = data[key];
    }
  });
  
  if (Object.keys(updateData).length === 0) return;
  
  const fields = Object.keys(updateData).map(key => `${key} = ?`).join(', ');
  const values = [...Object.values(updateData), id];
  await run(`UPDATE reminders SET ${fields}, updated_at = datetime('now') WHERE id = ?`, values);
}

// ==================== DASHBOARD STATISTICS ====================

export async function getDashboardStats(organizationId, startDate, endDate) {
  // Get entry summary
  const entrySummary = await getEntrySummary(organizationId, startDate, endDate);
  
  // Get total income and expenses
  let totalIncome = 0;
  let totalExpenses = 0;
  entrySummary.forEach(item => {
    if (item.entry_type === 'income') {
      totalIncome = item.total_amount || 0;
    } else if (item.entry_type === 'expense') {
      totalExpenses = item.total_amount || 0;
    }
  });
  
  // Get recent tax calculations
  const taxCalcResult = await all(`
    SELECT tax_type, SUM(net_tax_payable) as total_tax
    FROM tax_calculations
    WHERE organization_id = ?
      AND tax_year = ?
    GROUP BY tax_type
  `, [organizationId, new Date().getFullYear()]);
  
  // Get pending reminders
  const pendingReminders = await all(`
    SELECT COUNT(*) as count
    FROM reminders
    WHERE organization_id = ?
      AND status = 'active'
      AND due_date <= date('now', '+30 days')
  `, [organizationId]);
  
  return {
    totalIncome,
    totalExpenses,
    netCashFlow: totalIncome - totalExpenses,
    taxSummary: taxCalcResult.data || [],
    pendingReminders: pendingReminders.data?.[0]?.count || 0,
    entrySummary
  };
}

// ==================== AUDIT LOG ====================

export async function logAudit(data) {
  const id = uuidv4();
  const sql = `
    INSERT INTO audit_logs (
      id, organization_id, user_id, action, entity_type, entity_id,
      old_values, new_values
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const params = [
    id, data.organizationId, data.userId, data.action, data.entityType,
    data.entityId, JSON.stringify(data.oldValues || null),
    JSON.stringify(data.newValues || null)
  ];
  
  await run(sql, params);
}

export default {
  query,
  run,
  get,
  all,
  createOrganization,
  getOrganization,
  updateOrganization,
  createUser,
  getUserByEmail,
  getUser,
  getUsersByOrganization,
  updateUser,
  validatePassword,
  createTaxpayerProfile,
  getTaxpayerProfiles,
  getTaxpayerProfile,
  createEntry,
  getEntries,
  getEntry,
  updateEntry,
  deleteEntry,
  getEntrySummary,
  getEntryCategories,
  createEntryCategory,
  saveTaxCalculation,
  getTaxCalculations,
  getTaxCalculation,
  updateTaxCalculation,
  createDeduction,
  getDeductions,
  getDeductionTypes,
  saveVATRecord,
  getVATRecords,
  saveWHTRecord,
  getWHTRecords,
  createReminder,
  getReminders,
  updateReminder,
  getDashboardStats,
  logAudit
};
