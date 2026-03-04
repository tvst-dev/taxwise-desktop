import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Search, Download, Plus, Filter, Calendar, MoreHorizontal,
  ChevronDown, Eye, Edit2, Trash2, ArrowUpRight, ArrowDownRight,
  FileText, X
} from 'lucide-react';
import { useEntriesStore, useUIStore } from '../../store';
import { deleteEntry } from '../../services/supabase';
import toast from 'react-hot-toast';

const Entries = () => {
  const { entries, removeEntry } = useEntriesStore();
  const { openModal } = useUIStore();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedEntries, setSelectedEntries] = useState([]);
  const [showActionsFor, setShowActionsFor] = useState(null);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowActionsFor(null);
      }
    };
    if (showActionsFor !== null) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showActionsFor]);

  // Filter entries based on search and filters
  const filteredEntries = useMemo(() => {
    return entries.filter(entry => {
      const matchesSearch = !searchTerm || 
        entry.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.vendor_customer?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.reference_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.category?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesType = filterType === 'all' || entry.entry_type === filterType;
      const matchesStatus = filterStatus === 'all' || entry.status === filterStatus;
      
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [entries, searchTerm, filterType, filterStatus]);

  // Calculate totals
  const totals = useMemo(() => {
    const income = filteredEntries
      .filter(e => e.entry_type === 'income')
      .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
    const expenses = filteredEntries
      .filter(e => e.entry_type === 'expense')
      .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
    return { income, expenses, net: income - expenses };
  }, [filteredEntries]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-NG', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const handleNewEntry = () => {
    openModal('newEntry');
  };

  const handleExport = () => {
    if (entries.length === 0) {
      toast.error('No entries to export');
      return;
    }
    openModal('export', { type: 'entries', data: filteredEntries });
  };

  const handleEdit = (entry) => {
    openModal('newEntry', { entry, isEditing: true });
    setShowActionsFor(null);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this entry?')) {
      try {
        await deleteEntry(id);
      } catch (e) {
        console.warn('DB delete failed, removing locally:', e.message);
      }
      removeEntry(id);
      toast.success('Entry deleted');
    }
    setShowActionsFor(null);
  };

  const handleSelectAll = () => {
    if (selectedEntries.length === filteredEntries.length) {
      setSelectedEntries([]);
    } else {
      setSelectedEntries(filteredEntries.map(e => e.id));
    }
  };

  const handleSelectEntry = (id) => {
    setSelectedEntries(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = async () => {
    if (selectedEntries.length === 0) return;
    if (window.confirm(`Delete ${selectedEntries.length} entries?`)) {
      await Promise.allSettled(selectedEntries.map(id => deleteEntry(id)));
      selectedEntries.forEach(id => removeEntry(id));
      setSelectedEntries([]);
      toast.success(`${selectedEntries.length} entries deleted`);
    }
  };

  const getTypeStyle = (type) => {
    switch (type) {
      case 'income':
        return { backgroundColor: 'rgba(34, 197, 94, 0.1)', color: '#22C55E' };
      case 'expense':
        return { backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#EF4444' };
      default:
        return { backgroundColor: 'rgba(139, 148, 158, 0.1)', color: '#8B949E' };
    }
  };

  const getStatusStyle = (status) => {
    switch (status) {
      case 'posted':
        return { backgroundColor: 'rgba(34, 197, 94, 0.1)', color: '#22C55E' };
      case 'pending':
        return { backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#F59E0B' };
      case 'draft':
        return { backgroundColor: 'rgba(139, 148, 158, 0.1)', color: '#8B949E' };
      default:
        return { backgroundColor: 'rgba(139, 148, 158, 0.1)', color: '#8B949E' };
    }
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Entries</h1>
          <p style={styles.subtitle}>
            Manage your income and expense records
          </p>
        </div>
        <div style={styles.headerActions}>
          <button style={styles.exportBtn} onClick={handleExport}>
            <Download size={16} />
            Export
          </button>
          <button style={styles.primaryBtn} onClick={handleNewEntry}>
            <Plus size={16} />
            New Entry
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={styles.summaryGrid}>
        <div style={styles.summaryCard}>
          <span style={styles.summaryLabel}>Total Income</span>
          <span style={{ ...styles.summaryValue, color: '#22C55E' }}>
            {formatCurrency(totals.income)}
          </span>
        </div>
        <div style={styles.summaryCard}>
          <span style={styles.summaryLabel}>Total Expenses</span>
          <span style={{ ...styles.summaryValue, color: '#EF4444' }}>
            {formatCurrency(totals.expenses)}
          </span>
        </div>
        <div style={styles.summaryCard}>
          <span style={styles.summaryLabel}>Net Amount</span>
          <span style={{ 
            ...styles.summaryValue, 
            color: totals.net >= 0 ? '#22C55E' : '#EF4444' 
          }}>
            {formatCurrency(totals.net)}
          </span>
        </div>
        <div style={styles.summaryCard}>
          <span style={styles.summaryLabel}>Total Entries</span>
          <span style={styles.summaryValue}>{filteredEntries.length}</span>
        </div>
      </div>

      {/* Toolbar */}
      <div style={styles.toolbar}>
        <div style={styles.searchBox}>
          <Search size={16} color="#8B949E" />
          <input
            type="text"
            placeholder="Search entries..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={styles.searchInput}
          />
          {searchTerm && (
            <button 
              style={styles.clearSearch}
              onClick={() => setSearchTerm('')}
            >
              <X size={14} />
            </button>
          )}
        </div>
        <div style={styles.filters}>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            style={styles.filterSelect}
          >
            <option value="all">All Types</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={styles.filterSelect}
          >
            <option value="all">All Status</option>
            <option value="posted">Posted</option>
            <option value="pending">Pending</option>
            <option value="draft">Draft</option>
          </select>
          {selectedEntries.length > 0 && (
            <button style={styles.deleteBtn} onClick={handleBulkDelete}>
              <Trash2 size={14} />
              Delete ({selectedEntries.length})
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div style={styles.tableCard}>
        {filteredEntries.length === 0 ? (
          <div style={styles.emptyState}>
            <FileText size={48} color="#30363D" />
            <h3 style={styles.emptyTitle}>No entries found</h3>
            <p style={styles.emptyText}>
              {entries.length === 0 
                ? "You haven't created any entries yet. Get started by adding your first entry."
                : "No entries match your current filters. Try adjusting your search criteria."
              }
            </p>
            {entries.length === 0 && (
              <button style={styles.emptyBtn} onClick={handleNewEntry}>
                <Plus size={16} />
                Create Entry
              </button>
            )}
          </div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>
                  <input
                    type="checkbox"
                    checked={selectedEntries.length === filteredEntries.length && filteredEntries.length > 0}
                    onChange={handleSelectAll}
                    style={styles.checkbox}
                  />
                </th>
                <th style={styles.th}>Date</th>
                <th style={styles.th}>Description</th>
                <th style={styles.th}>Category</th>
                <th style={styles.th}>Type</th>
                <th style={styles.th}>Amount</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.map((entry) => (
                <tr 
                  key={entry.id} 
                  style={{
                    ...styles.tr,
                    backgroundColor: selectedEntries.includes(entry.id) ? '#1C2128' : 'transparent'
                  }}
                >
                  <td style={styles.td}>
                    <input
                      type="checkbox"
                      checked={selectedEntries.includes(entry.id)}
                      onChange={() => handleSelectEntry(entry.id)}
                      style={styles.checkbox}
                    />
                  </td>
                  <td style={styles.td}>{formatDate(entry.date || entry.createdAt)}</td>
                  <td style={styles.td}>
                    <div style={styles.descriptionCell}>
                      <span style={styles.description}>{entry.description || 'Untitled'}</span>
                      {entry.vendor_customer && (
                        <span style={styles.subDescription}>{entry.vendor_customer}</span>
                      )}
                    </div>
                  </td>
                  <td style={styles.td}>{entry.category || '-'}</td>
                  <td style={styles.td}>
                    <span style={{ ...styles.typeBadge, ...getTypeStyle(entry.entry_type) }}>
                      {entry.entry_type === 'income' && <ArrowUpRight size={12} />}
                      {entry.entry_type === 'expense' && <ArrowDownRight size={12} />}
                      {(entry.entry_type || 'Other').charAt(0).toUpperCase() + (entry.entry_type || 'other').slice(1)}
                    </span>
                  </td>
                  <td style={{ 
                    ...styles.td, 
                    fontWeight: '600',
                    color: entry.entry_type === 'income' ? '#22C55E' : '#E6EDF3'
                  }}>
                    {entry.entry_type === 'income' ? '+' : ''}{formatCurrency(entry.amount)}
                  </td>
                  <td style={styles.td}>
                    <span style={{ ...styles.statusBadge, ...getStatusStyle(entry.status) }}>
                      {(entry.status || 'draft').charAt(0).toUpperCase() + (entry.status || 'draft').slice(1)}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <div style={styles.actionsCell} ref={showActionsFor === entry.id ? dropdownRef : null}>
                      <button
                        style={styles.actionBtn}
                        onClick={() => setShowActionsFor(showActionsFor === entry.id ? null : entry.id)}
                      >
                        <MoreHorizontal size={16} />
                      </button>
                      {showActionsFor === entry.id && (
                        <div style={styles.actionsDropdown}>
                          <button 
                            style={styles.dropdownItem}
                            onClick={() => handleEdit(entry)}
                          >
                            <Edit2 size={14} />
                            Edit
                          </button>
                          <button 
                            style={{ ...styles.dropdownItem, color: '#EF4444' }}
                            onClick={() => handleDelete(entry.id)}
                          >
                            <Trash2 size={14} />
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Results Count */}
      {filteredEntries.length > 0 && (
        <div style={styles.footer}>
          <span style={styles.resultCount}>
            Showing {filteredEntries.length} of {entries.length} entries
          </span>
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
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '16px',
    marginBottom: '24px'
  },
  summaryCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '16px 20px',
    backgroundColor: '#161B22',
    border: '1px solid #30363D',
    borderRadius: '10px'
  },
  summaryLabel: {
    fontSize: '13px',
    color: '#8B949E'
  },
  summaryValue: {
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
  clearSearch: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    border: 'none',
    color: '#8B949E',
    cursor: 'pointer',
    padding: '2px'
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
  deleteBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '10px 16px',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: '8px',
    color: '#EF4444',
    fontSize: '14px',
    cursor: 'pointer'
  },
  tableCard: {
    backgroundColor: '#161B22',
    border: '1px solid #30363D',
    borderRadius: '12px',
    overflow: 'visible'
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
  descriptionCell: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px'
  },
  description: {
    fontWeight: '500'
  },
  subDescription: {
    fontSize: '12px',
    color: '#8B949E'
  },
  typeBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 10px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '500'
  },
  statusBadge: {
    display: 'inline-block',
    padding: '4px 10px',
    borderRadius: '9999px',
    fontSize: '12px',
    fontWeight: '500'
  },
  actionsCell: {
    position: 'relative'
  },
  actionBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '32px',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '6px',
    color: '#8B949E',
    cursor: 'pointer'
  },
  actionsDropdown: {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: '4px',
    backgroundColor: '#161B22',
    border: '1px solid #30363D',
    borderRadius: '8px',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
    zIndex: 100,
    minWidth: '120px',
    overflow: 'hidden'
  },
  dropdownItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    width: '100%',
    padding: '10px 14px',
    backgroundColor: 'transparent',
    border: 'none',
    color: '#E6EDF3',
    fontSize: '13px',
    cursor: 'pointer',
    textAlign: 'left'
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
    margin: '0 0 24px',
    maxWidth: '400px'
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
  footer: {
    marginTop: '16px',
    padding: '12px 0'
  },
  resultCount: {
    fontSize: '13px',
    color: '#8B949E'
  }
};

export default Entries;
