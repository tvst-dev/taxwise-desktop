import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Bell, Download, Plus, TrendingUp, TrendingDown,
  Wallet, Receipt, FileText, Calendar, ChevronRight,
  AlertCircle, Calculator, BarChart3, Clock, ArrowUpRight,
  ArrowDownRight, Banknote
} from 'lucide-react';
import { 
  useAuthStore, useUIStore, useEntriesStore, 
  useTaxStore, useRemindersStore, useDeductionsStore 
} from '../../store';

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, organization } = useAuthStore();
  const { openModal } = useUIStore();
  const { entries } = useEntriesStore();
  const { calculations } = useTaxStore();
  const { reminders, getUpcomingReminders, getOverdueReminders } = useRemindersStore();
  const { deductions } = useDeductionsStore();

  // Calculate stats from real data
  const stats = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const monthlyEntries = entries.filter(e => new Date(e.date || e.createdAt) >= startOfMonth);

    const totalIncome = monthlyEntries
      .filter(e => e.entry_type === 'income')
      .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

    const totalExpenses = monthlyEntries
      .filter(e => e.entry_type === 'expense')
      .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

    // All-time totals (includes entries with historical dates from document extraction)
    const allTimeIncome = entries
      .filter(e => e.entry_type === 'income')
      .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

    const allTimeExpenses = entries
      .filter(e => e.entry_type === 'expense')
      .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

    const totalDeductions = deductions.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);

    const totalTaxLiability = calculations.reduce((sum, c) => sum + (parseFloat(c.net_tax_payable) || 0), 0);

    const netCashFlow = allTimeIncome - allTimeExpenses;
    const netTaxable = allTimeIncome - totalDeductions;

    return {
      totalIncome,
      totalExpenses,
      allTimeIncome,
      allTimeExpenses,
      totalDeductions,
      totalTaxLiability,
      netCashFlow,
      netTaxable,
      entryCount: entries.length,
      calculationCount: calculations.length
    };
  }, [entries, calculations, deductions]);

  // Get recent entries (last 5)
  const recentEntries = useMemo(() => {
    return [...entries]
      .sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date))
      .slice(0, 5);
  }, [entries]);

  // Get upcoming reminders
  const upcomingReminders = getUpcomingReminders(14);
  const overdueReminders = getOverdueReminders();

  const formatCurrency = (amount) => {
    if (amount >= 1000000) {
      return `₦${(amount / 1000000).toFixed(1)}M`;
    } else if (amount >= 1000) {
      return `₦${(amount / 1000).toFixed(0)}K`;
    }
    return `₦${amount.toLocaleString()}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-NG', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const getCurrentMonth = () => {
    return new Date().toLocaleDateString('en-NG', { month: 'long', year: 'numeric' });
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.greeting}>
          <h1 style={styles.greetingText}>
            {getGreeting()}, {user?.name?.split(' ')[0] || 'there'}
          </h1>
          <p style={styles.greetingSubtext}>
            {organization?.name || 'Your Business'} • {getCurrentMonth()}
          </p>
        </div>
        <div style={styles.headerActions}>
          <button style={styles.iconBtn} title="Notifications">
            <Bell size={20} />
            {(upcomingReminders.length + overdueReminders.length) > 0 && (
              <span style={styles.notificationBadge}>
                {upcomingReminders.length + overdueReminders.length}
              </span>
            )}
          </button>
          <button style={styles.exportBtn} onClick={() => openModal('export')}>
            <Download size={16} />
            Export
          </button>
          <button style={styles.primaryBtn} onClick={() => openModal('newEntry')}>
            <Plus size={16} />
            New Entry
          </button>
        </div>
      </header>

      {/* Stats Grid */}
      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <div style={styles.statHeader}>
            <span style={styles.statLabel}>Total Income</span>
            <div style={{ ...styles.statIconBox, backgroundColor: 'rgba(34, 197, 94, 0.1)' }}>
              <TrendingUp size={18} color="#22C55E" />
            </div>
          </div>
          <div style={styles.statValue}>{formatCurrency(stats.totalIncome)}</div>
          <div style={styles.statFooter}>
            <span style={styles.statPeriod}>This month</span>
          </div>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statHeader}>
            <span style={styles.statLabel}>Total Expenses</span>
            <div style={{ ...styles.statIconBox, backgroundColor: 'rgba(239, 68, 68, 0.1)' }}>
              <TrendingDown size={18} color="#EF4444" />
            </div>
          </div>
          <div style={styles.statValue}>{formatCurrency(stats.totalExpenses)}</div>
          <div style={styles.statFooter}>
            <span style={styles.statPeriod}>This month</span>
          </div>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statHeader}>
            <span style={styles.statLabel}>Net Cash Flow</span>
            <div style={{ ...styles.statIconBox, backgroundColor: 'rgba(37, 99, 235, 0.1)' }}>
              <Banknote size={18} color="#2563EB" />
            </div>
          </div>
          <div style={{
            ...styles.statValue,
            color: stats.netCashFlow >= 0 ? '#22C55E' : '#EF4444'
          }}>
            {stats.netCashFlow >= 0 ? '+' : ''}{formatCurrency(stats.netCashFlow)}
          </div>
          <div style={styles.statFooter}>
            <span style={styles.statPeriod}>All time</span>
          </div>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statHeader}>
            <span style={styles.statLabel}>Tax Liability</span>
            <div style={{ ...styles.statIconBox, backgroundColor: 'rgba(139, 92, 246, 0.1)' }}>
              <Calculator size={18} color="#8B5CF6" />
            </div>
          </div>
          <div style={styles.statValue}>{formatCurrency(stats.totalTaxLiability)}</div>
          <div style={styles.statFooter}>
            <span style={styles.statPeriod}>All calculations</span>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div style={styles.mainGrid}>
        {/* Recent Entries */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <h3 style={styles.cardTitle}>Recent Entries</h3>
            <button style={styles.viewAllBtn} onClick={() => navigate('/entries')}>
              View All <ChevronRight size={16} />
            </button>
          </div>
          <div style={styles.cardBody}>
            {recentEntries.length === 0 ? (
              <div style={styles.emptyState}>
                <FileText size={40} color="#30363D" />
                <p style={styles.emptyText}>No entries yet</p>
                <span style={styles.emptyHint}>Create your first entry to get started</span>
                <button style={styles.emptyBtn} onClick={() => openModal('newEntry')}>
                  <Plus size={16} />
                  Add Entry
                </button>
              </div>
            ) : (
              <div style={styles.entriesList}>
                {recentEntries.map((entry) => (
                  <div key={entry.id} style={styles.entryItem}>
                    <div style={{
                      ...styles.entryIcon,
                      backgroundColor: entry.entry_type === 'income' 
                        ? 'rgba(34, 197, 94, 0.1)' 
                        : 'rgba(239, 68, 68, 0.1)'
                    }}>
                      {entry.entry_type === 'income' ? (
                        <ArrowUpRight size={16} color="#22C55E" />
                      ) : (
                        <ArrowDownRight size={16} color="#EF4444" />
                      )}
                    </div>
                    <div style={styles.entryInfo}>
                      <span style={styles.entryDesc}>
                        {entry.description || entry.vendor_customer || 'Untitled Entry'}
                      </span>
                      <span style={styles.entryDate}>
                        {formatDate(entry.date || entry.createdAt)}
                      </span>
                    </div>
                    <div style={{
                      ...styles.entryAmount,
                      color: entry.entry_type === 'income' ? '#22C55E' : '#E6EDF3'
                    }}>
                      {entry.entry_type === 'income' ? '+' : '-'}
                      {formatCurrency(parseFloat(entry.amount) || 0)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions & Reminders */}
        <div style={styles.sideColumn}>
          {/* Quick Actions */}
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Quick Actions</h3>
            <div style={styles.quickActions}>
              <button style={styles.quickAction} onClick={() => openModal('taxCalculator')}>
                <Calculator size={20} color="#2563EB" />
                <span>Calculate Tax</span>
              </button>
              <button style={styles.quickAction} onClick={() => navigate('/entries')}>
                <FileText size={20} color="#22C55E" />
                <span>View Entries</span>
              </button>
              <button style={styles.quickAction} onClick={() => navigate('/analytics')}>
                <BarChart3 size={20} color="#F59E0B" />
                <span>Analytics</span>
              </button>
              <button style={styles.quickAction} onClick={() => navigate('/reminders')}>
                <Clock size={20} color="#8B5CF6" />
                <span>Reminders</span>
              </button>
            </div>
          </div>

          {/* Upcoming Reminders */}
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <h3 style={styles.cardTitle}>Upcoming Deadlines</h3>
              {(upcomingReminders.length + overdueReminders.length) > 0 && (
                <span style={styles.reminderCount}>
                  {upcomingReminders.length + overdueReminders.length}
                </span>
              )}
            </div>
            <div style={styles.cardBody}>
              {overdueReminders.length === 0 && upcomingReminders.length === 0 ? (
                <div style={styles.emptyStateSmall}>
                  <Clock size={32} color="#30363D" />
                  <p style={styles.emptyText}>No upcoming deadlines</p>
                  <button 
                    style={styles.linkBtn}
                    onClick={() => navigate('/reminders')}
                  >
                    Set a reminder
                  </button>
                </div>
              ) : (
                <div style={styles.remindersList}>
                  {overdueReminders.slice(0, 3).map((reminder) => (
                    <div key={reminder.id} style={styles.reminderItem}>
                      <div style={{ ...styles.reminderDot, backgroundColor: '#EF4444' }} />
                      <div style={styles.reminderInfo}>
                        <span style={styles.reminderTitle}>{reminder.title}</span>
                        <span style={{ ...styles.reminderDate, color: '#EF4444' }}>
                          Overdue
                        </span>
                      </div>
                    </div>
                  ))}
                  {upcomingReminders.slice(0, 3).map((reminder) => (
                    <div key={reminder.id} style={styles.reminderItem}>
                      <div style={{ ...styles.reminderDot, backgroundColor: '#F59E0B' }} />
                      <div style={styles.reminderInfo}>
                        <span style={styles.reminderTitle}>{reminder.title}</span>
                        <span style={styles.reminderDate}>
                          {formatDate(reminder.due_date)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Summary Card */}
          <div style={styles.summaryCard}>
            <div style={styles.summaryHeader}>
              <Receipt size={20} color="#F59E0B" />
              <span>Monthly Summary</span>
            </div>
            <div style={styles.summaryStats}>
              <div style={styles.summaryItem}>
                <span style={styles.summaryLabel}>Total Entries</span>
                <span style={styles.summaryValue}>{stats.entryCount}</span>
              </div>
              <div style={styles.summaryItem}>
                <span style={styles.summaryLabel}>All-time Income</span>
                <span style={{ ...styles.summaryValue, color: '#22C55E' }}>{formatCurrency(stats.allTimeIncome)}</span>
              </div>
              <div style={styles.summaryItem}>
                <span style={styles.summaryLabel}>All-time Expenses</span>
                <span style={{ ...styles.summaryValue, color: '#EF4444' }}>{formatCurrency(stats.allTimeExpenses)}</span>
              </div>
              <div style={styles.summaryItem}>
                <span style={styles.summaryLabel}>Deductions</span>
                <span style={styles.summaryValue}>{formatCurrency(stats.totalDeductions)}</span>
              </div>
              <div style={styles.summaryItem}>
                <span style={styles.summaryLabel}>Tax Calculations</span>
                <span style={styles.summaryValue}>{stats.calculationCount}</span>
              </div>
            </div>
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
    alignItems: 'center',
    marginBottom: '32px'
  },
  greeting: {},
  greetingText: {
    fontSize: '24px',
    fontWeight: '600',
    color: '#E6EDF3',
    margin: '0 0 4px 0'
  },
  greetingSubtext: {
    fontSize: '14px',
    color: '#8B949E',
    margin: 0
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  iconBtn: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '40px',
    height: '40px',
    backgroundColor: '#161B22',
    border: '1px solid #30363D',
    borderRadius: '8px',
    color: '#8B949E',
    cursor: 'pointer'
  },
  notificationBadge: {
    position: 'absolute',
    top: '-4px',
    right: '-4px',
    width: '18px',
    height: '18px',
    backgroundColor: '#EF4444',
    borderRadius: '50%',
    fontSize: '10px',
    fontWeight: '600',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  exportBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 16px',
    backgroundColor: '#161B22',
    border: '1px solid #30363D',
    borderRadius: '8px',
    color: '#E6EDF3',
    fontSize: '14px',
    fontWeight: '500',
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
    fontWeight: '600',
    cursor: 'pointer'
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '20px',
    marginBottom: '24px'
  },
  statCard: {
    backgroundColor: '#161B22',
    border: '1px solid #30363D',
    borderRadius: '12px',
    padding: '20px'
  },
  statHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '16px'
  },
  statLabel: {
    fontSize: '14px',
    color: '#8B949E',
    fontWeight: '500'
  },
  statIconBox: {
    width: '36px',
    height: '36px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  statValue: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#E6EDF3',
    marginBottom: '8px'
  },
  statFooter: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  statPeriod: {
    fontSize: '12px',
    color: '#6E7681'
  },
  mainGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 380px',
    gap: '24px'
  },
  sideColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px'
  },
  card: {
    backgroundColor: '#161B22',
    border: '1px solid #30363D',
    borderRadius: '12px',
    padding: '20px'
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px'
  },
  cardTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#E6EDF3',
    margin: 0
  },
  cardBody: {},
  viewAllBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    backgroundColor: 'transparent',
    border: 'none',
    color: '#2563EB',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer'
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 24px',
    textAlign: 'center'
  },
  emptyStateSmall: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    textAlign: 'center'
  },
  emptyText: {
    fontSize: '14px',
    color: '#8B949E',
    margin: '12px 0 4px'
  },
  emptyHint: {
    fontSize: '13px',
    color: '#6E7681',
    marginBottom: '16px'
  },
  emptyBtn: {
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
  linkBtn: {
    backgroundColor: 'transparent',
    border: 'none',
    color: '#2563EB',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
    marginTop: '8px'
  },
  entriesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  entryItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px',
    backgroundColor: '#0D1117',
    borderRadius: '8px'
  },
  entryIcon: {
    width: '36px',
    height: '36px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  entryInfo: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px'
  },
  entryDesc: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#E6EDF3',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  entryDate: {
    fontSize: '12px',
    color: '#6E7681'
  },
  entryAmount: {
    fontSize: '14px',
    fontWeight: '600',
    flexShrink: 0
  },
  quickActions: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '12px',
    marginTop: '12px'
  },
  quickAction: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    padding: '16px',
    backgroundColor: '#0D1117',
    border: '1px solid #30363D',
    borderRadius: '10px',
    color: '#E6EDF3',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer'
  },
  reminderCount: {
    padding: '2px 8px',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: '10px',
    fontSize: '12px',
    fontWeight: '600',
    color: '#F59E0B'
  },
  remindersList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  reminderItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px'
  },
  reminderDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    marginTop: '6px',
    flexShrink: 0
  },
  reminderInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px'
  },
  reminderTitle: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#E6EDF3'
  },
  reminderDate: {
    fontSize: '12px',
    color: '#8B949E'
  },
  summaryCard: {
    backgroundColor: 'rgba(245, 158, 11, 0.05)',
    border: '1px solid rgba(245, 158, 11, 0.2)',
    borderRadius: '12px',
    padding: '20px'
  },
  summaryHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '14px',
    fontWeight: '600',
    color: '#F59E0B',
    marginBottom: '16px'
  },
  summaryStats: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  summaryItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  summaryLabel: {
    fontSize: '13px',
    color: '#8B949E'
  },
  summaryValue: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#E6EDF3'
  }
};

export default Dashboard;
