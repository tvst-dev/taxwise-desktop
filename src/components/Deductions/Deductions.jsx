import React, { useState, useMemo } from 'react';
import {
  Receipt, Plus, Search, Edit2, Trash2, X,
  FileText, Download, Filter, Calculator
} from 'lucide-react';
import { useDeductionsStore, useEntriesStore, useUIStore, useAuthStore } from '../../store';
import { createDeduction, updateDeduction as dbUpdateDeduction, deleteDeduction, createEntry, updateEntry, deleteEntry } from '../../services/supabase';
import toast from 'react-hot-toast';

const Deductions = () => {
  const { deductions, addDeduction, updateDeduction, removeDeduction } = useDeductionsStore();
  const { entries, addEntry, updateEntry: updateStoreEntry, removeEntry } = useEntriesStore();
  const { openModal } = useUIStore();
  const { organization } = useAuthStore();

  const [showModal, setShowModal] = useState(false);
  const [editingDeduction, setEditingDeduction] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [form, setForm] = useState({
    description: '',
    amount: '',
    category: 'business_expense',
    tax_year: new Date().getFullYear().toString(),
    documentation: '',
    notes: ''
  });

  const categories = [
    { value: 'business_expense', label: 'Business Expense' },
    { value: 'depreciation', label: 'Depreciation' },
    { value: 'pension', label: 'Pension Contribution' },
    { value: 'nhf', label: 'NHF Contribution' },
    { value: 'nhis', label: 'NHIS Premium' },
    { value: 'life_insurance', label: 'Life Insurance' },
    { value: 'gratuity', label: 'Gratuity' },
    { value: 'donation', label: 'Charitable Donation' },
    { value: 'research', label: 'R&D Expenditure' },
    { value: 'other', label: 'Other' }
  ];

  // Map entry category string to a deduction category key
  const mapEntryCategory = (cat) => {
    if (!cat) return 'business_expense';
    const lower = cat.toLowerCase();
    if (lower.includes('pension')) return 'pension';
    if (lower.includes('nhf')) return 'nhf';
    if (lower.includes('nhis') || lower.includes('health insur')) return 'nhis';
    if (lower.includes('life insur') || lower.includes('insurance')) return 'life_insurance';
    if (lower.includes('gratuity')) return 'gratuity';
    if (lower.includes('donation') || lower.includes('charity')) return 'donation';
    if (lower.includes('research') || lower.includes('r&d')) return 'research';
    if (lower.includes('depreciat')) return 'depreciation';
    return 'business_expense';
  };

  // Build deduction-shaped objects from expense entries
  const expenseEntries = useMemo(() => {
    return entries
      .filter(e => {
        if (e.entry_type !== 'expense') return false;
        // Exclude entries that were auto-created by a manual deduction — they are
        // already represented as a deduction row and would otherwise duplicate.
        // Survives logout/login because it relies on the persisted metadata field.
        const meta = e.metadata || (typeof e.metadata === 'string' ? JSON.parse(e.metadata) : {});
        if (meta?.deduction_sync) return false;
        // Also exclude by local _linked_entry_id while the session is live
        const linkedIds = new Set(deductions.map(d => d._linked_entry_id).filter(Boolean));
        if (linkedIds.has(e.id)) return false;
        return true;
      })
      .map(e => ({
        id: e.id,
        description: e.description || 'Expense',
        amount: Math.abs(parseFloat(e.amount) || 0),
        category: mapEntryCategory(e.category),
        tax_year: e.date ? new Date(e.date).getFullYear().toString() : new Date().getFullYear().toString(),
        notes: e.vendor_customer || e.reference_number || '',
        _source: 'entry'
      }));
  }, [entries, deductions]);

  // Combined list: manual deductions + expense entries
  const allDeductionItems = useMemo(() => [...deductions, ...expenseEntries], [deductions, expenseEntries]);

  // Filter deductions
  const filteredDeductions = useMemo(() => {
    return allDeductionItems.filter(d => {
      const matchesSearch = !searchTerm ||
        d.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.category?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = filterCategory === 'all' || d.category === filterCategory;
      return matchesSearch && matchesCategory;
    });
  }, [allDeductionItems, searchTerm, filterCategory]);

  // Calculate totals
  const totals = useMemo(() => {
    const total = filteredDeductions.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);
    const byCategory = {};
    filteredDeductions.forEach(d => {
      const cat = d.category || 'other';
      byCategory[cat] = (byCategory[cat] || 0) + (parseFloat(d.amount) || 0);
    });
    return { total, byCategory, count: filteredDeductions.length };
  }, [filteredDeductions]);

  const formatCurrency = (amount) => {
    if (!amount) return '₦0';
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const handleSubmit = async () => {
    if (!form.description || !form.amount) {
      toast.error('Please fill in required fields');
      return;
    }

    const deductionData = {
      ...form,
      amount: parseFloat(form.amount)
    };

    // Build the corresponding expense entry data
    const entryDate = form.tax_year
      ? `${form.tax_year}-01-01`
      : new Date().toISOString().split('T')[0];

    const entryData = {
      organization_id: organization?.id,
      entry_type: 'expense',
      category: form.category,
      description: form.description,
      amount: parseFloat(form.amount),
      date: entryDate,
      vendor_customer: form.notes || null,
      vat_amount: 0,
      status: 'posted',
      metadata: { deduction_sync: true }
    };

    try {
      if (editingDeduction) {
        // _linked_entry_id is not a DB column — strip it from the update payload
        const { _linked_entry_id: _ignored, ...dbUpdateData } = deductionData;
        const updated = await dbUpdateDeduction(editingDeduction.id, dbUpdateData);
        // Keep _linked_entry_id in local state
        updateDeduction(editingDeduction.id, { ...updated, _linked_entry_id: editingDeduction._linked_entry_id });
        // Sync update to the linked expense entry if one exists
        if (editingDeduction._linked_entry_id) {
          try {
            const updatedEntry = await updateEntry(editingDeduction._linked_entry_id, {
              description: deductionData.description,
              amount: deductionData.amount,
              category: deductionData.category,
              notes: deductionData.notes || ''
            });
            updateStoreEntry(editingDeduction._linked_entry_id, updatedEntry);
          } catch (entryErr) {
            console.warn('Could not sync deduction update to entry:', entryErr.message);
          }
        }
        toast.success('Deduction updated');
      } else {
        // Create expense entry first so we can store its id on the deduction
        let linkedEntryId = null;
        try {
          const createdEntry = await createEntry(entryData);
          addEntry(createdEntry);
          linkedEntryId = createdEntry.id;
        } catch (entryErr) {
          console.warn('Could not create linked expense entry:', entryErr.message);
        }

        // _linked_entry_id is not a DB column — strip it from the insert payload
        const created = await createDeduction({
          ...deductionData,
          organization_id: organization?.id
        });
        // Attach the linked entry ID in local store state only
        addDeduction({ ...created, _linked_entry_id: linkedEntryId });
        toast.success('Deduction added');
      }
    } catch (e) {
      console.warn('DB save failed, saving locally:', e.message);
      if (editingDeduction) {
        updateDeduction(editingDeduction.id, deductionData);
        toast.success('Deduction updated');
      } else {
        // Still try to create a local entry
        const localEntry = {
          ...entryData,
          id: `entry_ded_${Date.now()}`,
          created_at: new Date().toISOString(),
          organization_id: organization?.id
        };
        addEntry(localEntry);
        addDeduction({ ...deductionData, _linked_entry_id: localEntry.id });
        toast.success('Deduction added');
      }
    }

    resetForm();
  };

  const resetForm = () => {
    setForm({
      description: '',
      amount: '',
      category: 'business_expense',
      tax_year: new Date().getFullYear().toString(),
      documentation: '',
      notes: ''
    });
    setEditingDeduction(null);
    setShowModal(false);
  };

  const handleEdit = (deduction) => {
    setForm({
      description: deduction.description,
      amount: deduction.amount.toString(),
      category: deduction.category || 'other',
      tax_year: deduction.tax_year || new Date().getFullYear().toString(),
      documentation: deduction.documentation || '',
      notes: deduction.notes || ''
    });
    setEditingDeduction(deduction);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Delete this deduction?')) {
      const target = deductions.find(d => d.id === id);
      const isLocalOnly = typeof id === 'string' && id.startsWith('ded_');
      if (!isLocalOnly) {
        try {
          await deleteDeduction(id);
        } catch (e) {
          console.warn('DB delete failed, removing locally:', e.message);
        }
      }
      removeDeduction(id);
      // Also remove the linked expense entry if one was created by this deduction
      if (target?._linked_entry_id) {
        const entryIsLocal = typeof target._linked_entry_id === 'string' && target._linked_entry_id.startsWith('entry_ded_');
        if (!entryIsLocal) {
          try {
            await deleteEntry(target._linked_entry_id);
          } catch (entryErr) {
            console.warn('Could not delete linked expense entry:', entryErr.message);
          }
        }
        removeEntry(target._linked_entry_id);
      }
      toast.success('Deduction deleted');
    }
  };

  const handleExport = () => {
    if (allDeductionItems.length === 0) {
      toast.error('No deductions to export');
      return;
    }
    openModal('export', { type: 'deductions', data: filteredDeductions });
  };

  const getCategoryLabel = (value) => {
    return categories.find(c => c.value === value)?.label || value;
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Tax Deductions</h1>
          <p style={styles.subtitle}>
            Track eligible deductions to reduce your tax liability
          </p>
        </div>
        <div style={styles.headerActions}>
          <button style={styles.exportBtn} onClick={handleExport}>
            <Download size={16} />
            Export
          </button>
          <button style={styles.primaryBtn} onClick={() => setShowModal(true)}>
            <Plus size={16} />
            Add Deduction
          </button>
        </div>
      </div>

      {/* Summary */}
      <div style={styles.summaryGrid}>
        <div style={styles.summaryCard}>
          <div style={styles.summaryIcon}>
            <Receipt size={24} color="#22C55E" />
          </div>
          <div style={styles.summaryContent}>
            <span style={styles.summaryLabel}>Total Deductions</span>
            <span style={{ ...styles.summaryValue, color: '#22C55E' }}>
              {formatCurrency(totals.total)}
            </span>
          </div>
        </div>
        <div style={styles.summaryCard}>
          <div style={{ ...styles.summaryIcon, backgroundColor: 'rgba(37, 99, 235, 0.1)' }}>
            <FileText size={24} color="#2563EB" />
          </div>
          <div style={styles.summaryContent}>
            <span style={styles.summaryLabel}>Deduction Items</span>
            <span style={styles.summaryValue}>{totals.count}</span>
          </div>
        </div>
        <div style={styles.summaryCard}>
          <div style={{ ...styles.summaryIcon, backgroundColor: 'rgba(139, 92, 246, 0.1)' }}>
            <Calculator size={24} color="#8B5CF6" />
          </div>
          <div style={styles.summaryContent}>
            <span style={styles.summaryLabel}>Est. Tax Savings</span>
            <span style={styles.summaryValue}>
              {formatCurrency(totals.total * 0.3)}
            </span>
            <span style={styles.summaryHint}>@ 30% tax rate</span>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div style={styles.toolbar}>
        <div style={styles.searchBox}>
          <Search size={16} color="#8B949E" />
          <input
            type="text"
            placeholder="Search deductions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={styles.searchInput}
          />
        </div>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          style={styles.filterSelect}
        >
          <option value="all">All Categories</option>
          {categories.map(cat => (
            <option key={cat.value} value={cat.value}>{cat.label}</option>
          ))}
        </select>
      </div>

      {/* Deductions List */}
      <div style={styles.tableCard}>
        {filteredDeductions.length === 0 ? (
          <div style={styles.emptyState}>
            <Receipt size={48} color="#30363D" />
            <h3 style={styles.emptyTitle}>No deductions found</h3>
            <p style={styles.emptyText}>
              {allDeductionItems.length === 0
                ? "Start tracking your tax deductions to reduce your liability."
                : "No deductions match your current filter."
              }
            </p>
            {allDeductionItems.length === 0 && (
              <button style={styles.emptyBtn} onClick={() => setShowModal(true)}>
                <Plus size={16} />
                Add First Deduction
              </button>
            )}
          </div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Description</th>
                <th style={styles.th}>Category</th>
                <th style={styles.th}>Tax Year</th>
                <th style={styles.th}>Amount</th>
                <th style={styles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDeductions.map((deduction) => (
                <tr key={deduction.id} style={styles.tr}>
                  <td style={styles.td}>
                    <div style={styles.descCell}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={styles.descText}>{deduction.description}</span>
                        {deduction._source === 'entry' && (
                          <span style={styles.sourceBadge}>From Entry</span>
                        )}
                      </div>
                      {deduction.notes && (
                        <span style={styles.notesText}>{deduction.notes}</span>
                      )}
                    </div>
                  </td>
                  <td style={styles.td}>
                    <span style={styles.categoryBadge}>
                      {getCategoryLabel(deduction.category)}
                    </span>
                  </td>
                  <td style={styles.td}>{deduction.tax_year || '-'}</td>
                  <td style={{ ...styles.td, fontWeight: '600', color: '#22C55E' }}>
                    {formatCurrency(deduction.amount)}
                  </td>
                  <td style={styles.td}>
                    <div style={styles.actions}>
                      {deduction._source !== 'entry' ? (
                        <>
                          <button
                            style={styles.actionBtn}
                            onClick={() => handleEdit(deduction)}
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            style={{ ...styles.actionBtn, color: '#EF4444' }}
                            onClick={() => handleDelete(deduction.id)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      ) : (
                        <span style={styles.readOnlyHint}>View in Entries</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div style={styles.modalOverlay} onClick={resetForm}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>
                {editingDeduction ? 'Edit Deduction' : 'Add Deduction'}
              </h3>
              <button style={styles.closeBtn} onClick={resetForm}>
                <X size={20} />
              </button>
            </div>
            <div style={styles.modalBody}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Description *</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  style={styles.input}
                  placeholder="e.g., Office rent payment"
                />
              </div>
              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Amount *</label>
                  <input
                    type="number"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    style={styles.input}
                    placeholder="0.00"
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Tax Year</label>
                  <select
                    value={form.tax_year}
                    onChange={(e) => setForm({ ...form, tax_year: e.target.value })}
                    style={styles.select}
                  >
                    {[...Array(5)].map((_, i) => {
                      const year = new Date().getFullYear() - i;
                      return <option key={year} value={year}>{year}</option>;
                    })}
                  </select>
                </div>
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Category</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  style={styles.select}
                >
                  {categories.map(cat => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  style={styles.textarea}
                  placeholder="Additional notes..."
                  rows={2}
                />
              </div>
            </div>
            <div style={styles.modalFooter}>
              <button style={styles.cancelBtn} onClick={resetForm}>
                Cancel
              </button>
              <button style={styles.submitBtn} onClick={handleSubmit}>
                {editingDeduction ? 'Update' : 'Add'} Deduction
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    padding: '24px',
    minHeight: '100%',
    backgroundColor: '#0D1117'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '24px'
  },
  title: {
    fontSize: '24px',
    fontWeight: '600',
    color: '#E6EDF3',
    margin: '0 0 4px 0'
  },
  subtitle: {
    fontSize: '14px',
    color: '#8B949E',
    margin: 0
  },
  headerActions: {
    display: 'flex',
    gap: '12px'
  },
  exportBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 16px',
    backgroundColor: 'transparent',
    border: '1px solid #30363D',
    borderRadius: '8px',
    color: '#8B949E',
    fontSize: '14px',
    cursor: 'pointer'
  },
  primaryBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 20px',
    backgroundColor: '#2563EB',
    border: 'none',
    borderRadius: '8px',
    color: 'white',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer'
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '16px',
    marginBottom: '24px'
  },
  summaryCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '20px',
    backgroundColor: '#161B22',
    border: '1px solid #30363D',
    borderRadius: '12px'
  },
  summaryIcon: {
    width: '48px',
    height: '48px',
    borderRadius: '12px',
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  summaryContent: {
    display: 'flex',
    flexDirection: 'column'
  },
  summaryLabel: {
    fontSize: '13px',
    color: '#8B949E',
    marginBottom: '4px'
  },
  summaryValue: {
    fontSize: '20px',
    fontWeight: '600',
    color: '#E6EDF3'
  },
  summaryHint: {
    fontSize: '11px',
    color: '#6E7681',
    marginTop: '2px'
  },
  toolbar: {
    display: 'flex',
    gap: '12px',
    marginBottom: '16px'
  },
  searchBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 16px',
    backgroundColor: '#161B22',
    border: '1px solid #30363D',
    borderRadius: '8px',
    flex: 1,
    maxWidth: '300px'
  },
  searchInput: {
    flex: 1,
    backgroundColor: 'transparent',
    border: 'none',
    color: '#E6EDF3',
    fontSize: '14px',
    outline: 'none'
  },
  filterSelect: {
    padding: '10px 16px',
    backgroundColor: '#161B22',
    border: '1px solid #30363D',
    borderRadius: '8px',
    color: '#E6EDF3',
    fontSize: '14px',
    cursor: 'pointer',
    outline: 'none'
  },
  tableCard: {
    backgroundColor: '#161B22',
    border: '1px solid #30363D',
    borderRadius: '12px',
    overflow: 'hidden'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse'
  },
  th: {
    padding: '14px 16px',
    textAlign: 'left',
    fontSize: '12px',
    fontWeight: '600',
    color: '#8B949E',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    borderBottom: '1px solid #30363D'
  },
  tr: {
    transition: 'background-color 0.15s ease'
  },
  td: {
    padding: '14px 16px',
    fontSize: '14px',
    color: '#E6EDF3',
    borderBottom: '1px solid #21262D'
  },
  descCell: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px'
  },
  descText: {
    fontWeight: '500'
  },
  notesText: {
    fontSize: '12px',
    color: '#8B949E'
  },
  categoryBadge: {
    display: 'inline-block',
    padding: '4px 10px',
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
    borderRadius: '6px',
    fontSize: '12px',
    color: '#2563EB'
  },
  sourceBadge: {
    display: 'inline-block',
    padding: '2px 8px',
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    borderRadius: '4px',
    fontSize: '11px',
    color: '#8B5CF6',
    fontWeight: '500'
  },
  readOnlyHint: {
    fontSize: '11px',
    color: '#6E7681',
    fontStyle: 'italic'
  },
  actions: {
    display: 'flex',
    gap: '8px'
  },
  actionBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '32px',
    backgroundColor: 'transparent',
    border: '1px solid #30363D',
    borderRadius: '6px',
    color: '#8B949E',
    cursor: 'pointer'
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '64px 24px',
    textAlign: 'center'
  },
  emptyTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#E6EDF3',
    margin: '16px 0 8px'
  },
  emptyText: {
    fontSize: '14px',
    color: '#8B949E',
    margin: '0 0 24px'
  },
  emptyBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 24px',
    backgroundColor: '#2563EB',
    border: 'none',
    borderRadius: '8px',
    color: 'white',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer'
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9000
  },
  modal: {
    width: '100%',
    maxWidth: '480px',
    backgroundColor: '#161B22',
    borderRadius: '16px',
    border: '1px solid #30363D',
    overflow: 'hidden'
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 24px',
    borderBottom: '1px solid #30363D'
  },
  modalTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#E6EDF3',
    margin: 0
  },
  closeBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    border: 'none',
    color: '#8B949E',
    cursor: 'pointer'
  },
  modalBody: {
    padding: '24px'
  },
  modalFooter: {
    display: 'flex',
    gap: '12px',
    padding: '20px 24px',
    borderTop: '1px solid #30363D'
  },
  formGroup: {
    marginBottom: '20px',
    flex: 1
  },
  formRow: {
    display: 'flex',
    gap: '16px'
  },
  label: {
    display: 'block',
    fontSize: '13px',
    fontWeight: '500',
    color: '#8B949E',
    marginBottom: '8px'
  },
  input: {
    width: '100%',
    padding: '12px 16px',
    backgroundColor: '#0D1117',
    border: '1px solid #30363D',
    borderRadius: '8px',
    color: '#E6EDF3',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box'
  },
  textarea: {
    width: '100%',
    padding: '12px 16px',
    backgroundColor: '#0D1117',
    border: '1px solid #30363D',
    borderRadius: '8px',
    color: '#E6EDF3',
    fontSize: '14px',
    outline: 'none',
    resize: 'vertical',
    fontFamily: 'inherit',
    boxSizing: 'border-box'
  },
  select: {
    width: '100%',
    padding: '12px 16px',
    backgroundColor: '#0D1117',
    border: '1px solid #30363D',
    borderRadius: '8px',
    color: '#E6EDF3',
    fontSize: '14px',
    outline: 'none',
    cursor: 'pointer',
    boxSizing: 'border-box'
  },
  cancelBtn: {
    flex: 1,
    padding: '12px',
    backgroundColor: 'transparent',
    border: '1px solid #30363D',
    borderRadius: '8px',
    color: '#8B949E',
    fontSize: '14px',
    cursor: 'pointer'
  },
  submitBtn: {
    flex: 1,
    padding: '12px',
    backgroundColor: '#2563EB',
    border: 'none',
    borderRadius: '8px',
    color: 'white',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer'
  }
};

export default Deductions;
