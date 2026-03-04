import React, { useState, useRef } from 'react';
import {
  Upload, FileText, Search, Trash2, Eye,
  MoreHorizontal, Check, AlertCircle, Clock, Sparkles,
  X, Plus, Loader
} from 'lucide-react';
import { useAuthStore, useFeaturesStore, useDocumentsStore, useEntriesStore, useDeductionsStore } from '../../store';
import { extractDocument, createDocument, updateDocument as dbUpdateDocument, deleteDocument as dbDeleteDocument, createEntry, createDeduction as dbCreateDeduction } from '../../services/supabase';
import toast from 'react-hot-toast';

const Documents = () => {
  const { organization } = useAuthStore();
  const { documentAIEnabled } = useFeaturesStore();
  const { documents, addDocument, updateDocument, removeDocument } = useDocumentsStore();
  const { addEntry } = useEntriesStore();
  const { addDeduction } = useDeductionsStore();

  const fileInputRef = useRef(null);
  // Map of doc.id -> blob object URL, so user can view original file in-session
  const fileUrlsRef = useRef({});
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [processingDocs, setProcessingDocs] = useState(new Set());
  const [showExtractedModal, setShowExtractedModal] = useState(null);

  const documentTypes = [
    { value: 'all', label: 'All Types' },
    { value: 'invoice', label: 'Invoices' },
    { value: 'receipt', label: 'Receipts' },
    { value: 'payslip', label: 'Payslips' },
    { value: 'other', label: 'Other' }
  ];

  const getStatusStyle = (status) => ({
    processed: { backgroundColor: 'rgba(34, 197, 94, 0.1)', color: '#22C55E' },
    processing: { backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3B82F6' },
    pending: { backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#F59E0B' },
    uploaded: { backgroundColor: 'rgba(139, 148, 158, 0.1)', color: '#8B949E' },
    failed: { backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#EF4444' }
  }[status] || { backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#F59E0B' });

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const files = [...e.dataTransfer.files];
    if (files.length > 0) await handleFiles(files);
  };

  const handleFileSelect = async (e) => {
    const files = [...e.target.files];
    if (files.length > 0) await handleFiles(files);
    e.target.value = '';
  };

  const EXTRACTABLE_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
  const ALLOWED_TYPES = [
    ...EXTRACTABLE_TYPES,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel', // .xls
    'text/csv',
    'application/csv'
  ];

  const handleFiles = async (files) => {
    if (!organization?.id) {
      toast.error('Please sign in to upload documents');
      return;
    }

    setIsUploading(true);

    for (const file of files) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        toast.error(`${file.name}: Unsupported file type`);
        continue;
      }
      if (file.size > 50 * 1024 * 1024) {
        toast.error(`${file.name}: Max 50MB`);
        continue;
      }

      const docType = detectDocumentType(file.name);
      const canExtract = EXTRACTABLE_TYPES.includes(file.type);

      try {
        const doc = await createDocument({
          organization_id: organization.id,
          name: file.name,
          document_type: docType,
          file_size: file.size,
          mime_type: file.type,
          status: canExtract ? 'pending' : 'uploaded',
          extracted_data: null
        });

        // Store a blob URL so the user can view the file later in this session
        fileUrlsRef.current[doc.id] = URL.createObjectURL(file);

        addDocument(doc);
        toast.success(`${file.name} uploaded`);

        if (documentAIEnabled && canExtract) {
          processDocument(doc.id, file, docType);
        }
      } catch (error) {
        console.error('Upload error:', error);
        toast.error(`Failed to upload ${file.name}`);
      }
    }

    setIsUploading(false);
  };

  const processDocument = async (docId, file, docType) => {
    setProcessingDocs(prev => new Set([...prev, docId]));
    updateDocument(docId, { status: 'processing' });

    const toastId = toast.loading(`Extracting data from ${file.name}...`);

    try {
      const base64 = await fileToBase64(file);
      const result = await extractDocument(base64, file.type, docType);

      if (result.success && result.data) {
        await dbUpdateDocument(docId, {
          status: 'processed',
          extracted_data: result.data
        });

        updateDocument(docId, {
          status: 'processed',
          extracted_data: result.data
        });
        
        // Format success message
        const amount = result.data.total_amount || result.data.total || result.data.net_pay || 0;
        const originalCurrency = result.data.original_currency || 'NGN';
        const originalAmount = result.data.original_total_amount || result.data.original_total || amount;
        
        if (result.data.converted_from_foreign) {
          toast.success(`Extracted: ${originalCurrency} ${Number(originalAmount).toLocaleString()} → ₦${Number(amount).toLocaleString()}`, { id: toastId });
        } else {
          toast.success(`Extracted: ₦${Number(amount).toLocaleString()}`, { id: toastId });
        }
      } else {
        throw new Error(result.error || 'Extraction failed');
      }
    } catch (error) {
      console.error('Extraction error:', error);
      await dbUpdateDocument(docId, { status: 'failed' });
      updateDocument(docId, { status: 'failed' });
      toast.error(`${file.name}: ${error.message || 'Extraction failed'}`, { id: toastId });
    } finally {
      setProcessingDocs(prev => {
        const newSet = new Set(prev);
        newSet.delete(docId);
        return newSet;
      });
    }
  };

  const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
  });

  const detectDocumentType = (filename) => {
    const lower = filename.toLowerCase();
    if (lower.includes('invoice') || lower.includes('bill')) return 'invoice';
    if (lower.includes('receipt')) return 'receipt';
    if (lower.includes('payslip') || lower.includes('salary') || lower.includes('pay slip')) return 'payslip';
    if (lower.includes('statement')) return 'bank_statement';
    return 'other';
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatCurrency = (amount) => {
    if (amount == null || isNaN(amount)) return '₦0';
    return `₦${Number(amount).toLocaleString()}`;
  };

  const filteredDocuments = (documents || []).filter(doc => {
    const matchesSearch = doc.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || doc.document_type === filterType;
    return matchesSearch && matchesType;
  });

  // Truncate helper for database field limits
  const truncate = (str, max) => {
    if (!str) return '';
    const s = String(str);
    return s.length > max ? s.substring(0, max) : s;
  };

  // Build a rich, human-readable description from extracted data
  const buildDescription = (data, docName) => {
    if (data.description) return data.description;

    const parts = [];
    const party = data.vendor_name || data.employer_name || data.bill_to;
    if (party) parts.push(party);

    if (data.invoice_number) parts.push(`Invoice #${data.invoice_number}`);
    else if (data.receipt_number) parts.push(`Receipt #${data.receipt_number}`);
    else if (data.reference_number) parts.push(`Ref #${data.reference_number}`);

    if (data.category) parts.push(data.category);

    const docLabel = data.document_type
      ? data.document_type.charAt(0).toUpperCase() + data.document_type.slice(1)
      : 'Document';

    return parts.length > 0
      ? `${docLabel}: ${parts.join(' · ')}`
      : `${docLabel} from ${docName}`;
  };

  // Normalize extracted category to a valid Deductions category value
  const normalizeDeductionCategory = (extractedCategory) => {
    if (!extractedCategory) return 'business_expense';
    const cat = String(extractedCategory).toLowerCase();
    if (cat.includes('pension')) return 'pension';
    if (cat.includes('nhf') || cat.includes('national housing')) return 'nhf';
    if (cat.includes('nhis') || cat.includes('health insurance')) return 'nhis';
    if (cat.includes('life insurance') || cat.includes('assurance')) return 'life_insurance';
    if (cat.includes('depreciation') || cat.includes('capital allowance')) return 'depreciation';
    if (cat.includes('donation') || cat.includes('charity') || cat.includes('charitable')) return 'donation';
    if (cat.includes('research') || cat.includes('r&d') || cat.includes('development')) return 'research';
    if (cat.includes('gratuity')) return 'gratuity';
    return 'business_expense';
  };

  const handleCreateEntry = async (doc) => {
    if (!doc.extracted_data || !organization?.id) {
      toast.error('No extracted data available');
      return;
    }

    const data = doc.extracted_data;
    const entryType = data.entry_type || (data.document_type === 'payslip' ? 'income' : 'expense');
    const amount = data.total_amount || data.total || data.net_pay || data.amount || 0;

    if (!amount || amount <= 0) {
      toast.error('No valid amount found in extracted data');
      return;
    }

    const entryDate = data.date || data.invoice_date || data.payment_date || new Date().toISOString().split('T')[0];
    const description = buildDescription(data, doc.name);

    try {
      const entryData = {
        organization_id: organization.id,
        entry_type: entryType,
        category: truncate(
          entryType === 'income'
            ? (data.category || 'Salary')
            : (data.category || 'Business Expense'),
          50
        ),
        amount: Number(amount),
        date: entryDate,
        description: truncate(description, 100),
        vendor_customer: truncate(
          data.vendor_name || data.employer_name || data.bill_to || 'Unknown',
          100
        ),
        reference_number: truncate(
          data.invoice_number || data.receipt_number || data.reference_number || '',
          50
        ),
        vat_amount: Number(data.tax || data.vat_amount || 0),
        status: 'posted',
        metadata: { source: 'document_extraction' }
      };

      const entry = await createEntry(entryData);
      addEntry(entry);

      // Auto-create a deduction for expense entries (business expenses are deductible)
      if (entryType === 'expense') {
        try {
          const deductionPayload = {
            organization_id: organization.id,
            description: truncate(description, 100),
            amount: Number(amount),
            category: normalizeDeductionCategory(data.category),
            tax_year: new Date(entryDate).getFullYear().toString(),
            notes: `Auto-created from document: ${doc.name}`
          };
          const savedDeduction = await dbCreateDeduction(deductionPayload);
          addDeduction(savedDeduction);
        } catch (dedErr) {
          console.warn('Could not save deduction to DB:', dedErr.message);
        }
        toast.success(`Expense entry + deduction created: ${formatCurrency(amount)}`);
      } else {
        toast.success(`${entryType === 'income' ? 'Income' : 'Expense'} entry created: ${formatCurrency(amount)}`);
      }

      setShowExtractedModal(null);
    } catch (error) {
      console.error('Create entry error:', error);
      toast.error(`Failed to create entry: ${error.message || 'Unknown error'}`);
    }
  };

  const handleViewDocument = (id) => {
    const url = fileUrlsRef.current[id];
    if (url) {
      window.open(url, '_blank');
    } else {
      toast.error('File not available — it was uploaded in a previous session');
    }
    setSelectedDoc(null);
  };

  const handleDeleteDocument = async (id) => {
    try {
      // Revoke blob URL to free memory
      if (fileUrlsRef.current[id]) {
        URL.revokeObjectURL(fileUrlsRef.current[id]);
        delete fileUrlsRef.current[id];
      }
      await dbDeleteDocument(id);
      removeDocument(id);
      setSelectedDoc(null);
      toast.success('Document deleted');
    } catch (error) {
      console.error('Delete error:', error);
      toast.error(`Failed to delete: ${error.message || 'Unknown error'}`);
    }
  };

  const renderExtractedData = (data) => {
    if (!data) return null;
    const items = [];

    // Show generated description first
    const desc = buildDescription(data, '');
    if (desc) items.push({ label: 'Description', value: desc, highlight: false });

    // Show conversion info
    if (data.converted_from_foreign && data.original_currency !== 'NGN') {
      const origAmount = data.original_total_amount || data.original_total || data.original_net_pay || 0;
      items.push({ 
        label: 'Original', 
        value: `${data.original_currency} ${Number(origAmount).toLocaleString()} @ ₦${data.exchange_rate}`,
        highlight: false 
      });
    }

    // Basic info
    if (data.vendor_name) items.push({ label: 'Vendor', value: data.vendor_name });
    if (data.employer_name) items.push({ label: 'Employer', value: data.employer_name });
    if (data.bill_to) items.push({ label: 'Bill To', value: data.bill_to });
    if (data.invoice_number) items.push({ label: 'Invoice #', value: data.invoice_number });
    if (data.receipt_number) items.push({ label: 'Receipt #', value: data.receipt_number });
    if (data.date || data.invoice_date || data.payment_date) {
      items.push({ label: 'Date', value: data.date || data.invoice_date || data.payment_date });
    }
    if (data.category) items.push({ label: 'Category', value: data.category });
    if (data.entry_type) items.push({ label: 'Type', value: data.entry_type === 'income' ? 'Income' : 'Expense' });
    
    // Tax
    if (data.tax || data.vat_amount) {
      items.push({ label: 'Tax/VAT', value: formatCurrency(data.tax || data.vat_amount) });
    }
    
    // Total
    const totalAmount = data.total_amount || data.total || data.net_pay;
    if (totalAmount) {
      items.push({ 
        label: 'Total (NGN)', 
        value: formatCurrency(totalAmount), 
        highlight: true 
      });
    }

    return items.map((item, i) => (
      <div key={i} style={styles.extractedItem}>
        <span style={styles.extractedLabel}>{item.label}:</span>
        <span style={{ 
          ...styles.extractedValue, 
          ...(item.highlight ? { color: '#22C55E', fontWeight: 600 } : {}) 
        }}>
          {item.value}
        </span>
      </div>
    ));
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Documents</h1>
          <p style={styles.subtitle}>Upload invoices, receipts, and payslips for AI extraction</p>
        </div>
        <button style={styles.uploadButton} onClick={() => fileInputRef.current?.click()}>
          <Upload size={16} />
          <span>Upload</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,.webp,.xlsx,.xls,.csv"
          style={{ display: 'none' }}
          onChange={handleFileSelect}
        />
      </div>

      {documentAIEnabled && (
        <div style={styles.aiBanner}>
          <Sparkles size={18} color="#F59E0B" />
          <span><strong>AI Extraction Active</strong> — Documents auto-extracted & converted to NGN</span>
        </div>
      )}

      <div
        style={{ ...styles.uploadZone, ...(dragActive ? styles.uploadZoneActive : {}) }}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <div style={styles.uploadContent}>
          <div style={styles.uploadIcon}><Upload size={32} /></div>
          <p style={styles.uploadText}>
            <span style={styles.uploadTextBold}>Click to upload</span> or drag and drop
          </p>
          <p style={styles.uploadHint}>PDF, JPG, PNG, WebP, XLSX, CSV (max 50MB)</p>
        </div>
        {isUploading && (
          <div style={styles.uploadingOverlay}>
            <Loader size={24} style={{ animation: 'spin 1s linear infinite' }} />
            <span>Uploading...</span>
          </div>
        )}
      </div>

      <div style={styles.filtersRow}>
        <div style={styles.searchBox}>
          <Search size={16} style={styles.searchIcon} />
          <input 
            type="text" 
            placeholder="Search documents..." 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
            style={styles.searchInput} 
          />
        </div>
        <select 
          value={filterType} 
          onChange={(e) => setFilterType(e.target.value)} 
          style={styles.filterSelect}
        >
          {documentTypes.map(type => (
            <option key={type.value} value={type.value}>{type.label}</option>
          ))}
        </select>
      </div>

      {filteredDocuments.length === 0 ? (
        <div style={styles.emptyState}>
          <FileText size={48} style={{ color: '#30363D' }} />
          <p style={{ margin: '12px 0 4px', color: '#E6EDF3' }}>No documents yet</p>
          <p style={{ fontSize: 13, color: '#6E7681' }}>Upload invoices, receipts, or payslips</p>
        </div>
      ) : (
        <div style={styles.documentsGrid}>
          {filteredDocuments.map(doc => {
            const statusStyle = getStatusStyle(doc.status);
            const isProcessing = processingDocs.has(doc.id);

            return (
              <div key={doc.id} style={styles.documentCard}>
                <div style={styles.docHeader}>
                  <div style={styles.docIcon}><FileText size={24} /></div>
                  <button 
                    style={styles.docMenuButton} 
                    onClick={() => setSelectedDoc(selectedDoc === doc.id ? null : doc.id)}
                  >
                    <MoreHorizontal size={18} />
                  </button>
                  {selectedDoc === doc.id && (
                    <div style={styles.docMenu}>
                      {fileUrlsRef.current[doc.id] && (
                        <button
                          style={styles.docMenuItem}
                          onClick={() => handleViewDocument(doc.id)}
                        >
                          <Eye size={14} /> View File
                        </button>
                      )}
                      {doc.status === 'processed' && (
                        <button
                          style={styles.docMenuItem}
                          onClick={() => setShowExtractedModal(doc)}
                        >
                          <Eye size={14} /> View Data
                        </button>
                      )}
                      <button
                        style={{ ...styles.docMenuItem, color: '#EF4444' }}
                        onClick={() => handleDeleteDocument(doc.id)}
                      >
                        <Trash2 size={14} /> Delete
                      </button>
                    </div>
                  )}
                </div>

                <div style={styles.docInfo}>
                  <h3 style={styles.docName}>{doc.name}</h3>
                  <div style={styles.docMeta}>
                    <span>{formatFileSize(doc.file_size)}</span>
                    <span>•</span>
                    <span>{doc.document_type || 'other'}</span>
                  </div>
                </div>

                <div style={styles.docStatus}>
                  <span style={{ ...styles.statusBadge, ...statusStyle }}>
                    {isProcessing ? (
                      <><Loader size={12} style={{ animation: 'spin 1s linear infinite' }} /> Extracting...</>
                    ) : doc.status === 'processed' ? (
                      <><Check size={12} /> Processed</>
                    ) : doc.status === 'failed' ? (
                      <><AlertCircle size={12} /> Failed</>
                    ) : doc.status === 'uploaded' ? (
                      <><Check size={12} /> Uploaded</>
                    ) : (
                      <><Clock size={12} /> Pending</>
                    )}
                  </span>
                </div>

                {doc.status === 'processed' && doc.extracted_data && (
                  <div style={styles.extractedData}>
                    <div style={styles.extractedHeader}>
                      <Sparkles size={14} color="#F59E0B" />
                      <span>Extracted</span>
                      {doc.extracted_data.converted_from_foreign && (
                        <span style={styles.convertedBadge}>
                          {doc.extracted_data.original_currency} → NGN
                        </span>
                      )}
                    </div>
                    <div style={styles.extractedContent}>
                      {renderExtractedData(doc.extracted_data)}
                    </div>
                    <button 
                      style={styles.createEntryButton} 
                      onClick={() => handleCreateEntry(doc)}
                    >
                      <Plus size={14} /> Create Entry
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Extracted Data Modal */}
      {showExtractedModal && (
        <div style={styles.modalOverlay} onClick={() => setShowExtractedModal(null)}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Extracted Data</h3>
              <button style={styles.modalClose} onClick={() => setShowExtractedModal(null)}>
                <X size={20} />
              </button>
            </div>
            <div style={styles.modalContent}>
              {showExtractedModal.extracted_data?.converted_from_foreign && (
                <div style={styles.conversionInfo}>
                  <strong>Currency Converted:</strong>{' '}
                  {showExtractedModal.extracted_data.original_currency} → NGN 
                  (Rate: ₦{showExtractedModal.extracted_data.exchange_rate})
                </div>
              )}
              <pre style={styles.jsonPreview}>
                {JSON.stringify(showExtractedModal.extracted_data, null, 2)}
              </pre>
              <button 
                style={styles.createEntryButtonLarge} 
                onClick={() => handleCreateEntry(showExtractedModal)}
              >
                <Plus size={16} /> Create Entry
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

const styles = {
  container: { padding: 24, minHeight: '100%', backgroundColor: '#0D1117' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  title: { fontSize: 28, fontWeight: 600, color: '#E6EDF3', margin: '0 0 8px' },
  subtitle: { fontSize: 14, color: '#8B949E', margin: 0 },
  uploadButton: { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', backgroundColor: '#2563EB', border: 'none', borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer' },
  aiBanner: { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', backgroundColor: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10, marginBottom: 20, fontSize: 14, color: '#E6EDF3' },
  uploadZone: { position: 'relative', padding: '48px 24px', backgroundColor: '#161B22', border: '2px dashed #30363D', borderRadius: 12, marginBottom: 24, cursor: 'pointer', transition: 'all 0.2s' },
  uploadZoneActive: { borderColor: '#2563EB', backgroundColor: 'rgba(37,99,235,0.05)' },
  uploadContent: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 },
  uploadIcon: { width: 64, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#21262D', borderRadius: 16, color: '#8B949E' },
  uploadText: { fontSize: 14, color: '#8B949E', margin: 0 },
  uploadTextBold: { color: '#2563EB', fontWeight: 500 },
  uploadHint: { fontSize: 12, color: '#6E7681', margin: 0 },
  uploadingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: 'rgba(13,17,23,0.9)', borderRadius: 10, color: '#2563EB' },
  filtersRow: { display: 'flex', gap: 12, marginBottom: 20 },
  searchBox: { position: 'relative', flex: 1, maxWidth: 400 },
  searchIcon: { position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#8B949E' },
  searchInput: { width: '100%', padding: '10px 12px 10px 36px', backgroundColor: '#161B22', border: '1px solid #30363D', borderRadius: 8, color: '#E6EDF3', fontSize: 14, outline: 'none', boxSizing: 'border-box' },
  filterSelect: { padding: '10px 16px', backgroundColor: '#161B22', border: '1px solid #30363D', borderRadius: 8, color: '#E6EDF3', fontSize: 14, cursor: 'pointer', outline: 'none' },
  emptyState: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 80, textAlign: 'center' },
  documentsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 },
  documentCard: { padding: 20, backgroundColor: '#161B22', border: '1px solid #30363D', borderRadius: 12 },
  docHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, position: 'relative' },
  docIcon: { width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#21262D', borderRadius: 10, color: '#8B949E' },
  docMenuButton: { width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent', border: 'none', borderRadius: 6, color: '#8B949E', cursor: 'pointer' },
  docMenu: { position: 'absolute', top: 36, right: 0, backgroundColor: '#21262D', border: '1px solid #30363D', borderRadius: 8, padding: 4, minWidth: 140, zIndex: 10 },
  docMenuItem: { display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px', backgroundColor: 'transparent', border: 'none', borderRadius: 4, color: '#E6EDF3', fontSize: 13, cursor: 'pointer', textAlign: 'left' },
  docInfo: { marginBottom: 12 },
  docName: { fontSize: 14, fontWeight: 600, color: '#E6EDF3', margin: '0 0 6px', wordBreak: 'break-word' },
  docMeta: { display: 'flex', gap: 8, fontSize: 12, color: '#8B949E' },
  docStatus: { marginBottom: 16 },
  statusBadge: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 9999, fontSize: 12, fontWeight: 500 },
  extractedData: { padding: 16, backgroundColor: '#0D1117', borderRadius: 8 },
  extractedHeader: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontSize: 12, fontWeight: 600, color: '#8B949E', textTransform: 'uppercase' },
  extractedContent: { display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 },
  extractedItem: { display: 'flex', justifyContent: 'space-between', fontSize: 13 },
  extractedLabel: { color: '#8B949E' },
  extractedValue: { color: '#E6EDF3', fontWeight: 500 },
  createEntryButton: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: 10, backgroundColor: 'rgba(34,197,94,0.1)', border: '1px solid #22C55E', borderRadius: 6, color: '#22C55E', fontSize: 13, fontWeight: 500, cursor: 'pointer' },
  convertedBadge: { marginLeft: 'auto', padding: '2px 8px', backgroundColor: 'rgba(37, 99, 235, 0.2)', borderRadius: 4, fontSize: 10, color: '#60A5FA' },
  conversionInfo: { padding: 12, backgroundColor: 'rgba(37, 99, 235, 0.1)', borderRadius: 8, marginBottom: 16, fontSize: 13, color: '#60A5FA' },
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { backgroundColor: '#161B22', border: '1px solid #30363D', borderRadius: 16, width: '90%', maxWidth: 600, maxHeight: '80vh', overflow: 'hidden' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottom: '1px solid #30363D' },
  modalTitle: { fontSize: 18, fontWeight: 600, color: '#E6EDF3', margin: 0 },
  modalClose: { backgroundColor: 'transparent', border: 'none', color: '#8B949E', cursor: 'pointer', display: 'flex' },
  modalContent: { padding: 20, maxHeight: 'calc(80vh - 80px)', overflow: 'auto' },
  jsonPreview: { backgroundColor: '#0D1117', padding: 16, borderRadius: 8, fontSize: 12, color: '#E6EDF3', overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 },
  createEntryButtonLarge: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: 14, backgroundColor: '#22C55E', border: 'none', borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginTop: 16 }
};

export default Documents;