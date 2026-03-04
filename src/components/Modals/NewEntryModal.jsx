import React, { useState, useEffect } from 'react';
import { X, Calendar, ChevronDown, CreditCard, Building, FileText, Info } from 'lucide-react';
import { useUIStore, useEntriesStore, useAuthStore } from '../../store';
import { createEntry, updateEntry as updateEntryDB } from '../../services/supabase';
import toast from 'react-hot-toast';

const NewEntryModal = () => {
  const { activeModal, closeModal, modalData } = useUIStore();
  const { addEntry, updateEntry } = useEntriesStore();
  const { organization } = useAuthStore();

  const isEditing = !!(modalData?.isEditing && modalData?.entry);
  const editingEntry = modalData?.entry;

  const [entryType, setEntryType] = useState('expense');
  const [formData, setFormData] = useState({
    amount: '',
    date: new Date().toISOString().split('T')[0],
    payee: '',
    category: '',
    paymentMethod: '',
    description: '',
    reference: '',
    isVatable: true,
    vatAmount: 0
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isOpen = activeModal === 'newEntry';

  const categories = {
    income: [
      { id: 'sales', name: 'Sales Revenue', color: '#22C55E' },
      { id: 'services', name: 'Service Income', color: '#3B82F6' },
      { id: 'consulting', name: 'Consulting', color: '#8B5CF6' },
      { id: 'interest', name: 'Interest Income', color: '#F59E0B' },
      { id: 'other_income', name: 'Other Income', color: '#6B7280' }
    ],
    expense: [
      { id: 'software', name: 'Software & Tools', color: '#EF4444' },
      { id: 'salaries', name: 'Salaries & Wages', color: '#3B82F6' },
      { id: 'rent', name: 'Rent & Utilities', color: '#F59E0B' },
      { id: 'marketing', name: 'Marketing', color: '#EC4899' },
      { id: 'office', name: 'Office Supplies', color: '#8B5CF6' },
      { id: 'travel', name: 'Travel & Transport', color: '#22C55E' },
      { id: 'professional', name: 'Professional Services', color: '#6366F1' },
      { id: 'other_expense', name: 'Other Expenses', color: '#6B7280' }
    ],
    transfer: [
      { id: 'internal', name: 'Internal Transfer', color: '#3B82F6' },
      { id: 'owner_draw', name: 'Owner Draw', color: '#F59E0B' },
      { id: 'capital', name: 'Capital Injection', color: '#22C55E' }
    ]
  };

  const paymentMethods = [
    { id: 'bank_transfer', name: 'Bank Transfer', icon: Building },
    { id: 'corporate_card', name: 'Corporate Card ••4291', icon: CreditCard },
    { id: 'cash', name: 'Cash', icon: FileText },
    { id: 'pos', name: 'POS Terminal', icon: CreditCard }
  ];

  // Pre-fill form when editing an existing entry
  useEffect(() => {
    if (isOpen && isEditing && editingEntry) {
      setEntryType(editingEntry.entry_type || 'expense');
      const rawAmount = parseFloat(editingEntry.amount) || 0;
      setFormData({
        amount: rawAmount ? rawAmount.toLocaleString() : '',
        date: editingEntry.date || new Date().toISOString().split('T')[0],
        payee: editingEntry.vendor_customer || '',
        category: editingEntry.category || '',
        paymentMethod: editingEntry.payment_method || '',
        description: editingEntry.description || '',
        reference: editingEntry.reference_number || '',
        isVatable: (editingEntry.vat_amount || 0) > 0,
        vatAmount: editingEntry.vat_amount || 0
      });
    } else if (isOpen && !isEditing) {
      resetForm();
    }
  }, [isOpen, isEditing]);

  useEffect(() => {
    if (formData.amount && formData.isVatable) {
      const amount = parseFloat(formData.amount.replace(/,/g, '')) || 0;
      const vat = amount * 0.075;
      setFormData(prev => ({ ...prev, vatAmount: vat }));
    }
  }, [formData.amount, formData.isVatable]);

  const formatAmount = (value) => {
    // Remove all non-digits
    const numericValue = value.replace(/[^0-9]/g, '');
    // Add comma separators
    return numericValue.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  const handleAmountChange = (e) => {
    const formatted = formatAmount(e.target.value);
    setFormData({ ...formData, amount: formatted });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!organization?.id) {
      toast.error('Organization not loaded. Please log out and back in.');
      return;
    }
    setIsSubmitting(true);

    try {
      const amount = parseFloat(formData.amount.replace(/,/g, '')) || 0;
      const payload = {
        organization_id: organization.id,
        entry_type: entryType,
        category: formData.category,
        amount,
        date: formData.date,
        vendor_customer: formData.payee || null,
        reference_number: formData.reference || null,
        payment_method: formData.paymentMethod || null,
        description: formData.description || null,
        vat_amount: formData.isVatable ? formData.vatAmount : 0,
        status: 'posted',
        metadata: { source: 'manual' }
      };

      if (isEditing && editingEntry?.id) {
        try {
          const saved = await updateEntryDB(editingEntry.id, payload);
          updateEntry(editingEntry.id, saved);
          toast.success('Entry updated successfully');
        } catch (dbErr) {
          console.warn('DB update failed, updating locally:', dbErr.message);
          updateEntry(editingEntry.id, { ...payload, id: editingEntry.id });
          toast.success('Entry updated locally');
        }
      } else {
        try {
          const saved = await createEntry(payload);
          addEntry(saved);
          toast.success('Entry saved successfully');
        } catch (dbErr) {
          console.warn('DB save failed, saving locally:', dbErr.message);
          addEntry({ ...payload, id: `entry-${Date.now()}`, createdAt: new Date().toISOString() });
          toast.success('Entry saved locally');
        }
      }

      closeModal();
      resetForm();
    } catch (error) {
      console.error('Failed to create entry:', error);
      toast.error('Failed to save entry');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      amount: '',
      date: new Date().toISOString().split('T')[0],
      payee: '',
      category: '',
      paymentMethod: '',
      description: '',
      reference: '',
      isVatable: true,
      vatAmount: 0
    });
    setEntryType('expense');
  };

  if (!isOpen) return null;

  const selectedCategory = categories[entryType]?.find(c => c.id === formData.category);

  return (
    <div style={styles.overlay} onClick={closeModal}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <h2 style={styles.title}>{isEditing ? 'Edit Transaction' : 'New Transaction'}</h2>
          <button style={styles.closeButton} onClick={closeModal}>
            <X size={20} />
          </button>
        </div>

        {/* Entry Type Tabs */}
        <div style={styles.typeTabs}>
          {['income', 'expense', 'transfer'].map((type) => (
            <button
              key={type}
              style={{
                ...styles.typeTab,
                ...(entryType === type ? styles.typeTabActive : {})
              }}
              onClick={() => setEntryType(type)}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          {/* Transfer info banner */}
          {entryType === 'transfer' && (
            <div style={styles.transferInfo}>
              <Info size={14} style={{ flexShrink: 0 }} />
              <span>Transfers are internal movements between accounts. They do not affect income, expenses, cash flow, or tax calculations.</span>
            </div>
          )}

          {/* Amount */}
          <div style={styles.amountSection}>
            <label style={styles.amountLabel}>Amount (NGN)</label>
            <div style={styles.amountInput}>
              <span style={styles.currencySymbol}>₦</span>
              <input
                type="text"
                value={formData.amount}
                onChange={handleAmountChange}
                placeholder="0"
                style={styles.amountField}
                required
              />
            </div>
          </div>

          {/* Date and Payee */}
          <div style={styles.row}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Date</label>
              <div style={styles.inputWrapper}>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  style={styles.input}
                  required
                />
                <Calendar size={16} style={styles.inputIcon} />
              </div>
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Payee</label>
              <div style={styles.selectWrapper}>
                <input
                  type="text"
                  value={formData.payee}
                  onChange={(e) => setFormData({ ...formData, payee: e.target.value })}
                  placeholder="Enter payee name"
                  style={styles.input}
                  required
                />
              </div>
            </div>
          </div>

          {/* Category and Payment Method */}
          <div style={styles.row}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Category</label>
              <div style={styles.selectWrapper}>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  style={styles.select}
                  required
                >
                  <option value="">Select category</option>
                  {categories[entryType]?.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
                {selectedCategory && (
                  <div 
                    style={{
                      ...styles.categoryDot,
                      backgroundColor: selectedCategory.color
                    }} 
                  />
                )}
                <ChevronDown size={16} style={styles.selectIcon} />
              </div>
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Payment Method</label>
              <div style={styles.selectWrapper}>
                <select
                  value={formData.paymentMethod}
                  onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                  style={styles.select}
                  required
                >
                  <option value="">Select method</option>
                  {paymentMethods.map((method) => (
                    <option key={method.id} value={method.id}>
                      {method.name}
                    </option>
                  ))}
                </select>
                <ChevronDown size={16} style={styles.selectIcon} />
              </div>
            </div>
          </div>

          {/* Description */}
          <div style={styles.formGroup}>
            <label style={styles.label}>Description (Optional)</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Add notes or description..."
              style={styles.textarea}
              rows={3}
            />
          </div>

          {/* VAT Toggle */}
          {entryType !== 'transfer' && (
            <div style={styles.vatSection}>
              <div style={styles.vatToggle}>
                <label style={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={formData.isVatable}
                    onChange={(e) => setFormData({ ...formData, isVatable: e.target.checked })}
                    style={styles.checkbox}
                  />
                  <span>VATable (7.5%)</span>
                </label>
                {formData.isVatable && formData.amount && (
                  <span style={styles.vatAmount}>
                    VAT: ₦{formData.vatAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Reference */}
          <div style={styles.formGroup}>
            <label style={styles.label}>Reference / Invoice # (Optional)</label>
            <input
              type="text"
              value={formData.reference}
              onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
              placeholder="e.g., INV-2024-001"
              style={styles.input}
            />
          </div>

          {/* Actions */}
          <div style={styles.actions}>
            <button type="button" style={styles.cancelButton} onClick={closeModal}>
              Cancel
            </button>
            <button 
              type="submit" 
              style={styles.submitButton}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : isEditing ? 'Update Transaction' : 'Save Transaction'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    zIndex: 9000,
    overflowY: 'auto',
    padding: '40px 20px'
  },
  modal: {
    width: '100%',
    maxWidth: '560px',
    backgroundColor: '#161B22',
    borderRadius: '16px',
    border: '1px solid #30363D',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 24px',
    borderBottom: '1px solid #30363D'
  },
  title: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#E6EDF3',
    margin: 0
  },
  closeButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '32px',
    backgroundColor: 'transparent',
    border: 'none',
    color: '#8B949E',
    cursor: 'pointer',
    borderRadius: '6px'
  },
  typeTabs: {
    display: 'flex',
    padding: '16px 24px',
    gap: '8px',
    justifyContent: 'center'
  },
  typeTab: {
    padding: '10px 32px',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '8px',
    color: '#8B949E',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.15s ease'
  },
  typeTabActive: {
    backgroundColor: '#2563EB',
    color: 'white'
  },
  form: {
    padding: '0 24px 24px'
  },
  transferInfo: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    padding: '12px 16px',
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    border: '1px solid rgba(59, 130, 246, 0.25)',
    borderRadius: '8px',
    marginBottom: '20px',
    fontSize: '13px',
    color: '#93C5FD',
    lineHeight: '1.5'
  },
  amountSection: {
    textAlign: 'center',
    marginBottom: '24px'
  },
  amountLabel: {
    fontSize: '13px',
    color: '#8B949E',
    marginBottom: '8px',
    display: 'block'
  },
  amountInput: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px'
  },
  currencySymbol: {
    fontSize: '36px',
    fontWeight: '300',
    color: '#8B949E'
  },
  amountField: {
    fontSize: '48px',
    fontWeight: '700',
    color: '#E6EDF3',
    backgroundColor: 'transparent',
    border: 'none',
    outline: 'none',
    textAlign: 'center',
    width: '280px'
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
    marginBottom: '16px'
  },
  formGroup: {
    marginBottom: '16px'
  },
  label: {
    display: 'block',
    fontSize: '13px',
    fontWeight: '500',
    color: '#8B949E',
    marginBottom: '8px'
  },
  inputWrapper: {
    position: 'relative'
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
  inputIcon: {
    position: 'absolute',
    right: '12px',
    top: '50%',
    transform: 'translateY(-50%)',
    color: '#8B949E'
  },
  selectWrapper: {
    position: 'relative'
  },
  select: {
    width: '100%',
    padding: '12px 16px',
    paddingRight: '40px',
    backgroundColor: '#0D1117',
    border: '1px solid #30363D',
    borderRadius: '8px',
    color: '#E6EDF3',
    fontSize: '14px',
    outline: 'none',
    cursor: 'pointer',
    appearance: 'none',
    boxSizing: 'border-box'
  },
  selectIcon: {
    position: 'absolute',
    right: '12px',
    top: '50%',
    transform: 'translateY(-50%)',
    color: '#8B949E',
    pointerEvents: 'none'
  },
  categoryDot: {
    position: 'absolute',
    left: '12px',
    top: '50%',
    transform: 'translateY(-50%)',
    width: '8px',
    height: '8px',
    borderRadius: '50%'
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
  vatSection: {
    padding: '16px',
    backgroundColor: '#0D1117',
    borderRadius: '8px',
    marginBottom: '16px'
  },
  vatToggle: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: '#E6EDF3',
    fontSize: '14px',
    cursor: 'pointer'
  },
  checkbox: {
    width: '18px',
    height: '18px',
    accentColor: '#2563EB',
    cursor: 'pointer'
  },
  vatAmount: {
    fontSize: '14px',
    color: '#22C55E',
    fontWeight: '500'
  },
  actions: {
    display: 'flex',
    gap: '12px',
    marginTop: '24px'
  },
  cancelButton: {
    flex: 1,
    padding: '14px',
    backgroundColor: 'transparent',
    border: '1px solid #30363D',
    borderRadius: '8px',
    color: '#8B949E',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer'
  },
  submitButton: {
    flex: 1,
    padding: '14px',
    backgroundColor: '#2563EB',
    border: 'none',
    borderRadius: '8px',
    color: 'white',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer'
  }
};

export default NewEntryModal;
