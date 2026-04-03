/**
 * TaxWise Payment Form
 * Shows card details UI + bank transfer option.
 * Opens Paystack checkout via local proxy server (port 5555).
 * Secret key is never exposed to the renderer.
 */
import React, { useState } from 'react';
import { Lock, Loader2, CheckCircle, CreditCard, Building2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../services/supabase';

// Detect card type from first digits
function detectCardType(num) {
  const n = num.replace(/\s/g, '');
  if (/^4/.test(n)) return 'visa';
  if (/^5[1-5]/.test(n)) return 'mastercard';
  if (/^(6304|6759|6761|6763|506[0-9]|6500|6512|6304|65)/.test(n)) return 'verve';
  return null;
}

function formatCardNumber(value) {
  const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
  return v.match(/.{1,4}/g)?.join(' ') || v;
}

function formatExpiry(value) {
  const v = value.replace(/\D/g, '');
  return v.length >= 2 ? v.substring(0, 2) + '/' + v.substring(2, 4) : v;
}

const CARD_LOGOS = {
  visa: (
    <svg width="38" height="24" viewBox="0 0 38 24" fill="none">
      <rect width="38" height="24" rx="4" fill="#1A1F71"/>
      <text x="19" y="17" textAnchor="middle" fill="white" fontSize="11" fontWeight="700" fontFamily="Arial">VISA</text>
    </svg>
  ),
  mastercard: (
    <svg width="38" height="24" viewBox="0 0 38 24" fill="none">
      <rect width="38" height="24" rx="4" fill="#252525"/>
      <circle cx="15" cy="12" r="7" fill="#EB001B"/>
      <circle cx="23" cy="12" r="7" fill="#F79E1B"/>
      <path d="M19 6.8a7 7 0 0 1 0 10.4A7 7 0 0 1 19 6.8z" fill="#FF5F00"/>
    </svg>
  ),
  verve: (
    <svg width="38" height="24" viewBox="0 0 38 24" fill="none">
      <rect width="38" height="24" rx="4" fill="#005B2A"/>
      <text x="19" y="16" textAnchor="middle" fill="white" fontSize="9" fontWeight="700" fontFamily="Arial">VERVE</text>
    </svg>
  ),
};

const PaymentForm = ({
  email,
  amount,
  plan,
  organizationId,
  isTrial = false,
  onSuccess,
  onError,
  buttonText = 'Pay Now',
}) => {
  const [method, setMethod] = useState('card'); // 'card' | 'bank'
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [cardName, setCardName] = useState('');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const cardType = detectCardType(cardNumber);

  const validate = () => {
    const e = {};
    if (method === 'card') {
      const raw = cardNumber.replace(/\s/g, '');
      if (raw.length < 16) e.cardNumber = 'Enter a valid 16-digit card number';
      if (expiry.length < 5) e.expiry = 'Enter expiry (MM/YY)';
      if (cvv.length < 3) e.cvv = 'Enter CVV';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handlePay = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      // Initialize transaction via local Paystack proxy server
      const initRes = await fetch('http://localhost:5555/api/init-transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          amount: Math.round((amount || 100) * 100), // kobo
          metadata: { organization_id: organizationId, plan, is_trial: isTrial },
        }),
      });
      const initData = await initRes.json();
      if (!initData.status) throw new Error(initData.error || 'Failed to initialize payment');

      // Open Paystack checkout in Electron BrowserWindow popup
      const result = await window.electronAPI.payment.openPopup(initData.authUrl);
      if (!result.success) throw new Error(result.error || 'Payment cancelled');

      const reference = result.reference || initData.reference;

      // Verify payment via local proxy server
      const verifyRes = await fetch(`http://localhost:5555/api/verify/${reference}`);
      const verifyData = await verifyRes.json();

      if (verifyData.data?.status !== 'success') {
        throw new Error('Payment not confirmed. Please try again.');
      }

      // Update Supabase
      if (isTrial) {
        await supabase.from('organizations').update({
          subscription_status: 'trial',
          subscription_tier: plan,
          trial_started_at: new Date().toISOString(),
          trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        }).eq('id', organizationId);
      } else {
        const now = new Date().toISOString();
        await supabase.from('subscriptions').upsert({
          organization_id: organizationId,
          plan,
          status: 'active',
          paystack_reference: reference,
          current_period_start: now,
          current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        }, { onConflict: 'organization_id' });

        await supabase.from('organizations').update({
          subscription_status: 'active',
          subscription_tier: plan,
        }).eq('id', organizationId);
      }

      setDone(true);
      toast.success(isTrial ? '14-day trial started!' : 'Payment successful!');
      onSuccess?.({ reference, status: 'success' });
    } catch (err) {
      console.error('Payment error:', err);
      toast.error(err.message || 'Payment failed. Please try again.');
      onError?.(err);
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div style={s.center}>
        <CheckCircle size={64} color="#22C55E" />
        <h3 style={s.successTitle}>{isTrial ? 'Trial Started!' : 'Payment Successful!'}</h3>
        <p style={s.successText}>
          {isTrial ? 'Your 14-day free trial is now active.' : 'Your subscription is now active.'}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handlePay} style={s.wrapper}>
      {/* Secure bar */}
      <div style={s.secureBar}>
        <Lock size={13} />
        <span>256-bit encrypted · PCI DSS compliant · Powered by Paystack</span>
      </div>

      {/* Amount */}
      <div style={s.amountBox}>
        <span style={s.amountLabel}>{isTrial ? 'Card verification (refundable)' : 'Total due today'}</span>
        <span style={s.amountValue}>₦{(amount || 100).toLocaleString()}</span>
      </div>

      {/* Payment method tabs */}
      <div style={s.methodTabs}>
        <button
          type="button"
          style={{ ...s.methodTab, ...(method === 'card' ? s.methodTabActive : {}) }}
          onClick={() => setMethod('card')}
        >
          <CreditCard size={16} />
          <span>Debit / Credit Card</span>
        </button>
        <button
          type="button"
          style={{ ...s.methodTab, ...(method === 'bank' ? s.methodTabActive : {}) }}
          onClick={() => setMethod('bank')}
        >
          <Building2 size={16} />
          <span>Bank Transfer</span>
        </button>
      </div>

      {/* Card form */}
      {method === 'card' && (
        <div style={s.cardForm}>
          {/* Card number */}
          <div style={s.field}>
            <label style={s.label}>Card Number</label>
            <div style={s.inputRow}>
              <div style={s.inputWrap}>
                <CreditCard size={16} style={s.inputIcon} />
                <input
                  type="text"
                  inputMode="numeric"
                  value={cardNumber}
                  onChange={e => setCardNumber(formatCardNumber(e.target.value))}
                  placeholder="1234 5678 9012 3456"
                  maxLength={19}
                  style={{ ...s.input, ...(errors.cardNumber ? s.inputErr : {}) }}
                />
              </div>
              {cardType && <div style={s.cardLogo}>{CARD_LOGOS[cardType]}</div>}
            </div>
            {errors.cardNumber && <span style={s.errText}>{errors.cardNumber}</span>}
          </div>

          {/* Cardholder name */}
          <div style={s.field}>
            <label style={s.label}>Cardholder Name</label>
            <input
              type="text"
              value={cardName}
              onChange={e => setCardName(e.target.value)}
              placeholder="Name on card"
              style={s.inputPlain}
            />
          </div>

          {/* Expiry + CVV */}
          <div style={s.twoCol}>
            <div style={s.field}>
              <label style={s.label}>Expiry Date</label>
              <input
                type="text"
                inputMode="numeric"
                value={expiry}
                onChange={e => setExpiry(formatExpiry(e.target.value))}
                placeholder="MM/YY"
                maxLength={5}
                style={{ ...s.inputPlain, ...(errors.expiry ? s.inputErr : {}) }}
              />
              {errors.expiry && <span style={s.errText}>{errors.expiry}</span>}
            </div>
            <div style={s.field}>
              <label style={s.label}>CVV</label>
              <input
                type="password"
                inputMode="numeric"
                value={cvv}
                onChange={e => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="•••"
                maxLength={4}
                style={{ ...s.inputPlain, ...(errors.cvv ? s.inputErr : {}) }}
              />
              {errors.cvv && <span style={s.errText}>{errors.cvv}</span>}
            </div>
          </div>

          <p style={s.cardNote}>
            Your card details open a secure Paystack checkout to complete the payment.
          </p>
        </div>
      )}

      {/* Bank transfer info */}
      {method === 'bank' && (
        <div style={s.bankInfo}>
          <Building2 size={32} style={{ color: '#3B82F6', marginBottom: 8 }} />
          <p style={s.bankText}>
            Click <strong style={{ color: '#E6EDF3' }}>Continue</strong> to receive a unique bank account number.
            Transfer the exact amount to complete your payment — your access activates instantly after confirmation.
          </p>
          <div style={s.bankBadges}>
            {['GTBank', 'Access', 'Zenith', 'UBA', 'First Bank', 'All banks'].map(b => (
              <span key={b} style={s.bankBadge}>{b}</span>
            ))}
          </div>
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        style={{ ...s.submitBtn, opacity: loading ? 0.7 : 1 }}
        disabled={loading}
      >
        {loading
          ? <><Loader2 size={18} style={s.spin} /> Opening secure checkout…</>
          : <><Lock size={15} /> {method === 'bank' ? 'Continue to Bank Transfer' : buttonText}</>}
      </button>

      <p style={s.disclaimer}>
        {isTrial
          ? 'A ₦100 card verification charge is applied today and will be refunded. Full plan price applies from day 15.'
          : 'Payments are processed securely by Paystack. Card details are never stored on our servers.'}
      </p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </form>
  );
};

const s = {
  wrapper: { display: 'flex', flexDirection: 'column', gap: 14 },
  secureBar: {
    display: 'flex', alignItems: 'center', gap: 7, padding: '8px 12px',
    background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)',
    borderRadius: 8, color: '#22C55E', fontSize: 12,
  },
  amountBox: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '12px 16px', background: '#0D1117', borderRadius: 8, border: '1px solid #30363D',
  },
  amountLabel: { fontSize: 13, color: '#8B949E' },
  amountValue: { fontSize: 22, fontWeight: 700, color: '#E6EDF3' },
  methodTabs: { display: 'flex', gap: 8 },
  methodTab: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: '11px', background: '#0D1117', border: '1px solid #30363D',
    borderRadius: 8, color: '#8B949E', fontSize: 13, fontWeight: 500, cursor: 'pointer',
  },
  methodTabActive: {
    background: 'rgba(37,99,235,0.1)', borderColor: '#2563EB', color: '#60A5FA',
  },
  cardForm: { display: 'flex', flexDirection: 'column', gap: 12 },
  field: { display: 'flex', flexDirection: 'column', gap: 5 },
  label: { fontSize: 12, fontWeight: 500, color: '#8B949E' },
  inputRow: { display: 'flex', alignItems: 'center', gap: 8 },
  inputWrap: { position: 'relative', flex: 1 },
  inputIcon: { position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#6E7681', pointerEvents: 'none' },
  input: {
    width: '100%', padding: '11px 12px 11px 38px',
    background: '#0D1117', border: '1px solid #30363D', borderRadius: 8,
    color: '#E6EDF3', fontSize: 14, outline: 'none', boxSizing: 'border-box',
    fontFamily: 'monospace', letterSpacing: 2,
  },
  inputPlain: {
    width: '100%', padding: '11px 12px',
    background: '#0D1117', border: '1px solid #30363D', borderRadius: 8,
    color: '#E6EDF3', fontSize: 14, outline: 'none', boxSizing: 'border-box',
  },
  inputErr: { borderColor: '#EF4444' },
  errText: { fontSize: 11, color: '#EF4444' },
  cardLogo: { flexShrink: 0 },
  twoCol: { display: 'flex', gap: 12 },
  cardNote: { fontSize: 11, color: '#6E7681', lineHeight: 1.5, margin: 0 },
  bankInfo: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
    padding: '20px 16px', background: '#0D1117', border: '1px solid #30363D', borderRadius: 10, gap: 0,
  },
  bankText: { fontSize: 13, color: '#8B949E', lineHeight: 1.6, marginBottom: 14 },
  bankBadges: { display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 6 },
  bankBadge: {
    padding: '3px 10px', background: '#161B22', border: '1px solid #30363D',
    borderRadius: 4, fontSize: 11, color: '#8B949E',
  },
  submitBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: '14px', background: '#2563EB', color: '#fff', border: 'none',
    borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: 'pointer', width: '100%',
  },
  disclaimer: { fontSize: 11, color: '#6E7681', textAlign: 'center', lineHeight: 1.6, margin: 0 },
  center: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '16px 0' },
  successTitle: { fontSize: 20, fontWeight: 700, color: '#E6EDF3', margin: 0 },
  successText: { fontSize: 14, color: '#8B949E', margin: 0 },
  spin: { animation: 'spin 1s linear infinite' },
};

export default PaymentForm;
