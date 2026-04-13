import React, { useState } from 'react';
import { X, FileText, FileSpreadsheet, File, Calendar, Mail, Download } from 'lucide-react';
import { useUIStore, useAuthStore, useEntriesStore, useTaxStore, useDeductionsStore } from '../../store';
import exportService from '../../services/export';
import toast from 'react-hot-toast';

const ExportModal = () => {
  const { activeModal, closeModal, modalData } = useUIStore();
  const { organization } = useAuthStore();
  const { entries } = useEntriesStore();
  const { calculations } = useTaxStore();
  const { deductions } = useDeductionsStore();

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

  // Sync exportType when modal opens — handle both exportType key and type alias
  React.useEffect(() => {
    if (isOpen) {
      const incoming = modalData?.exportType || modalData?.type;
      if (incoming) setExportType(incoming);
      else setExportType('transactions');
    }
  }, [isOpen, modalData]);

  // Deductions only supports CSV — auto-select it
  React.useEffect(() => {
    if (exportType === 'deductions') setExportFormat('csv');
  }, [exportType]);

  const exportTypes = [
    { id: 'transactions', name: 'All Transactions', description: 'Income, expenses, and transfers' },
    { id: 'tax_calculations', name: 'Tax Calculations', description: 'PAYE, VAT, CIT, WHT calculations' },
    { id: 'deductions', name: 'Deductions', description: 'Tax deductions and statutory reliefs' },
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
        const source = Array.isArray(passedData) ? passedData : entries;
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
          const csvMeta = [
            `"App","TaxWise Nigeria"`,
            `"Company","${orgData.name || 'N/A'}"`,
            `"TIN","${orgData.tin || 'N/A'}"`,
            `"Report","${title}"`,
            `"Period","${dateRange.start} to ${dateRange.end}"`,
            `"Generated","${today}"`,
            `"Total Records","${filtered.length}"`,
            ``
          ].join('\n');
          const csv = csvMeta + generateCSV(
            filtered.map((e, i) => [
              i + 1,
              e.entry_id || e.entryId || (e.id ? e.id : ''),
              e.date || e.created_at || '',
              e.description || '',
              (e.entry_type || e.type || '').toUpperCase(),
              e.category || '',
              parseFloat(e.amount) || 0,
              parseFloat(e.vat_amount) || 0,
              e.status || 'active'
            ]),
            ['#', 'Entry ID', 'Date', 'Description', 'Type', 'Category', 'Amount (NGN)', 'VAT (NGN)', 'Status']
          );
          downloadText(csv, `TaxWise-Transactions-${today}.csv`);
        }
      }

      // --- TAX CALCULATIONS ---
      else if (exportType === 'tax_calculations') {
        const source = Array.isArray(passedData) ? passedData : calculations;
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
          const csvMeta = [
            `"App","TaxWise Nigeria"`,
            `"Company","${orgData.name || 'N/A'}"`,
            `"TIN","${orgData.tin || 'N/A'}"`,
            `"Report","Tax Calculations Report"`,
            `"Period","${dateRange.start} to ${dateRange.end}"`,
            `"Generated","${today}"`,
            `"Total Records","${filtered.length}"`,
            ``
          ].join('\n');
          const csv = csvMeta + generateCSV(
            filtered.map((c, i) => [
              i + 1,
              c.id || '',
              c.created_at || c.createdAt || '',
              getTaxTypeName(c.tax_type),
              (c.tax_type || '').toUpperCase(),
              c.fiscal_year || '',
              c.taxable_amount || c.taxable_income || c.gross_amount || 0,
              c.net_tax_payable || 0,
              c.gross_tax || 0,
              c.status || 'draft'
            ]),
            ['#', 'Calculation ID', 'Date', 'Tax Type Name', 'Tax Type Code', 'Fiscal Year', 'Taxable Amount (NGN)', 'Net Tax Payable (NGN)', 'Gross Tax (NGN)', 'Status']
          );
          downloadText(csv, `TaxWise-Tax-Calculations-${today}.csv`);
        }
      }

      // --- DEDUCTIONS ---
      else if (exportType === 'deductions') {
        const source = passedData || deductions;
        const filtered = source.filter(d => {
          const dDate = d.created_at || d.createdAt;
          if (!dDate) return true;
          const dd = new Date(dDate);
          return dd >= startDate && dd <= endDate;
        });
        const getCategoryLabel = (cat) => {
          const labels = {
            business_expense: 'Business Expense', depreciation: 'Depreciation',
            pension: 'Pension', nhf: 'NHF', nhis: 'NHIS',
            life_insurance: 'Life Insurance', gratuity: 'Gratuity',
            donation: 'Charitable Donation', research: 'R&D', other: 'Other'
          };
          return labels[cat] || (cat ? cat.charAt(0).toUpperCase() + cat.slice(1) : '');
        };
        const csvMeta = [
          `"App","TaxWise Nigeria"`,
          `"Company","${orgData.name || 'N/A'}"`,
          `"TIN","${orgData.tin || 'N/A'}"`,
          `"Report","Deductions Report"`,
          `"Period","${dateRange.start} to ${dateRange.end}"`,
          `"Generated","${today}"`,
          `"Total Records","${filtered.length}"`,
          `"Total Amount","${filtered.reduce((s,d) => s + (parseFloat(d.amount)||0), 0).toLocaleString()}"`,
          ``
        ].join('\n');
        const csv = csvMeta + generateCSV(
          filtered.map((d, i) => [
            i + 1,
            d.description || d.name || '',
            getCategoryLabel(d.category),
            parseFloat(d.amount) || 0,
            d.tax_year || '',
            d.notes || d.documentation || '',
            d.created_at ? new Date(d.created_at).toLocaleDateString('en-NG') : ''
          ]),
          ['#', 'Description', 'Category', 'Amount (NGN)', 'Tax Year', 'Notes', 'Date Added']
        );
        downloadText(csv, `TaxWise-Deductions-${today}.csv`);
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

  // Deductions only support CSV for now
  const availableFormats = exportType === 'deductions'
    ? exportFormats.filter(f => f.id === 'csv')
    : exportFormats;

  if (!isOpen) return null;

  return (
    <div style={styles.overlay} onClick={closeModal}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={styles.headerIcon}>
              <Download size={18} color="#2563EB" />
            </div>
            <div>
              <h2 style={styles.title}>Export Data</h2>
              <p style={styles.headerSubtitle}>Download your records in your preferred format</p>
            </div>
          </div>
          <button style={styles.closeButton} onClick={closeModal} title="Close">
            <X size={18} />
          </button>
        </div>

        <div style={styles.content}>
          {/* Export Type Selection */}
          <div style={styles.section}>
            <label style={styles.sectionTitle}>What to export</label>
            <div style={styles.typeGrid}>
              {exportTypes.map((type) => (
                <button
                  key={type.id}
                  type="button"
                  style={{ ...styles.typeButton, ...(exportType === type.id ? styles.typeButtonActive : {}) }}
                  onClick={() => setExportType(type.id)}
                >
                  <span style={{ ...styles.typeCheck, ...(exportType === type.id ? styles.typeCheckActive : {}) }}>
                    {exportType === type.id ? '✓' : ''}
                  </span>
                  <div style={styles.typeContent}>
                    <span style={{ ...styles.typeName, color: exportType === type.id ? '#E6EDF3' : '#8B949E' }}>{type.name}</span>
                    <span style={styles.typeDesc}>{type.description}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Date Range */}
          <div style={styles.section}>
            <label style={styles.sectionTitle}>Date range</label>
            <div style={styles.dateRange}>
              <div style={styles.dateInput}>
                <Calendar size={14} style={styles.dateIcon} />
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                  style={styles.dateField}
                />
              </div>
              <span style={styles.dateSeparator}>→</span>
              <div style={styles.dateInput}>
                <Calendar size={14} style={styles.dateIcon} />
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
            <label style={styles.sectionTitle}>Format</label>
            {exportType === 'deductions' && (
              <p style={styles.formatNote}>Deductions export is available in CSV format.</p>
            )}
            <div style={styles.formatGrid}>
              {availableFormats.map((format) => {
                const Icon = format.icon;
                return (
                  <button
                    key={format.id}
                    style={{ ...styles.formatButton, ...(exportFormat === format.id ? styles.formatButtonActive : {}) }}
                    onClick={() => setExportFormat(format.id)}
                    type="button"
                  >
                    <Icon size={22} />
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
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
    zIndex: 9000, overflowY: 'auto', padding: '40px 20px'
  },
  modal: {
    width: '100%', maxWidth: '540px',
    backgroundColor: '#161B22', borderRadius: '16px',
    border: '1px solid #30363D', overflow: 'hidden', flexShrink: 0,
    boxShadow: '0 24px 60px rgba(0,0,0,0.5)'
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '20px 24px', borderBottom: '1px solid #21262D',
    backgroundColor: '#0D1117'
  },
  headerIcon: {
    width: '36px', height: '36px', borderRadius: '8px',
    backgroundColor: 'rgba(37,99,235,0.12)', border: '1px solid rgba(37,99,235,0.25)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
  },
  title: { fontSize: '16px', fontWeight: '600', color: '#E6EDF3', margin: 0 },
  headerSubtitle: { fontSize: '12px', color: '#6E7681', margin: '2px 0 0' },
  closeButton: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: '30px', height: '30px', backgroundColor: '#21262D',
    border: '1px solid #30363D', color: '#8B949E', cursor: 'pointer', borderRadius: '6px'
  },
  content: { padding: '20px 24px 24px' },
  section: { marginBottom: '20px' },
  sectionTitle: {
    display: 'block', fontSize: '11px', fontWeight: '600', color: '#6E7681',
    marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em'
  },
  // New type grid (2-column)
  typeGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' },
  typeButton: {
    display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px 14px',
    backgroundColor: '#0D1117',
    borderWidth: '1px', borderStyle: 'solid', borderColor: '#30363D',
    borderRadius: '8px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s ease'
  },
  typeButtonActive: { borderColor: '#2563EB', backgroundColor: 'rgba(37,99,235,0.08)' },
  typeCheck: {
    width: '18px', height: '18px', borderRadius: '50%', flexShrink: 0,
    border: '1.5px solid #30363D', display: 'flex', alignItems: 'center',
    justifyContent: 'center', fontSize: '11px', color: 'transparent', marginTop: '1px'
  },
  typeCheckActive: {
    backgroundColor: '#2563EB', borderColor: '#2563EB', color: 'white'
  },
  typeContent: { display: 'flex', flexDirection: 'column', gap: '2px' },
  typeName: { fontSize: '13px', fontWeight: '500' },
  typeDesc: { fontSize: '11px', color: '#6E7681' },
  formatNote: { fontSize: '12px', color: '#6E7681', margin: '0 0 10px 0', fontStyle: 'italic' },
  dateRange: { display: 'flex', alignItems: 'center', gap: '10px' },
  dateInput: { flex: 1, position: 'relative' },
  dateIcon: {
    position: 'absolute', right: '10px', top: '50%',
    transform: 'translateY(-50%)', color: '#6E7681', pointerEvents: 'none'
  },
  dateField: {
    width: '100%', padding: '10px 32px 10px 12px',
    backgroundColor: '#0D1117', border: '1px solid #30363D',
    borderRadius: '8px', color: '#E6EDF3', fontSize: '13px',
    outline: 'none', boxSizing: 'border-box'
  },
  dateSeparator: { color: '#6E7681', fontSize: '16px', fontWeight: '300', flexShrink: 0 },
  formatGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' },
  formatButton: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
    padding: '16px 10px', backgroundColor: '#0D1117',
    borderWidth: '1px', borderStyle: 'solid', borderColor: '#30363D',
    borderRadius: '8px', color: '#8B949E', cursor: 'pointer', transition: 'all 0.15s ease'
  },
  formatButtonActive: { borderColor: '#2563EB', backgroundColor: 'rgba(37,99,235,0.08)', color: '#2563EB' },
  formatName: { fontSize: '13px', fontWeight: '600', color: 'inherit' },
  formatDescription: { fontSize: '11px', color: '#6E7681', textAlign: 'center' },
  optionsGroup: { display: 'flex', flexDirection: 'column', gap: '10px' },
  checkboxLabel: { display: 'flex', alignItems: 'center', gap: '10px', color: '#C9D1D9', fontSize: '14px', cursor: 'pointer' },
  checkbox: { width: '16px', height: '16px', accentColor: '#2563EB', cursor: 'pointer' },
  emailInput: { position: 'relative' },
  emailIcon: { position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#6E7681' },
  emailField: {
    width: '100%', padding: '10px 14px 10px 38px',
    backgroundColor: '#0D1117', border: '1px solid #30363D',
    borderRadius: '8px', color: '#E6EDF3', fontSize: '13px',
    outline: 'none', boxSizing: 'border-box'
  },
  actions: {
    display: 'flex', gap: '10px', marginTop: '4px',
    paddingTop: '16px', borderTop: '1px solid #21262D'
  },
  cancelButton: {
    flex: 1, padding: '12px', backgroundColor: 'transparent',
    border: '1px solid #30363D', borderRadius: '8px',
    color: '#8B949E', fontSize: '14px', fontWeight: '500', cursor: 'pointer'
  },
  exportButton: {
    flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
    padding: '12px', backgroundColor: '#2563EB', border: 'none',
    borderRadius: '8px', color: 'white', fontSize: '14px', fontWeight: '600', cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(37,99,235,0.3)'
  }
};

export default ExportModal;
