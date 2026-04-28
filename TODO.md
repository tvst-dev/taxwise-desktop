# TaxWise Fix Plan — COMPLETED

## Issue 1: Dashboard Tax Liability stat shows ₦0 despite calculations existing
**File:** `src/components/Dashboard/Dashboard.jsx`  
**Status:** ✅ COMPLETE
- Root cause: `latestCalc?.net_tax_payable` only checks one field name (snake_case), but different tax calculators store results under different field names depending on tax type (e.g., `taxDue` for CIT, `annualPAYE` for PAYE, `vatPayable` for VAT, `whtAmount` for WHT).
- **Fixes applied:**
  - Added multiple field name fallbacks using `??` nullish coalescing: `net_tax_payable`, `netTaxPayable`, `taxDue`, `totalTaxLiability`, `annualPAYE`, `vatPayable`, `whtAmount`
  - Added safer date sorting with `isNaN()` guards to prevent `new Date(undefined)` from breaking sort
  - Protected `formatCurrency()` against `undefined`, `null`, `NaN`, and non-numeric inputs (returns `'₦0'`)
  - Protected `formatDate()` against invalid date strings (returns `''`)
  - Memoized `getUpcomingReminders()` and `getOverdueReminders()` calls with `React.useMemo()` to prevent infinite re-render loops

---

## Issue 2: App silently crashes to white screen and needs reopening
**Files:** `src/components/ErrorBoundary.jsx` (new), `src/App.jsx`  
**Status:** ✅ COMPLETE
- Root cause: No React Error Boundary existed. Any unhandled render error caused the entire app to silently crash to a white screen.
- **Fixes applied:**
  - Created new `src/components/ErrorBoundary.jsx` — class-based Error Boundary with fallback UI:
    - Warning icon + "Something went wrong" message
    - "Try Again" button (resets error state)
    - "Reload App" button (full page reload)
    - Error details shown in development mode
  - Wrapped `<div style={styles.appContainer}>` inside `<ErrorBoundary>` in `App.jsx`
  - Added global `window.addEventListener('error', ...)` handler to log uncaught errors
  - Added global `window.addEventListener('unhandledrejection', ...)` handler to log unhandled promise rejections
  - Cleaned up listeners in the useEffect return

---

## Issue 3: CRA (Relief) field empty after tax calculation
**File:** `src/components/TaxCalculator/TaxCalculator.jsx`  
**Status:** ✅ COMPLETE
- Root cause: For **monthly** PAYE, `calculateMonthlyPAYE()` nests the annual calculation inside `result.calculation.annualCalculation`, so the Consolidated Relief Allowance lives at `result.calculation?.annualCalculation?.consolidatedReliefAllowance?.total`. The JSX was only checking `result.calculation?.consolidatedReliefAllowance?.total`, which works for annual PAYE (via `calculatePAYE`) but returns `undefined` for monthly PAYE.
- **Fixes applied:**
  - Changed the CRA display path in PAYE results to: `result.calculation?.annualCalculation?.consolidatedReliefAllowance?.total || result.calculation?.consolidatedReliefAllowance?.total`
  - Fixed `result.summary.grossMonthlyPay * 12` to `(result.summary.grossMonthlyPay || 0) * 12` to prevent `NaN`
