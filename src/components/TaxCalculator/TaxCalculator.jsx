import React, { useState, useEffect, useCallback } from 'react';
import {
  HelpCircle,
  Bell,
  RefreshCw,
  Download,
  ChevronDown,
  Info,
  Calculator,
  FileText,
  Save
} from 'lucide-react';
import { useAuthStore, useTaxStore, useUIStore, useEntriesStore, useDeductionsStore } from '../../store';
import { createTaxCalculation } from '../../services/supabase';
import {
  calculatePAYE,
  calculateCIT,
  calculateVAT,
  calculateWHT,
  calculateMonthlyPAYE,
  TAX_TYPES,
  ENTITY_TYPES,
  formatNaira,
  WHT_RATES
} from '../../services/taxCalculator';
import toast from 'react-hot-toast';

const TaxCalculator = () => {
  const { organization } = useAuthStore();
  const { addCalculation } = useTaxStore();
  const { openModal } = useUIStore();
  const { entries } = useEntriesStore();
  const { deductions } = useDeductionsStore();

  const currentYear = new Date().getFullYear();

  // Determine default tax type based on business type
  const getDefaultTaxType = (businessType) => {
    const bt = (businessType || '').toLowerCase();
    if (bt.includes('sole') || bt.includes('individual') || bt.includes('partnership')) return 'paye';
    return 'cit'; // limited_company, plc, and all others default to CIT
  };

  const [taxType, setTaxType] = useState(() => getDefaultTaxType(organization?.business_type));
  const [fiscalYear, setFiscalYear] = useState(currentYear);
  const [companyCategory, setCompanyCategory] = useState('medium');
  const [isCalculating, setIsCalculating] = useState(false);
  const [result, setResult] = useState(null);

  // Calculate totals from entries for the selected fiscal year
  const entrySummary = React.useMemo(() => {
    const yearStart = new Date(fiscalYear, 0, 1);
    const yearEnd = new Date(fiscalYear, 11, 31, 23, 59, 59);

    const yearEntries = entries.filter(e => {
      const rawDate = e.date || e.createdAt;
      // Parse YYYY-MM-DD as local time (not UTC) to avoid off-by-one-day issues
      const date = rawDate && typeof rawDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(rawDate)
        ? new Date(rawDate.substring(0, 10) + 'T00:00:00')
        : new Date(rawDate);
      return date >= yearStart && date <= yearEnd;
    });

    const totalIncome = yearEntries
      .filter(e => e.entry_type === 'income')
      .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

    const totalExpenses = yearEntries
      .filter(e => e.entry_type === 'expense')
      .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

    const totalVAT = yearEntries
      .reduce((sum, e) => sum + (parseFloat(e.vat_amount) || 0), 0);

    const totalDeductionsAmount = deductions
      .filter(d => !d.tax_year || String(d.tax_year) === String(fiscalYear))
      .reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);

    return { totalIncome, totalExpenses, totalVAT, totalDeductionsAmount, entryCount: yearEntries.length };
  }, [entries, deductions, fiscalYear]);

  // Auto-populate from entries
  const handleAutoPopulate = () => {
    if (entries.length === 0) {
      toast.error('No entries found. Add income/expense entries first.');
      return;
    }

    if (entrySummary.entryCount === 0) {
      // Auto-detect the year with the most entries
      const yearCounts = {};
      entries.forEach(e => {
        const rawDate = e.date || e.createdAt;
        // Parse YYYY-MM-DD strings as local time to avoid UTC offset issues
        const year = rawDate
          ? (typeof rawDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(rawDate)
              ? parseInt(rawDate.substring(0, 4))
              : new Date(rawDate).getFullYear())
          : null;
        if (year && !isNaN(year)) yearCounts[year] = (yearCounts[year] || 0) + 1;
      });
      const bestYear = Object.entries(yearCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
      if (bestYear) {
        setFiscalYear(parseInt(bestYear));
        toast.info(`No entries for ${fiscalYear} — switched to ${bestYear} (${yearCounts[bestYear]} entries). Click "From Entries" again.`);
      } else {
        toast.error(`No entries found for fiscal year ${fiscalYear}. Try a different year.`);
      }
      return;
    }

    if (taxType === 'cit') {
      const totalAllowable = entrySummary.totalExpenses + entrySummary.totalDeductionsAmount;
      setCitData({
        totalRevenue: entrySummary.totalIncome,
        allowableExpenses: totalAllowable,
        nonAllowableExpenses: 0,
        capitalAllowances: 0,
        annualTurnover: entrySummary.totalIncome
      });
      if (entrySummary.totalIncome === 0 && totalAllowable > 0) {
        toast.success(`Expenses populated (₦${totalAllowable.toLocaleString()}). Enter your revenue in "Total Revenue / Income" to calculate CIT.`);
      } else {
        toast.success(
          `Populated from ${entrySummary.entryCount} entries` +
          (entrySummary.totalDeductionsAmount > 0 ? ` + ₦${entrySummary.totalDeductionsAmount.toLocaleString()} deductions` : '')
        );
      }
    } else if (taxType === 'vat') {
      setVatData({
        vatableSales: entrySummary.totalIncome,
        exemptSales: 0,
        zeroRatedSales: 0,
        vatablePurchases: entrySummary.totalExpenses,
        exemptPurchases: 0,
        vatCreditBroughtForward: 0
      });
      toast.success(`Populated from ${entrySummary.entryCount} entries`);
    } else if (taxType === 'paye') {
      const annualIncome = entrySummary.totalIncome;
      const monthlyIncome = annualIncome / 12;
      // Estimate basic = 70% of monthly, housing = 20%, transport = 10%
      const basicSalary = Math.round(monthlyIncome * 0.70);
      const housingAllowance = Math.round(monthlyIncome * 0.20);
      const transportAllowance = Math.round(monthlyIncome * 0.10);
      // Get pension/NHF from deductions for this year
      const pensionDed = deductions
        .filter(d => d.category === 'pension' && (!d.tax_year || String(d.tax_year) === String(fiscalYear)))
        .reduce((s, d) => s + (parseFloat(d.amount) || 0), 0);
      const nhfDed = deductions
        .filter(d => d.category === 'nhf' && (!d.tax_year || String(d.tax_year) === String(fiscalYear)))
        .reduce((s, d) => s + (parseFloat(d.amount) || 0), 0);
      setPayeData(prev => ({
        ...prev,
        grossEmoluments: annualIncome,
        basicSalary: basicSalary > 0 ? basicSalary : prev.basicSalary,
        housingAllowance: housingAllowance > 0 ? housingAllowance : prev.housingAllowance,
        transportAllowance: transportAllowance > 0 ? transportAllowance : prev.transportAllowance,
        pensionContribution: pensionDed > 0 ? pensionDed : (annualIncome * 0.08 > 0 ? Math.round(annualIncome * 0.08) : prev.pensionContribution),
        nhfContribution: nhfDed > 0 ? nhfDed : prev.nhfContribution
      }));
      toast.success(annualIncome > 0
        ? `Populated from ${entrySummary.entryCount} entries — ₦${annualIncome.toLocaleString()} annual income`
        : `No income entries for ${fiscalYear}. Enter salary manually.`
      );
    } else {
      toast.info('Auto-populate works best with CIT, VAT, and PAYE calculations');
    }
  };

  // PAYE Fields
  const [payeData, setPayeData] = useState({
    grossEmoluments: 0,
    basicSalary: 0,
    housingAllowance: 0,
    transportAllowance: 0,
    otherAllowances: 0,
    pensionContribution: 0,
    nhfContribution: 0,
    nhisContribution: 0,
    lifeAssurancePremium: 0,
    calculationType: 'annual' // 'annual' or 'monthly'
  });

  // CIT Fields
  const [citData, setCitData] = useState({
    totalRevenue: 0,
    allowableExpenses: 0,
    nonAllowableExpenses: 0,
    capitalAllowances: 0,
    annualTurnover: 0
  });

  // VAT Fields
  const [vatData, setVatData] = useState({
    vatableSales: 0,
    exemptSales: 0,
    zeroRatedSales: 0,
    vatablePurchases: 0,
    exemptPurchases: 0,
    vatCreditBroughtForward: 0
  });

  // WHT Fields
  const [whtData, setWhtData] = useState({
    transactionType: 'professional_services',
    grossAmount: 0,
    recipientType: 'company'
  });

  // Calculate based on tax type
  const handleCalculate = useCallback(() => {
    setIsCalculating(true);
    
    try {
      let calculationResult;

      switch (taxType) {
        case 'paye':
          if (payeData.calculationType === 'monthly') {
            calculationResult = calculateMonthlyPAYE({
              basicSalary: payeData.basicSalary,
              housingAllowance: payeData.housingAllowance,
              transportAllowance: payeData.transportAllowance,
              otherAllowances: payeData.otherAllowances,
            });
          } else {
            calculationResult = calculatePAYE({
              grossEmoluments: payeData.grossEmoluments || (
                payeData.basicSalary + 
                payeData.housingAllowance + 
                payeData.transportAllowance + 
                payeData.otherAllowances
              ) * 12,
              pensionContribution: payeData.pensionContribution,
              nhfContribution: payeData.nhfContribution,
              nhisContribution: payeData.nhisContribution,
              lifeAssurancePremium: payeData.lifeAssurancePremium,
              entityType: ENTITY_TYPES.INDIVIDUAL
            });
          }
          break;

        case 'cit':
          calculationResult = calculateCIT({
            totalRevenue: citData.totalRevenue,
            allowableExpenses: citData.allowableExpenses,
            nonAllowableExpenses: citData.nonAllowableExpenses,
            capitalAllowances: citData.capitalAllowances,
            annualTurnover: citData.annualTurnover
          });
          break;

        case 'vat':
          calculationResult = calculateVAT({
            vatableSales: vatData.vatableSales,
            exemptSales: vatData.exemptSales,
            zeroRatedSales: vatData.zeroRatedSales,
            vatablePurchases: vatData.vatablePurchases,
            exemptPurchases: vatData.exemptPurchases,
            vatCreditBroughtForward: vatData.vatCreditBroughtForward
          });
          break;

        case 'wht':
          calculationResult = calculateWHT({
            transactionType: whtData.transactionType,
            grossAmount: whtData.grossAmount,
            recipientType: whtData.recipientType
          });
          break;

        default:
          throw new Error('Invalid tax type');
      }

      setResult(calculationResult);
      toast.success('Calculation completed');
    } catch (error) {
      console.error('Calculation error:', error);
      toast.error(error.message || 'Calculation failed');
    } finally {
      setIsCalculating(false);
    }
  }, [taxType, payeData, citData, vatData, whtData]);

  // Auto-calculate when inputs change
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (taxType === 'cit' && (citData.totalRevenue > 0 || citData.allowableExpenses > 0)) {
        handleCalculate();
      }
    }, 500);
    return () => clearTimeout(timeout);
  }, [citData, taxType]);

  const handleReset = () => {
    setPayeData({
      grossEmoluments: 0,
      basicSalary: 0,
      housingAllowance: 0,
      transportAllowance: 0,
      otherAllowances: 0,
      pensionContribution: 0,
      nhfContribution: 0,
      nhisContribution: 0,
      lifeAssurancePremium: 0,
      calculationType: 'annual'
    });
    setCitData({
      totalRevenue: 0,
      allowableExpenses: 0,
      nonAllowableExpenses: 0,
      capitalAllowances: 0,
      annualTurnover: 0
    });
    setVatData({
      vatableSales: 0,
      exemptSales: 0,
      zeroRatedSales: 0,
      vatablePurchases: 0,
      exemptPurchases: 0,
      vatCreditBroughtForward: 0
    });
    setWhtData({
      transactionType: 'professional_services',
      grossAmount: 0,
      recipientType: 'company'
    });
    setResult(null);
    toast.success('Form reset');
  };

  const handleExportReport = () => {
    if (!result) {
      toast.error('Please calculate first');
      return;
    }
    openModal('exportTaxReport', { result, taxType, fiscalYear });
  };

  const handleSaveCalculation = async () => {
    if (!result) {
      toast.error('Please calculate first');
      return;
    }

    const netTaxPayable =
      result.summary?.totalTaxLiability ||
      result.summary?.netTaxPayable ||
      result.summary?.taxDue ||
      result.summary?.annualPAYE ||
      result.summary?.vatPayable ||
      result.summary?.whtAmount ||
      0;

    const inputData = taxType === 'paye' ? payeData : taxType === 'cit' ? citData : taxType === 'vat' ? vatData : whtData;

    const calcData = {
      tax_type: taxType,
      fiscal_year: fiscalYear,
      input_data: inputData,
      result_data: result.summary,
      organization_id: organization?.id,
      status: 'draft'
    };

    const localCalc = {
      ...calcData,
      id: `calc_${Date.now()}`,
      createdAt: new Date().toISOString(),
      net_tax_payable: netTaxPayable,
      taxable_amount: result.summary?.taxableAmount || 0,
      gross_amount: result.summary?.grossAmount || 0
    };

    try {
      if (organization?.id) {
        const saved = await createTaxCalculation(calcData);
        addCalculation(saved);
      } else {
        addCalculation(localCalc);
      }
      toast.success('Calculation saved to history');
    } catch (error) {
      console.error('Save calculation error:', error);
      // Always save locally as fallback so history is never lost
      addCalculation(localCalc);
      toast.success('Calculation saved locally');
    }
  };

  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return '₦0';
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const renderInputFields = () => {
    switch (taxType) {
      case 'paye':
        return (
          <div style={styles.fieldsSection}>
            <h4 style={styles.sectionTitle}>Earnings</h4>
            <div style={styles.fieldsGrid}>
              <div style={styles.field}>
                <label style={styles.fieldLabel}>Basic Salary (Monthly)</label>
                <div style={styles.inputWrapper}>
                  <span style={styles.inputPrefix}>₦</span>
                  <input
                    type="number"
                    value={payeData.basicSalary || ''}
                    onChange={(e) => setPayeData(prev => ({ ...prev, basicSalary: parseFloat(e.target.value) || 0 }))}
                    style={styles.input}
                    placeholder="0"
                  />
                </div>
              </div>
              <div style={styles.field}>
                <label style={styles.fieldLabel}>Housing Allowance</label>
                <div style={styles.inputWrapper}>
                  <span style={styles.inputPrefix}>₦</span>
                  <input
                    type="number"
                    value={payeData.housingAllowance || ''}
                    onChange={(e) => setPayeData(prev => ({ ...prev, housingAllowance: parseFloat(e.target.value) || 0 }))}
                    style={styles.input}
                    placeholder="0"
                  />
                </div>
              </div>
              <div style={styles.field}>
                <label style={styles.fieldLabel}>Transport Allowance</label>
                <div style={styles.inputWrapper}>
                  <span style={styles.inputPrefix}>₦</span>
                  <input
                    type="number"
                    value={payeData.transportAllowance || ''}
                    onChange={(e) => setPayeData(prev => ({ ...prev, transportAllowance: parseFloat(e.target.value) || 0 }))}
                    style={styles.input}
                    placeholder="0"
                  />
                </div>
              </div>
              <div style={styles.field}>
                <label style={styles.fieldLabel}>Other Allowances</label>
                <div style={styles.inputWrapper}>
                  <span style={styles.inputPrefix}>₦</span>
                  <input
                    type="number"
                    value={payeData.otherAllowances || ''}
                    onChange={(e) => setPayeData(prev => ({ ...prev, otherAllowances: parseFloat(e.target.value) || 0 }))}
                    style={styles.input}
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            <h4 style={{ ...styles.sectionTitle, marginTop: '24px' }}>Statutory Deductions</h4>
            <div style={styles.fieldsGrid}>
              <div style={styles.field}>
                <label style={styles.fieldLabel}>Pension Contribution</label>
                <div style={styles.inputWrapper}>
                  <span style={styles.inputPrefix}>₦</span>
                  <input
                    type="number"
                    value={payeData.pensionContribution || ''}
                    onChange={(e) => setPayeData(prev => ({ ...prev, pensionContribution: parseFloat(e.target.value) || 0 }))}
                    style={styles.input}
                    placeholder="0"
                  />
                </div>
              </div>
              <div style={styles.field}>
                <label style={styles.fieldLabel}>NHF Contribution</label>
                <div style={styles.inputWrapper}>
                  <span style={styles.inputPrefix}>₦</span>
                  <input
                    type="number"
                    value={payeData.nhfContribution || ''}
                    onChange={(e) => setPayeData(prev => ({ ...prev, nhfContribution: parseFloat(e.target.value) || 0 }))}
                    style={styles.input}
                    placeholder="0"
                  />
                </div>
              </div>
            </div>
          </div>
        );

      case 'cit':
        return (
          <div style={styles.fieldsSection}>
            <h4 style={styles.sectionTitle}>Revenue</h4>
            <div style={styles.fieldsGrid}>
              <div style={styles.field}>
                <label style={styles.fieldLabel}>Total Revenue / Income</label>
                <div style={styles.inputWrapper}>
                  <span style={styles.inputPrefix}>₦</span>
                  <input
                    type="number"
                    value={citData.totalRevenue || ''}
                    onChange={(e) => setCitData(prev => ({ ...prev, totalRevenue: parseFloat(e.target.value) || 0 }))}
                    style={styles.input}
                    placeholder="0"
                  />
                </div>
              </div>
              <div style={styles.field}>
                <label style={styles.fieldLabel}>Annual Turnover</label>
                <div style={styles.inputWrapper}>
                  <span style={styles.inputPrefix}>₦</span>
                  <input
                    type="number"
                    value={citData.annualTurnover || ''}
                    onChange={(e) => setCitData(prev => ({ ...prev, annualTurnover: parseFloat(e.target.value) || 0 }))}
                    style={styles.input}
                    placeholder="0"
                  />
                </div>
              </div>
            </div>
            <h4 style={{ ...styles.sectionTitle, marginTop: '20px' }}>Deductions</h4>
            <div style={styles.fieldsGrid}>
              <div style={styles.field}>
                <label style={styles.fieldLabel}>Allowable Expenses</label>
                <div style={styles.inputWrapper}>
                  <span style={styles.inputPrefix}>₦</span>
                  <input
                    type="number"
                    value={citData.allowableExpenses || ''}
                    onChange={(e) => setCitData(prev => ({ ...prev, allowableExpenses: parseFloat(e.target.value) || 0 }))}
                    style={styles.input}
                    placeholder="0"
                  />
                </div>
              </div>
              <div style={styles.field}>
                <label style={styles.fieldLabel}>Capital Allowances</label>
                <div style={styles.inputWrapper}>
                  <span style={styles.inputPrefix}>₦</span>
                  <input
                    type="number"
                    value={citData.capitalAllowances || ''}
                    onChange={(e) => setCitData(prev => ({ ...prev, capitalAllowances: parseFloat(e.target.value) || 0 }))}
                    style={styles.input}
                    placeholder="0"
                  />
                </div>
              </div>
              <div style={styles.field}>
                <label style={styles.fieldLabel}>Non-Allowable Expenses</label>
                <div style={styles.inputWrapper}>
                  <span style={styles.inputPrefix}>₦</span>
                  <input
                    type="number"
                    value={citData.nonAllowableExpenses || ''}
                    onChange={(e) => setCitData(prev => ({ ...prev, nonAllowableExpenses: parseFloat(e.target.value) || 0 }))}
                    style={styles.input}
                    placeholder="0"
                  />
                </div>
              </div>
            </div>
          </div>
        );

      case 'vat':
        return (
          <div style={styles.fieldsSection}>
            <h4 style={styles.sectionTitle}>Output VAT (Sales)</h4>
            <div style={styles.fieldsGrid}>
              <div style={styles.field}>
                <label style={styles.fieldLabel}>VATable Sales</label>
                <div style={styles.inputWrapper}>
                  <span style={styles.inputPrefix}>₦</span>
                  <input
                    type="number"
                    value={vatData.vatableSales || ''}
                    onChange={(e) => setVatData(prev => ({ ...prev, vatableSales: parseFloat(e.target.value) || 0 }))}
                    style={styles.input}
                    placeholder="0"
                  />
                </div>
              </div>
              <div style={styles.field}>
                <label style={styles.fieldLabel}>Exempt Sales</label>
                <div style={styles.inputWrapper}>
                  <span style={styles.inputPrefix}>₦</span>
                  <input
                    type="number"
                    value={vatData.exemptSales || ''}
                    onChange={(e) => setVatData(prev => ({ ...prev, exemptSales: parseFloat(e.target.value) || 0 }))}
                    style={styles.input}
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            <h4 style={{ ...styles.sectionTitle, marginTop: '24px' }}>Input VAT (Purchases)</h4>
            <div style={styles.fieldsGrid}>
              <div style={styles.field}>
                <label style={styles.fieldLabel}>VATable Purchases</label>
                <div style={styles.inputWrapper}>
                  <span style={styles.inputPrefix}>₦</span>
                  <input
                    type="number"
                    value={vatData.vatablePurchases || ''}
                    onChange={(e) => setVatData(prev => ({ ...prev, vatablePurchases: parseFloat(e.target.value) || 0 }))}
                    style={styles.input}
                    placeholder="0"
                  />
                </div>
              </div>
              <div style={styles.field}>
                <label style={styles.fieldLabel}>VAT Credit B/F</label>
                <div style={styles.inputWrapper}>
                  <span style={styles.inputPrefix}>₦</span>
                  <input
                    type="number"
                    value={vatData.vatCreditBroughtForward || ''}
                    onChange={(e) => setVatData(prev => ({ ...prev, vatCreditBroughtForward: parseFloat(e.target.value) || 0 }))}
                    style={styles.input}
                    placeholder="0"
                  />
                </div>
              </div>
            </div>
          </div>
        );

      case 'wht':
        return (
          <div style={styles.fieldsSection}>
            <h4 style={styles.sectionTitle}>Transaction Details</h4>
            <div style={styles.fieldsGrid}>
              <div style={styles.field}>
                <label style={styles.fieldLabel}>Transaction Type</label>
                <select
                  value={whtData.transactionType}
                  onChange={(e) => setWhtData(prev => ({ ...prev, transactionType: e.target.value }))}
                  style={styles.select}
                >
                  {Object.keys(WHT_RATES).map(type => (
                    <option key={type} value={type}>
                      {type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </option>
                  ))}
                </select>
              </div>
              <div style={styles.field}>
                <label style={styles.fieldLabel}>Recipient Type</label>
                <select
                  value={whtData.recipientType}
                  onChange={(e) => setWhtData(prev => ({ ...prev, recipientType: e.target.value }))}
                  style={styles.select}
                >
                  <option value="individual">Individual</option>
                  <option value="company">Company</option>
                </select>
              </div>
              <div style={{ ...styles.field, gridColumn: '1 / -1' }}>
                <label style={styles.fieldLabel}>Gross Amount</label>
                <div style={styles.inputWrapper}>
                  <span style={styles.inputPrefix}>₦</span>
                  <input
                    type="number"
                    value={whtData.grossAmount || ''}
                    onChange={(e) => setWhtData(prev => ({ ...prev, grossAmount: parseFloat(e.target.value) || 0 }))}
                    style={styles.input}
                    placeholder="0"
                  />
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.breadcrumb}>
          <span style={styles.breadcrumbItem}>Operation</span>
          <span style={styles.breadcrumbSeparator}>&gt;</span>
          <span style={styles.breadcrumbCurrent}>Tax Calculator</span>
        </div>
        <div style={styles.headerActions}>
          <button style={styles.helpBtn}>
            <HelpCircle size={18} />
            Help
          </button>
          <button style={styles.notifBtn}>
            <Bell size={18} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div style={styles.content}>
        <div style={styles.titleRow}>
          <div>
            <h1 style={styles.pageTitle}>Tax Liability Calculator</h1>
            <p style={styles.pageSubtitle}>
              Estimate CIT, VAT, and PAYE obligations based on current Nigerian tax laws.
            </p>
          </div>
          <div style={styles.actionButtons}>
            <button style={styles.autoPopulateBtn} onClick={handleAutoPopulate}>
              <FileText size={16} />
              From Entries ({entrySummary.entryCount})
            </button>
            <button style={styles.resetBtn} onClick={handleReset}>
              <RefreshCw size={16} />
              Reset
            </button>
            <button style={styles.exportBtn} onClick={handleExportReport}>
              <Download size={16} />
              Export Report
            </button>
          </div>
        </div>

        <div style={styles.mainGrid}>
          {/* Left Column - Parameters */}
          <div style={styles.parametersCard}>
            <h3 style={styles.cardTitle}>Parameters</h3>

            {/* Tax Type */}
            <div style={styles.field}>
              <label style={styles.fieldLabel}>Tax Type</label>
              <select
                value={taxType}
                onChange={(e) => setTaxType(e.target.value)}
                style={styles.select}
              >
                <option value="paye">Personal Income Tax (PAYE)</option>
                <option value="cit">Company Income Tax (CIT)</option>
                <option value="vat">Value Added Tax (VAT)</option>
                <option value="wht">Withholding Tax (WHT)</option>
              </select>
            </div>

            {/* Fiscal Year & Company Category */}
            <div style={styles.twoColGrid}>
              <div style={styles.field}>
                <label style={styles.fieldLabel}>Fiscal Year</label>
                <select
                  value={fiscalYear}
                  onChange={(e) => setFiscalYear(parseInt(e.target.value))}
                  style={styles.select}
                >
                  {Array.from({ length: 5 }, (_, i) => currentYear - i).map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
              {taxType === 'cit' && (
                <div style={styles.field}>
                  <label style={styles.fieldLabel}>Company Category</label>
                  <select
                    value={companyCategory}
                    onChange={(e) => setCompanyCategory(e.target.value)}
                    style={styles.select}
                  >
                    <option value="small">Small Company (≤ ₦25m)</option>
                    <option value="medium">Medium Company (&gt; ₦25m)</option>
                    <option value="large">Large Company (&gt; ₦100m)</option>
                  </select>
                </div>
              )}
            </div>

            {/* Dynamic Input Fields */}
            {renderInputFields()}

            {/* Calculate Button */}
            <button
              style={styles.calculateBtn}
              onClick={handleCalculate}
              disabled={isCalculating}
            >
              <Calculator size={18} />
              {isCalculating ? 'Calculating...' : 'Calculate Tax'}
            </button>
          </div>

          {/* Right Column - Results */}
          <div style={styles.resultsCard}>
            <h3 style={styles.cardTitle}>Estimation Summary</h3>
            <p style={styles.resultSubtitle}>Based on {fiscalYear} Finance Act</p>

            {result ? (
              <div style={styles.resultsList}>
                {taxType === 'cit' && result.summary && (
                  <>
                    <div style={styles.resultItem}>
                      <span style={styles.resultLabel}>Assessable Profit</span>
                      <span style={styles.resultValue}>
                        {formatCurrency(result.calculation?.assessableProfit || result.summary.grossAmount)}
                      </span>
                    </div>
                    <div style={styles.resultItem}>
                      <span style={styles.resultLabel}>Total Reliefs</span>
                      <span style={styles.resultValueNegative}>
                        - {formatCurrency(result.summary.totalDeductions)}
                      </span>
                    </div>
                    <div style={styles.resultItem}>
                      <span style={styles.resultLabel}>Total Profit</span>
                      <span style={styles.resultValue}>
                        {formatCurrency(result.summary.taxableAmount)}
                      </span>
                    </div>
                    <div style={styles.divider}></div>
                    <div style={styles.resultItem}>
                      <span style={styles.resultLabel}>
                        CIT Rate ({result.calculation?.companyClassification?.category})
                      </span>
                      <span style={styles.resultBadge}>
                        {result.calculation?.companyClassification?.ratePercentage}
                      </span>
                    </div>
                    <div style={styles.resultItem}>
                      <span style={styles.resultLabel}>CIT Due</span>
                      <span style={styles.resultValue}>
                        {formatCurrency(result.summary.citDue)}
                      </span>
                    </div>
                    <div style={styles.resultItem}>
                      <span style={styles.resultLabel}>Education Tax (2.5%)</span>
                      <span style={styles.resultValue}>
                        {formatCurrency(result.summary.educationTax)}
                      </span>
                    </div>
                    <div style={styles.divider}></div>
                    <div style={styles.resultItemTotal}>
                      <span style={styles.resultLabelTotal}>Total Tax Liability</span>
                      <span style={styles.resultValueTotal}>
                        {formatCurrency(result.summary.totalTaxLiability || result.summary.netTaxPayable)}
                      </span>
                    </div>
                  </>
                )}

                {taxType === 'paye' && result.summary && (
                  <>
                    <div style={styles.resultItem}>
                      <span style={styles.resultLabel}>Gross Emoluments</span>
                      <span style={styles.resultValue}>
                        {formatCurrency(result.summary.grossAmount || result.summary.grossMonthlyPay * 12)}
                      </span>
                    </div>
                    <div style={styles.resultItem}>
                      <span style={styles.resultLabel}>Statutory Deductions</span>
                      <span style={styles.resultValueNegative}>
                        - {formatCurrency(result.summary.totalDeductions || result.summary.totalMonthlyDeductions * 12)}
                      </span>
                    </div>
                    <div style={styles.resultItem}>
                      <span style={styles.resultLabel}>CRA</span>
                      <span style={styles.resultValueNegative}>
                        - {formatCurrency(result.summary.totalReliefs || result.calculation?.consolidatedReliefAllowance?.total)}
                      </span>
                    </div>
                    <div style={styles.resultItem}>
                      <span style={styles.resultLabel}>Taxable Income</span>
                      <span style={styles.resultValue}>
                        {formatCurrency(result.summary.taxableAmount || result.calculation?.taxableIncome)}
                      </span>
                    </div>
                    <div style={styles.divider}></div>
                    <div style={styles.resultItemTotal}>
                      <span style={styles.resultLabelTotal}>Annual PAYE Due</span>
                      <span style={styles.resultValueTotal}>
                        {formatCurrency(result.summary.taxDue || result.summary.annualPAYE)}
                      </span>
                    </div>
                    <div style={styles.resultItem}>
                      <span style={styles.resultLabel}>Monthly PAYE</span>
                      <span style={styles.resultValue}>
                        {formatCurrency((result.summary.taxDue || result.summary.annualPAYE || 0) / 12)}
                      </span>
                    </div>
                  </>
                )}

                {taxType === 'vat' && result.summary && (
                  <>
                    <div style={styles.resultItem}>
                      <span style={styles.resultLabel}>Output VAT</span>
                      <span style={styles.resultValue}>
                        {formatCurrency(result.summary.outputVAT)}
                      </span>
                    </div>
                    <div style={styles.resultItem}>
                      <span style={styles.resultLabel}>Input VAT</span>
                      <span style={styles.resultValueNegative}>
                        - {formatCurrency(result.summary.inputVAT)}
                      </span>
                    </div>
                    <div style={styles.resultItem}>
                      <span style={styles.resultLabel}>VAT Credit B/F</span>
                      <span style={styles.resultValueNegative}>
                        - {formatCurrency(result.summary.vatCreditBroughtForward)}
                      </span>
                    </div>
                    <div style={styles.divider}></div>
                    <div style={styles.resultItemTotal}>
                      <span style={styles.resultLabelTotal}>VAT Payable</span>
                      <span style={styles.resultValueTotal}>
                        {formatCurrency(result.summary.vatPayable)}
                      </span>
                    </div>
                  </>
                )}

                {taxType === 'wht' && result.summary && (
                  <>
                    <div style={styles.resultItem}>
                      <span style={styles.resultLabel}>Gross Amount</span>
                      <span style={styles.resultValue}>
                        {formatCurrency(result.summary.grossAmount)}
                      </span>
                    </div>
                    <div style={styles.resultItem}>
                      <span style={styles.resultLabel}>WHT Rate</span>
                      <span style={styles.resultBadge}>{result.summary.whtRate}</span>
                    </div>
                    <div style={styles.divider}></div>
                    <div style={styles.resultItemTotal}>
                      <span style={styles.resultLabelTotal}>WHT Amount</span>
                      <span style={styles.resultValueTotal}>
                        {formatCurrency(result.summary.whtAmount)}
                      </span>
                    </div>
                    <div style={styles.resultItem}>
                      <span style={styles.resultLabel}>Net Amount</span>
                      <span style={styles.resultValue}>
                        {formatCurrency(result.summary.netAmount)}
                      </span>
                    </div>
                  </>
                )}

                {/* Info Note */}
                <div style={styles.infoNote}>
                  <Info size={16} />
                  <span>This is an estimate. Consult a tax professional for official filings.</span>
                </div>

                {/* Save Button */}
                <button style={styles.saveBtn} onClick={handleSaveCalculation}>
                  <Save size={16} />
                  Save to History
                </button>
              </div>
            ) : (
              <div style={styles.emptyResult}>
                <Calculator size={48} color="#30363D" />
                <p>Enter values and click Calculate to see results</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#0D1117',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 32px',
    borderBottom: '1px solid #21262D',
  },
  breadcrumb: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
  },
  breadcrumbItem: {
    color: '#8B949E',
  },
  breadcrumbSeparator: {
    color: '#6E7681',
  },
  breadcrumbCurrent: {
    color: '#E6EDF3',
    fontWeight: '500',
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  helpBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 12px',
    backgroundColor: 'transparent',
    border: 'none',
    color: '#8B949E',
    fontSize: '14px',
    cursor: 'pointer',
  },
  notifBtn: {
    padding: '8px',
    backgroundColor: 'transparent',
    border: 'none',
    color: '#8B949E',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    overflow: 'auto',
    padding: '24px 32px',
  },
  titleRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '24px',
  },
  pageTitle: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#E6EDF3',
    marginBottom: '8px',
  },
  pageSubtitle: {
    fontSize: '15px',
    color: '#8B949E',
    margin: 0,
  },
  actionButtons: {
    display: 'flex',
    gap: '12px',
  },
  autoPopulateBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 16px',
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    border: '1px solid #22C55E',
    borderRadius: '8px',
    color: '#22C55E',
    fontSize: '14px',
    cursor: 'pointer',
  },
  resetBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 16px',
    backgroundColor: 'transparent',
    border: '1px solid #30363D',
    borderRadius: '8px',
    color: '#E6EDF3',
    fontSize: '14px',
    cursor: 'pointer',
  },
  exportBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 16px',
    backgroundColor: '#2563EB',
    border: 'none',
    borderRadius: '8px',
    color: '#FFFFFF',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
  },
  mainGrid: {
    display: 'grid',
    gridTemplateColumns: '1.5fr 1fr',
    gap: '24px',
  },
  parametersCard: {
    backgroundColor: '#161B22',
    border: '1px solid #30363D',
    borderRadius: '12px',
    padding: '24px',
  },
  resultsCard: {
    backgroundColor: '#161B22',
    border: '1px solid #30363D',
    borderRadius: '12px',
    padding: '24px',
    position: 'sticky',
    top: '24px',
    alignSelf: 'start',
  },
  cardTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#E6EDF3',
    marginBottom: '20px',
  },
  fieldsSection: {
    marginTop: '20px',
  },
  sectionTitle: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#8B949E',
    marginBottom: '16px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  field: {
    marginBottom: '16px',
  },
  fieldLabel: {
    display: 'block',
    fontSize: '14px',
    fontWeight: '500',
    color: '#E6EDF3',
    marginBottom: '8px',
  },
  inputWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  inputPrefix: {
    position: 'absolute',
    left: '14px',
    color: '#6E7681',
    fontSize: '14px',
  },
  input: {
    width: '100%',
    padding: '12px 14px 12px 32px',
    backgroundColor: '#0D1117',
    border: '1px solid #30363D',
    borderRadius: '8px',
    color: '#E6EDF3',
    fontSize: '14px',
    outline: 'none',
  },
  select: {
    width: '100%',
    padding: '12px 14px',
    backgroundColor: '#0D1117',
    border: '1px solid #30363D',
    borderRadius: '8px',
    color: '#E6EDF3',
    fontSize: '14px',
    outline: 'none',
    cursor: 'pointer',
  },
  twoColGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
    marginBottom: '8px',
  },
  fieldsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
  },
  calculateBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    width: '100%',
    padding: '14px',
    backgroundColor: '#2563EB',
    border: 'none',
    borderRadius: '8px',
    color: '#FFFFFF',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    marginTop: '24px',
  },
  resultSubtitle: {
    fontSize: '13px',
    color: '#8B949E',
    marginTop: '-12px',
    marginBottom: '24px',
  },
  resultsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  resultItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resultLabel: {
    fontSize: '14px',
    color: '#8B949E',
  },
  resultValue: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#E6EDF3',
  },
  resultValueNegative: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#EF4444',
  },
  resultBadge: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#2563EB',
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
    padding: '4px 10px',
    borderRadius: '6px',
  },
  divider: {
    height: '1px',
    backgroundColor: '#30363D',
    margin: '8px 0',
  },
  resultItemTotal: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px',
    backgroundColor: '#0D1117',
    borderRadius: '8px',
    marginTop: '8px',
  },
  resultLabelTotal: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#E6EDF3',
  },
  resultValueTotal: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#22C55E',
  },
  infoNote: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    fontSize: '12px',
    color: '#8B949E',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    padding: '12px',
    borderRadius: '8px',
    marginTop: '8px',
  },
  saveBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    width: '100%',
    padding: '12px',
    backgroundColor: 'transparent',
    border: '1px solid #30363D',
    borderRadius: '8px',
    color: '#E6EDF3',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    marginTop: '8px',
  },
  emptyResult: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 24px',
    color: '#6E7681',
    textAlign: 'center',
  },
};

export default TaxCalculator;
