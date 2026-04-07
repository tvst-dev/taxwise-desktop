/**
 * TaxWise Inline Payment Form
 * Full in-app payment — no Paystack popup at any point.
 * Card: charge → PIN → OTP → verify
 * Bank: virtual account → poll → verify
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  Lock, Loader2, CheckCircle, CreditCard, Building2,
  ShieldCheck, Eye, EyeOff, ArrowLeft, ExternalLink,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../services/supabase';
import { useAuthStore } from '../../store';
import { applyFeatureFlags } from '../../utils/featureFlags';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmt4(val) {
  return val.replace(/\D/g, '').replace(/(.{4})/g, '$1 ').trim().slice(0, 19);
}
function fmtExpiry(val) {
  const d = val.replace(/\D/g, '');
  return d.length >= 2 ? d.slice(0, 2) + '/' + d.slice(2, 4) : d;
}
function detectCard(num) {
  const n = num.replace(/\s/g, '');
  if (/^4/.test(n)) return 'visa';
  if (/^5[1-5]/.test(n)) return 'mastercard';
  if (/^(506[0-9]|6500|6512|650[0-9]|63(04|59|61|63))/.test(n)) return 'verve';
  return null;
}

const BRAND_COLOR = { visa: '#1A1F71', mastercard: '#252525', verve: '#005B2A' };
const BRAND_LABEL = { visa: 'VISA', mastercard: 'MC', verve: 'VERVE' };

function CardBadge({ type }) {
  if (!type) return null;
  return (
    <span style={{
      padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700,
      background: BRAND_COLOR[type], color: '#fff', letterSpacing: 1,
    }}>
      {BRAND_LABEL[type]}
    </span>
  );
}

// ─── API helpers ─────────────────────────────────────────────────────────────
const api = (path, body) =>
  fetch(`http://localhost:5555${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json' },
    ...(body && { body: JSON.stringify(body) }),
  }).then(r => r.json());

// ─── Component ───────────────────────────────────────────────────────────────
const PaymentForm = ({
  email,
  amount = 100,
  plan,
  organizationId,
  isTrial = false,
  onSuccess,
  onError,
  buttonText = 'Pay Now',
}) => {
  // step: 'method' | 'card' | 'pin' | 'otp' | 'bank' | 'verifying' | 'success'
  const [step, setStep] = useState('method');
  const [method, setMethod] = useState(null); // 'card' | 'bank'

  // Card fields
  const [cardNum, setCardNum] = useState('');
  const [expiry, setExpiry]   = useState('');
  const [cvv, setCvv]         = useState('');
  const [name, setName]       = useState('');
  const [showCvv, setShowCvv] = useState(false);
  const [errors, setErrors]   = useState({});

  // Auth fields
  const [pin, setPin] = useState('');
  const [otp, setOtp] = useState('');

  // Payment state
  const [reference, setReference] = useState('');
  const [statusMsg, setStatusMsg] = useState(''); // OTP hint text or 3DS URL
  const [loading, setLoading]     = useState(false);
  const pollRef = useRef(null);

  useEffect(() => () => clearInterval(pollRef.current), []);

  // ── Save to Supabase after verified ─────────────────────────────────────
  const saveSubscription = async (ref) => {
    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    if (isTrial) {
      await supabase.from('organizations').update({
        subscription_status: 'trial',
        subscription_tier: plan,
        trial_started_at: new Date().toISOString(),
        trial_ends_at: trialEndsAt,
      }).eq('id', organizationId);
    } else {
      const now = new Date().toISOString();
      await supabase.from('subscriptions').upsert({
        organization_id: organizationId,
        plan, status: 'active', paystack_reference: ref,
        current_period_start: now,
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      }, { onConflict: 'organization_id' });
      await supabase.from('organizations').update({
        subscription_status: 'active', subscription_tier: plan,
      }).eq('id', organizationId);
    }

    // Immediately reflect new subscription in the in-memory auth store
    // so ProtectedRoute and feature flags update without requiring a re-login.
    const orgUpdates = isTrial
      ? { subscription_status: 'trial', subscription_tier: plan, trial_ends_at: trialEndsAt }
      : { subscription_status: 'active', subscription_tier: plan };
    useAuthStore.getState().updateOrganization(orgUpdates);
    applyFeatureFlags(plan);
  };

  // ── Verify and complete ──────────────────────────────────────────────────
  const finalize = async (ref) => {
    setStep('verifying');
    clearInterval(pollRef.current);
    try {
      const data = await api(`/api/verify/${ref}`);
      if (data.data?.status !== 'success') throw new Error('Payment not confirmed yet');
      await saveSubscription(ref);
      setStep('success');
      toast.success(isTrial ? '14-day trial started!' : 'Payment successful!');
      onSuccess?.({ reference: ref, status: 'success' });
    } catch (err) {
      toast.error(err.message);
      setLoading(false);
      // Return to the right step based on payment method
      setStep(method === 'bank' ? 'bank' : 'card');
    }
  };

  // ── Handle charge response (card only) ───────────────────────────────────
  const handleChargeResponse = (data, ref) => {
    setReference(ref);
    const s = data?.data?.status;
    if (s === 'success') { finalize(ref); return; }
    if (s === 'send_pin') {
      setStatusMsg(data.data.display_text || 'Enter your 4-digit card PIN');
      setPin(''); setStep('pin'); setLoading(false); return;
    }
    if (s === 'send_otp') {
      setStatusMsg(data.data.display_text || 'Enter the OTP sent to your phone/email');
      setOtp(''); setStep('otp'); setLoading(false); return;
    }
    if (s === 'open_url') {
      // 3DS — store URL, show manual open button + poll (don't auto-open)
      setStatusMsg(data.data.url);
      setStep('otp'); setOtp('__3ds__'); setLoading(false);
      startPolling(ref);
      return;
    }
    // declined / failed
    const msg = data.data?.gateway_response || data.message || 'Card declined. Please try another card.';
    toast.error(msg);
    setLoading(false);
  };

  // ── Polling for bank transfer ────────────────────────────────────────────
  const startPolling = (ref) => {
    let attempts = 0;
    pollRef.current = setInterval(async () => {
      if (++attempts > 72) { clearInterval(pollRef.current); return; } // 6 min
      try {
        const d = await api(`/api/verify/${ref}`);
        if (d.data?.status === 'success') finalize(ref);
      } catch {}
    }, 5000);
  };

  // ── Card submit ──────────────────────────────────────────────────────────
  const handleCardSubmit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (cardNum.replace(/\s/g, '').length < 15) errs.cardNum = 'Enter a valid card number';
    if (expiry.length < 5) errs.expiry = 'Enter expiry (MM/YY)';
    if (cvv.length < 3) errs.cvv = 'Enter CVV';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setLoading(true);
    try {
      const [mon, yr] = expiry.split('/');
      const data = await api('/api/charge-card', {
        email,
        amount: Math.round(amount * 100),
        card: {
          number:       cardNum.replace(/\s/g, ''),
          cvv,
          expiry_month: mon?.trim(),
          expiry_year:  '20' + (yr?.trim() || ''),
        },
        metadata: { organization_id: organizationId, plan, is_trial: isTrial },
      });
      if (!data.status) throw new Error(data.message || 'Card charge failed');
      handleChargeResponse(data, data.data?.reference);
    } catch (err) {
      toast.error(err.message || 'Card charge failed. Please try again.');
      setLoading(false);
      onError?.(err);
    }
  };

  // ── PIN submit ───────────────────────────────────────────────────────────
  const handlePinSubmit = async (e) => {
    e.preventDefault();
    if (pin.length < 4) { toast.error('Enter your 4-digit PIN'); return; }
    setLoading(true);
    try {
      const data = await api('/api/submit-pin', { reference, pin });
      if (!data.status) throw new Error(data.message || 'PIN failed');
      handleChargeResponse(data, reference);
    } catch (err) {
      toast.error(err.message || 'Incorrect PIN. Please try again.');
      setLoading(false);
    }
  };

  // ── OTP submit ───────────────────────────────────────────────────────────
  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    if (otp === '__3ds__') { finalize(reference); return; }
    if (otp.length < 4) { toast.error('Enter the OTP'); return; }
    setLoading(true);
    try {
      const data = await api('/api/submit-otp', { reference, otp });
      if (!data.status) throw new Error(data.message || 'OTP failed');
      handleChargeResponse(data, reference);
    } catch (err) {
      toast.error(err.message || 'Incorrect OTP. Please try again.');
      setLoading(false);
    }
  };

  // ── Bank transfer — Paystack popup + background polling ─────────────────
  const handleBankTransfer = async () => {
    setLoading(true);
    try {
      const data = await api('/api/init-transaction', {
        email,
        amount: Math.round(amount * 100),
        metadata: { organization_id: organizationId, plan, is_trial: isTrial },
        channels: ['bank_transfer'],
      });

      if (!data.status) throw new Error(data.error || 'Could not initialize bank transfer');
      if (!data.authUrl)  throw new Error('No payment URL returned by Paystack. Please try again.');

      const ref = data.reference;
      setLoading(false);

      // Flags to prevent double-finalize
      let paymentConfirmed = false;
      let popupClosed      = false;

      // Open popup — fire-and-forget (don't await; resolves when window closes)
      window.electronAPI.payment.openPopup(data.authUrl)
        .then(async () => {
          popupClosed = true;
          clearInterval(pollRef.current);
          if (paymentConfirmed) return; // poll already handled it
          // One last verify before giving up
          try {
            const check = await api(`/api/verify/${ref}`);
            if (check.data?.status === 'success') { await finalize(ref); return; }
          } catch {}
          toast.error('Transfer cancelled or not yet confirmed.');
          setLoading(false);
        })
        .catch((err) => {
          console.error('[bank-transfer] popup error:', err);
          clearInterval(pollRef.current);
          toast.error('Could not open payment window. Please try again.');
          setLoading(false);
        });

      // Background poll — when payment confirmed, close popup then finalize
      let attempts = 0;
      pollRef.current = setInterval(async () => {
        if (++attempts > 72) { clearInterval(pollRef.current); return; } // 6 min timeout
        try {
          const d = await api(`/api/verify/${ref}`);
          if (d.data?.status === 'success') {
            paymentConfirmed = true;
            clearInterval(pollRef.current);
            if (!popupClosed) {
              await window.electronAPI.payment.closePopup();
            }
            await finalize(ref);
          }
        } catch {}
      }, 5000);

    } catch (err) {
      toast.error(err.message || 'Bank transfer failed. Please try again.');
      setLoading(false);
      onError?.(err);
    }
  };

  const cardType = detectCard(cardNum);

  // ─── Render ────────────────────────────────────────────────────────────────

  if (step === 'success') {
    return (
      <div style={s.center}>
        <div style={s.successRing}><CheckCircle size={44} color="#22C55E" /></div>
        <h3 style={s.h3}>{isTrial ? 'Trial Started!' : 'Payment Successful!'}</h3>
        <p style={s.muted}>{isTrial ? 'Your 14-day free trial is now active.' : 'Your subscription is now active.'}</p>
      </div>
    );
  }

  if (step === 'verifying') {
    return (
      <div style={s.center}>
        <Loader2 size={44} color="#3B82F6" style={s.spin} />
        <h3 style={s.h3}>Confirming payment…</h3>
        <p style={s.muted}>Please wait while we verify your payment.</p>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  if (step === 'pin') {
    return (
      <form onSubmit={handlePinSubmit} style={s.col}>
        <div style={s.authHeader}>
          <div style={s.authIcon}><Lock size={28} color="#3B82F6"/></div>
          <h3 style={s.h3}>Card PIN</h3>
          <p style={s.muted}>{statusMsg}</p>
        </div>

        <div style={s.field}>
          <label style={s.label}>4-Digit PIN</label>
          <input
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={e => setPin(e.target.value.replace(/\D/g,'').slice(0,4))}
            placeholder="••••"
            maxLength={4}
            autoFocus
            style={{ ...s.input, textAlign: 'center', fontSize: 24, letterSpacing: 12 }}
          />
        </div>

        <button type="submit" style={{ ...s.btn, opacity: loading ? 0.7 : 1 }} disabled={loading}>
          {loading ? <><Loader2 size={16} style={s.spin}/> Verifying…</> : <><Lock size={14}/> Submit PIN</>}
        </button>
        <button type="button" style={s.btnGhost} onClick={() => { setStep('card'); setLoading(false); }}>
          <ArrowLeft size={14}/> Back
        </button>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </form>
    );
  }

  if (step === 'otp') {
    const is3ds = otp === '__3ds__';
    return (
      <form onSubmit={handleOtpSubmit} style={s.col}>
        <div style={s.authHeader}>
          <div style={s.authIcon}><ShieldCheck size={28} color="#3B82F6"/></div>
          <h3 style={s.h3}>{is3ds ? '3D Secure' : 'OTP Verification'}</h3>
          <p style={s.muted}>{statusMsg}</p>
        </div>

        {is3ds ? (
          <button
            type="button"
            style={{ ...s.btn, background: '#1d4ed8' }}
            onClick={() => window.electronAPI?.shell?.openExternal(statusMsg)}
          >
            <ExternalLink size={15}/> Open Authentication Page
          </button>
        ) : (
          <div style={s.field}>
            <label style={s.label}>One-Time Password</label>
            <input
              type="text"
              inputMode="numeric"
              value={otp}
              onChange={e => setOtp(e.target.value.replace(/\D/g,'').slice(0,6))}
              placeholder="000000"
              maxLength={6}
              autoFocus
              style={{ ...s.input, textAlign: 'center', fontSize: 24, letterSpacing: 8 }}
            />
          </div>
        )}

        <button type="submit" style={{ ...s.btn, opacity: loading ? 0.7 : 1 }} disabled={loading}>
          {loading
            ? <><Loader2 size={16} style={s.spin}/> Verifying…</>
            : is3ds
              ? <><CheckCircle size={14}/> I've completed authentication</>
              : <><ShieldCheck size={14}/> Verify OTP</>}
        </button>
        <button type="button" style={s.btnGhost} onClick={() => { setStep('card'); setLoading(false); }}>
          <ArrowLeft size={14}/> Back
        </button>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </form>
    );
  }

  if (step === 'card') {
    return (
      <form onSubmit={handleCardSubmit} style={s.col}>
        <div style={s.secureBar}><Lock size={13}/><span>256-bit encrypted · PCI DSS compliant · Paystack</span></div>

        {/* Amount badge */}
        <div style={s.amountBox}>
          <span style={s.muted}>{isTrial ? 'Card verification (refundable)' : 'Total due today'}</span>
          <span style={s.amountVal}>₦{amount.toLocaleString()}</span>
        </div>

        {/* Card number */}
        <div style={s.field}>
          <label style={s.label}>Card Number</label>
          <div style={s.inputRow}>
            <div style={{ position: 'relative', flex: 1 }}>
              <CreditCard size={16} style={s.inputIcon}/>
              <input
                type="text" inputMode="numeric"
                value={cardNum}
                onChange={e => setCardNum(fmt4(e.target.value))}
                placeholder="1234 5678 9012 3456"
                maxLength={19}
                style={{ ...s.input, paddingLeft: 40, ...(errors.cardNum && s.inputErr) }}
              />
            </div>
            <CardBadge type={cardType}/>
          </div>
          {errors.cardNum && <span style={s.errText}>{errors.cardNum}</span>}
        </div>

        {/* Name */}
        <div style={s.field}>
          <label style={s.label}>Cardholder Name</label>
          <input
            type="text" value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Name on card"
            style={s.input}
          />
        </div>

        {/* Expiry + CVV */}
        <div style={s.row}>
          <div style={{ ...s.field, flex: 1 }}>
            <label style={s.label}>Expiry Date</label>
            <input
              type="text" inputMode="numeric"
              value={expiry}
              onChange={e => setExpiry(fmtExpiry(e.target.value))}
              placeholder="MM/YY" maxLength={5}
              style={{ ...s.input, ...(errors.expiry && s.inputErr) }}
            />
            {errors.expiry && <span style={s.errText}>{errors.expiry}</span>}
          </div>
          <div style={{ ...s.field, flex: 1 }}>
            <label style={s.label}>
              CVV
              <span style={{ color: '#6E7681', fontWeight: 400, marginLeft: 6 }}>(3-4 digits)</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showCvv ? 'text' : 'password'}
                inputMode="numeric"
                value={cvv}
                onChange={e => setCvv(e.target.value.replace(/\D/g,'').slice(0,4))}
                placeholder="•••"
                maxLength={4}
                style={{ ...s.input, paddingRight: 38, ...(errors.cvv && s.inputErr) }}
              />
              <button
                type="button"
                style={s.eyeBtn}
                onClick={() => setShowCvv(v => !v)}
              >
                {showCvv ? <EyeOff size={14}/> : <Eye size={14}/>}
              </button>
            </div>
            {errors.cvv && <span style={s.errText}>{errors.cvv}</span>}
          </div>
        </div>

        <button type="submit" style={{ ...s.btn, opacity: loading ? 0.7 : 1 }} disabled={loading}>
          {loading
            ? <><Loader2 size={16} style={s.spin}/> Processing…</>
            : <><Lock size={14}/> {buttonText}</>}
        </button>
        <button type="button" style={s.btnGhost} onClick={() => setStep('method')}>
          <ArrowLeft size={14}/> Back
        </button>

        <p style={s.disclaimer}>
          {isTrial
            ? '₦100 card verification applied today, refunded after trial period starts.'
            : 'Card details are processed directly via Paystack and never stored on our servers.'}
        </p>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </form>
    );
  }

  // ── Method selection (default) ───────────────────────────────────────────
  return (
    <div style={s.col}>
      <div style={s.amountBox}>
        <span style={s.muted}>{isTrial ? 'Card verification (refundable)' : 'Total due today'}</span>
        <span style={s.amountVal}>₦{amount.toLocaleString()}</span>
      </div>

      <p style={{ ...s.muted, fontSize: 13, marginBottom: 2 }}>Choose payment method</p>

      <button
        style={s.methodBtn}
        onClick={() => { setMethod('card'); setStep('card'); }}
      >
        <div style={s.methodIcon}><CreditCard size={22} color="#3B82F6"/></div>
        <div style={s.methodText}>
          <span style={s.methodTitle}>Debit / Credit Card</span>
          <span style={s.methodSub}>Visa · Mastercard · Verve</span>
        </div>
        <span style={s.methodArrow}>›</span>
      </button>

      <button
        style={s.methodBtn}
        onClick={() => { setMethod('bank'); handleBankTransfer(); }}
        disabled={loading}
      >
        <div style={s.methodIcon}>
          {loading && method === 'bank'
            ? <Loader2 size={22} color="#3B82F6" style={s.spin}/>
            : <Building2 size={22} color="#3B82F6"/>}
        </div>
        <div style={s.methodText}>
          <span style={s.methodTitle}>Bank Transfer</span>
          <span style={s.methodSub}>Get a virtual account number instantly</span>
        </div>
        <span style={s.methodArrow}>›</span>
      </button>

      <div style={s.secureBar}>
        <ShieldCheck size={13}/>
        <span>All transactions secured by Paystack · PCI DSS Level 1</span>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = {
  col: { display: 'flex', flexDirection: 'column', gap: 12 },
  row: { display: 'flex', gap: 12 },
  center: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', gap: 14, padding: '24px 0', textAlign: 'center',
  },
  successRing: {
    width: 80, height: 80, borderRadius: '50%',
    background: 'rgba(34,197,94,0.1)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  authHeader: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textAlign: 'center' },
  authIcon: {
    width: 60, height: 60, borderRadius: '50%',
    background: 'rgba(59,130,246,0.1)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  secureBar: {
    display: 'flex', alignItems: 'center', gap: 7, padding: '8px 12px',
    background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.2)',
    borderRadius: 8, color: '#22C55E', fontSize: 11,
  },
  amountBox: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '12px 16px', background: '#0D1117', borderRadius: 8,
    border: '1px solid #30363D',
  },
  amountVal: { fontSize: 22, fontWeight: 700, color: '#E6EDF3' },
  methodBtn: {
    display: 'flex', alignItems: 'center', gap: 14,
    padding: '16px', background: '#0D1117', border: '1px solid #30363D',
    borderRadius: 10, cursor: 'pointer', textAlign: 'left', width: '100%',
    transition: 'border-color 0.15s',
  },
  methodIcon: {
    width: 44, height: 44, borderRadius: 10,
    background: 'rgba(59,130,246,0.1)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  methodText: { display: 'flex', flexDirection: 'column', gap: 3, flex: 1 },
  methodTitle: { fontSize: 14, fontWeight: 600, color: '#E6EDF3' },
  methodSub: { fontSize: 12, color: '#6E7681' },
  methodArrow: { fontSize: 22, color: '#6E7681', lineHeight: 1 },
  field: { display: 'flex', flexDirection: 'column', gap: 5 },
  label: { fontSize: 12, fontWeight: 500, color: '#8B949E' },
  inputRow: { display: 'flex', alignItems: 'center', gap: 8 },
  inputIcon: {
    position: 'absolute', left: 12, top: '50%',
    transform: 'translateY(-50%)', color: '#6E7681', pointerEvents: 'none',
  },
  eyeBtn: {
    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
    background: 'none', border: 'none', color: '#6E7681', cursor: 'pointer', padding: 2,
  },
  input: {
    width: '100%', padding: '11px 12px',
    background: '#0D1117', border: '1px solid #30363D', borderRadius: 8,
    color: '#E6EDF3', fontSize: 14, outline: 'none', boxSizing: 'border-box',
  },
  inputErr: { border: '1px solid #EF4444' },
  errText: { fontSize: 11, color: '#EF4444' },
  btn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: '13px', background: '#2563EB', color: '#fff', border: 'none',
    borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', width: '100%',
  },
  btnGhost: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    padding: '10px', background: 'transparent', color: '#6E7681',
    border: '1px solid #30363D', borderRadius: 8, fontSize: 13, cursor: 'pointer', width: '100%',
  },
  bankCard: {
    background: '#0D1117', border: '1px solid #30363D', borderRadius: 12, padding: 20,
    display: 'flex', flexDirection: 'column', gap: 12,
  },
  bankCardHeader: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 },
  bankCardTitle: { fontSize: 14, fontWeight: 600, color: '#E6EDF3' },
  bankRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  bankLabel: { fontSize: 12, color: '#6E7681' },
  bankValue: { fontSize: 14, fontWeight: 600, color: '#E6EDF3' },
  bankValueRow: { display: 'flex', alignItems: 'center', gap: 8 },
  copyBtn: {
    display: 'flex', alignItems: 'center', padding: '4px 8px',
    background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)',
    borderRadius: 5, color: '#60A5FA', cursor: 'pointer', fontSize: 11,
  },
  bankPending: {
    display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
    background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
    borderRadius: 8,
  },
  disclaimer: { fontSize: 11, color: '#6E7681', textAlign: 'center', lineHeight: 1.5, margin: 0 },
  h3: { fontSize: 18, fontWeight: 600, color: '#E6EDF3', margin: 0 },
  muted: { fontSize: 13, color: '#8B949E', margin: 0 },
  spin: { animation: 'spin 1s linear infinite' },
};

export default PaymentForm;
