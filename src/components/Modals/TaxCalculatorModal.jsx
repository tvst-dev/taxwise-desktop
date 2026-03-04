import React, { useState } from 'react';
import { X, Calculator, ChevronDown, Download, RefreshCw } from 'lucide-react';
import { useUIStore, useTaxStore, useAuthStore } from '../../store';
import { createTaxCalculation } from '../../services/supabase';
import TaxCalculator from '../../services/taxCalculator';
import toast from 'react-hot-toast';

const TaxCalculatorModal = () => {
  const { activeModal, closeModal } = useUIStore();
  const { addCalculation } = useTaxStore();
  const { organization } = useAuthStore();

  const [taxType, setTaxType] = useState('paye');
  const [fiscalYear, setFiscalYear] = useState('2024');
  const [isCalculating, setIsCalculating] = useState(false);
  const [result, setResult] = useState(null);

  // PAYE specific fields
  const [payeData, setPayeData] = useState({
    grossIncome: '',
    pension: '',
    nhf: '',
    nhis: '',
    lifeAssurance: '',
    calculationPeriod: 'annual'
  });

  // CIT specific fields
  const [citData, setCitData] = useState({
    turnover: '',
    assessableProfit: '',
    capitalAllowances: ''
  });

  // VAT specific fields
  const [vatData, setVatData] = useState({
    vatableSales: '',
    inputVAT: ''
  });

  // WHT specific fields
  const [whtData, setWhtData] = useState({
    transactionAmount: '',
    transactionType: 'professional_services',
    isCompany: false
  });

  const isOpen = activeModal === 'taxCalculator';

  const taxTypes = [
    { id: 'paye', name: 'Personal Income Tax (PAYE)' },
    { id: 'cit', name: 'Company Income Tax (CIT)' },
    { id: 'vat', name: 'Value Added Tax (VAT)' },
    { id: 'wht', name: 'Withholding Tax (WHT)' },
    { id: 'cgt', name: 'Capital Gains Tax (CGT)' }
  ];

  const whtTypes = [
    { id: 'dividends', name: 'Dividends' },
    { id: 'interest', name: 'Interest' },
    { id: 'rent', name: 'Rent' },
    { id: 'royalties', name: 'Royalties' },
    { id: 'professional_services', name: 'Professional Services' },
    { id: 'contracts', name: 'Contracts' },
    { id: 'commissions', name: 'Commissions' }
  ];

  const formatNumber = (value) => {
    const num = value.replace(/[^0-9]/g, '');
    return num.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  const parseNumber = (value) => {
    return parseFloat(value.replace(/,/g, '')) || 0;
  };

  const handleCalculate = () => {
    setIsCalculating(true);
    setResult(null);

    try {
      let calculationResult;

      switch (taxType) {
        case 'paye':
          if (payeData.calculationPeriod === 'monthly') {
            // Annualize monthly inputs, then divide results by 12
            const monthlyGross = parseNumber(payeData.grossIncome);
            const annualResult = TaxCalculator.calculatePAYE({
              grossEmoluments: monthlyGross * 12,
              pensionContribution: parseNumber(payeData.pension) * 12,
              nhfContribution: parseNumber(payeData.nhf) * 12,
              nhisContribution: parseNumber(payeData.nhis) * 12,
              lifeAssurancePremium: parseNumber(payeData.lifeAssurance) * 12
            });
            calculationResult = {
              ...annualResult,
              _isMonthly: true,
              summary: {
                ...annualResult.summary,
                grossAmount: monthlyGross,
                taxableAmount: annualResult.summary.taxableAmount / 12,
                totalDeductions: annualResult.summary.totalDeductions / 12,
                totalReliefs: annualResult.summary.totalReliefs / 12,
                taxDue: annualResult.summary.taxDue / 12,
                netTaxPayable: annualResult.summary.netTaxPayable / 12
              }
            };
          } else {
            calculationResult = TaxCalculator.calculatePAYE({
              grossEmoluments: parseNumber(payeData.grossIncome),
              pensionContribution: parseNumber(payeData.pension),
              nhfContribution: parseNumber(payeData.nhf),
              nhisContribution: parseNumber(payeData.nhis),
              lifeAssurancePremium: parseNumber(payeData.lifeAssurance)
            });
          }
          break;

        case 'cit':
          // assessableProfit = profit before capital allowances; service deducts capitalAllowances
          calculationResult = TaxCalculator.calculateCIT({
            totalRevenue: parseNumber(citData.assessableProfit),
            allowableExpenses: 0,
            capitalAllowances: parseNumber(citData.capitalAllowances),
            annualTurnover: parseNumber(citData.turnover)
          });
          break;

        case 'vat':
          // inputVAT field holds the VAT credit amount; back-calculate vatablePurchases
          calculationResult = TaxCalculator.calculateVAT({
            vatableSales: parseNumber(vatData.vatableSales),
            vatablePurchases: parseNumber(vatData.inputVAT) / 0.075
          });
          break;

        case 'wht':
          calculationResult = TaxCalculator.calculateWHT({
            grossAmount: parseNumber(whtData.transactionAmount),
            transactionType: whtData.transactionType,
            recipientType: whtData.isCompany ? 'company' : 'individual'
          });
          break;

        default:
          calculationResult = { error: 'Unknown tax type' };
      }

      setResult(calculationResult);
    } catch (error) {
      console.error('Calculation error:', error);
      setResult({ error: error.message });
    } finally {
      setIsCalculating(false);
    }
  };

  const handleSave = async () => {
    if (!result) return;

    const netTaxPayable = result.summary?.netTaxPayable || 0;
    const inputData = taxType === 'paye' ? payeData
      : taxType === 'cit' ? citData
      : taxType === 'vat' ? vatData
      : whtData;

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
      addCalculation(localCalc);
      toast.success('Calculation saved locally');
    }
  };

  const handleReset = () => {
    setResult(null);
    setPayeData({
      grossIncome: '',
      pension: '',
      nhf: '',
      nhis: '',
      lifeAssurance: '',
      calculationPeriod: 'annual'
    });
    setCitData({
      turnover: '',
      assessableProfit: '',
      capitalAllowances: ''
    });
    setVatData({
      vatableSales: '',
      inputVAT: ''
    });
    setWhtData({
      transactionAmount: '',
      transactionType: 'professional_services',
      isCompany: false
    });
  };

  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return '₦0.00';
    return `₦${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const renderResult = () => {
    if (!result || result.error) return null;
    const s = result.summary;
    const period = result._isMonthly ? '/month' : '';

    if (taxType === 'paye') {
      return (
        <div style={styles.resultGrid}>
          <div style={styles.resultItem}>
            <span style={styles.resultLabel}>Gross Income{period}</span>
            <span style={styles.resultValue}>{formatCurrency(s.grossAmount)}</span>
          </div>
          <div style={styles.resultItem}>
            <span style={styles.resultLabel}>Total Reliefs (CRA){period}</span>
            <span style={styles.resultValue}>{formatCurrency(s.totalReliefs)}</span>
          </div>
          <div style={styles.resultItem}>
            <span style={styles.resultLabel}>Taxable Income{period}</span>
            <span style={styles.resultValue}>{formatCurrency(s.taxableAmount)}</span>
          </div>
          <div style={styles.resultItem}>
            <span style={styles.resultLabel}>Effective Rate</span>
            <span style={styles.resultValue}>{s.effectiveTaxRate}</span>
          </div>
          <div style={{ ...styles.resultItem, gridColumn: '1 / -1' }}>
            <span style={styles.resultLabel}>PAYE Tax Due{period}</span>
            <span style={{ ...styles.resultValue, color: '#EF4444', fontSize: '22px' }}>
              {formatCurrency(s.taxDue)}
            </span>
          </div>
        </div>
      );
    }

    if (taxType === 'cit') {
      return (
        <div style={styles.resultGrid}>
          <div style={styles.resultItem}>
            <span style={styles.resultLabel}>Assessable Profit</span>
            <span style={styles.resultValue}>{formatCurrency(s.taxableAmount)}</span>
          </div>
          <div style={styles.resultItem}>
            <span style={styles.resultLabel}>Effective Rate</span>
            <span style={styles.resultValue}>{s.effectiveTaxRate}</span>
          </div>
          <div style={styles.resultItem}>
            <span style={styles.resultLabel}>CIT Due</span>
            <span style={{ ...styles.resultValue, color: '#EF4444' }}>{formatCurrency(s.citDue)}</span>
          </div>
          <div style={styles.resultItem}>
            <span style={styles.resultLabel}>TETFund Levy (Education Tax — 2.5%)</span>
            <span style={{ ...styles.resultValue, color: '#F59E0B' }}>{formatCurrency(s.educationTax)}</span>
          </div>
          <div style={{ ...styles.resultItem, gridColumn: '1 / -1' }}>
            <span style={styles.resultLabel}>Total Tax Liability (CIT + TETFund)</span>
            <span style={{ ...styles.resultValue, color: '#EF4444', fontSize: '22px' }}>
              {formatCurrency(s.totalTaxLiability)}
            </span>
          </div>
        </div>
      );
    }

    if (taxType === 'vat') {
      return (
        <div style={styles.resultGrid}>
          <div style={styles.resultItem}>
            <span style={styles.resultLabel}>Output VAT (7.5% of sales)</span>
            <span style={styles.resultValue}>{formatCurrency(s.outputVAT)}</span>
          </div>
          <div style={styles.resultItem}>
            <span style={styles.resultLabel}>Input VAT Credit</span>
            <span style={styles.resultValue}>{formatCurrency(s.inputVAT)}</span>
          </div>
          <div style={{ ...styles.resultItem, gridColumn: '1 / -1' }}>
            <span style={styles.resultLabel}>VAT Payable</span>
            <span style={{ ...styles.resultValue, color: '#EF4444', fontSize: '22px' }}>
              {formatCurrency(s.vatPayable)}
            </span>
          </div>
        </div>
      );
    }

    if (taxType === 'wht') {
      return (
        <div style={styles.resultGrid}>
          <div style={styles.resultItem}>
            <span style={styles.resultLabel}>Transaction Amount</span>
            <span style={styles.resultValue}>{formatCurrency(s.grossAmount)}</span>
          </div>
          <div style={styles.resultItem}>
            <span style={styles.resultLabel}>WHT Rate</span>
            <span style={styles.resultValue}>{s.whtRate}</span>
          </div>
          <div style={styles.resultItem}>
            <span style={styles.resultLabel}>WHT Amount</span>
            <span style={{ ...styles.resultValue, color: '#EF4444' }}>{formatCurrency(s.whtAmount)}</span>
          </div>
          <div style={styles.resultItem}>
            <span style={styles.resultLabel}>Net Amount to Recipient</span>
            <span style={styles.resultValue}>{formatCurrency(s.netAmount)}</span>
          </div>
        </div>
      );
    }

    return null;
  };

  if (!isOpen) return null;

  return (
    <div style={styles.overlay} onClick={closeModal}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerTitle}>
            <Calculator size={20} />
            <h2 style={styles.title}>Quick Tax Calculator</h2>
          </div>
          <button style={styles.closeButton} onClick={closeModal}>
            <X size={20} />
          </button>
        </div>

        <div style={styles.content}>
          {/* Tax Type Selection */}
          <div style={styles.formGroup}>
            <label style={styles.label}>Tax Type</label>
            <div style={styles.selectWrapper}>
              <select
                value={taxType}
                onChange={(e) => {
                  setTaxType(e.target.value);
                  setResult(null);
                }}
                style={styles.select}
              >
                {taxTypes.map((type) => (
                  <option key={type.id} value={type.id}>{type.name}</option>
                ))}
              </select>
              <ChevronDown size={16} style={styles.selectIcon} />
            </div>
          </div>

          {/* PAYE Fields */}
          {taxType === 'paye' && (
            <>
              <div style={styles.row}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Calculation Period</label>
                  <div style={styles.selectWrapper}>
                    <select
                      value={payeData.calculationPeriod}
                      onChange={(e) => setPayeData({ ...payeData, calculationPeriod: e.target.value })}
                      style={styles.select}
                    >
                      <option value="annual">Annual</option>
                      <option value="monthly">Monthly</option>
                    </select>
                    <ChevronDown size={16} style={styles.selectIcon} />
                  </div>
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    Gross Income (₦{payeData.calculationPeriod === 'monthly' ? '/month' : '/year'})
                  </label>
                  <input
                    type="text"
                    value={payeData.grossIncome}
                    onChange={(e) => setPayeData({ ...payeData, grossIncome: formatNumber(e.target.value) })}
                    placeholder="0"
                    style={styles.input}
                  />
                </div>
              </div>
              <div style={styles.row}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Pension (₦)</label>
                  <input
                    type="text"
                    value={payeData.pension}
                    onChange={(e) => setPayeData({ ...payeData, pension: formatNumber(e.target.value) })}
                    placeholder="0"
                    style={styles.input}
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>NHF (₦)</label>
                  <input
                    type="text"
                    value={payeData.nhf}
                    onChange={(e) => setPayeData({ ...payeData, nhf: formatNumber(e.target.value) })}
                    placeholder="0"
                    style={styles.input}
                  />
                </div>
              </div>
              <div style={styles.row}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>NHIS (₦)</label>
                  <input
                    type="text"
                    value={payeData.nhis}
                    onChange={(e) => setPayeData({ ...payeData, nhis: formatNumber(e.target.value) })}
                    placeholder="0"
                    style={styles.input}
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Life Assurance (₦)</label>
                  <input
                    type="text"
                    value={payeData.lifeAssurance}
                    onChange={(e) => setPayeData({ ...payeData, lifeAssurance: formatNumber(e.target.value) })}
                    placeholder="0"
                    style={styles.input}
                  />
                </div>
              </div>
            </>
          )}

          {/* CIT Fields */}
          {taxType === 'cit' && (
            <>
              <div style={styles.formGroup}>
                <label style={styles.label}>Annual Turnover (₦)</label>
                <input
                  type="text"
                  value={citData.turnover}
                  onChange={(e) => setCitData({ ...citData, turnover: formatNumber(e.target.value) })}
                  placeholder="0"
                  style={styles.input}
                />
                <span style={styles.helpText}>
                  Determines rate: Small ≤₦25M (0%), Medium ₦25M–₦100M (20%), Large &gt;₦100M (30%)
                </span>
              </div>
              <div style={styles.row}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Assessable Profit (₦)</label>
                  <input
                    type="text"
                    value={citData.assessableProfit}
                    onChange={(e) => setCitData({ ...citData, assessableProfit: formatNumber(e.target.value) })}
                    placeholder="0"
                    style={styles.input}
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Capital Allowances (₦)</label>
                  <input
                    type="text"
                    value={citData.capitalAllowances}
                    onChange={(e) => setCitData({ ...citData, capitalAllowances: formatNumber(e.target.value) })}
                    placeholder="0"
                    style={styles.input}
                  />
                </div>
              </div>
            </>
          )}

          {/* VAT Fields */}
          {taxType === 'vat' && (
            <div style={styles.row}>
              <div style={styles.formGroup}>
                <label style={styles.label}>VATable Sales (₦)</label>
                <input
                  type="text"
                  value={vatData.vatableSales}
                  onChange={(e) => setVatData({ ...vatData, vatableSales: formatNumber(e.target.value) })}
                  placeholder="0"
                  style={styles.input}
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Input VAT Credit (₦)</label>
                <input
                  type="text"
                  value={vatData.inputVAT}
                  onChange={(e) => setVatData({ ...vatData, inputVAT: formatNumber(e.target.value) })}
                  placeholder="0"
                  style={styles.input}
                />
              </div>
            </div>
          )}

          {/* WHT Fields */}
          {taxType === 'wht' && (
            <>
              <div style={styles.row}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Transaction Amount (₦)</label>
                  <input
                    type="text"
                    value={whtData.transactionAmount}
                    onChange={(e) => setWhtData({ ...whtData, transactionAmount: formatNumber(e.target.value) })}
                    placeholder="0"
                    style={styles.input}
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Transaction Type</label>
                  <div style={styles.selectWrapper}>
                    <select
                      value={whtData.transactionType}
                      onChange={(e) => setWhtData({ ...whtData, transactionType: e.target.value })}
                      style={styles.select}
                    >
                      {whtTypes.map((type) => (
                        <option key={type.id} value={type.id}>{type.name}</option>
                      ))}
                    </select>
                    <ChevronDown size={16} style={styles.selectIcon} />
                  </div>
                </div>
              </div>
              <div style={styles.formGroup}>
                <label style={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={whtData.isCompany}
                    onChange={(e) => setWhtData({ ...whtData, isCompany: e.target.checked })}
                    style={styles.checkbox}
                  />
                  <span>Recipient is a Company</span>
                </label>
              </div>
            </>
          )}

          {/* Calculate Button */}
          <div style={styles.actions}>
            <button style={styles.resetButton} onClick={handleReset} type="button">
              <RefreshCw size={16} />
              <span>Reset</span>
            </button>
            <button
              style={styles.calculateButton}
              onClick={handleCalculate}
              disabled={isCalculating}
            >
              <Calculator size={16} />
              <span>{isCalculating ? 'Calculating...' : 'Calculate'}</span>
            </button>
          </div>

          {/* Result */}
          {result && !result.error && (
            <div style={styles.resultCard}>
              <h3 style={styles.resultTitle}>
                Calculation Result{result._isMonthly ? ' (Monthly)' : ''}
              </h3>
              {renderResult()}
              <button style={styles.saveButton} onClick={handleSave}>
                <Download size={16} />
                <span>Save to History</span>
              </button>
            </div>
          )}

          {result?.error && (
            <div style={styles.errorCard}>
              <span style={styles.errorText}>{result.error}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    zIndex: 9000,
    overflowY: 'auto',
    padding: '40px 20px'
  },
  modal: {
    width: '100%',
    maxWidth: '600px',
    backgroundColor: '#161B22',
    borderRadius: '16px',
    border: '1px solid #30363D',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 24px',
    borderBottom: '1px solid #30363D'
  },
  headerTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    color: '#E6EDF3'
  },
  title: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#E6EDF3',
    margin: 0
  },
  closeButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '32px',
    backgroundColor: 'transparent',
    border: 'none',
    color: '#8B949E',
    cursor: 'pointer',
    borderRadius: '6px'
  },
  content: {
    padding: '24px',
    overflowY: 'auto'
  },
  formGroup: {
    marginBottom: '16px'
  },
  label: {
    display: 'block',
    fontSize: '13px',
    fontWeight: '500',
    color: '#8B949E',
    marginBottom: '8px'
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px'
  },
  input: {
    width: '100%',
    padding: '12px 16px',
    backgroundColor: '#0D1117',
    border: '1px solid #30363D',
    borderRadius: '8px',
    color: '#E6EDF3',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box'
  },
  selectWrapper: {
    position: 'relative'
  },
  select: {
    width: '100%',
    padding: '12px 16px',
    paddingRight: '40px',
    backgroundColor: '#0D1117',
    border: '1px solid #30363D',
    borderRadius: '8px',
    color: '#E6EDF3',
    fontSize: '14px',
    outline: 'none',
    cursor: 'pointer',
    appearance: 'none',
    boxSizing: 'border-box'
  },
  selectIcon: {
    position: 'absolute',
    right: '12px',
    top: '50%',
    transform: 'translateY(-50%)',
    color: '#8B949E',
    pointerEvents: 'none'
  },
  helpText: {
    display: 'block',
    fontSize: '12px',
    color: '#6E7681',
    marginTop: '6px'
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    color: '#E6EDF3',
    fontSize: '14px',
    cursor: 'pointer'
  },
  checkbox: {
    width: '18px',
    height: '18px',
    accentColor: '#2563EB',
    cursor: 'pointer'
  },
  actions: {
    display: 'flex',
    gap: '12px',
    marginTop: '24px'
  },
  resetButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '14px 24px',
    backgroundColor: 'transparent',
    border: '1px solid #30363D',
    borderRadius: '8px',
    color: '#8B949E',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer'
  },
  calculateButton: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '14px',
    backgroundColor: '#2563EB',
    border: 'none',
    borderRadius: '8px',
    color: 'white',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer'
  },
  resultCard: {
    marginTop: '24px',
    padding: '20px',
    backgroundColor: '#0D1117',
    border: '1px solid #22C55E',
    borderRadius: '12px'
  },
  resultTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#22C55E',
    margin: '0 0 16px 0'
  },
  resultGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
    marginBottom: '16px'
  },
  resultItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  resultLabel: {
    fontSize: '12px',
    color: '#8B949E'
  },
  resultValue: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#E6EDF3'
  },
  saveButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    width: '100%',
    padding: '12px',
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    border: '1px solid rgba(34, 197, 94, 0.3)',
    borderRadius: '8px',
    color: '#22C55E',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer'
  },
  errorCard: {
    marginTop: '24px',
    padding: '16px',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: '8px'
  },
  errorText: {
    color: '#EF4444',
    fontSize: '14px'
  }
};

export default TaxCalculatorModal;
