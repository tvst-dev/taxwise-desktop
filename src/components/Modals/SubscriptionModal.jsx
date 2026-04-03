import React, { useState, useEffect } from 'react';
import { X, Check, Calendar, RefreshCw, ChevronRight, ArrowLeft } from 'lucide-react';
import { useUIStore, useAuthStore } from '../../store';
import { supabase } from '../../services/supabase';
import SubscriptionService, {
  SUBSCRIPTION_PLANS,
  SUBSCRIPTION_STATUS,
} from '../../services/subscriptionService';
import PaymentForm from '../Payment/PaymentForm';
import toast from 'react-hot-toast';

const SubscriptionModal = () => {
  const { activeModal, closeModal } = useUIStore();
  const { organization, user } = useAuthStore();

  const [currentSubscription, setCurrentSubscription] = useState(null);
  const [selectedPlan, setSelectedPlan]   = useState('sme');
  const [isLoading, setIsLoading]         = useState(true);
  const [isProcessing, setIsProcessing]   = useState(false);
  const [view, setView]                   = useState('plans'); // 'plans' | 'checkout' | 'success'

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
    } catch (err) {
      console.error('Error loading subscription:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!confirm('Are you sure you want to cancel your subscription?')) return;
    setIsProcessing(true);
    try {
      await SubscriptionService.cancel(organization.id);
      await loadSubscription();
      toast.success('Subscription cancelled');
    } catch {
      toast.error('Failed to cancel subscription');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatPrice = (n) => `₦${n.toLocaleString()}`;

  if (!isOpen) return null;

  const statusDisplay  = currentSubscription
    ? SubscriptionService.getStatusDisplay(currentSubscription.status)
    : null;
  const selectedPlanData = SUBSCRIPTION_PLANS[selectedPlan];

  return (
    <div style={st.overlay} onClick={closeModal}>
      <div style={st.modal} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={st.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {view === 'checkout' && (
              <button style={st.backIconBtn} onClick={() => setView('plans')}>
                <ArrowLeft size={16}/>
              </button>
            )}
            <h2 style={st.title}>
              {view === 'success'  ? 'Subscription Activated' :
               view === 'checkout' ? `${selectedPlanData?.name} — Checkout` :
               'Subscription Plans'}
            </h2>
          </div>
          <button style={st.closeBtn} onClick={closeModal}><X size={20}/></button>
        </div>

        {/* Body */}
        {isLoading ? (
          <div style={st.center}>
            <RefreshCw size={32} style={{ color: '#3B82F6', animation: 'spin 1s linear infinite' }}/>
            <span style={st.muted}>Loading…</span>
          </div>

        ) : view === 'success' ? (
          <div style={st.center}>
            <div style={st.successRing}><Check size={44} color="#22C55E"/></div>
            <h3 style={st.h3}>You're all set!</h3>
            <p style={st.muted}>
              Your {SUBSCRIPTION_PLANS[selectedPlan]?.name} subscription is now active.
            </p>
            <button style={st.primaryBtn} onClick={closeModal}>Get Started</button>
          </div>

        ) : view === 'checkout' ? (
          <div style={st.content}>
            {/* Order summary strip */}
            <div style={st.orderSummary}>
              <div style={st.orderRow}>
                <span style={st.orderLabel}>{selectedPlanData.name} Plan</span>
                <span style={st.orderPrice}>{formatPrice(selectedPlanData.monthlyPrice)}<span style={st.orderPer}>/mo</span></span>
              </div>
              <div style={st.orderDivider}/>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: '#8B949E' }}>Billing</span>
                <span style={{ fontSize: 13, color: '#8B949E' }}>Monthly · auto-renews</span>
              </div>
            </div>

            {/* Inline payment form — handles card, PIN, OTP, bank transfer */}
            <PaymentForm
              email={user?.email}
              amount={selectedPlanData.monthlyPrice}
              plan={selectedPlan}
              organizationId={organization?.id}
              isTrial={false}
              onSuccess={() => { setView('success'); loadSubscription(); }}
              onError={(err) => toast.error(err.message)}
              buttonText={`Pay ${formatPrice(selectedPlanData.monthlyPrice)}`}
            />

            <p style={st.disclaimer}>
              Subscription renews monthly. Cancel anytime from account settings.
            </p>
          </div>

        ) : (
          /* Plans view */
          <div style={st.content}>
            {/* Current plan info */}
            {currentSubscription && currentSubscription.status !== SUBSCRIPTION_STATUS.TRIAL && (
              <div style={st.currentPlan}>
                <div style={st.currentPlanHeader}>
                  <div>
                    <span style={st.currentLabel}>Current Plan</span>
                    <h3 style={st.currentPlanName}>
                      {currentSubscription.planId
                        ? SUBSCRIPTION_PLANS[currentSubscription.planId]?.name
                        : 'Free Trial'}
                    </h3>
                  </div>
                  <span style={{
                    ...st.statusBadge,
                    backgroundColor: `${statusDisplay?.color}18`,
                    color: statusDisplay?.color,
                  }}>
                    {statusDisplay?.text}
                  </span>
                </div>
                {currentSubscription.currentPeriodEnd && (
                  <div style={st.renewalInfo}>
                    <Calendar size={14}/>
                    <span>
                      {currentSubscription.status === SUBSCRIPTION_STATUS.ACTIVE
                        ? `Renews ${new Date(currentSubscription.currentPeriodEnd).toLocaleDateString()}`
                        : `Expires ${new Date(currentSubscription.currentPeriodEnd).toLocaleDateString()}`}
                    </span>
                  </div>
                )}
                <div style={st.manageActions}>
                  <button style={st.manageBtn} onClick={() => setView('checkout')} disabled={isProcessing}>
                    Update / Renew
                  </button>
                  <button style={st.cancelBtn} onClick={handleCancelSubscription} disabled={isProcessing}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Plans grid */}
            <div style={st.plansGrid}>
              {Object.values(SUBSCRIPTION_PLANS).map(plan => (
                <div
                  key={plan.id}
                  style={{ ...st.planCard, ...(selectedPlan === plan.id ? st.planCardSelected : {}) }}
                  onClick={() => setSelectedPlan(plan.id)}
                >
                  {plan.id === 'sme' && <div style={st.popularBadge}>Most Popular</div>}
                  <h3 style={st.planName}>{plan.name}</h3>
                  <div style={st.planPrice}>
                    <span style={st.priceAmt}>{formatPrice(plan.monthlyPrice)}</span>
                    <span style={st.pricePer}>/month</span>
                  </div>
                  <ul style={st.features}>
                    {plan.features.slice(0, 6).map((f, i) => (
                      <li key={i} style={st.featureItem}>
                        <Check size={14} style={{ color: '#22C55E', flexShrink: 0 }}/>
                        <span>{f}</span>
                      </li>
                    ))}
                    {plan.features.length > 6 && (
                      <li style={{ fontSize: 12, color: '#3B82F6', marginTop: 4 }}>
                        +{plan.features.length - 6} more
                      </li>
                    )}
                  </ul>
                  <button
                    style={{ ...st.selectBtn, ...(selectedPlan === plan.id ? st.selectBtnActive : {}) }}
                    onClick={e => { e.stopPropagation(); setSelectedPlan(plan.id); setView('checkout'); }}
                  >
                    {selectedPlan === plan.id ? 'Continue' : 'Select Plan'}
                    <ChevronRight size={15}/>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  );
};

const st = {
  overlay: {
    position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9000,
  },
  modal: {
    width: '100%', maxWidth: '720px', maxHeight: '90vh',
    backgroundColor: '#161B22', borderRadius: 16, border: '1px solid #30363D',
    overflow: 'hidden', display: 'flex', flexDirection: 'column',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '18px 24px', borderBottom: '1px solid #30363D',
  },
  title: { fontSize: 18, fontWeight: 600, color: '#E6EDF3', margin: 0 },
  backIconBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 30, height: 30, background: '#21262D', border: 'none',
    borderRadius: 6, color: '#8B949E', cursor: 'pointer',
  },
  closeBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 32, height: 32, background: 'transparent', border: 'none',
    color: '#8B949E', cursor: 'pointer', borderRadius: 6,
  },
  content: { padding: 24, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 },
  center: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', padding: 48, gap: 16, textAlign: 'center',
  },
  successRing: {
    width: 80, height: 80, borderRadius: '50%',
    background: 'rgba(34,197,94,0.1)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  h3: { fontSize: 22, fontWeight: 600, color: '#E6EDF3', margin: 0 },
  muted: { fontSize: 14, color: '#8B949E', margin: 0 },
  primaryBtn: {
    marginTop: 8, padding: '13px 32px', background: '#2563EB', border: 'none',
    borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
  },
  orderSummary: {
    padding: 16, background: '#0D1117', border: '1px solid #30363D', borderRadius: 10,
  },
  orderRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 },
  orderLabel: { fontSize: 14, fontWeight: 600, color: '#E6EDF3' },
  orderPrice: { fontSize: 22, fontWeight: 700, color: '#E6EDF3' },
  orderPer: { fontSize: 13, fontWeight: 400, color: '#8B949E' },
  orderDivider: { borderTop: '1px solid #30363D', margin: '10px 0' },
  disclaimer: { fontSize: 11, color: '#6E7681', textAlign: 'center', lineHeight: 1.5, margin: 0 },
  currentPlan: {
    padding: 20, background: '#0D1117', border: '1px solid #30363D', borderRadius: 12, marginBottom: 4,
  },
  currentPlanHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  currentLabel: { fontSize: 11, color: '#8B949E', textTransform: 'uppercase', letterSpacing: 1 },
  currentPlanName: { fontSize: 18, fontWeight: 600, color: '#E6EDF3', margin: '4px 0 0 0' },
  statusBadge: { padding: '4px 12px', borderRadius: 9999, fontSize: 12, fontWeight: 500 },
  renewalInfo: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#8B949E', marginBottom: 14 },
  manageActions: { display: 'flex', gap: 10 },
  manageBtn: {
    padding: '9px 16px', background: '#21262D', border: 'none',
    borderRadius: 6, color: '#E6EDF3', fontSize: 13, cursor: 'pointer',
  },
  cancelBtn: {
    padding: '9px 16px', background: 'transparent', border: '1px solid #30363D',
    borderRadius: 6, color: '#EF4444', fontSize: 13, cursor: 'pointer',
  },
  plansGrid: { display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 14 },
  planCard: {
    position: 'relative', padding: 22, background: '#0D1117',
    border: '1px solid #30363D', borderRadius: 12, cursor: 'pointer',
  },
  planCardSelected: { borderColor: '#2563EB', background: 'rgba(37,99,235,0.05)' },
  popularBadge: {
    position: 'absolute', top: -10, right: 14,
    padding: '3px 10px', background: '#2563EB', borderRadius: 4,
    fontSize: 11, fontWeight: 600, color: '#fff',
  },
  planName: { fontSize: 17, fontWeight: 600, color: '#E6EDF3', margin: '0 0 10px 0' },
  planPrice: { display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 16 },
  priceAmt: { fontSize: 28, fontWeight: 700, color: '#E6EDF3' },
  pricePer: { fontSize: 13, color: '#8B949E' },
  features: { listStyle: 'none', margin: '0 0 18px 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 8 },
  featureItem: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#E6EDF3' },
  selectBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    width: '100%', padding: '11px', background: '#21262D', border: 'none',
    borderRadius: 8, color: '#E6EDF3', fontSize: 13, fontWeight: 500, cursor: 'pointer',
  },
  selectBtnActive: { background: '#2563EB', color: '#fff' },
};

export default SubscriptionModal;
