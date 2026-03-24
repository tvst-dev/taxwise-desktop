import React, { useState, useMemo } from 'react';
import {
  Search, Filter, Calendar, Download, Plus, 
  TrendingUp, Clock, AlertCircle, CheckCircle,
  MoreHorizontal, FileText, ChevronDown, Trash2, Eye,
  Calculator
} from 'lucide-react';
import { useTaxStore, useUIStore, useAuthStore } from '../../store';
import { deleteTaxCalculation } from '../../services/supabase';
import toast from 'react-hot-toast';

const TaxHistory = () => {
  const { user } = useAuthStore();
  const { calculations, removeCalculation } = useTaxStore();
  const { openModal } = useUIStore();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedItems, setSelectedItems] = useState([]);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Tax types for filtering
  const taxTypes = [
    { value: 'all', label: 'All Types' },
    { value: 'PAYE', label: 'Personal Income Tax (PAYE)' },
    { value: 'CIT', label: 'Company Income Tax' },
    { value: 'VAT', label: 'Value Added Tax' },
    { value: 'WHT', label: 'Withholding Tax' },
    { value: 'CGT', label: 'Capital Gains Tax' },
    { value: 'EDT', label: 'Education Tax' }
  ];

  const statuses = [
    { value: 'all', label: 'All Status' },
    { value: 'draft', label: 'Draft' },
    { value: 'pending', label: 'Pending' },
    { value: 'filed', label: 'Filed' },
    { value: 'paid', label: 'Paid' }
  ];

  // Filter and search calculations
  const filteredCalculations = useMemo(() => {
    return calculations.filter(calc => {
      const matchesSearch = !searchTerm || 
        calc.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        calc.tax_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        calc.description?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesType = filterType === 'all' || calc.tax_type?.toLowerCase() === filterType.toLowerCase();
      const matchesStatus = filterStatus === 'all' || calc.status === filterStatus;
      
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [calculations, searchTerm, filterType, filterStatus]);

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    const total = calculations.reduce((sum, c) => sum + (parseFloat(c.net_tax_payable) || 0), 0);
    const pending = calculations.filter(c => c.status === 'pending').length;
    const filed = calculations.filter(c => c.status === 'filed' || c.status === 'paid').length;
    const draft = calculations.filter(c => c.status === 'draft' || !c.status).length;
    
    return { total, pending, filed, draft, count: calculations.length };
  }, [calculations]);

  const formatCurrency = (amount) => {
    if (!amount) return '₦0';
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-NG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusStyle = (status) => {
    const styles = {
      filed: { backgroundColor: 'rgba(34, 197, 94, 0.1)', color: '#22C55E' },
      paid: { backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3B82F6' },
      pending: { backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#F59E0B' },
      draft: { backgroundColor: 'rgba(139, 148, 158, 0.1)', color: '#8B949E' }
    };
    return styles[status] || styles.draft;
  };

  const getTaxTypeName = (type) => {
    const names = {
      paye: 'Personal Income Tax',
      cit: 'Company Income Tax',
      vat: 'Value Added Tax',
      wht: 'Withholding Tax',
      cgt: 'Capital Gains Tax',
      edt: 'Education Tax',
      PAYE: 'Personal Income Tax',
      CIT: 'Company Income Tax',
      VAT: 'Value Added Tax',
      WHT: 'Withholding Tax',
      CGT: 'Capital Gains Tax',
      EDT: 'Education Tax'
    };
    return names[type] || type?.toUpperCase() || '-';
  };

  const handleNewCalculation = () => {
    openModal('taxCalculator');
  };

  const handleDelete = (id) => setConfirmDeleteId(id);

  const handleDeleteConfirm = async () => {
    const id = confirmDeleteId;
    setConfirmDeleteId(null);
    setIsDeleting(true);
    // Optimistic: remove from UI immediately so the user sees instant feedback
    removeCalculation(id);
    try {
      await deleteTaxCalculation(id);
      toast.success('Calculation deleted');
    } catch (e) {
      // DB delete failed — item removed locally but will reappear on next sync
      console.error('DB delete failed:', e.message);
      toast.error(`Removed locally. Server error: ${e.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExport = () => {
    if (filteredCalculations.length === 0) {
      toast.error('No data to export');
      return;
    }
    openModal('export', { type: 'tax_calculations', data: filteredCalculations });
  };

  const toggleSelectAll = () => {
    if (selectedItems.length === filteredCalculations.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(filteredCalculations.map(c => c.id));
    }
  };

  const toggleSelect = (id) => {
    setSelectedItems(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Tax Calculation History</h1>
          <p style={styles.subtitle}>
            View and manage all your tax calculations
          </p>
        </div>
        <button style={styles.primaryButton} onClick={handleNewCalculation}>
          <Plus size={16} />
          New Calculation
        </button>
      </div>

      {/* Stats Cards */}
      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <div style={styles.statIcon}>
            <Calculator size={20} color="#2563EB" />
          </div>
          <div style={styles.statContent}>
            <span style={styles.statLabel}>Total Calculations</span>
            <span style={styles.statValue}>{summaryStats.count}</span>
          </div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statIcon}>
            <TrendingUp size={20} color="#22C55E" />
          </div>
          <div style={styles.statContent}>
            <span style={styles.statLabel}>Total Tax Calculated</span>
            <span style={styles.statValue}>{formatCurrency(summaryStats.total)}</span>
          </div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statIcon}>
            <Clock size={20} color="#F59E0B" />
          </div>
          <div style={styles.statContent}>
            <span style={styles.statLabel}>Pending</span>
            <span style={styles.statValue}>{summaryStats.pending}</span>
          </div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statIcon}>
            <CheckCircle size={20} color="#22C55E" />
          </div>
          <div style={styles.statContent}>
            <span style={styles.statLabel}>Filed/Paid</span>
            <span style={styles.statValue}>{summaryStats.filed}</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={styles.toolbar}>
        <div style={styles.searchBox}>
          <Search size={16} color="#8B949E" />
          <input
            type="text"
            placeholder="Search calculations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={styles.searchInput}
          />
        </div>
        <div style={styles.filters}>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            style={styles.filterSelect}
          >
            {taxTypes.map(type => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={styles.filterSelect}
          >
            {statuses.map(status => (
              <option key={status.value} value={status.value}>{status.label}</option>
            ))}
          </select>
          <button style={styles.exportButton} onClick={handleExport}>
            <Download size={16} />
            Export
          </button>
        </div>
      </div>

      {/* Table */}
      <div style={styles.tableCard}>
        {filteredCalculations.length === 0 ? (
          <div style={styles.emptyState}>
            <Calculator size={48} color="#30363D" />
            <h3 style={styles.emptyTitle}>No calculations found</h3>
            <p style={styles.emptyText}>
              {calculations.length === 0 
                ? "You haven't made any tax calculations yet."
                : "No calculations match your current filters."
              }
            </p>
            {calculations.length === 0 && (
              <button style={styles.emptyButton} onClick={handleNewCalculation}>
                <Plus size={16} />
                Create First Calculation
              </button>
            )}
          </div>
        ) : (
          <>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>
                    <input
                      type="checkbox"
                      checked={selectedItems.length === filteredCalculations.length && filteredCalculations.length > 0}
                      onChange={toggleSelectAll}
                      style={styles.checkbox}
                    />
                  </th>
                  <th style={styles.th}>Reference</th>
                  <th style={styles.th}>Date</th>
                  <th style={styles.th}>Tax Type</th>
                  <th style={styles.th}>Taxable Amount</th>
                  <th style={styles.th}>Tax Payable</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCalculations.map((calc) => (
                  <tr key={calc.id} style={styles.tr}>
                    <td style={styles.td}>
                      <input
                        type="checkbox"
                        checked={selectedItems.includes(calc.id)}
                        onChange={() => toggleSelect(calc.id)}
                        style={styles.checkbox}
                      />
                    </td>
                    <td style={styles.td}>
                      <span style={styles.referenceId}>
                        {calc.id?.slice(0, 12) || '-'}
                      </span>
                    </td>
                    <td style={styles.td}>{formatDate(calc.createdAt || calc.created_at)}</td>
                    <td style={styles.td}>{getTaxTypeName(calc.tax_type)}</td>
                    <td style={styles.td}>{formatCurrency(calc.taxable_amount || calc.taxable_income || calc.gross_amount)}</td>
                    <td style={{ ...styles.td, fontWeight: '600' }}>
                      {formatCurrency(calc.net_tax_payable)}
                    </td>
                    <td style={styles.td}>
                      <span style={{ ...styles.statusBadge, ...getStatusStyle(calc.status) }}>
                        {(calc.status || 'draft').charAt(0).toUpperCase() + (calc.status || 'draft').slice(1)}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <div style={styles.actions}>
                        <button 
                          style={styles.actionButton} 
                          title="View Details"
                          onClick={() => openModal('taxCalculator', { calculation: calc })}
                        >
                          <Eye size={14} />
                        </button>
                        <button 
                          style={{ ...styles.actionButton, color: '#EF4444' }} 
                          title="Delete"
                          onClick={() => handleDelete(calc.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={styles.tableFooter}>
              <span style={styles.resultCount}>
                Showing {filteredCalculations.length} of {calculations.length} calculations
              </span>
            </div>
          </>
        )}
      </div>

      {/* Inline delete confirmation */}
      {confirmDeleteId && (
        <div style={confirmStyles.overlay}>
          <div style={confirmStyles.box}>
            <p style={confirmStyles.text}>Delete this calculation? This cannot be undone.</p>
            <div style={confirmStyles.actions}>
              <button style={confirmStyles.cancel} onClick={() => setConfirmDeleteId(null)}>Cancel</button>
              <button style={confirmStyles.confirm} onClick={handleDeleteConfirm} disabled={isDeleting}>
                {isDeleting ? 'Deleting…' : 'Delete'}
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
  primaryButton: {
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
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '16px',
    marginBottom: '24px'
  },
  statCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '20px',
    backgroundColor: '#161B22',
    border: '1px solid #30363D',
    borderRadius: '12px'
  },
  statIcon: {
    width: '44px',
    height: '44px',
    borderRadius: '10px',
    backgroundColor: '#21262D',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  statContent: {
    display: 'flex',
    flexDirection: 'column'
  },
  statLabel: {
    fontSize: '13px',
    color: '#8B949E',
    marginBottom: '4px'
  },
  statValue: {
    fontSize: '20px',
    fontWeight: '600',
    color: '#E6EDF3'
  },
  toolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
    gap: '16px'
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
    maxWidth: '400px'
  },
  searchInput: {
    flex: 1,
    backgroundColor: 'transparent',
    border: 'none',
    color: '#E6EDF3',
    fontSize: '14px',
    outline: 'none'
  },
  filters: {
    display: 'flex',
    gap: '12px'
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
  exportButton: {
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
    borderBottom: '1px solid #30363D',
    backgroundColor: '#161B22'
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
  checkbox: {
    width: '16px',
    height: '16px',
    accentColor: '#2563EB',
    cursor: 'pointer'
  },
  referenceId: {
    fontFamily: 'monospace',
    color: '#3B82F6',
    fontSize: '13px'
  },
  statusBadge: {
    display: 'inline-block',
    padding: '4px 12px',
    borderRadius: '9999px',
    fontSize: '12px',
    fontWeight: '500'
  },
  actions: {
    display: 'flex',
    gap: '8px'
  },
  actionButton: {
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
  tableFooter: {
    padding: '12px 16px',
    borderTop: '1px solid #30363D'
  },
  resultCount: {
    fontSize: '13px',
    color: '#8B949E'
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
  emptyButton: {
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
  }
};

const confirmStyles = {
  overlay: {
    position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000
  },
  box: {
    background: '#161B22', border: '1px solid #30363D', borderRadius: 12,
    padding: '24px 28px', width: 320
  },
  text: { color: '#E6EDF3', fontSize: 15, margin: '0 0 20px' },
  actions: { display: 'flex', gap: 12 },
  cancel: {
    flex: 1, padding: '10px', background: 'transparent', border: '1px solid #30363D',
    borderRadius: 8, color: '#8B949E', fontSize: 14, cursor: 'pointer'
  },
  confirm: {
    flex: 1, padding: '10px', background: '#EF4444', border: 'none',
    borderRadius: 8, color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer'
  }
};

export default TaxHistory;
