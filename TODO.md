# TODO - TaxWise fixes

- [ ] Fix tax_calculations id mismatch (calc_${Date.now()} → UUID) in:
  - [ ] src/components/TaxCalculator/TaxCalculator.jsx
  - [ ] src/components/Modals/TaxCalculatorModal.jsx
  - [ ] src/store/index.js (useTaxStore.addCalculation fallback)
- [ ] Fix tax_calculations payload mismatch:
  - [ ] Remove net_tax_payable from createTaxCalculation payload (or map to correct existing column) in TaxCalculator.jsx and TaxCalculatorModal.jsx
  - [ ] Ensure UI still reads the correct field (net_tax_payable vs result_data)
- [ ] Remove placeholder card number from payment method (UI/PaymentForm.jsx)
  - [ ] Remove placeholder="1234 5678 9012 3456" from card number input

- [ ] Run tests/build to confirm compilation

