/**
 * TaxWise Payment Form
 * Uses Paystack inline.js popup — works with all card types,
 * no special Paystack approval needed.
 */
import React, { useState } from 'react';
import { Lock, Loader2, CheckCircle } from 'lucide-react';
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
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const loadPaystack = () => new Promise((resolve, reject) => {
    if (window.PaystackPop) { resolve(window.PaystackPop); return; }
    const script = document.createElement('script');
    script.src = 'https://js.paystack.co/v1/inline.js';
    script.onload = () => resolve(window.PaystackPop);
    script.onerror = () => reject(new Error('Failed to load Paystack. Check your internet connection.'));
    document.head.appendChild(script);
  });

  const handlePay = async () => {
    if (!email) { toast.error('Email address is required'); return; }
    setLoading(true);
    try {
      const PaystackPop = await loadPaystack();
      const ref = `txw_${isTrial ? 'trial' : 'sub'}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const kobo = Math.round((amount || 100) * 100);

      const handler = PaystackPop.setup({
        key: config.PAYSTACK_PUBLIC_KEY,
        email,
        amount: kobo,
        currency: 'NGN',
        ref,
        metadata: { organization_id: organizationId, plan, is_trial: isTrial },
        callback: async (response) => {
          setLoading(true);
          try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            const res = await fetch(`${config.SUPABASE_URL}/functions/v1/paystack`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'apikey': config.SUPABASE_ANON_KEY,
                ...(token && { 'Authorization': `Bearer ${token}` }),
              },
              body: JSON.stringify({
                action: 'verify',
                reference: response.reference,
                organization_id: organizationId,
                plan,
                is_trial: isTrial,
              }),
            });

            const data = await res.json();
            if (data.success) {
              setDone(true);
              onSuccess?.(data);
            } else {
              throw new Error(data.error || 'Payment verification failed');
            }
          } catch (err) {
            toast.error(err.message);
            onError?.(err);
          } finally {
            setLoading(false);
          }
        },
        onClose: () => setLoading(false),
      });

      handler.openIframe();
    } catch (err) {
      toast.error(err.message);
      onError?.(err);
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div style={styles.center}>
        <CheckCircle size={64} color="#22C55E" />
        <h3 style={styles.successTitle}>Payment Successful!</h3>
        <p style={styles.successText}>Your subscription is now active.</p>
      </div>
    );
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.secureNotice}>
        <Lock size={14} />
        <span>Secure payment powered by Paystack — PCI DSS compliant</span>
      </div>

      <div style={styles.amountBox}>
        <span style={styles.amountLabel}>Amount</span>
        <span style={styles.amountValue}>₦{(amount || 100).toLocaleString()}</span>
      </div>

      <button style={styles.payBtn} onClick={handlePay} disabled={loading}>
        {loading
          ? <><Loader2 size={20} style={styles.spin} /> Processing…</>
          : <><Lock size={16} /> {buttonText}</>}
      </button>

      <p style={styles.disclaimer}>
        By proceeding, you agree to our terms. Paystack handles card details securely.
      </p>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
};

const styles = {
  wrapper: { display: 'flex', flexDirection: 'column', gap: 16 },
  secureNotice: {
    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
    background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)',
    borderRadius: 8, color: '#22C55E', fontSize: 12
  },
  amountBox: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, background: '#161B22', borderRadius: 8,
  },
  amountLabel: { fontSize: 14, color: '#8B949E' },
  amountValue: { fontSize: 22, fontWeight: 700, color: '#E6EDF3' },
  payBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: '14px 24px', background: '#2563EB', color: '#fff',
    border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600,
    cursor: 'pointer', width: '100%'
  },
  spin: { animation: 'spin 1s linear infinite' },
  disclaimer: { fontSize: 11, color: '#6E7681', textAlign: 'center', lineHeight: 1.5, margin: 0 },
  center: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: 32 },
  successTitle: { fontSize: 20, fontWeight: 600, color: '#E6EDF3', margin: 0 },
  successText: { fontSize: 14, color: '#8B949E', margin: 0 },
};

export default PaymentForm;
