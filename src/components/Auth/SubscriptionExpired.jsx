import React, { useState } from 'react';
import { AlertCircle, RefreshCw, LogOut, Loader } from 'lucide-react';
import { useAuthStore } from '../../store';
import { SUBSCRIPTION_PLANS } from '../../services/subscriptionService';
import config from '../../config';

const SubscriptionExpired = () => {
  const { user, organization, login, logout } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const tier = organization?.subscription_tier || 'sme';
  const status = organization?.subscription_status || 'expired';
  const planName = SUBSCRIPTION_PLANS[tier]?.name || tier;
  const planPrice = SUBSCRIPTION_PLANS[tier]?.monthlyPrice
    ? `₦${SUBSCRIPTION_PLANS[tier].monthlyPrice.toLocaleString()}/month + VAT`
    : '';
  const isTrial = status === 'pending';

  const statusMessages = {
    pending: {
      title: 'Payment Required',
      subtitle: 'Your account is ready — complete payment to start your 14-day free trial.',
      detail: 'A ₦100 refundable card verification charge will be applied. Your card is stored for automatic billing after the trial.'
    },
    past_due: {
      title: 'Payment Failed',
      subtitle: 'We were unable to charge your card for this billing period.',
      detail: 'Enter your card details below to reactivate your subscription.'
    },
    expired: {
      title: 'Subscription Expired',
      subtitle: 'Your subscription period has ended.',
      detail: 'Reactivate to regain full access to TaxWise.'
    },
    cancelled: {
      title: 'Subscription Cancelled',
      subtitle: 'Your subscription has been cancelled.',
      detail: 'You can reactivate at any time to restore full access.'
    }
  };

  const msg = statusMessages[status] || statusMessages.expired;

  const loadPaystackInline = () => new Promise((resolve, reject) => {
    if (window.PaystackPop) { resolve(); return; }
    const script = document.createElement('script');
    script.src = 'https://js.paystack.co/v1/inline.js';
    script.onload = resolve;
    script.onerror = () => reject(new Error('Failed to load payment SDK. Check your connection.'));
    document.head.appendChild(script);
  });

  const handlePayment = async () => {
    setError('');
    setIsLoading(true);
    try {
      const initRes = await fetch(`${config.SUPABASE_URL}/functions/v1/paystack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': config.SUPABASE_ANON_KEY },
        body: JSON.stringify({
          action: 'initialize',
          email: user.email,
          is_trial: isTrial,
          plan: tier,
          organization_id: organization.id
        })
      });
      const initData = await initRes.json();
      if (!initData.success) throw new Error(initData.error || 'Payment setup failed');

      await loadPaystackInline();

      const reference = await new Promise((resolve, reject) => {
        window.PaystackPop.setup({
          key: config.PAYSTACK_PUBLIC_KEY,
          access_code: initData.access_code,
          callback: (resp) => resolve(resp.reference),
          onClose: () => reject(new Error('Payment cancelled'))
        }).openIframe();
      });

      const verifyRes = await fetch(`${config.SUPABASE_URL}/functions/v1/paystack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': config.SUPABASE_ANON_KEY },
        body: JSON.stringify({
          action: 'verify',
          reference,
          organization_id: organization.id,
          plan: tier,
          is_trial: isTrial
        })
      });
      const verifyData = await verifyRes.json();
      if (!verifyData.success) throw new Error(verifyData.error || 'Verification failed');

      // Update store — ProtectedRoute will re-render and allow access
      login(user, { ...organization, subscription_status: isTrial ? 'trial' : 'active' });
    } catch (err) {
      if (err.message !== 'Payment cancelled') setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={styles.card}>
        {/* Icon */}
        <div style={styles.iconWrapper}>
          <AlertCircle size={48} color="#EF4444" />
        </div>

        {/* Heading */}
        <h1 style={styles.title}>{msg.title}</h1>
        <p style={styles.subtitle}>{msg.subtitle}</p>
        <p style={styles.detail}>{msg.detail}</p>

        {/* Plan info */}
        <div style={styles.planBox}>
          <div style={styles.planRow}>
            <span style={styles.planLabel}>Business</span>
            <span style={styles.planValue}>{organization?.name || 'Your Organization'}</span>
          </div>
          <div style={styles.planRow}>
            <span style={styles.planLabel}>Plan</span>
            <span style={styles.planValue}>{planName}</span>
          </div>
          {planPrice && (
            <div style={styles.planRow}>
              <span style={styles.planLabel}>Price</span>
              <span style={styles.planValue}>{planPrice}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        {error && (
          <p style={{ color: '#EF4444', fontSize: 13, textAlign: 'center', margin: '0 0 4px' }}>{error}</p>
        )}
        <div style={styles.actions}>
          <button style={{ ...styles.primaryBtn, opacity: isLoading ? 0.7 : 1 }} onClick={handlePayment} disabled={isLoading}>
            {isLoading
              ? <><Loader size={18} style={{ animation: 'spin 1s linear infinite' }} /> Processing…</>
              : <><RefreshCw size={18} />{isTrial ? 'Start 14-Day Free Trial' : 'Reactivate Subscription'}</>
            }
          </button>
          <button style={styles.logoutBtn} onClick={logout} disabled={isLoading}>
            <LogOut size={16} />
            Sign Out
          </button>
        </div>

        <p style={styles.help}>
          Need help? Contact us at{' '}
          <a href="mailto:support@taxwise.ng" style={styles.link}>support@taxwise.ng</a>
        </p>
      </div>
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    backgroundColor: '#0D1117',
    padding: '40px 20px'
  },
  card: {
    width: '100%',
    maxWidth: '460px',
    backgroundColor: '#161B22',
    border: '1px solid #30363D',
    borderRadius: '16px',
    padding: '40px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px',
    textAlign: 'center'
  },
  iconWrapper: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '8px'
  },
  title: {
    fontSize: '22px',
    fontWeight: '700',
    color: '#E6EDF3',
    margin: 0
  },
  subtitle: {
    fontSize: '15px',
    color: '#8B949E',
    margin: 0
  },
  detail: {
    fontSize: '13px',
    color: '#6E7681',
    margin: 0,
    lineHeight: '1.6'
  },
  planBox: {
    width: '100%',
    backgroundColor: '#0D1117',
    border: '1px solid #30363D',
    borderRadius: '10px',
    padding: '16px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    margin: '8px 0'
  },
  planRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '14px'
  },
  planLabel: {
    color: '#6E7681'
  },
  planValue: {
    color: '#E6EDF3',
    fontWeight: '600'
  },
  actions: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    marginTop: '8px'
  },
  primaryBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    width: '100%',
    padding: '14px',
    backgroundColor: '#2563EB',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer'
  },
  logoutBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    width: '100%',
    padding: '12px',
    backgroundColor: 'transparent',
    border: '1px solid #30363D',
    borderRadius: '8px',
    color: '#8B949E',
    fontSize: '14px',
    cursor: 'pointer'
  },
  help: {
    fontSize: '12px',
    color: '#6E7681',
    marginTop: '8px'
  },
  link: {
    color: '#2563EB',
    textDecoration: 'none'
  }
};

export default SubscriptionExpired;
