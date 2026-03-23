import React, { useState, useEffect } from 'react';
import {
  X, CreditCard, Check, Zap, Shield, Lock,
  Calendar, RefreshCw, ChevronRight
} from 'lucide-react';
import { useUIStore, useAuthStore } from '../../store';
import { supabase } from '../../services/supabase';
import SubscriptionService, {
  SUBSCRIPTION_PLANS,
  SUBSCRIPTION_STATUS
} from '../../services/subscriptionService';
import config from '../../config';
import toast from 'react-hot-toast';

const SubscriptionModal = () => {
  const { activeModal, closeModal } = useUIStore();
  const { organization, user } = useAuthStore();

  const [currentSubscription, setCurrentSubscription] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState('sme');
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [view, setView] = useState('plans'); // 'plans', 'checkout', 'otp', 'success'

  // Card form state
  const [card, setCard] = useState({ number: '', expiry: '', cvv: '' });
  const [cardErrors, setCardErrors] = useState({});
  const [otpValue, setOtpValue] = useState('');
  const [paymentReference, setPaymentReference] = useState('');

  const isOpen = activeModal === 'subscription';

  useEffect(() => {
    if (isOpen && organization?.id) {
      loadSubscription();
      // Reset state when modal opens
      setView('plans');
      setCard({ number: '', expiry: '', cvv: '' });
      setCardErrors({});
      setOtpValue('');
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

  // Card formatting
  const formatCardNumber = (value) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = (matches && matches[0]) || '';
    const parts = [];
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    return parts.length ? parts.join(' ') : value;
  };

  const formatExpiry = (value) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    if (v.length >= 2) {
      return v.substring(0, 2) + '/' + v.substring(2, 4);
    }
    return v;
  };

  const validateCard = () => {
    const errors = {};
    const cardNum = card.number.replace(/\s/g, '');
    
    if (!cardNum || cardNum.length < 16) errors.number = 'Valid card number required';
    if (!card.expiry || card.expiry.length < 5) errors.expiry = 'Valid expiry required';
    if (!card.cvv || card.cvv.length < 3) errors.cvv = 'Valid CVV required';
    
    setCardErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Shared fetch helper — uses singleton supabase client (no fresh client = no abort errors)
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

  // Invisible card charge — no popup, processed entirely server-side
  const handlePayment = async () => {
    if (!validateCard()) return;
    if (!user?.email) { toast.error('Email address required for billing'); return; }
    setIsProcessing(true);
    try {
      const planData = SUBSCRIPTION_PLANS[selectedPlan];
      const amount = billingCycle === 'annual' ? planData.annualPrice : planData.monthlyPrice;
      const [expiryMonth, expiryYear] = card.expiry.split('/');

      const data = await paystackFetch({
        action: 'charge_card',
        email: user.email,
        amount: amount * 100,
        plan: selectedPlan,
        card: {
          number: card.number.replace(/\s/g, ''),
          cvv: card.cvv,
          expiry_month: expiryMonth?.trim(),
          expiry_year: '20' + (expiryYear?.trim() || ''),
        },
        metadata: { organization_id: organization?.id, billing_cycle: billingCycle },
      });

      if (data.success) {
        setPaymentReference(data.reference);
        if (data.status === 'success' || data.status === 'charge_attempted') {
          await verifyAndComplete(data.reference);
        } else if (data.status === 'send_otp' || data.status === 'send_pin') {
          setView('otp');
          toast.success(data.display_text || 'Enter the OTP sent to your phone');
        } else if (data.status === '3ds_required') {
          window.open(data.url, '_blank', 'width=520,height=620');
          toast('Complete bank authentication in the popup, then return here.');
          pollForCompletion(data.reference);
        } else {
          throw new Error(data.message || 'Payment failed');
        }
      } else {
        throw new Error(data.error || 'Payment failed');
      }
    } catch (error) {
      toast.error(error.message || 'Payment failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Submit OTP
  const handleOtpSubmit = async () => {
    if (!otpValue || otpValue.length < 4) { toast.error('Please enter a valid OTP'); return; }
    setIsProcessing(true);
    try {
      const data = await paystackFetch({ action: 'submit_otp', reference: paymentReference, otp: otpValue });
      if (data.status && data.data?.status === 'success') {
        await verifyAndComplete(paymentReference);
      } else {
        throw new Error(data.message || 'OTP verification failed');
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Verify and activate subscription
  const verifyAndComplete = async (reference) => {
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
        toast.success('Subscription activated successfully!');
        await loadSubscription();
      } else {
        throw new Error(data.error || 'Verification failed');
      }
    } catch (error) {
      toast.error(error.message);
      setView('checkout');
    }
  };

  // Poll for 3DS completion
  const pollForCompletion = (reference) => {
    let attempts = 0;
    const poll = async () => {
      if (++attempts > 60) { toast.error('Authentication timed out'); setView('checkout'); return; }
      try {
        const data = await paystackFetch({ action: 'verify', reference, organization_id: organization?.id, plan: selectedPlan, is_trial: false });
        if (data.success) { setView('success'); toast.success('Subscription activated!'); await loadSubscription(); }
        else setTimeout(poll, 5000);
      } catch { setTimeout(poll, 5000); }
    };
    setTimeout(poll, 5000);
  };

  const handleUpdatePaymentMethod = async () => {
    // Show card form for updating payment method
    setView('checkout');
    setCard({ number: '', expiry: '', cvv: '' });
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

  const formatPrice = (amount) => {
    return `₦${amount.toLocaleString()}`;
  };

  const calculateSavings = (planId) => {
    const plan = SUBSCRIPTION_PLANS[planId];
    const monthlyTotal = plan.monthlyPrice * 12;
    const annualPrice = plan.annualPrice;
    const savings = monthlyTotal - annualPrice;
    const percentage = Math.round((savings / monthlyTotal) * 100);
    return { savings, percentage };
  };

  if (!isOpen) return null;

  const statusDisplay = currentSubscription
    ? SubscriptionService.getStatusDisplay(currentSubscription.status)
    : null;

  const selectedPlanData = SUBSCRIPTION_PLANS[selectedPlan];
  const selectedAmount = billingCycle === 'annual' ? selectedPlanData.annualPrice : selectedPlanData.monthlyPrice;

  return (
    <div style={styles.overlay} onClick={closeModal}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <h2 style={styles.title}>
            {view === 'success' ? 'Subscription Activated' : 
             view === 'otp' ? 'Verify Payment' :
             view === 'checkout' ? 'Payment Details' : 'Subscription Plans'}
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
            <div style={styles.successIcon}>
              <Check size={48} />
            </div>
            <h3 style={styles.successTitle}>Welcome to TaxWise!</h3>
            <p style={styles.successText}>
              Your {SUBSCRIPTION_PLANS[selectedPlan].name} subscription is now active.
              You have full access to all features.
            </p>
            <button style={styles.primaryButton} onClick={closeModal}>
              Get Started
            </button>
          </div>
        ) : view === 'otp' ? (
          <div style={styles.content}>
            <div style={styles.otpContainer}>
              <Lock size={48} color="#2563EB" />
              <h3 style={styles.otpTitle}>Enter OTP</h3>
              <p style={styles.otpText}>Enter the code sent to your phone</p>

              <input
                type="text"
                value={otpValue}
                onChange={(e) => setOtpValue(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Enter OTP"
                style={styles.otpInput}
                maxLength={6}
                autoFocus
              />

              <div style={styles.otpActions}>
                <button
                  style={styles.backButton}
                  onClick={() => setView('checkout')}
                >
                  Back
                </button>
                <button
                  style={styles.payButton}
                  onClick={handleOtpSubmit}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw size={16} className="spin" />
                      Verifying...
                    </>
                  ) : (
                    'Verify OTP'
                  )}
                </button>
              </div>
            </div>
          </div>
        ) : view === 'checkout' ? (
          <div style={styles.content}>
            {/* Plan Summary */}
            <div style={styles.checkoutSummary}>
              <h3 style={styles.checkoutTitle}>Order Summary</h3>

              <div style={styles.summaryRow}>
                <span>{selectedPlanData.name}</span>
                <span>{formatPrice(selectedAmount)}</span>
              </div>

              <div style={styles.summaryRow}>
                <span>Billing Cycle</span>
                <span>{billingCycle === 'annual' ? 'Annual' : 'Monthly'}</span>
              </div>

              {billingCycle === 'annual' && (
                <div style={styles.savingsRow}>
                  <Zap size={16} />
                  <span>You save {formatPrice(calculateSavings(selectedPlan).savings)}/year</span>
                </div>
              )}

              <div style={styles.totalRow}>
                <span>Total</span>
                <span style={styles.totalAmount}>
                  {formatPrice(selectedAmount)}
                  <span style={styles.billingPeriod}>
                    /{billingCycle === 'annual' ? 'year' : 'month'}
                  </span>
                </span>
              </div>
            </div>

            {/* Pay via Paystack popup */}
            <div style={styles.cardForm}>
              <div style={styles.secureNotice}>
                <Lock size={14} />
                <span>Secure payment powered by Paystack — PCI DSS compliant</span>
              </div>

              {/* Card Number */}
              <div style={styles.field}>
                <label style={styles.label}>Card Number</label>
                <div style={styles.inputWrapper}>
                  <CreditCard size={18} style={styles.inputIcon} />
                  <input
                    type="text"
                    value={card.number}
                    onChange={(e) => setCard({ ...card, number: formatCardNumber(e.target.value) })}
                    placeholder="1234 5678 9012 3456"
                    style={{ ...styles.cardInput, ...(cardErrors.number && styles.inputError) }}
                    maxLength={19}
                  />
                </div>
                {cardErrors.number && <span style={styles.errorText}>{cardErrors.number}</span>}
              </div>

              {/* Expiry and CVV */}
              <div style={styles.row}>
                <div style={styles.field}>
                  <label style={styles.label}>Expiry Date</label>
                  <div style={styles.inputWrapper}>
                    <Calendar size={18} style={styles.inputIcon} />
                    <input
                      type="text"
                      value={card.expiry}
                      onChange={(e) => setCard({ ...card, expiry: formatExpiry(e.target.value) })}
                      placeholder="MM/YY"
                      style={{ ...styles.cardInput, ...(cardErrors.expiry && styles.inputError) }}
                      maxLength={5}
                    />
                  </div>
                  {cardErrors.expiry && <span style={styles.errorText}>{cardErrors.expiry}</span>}
                </div>

                <div style={styles.field}>
                  <label style={styles.label}>CVV</label>
                  <div style={styles.inputWrapper}>
                    <Lock size={18} style={styles.inputIcon} />
                    <input
                      type="password"
                      value={card.cvv}
                      onChange={(e) => setCard({ ...card, cvv: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                      placeholder="•••"
                      style={{ ...styles.cardInput, ...(cardErrors.cvv && styles.inputError) }}
                      maxLength={4}
                    />
                  </div>
                  {cardErrors.cvv && <span style={styles.errorText}>{cardErrors.cvv}</span>}
                </div>
              </div>
            </div>

            <div style={styles.disclaimer}>
              Your card will be saved securely for automatic monthly renewal. You can cancel anytime.
            </div>

            <div style={styles.checkoutActions}>
              <button
                style={styles.backButton}
                onClick={() => setView('plans')}
              >
                Back to Plans
              </button>
              <button
                style={styles.payButton}
                onClick={handlePayment}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <>
                    <RefreshCw size={16} className="spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Lock size={16} />
                    Pay {formatPrice(selectedAmount)}
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div style={styles.content}>
            {/* Current Subscription Status */}
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
                      color: statusDisplay?.color
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
                  <button
                    style={styles.manageButton}
                    onClick={handleUpdatePaymentMethod}
                    disabled={isProcessing}
                  >
                    Update Payment Method
                  </button>
                  <button
                    style={styles.cancelButton}
                    onClick={handleCancelSubscription}
                    disabled={isProcessing}
                  >
                    Cancel Subscription
                  </button>
                </div>
              </div>
            )}

            {/* Billing Cycle Toggle */}
            <div style={styles.billingToggle}>
              <button
                style={{
                  ...styles.toggleButton,
                  ...(billingCycle === 'monthly' ? styles.toggleButtonActive : {})
                }}
                onClick={() => setBillingCycle('monthly')}
              >
                Monthly
              </button>
              <button
                style={{
                  ...styles.toggleButton,
                  ...(billingCycle === 'annual' ? styles.toggleButtonActive : {})
                }}
                onClick={() => setBillingCycle('annual')}
              >
                Annual
                <span style={styles.saveBadge}>Save 17%</span>
              </button>
            </div>

            {/* Plans */}
            <div style={styles.plansGrid}>
              {Object.values(SUBSCRIPTION_PLANS).map((plan) => (
                <div
                  key={plan.id}
                  style={{
                    ...styles.planCard,
                    ...(selectedPlan === plan.id ? styles.planCardSelected : {})
                  }}
                  onClick={() => setSelectedPlan(plan.id)}
                >
                  {plan.id === 'enterprise' && (
                    <div style={styles.popularBadge}>Most Popular</div>
                  )}

                  <div style={styles.planHeader}>
                    <h3 style={styles.planName}>{plan.name}</h3>
                    <div style={styles.planPrice}>
                      <span style={styles.priceAmount}>
                        {formatPrice(
                          billingCycle === 'annual'
                            ? Math.round(plan.annualPrice / 12)
                            : plan.monthlyPrice
                        )}
                      </span>
                      <span style={styles.pricePeriod}>/month</span>
                    </div>
                    {billingCycle === 'annual' && (
                      <div style={styles.billedAnnually}>
                        Billed annually ({formatPrice(plan.annualPrice)})
                      </div>
                    )}
                  </div>

                  <ul style={styles.featureList}>
                    {plan.features.slice(0, 6).map((feature, idx) => (
                      <li key={idx} style={styles.featureItem}>
                        <Check size={16} style={styles.checkIcon} />
                        <span>{feature}</span>
                      </li>
                    ))}
                    {plan.features.length > 6 && (
                      <li style={styles.moreFeatures}>
                        +{plan.features.length - 6} more features
                      </li>
                    )}
                  </ul>

                  <button
                    style={{
                      ...styles.selectPlanButton,
                      ...(selectedPlan === plan.id ? styles.selectPlanButtonActive : {})
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
          .spin {
            animation: spin 1s linear infinite;
          }
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
};

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9000
  },
  modal: {
    width: '100%',
    maxWidth: '800px',
    maxHeight: '90vh',
    backgroundColor: '#161B22',
    borderRadius: '16px',
    border: '1px solid #30363D',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 24px',
    borderBottom: '1px solid #30363D'
  },
  title: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#E6EDF3',
    margin: 0
  },
  closeButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '32px',
    backgroundColor: 'transparent',
    border: 'none',
    color: '#8B949E',
    cursor: 'pointer',
    borderRadius: '6px'
  },
  content: {
    padding: '24px',
    overflowY: 'auto'
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px',
    gap: '16px'
  },
  loadingText: {
    color: '#8B949E',
    fontSize: '14px'
  },
  successContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px',
    textAlign: 'center'
  },
  successIcon: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#22C55E',
    marginBottom: '24px'
  },
  successTitle: {
    fontSize: '24px',
    fontWeight: '600',
    color: '#E6EDF3',
    margin: '0 0 12px 0'
  },
  successText: {
    fontSize: '14px',
    color: '#8B949E',
    margin: '0 0 32px 0'
  },
  primaryButton: {
    padding: '14px 32px',
    backgroundColor: '#2563EB',
    border: 'none',
    borderRadius: '8px',
    color: 'white',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer'
  },
  currentPlan: {
    padding: '20px',
    backgroundColor: '#0D1117',
    border: '1px solid #30363D',
    borderRadius: '12px',
    marginBottom: '24px'
  },
  currentPlanHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '12px'
  },
  currentLabel: {
    fontSize: '12px',
    color: '#8B949E',
    textTransform: 'uppercase'
  },
  currentPlanName: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#E6EDF3',
    margin: '4px 0 0 0'
  },
  statusBadge: {
    padding: '4px 12px',
    borderRadius: '9999px',
    fontSize: '12px',
    fontWeight: '500'
  },
  renewalInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    color: '#8B949E',
    marginBottom: '16px'
  },
  manageActions: {
    display: 'flex',
    gap: '12px'
  },
  manageButton: {
    padding: '10px 16px',
    backgroundColor: '#21262D',
    border: 'none',
    borderRadius: '6px',
    color: '#E6EDF3',
    fontSize: '13px',
    cursor: 'pointer'
  },
  cancelButton: {
    padding: '10px 16px',
    backgroundColor: 'transparent',
    border: '1px solid #30363D',
    borderRadius: '6px',
    color: '#EF4444',
    fontSize: '13px',
    cursor: 'pointer'
  },
  billingToggle: {
    display: 'flex',
    gap: '4px',
    padding: '4px',
    backgroundColor: '#0D1117',
    borderRadius: '10px',
    marginBottom: '24px'
  },
  toggleButton: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '12px',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '8px',
    color: '#8B949E',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer'
  },
  toggleButtonActive: {
    backgroundColor: '#21262D',
    color: '#E6EDF3'
  },
  saveBadge: {
    padding: '2px 8px',
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderRadius: '4px',
    fontSize: '11px',
    color: '#22C55E'
  },
  plansGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '16px'
  },
  planCard: {
    position: 'relative',
    padding: '24px',
    backgroundColor: '#0D1117',
    border: '1px solid #30363D',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'all 0.15s ease'
  },
  planCardSelected: {
    borderColor: '#2563EB',
    backgroundColor: 'rgba(37, 99, 235, 0.05)'
  },
  popularBadge: {
    position: 'absolute',
    top: '-10px',
    right: '16px',
    padding: '4px 12px',
    backgroundColor: '#2563EB',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '600',
    color: 'white'
  },
  planHeader: {
    marginBottom: '20px'
  },
  planName: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#E6EDF3',
    margin: '0 0 12px 0'
  },
  planPrice: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '4px'
  },
  priceAmount: {
    fontSize: '32px',
    fontWeight: '700',
    color: '#E6EDF3'
  },
  pricePeriod: {
    fontSize: '14px',
    color: '#8B949E'
  },
  billedAnnually: {
    fontSize: '12px',
    color: '#8B949E',
    marginTop: '4px'
  },
  featureList: {
    listStyle: 'none',
    margin: '0 0 20px 0',
    padding: 0
  },
  featureItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '13px',
    color: '#E6EDF3',
    marginBottom: '10px'
  },
  checkIcon: {
    color: '#22C55E',
    flexShrink: 0
  },
  moreFeatures: {
    fontSize: '13px',
    color: '#3B82F6',
    marginTop: '8px'
  },
  selectPlanButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    width: '100%',
    padding: '12px',
    backgroundColor: '#21262D',
    border: 'none',
    borderRadius: '8px',
    color: '#E6EDF3',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer'
  },
  selectPlanButtonActive: {
    backgroundColor: '#2563EB',
    color: 'white'
  },
  checkoutSummary: {
    padding: '20px',
    backgroundColor: '#0D1117',
    border: '1px solid #30363D',
    borderRadius: '12px',
    marginBottom: '20px'
  },
  checkoutTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#E6EDF3',
    margin: '0 0 16px 0'
  },
  summaryRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '14px',
    color: '#8B949E',
    marginBottom: '12px'
  },
  savingsRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px',
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderRadius: '8px',
    fontSize: '13px',
    color: '#22C55E',
    marginBottom: '16px'
  },
  totalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: '16px',
    borderTop: '1px solid #30363D'
  },
  totalAmount: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#E6EDF3'
  },
  billingPeriod: {
    fontSize: '14px',
    fontWeight: '400',
    color: '#8B949E'
  },
  cardForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    marginBottom: '16px'
  },
  secureNotice: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 14px',
    background: 'rgba(34, 197, 94, 0.1)',
    border: '1px solid rgba(34, 197, 94, 0.3)',
    borderRadius: '8px',
    color: '#22C55E',
    fontSize: '12px'
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  label: {
    fontSize: '13px',
    fontWeight: '500',
    color: '#8B949E'
  },
  inputWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center'
  },
  inputIcon: {
    position: 'absolute',
    left: '12px',
    color: '#6E7681',
    zIndex: 1
  },
  cardInput: {
    width: '100%',
    padding: '12px 14px 12px 40px',
    backgroundColor: '#0D1117',
    border: '1px solid #30363D',
    borderRadius: '8px',
    color: '#E6EDF3',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box'
  },
  inputError: {
    borderColor: '#EF4444'
  },
  errorText: {
    fontSize: '12px',
    color: '#EF4444'
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px'
  },
  disclaimer: {
    fontSize: '11px',
    color: '#6E7681',
    textAlign: 'center',
    lineHeight: 1.5,
    marginBottom: '16px'
  },
  checkoutActions: {
    display: 'flex',
    gap: '12px'
  },
  backButton: {
    padding: '14px 24px',
    backgroundColor: 'transparent',
    border: '1px solid #30363D',
    borderRadius: '8px',
    color: '#8B949E',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer'
  },
  payButton: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '14px',
    backgroundColor: '#2563EB',
    border: 'none',
    borderRadius: '8px',
    color: 'white',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer'
  },
  otpContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px',
    padding: '24px'
  },
  otpTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#E6EDF3',
    margin: 0
  },
  otpText: {
    fontSize: '14px',
    color: '#8B949E',
    margin: 0
  },
  otpInput: {
    width: '200px',
    padding: '16px',
    background: '#0D1117',
    border: '2px solid #30363D',
    borderRadius: '8px',
    color: '#E6EDF3',
    fontSize: '24px',
    textAlign: 'center',
    letterSpacing: '8px',
    outline: 'none'
  },
  otpActions: {
    display: 'flex',
    gap: '12px',
    width: '100%',
    maxWidth: '320px',
    marginTop: '8px'
  }
};

export default SubscriptionModal;