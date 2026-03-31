import React, { useState, useEffect } from 'react';
import {
  X, Check, Lock,
  Calendar, RefreshCw, ChevronRight, CreditCard
} from 'lucide-react';
import { useUIStore, useAuthStore } from '../../store';
import { supabase } from '../../services/supabase';
import SubscriptionService, {
  SUBSCRIPTION_PLANS,
  SUBSCRIPTION_STATUS
} from '../../services/subscriptionService';
import config from '../../config';
import toast from 'react-hot-toast';

// Load Paystack inline script once
function loadPaystackScript() {
  return new Promise((resolve, reject) => {
    if (window.PaystackPop) { resolve(); return; }
    const s = document.createElement('script');
    s.src = 'https://js.paystack.co/v1/inline.js';
    s.onload = resolve;
    s.onerror = () => reject(new Error('Failed to load Paystack'));
    document.head.appendChild(s);
  });
}

const SubscriptionModal = () => {
  const { activeModal, closeModal } = useUIStore();
  const { organization, user } = useAuthStore();

  const [currentSubscription, setCurrentSubscription] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState('sme');
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [view, setView] = useState('plans'); // 'plans' | 'checkout' | 'success'

  const isOpen = activeModal === 'subscription';

  useEffect(() => {
    if (isOpen && organization?.id) {
      loadSubscription();
      setView('plans');
    }
  }, [isOpen, organization?.id]);

  const loadSubscription = async () => {
    setIsLoading(true);
    try {
      const status = await SubscriptionService.getStatus(organization.id);
      setCurrentSubscription(status);
    } catch (error) {
      console.error('Error loading subscription:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Shared fetch helper for Supabase edge function
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
    if (!res.ok && !data.success) throw new Error(data.error || data.message || `Error (${res.status})`);
    return data;
  };

  // Open Paystack standard popup — handles card + bank transfer
  const openPaystackPopup = async () => {
    if (!user?.email) { toast.error('Email address required for billing'); return; }
    setIsProcessing(true);
    try {
      await loadPaystackScript();
      const planData = SUBSCRIPTION_PLANS[selectedPlan];
      const ref = `txw_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

      const handler = window.PaystackPop.setup({
        key: config.PAYSTACK_PUBLIC_KEY,
        email: user.email,
        amount: planData.monthlyPrice * 100, // kobo
        currency: 'NGN',
        ref,
        channels: ['card', 'bank_transfer'],
        label: `TaxWise ${planData.name}`,
        metadata: {
          organization_id: organization?.id,
          plan: selectedPlan,
          custom_fields: [
            { display_name: 'Plan', variable_name: 'plan', value: planData.name },
            { display_name: 'Organization', variable_name: 'org_id', value: organization?.id || '' },
          ],
        },
        callback: (response) => {
          verifyAndComplete(response.reference);
        },
        onClose: () => {
          setIsProcessing(false);
        },
      });

      handler.openIframe();
    } catch (error) {
      toast.error(error.message || 'Could not open payment. Please try again.');
      setIsProcessing(false);
    }
  };

  // Verify reference with Supabase edge function and activate subscription
  const verifyAndComplete = async (reference) => {
    setIsProcessing(true);
    try {
      const data = await paystackFetch({
        action: 'verify',
        reference,
        organization_id: organization?.id,
        plan: selectedPlan,
        is_trial: false,
      });
      if (data.success) {
        setView('success');
        toast.success('Subscription activated!');
        await loadSubscription();
      } else {
        throw new Error(data.error || 'Verification failed');
      }
    } catch (error) {
      toast.error(error.message || 'Payment verification failed. Contact support if you were charged.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdatePaymentMethod = () => {
    setView('checkout');
  };

  const handleCancelSubscription = async () => {
    if (!confirm('Are you sure you want to cancel your subscription?')) return;
    setIsProcessing(true);
    try {
      await SubscriptionService.cancel(organization.id);
      await loadSubscription();
      toast.success('Subscription cancelled');
    } catch (error) {
      toast.error('Failed to cancel subscription');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatPrice = (amount) => `₦${amount.toLocaleString()}`;

  if (!isOpen) return null;

  const statusDisplay = currentSubscription
    ? SubscriptionService.getStatusDisplay(currentSubscription.status)
    : null;

  const selectedPlanData = SUBSCRIPTION_PLANS[selectedPlan];

  return (
    <div style={styles.overlay} onClick={closeModal}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div style={styles.header}>
          <h2 style={styles.title}>
            {view === 'success' ? 'Subscription Activated' :
             view === 'checkout' ? 'Payment' : 'Subscription Plans'}
          </h2>
          <button style={styles.closeButton} onClick={closeModal}>
            <X size={20} />
          </button>
        </div>

        {isLoading ? (
          <div style={styles.loadingContainer}>
            <RefreshCw size={32} className="spin" style={{ color: '#3B82F6' }} />
            <span style={styles.loadingText}>Loading subscription details...</span>
          </div>

        ) : view === 'success' ? (
          <div style={styles.successContainer}>
            <div style={styles.successIcon}><Check size={48} /></div>
            <h3 style={styles.successTitle}>Welcome to TaxWise!</h3>
            <p style={styles.successText}>
              Your {SUBSCRIPTION_PLANS[selectedPlan].name} subscription is now active.
              You have full access to all features.
            </p>
            <button style={styles.primaryButton} onClick={closeModal}>Get Started</button>
          </div>

        ) : view === 'checkout' ? (
          <div style={styles.content}>
            {/* Order summary */}
            <div style={styles.checkoutSummary}>
              <h3 style={styles.checkoutTitle}>Order Summary</h3>
              <div style={styles.summaryRow}>
                <span>{selectedPlanData.name}</span>
                <span>{formatPrice(selectedPlanData.monthlyPrice)}</span>
              </div>
              <div style={styles.summaryRow}>
                <span>Billing Cycle</span>
                <span>Monthly</span>
              </div>
              <div style={styles.totalRow}>
                <span style={{ fontSize: '14px', fontWeight: '600', color: '#E6EDF3' }}>Total</span>
                <span style={styles.totalAmount}>
                  {formatPrice(selectedPlanData.monthlyPrice)}
                  <span style={styles.billingPeriod}>/month</span>
                </span>
              </div>
            </div>

            {/* Payment method info */}
            <div style={styles.paymentInfo}>
              <div style={styles.paymentInfoRow}>
                <CreditCard size={16} style={{ color: '#22C55E', flexShrink: 0 }} />
                <span>Card payment (Visa, Mastercard, Verve)</span>
              </div>
              <div style={styles.paymentInfoRow}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><rect x="3" y="8" width="18" height="13" rx="2"/><path d="M7 8V6a5 5 0 0 1 10 0v2"/></svg>
                <span>Bank transfer (pay directly from your bank)</span>
              </div>
              <div style={styles.secureNotice}>
                <Lock size={13} />
                <span>Secured by Paystack · PCI DSS compliant</span>
              </div>
            </div>

            <div style={styles.disclaimer}>
              Your subscription renews automatically each month. You can cancel anytime.
            </div>

            <div style={styles.checkoutActions}>
              <button style={styles.backButton} onClick={() => setView('plans')}>
                Back
              </button>
              <button
                style={{ ...styles.payButton, opacity: isProcessing ? 0.7 : 1 }}
                onClick={openPaystackPopup}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <><RefreshCw size={16} className="spin" /> Opening payment…</>
                ) : (
                  <><Lock size={15} /> Pay {formatPrice(selectedPlanData.monthlyPrice)}</>
                )}
              </button>
            </div>
          </div>

        ) : (
          /* Plans view */
          <div style={styles.content}>
            {/* Current subscription status */}
            {currentSubscription && currentSubscription.status !== SUBSCRIPTION_STATUS.TRIAL && (
              <div style={styles.currentPlan}>
                <div style={styles.currentPlanHeader}>
                  <div>
                    <span style={styles.currentLabel}>Current Plan</span>
                    <h3 style={styles.currentPlanName}>
                      {currentSubscription.planId
                        ? SUBSCRIPTION_PLANS[currentSubscription.planId]?.name
                        : 'Free Trial'}
                    </h3>
                  </div>
                  <span
                    style={{
                      ...styles.statusBadge,
                      backgroundColor: `${statusDisplay?.color}15`,
                      color: statusDisplay?.color,
                    }}
                  >
                    {statusDisplay?.text}
                  </span>
                </div>

                {currentSubscription.currentPeriodEnd && (
                  <div style={styles.renewalInfo}>
                    <Calendar size={14} />
                    <span>
                      {currentSubscription.status === SUBSCRIPTION_STATUS.ACTIVE
                        ? `Renews on ${new Date(currentSubscription.currentPeriodEnd).toLocaleDateString()}`
                        : `Expires on ${new Date(currentSubscription.currentPeriodEnd).toLocaleDateString()}`}
                    </span>
                  </div>
                )}

                <div style={styles.manageActions}>
                  <button style={styles.manageButton} onClick={handleUpdatePaymentMethod} disabled={isProcessing}>
                    Update Payment Method
                  </button>
                  <button style={styles.cancelButton} onClick={handleCancelSubscription} disabled={isProcessing}>
                    Cancel Subscription
                  </button>
                </div>
              </div>
            )}

            {/* Plans grid */}
            <div style={styles.plansGrid}>
              {Object.values(SUBSCRIPTION_PLANS).map((plan) => (
                <div
                  key={plan.id}
                  style={{
                    ...styles.planCard,
                    ...(selectedPlan === plan.id ? styles.planCardSelected : {}),
                  }}
                  onClick={() => setSelectedPlan(plan.id)}
                >
                  {plan.id === 'sme' && (
                    <div style={styles.popularBadge}>Most Popular</div>
                  )}

                  <div style={styles.planHeader}>
                    <h3 style={styles.planName}>{plan.name}</h3>
                    <div style={styles.planPrice}>
                      <span style={styles.priceAmount}>{formatPrice(plan.monthlyPrice)}</span>
                      <span style={styles.pricePeriod}>/month</span>
                    </div>
                  </div>

                  <ul style={styles.featureList}>
                    {plan.features.slice(0, 6).map((feature, idx) => (
                      <li key={idx} style={styles.featureItem}>
                        <Check size={16} style={styles.checkIcon} />
                        <span>{feature}</span>
                      </li>
                    ))}
                    {plan.features.length > 6 && (
                      <li style={styles.moreFeatures}>+{plan.features.length - 6} more features</li>
                    )}
                  </ul>

                  <button
                    style={{
                      ...styles.selectPlanButton,
                      ...(selectedPlan === plan.id ? styles.selectPlanButtonActive : {}),
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedPlan(plan.id);
                      setView('checkout');
                    }}
                  >
                    {selectedPlan === plan.id ? 'Selected' : 'Select Plan'}
                    <ChevronRight size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <style>{`
          .spin { animation: spin 1s linear infinite; }
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        `}</style>
      </div>
    </div>
  );
};

const styles = {
  overlay: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.75)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9000,
  },
  modal: {
    width: '100%', maxWidth: '800px', maxHeight: '90vh',
    backgroundColor: '#161B22', borderRadius: '16px',
    border: '1px solid #30363D', overflow: 'hidden',
    display: 'flex', flexDirection: 'column',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '20px 24px', borderBottom: '1px solid #30363D',
  },
  title: { fontSize: '18px', fontWeight: '600', color: '#E6EDF3', margin: 0 },
  closeButton: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: '32px', height: '32px', backgroundColor: 'transparent',
    border: 'none', color: '#8B949E', cursor: 'pointer', borderRadius: '6px',
  },
  content: { padding: '24px', overflowY: 'auto' },
  loadingContainer: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', padding: '60px', gap: '16px',
  },
  loadingText: { color: '#8B949E', fontSize: '14px' },
  successContainer: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', padding: '48px', textAlign: 'center',
  },
  successIcon: {
    width: '80px', height: '80px', borderRadius: '50%',
    backgroundColor: 'rgba(34,197,94,0.1)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#22C55E', marginBottom: '24px',
  },
  successTitle: { fontSize: '24px', fontWeight: '600', color: '#E6EDF3', margin: '0 0 12px 0' },
  successText: { fontSize: '14px', color: '#8B949E', margin: '0 0 32px 0' },
  primaryButton: {
    padding: '14px 32px', backgroundColor: '#2563EB', border: 'none',
    borderRadius: '8px', color: 'white', fontSize: '14px', fontWeight: '500', cursor: 'pointer',
  },
  currentPlan: {
    padding: '20px', backgroundColor: '#0D1117',
    border: '1px solid #30363D', borderRadius: '12px', marginBottom: '24px',
  },
  currentPlanHeader: {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: '12px',
  },
  currentLabel: { fontSize: '12px', color: '#8B949E', textTransform: 'uppercase' },
  currentPlanName: { fontSize: '18px', fontWeight: '600', color: '#E6EDF3', margin: '4px 0 0 0' },
  statusBadge: { padding: '4px 12px', borderRadius: '9999px', fontSize: '12px', fontWeight: '500' },
  renewalInfo: {
    display: 'flex', alignItems: 'center', gap: '8px',
    fontSize: '13px', color: '#8B949E', marginBottom: '16px',
  },
  manageActions: { display: 'flex', gap: '12px' },
  manageButton: {
    padding: '10px 16px', backgroundColor: '#21262D', border: 'none',
    borderRadius: '6px', color: '#E6EDF3', fontSize: '13px', cursor: 'pointer',
  },
  cancelButton: {
    padding: '10px 16px', backgroundColor: 'transparent',
    border: '1px solid #30363D', borderRadius: '6px',
    color: '#EF4444', fontSize: '13px', cursor: 'pointer',
  },
  plansGrid: { display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '16px' },
  planCard: {
    position: 'relative', padding: '24px', backgroundColor: '#0D1117',
    border: '1px solid #30363D', borderRadius: '12px',
    cursor: 'pointer', transition: 'all 0.15s ease',
  },
  planCardSelected: { borderColor: '#2563EB', backgroundColor: 'rgba(37,99,235,0.05)' },
  popularBadge: {
    position: 'absolute', top: '-10px', right: '16px',
    padding: '4px 12px', backgroundColor: '#2563EB',
    borderRadius: '4px', fontSize: '11px', fontWeight: '600', color: 'white',
  },
  planHeader: { marginBottom: '20px' },
  planName: { fontSize: '18px', fontWeight: '600', color: '#E6EDF3', margin: '0 0 12px 0' },
  planPrice: { display: 'flex', alignItems: 'baseline', gap: '4px' },
  priceAmount: { fontSize: '32px', fontWeight: '700', color: '#E6EDF3' },
  pricePeriod: { fontSize: '14px', color: '#8B949E' },
  featureList: { listStyle: 'none', margin: '0 0 20px 0', padding: 0 },
  featureItem: {
    display: 'flex', alignItems: 'center', gap: '10px',
    fontSize: '13px', color: '#E6EDF3', marginBottom: '10px',
  },
  checkIcon: { color: '#22C55E', flexShrink: 0 },
  moreFeatures: { fontSize: '13px', color: '#3B82F6', marginTop: '8px' },
  selectPlanButton: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
    width: '100%', padding: '12px', backgroundColor: '#21262D',
    border: 'none', borderRadius: '8px', color: '#E6EDF3',
    fontSize: '14px', fontWeight: '500', cursor: 'pointer',
  },
  selectPlanButtonActive: { backgroundColor: '#2563EB', color: 'white' },
  checkoutSummary: {
    padding: '20px', backgroundColor: '#0D1117',
    border: '1px solid #30363D', borderRadius: '12px', marginBottom: '20px',
  },
  checkoutTitle: { fontSize: '16px', fontWeight: '600', color: '#E6EDF3', margin: '0 0 16px 0' },
  summaryRow: {
    display: 'flex', justifyContent: 'space-between',
    fontSize: '14px', color: '#8B949E', marginBottom: '12px',
  },
  totalRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: '16px', borderTop: '1px solid #30363D',
  },
  totalAmount: { fontSize: '24px', fontWeight: '700', color: '#E6EDF3' },
  billingPeriod: { fontSize: '14px', fontWeight: '400', color: '#8B949E' },
  paymentInfo: {
    display: 'flex', flexDirection: 'column', gap: '10px',
    padding: '16px', backgroundColor: '#0D1117',
    border: '1px solid #30363D', borderRadius: '10px', marginBottom: '16px',
  },
  paymentInfoRow: {
    display: 'flex', alignItems: 'center', gap: '10px',
    fontSize: '13px', color: '#8B949E',
  },
  secureNotice: {
    display: 'flex', alignItems: 'center', gap: '8px',
    paddingTop: '10px', borderTop: '1px solid #30363D',
    color: '#22C55E', fontSize: '12px',
  },
  disclaimer: {
    fontSize: '11px', color: '#6E7681', textAlign: 'center',
    lineHeight: 1.5, marginBottom: '16px',
  },
  checkoutActions: { display: 'flex', gap: '12px' },
  backButton: {
    padding: '14px 24px', backgroundColor: 'transparent',
    border: '1px solid #30363D', borderRadius: '8px',
    color: '#8B949E', fontSize: '14px', fontWeight: '500', cursor: 'pointer',
  },
  payButton: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
    padding: '14px', backgroundColor: '#2563EB', border: 'none',
    borderRadius: '8px', color: 'white', fontSize: '14px', fontWeight: '500', cursor: 'pointer',
  },
};

export default SubscriptionModal;
