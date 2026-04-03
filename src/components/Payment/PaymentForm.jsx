/**
 * TaxWise Payment Form
 * Opens Paystack checkout via local proxy server (port 5555).
 * Secret key is never exposed to the renderer.
 */
import React, { useState } from 'react';
import { Lock, Loader2, CheckCircle, CreditCard } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../services/supabase';

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
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handlePay = async () => {
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
    <div style={s.wrapper}>
      <div style={s.secureBar}>
        <Lock size={13} />
        <span>Secured by Paystack · Card &amp; Bank Transfer accepted</span>
      </div>

      <div style={s.amountBox}>
        <span style={s.amountLabel}>{isTrial ? 'Card verification (refundable)' : 'Total'}</span>
        <span style={s.amountValue}>₦{(amount || 100).toLocaleString()}</span>
      </div>

      <button onClick={handlePay} style={{ ...s.submitBtn, opacity: loading ? 0.7 : 1 }} disabled={loading}>
        {loading
          ? <><Loader2 size={18} style={s.spin} /> Opening payment…</>
          : <><CreditCard size={16} /> {buttonText}</>}
      </button>

      <p style={s.disclaimer}>
        {isTrial
          ? 'A ₦100 card verification charge is applied today and will be refunded. Full plan price applies from day 15.'
          : 'Payment is processed securely by Paystack. Your card details are never stored on our servers.'}
      </p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
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
    padding: '14px 16px', background: '#161B22', borderRadius: 8, border: '1px solid #30363D',
  },
  amountLabel: { fontSize: 13, color: '#8B949E' },
  amountValue: { fontSize: 20, fontWeight: 700, color: '#E6EDF3' },
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
