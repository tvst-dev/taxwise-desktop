import React, { useState } from 'react';
import { X, FileText, FileSpreadsheet, File, Calendar, Mail, Download } from 'lucide-react';
import { useUIStore, useAuthStore, useEntriesStore, useTaxStore } from '../../store';
import exportService from '../../services/export';
import toast from 'react-hot-toast';

const ExportModal = () => {
  const { activeModal, closeModal, modalData } = useUIStore();
  const { organization } = useAuthStore();
  const { entries } = useEntriesStore();
  const { calculations } = useTaxStore();

  const [exportType, setExportType] = useState('transactions');
  const [dateRange, setDateRange] = useState({
    start: '2020-01-01',
    end: new Date().toISOString().split('T')[0]
  });
  const [exportFormat, setExportFormat] = useState('pdf');
  const [includeVAT, setIncludeVAT] = useState(true);
  const [emailTo, setEmailTo] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  const isOpen = activeModal === 'export';

  const exportTypes = [
    { id: 'transactions', name: 'All Transactions', description: 'Includes income, expenses, and transfers' },
    { id: 'tax_calculations', name: 'Tax Calculations', description: 'PAYE, VAT, CIT, WHT calculations' },
    { id: 'audit_report', name: 'Audit Report', description: 'Comprehensive audit-ready report' }
  ];

  const exportFormats = [
    { id: 'pdf', name: 'PDF', icon: FileText, description: 'Best for sharing & printing' },
    { id: 'xlsx', name: 'Excel', icon: FileSpreadsheet, description: 'Best for data analysis' },
    { id: 'csv', name: 'CSV', icon: File, description: 'Universal format' }
  ];

  const getTaxTypeName = (type) => {
    const names = { paye: 'PAYE', cit: 'Company Income Tax', vat: 'VAT', wht: 'Withholding Tax', cgt: 'Capital Gains Tax' };
    return names[(type || '').toLowerCase()] || (type || '').toUpperCase();
  };

  const generateCSV = (rows, headers) => {
    const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    return [headers.join(','), ...rows.map(r => r.map(escape).join(','))].join('\n');
  };

  const downloadText = (text, filename, mime = 'text/csv') => {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const startDate = new Date(dateRange.start);
      const endDate = new Date(dateRange.end + 'T23:59:59');
      const orgData = { name: organization?.name || 'TaxWise', tin: organization?.tin };

      // Use data passed from caller (e.g. TaxHistory) or fall back to full store data
      const passedData = modalData?.data;

      // --- ENTRIES / TRANSACTIONS ---
      if (exportType === 'transactions' || exportType === 'audit_report') {
        const source = passedData || entries;
        const filtered = source.filter(e => {
          const d = new Date(e.date || e.created_at || e.createdAt);
          return d >= startDate && d <= endDate;
        });

        const title = exportType === 'audit_report' ? 'Audit Report' : 'Transaction Report';

        if (exportFormat === 'pdf') {
          const doc = await exportService.exportEntriesPDF({
            entries: filtered, organization: orgData, dateRange, title
          });
          doc.save(`TaxWise-${title.replace(/ /g, '-')}-${today}.pdf`);
        } else if (exportFormat === 'xlsx') {
          const wb = await exportService.exportEntriesExcel({
            entries: filtered, organization: orgData, dateRange, title
          });
          await exportService.downloadExcel(wb, `TaxWise-${title.replace(/ /g, '-')}-${today}.xlsx`);
        } else {
          const csv = generateCSV(
            filtered.map((e, i) => [
              i + 1,
              e.entry_id || e.id || '',
              e.date || '',
              e.description || '',
              (e.entry_type || '').toUpperCase(),
              e.amount || 0,
              e.category || '',
              e.status || ''
            ]),
            ['#', 'ID', 'Date', 'Description', 'Type', 'Amount (NGN)', 'Category', 'Status']
          );
          downloadText(csv, `TaxWise-Transactions-${today}.csv`);
        }
      }

      // --- TAX CALCULATIONS ---
      else if (exportType === 'tax_calculations') {
        const source = passedData || calculations;
        const filtered = source.filter(c => {
          const d = new Date(c.created_at || c.createdAt);
          return d >= startDate && d <= endDate;
        });

        if (exportFormat === 'pdf') {
          const doc = await exportService.exportEntriesPDF({
            entries: filtered.map((c, i) => ({
              id: c.id, date: c.created_at || c.createdAt,
              description: getTaxTypeName(c.tax_type),
              entry_type: (c.tax_type || '').toUpperCase(),
              amount: c.net_tax_payable || 0, status: c.status || 'draft'
            })),
            organization: orgData, dateRange, title: 'Tax Calculations Report'
          });
          doc.save(`TaxWise-Tax-Calculations-${today}.pdf`);
        } else if (exportFormat === 'xlsx') {
          const wb = await exportService.exportEntriesExcel({
            entries: filtered.map(c => ({
              id: c.id, date: c.created_at || c.createdAt,
              description: getTaxTypeName(c.tax_type),
              entry_type: (c.tax_type || '').toUpperCase(),
              amount: c.net_tax_payable || 0, status: c.status || 'draft'
            })),
            organization: orgData, dateRange, title: 'Tax Calculations Report'
          });
          await exportService.downloadExcel(wb, `TaxWise-Tax-Calculations-${today}.xlsx`);
        } else {
          const csv = generateCSV(
            filtered.map((c, i) => [
              i + 1, c.id || '', c.created_at || c.createdAt || '',
              getTaxTypeName(c.tax_type), c.fiscal_year || '',
              c.net_tax_payable || 0, c.taxable_amount || 0,
              c.status || 'draft'
            ]),
            ['#', 'ID', 'Date', 'Tax Type', 'Fiscal Year', 'Tax Payable (NGN)', 'Taxable Amount (NGN)', 'Status']
          );
          downloadText(csv, `TaxWise-Tax-Calculations-${today}.csv`);
        }
      }

      if (emailTo?.trim()) {
        toast('File downloaded — please attach and send manually (email delivery requires server config).');
      } else {
        toast.success('Export complete! Check your Downloads folder.');
      }
      closeModal();
    } catch (error) {
      console.error('Export failed:', error);
      toast.error(`Export failed: ${error.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={styles.overlay} onClick={closeModal}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <h2 style={styles.title}>Export Data</h2>
          <button style={styles.closeButton} onClick={closeModal}>
            <X size={20} />
          </button>
        </div>

        <div style={styles.content}>
          {/* Export Type Selection */}
          <div style={styles.section}>
            <label style={styles.sectionTitle}>Select data to export</label>
            <div style={styles.radioGroup}>
              {exportTypes.map((type) => (
                <label
                  key={type.id}
                  style={{ ...styles.radioOption, ...(exportType === type.id ? styles.radioOptionActive : {}) }}
                >
                  <input
                    type="radio"
                    name="exportType"
                    value={type.id}
                    checked={exportType === type.id}
                    onChange={(e) => setExportType(e.target.value)}
                    style={styles.radio}
                  />
                  <div style={styles.radioContent}>
                    <span style={styles.radioLabel}>{type.name}</span>
                    <span style={styles.radioDescription}>{type.description}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Date Range */}
          <div style={styles.section}>
            <label style={styles.sectionTitle}>Date Range</label>
            <div style={styles.dateRange}>
              <div style={styles.dateInput}>
                <Calendar size={16} style={styles.dateIcon} />
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                  style={styles.dateField}
                />
              </div>
              <span style={styles.dateSeparator}>to</span>
              <div style={styles.dateInput}>
                <Calendar size={16} style={styles.dateIcon} />
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                  style={styles.dateField}
                />
              </div>
            </div>
          </div>

          {/* Export Format */}
          <div style={styles.section}>
            <label style={styles.sectionTitle}>Export Format</label>
            <div style={styles.formatGrid}>
              {exportFormats.map((format) => {
                const Icon = format.icon;
                return (
                  <button
                    key={format.id}
                    style={{ ...styles.formatButton, ...(exportFormat === format.id ? styles.formatButtonActive : {}) }}
                    onClick={() => setExportFormat(format.id)}
                    type="button"
                  >
                    <Icon size={24} />
                    <span style={styles.formatName}>{format.name}</span>
                    <span style={styles.formatDescription}>{format.description}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Options */}
          <div style={styles.section}>
            <label style={styles.sectionTitle}>Options</label>
            <div style={styles.optionsGroup}>
              <label style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={includeVAT}
                  onChange={(e) => setIncludeVAT(e.target.checked)}
                  style={styles.checkbox}
                />
                <span>Include VAT breakdown</span>
              </label>
            </div>
          </div>

          {/* Email Option */}
          <div style={styles.section}>
            <label style={styles.sectionTitle}>Send via Email (Optional)</label>
            <div style={styles.emailInput}>
              <Mail size={16} style={styles.emailIcon} />
              <input
                type="email"
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                placeholder="accountant@company.com"
                style={styles.emailField}
              />
            </div>
          </div>

          {/* Actions */}
          <div style={styles.actions}>
            <button type="button" style={styles.cancelButton} onClick={closeModal}>
              Cancel
            </button>
            <button
              style={styles.exportButton}
              onClick={handleExport}
              disabled={isExporting}
            >
              <Download size={16} />
              <span>{isExporting ? 'Exporting...' : 'Export'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const styles = {
  overlay: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
    zIndex: 9000, overflowY: 'auto', padding: '40px 20px'
  },
  modal: {
    width: '100%', maxWidth: '520px',
    backgroundColor: '#161B22', borderRadius: '16px',
    border: '1px solid #30363D', overflow: 'hidden', flexShrink: 0
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '20px 24px', borderBottom: '1px solid #30363D'
  },
  title: { fontSize: '18px', fontWeight: '600', color: '#E6EDF3', margin: 0 },
  closeButton: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: '32px', height: '32px', backgroundColor: 'transparent',
    border: 'none', color: '#8B949E', cursor: 'pointer', borderRadius: '6px'
  },
  content: { padding: '24px' },
  section: { marginBottom: '24px' },
  sectionTitle: { display: 'block', fontSize: '13px', fontWeight: '500', color: '#8B949E', marginBottom: '12px' },
  radioGroup: { display: 'flex', flexDirection: 'column', gap: '8px' },
  radioOption: {
    display: 'flex', alignItems: 'center', gap: '12px', padding: '16px',
    backgroundColor: '#0D1117', border: '1px solid #30363D',
    borderRadius: '8px', cursor: 'pointer', transition: 'all 0.15s ease'
  },
  radioOptionActive: { borderColor: '#2563EB', backgroundColor: 'rgba(37, 99, 235, 0.1)' },
  radio: { width: '18px', height: '18px', accentColor: '#2563EB', cursor: 'pointer' },
  radioContent: { display: 'flex', flexDirection: 'column', gap: '2px' },
  radioLabel: { fontSize: '14px', fontWeight: '500', color: '#E6EDF3' },
  radioDescription: { fontSize: '12px', color: '#8B949E' },
  dateRange: { display: 'flex', alignItems: 'center', gap: '12px' },
  dateInput: { flex: 1, position: 'relative' },
  dateIcon: {
    position: 'absolute', right: '12px', top: '50%',
    transform: 'translateY(-50%)', color: '#8B949E', pointerEvents: 'none'
  },
  dateField: {
    width: '100%', padding: '12px 40px 12px 16px',
    backgroundColor: '#0D1117', border: '1px solid #30363D',
    borderRadius: '8px', color: '#E6EDF3', fontSize: '14px',
    outline: 'none', boxSizing: 'border-box'
  },
  dateSeparator: { color: '#8B949E', fontSize: '14px' },
  formatGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' },
  formatButton: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
    padding: '20px 12px', backgroundColor: '#0D1117',
    border: '1px solid #30363D', borderRadius: '8px',
    color: '#8B949E', cursor: 'pointer', transition: 'all 0.15s ease'
  },
  formatButtonActive: { borderColor: '#2563EB', backgroundColor: 'rgba(37, 99, 235, 0.1)', color: '#2563EB' },
  formatName: { fontSize: '14px', fontWeight: '600', color: 'inherit' },
  formatDescription: { fontSize: '11px', color: '#8B949E', textAlign: 'center' },
  optionsGroup: { display: 'flex', flexDirection: 'column', gap: '12px' },
  checkboxLabel: { display: 'flex', alignItems: 'center', gap: '10px', color: '#E6EDF3', fontSize: '14px', cursor: 'pointer' },
  checkbox: { width: '18px', height: '18px', accentColor: '#2563EB', cursor: 'pointer' },
  emailInput: { position: 'relative' },
  emailIcon: { position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#8B949E' },
  emailField: {
    width: '100%', padding: '12px 16px 12px 40px',
    backgroundColor: '#0D1117', border: '1px solid #30363D',
    borderRadius: '8px', color: '#E6EDF3', fontSize: '14px',
    outline: 'none', boxSizing: 'border-box'
  },
  actions: { display: 'flex', gap: '12px', marginTop: '8px' },
  cancelButton: {
    flex: 1, padding: '14px', backgroundColor: 'transparent',
    border: '1px solid #30363D', borderRadius: '8px',
    color: '#8B949E', fontSize: '14px', fontWeight: '500', cursor: 'pointer'
  },
  exportButton: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
    padding: '14px', backgroundColor: '#2563EB', border: 'none',
    borderRadius: '8px', color: 'white', fontSize: '14px', fontWeight: '500', cursor: 'pointer'
  }
};

export default ExportModal;
