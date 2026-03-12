import React from 'react';
import { AlertCircle, RefreshCw, LogOut, Calculator } from 'lucide-react';
import { useAuthStore } from '../../store';
import { SUBSCRIPTION_PLANS } from '../../services/subscriptionService';

const SubscriptionExpired = ({ onReactivate }) => {
  const { organization, logout } = useAuthStore();

  const tier = organization?.subscription_tier || 'sme';
  const status = organization?.subscription_status || 'expired';
  const planName = SUBSCRIPTION_PLANS[tier]?.name || tier;
  const planPrice = SUBSCRIPTION_PLANS[tier]?.monthlyPrice
    ? `₦${SUBSCRIPTION_PLANS[tier].monthlyPrice.toLocaleString()}/month + VAT`
    : '';

  const statusMessages = {
    pending: {
      title: 'Payment Required',
      subtitle: 'Your account is set up but payment has not been verified yet.',
      detail: 'Please sign out, go to Register, and complete the payment step to activate your 14-day free trial.'
    },
    past_due: {
      title: 'Payment Failed',
      subtitle: 'We were unable to charge your card for this billing period.',
      detail: 'Your access has been paused. Please update your payment method to continue.'
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

  const handleLogout = () => {
    logout();
  };

  return (
    <div style={styles.container}>
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
        <div style={styles.actions}>
          <button style={styles.primaryBtn} onClick={onReactivate}>
            <RefreshCw size={18} />
            Reactivate Subscription
          </button>
          <button style={styles.logoutBtn} onClick={handleLogout}>
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
