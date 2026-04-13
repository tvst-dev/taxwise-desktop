/**
 * Nigerian Tax Calculator Service
 * Compliant with FIRS regulations and Nigerian tax laws as of 2026
 * 
 * Supported Tax Types:
 * 1. Personal Income Tax (PAYE)
 * 2. Company Income Tax (CIT)
 * 3. Value Added Tax (VAT)
 * 4. Withholding Tax (WHT)
 * 5. Capital Gains Tax (CGT)
 * 6. Education Tax
 */

// ==================== CONSTANTS ====================

export const TAX_TYPES = {
  PAYE: 'paye',
  CIT: 'cit',
  VAT: 'vat',
  WHT: 'wht',
  CGT: 'cgt',
  EDUCATION_TAX: 'education_tax'
};

export const ENTITY_TYPES = {
  INDIVIDUAL: 'individual',
  SME: 'sme',
  LARGE_CORPORATION: 'large_corporation'
};

// PAYE Tax Bands (Nigerian Personal Income Tax)
export const PAYE_TAX_BANDS = [
  { min: 0, max: 300000, rate: 0.07 },           // First ₦300,000 → 7%
  { min: 300000, max: 600000, rate: 0.11 },      // Next ₦300,000 → 11%
  { min: 600000, max: 1100000, rate: 0.15 },     // Next ₦500,000 → 15%
  { min: 1100000, max: 1600000, rate: 0.19 },    // Next ₦500,000 → 19%
  { min: 1600000, max: 3200000, rate: 0.21 },    // Next ₦1,600,000 → 21%
  { min: 3200000, max: Infinity, rate: 0.24 }    // Above ₦3,200,000 → 24%
];

// CIT Rates based on company turnover
export const CIT_RATES = {
  SMALL: { maxTurnover: 25000000, rate: 0 },           // ≤ ₦25m → 0%
  MEDIUM: { maxTurnover: 100000000, rate: 0.20 },      // ₦25m – ₦100m → 20%
  LARGE: { minTurnover: 100000000, rate: 0.30 }        // > ₦100m → 30%
};

// VAT Rate
export const VAT_RATE = 0.075; // 7.5%

// WHT Rates by transaction type
export const WHT_RATES = {
  rent: { individual: 0.10, company: 0.10 },
  interest: { individual: 0.10, company: 0.10 },
  dividends: { individual: 0.10, company: 0.10 },
  royalties: { individual: 0.10, company: 0.10 },
  professional_services: { individual: 0.05, company: 0.10 },
  contracts: { individual: 0.05, company: 0.05 },
  consultancy: { individual: 0.05, company: 0.10 },
  management_fees: { individual: 0.10, company: 0.10 },
  technical_services: { individual: 0.10, company: 0.10 },
  commission: { individual: 0.10, company: 0.10 },
  directors_fees: { individual: 0.10, company: 0.10 },
  hire_of_equipment: { individual: 0.10, company: 0.10 }
};

// CGT Rate
export const CGT_RATE = 0.10; // 10%

// Education Tax Rate
export const EDUCATION_TAX_RATE = 0.025; // 2.5%

// CRA Constants
export const CRA_MINIMUM = 200000; // ₦200,000
export const CRA_PERCENTAGE_OF_GROSS = 0.01; // 1%
export const CRA_ADDITIONAL_PERCENTAGE = 0.20; // 20%

// ==================== PAYE CALCULATOR ====================

/**
 * Calculate Personal Income Tax (PAYE)
 * Applicable only to INDIVIDUALS and EMPLOYEES
 * 
 * @param {Object} params
 * @param {number} params.grossEmoluments - Total gross income (salary, wages, allowances, bonuses, benefits)
 * @param {number} params.pensionContribution - Employee pension contribution
 * @param {number} params.nhfContribution - National Housing Fund contribution
 * @param {number} params.nhisContribution - National Health Insurance contribution
 * @param {number} params.lifeAssurancePremium - Life assurance premium
 * @returns {Object} Detailed PAYE calculation breakdown
 */
export function calculatePAYE(params) {
  const {
    grossEmoluments = 0,
    pensionContribution = 0,
    nhfContribution = 0,
    nhisContribution = 0,
    lifeAssurancePremium = 0
  } = params;

  // Validate entity type
  if (params.entityType && params.entityType !== ENTITY_TYPES.INDIVIDUAL) {
    throw new Error('PAYE is only applicable to individuals. Use CIT for companies.');
  }

  // Step 1: Calculate total statutory deductions
  const totalStatutoryDeductions = 
    pensionContribution + 
    nhfContribution + 
    nhisContribution + 
    lifeAssurancePremium;

  // Step 2: Calculate Adjusted Income
  const adjustedIncome = grossEmoluments - totalStatutoryDeductions;

  // Step 3: Calculate Consolidated Relief Allowance (CRA)
  // CRA = MAX(₦200,000, 1% of Gross) + 20% of Gross
  const craFirstPart = Math.max(CRA_MINIMUM, grossEmoluments * CRA_PERCENTAGE_OF_GROSS);
  const craSecondPart = grossEmoluments * CRA_ADDITIONAL_PERCENTAGE;
  const totalCRA = craFirstPart + craSecondPart;

  // Step 4: Calculate Taxable Income
  const taxableIncome = Math.max(0, adjustedIncome - totalCRA);

  // Step 5: Apply Progressive Tax Rates
  let taxDue = 0;
  let remainingIncome = taxableIncome;
  const taxBandBreakdown = [];

  for (const band of PAYE_TAX_BANDS) {
    if (remainingIncome <= 0) break;

    const bandWidth = band.max === Infinity 
      ? remainingIncome 
      : Math.min(band.max - band.min, remainingIncome);
    
    const taxInBand = bandWidth * band.rate;
    taxDue += taxInBand;
    
    taxBandBreakdown.push({
      band: `₦${band.min.toLocaleString()} - ${band.max === Infinity ? 'Above' : '₦' + band.max.toLocaleString()}`,
      rate: `${(band.rate * 100).toFixed(0)}%`,
      taxableAmount: bandWidth,
      taxAmount: taxInBand
    });

    remainingIncome -= bandWidth;
  }

  // Calculate effective tax rate
  const effectiveTaxRate = grossEmoluments > 0 
    ? (taxDue / grossEmoluments) * 100 
    : 0;

  return {
    taxType: TAX_TYPES.PAYE,
    input: {
      grossEmoluments,
      pensionContribution,
      nhfContribution,
      nhisContribution,
      lifeAssurancePremium
    },
    calculation: {
      grossEmoluments,
      statutoryDeductions: {
        pension: pensionContribution,
        nhf: nhfContribution,
        nhis: nhisContribution,
        lifeAssurance: lifeAssurancePremium,
        total: totalStatutoryDeductions
      },
      adjustedIncome,
      consolidatedReliefAllowance: {
        firstPart: craFirstPart,
        firstPartFormula: `MAX(₦200,000, 1% × ₦${grossEmoluments.toLocaleString()})`,
        secondPart: craSecondPart,
        secondPartFormula: `20% × ₦${grossEmoluments.toLocaleString()}`,
        total: totalCRA
      },
      taxableIncome,
      taxBandBreakdown
    },
    summary: {
      grossAmount: grossEmoluments,
      totalDeductions: totalStatutoryDeductions,
      totalReliefs: totalCRA,
      taxableAmount: taxableIncome,
      taxDue,
      effectiveTaxRate: `${effectiveTaxRate.toFixed(2)}%`,
      netTaxPayable: taxDue
    }
  };
}

// ==================== CIT CALCULATOR ====================

/**
 * Calculate Company Income Tax (CIT)
 * Applicable to SMEs and Large Corporations
 * 
 * @param {Object} params
 * @param {number} params.totalRevenue - Total company revenue
 * @param {number} params.allowableExpenses - Allowable business expenses
 * @param {number} params.nonAllowableExpenses - Non-allowable expenses to add back
 * @param {number} params.capitalAllowances - Capital allowances to deduct
 * @param {number} params.annualTurnover - Annual turnover for rate determination
 * @returns {Object} Detailed CIT calculation breakdown
 */
export function calculateCIT(params) {
  const {
    totalRevenue = 0,
    allowableExpenses = 0,
    nonAllowableExpenses = 0,
    capitalAllowances = 0,
    annualTurnover = 0
  } = params;

  // Validate entity type
  if (params.entityType === ENTITY_TYPES.INDIVIDUAL) {
    throw new Error('CIT is not applicable to individuals. Use PAYE for personal income tax.');
  }

  // Step 1: Calculate Accounting Profit
  const accountingProfit = totalRevenue - allowableExpenses;

  // Step 2: Adjust for Tax Purposes
  const adjustedProfit = accountingProfit + nonAllowableExpenses;

  // Step 3a: Assessable Profit — BEFORE capital allowances (base for TETFund per CITA/FIRS)
  const assessableProfit = Math.max(0, adjustedProfit);

  // Step 3b: Chargeable Profit — AFTER capital allowances (base for CIT)
  const chargeableProfit = Math.max(0, adjustedProfit - capitalAllowances);

  // Step 4: Determine Company Category and CIT Rate
  let companyCategory;
  let citRate;
  let citRateExplanation;

  const turnoverForRate = annualTurnover || totalRevenue;

  if (turnoverForRate <= CIT_RATES.SMALL.maxTurnover) {
    companyCategory = 'Small Company';
    citRate = CIT_RATES.SMALL.rate;
    citRateExplanation = `Turnover ≤ ₦25m: 0% CIT`;
  } else if (turnoverForRate <= CIT_RATES.MEDIUM.maxTurnover) {
    companyCategory = 'Medium Company';
    citRate = CIT_RATES.MEDIUM.rate;
    citRateExplanation = `Turnover ₦25m - ₦100m: 20% CIT`;
  } else {
    companyCategory = 'Large Company';
    citRate = CIT_RATES.LARGE.rate;
    citRateExplanation = `Turnover > ₦100m: 30% CIT`;
  }

  // Step 5: Calculate CIT Due (on chargeable profit — after capital allowances)
  const citDue = chargeableProfit * citRate;

  // Step 6: Tertiary Education Tax / TETFund (2.5% of assessable profit BEFORE capital allowances, per FIRS/CITA s.2 TETFund Act)
  const educationTax = assessableProfit * EDUCATION_TAX_RATE;

  // Total Tax Liability
  const totalTaxLiability = citDue + educationTax;

  // Calculate effective tax rate
  const effectiveTaxRate = totalRevenue > 0 
    ? (totalTaxLiability / totalRevenue) * 100 
    : 0;

  return {
    taxType: TAX_TYPES.CIT,
    input: {
      totalRevenue,
      allowableExpenses,
      nonAllowableExpenses,
      capitalAllowances,
      annualTurnover: turnoverForRate
    },
    calculation: {
      accountingProfit,
      accountingProfitFormula: `₦${totalRevenue.toLocaleString()} - ₦${allowableExpenses.toLocaleString()}`,
      adjustments: {
        nonAllowableExpenses,
        explanation: 'Non-allowable expenses added back to profit'
      },
      adjustedProfit,
      capitalAllowances,
      assessableProfit,
      chargeableProfit,
      companyClassification: {
        category: companyCategory,
        turnover: turnoverForRate,
        rate: citRate,
        ratePercentage: `${(citRate * 100).toFixed(0)}%`,
        explanation: citRateExplanation
      }
    },
    summary: {
      grossAmount: chargeableProfit,
      totalDeductions: capitalAllowances,
      totalReliefs: 0,
      taxableAmount: chargeableProfit,
      citDue,
      educationTax,
      educationTaxRate: `${(EDUCATION_TAX_RATE * 100).toFixed(1)}%`,
      totalTaxLiability,
      effectiveTaxRate: `${effectiveTaxRate.toFixed(2)}%`,
      netTaxPayable: totalTaxLiability
    }
  };
}

// ==================== VAT CALCULATOR ====================

/**
 * Calculate Value Added Tax (VAT)
 * Applicable to VAT-registered businesses
 * 
 * @param {Object} params
 * @param {number} params.vatableSales - Total VATable sales
 * @param {number} params.exemptSales - VAT-exempt sales
 * @param {number} params.zeroRatedSales - Zero-rated sales
 * @param {number} params.vatablePurchases - VATable purchases (for input VAT)
 * @param {number} params.exemptPurchases - Exempt purchases
 * @param {number} params.vatCreditBroughtForward - VAT credit from previous period
 * @returns {Object} Detailed VAT calculation breakdown
 */
export function calculateVAT(params) {
  const {
    vatableSales = 0,
    exemptSales = 0,
    zeroRatedSales = 0,
    vatablePurchases = 0,
    exemptPurchases = 0,
    vatCreditBroughtForward = 0
  } = params;

  // Step 1: Calculate Output VAT (on sales)
  const outputVAT = vatableSales * VAT_RATE;

  // Step 2: Calculate Input VAT (on purchases)
  const inputVAT = vatablePurchases * VAT_RATE;

  // Step 3: Calculate Net VAT Position
  const netVATBeforeCredit = outputVAT - inputVAT;
  const netVATAfterCredit = netVATBeforeCredit - vatCreditBroughtForward;

  // Determine if payable or credit
  const vatPayable = Math.max(0, netVATAfterCredit);
  const vatCreditCarriedForward = Math.abs(Math.min(0, netVATAfterCredit));

  // Calculate totals
  const totalSales = vatableSales + exemptSales + zeroRatedSales;
  const totalPurchases = vatablePurchases + exemptPurchases;

  return {
    taxType: TAX_TYPES.VAT,
    input: {
      vatableSales,
      exemptSales,
      zeroRatedSales,
      vatablePurchases,
      exemptPurchases,
      vatCreditBroughtForward
    },
    calculation: {
      sales: {
        vatable: vatableSales,
        exempt: exemptSales,
        zeroRated: zeroRatedSales,
        total: totalSales
      },
      outputVAT: {
        amount: outputVAT,
        formula: `₦${vatableSales.toLocaleString()} × ${(VAT_RATE * 100).toFixed(1)}%`
      },
      purchases: {
        vatable: vatablePurchases,
        exempt: exemptPurchases,
        total: totalPurchases
      },
      inputVAT: {
        amount: inputVAT,
        formula: `₦${vatablePurchases.toLocaleString()} × ${(VAT_RATE * 100).toFixed(1)}%`
      },
      netPosition: {
        beforeCredit: netVATBeforeCredit,
        creditApplied: vatCreditBroughtForward,
        afterCredit: netVATAfterCredit
      }
    },
    summary: {
      grossAmount: vatableSales,
      outputVAT,
      inputVAT,
      vatCreditBroughtForward,
      vatPayable,
      vatCreditCarriedForward,
      vatRate: `${(VAT_RATE * 100).toFixed(1)}%`,
      netTaxPayable: vatPayable
    }
  };
}

// ==================== WHT CALCULATOR ====================

/**
 * Calculate Withholding Tax (WHT)
 * Applicable to Individuals, SMEs, and Corporations
 * 
 * @param {Object} params
 * @param {string} params.transactionType - Type of transaction
 * @param {number} params.grossAmount - Gross transaction amount
 * @param {string} params.recipientType - 'individual' or 'company'
 * @returns {Object} Detailed WHT calculation breakdown
 */
export function calculateWHT(params) {
  const {
    transactionType,
    grossAmount = 0,
    recipientType = 'company'
  } = params;

  // Validate transaction type
  if (!WHT_RATES[transactionType]) {
    throw new Error(`Invalid transaction type: ${transactionType}. Valid types are: ${Object.keys(WHT_RATES).join(', ')}`);
  }

  // Get applicable rate
  const rateKey = recipientType === 'individual' ? 'individual' : 'company';
  const whtRate = WHT_RATES[transactionType][rateKey];

  // Calculate WHT amount
  const whtAmount = grossAmount * whtRate;
  const netAmount = grossAmount - whtAmount;

  return {
    taxType: TAX_TYPES.WHT,
    input: {
      transactionType,
      grossAmount,
      recipientType
    },
    calculation: {
      transactionType: transactionType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      recipientType: recipientType.charAt(0).toUpperCase() + recipientType.slice(1),
      applicableRate: whtRate,
      ratePercentage: `${(whtRate * 100).toFixed(0)}%`,
      whtAmount,
      formula: `₦${grossAmount.toLocaleString()} × ${(whtRate * 100).toFixed(0)}%`
    },
    summary: {
      grossAmount,
      whtRate: `${(whtRate * 100).toFixed(0)}%`,
      whtAmount,
      netAmount,
      netTaxPayable: whtAmount,
      note: 'WHT is NOT a final tax for most entities. It serves as a tax credit that can be offset against PAYE or CIT liability.'
    }
  };
}

// ==================== CGT CALCULATOR ====================

/**
 * Calculate Capital Gains Tax (CGT)
 * Applicable to Individuals and Businesses
 * 
 * @param {Object} params
 * @param {number} params.disposalProceeds - Amount received from disposal
 * @param {number} params.acquisitionCost - Original cost of the asset
 * @param {number} params.incidentalAcquisitionCosts - Costs incurred during acquisition
 * @param {number} params.improvementCosts - Capital improvements made to the asset
 * @param {number} params.incidentalDisposalCosts - Costs incurred during disposal
 * @param {boolean} params.isExempt - Whether the asset is exempt from CGT
 * @param {string} params.exemptionReason - Reason for exemption
 * @returns {Object} Detailed CGT calculation breakdown
 */
export function calculateCGT(params) {
  const {
    disposalProceeds = 0,
    acquisitionCost = 0,
    incidentalAcquisitionCosts = 0,
    improvementCosts = 0,
    incidentalDisposalCosts = 0,
    isExempt = false,
    exemptionReason = ''
  } = params;

  // Calculate total cost base
  const totalCostBase = acquisitionCost + incidentalAcquisitionCosts + improvementCosts;

  // Calculate allowable deductions
  const totalAllowableDeductions = totalCostBase + incidentalDisposalCosts;

  // Calculate chargeable gain
  const chargeableGain = Math.max(0, disposalProceeds - totalAllowableDeductions);

  // Calculate CGT (if not exempt)
  const cgtDue = isExempt ? 0 : chargeableGain * CGT_RATE;

  return {
    taxType: TAX_TYPES.CGT,
    input: {
      disposalProceeds,
      acquisitionCost,
      incidentalAcquisitionCosts,
      improvementCosts,
      incidentalDisposalCosts,
      isExempt,
      exemptionReason
    },
    calculation: {
      disposalProceeds,
      costBase: {
        acquisitionCost,
        incidentalAcquisitionCosts,
        improvementCosts,
        total: totalCostBase
      },
      incidentalDisposalCosts,
      totalAllowableDeductions,
      chargeableGain,
      chargeableGainFormula: `₦${disposalProceeds.toLocaleString()} - ₦${totalAllowableDeductions.toLocaleString()}`,
      isExempt,
      exemptionReason
    },
    summary: {
      disposalProceeds,
      totalDeductions: totalAllowableDeductions,
      chargeableGain,
      cgtRate: `${(CGT_RATE * 100).toFixed(0)}%`,
      cgtDue,
      netTaxPayable: cgtDue,
      isExempt
    }
  };
}

// ==================== PAYROLL/PAYE MONTHLY CALCULATOR ====================

/**
 * Calculate Monthly PAYE for an employee
 * 
 * @param {Object} params - Employee monthly income breakdown
 * @returns {Object} Monthly PAYE calculation
 */
export function calculateMonthlyPAYE(params) {
  const {
    basicSalary = 0,
    housingAllowance = 0,
    transportAllowance = 0,
    utilityAllowance = 0,
    mealAllowance = 0,
    otherAllowances = 0,
    bonus = 0,
    overtime = 0,
    benefitsInKind = 0,
    pensionRate = 0.08, // 8% employee contribution
    nhfRate = 0.025 // 2.5% of basic
  } = params;

  // Calculate gross monthly pay
  const grossMonthlyPay = 
    basicSalary + 
    housingAllowance + 
    transportAllowance + 
    utilityAllowance + 
    mealAllowance + 
    otherAllowances + 
    bonus + 
    overtime + 
    benefitsInKind;

  // Annualize the gross pay
  const grossAnnualPay = grossMonthlyPay * 12;

  // Calculate statutory deductions
  const pensionableEarnings = basicSalary + housingAllowance + transportAllowance;
  const monthlyPension = pensionableEarnings * pensionRate;
  const monthlyNHF = basicSalary * nhfRate;
  const annualPension = monthlyPension * 12;
  const annualNHF = monthlyNHF * 12;

  // Calculate annual PAYE using the main calculator
  const annualPAYEResult = calculatePAYE({
    grossEmoluments: grossAnnualPay,
    pensionContribution: annualPension,
    nhfContribution: annualNHF,
    nhisContribution: 0,
    lifeAssurancePremium: 0,
    entityType: ENTITY_TYPES.INDIVIDUAL
  });

  // Calculate monthly PAYE
  const monthlyPAYE = annualPAYEResult.summary.taxDue / 12;

  // Calculate net pay
  const totalMonthlyDeductions = monthlyPension + monthlyNHF + monthlyPAYE;
  const netMonthlyPay = grossMonthlyPay - totalMonthlyDeductions;

  return {
    taxType: 'monthly_paye',
    input: {
      basicSalary,
      housingAllowance,
      transportAllowance,
      utilityAllowance,
      mealAllowance,
      otherAllowances,
      bonus,
      overtime,
      benefitsInKind
    },
    calculation: {
      grossMonthlyPay,
      grossAnnualPay,
      annualCalculation: annualPAYEResult.calculation,
      monthlyBreakdown: {
        pension: monthlyPension,
        nhf: monthlyNHF,
        paye: monthlyPAYE,
        totalDeductions: totalMonthlyDeductions
      }
    },
    summary: {
      grossMonthlyPay,
      monthlyPension,
      monthlyNHF,
      monthlyPAYE,
      totalMonthlyDeductions,
      netMonthlyPay,
      annualPAYE: annualPAYEResult.summary.taxDue,
      effectiveMonthlyTaxRate: `${((monthlyPAYE / grossMonthlyPay) * 100).toFixed(2)}%`
    }
  };
}

// ==================== UTILITY FUNCTIONS ====================

/**
 * Format currency in Nigerian Naira
 */
export function formatNaira(amount) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

/**
 * Generate a unique tax calculation reference ID
 */
export function generateTaxReference(taxType, year) {
  const prefix = taxType.toUpperCase().substring(0, 3);
  const yearSuffix = year.toString().substring(2);
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `#TAX-${yearSuffix}-${prefix}-${random}`;
}

/**
 * Validate tax calculation input
 */
export function validateTaxInput(taxType, params) {
  const errors = [];

  switch (taxType) {
    case TAX_TYPES.PAYE:
      if (params.grossEmoluments < 0) {
        errors.push('Gross emoluments cannot be negative');
      }
      break;
    case TAX_TYPES.CIT:
      if (params.totalRevenue < 0) {
        errors.push('Total revenue cannot be negative');
      }
      break;
    case TAX_TYPES.VAT:
      if (params.vatableSales < 0 || params.vatablePurchases < 0) {
        errors.push('Sales and purchases cannot be negative');
      }
      break;
    case TAX_TYPES.WHT:
      if (!params.transactionType) {
        errors.push('Transaction type is required');
      }
      if (params.grossAmount < 0) {
        errors.push('Gross amount cannot be negative');
      }
      break;
    case TAX_TYPES.CGT:
      if (params.disposalProceeds < 0 || params.acquisitionCost < 0) {
        errors.push('Amounts cannot be negative');
      }
      break;
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Get tax filing deadlines
 */
export function getTaxFilingDeadlines(taxType, taxYear) {
  const deadlines = {
    [TAX_TYPES.PAYE]: `10th of each month following deduction`,
    [TAX_TYPES.CIT]: `${taxYear + 1}-06-30`, // 6 months after accounting year end
    [TAX_TYPES.VAT]: `21st of the month following the transaction`,
    [TAX_TYPES.WHT]: `21st of the month following deduction`,
    [TAX_TYPES.CGT]: `${taxYear + 1}-06-30`,
    [TAX_TYPES.EDUCATION_TAX]: `${taxYear + 1}-06-30`
  };

  return deadlines[taxType] || 'Contact FIRS for specific deadline';
}

export default {
  TAX_TYPES,
  ENTITY_TYPES,
  PAYE_TAX_BANDS,
  CIT_RATES,
  VAT_RATE,
  WHT_RATES,
  CGT_RATE,
  EDUCATION_TAX_RATE,
  calculatePAYE,
  calculateCIT,
  calculateVAT,
  calculateWHT,
  calculateCGT,
  calculateMonthlyPAYE,
  formatNaira,
  generateTaxReference,
  validateTaxInput,
  getTaxFilingDeadlines
};
