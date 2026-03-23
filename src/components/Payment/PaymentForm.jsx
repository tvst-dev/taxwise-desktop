/**
 * TaxWise Invisible Payment Form
 * Direct card charge via Paystack — no popup, no redirect.
 * Card data goes to our Paystack edge function (never stored).
 */
import React, { useState } from 'react';
import { CreditCard, Lock, Calendar, Shield, Loader2, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import config from '../../config';
import { supabase } from '../../services/supabase';

const PaymentForm = ({
  email,
  amount,
  plan,
  organizationId,
  isTrial = false,
  onSuccess,
  onError,
  buttonText = 'Pay Now'
}) => {
  const [card, setCard] = useState({ number: '', expiry: '', cvv: '', name: '' });
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('card'); // card | otp | 3ds | success
  const [otpValue, setOtpValue] = useState('');
  const [reference, setReference] = useState('');
  const [errors, setErrors] = useState({});

  const formatCardNumber = (value) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = (matches && matches[0]) || '';
    const parts = [];
    for (let i = 0, len = match.length; i < len; i += 4) parts.push(match.substring(i, i + 4));
    return parts.length ? parts.join(' ') : value;
  };

  const formatExpiry = (value) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    return v.length >= 2 ? v.substring(0, 2) + '/' + v.substring(2, 4) : v;
  };

  const validateCard = () => {
    const e = {};
    if (!card.number.replace(/\s/g, '') || card.number.replace(/\s/g, '').length < 16) e.number = 'Valid 16-digit card number required';
    if (!card.expiry || card.expiry.length < 5) e.expiry = 'Valid expiry required (MM/YY)';
    if (!card.cvv || card.cvv.length < 3) e.cvv = 'Valid CVV required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const paystackFetch = async (body) => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const res = await fetch(`${config.SUPABASE_URL}/functions/v1/paystack`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': config.SUPABASE_ANON_KEY,
        ...(token && { 'Authorization': `Bearer ${token}` }),
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok && !data.success) throw new Error(data.error || data.message || `Request failed (${res.status})`);
    return data;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateCard()) return;
    setLoading(true);
    try {
      const [expiryMonth, expiryYear] = card.expiry.split('/');
      const data = await paystackFetch({
        action: 'charge_card',
        email,
        amount: Math.round((amount || 100) * 100), // kobo
        plan,
        is_trial: isTrial,
        card: {
          number: card.number.replace(/\s/g, ''),
          cvv: card.cvv,
          expiry_month: expiryMonth?.trim(),
          expiry_year: '20' + (expiryYear?.trim() || ''),
        },
        metadata: { organization_id: organizationId },
      });

      if (data.success) {
        setReference(data.reference);
        if (data.status === 'success' || data.status === 'charge_attempted') {
          await verifyPayment(data.reference);
        } else if (data.status === 'send_otp' || data.status === 'send_pin') {
          setStep('otp');
          toast.success(data.display_text || 'Enter the OTP sent to your phone/email');
        } else if (data.status === '3ds_required') {
          setStep('3ds');
          window.open(data.url, '_blank', 'width=520,height=620');
          toast('Complete the bank authentication in the popup window, then return here.');
          pollForCompletion(data.reference);
        } else {
          throw new Error(data.message || 'Payment failed. Please try again.');
        }
      } else {
        throw new Error(data.error || 'Payment failed. Please try again.');
      }
    } catch (err) {
      console.error('Payment error:', err);
      toast.error(err.message);
      onError?.(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    if (!otpValue || otpValue.length < 4) { toast.error('Please enter a valid OTP'); return; }
    setLoading(true);
    try {
      const data = await paystackFetch({ action: 'submit_otp', reference, otp: otpValue });
      if (data.status && data.data?.status === 'success') {
        await verifyPayment(reference);
      } else {
        throw new Error(data.message || 'OTP verification failed');
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const verifyPayment = async (ref) => {
    try {
      const data = await paystackFetch({
        action: 'verify',
        reference: ref,
        organization_id: organizationId,
        plan,
        is_trial: isTrial,
      });
      if (data.success) {
        setStep('success');
        toast.success('Payment successful!');
        onSuccess?.(data);
      } else {
        throw new Error(data.error || 'Verification failed');
      }
    } catch (err) {
      toast.error(err.message);
      onError?.(err);
    }
  };

  const pollForCompletion = (ref) => {
    let attempts = 0;
    const poll = async () => {
      if (++attempts > 60) { toast.error('Authentication timed out. Please try again.'); setStep('card'); return; }
      try {
        const data = await paystackFetch({ action: 'verify', reference: ref, organization_id: organizationId, plan, is_trial: isTrial });
        if (data.success) { setStep('success'); toast.success('Payment successful!'); onSuccess?.(data); }
        else setTimeout(poll, 5000);
      } catch { setTimeout(poll, 5000); }
    };
    setTimeout(poll, 5000);
  };

  if (step === 'success') {
    return (
      <div style={s.center}>
        <CheckCircle size={64} color="#22C55E" />
        <h3 style={s.successTitle}>Payment Successful!</h3>
        <p style={s.successText}>Your subscription is now active.</p>
      </div>
    );
  }

  if (step === 'otp') {
    return (
      <form onSubmit={handleOtpSubmit} style={s.form}>
        <div style={s.center}>
          <Shield size={48} color="#2563EB" />
          <h3 style={s.otpTitle}>OTP Verification</h3>
          <p style={s.otpSub}>Enter the one-time code sent to your phone or email</p>
          <input
            type="text"
            inputMode="numeric"
            value={otpValue}
            onChange={(e) => setOtpValue(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            style={s.otpInput}
            maxLength={6}
            autoFocus
          />
          <button type="submit" style={s.submitBtn} disabled={loading}>
            {loading ? <><Loader2 size={18} style={s.spin} /> Verifying…</> : 'Verify OTP'}
          </button>
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </form>
    );
  }

  if (step === '3ds') {
    return (
      <div style={s.center}>
        <Loader2 size={48} color="#2563EB" style={s.spin} />
        <h3 style={s.otpTitle}>Awaiting Authentication</h3>
        <p style={s.otpSub}>Complete the 3D Secure step in the popup, then this screen will update automatically.</p>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={s.form}>
      <div style={s.secureBar}>
        <Lock size={13} />
        <span>256-bit encrypted &nbsp;·&nbsp; PCI DSS compliant &nbsp;·&nbsp; Powered by Paystack</span>
      </div>

      <div style={s.field}>
        <label style={s.label}>Card Number</label>
        <div style={s.inputWrap}>
          <CreditCard size={17} style={s.icon} />
          <input
            type="text"
            value={card.number}
            onChange={(e) => setCard({ ...card, number: formatCardNumber(e.target.value) })}
            placeholder="1234 5678 9012 3456"
            style={{ ...s.input, ...(errors.number ? s.inputErr : {}) }}
            maxLength={19}
          />
        </div>
        {errors.number && <span style={s.errText}>{errors.number}</span>}
      </div>

      <div style={s.row}>
        <div style={{ ...s.field, flex: 1 }}>
          <label style={s.label}>Expiry</label>
          <div style={s.inputWrap}>
            <Calendar size={17} style={s.icon} />
            <input
              type="text"
              value={card.expiry}
              onChange={(e) => setCard({ ...card, expiry: formatExpiry(e.target.value) })}
              placeholder="MM/YY"
              style={{ ...s.input, ...(errors.expiry ? s.inputErr : {}) }}
              maxLength={5}
            />
          </div>
          {errors.expiry && <span style={s.errText}>{errors.expiry}</span>}
        </div>

        <div style={{ ...s.field, flex: 1 }}>
          <label style={s.label}>CVV</label>
          <div style={s.inputWrap}>
            <Lock size={17} style={s.icon} />
            <input
              type="password"
              value={card.cvv}
              onChange={(e) => setCard({ ...card, cvv: e.target.value.replace(/\D/g, '').slice(0, 4) })}
              placeholder="•••"
              style={{ ...s.input, ...(errors.cvv ? s.inputErr : {}) }}
              maxLength={4}
            />
          </div>
          {errors.cvv && <span style={s.errText}>{errors.cvv}</span>}
        </div>
      </div>

      <div style={s.amountBox}>
        <span style={s.amountLabel}>Total</span>
        <span style={s.amountValue}>₦{(amount || 100).toLocaleString()}</span>
      </div>

      <button type="submit" style={s.submitBtn} disabled={loading}>
        {loading
          ? <><Loader2 size={18} style={s.spin} /> Processing…</>
          : <><Lock size={16} /> {buttonText}</>}
      </button>

      <p style={s.disclaimer}>
        Your card details are sent directly to Paystack and never stored on our servers.
        By proceeding you agree to our billing terms.
      </p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </form>
  );
};

const s = {
  form: { display: 'flex', flexDirection: 'column', gap: 14 },
  secureBar: {
    display: 'flex', alignItems: 'center', gap: 7, padding: '8px 12px',
    background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)',
    borderRadius: 8, color: '#22C55E', fontSize: 12
  },
  field: { display: 'flex', flexDirection: 'column', gap: 5 },
  label: { fontSize: 13, fontWeight: 500, color: '#8B949E' },
  inputWrap: { position: 'relative', display: 'flex', alignItems: 'center' },
  icon: { position: 'absolute', left: 12, color: '#8B949E', pointerEvents: 'none' },
  input: {
    width: '100%', padding: '12px 12px 12px 40px', background: '#0D1117',
    border: '1px solid #30363D', borderRadius: 8, color: '#E6EDF3',
    fontSize: 14, outline: 'none', boxSizing: 'border-box'
  },
  inputErr: { borderColor: '#EF4444' },
  errText: { fontSize: 12, color: '#EF4444' },
  row: { display: 'flex', gap: 12 },
  amountBox: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '14px 16px', background: '#161B22', borderRadius: 8, border: '1px solid #30363D'
  },
  amountLabel: { fontSize: 13, color: '#8B949E' },
  amountValue: { fontSize: 20, fontWeight: 700, color: '#E6EDF3' },
  submitBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: '14px', background: '#2563EB', color: '#fff', border: 'none',
    borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: 'pointer', width: '100%'
  },
  disclaimer: { fontSize: 11, color: '#6E7681', textAlign: 'center', lineHeight: 1.6, margin: 0 },
  center: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '16px 0' },
  successTitle: { fontSize: 20, fontWeight: 700, color: '#E6EDF3', margin: 0 },
  successText: { fontSize: 14, color: '#8B949E', margin: 0 },
  otpTitle: { fontSize: 18, fontWeight: 600, color: '#E6EDF3', margin: 0 },
  otpSub: { fontSize: 14, color: '#8B949E', margin: 0, textAlign: 'center', maxWidth: 300 },
  otpInput: {
    width: 200, padding: '14px', background: '#0D1117', border: '2px solid #30363D',
    borderRadius: 8, color: '#E6EDF3', fontSize: 24, textAlign: 'center', letterSpacing: 8, outline: 'none'
  },
  spin: { animation: 'spin 1s linear infinite' },
};

export default PaymentForm;
