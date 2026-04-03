import React, { useState, useEffect } from 'react';
import {
  X, Check, Lock,
  Calendar, RefreshCw, ChevronRight, CreditCard, Building2
} from 'lucide-react';
import { useUIStore, useAuthStore } from '../../store';
import { supabase } from '../../services/supabase';
import SubscriptionService, {
  SUBSCRIPTION_PLANS,
  SUBSCRIPTION_STATUS
} from '../../services/subscriptionService';
import toast from 'react-hot-toast';

const SubscriptionModal = () => {
  const { activeModal, closeModal } = useUIStore();
  const { organization, user } = useAuthStore();

  const [currentSubscription, setCurrentSubscription] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState('sme');
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [view, setView] = useState('plans'); // 'plans' | 'checkout' | 'success'
  const [payMethod, setPayMethod] = useState('card'); // 'card' | 'bank'

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

  // Initialize payment via local Paystack proxy server and open popup
  const openPaystackPopup = async () => {
    if (!user?.email) { toast.error('Email address required for billing'); return; }
    setIsProcessing(true);
    try {
      const planData = SUBSCRIPTION_PLANS[selectedPlan];

      // Init transaction via local Express server (secret key stays on backend)
      const initRes = await fetch('http://localhost:5555/api/init-transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          amount: planData.monthlyPrice * 100, // kobo
          metadata: { organization_id: organization?.id, plan: selectedPlan },
        }),
      });
      const initData = await initRes.json();
      if (!initData.status) throw new Error(initData.error || 'Failed to initialize payment');

      // Open Paystack checkout in Electron BrowserWindow popup
      const result = await window.electronAPI.payment.openPopup(initData.authUrl);
      if (!result.success) throw new Error(result.error || 'Payment cancelled');

      // Verify and activate subscription
      await verifyAndComplete(result.reference || initData.reference);
    } catch (error) {
      toast.error(error.message || 'Payment failed. Please try again.');
      setIsProcessing(false);
    }
  };

  // Verify via local server and activate subscription in Supabase
  const verifyAndComplete = async (reference) => {
    setIsProcessing(true);
    try {
      // Verify payment via local proxy server
      const verifyRes = await fetch(`http://localhost:5555/api/verify/${reference}`);
      const verifyData = await verifyRes.json();

      if (verifyData.data?.status !== 'success') {
        throw new Error('Payment not confirmed. Please try again or contact support.');
      }

      const now = new Date().toISOString();
      const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      // Record subscription in Supabase
      await supabase.from('subscriptions').upsert({
        organization_id: organization.id,
        plan: selectedPlan,
        status: 'active',
        paystack_reference: reference,
        current_period_start: now,
        current_period_end: periodEnd,
      }, { onConflict: 'organization_id' });

      // Update organization status
      await supabase.from('organizations').update({
        subscription_status: 'active',
        subscription_tier: selectedPlan,
      }).eq('id', organization.id);

      setView('success');
      toast.success('Subscription activated!');
      await loadSubscription();
    } catch (error) {
      toast.error(error.message || 'Verification failed. Contact support if you were charged.');
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
                <span>{selectedPlanData.name} Plan</span>
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

            {/* Payment method tabs */}
            <div style={styles.methodTabs}>
              <button
                type="button"
                style={{ ...styles.methodTab, ...(payMethod === 'card' ? styles.methodTabActive : {}) }}
                onClick={() => setPayMethod('card')}
              >
                <CreditCard size={15} />
                <span>Debit / Credit Card</span>
              </button>
              <button
                type="button"
                style={{ ...styles.methodTab, ...(payMethod === 'bank' ? styles.methodTabActive : {}) }}
                onClick={() => setPayMethod('bank')}
              >
                <Building2 size={15} />
                <span>Bank Transfer</span>
              </button>
            </div>

            {/* Card method detail */}
            {payMethod === 'card' && (
              <div style={styles.methodDetail}>
                <div style={styles.paymentInfoRow}>
                  <CreditCard size={15} style={{ color: '#60A5FA', flexShrink: 0 }} />
                  <span>Visa, Mastercard, and Verve cards accepted</span>
                </div>
                <div style={styles.paymentInfoRow}>
                  <Lock size={15} style={{ color: '#22C55E', flexShrink: 0 }} />
                  <span>256-bit encrypted · PCI DSS compliant · Powered by Paystack</span>
                </div>
              </div>
            )}

            {/* Bank transfer method detail */}
            {payMethod === 'bank' && (
              <div style={styles.methodDetail}>
                <div style={styles.paymentInfoRow}>
                  <Building2 size={15} style={{ color: '#60A5FA', flexShrink: 0 }} />
                  <span>A unique virtual account will be generated for this payment</span>
                </div>
                <div style={styles.paymentInfoRow}>
                  <Check size={15} style={{ color: '#22C55E', flexShrink: 0 }} />
                  <span>Access is activated instantly after bank confirmation</span>
                </div>
              </div>
            )}

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
                ) : payMethod === 'bank' ? (
                  <><Building2 size={15} /> Continue to Bank Transfer</>
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
  methodTabs: { display: 'flex', gap: '8px', marginBottom: '4px' },
  methodTab: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
    padding: '10px', backgroundColor: '#0D1117', border: '1px solid #30363D',
    borderRadius: '8px', color: '#8B949E', fontSize: '13px', fontWeight: '500', cursor: 'pointer',
  },
  methodTabActive: {
    backgroundColor: 'rgba(37,99,235,0.1)', borderColor: '#2563EB', color: '#60A5FA',
  },
  methodDetail: {
    display: 'flex', flexDirection: 'column', gap: '10px',
    padding: '14px 16px', backgroundColor: '#0D1117',
    border: '1px solid #30363D', borderRadius: '10px', marginBottom: '4px',
  },
  paymentInfoRow: {
    display: 'flex', alignItems: 'center', gap: '10px',
    fontSize: '13px', color: '#8B949E',
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
