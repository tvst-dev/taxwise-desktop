import React, { useMemo, useState } from 'react';
import {
  TrendingUp, TrendingDown, DollarSign, Calendar,
  Download, ArrowUpRight, ArrowDownRight, Wallet,
  BarChart3
} from 'lucide-react';
import { useEntriesStore, useUIStore } from '../../store';

const CashFlow = () => {
  const { entries } = useEntriesStore();
  const { openModal } = useUIStore();
  const [period, setPeriod] = useState('month');

  // Calculate cash flow data from real entries
  const cashFlowData = useMemo(() => {
    const now = new Date();
    let startDate;
    
    switch (period) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'quarter':
        const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
        startDate = new Date(now.getFullYear(), quarterMonth, 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const periodEntries = entries.filter(e => {
      const entryDate = new Date(e.date || e.createdAt);
      return entryDate >= startDate && entryDate <= now;
    });

    const totalInflow = periodEntries
      .filter(e => e.entry_type === 'income')
      .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

    const totalOutflow = periodEntries
      .filter(e => e.entry_type === 'expense')
      .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

    // Group by day for daily flow
    const dailyFlow = {};
    periodEntries.forEach(entry => {
      const date = new Date(entry.date || entry.createdAt).toISOString().split('T')[0];
      if (!dailyFlow[date]) {
        dailyFlow[date] = { inflow: 0, outflow: 0 };
      }
      const amount = parseFloat(entry.amount) || 0;
      if (entry.entry_type === 'income') {
        dailyFlow[date].inflow += amount;
      } else {
        dailyFlow[date].outflow += amount;
      }
    });

    // Recent transactions
    const recentTransactions = [...periodEntries]
      .sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt))
      .slice(0, 10);

    // Calculate running balance
    let runningBalance = 0;
    const sortedEntries = [...periodEntries].sort(
      (a, b) => new Date(a.date || a.createdAt) - new Date(b.date || b.createdAt)
    );
    sortedEntries.forEach(entry => {
      const amount = parseFloat(entry.amount) || 0;
      if (entry.entry_type === 'income') {
        runningBalance += amount;
      } else {
        runningBalance -= amount;
      }
    });

    return {
      totalInflow,
      totalOutflow,
      netFlow: totalInflow - totalOutflow,
      runningBalance,
      dailyFlow: Object.entries(dailyFlow)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-7)
        .map(([date, data]) => ({
          date: new Date(date).toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric' }),
          ...data
        })),
      recentTransactions,
      transactionCount: periodEntries.length
    };
  }, [entries, period]);

  const formatCurrency = (amount) => {
    if (!amount) return '₦0';
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-NG', {
      month: 'short',
      day: 'numeric'
    });
  };

  const maxDailyValue = Math.max(
    ...cashFlowData.dailyFlow.map(d => Math.max(d.inflow, d.outflow)),
    1
  );

  const handleExport = () => {
    openModal('export', { type: 'cashflow', data: cashFlowData });
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Cash Flow</h1>
          <p style={styles.subtitle}>
            Track money coming in and going out
          </p>
        </div>
        <div style={styles.headerActions}>
          <select 
            value={period} 
            onChange={(e) => setPeriod(e.target.value)}
            style={styles.periodSelect}
          >
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="quarter">This Quarter</option>
            <option value="year">This Year</option>
          </select>
          <button style={styles.exportBtn} onClick={handleExport}>
            <Download size={16} />
            Export
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={styles.summaryGrid}>
        <div style={styles.summaryCard}>
          <div style={styles.cardIcon}>
            <ArrowUpRight size={24} color="#22C55E" />
          </div>
          <div style={styles.cardContent}>
            <span style={styles.cardLabel}>Total Inflow</span>
            <span style={{ ...styles.cardValue, color: '#22C55E' }}>
              {formatCurrency(cashFlowData.totalInflow)}
            </span>
          </div>
        </div>

        <div style={styles.summaryCard}>
          <div style={{ ...styles.cardIcon, backgroundColor: 'rgba(239, 68, 68, 0.1)' }}>
            <ArrowDownRight size={24} color="#EF4444" />
          </div>
          <div style={styles.cardContent}>
            <span style={styles.cardLabel}>Total Outflow</span>
            <span style={{ ...styles.cardValue, color: '#EF4444' }}>
              {formatCurrency(cashFlowData.totalOutflow)}
            </span>
          </div>
        </div>

        <div style={styles.summaryCard}>
          <div style={{ ...styles.cardIcon, backgroundColor: 'rgba(37, 99, 235, 0.1)' }}>
            <TrendingUp size={24} color="#2563EB" />
          </div>
          <div style={styles.cardContent}>
            <span style={styles.cardLabel}>Net Cash Flow</span>
            <span style={{ 
              ...styles.cardValue, 
              color: cashFlowData.netFlow >= 0 ? '#22C55E' : '#EF4444' 
            }}>
              {cashFlowData.netFlow >= 0 ? '+' : ''}{formatCurrency(cashFlowData.netFlow)}
            </span>
          </div>
        </div>

        <div style={styles.summaryCard}>
          <div style={{ ...styles.cardIcon, backgroundColor: 'rgba(139, 92, 246, 0.1)' }}>
            <Wallet size={24} color="#8B5CF6" />
          </div>
          <div style={styles.cardContent}>
            <span style={styles.cardLabel}>Transactions</span>
            <span style={styles.cardValue}>{cashFlowData.transactionCount}</span>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div style={styles.chartsRow}>
        {/* Daily Flow Chart */}
        <div style={styles.chartCard}>
          <h3 style={styles.chartTitle}>Daily Cash Flow</h3>
          
          {cashFlowData.dailyFlow.length === 0 ? (
            <div style={styles.emptyChart}>
              <BarChart3 size={40} color="#30363D" />
              <p style={styles.emptyText}>No transactions in this period</p>
            </div>
          ) : (
            <>
              <div style={styles.chartLegend}>
                <div style={styles.legendItem}>
                  <span style={{ ...styles.legendDot, backgroundColor: '#22C55E' }}></span>
                  Inflow
                </div>
                <div style={styles.legendItem}>
                  <span style={{ ...styles.legendDot, backgroundColor: '#EF4444' }}></span>
                  Outflow
                </div>
              </div>
              <div style={styles.barChart}>
                {cashFlowData.dailyFlow.map((data, index) => (
                  <div key={index} style={styles.barGroup}>
                    <div style={styles.barsContainer}>
                      <div
                        style={{
                          ...styles.bar,
                          height: `${(data.inflow / maxDailyValue) * 100}px`,
                          backgroundColor: '#22C55E',
                          minHeight: data.inflow > 0 ? '4px' : '0'
                        }}
                        title={`Inflow: ${formatCurrency(data.inflow)}`}
                      />
                      <div
                        style={{
                          ...styles.bar,
                          height: `${(data.outflow / maxDailyValue) * 100}px`,
                          backgroundColor: '#EF4444',
                          minHeight: data.outflow > 0 ? '4px' : '0'
                        }}
                        title={`Outflow: ${formatCurrency(data.outflow)}`}
                      />
                    </div>
                    <span style={styles.barLabel}>{data.date}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Recent Transactions */}
        <div style={styles.transactionsCard}>
          <h3 style={styles.chartTitle}>Recent Transactions</h3>
          
          {cashFlowData.recentTransactions.length === 0 ? (
            <div style={styles.emptyChart}>
              <DollarSign size={40} color="#30363D" />
              <p style={styles.emptyText}>No transactions yet</p>
            </div>
          ) : (
            <div style={styles.transactionsList}>
              {cashFlowData.recentTransactions.map((transaction) => (
                <div key={transaction.id} style={styles.transactionItem}>
                  <div style={{
                    ...styles.transactionIcon,
                    backgroundColor: transaction.entry_type === 'income' 
                      ? 'rgba(34, 197, 94, 0.1)' 
                      : 'rgba(239, 68, 68, 0.1)'
                  }}>
                    {transaction.entry_type === 'income' ? (
                      <ArrowUpRight size={16} color="#22C55E" />
                    ) : (
                      <ArrowDownRight size={16} color="#EF4444" />
                    )}
                  </div>
                  <div style={styles.transactionInfo}>
                    <span style={styles.transactionDesc}>
                      {transaction.description || 'Untitled'}
                    </span>
                    <span style={styles.transactionDate}>
                      {formatDate(transaction.date || transaction.createdAt)}
                    </span>
                  </div>
                  <span style={{
                    ...styles.transactionAmount,
                    color: transaction.entry_type === 'income' ? '#22C55E' : '#E6EDF3'
                  }}>
                    {transaction.entry_type === 'income' ? '+' : '-'}
                    {formatCurrency(transaction.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
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
  headerActions: {
    display: 'flex',
    gap: '12px'
  },
  periodSelect: {
    padding: '10px 16px',
    backgroundColor: '#161B22',
    border: '1px solid #30363D',
    borderRadius: '8px',
    color: '#E6EDF3',
    fontSize: '14px',
    cursor: 'pointer',
    outline: 'none'
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
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
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
  cardIcon: {
    width: '48px',
    height: '48px',
    borderRadius: '12px',
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  cardContent: {
    display: 'flex',
    flexDirection: 'column'
  },
  cardLabel: {
    fontSize: '13px',
    color: '#8B949E',
    marginBottom: '4px'
  },
  cardValue: {
    fontSize: '20px',
    fontWeight: '600',
    color: '#E6EDF3'
  },
  chartsRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '20px'
  },
  chartCard: {
    padding: '24px',
    backgroundColor: '#161B22',
    border: '1px solid #30363D',
    borderRadius: '12px'
  },
  transactionsCard: {
    padding: '24px',
    backgroundColor: '#161B22',
    border: '1px solid #30363D',
    borderRadius: '12px'
  },
  chartTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#E6EDF3',
    margin: '0 0 16px 0'
  },
  emptyChart: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px',
    textAlign: 'center'
  },
  emptyText: {
    fontSize: '14px',
    color: '#8B949E',
    marginTop: '12px'
  },
  chartLegend: {
    display: 'flex',
    gap: '20px',
    marginBottom: '16px'
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    color: '#8B949E'
  },
  legendDot: {
    width: '10px',
    height: '10px',
    borderRadius: '2px'
  },
  barChart: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: '130px',
    gap: '8px'
  },
  barGroup: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    flex: 1
  },
  barsContainer: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '4px',
    height: '100px'
  },
  bar: {
    width: '16px',
    borderRadius: '3px 3px 0 0',
    transition: 'height 0.3s ease'
  },
  barLabel: {
    fontSize: '11px',
    color: '#6E7681'
  },
  transactionsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    maxHeight: '300px',
    overflowY: 'auto'
  },
  transactionItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px',
    backgroundColor: '#0D1117',
    borderRadius: '8px'
  },
  transactionIcon: {
    width: '36px',
    height: '36px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  transactionInfo: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px'
  },
  transactionDesc: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#E6EDF3',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  transactionDate: {
    fontSize: '12px',
    color: '#6E7681'
  },
  transactionAmount: {
    fontSize: '14px',
    fontWeight: '600',
    flexShrink: 0
  }
};

export default CashFlow;
