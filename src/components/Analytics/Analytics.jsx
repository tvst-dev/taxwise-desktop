import React, { useMemo } from 'react';
import {
  BarChart3, TrendingUp, TrendingDown, AlertCircle,
  Calendar, Download, PieChart, Calculator, Shield,
  Clock, FileText, DollarSign
} from 'lucide-react';
import { 
  useEntriesStore, useTaxStore, useDeductionsStore, 
  useRemindersStore, useUIStore 
} from '../../store';

const Analytics = () => {
  const { entries } = useEntriesStore();
  const { calculations } = useTaxStore();
  const { deductions } = useDeductionsStore();
  const { getUpcomingReminders, getOverdueReminders } = useRemindersStore();
  const { openModal } = useUIStore();

  // Calculate analytics from real data
  const analytics = useMemo(() => {
    // Income/Expense by category
    const categoryTotals = {};
    entries.forEach(entry => {
      const category = entry.category || 'Uncategorized';
      if (!categoryTotals[category]) {
        categoryTotals[category] = { income: 0, expense: 0 };
      }
      const amount = parseFloat(entry.amount) || 0;
      if (entry.entry_type === 'income') {
        categoryTotals[category].income += amount;
      } else {
        categoryTotals[category].expense += amount;
      }
    });

    // Format category name: capitalize each word, replace underscores with spaces
    const formatCatName = (n) => n
      .split(/[_\s]+/)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');

    // Convert to array and sort
    const expensesByCategory = Object.entries(categoryTotals)
      .map(([name, data]) => ({
        name: formatCatName(name),
        amount: data.expense,
        income: data.income
      }))
      .filter(c => c.amount > 0)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    // Calculate totals
    const totalIncome = entries
      .filter(e => e.entry_type === 'income')
      .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
    
    const totalExpenses = entries
      .filter(e => e.entry_type === 'expense')
      .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

    const totalDeductions = deductions
      .reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);

    const totalTaxLiability = calculations
      .reduce((sum, c) => sum + (parseFloat(c.net_tax_payable) || 0), 0);

    // Monthly breakdown
    const monthlyData = {};
    entries.forEach(entry => {
      const date = new Date(entry.date || entry.createdAt);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { income: 0, expense: 0 };
      }
      const amount = parseFloat(entry.amount) || 0;
      if (entry.entry_type === 'income') {
        monthlyData[monthKey].income += amount;
      } else {
        monthlyData[monthKey].expense += amount;
      }
    });

    // Get last 6 months
    const months = Object.keys(monthlyData)
      .sort()
      .slice(-6)
      .map(key => ({
        month: new Date(key + '-01').toLocaleDateString('en-NG', { month: 'short' }),
        ...monthlyData[key]
      }));

    // Pending filings
    const upcomingReminders = getUpcomingReminders(30);
    const overdueReminders = getOverdueReminders();

    return {
      totalIncome,
      totalExpenses,
      totalDeductions,
      totalTaxLiability,
      netIncome: totalIncome - totalExpenses,
      expensesByCategory,
      monthlyData: months,
      pendingFilings: upcomingReminders.length,
      overdueFilings: overdueReminders.length,
      entryCount: entries.length,
      calculationCount: calculations.length
    };
  }, [entries, calculations, deductions, getUpcomingReminders, getOverdueReminders]);

  const formatCurrency = (amount) => {
    if (!amount) return '₦0';
    if (amount >= 1000000) {
      return `₦${(amount / 1000000).toFixed(1)}M`;
    } else if (amount >= 1000) {
      return `₦${(amount / 1000).toFixed(0)}K`;
    }
    return `₦${amount.toLocaleString()}`;
  };

  const handleExport = () => {
    openModal('export', { type: 'analytics', data: analytics });
  };

  // Calculate max for chart scaling
  const maxMonthlyValue = Math.max(
    ...analytics.monthlyData.map(m => Math.max(m.income, m.expense)),
    1
  );

  // Colors for expense categories
  const categoryColors = ['#2563EB', '#22C55E', '#F59E0B', '#8B5CF6', '#EC4899'];

  // Calculate total for percentages
  const totalExpenseAmount = analytics.expensesByCategory.reduce((sum, c) => sum + c.amount, 0);

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Analytics</h1>
          <p style={styles.subtitle}>
            Financial insights and performance metrics
          </p>
        </div>
        <button style={styles.exportBtn} onClick={handleExport}>
          <Download size={16} />
          Export Report
        </button>
      </div>

      {/* Stats Cards */}
      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <div style={styles.statHeader}>
            <span style={styles.statLabel}>Total Income</span>
            <div style={{ ...styles.statIcon, backgroundColor: 'rgba(34, 197, 94, 0.1)' }}>
              <TrendingUp size={18} color="#22C55E" />
            </div>
          </div>
          <div style={{ ...styles.statValue, color: '#22C55E' }}>
            {formatCurrency(analytics.totalIncome)}
          </div>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statHeader}>
            <span style={styles.statLabel}>Total Expenses</span>
            <div style={{ ...styles.statIcon, backgroundColor: 'rgba(239, 68, 68, 0.1)' }}>
              <TrendingDown size={18} color="#EF4444" />
            </div>
          </div>
          <div style={{ ...styles.statValue, color: '#EF4444' }}>
            {formatCurrency(analytics.totalExpenses)}
          </div>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statHeader}>
            <span style={styles.statLabel}>Tax Liability</span>
            <div style={{ ...styles.statIcon, backgroundColor: 'rgba(139, 92, 246, 0.1)' }}>
              <Calculator size={18} color="#8B5CF6" />
            </div>
          </div>
          <div style={styles.statValue}>
            {formatCurrency(analytics.totalTaxLiability)}
          </div>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statHeader}>
            <span style={styles.statLabel}>Deductions</span>
            <div style={{ ...styles.statIcon, backgroundColor: 'rgba(245, 158, 11, 0.1)' }}>
              <Shield size={18} color="#F59E0B" />
            </div>
          </div>
          <div style={styles.statValue}>
            {formatCurrency(analytics.totalDeductions)}
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div style={styles.chartsGrid}>
        {/* Monthly Trend */}
        <div style={styles.chartCard}>
          <h3 style={styles.chartTitle}>Monthly Trend</h3>
          <p style={styles.chartSubtitle}>Income vs Expenses</p>
          
          {analytics.monthlyData.length === 0 ? (
            <div style={styles.chartEmpty}>
              <BarChart3 size={40} color="#30363D" />
              <p>No data available</p>
              <span>Add entries to see trends</span>
            </div>
          ) : (
            <>
              <div style={styles.chartLegend}>
                <div style={styles.legendItem}>
                  <span style={{ ...styles.legendDot, backgroundColor: '#22C55E' }}></span>
                  Income
                </div>
                <div style={styles.legendItem}>
                  <span style={{ ...styles.legendDot, backgroundColor: '#EF4444' }}></span>
                  Expenses
                </div>
              </div>
              <div style={styles.barChart}>
                {analytics.monthlyData.map((data, index) => (
                  <div key={index} style={styles.barGroup}>
                    <div style={styles.barsContainer}>
                      <div
                        style={{
                          ...styles.bar,
                          height: `${(data.income / maxMonthlyValue) * 120}px`,
                          backgroundColor: '#22C55E',
                          minHeight: data.income > 0 ? '4px' : '0'
                        }}
                        title={`Income: ${formatCurrency(data.income)}`}
                      />
                      <div
                        style={{
                          ...styles.bar,
                          height: `${(data.expense / maxMonthlyValue) * 120}px`,
                          backgroundColor: '#EF4444',
                          minHeight: data.expense > 0 ? '4px' : '0'
                        }}
                        title={`Expenses: ${formatCurrency(data.expense)}`}
                      />
                    </div>
                    <span style={styles.barLabel}>{data.month}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Expenses by Category */}
        <div style={styles.chartCard}>
          <h3 style={styles.chartTitle}>Expenses by Category</h3>
          <p style={styles.chartSubtitle}>Top spending categories</p>
          
          {analytics.expensesByCategory.length === 0 ? (
            <div style={styles.chartEmpty}>
              <PieChart size={40} color="#30363D" />
              <p>No expenses recorded</p>
              <span>Add expense entries to see breakdown</span>
            </div>
          ) : (
            <div style={styles.categoryList}>
              {analytics.expensesByCategory.map((category, index) => {
                const percentage = totalExpenseAmount > 0 
                  ? Math.round((category.amount / totalExpenseAmount) * 100) 
                  : 0;
                return (
                  <div key={category.name} style={styles.categoryItem}>
                    <div style={styles.categoryHeader}>
                      <div style={styles.categoryName}>
                        <span 
                          style={{ 
                            ...styles.categoryDot, 
                            backgroundColor: categoryColors[index % categoryColors.length] 
                          }} 
                        />
                        {category.name}
                      </div>
                      <span style={styles.categoryAmount}>
                        {formatCurrency(category.amount)}
                      </span>
                    </div>
                    <div style={styles.categoryBar}>
                      <div 
                        style={{ 
                          ...styles.categoryProgress,
                          width: `${percentage}%`,
                          backgroundColor: categoryColors[index % categoryColors.length]
                        }} 
                      />
                    </div>
                    <span style={styles.categoryPercent}>{percentage}%</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Stats */}
      <div style={styles.bottomGrid}>
        <div style={styles.infoCard}>
          <div style={styles.infoIcon}>
            <FileText size={24} color="#2563EB" />
          </div>
          <div style={styles.infoContent}>
            <span style={styles.infoValue}>{analytics.entryCount}</span>
            <span style={styles.infoLabel}>Total Entries</span>
          </div>
        </div>

        <div style={styles.infoCard}>
          <div style={styles.infoIcon}>
            <Calculator size={24} color="#8B5CF6" />
          </div>
          <div style={styles.infoContent}>
            <span style={styles.infoValue}>{analytics.calculationCount}</span>
            <span style={styles.infoLabel}>Tax Calculations</span>
          </div>
        </div>

        <div style={styles.infoCard}>
          <div style={styles.infoIcon}>
            <Clock size={24} color="#F59E0B" />
          </div>
          <div style={styles.infoContent}>
            <span style={styles.infoValue}>{analytics.pendingFilings}</span>
            <span style={styles.infoLabel}>Upcoming Deadlines</span>
          </div>
        </div>

        <div style={styles.infoCard}>
          <div style={{ ...styles.infoIcon, backgroundColor: 'rgba(239, 68, 68, 0.1)' }}>
            <AlertCircle size={24} color="#EF4444" />
          </div>
          <div style={styles.infoContent}>
            <span style={{ ...styles.infoValue, color: analytics.overdueFilings > 0 ? '#EF4444' : '#E6EDF3' }}>
              {analytics.overdueFilings}
            </span>
            <span style={styles.infoLabel}>Overdue Items</span>
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
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '16px',
    marginBottom: '24px'
  },
  statCard: {
    padding: '20px',
    backgroundColor: '#161B22',
    border: '1px solid #30363D',
    borderRadius: '12px'
  },
  statHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '12px'
  },
  statLabel: {
    fontSize: '14px',
    color: '#8B949E'
  },
  statIcon: {
    width: '36px',
    height: '36px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  statValue: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#E6EDF3'
  },
  chartsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '20px',
    marginBottom: '24px'
  },
  chartCard: {
    padding: '24px',
    backgroundColor: '#161B22',
    border: '1px solid #30363D',
    borderRadius: '12px'
  },
  chartTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#E6EDF3',
    margin: '0 0 4px 0'
  },
  chartSubtitle: {
    fontSize: '13px',
    color: '#8B949E',
    margin: '0 0 20px 0'
  },
  chartEmpty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px',
    textAlign: 'center',
    color: '#8B949E'
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
    height: '150px',
    gap: '12px'
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
    height: '120px'
  },
  bar: {
    width: '20px',
    borderRadius: '4px 4px 0 0',
    transition: 'height 0.3s ease'
  },
  barLabel: {
    fontSize: '12px',
    color: '#6E7681'
  },
  categoryList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  categoryItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  categoryHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  categoryName: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    color: '#E6EDF3'
  },
  categoryDot: {
    width: '10px',
    height: '10px',
    borderRadius: '2px'
  },
  categoryAmount: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#E6EDF3'
  },
  categoryBar: {
    height: '8px',
    backgroundColor: '#21262D',
    borderRadius: '4px',
    overflow: 'hidden'
  },
  categoryProgress: {
    height: '100%',
    borderRadius: '4px',
    transition: 'width 0.3s ease'
  },
  categoryPercent: {
    fontSize: '12px',
    color: '#8B949E'
  },
  bottomGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '16px'
  },
  infoCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '20px',
    backgroundColor: '#161B22',
    border: '1px solid #30363D',
    borderRadius: '12px'
  },
  infoIcon: {
    width: '48px',
    height: '48px',
    borderRadius: '12px',
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  infoContent: {
    display: 'flex',
    flexDirection: 'column'
  },
  infoValue: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#E6EDF3'
  },
  infoLabel: {
    fontSize: '13px',
    color: '#8B949E'
  }
};

export default Analytics;
