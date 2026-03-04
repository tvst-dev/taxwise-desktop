import React, { useMemo, useState } from 'react';
import {
  Shield, AlertTriangle, CheckCircle, FileText,
  AlertCircle, TrendingUp, Calendar, Download,
  Clock, Eye, ChevronRight, ChevronDown
} from 'lucide-react';
import { 
  useEntriesStore, useTaxStore, useDeductionsStore,
  useRemindersStore, useUIStore 
} from '../../store';
import { useNavigate } from 'react-router-dom';

const Audit = () => {
  const navigate = useNavigate();
  const { entries } = useEntriesStore();
  const { calculations } = useTaxStore();
  const { deductions } = useDeductionsStore();
  const { getOverdueReminders } = useRemindersStore();
  const { openModal } = useUIStore();
  const [expandedIssues, setExpandedIssues] = useState({});

  const toggleIssue = (index) => {
    setExpandedIssues(prev => ({ ...prev, [index]: !prev[index] }));
  };

  const formatCurrency = (amount) => {
    const num = parseFloat(amount) || 0;
    return `₦${num.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  // Calculate audit readiness metrics
  const auditMetrics = useMemo(() => {
    const issues = [];
    let riskScore = 0;
    
    // Check for entries without proper documentation
    const undocumentedEntries = entries.filter(e => 
      (parseFloat(e.amount) || 0) > 100000 && !e.reference_number
    );
    if (undocumentedEntries.length > 0) {
      issues.push({
        type: 'warning',
        title: 'Entries Missing References',
        description: `${undocumentedEntries.length} high-value entries (>₦100,000) lack reference numbers`,
        action: 'Review Entries',
        entries: undocumentedEntries
      });
      riskScore += undocumentedEntries.length * 5;
    }

    // Check for large deductions without documentation
    const largeDeductions = deductions.filter(d => 
      (parseFloat(d.amount) || 0) > 500000 && !d.documentation
    );
    if (largeDeductions.length > 0) {
      issues.push({
        type: 'warning',
        title: 'Undocumented Deductions',
        description: `${largeDeductions.length} large deductions (>₦500,000) need supporting documents`,
        action: 'Add Documentation',
        entries: largeDeductions
      });
      riskScore += largeDeductions.length * 10;
    }

    // Check for overdue tax reminders
    const overdueItems = getOverdueReminders();
    if (overdueItems.length > 0) {
      issues.push({
        type: 'critical',
        title: 'Overdue Tax Obligations',
        description: `${overdueItems.length} tax-related items are past due`,
        action: 'View Reminders'
      });
      riskScore += overdueItems.length * 15;
    }

    // Check for pending calculations
    const pendingCalcs = calculations.filter(c => c.status === 'pending' || c.status === 'draft');
    if (pendingCalcs.length > 0) {
      issues.push({
        type: 'info',
        title: 'Incomplete Calculations',
        description: `${pendingCalcs.length} tax calculations pending completion`,
        action: 'Complete Calculations'
      });
      riskScore += pendingCalcs.length * 3;
    }

    // Check for expense/income ratio
    const totalIncome = entries
      .filter(e => e.entry_type === 'income')
      .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
    const totalExpenses = entries
      .filter(e => e.entry_type === 'expense')
      .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
    
    if (totalIncome > 0 && totalExpenses / totalIncome > 0.9) {
      issues.push({
        type: 'warning',
        title: 'High Expense Ratio',
        description: 'Expenses exceed 90% of income - may trigger audit review',
        action: 'Review Expenses'
      });
      riskScore += 20;
    }

    // Calculate risk level
    let riskLevel = 'Low';
    let riskColor = '#22C55E';
    if (riskScore >= 50) {
      riskLevel = 'High';
      riskColor = '#EF4444';
    } else if (riskScore >= 25) {
      riskLevel = 'Medium';
      riskColor = '#F59E0B';
    }

    // Calculate compliance score (inverse of risk)
    const complianceScore = Math.max(0, 100 - riskScore);

    return {
      riskScore,
      riskLevel,
      riskColor,
      complianceScore,
      issues,
      stats: {
        totalEntries: entries.length,
        totalCalculations: calculations.length,
        totalDeductions: deductions.length,
        overdueItems: overdueItems.length
      }
    };
  }, [entries, calculations, deductions, getOverdueReminders]);

  const handleExport = () => {
    openModal('export', { type: 'audit_report', data: auditMetrics });
  };

  const handleAction = (action) => {
    switch (action) {
      case 'Review Entries':
        navigate('/entries');
        break;
      case 'Add Documentation':
        navigate('/deductions');
        break;
      case 'View Reminders':
        navigate('/reminders');
        break;
      case 'Complete Calculations':
        navigate('/history');
        break;
      case 'Review Expenses':
        navigate('/entries');
        break;
      default:
        break;
    }
  };

  const getIssueIcon = (type) => {
    switch (type) {
      case 'critical':
        return <AlertCircle size={20} color="#EF4444" />;
      case 'warning':
        return <AlertTriangle size={20} color="#F59E0B" />;
      default:
        return <AlertCircle size={20} color="#2563EB" />;
    }
  };

  const getIssueStyle = (type) => {
    switch (type) {
      case 'critical':
        return { borderColor: 'rgba(239, 68, 68, 0.3)', backgroundColor: 'rgba(239, 68, 68, 0.05)' };
      case 'warning':
        return { borderColor: 'rgba(245, 158, 11, 0.3)', backgroundColor: 'rgba(245, 158, 11, 0.05)' };
      default:
        return { borderColor: 'rgba(37, 99, 235, 0.3)', backgroundColor: 'rgba(37, 99, 235, 0.05)' };
    }
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Audit Readiness</h1>
          <p style={styles.subtitle}>
            Review your compliance status and potential audit risks
          </p>
        </div>
        <button style={styles.exportBtn} onClick={handleExport}>
          <Download size={16} />
          Export Report
        </button>
      </div>

      {/* Risk Score Card */}
      <div style={styles.riskCard}>
        <div style={styles.riskMain}>
          <div style={styles.riskGauge}>
            <div style={{
              ...styles.riskCircle,
              borderColor: auditMetrics.riskColor,
              boxShadow: `0 0 20px ${auditMetrics.riskColor}30`
            }}>
              <span style={{ ...styles.riskScore, color: auditMetrics.riskColor }}>
                {auditMetrics.complianceScore}
              </span>
              <span style={styles.riskLabel}>Compliance Score</span>
            </div>
          </div>
          <div style={styles.riskInfo}>
            <div style={styles.riskLevel}>
              <Shield size={24} color={auditMetrics.riskColor} />
              <span style={{ color: auditMetrics.riskColor, fontWeight: '600' }}>
                {auditMetrics.riskLevel} Risk
              </span>
            </div>
            <p style={styles.riskDesc}>
              {auditMetrics.riskLevel === 'Low' && 'Your records appear well-maintained. Continue documenting all transactions.'}
              {auditMetrics.riskLevel === 'Medium' && 'Some areas need attention. Review the issues below to improve compliance.'}
              {auditMetrics.riskLevel === 'High' && 'Several compliance issues detected. Immediate attention recommended.'}
            </p>
          </div>
        </div>

        <div style={styles.statsRow}>
          <div style={styles.statItem}>
            <FileText size={18} color="#8B949E" />
            <div>
              <span style={styles.statValue}>{auditMetrics.stats.totalEntries}</span>
              <span style={styles.statLabel}>Entries</span>
            </div>
          </div>
          <div style={styles.statItem}>
            <TrendingUp size={18} color="#8B949E" />
            <div>
              <span style={styles.statValue}>{auditMetrics.stats.totalCalculations}</span>
              <span style={styles.statLabel}>Calculations</span>
            </div>
          </div>
          <div style={styles.statItem}>
            <Shield size={18} color="#8B949E" />
            <div>
              <span style={styles.statValue}>{auditMetrics.stats.totalDeductions}</span>
              <span style={styles.statLabel}>Deductions</span>
            </div>
          </div>
          <div style={styles.statItem}>
            <Clock size={18} color={auditMetrics.stats.overdueItems > 0 ? '#EF4444' : '#8B949E'} />
            <div>
              <span style={{
                ...styles.statValue,
                color: auditMetrics.stats.overdueItems > 0 ? '#EF4444' : '#E6EDF3'
              }}>
                {auditMetrics.stats.overdueItems}
              </span>
              <span style={styles.statLabel}>Overdue</span>
            </div>
          </div>
        </div>
      </div>

      {/* Issues Section */}
      <div style={styles.issuesSection}>
        <h2 style={styles.sectionTitle}>
          {auditMetrics.issues.length > 0 ? 'Issues to Address' : 'Compliance Status'}
        </h2>

        {auditMetrics.issues.length === 0 ? (
          <div style={styles.allClear}>
            <CheckCircle size={48} color="#22C55E" />
            <h3 style={styles.allClearTitle}>All Clear!</h3>
            <p style={styles.allClearText}>
              No compliance issues detected. Your records are audit-ready.
              Continue maintaining accurate documentation for all transactions.
            </p>
          </div>
        ) : (
          <div style={styles.issuesList}>
            {auditMetrics.issues.map((issue, index) => (
              <div key={index} style={{ ...styles.issueCard, ...getIssueStyle(issue.type) }}>
                <div style={styles.issueRow}>
                  <div style={styles.issueIcon}>
                    {getIssueIcon(issue.type)}
                  </div>
                  <div style={styles.issueContent}>
                    <h4 style={styles.issueTitle}>{issue.title}</h4>
                    <p style={styles.issueDesc}>{issue.description}</p>
                  </div>
                  <div style={styles.issueActions}>
                    {issue.entries?.length > 0 && (
                      <button
                        style={styles.expandButton}
                        onClick={() => toggleIssue(index)}
                        title={expandedIssues[index] ? 'Hide details' : 'Show details'}
                      >
                        {expandedIssues[index] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </button>
                    )}
                    <button
                      style={styles.issueAction}
                      onClick={() => handleAction(issue.action)}
                    >
                      {issue.action}
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
                {expandedIssues[index] && issue.entries?.length > 0 && (
                  <div style={styles.entryDetails}>
                    <div style={styles.entryDetailsHeader}>
                      <span>Date</span>
                      <span>Description</span>
                      <span style={{ textAlign: 'right' }}>Amount</span>
                    </div>
                    {issue.entries.slice(0, 10).map((e) => (
                      <div key={e.id} style={styles.entryRow}>
                        <span style={styles.entryDate}>{e.date || '—'}</span>
                        <span style={styles.entryDesc}>{e.description || e.category || 'No description'}</span>
                        <span style={styles.entryAmount}>{formatCurrency(e.amount)}</span>
                      </div>
                    ))}
                    {issue.entries.length > 10 && (
                      <p style={styles.entryMore}>
                        +{issue.entries.length - 10} more — click "{issue.action}" to see all
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recommendations */}
      <div style={styles.recommendSection}>
        <h2 style={styles.sectionTitle}>Best Practices</h2>
        <div style={styles.recommendGrid}>
          <div style={styles.recommendCard}>
            <FileText size={24} color="#2563EB" />
            <h4 style={styles.recommendTitle}>Document Everything</h4>
            <p style={styles.recommendText}>
              Keep receipts and invoices for all business transactions
            </p>
          </div>
          <div style={styles.recommendCard}>
            <Calendar size={24} color="#22C55E" />
            <h4 style={styles.recommendTitle}>File On Time</h4>
            <p style={styles.recommendText}>
              Submit all tax returns before their due dates
            </p>
          </div>
          <div style={styles.recommendCard}>
            <Shield size={24} color="#F59E0B" />
            <h4 style={styles.recommendTitle}>Justify Deductions</h4>
            <p style={styles.recommendText}>
              Ensure all claimed deductions have proper documentation
            </p>
          </div>
          <div style={styles.recommendCard}>
            <Eye size={24} color="#8B5CF6" />
            <h4 style={styles.recommendTitle}>Regular Reviews</h4>
            <p style={styles.recommendText}>
              Periodically review your records for accuracy
            </p>
          </div>
        </div>
      </div>
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
  exportBtn: {
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
  riskCard: {
    backgroundColor: '#161B22',
    border: '1px solid #30363D',
    borderRadius: '16px',
    padding: '32px',
    marginBottom: '24px'
  },
  riskMain: {
    display: 'flex',
    alignItems: 'center',
    gap: '40px',
    marginBottom: '32px'
  },
  riskGauge: {
    flexShrink: 0
  },
  riskCircle: {
    width: '140px',
    height: '140px',
    borderRadius: '50%',
    border: '4px solid',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0D1117'
  },
  riskScore: {
    fontSize: '42px',
    fontWeight: '700'
  },
  riskLabel: {
    fontSize: '12px',
    color: '#8B949E'
  },
  riskInfo: {
    flex: 1
  },
  riskLevel: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '20px',
    marginBottom: '12px'
  },
  riskDesc: {
    fontSize: '14px',
    color: '#8B949E',
    lineHeight: '1.6',
    margin: 0
  },
  statsRow: {
    display: 'flex',
    gap: '24px',
    paddingTop: '24px',
    borderTop: '1px solid #30363D'
  },
  statItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  statValue: {
    display: 'block',
    fontSize: '18px',
    fontWeight: '600',
    color: '#E6EDF3'
  },
  statLabel: {
    display: 'block',
    fontSize: '12px',
    color: '#8B949E'
  },
  issuesSection: {
    marginBottom: '24px'
  },
  sectionTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#E6EDF3',
    margin: '0 0 16px 0'
  },
  issuesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  issueCard: {
    padding: '20px',
    borderRadius: '12px',
    border: '1px solid'
  },
  issueRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px'
  },
  issueIcon: {
    flexShrink: 0
  },
  issueContent: {
    flex: 1
  },
  issueActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexShrink: 0
  },
  expandButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '32px',
    backgroundColor: '#21262D',
    border: '1px solid #30363D',
    borderRadius: '6px',
    color: '#8B949E',
    cursor: 'pointer'
  },
  entryDetails: {
    marginTop: '16px',
    paddingTop: '16px',
    borderTop: '1px solid rgba(48, 54, 61, 0.5)'
  },
  entryDetailsHeader: {
    display: 'grid',
    gridTemplateColumns: '120px 1fr 140px',
    gap: '12px',
    padding: '6px 12px',
    fontSize: '11px',
    fontWeight: '600',
    color: '#6E7681',
    textTransform: 'uppercase',
    letterSpacing: '0.05em'
  },
  entryRow: {
    display: 'grid',
    gridTemplateColumns: '120px 1fr 140px',
    gap: '12px',
    padding: '8px 12px',
    borderRadius: '6px',
    fontSize: '13px'
  },
  entryDate: {
    color: '#8B949E',
    whiteSpace: 'nowrap'
  },
  entryDesc: {
    color: '#E6EDF3',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  entryAmount: {
    color: '#E6EDF3',
    fontWeight: '600',
    textAlign: 'right'
  },
  entryMore: {
    margin: '8px 12px 0',
    fontSize: '12px',
    color: '#6E7681',
    fontStyle: 'italic'
  },
  issueTitle: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#E6EDF3',
    margin: '0 0 4px 0'
  },
  issueDesc: {
    fontSize: '13px',
    color: '#8B949E',
    margin: 0
  },
  issueAction: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '8px 16px',
    backgroundColor: '#21262D',
    border: '1px solid #30363D',
    borderRadius: '6px',
    color: '#E6EDF3',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
    whiteSpace: 'nowrap'
  },
  allClear: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px',
    backgroundColor: '#161B22',
    border: '1px solid #30363D',
    borderRadius: '12px',
    textAlign: 'center'
  },
  allClearTitle: {
    fontSize: '20px',
    fontWeight: '600',
    color: '#22C55E',
    margin: '16px 0 8px'
  },
  allClearText: {
    fontSize: '14px',
    color: '#8B949E',
    margin: 0,
    maxWidth: '400px'
  },
  recommendSection: {},
  recommendGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '16px'
  },
  recommendCard: {
    padding: '24px',
    backgroundColor: '#161B22',
    border: '1px solid #30363D',
    borderRadius: '12px',
    textAlign: 'center'
  },
  recommendTitle: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#E6EDF3',
    margin: '12px 0 8px'
  },
  recommendText: {
    fontSize: '13px',
    color: '#8B949E',
    margin: 0,
    lineHeight: '1.5'
  }
};

export default Audit;
