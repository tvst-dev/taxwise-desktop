import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Eye, EyeOff, Calculator, AlertCircle, Loader, Check,
  Building2, Users, Zap, CreditCard, Lock, Calendar, Shield, Star
} from 'lucide-react';
import { signUp, createOrganization, createUserProfile } from '../../services/supabase';
import { useAuthStore } from '../../store';
import config from '../../config';
import toast from 'react-hot-toast';

const PLANS = [
  {
    id: 'startup',
    name: 'Startup',
    price: 10000,
    popular: false,
    icon: Zap,
    color: '#6E7681',
    description: 'For solo founders and early-stage businesses',
    features: [
      'Income & expense tracking',
      'Automated tax calculations',
      'Basic compliance reports',
      'Single business profile',
      'Document AI Extraction'
    ]
  },
  {
    id: 'sme',
    name: 'SME',
    price: 25000,
    popular: true,
    icon: Building2,
    color: '#2563EB',
    description: 'The complete tax compliance stack for growing businesses',
    features: [
      'Everything in Startup',
      'Audit-ready reports',
      'Multi-income streams',
      'Export-ready documentation',
      'Compliance reminders',
      'Accountant access (5 users)',
      'POS Sales Tracking'
    ]
  },
  {
    id: 'corporate',
    name: 'Corporate',
    price: 60000,
    popular: false,
    icon: Users,
    color: '#8B5CF6',
    description: 'Full infrastructure for large organizations',
    features: [
      'Everything in SME',
      'Multi-user roles & permissions',
      'Advanced reporting',
      'API integrations',
      'Priority support',
      'Unlimited users'
    ]
  }
];

const RegisterPage = () => {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const [step, setStep] = useState(1); // 1: Account, 2: Business, 3: Plan, 4: Card
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Account Info
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Business Info
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState('limited_company');
  const [tin, setTin] = useState('');

  // Plan
  const [selectedPlan, setSelectedPlan] = useState('sme');

  // Payment
  const [card, setCard] = useState({ number: '', expiry: '', cvv: '' });
  const [cardErrors, setCardErrors] = useState({});
  const [paymentStep, setPaymentStep] = useState('card'); // card | otp | processing | success
  const [otpValue, setOtpValue] = useState('');
  const [paymentReference, setPaymentReference] = useState('');

  // Created data (saved between steps)
  const [createdUser, setCreatedUser] = useState(null);
  const [createdOrg, setCreatedOrg] = useState(null);

  const selectedPlanData = PLANS.find(p => p.id === selectedPlan);

  const validateStep1 = () => {
    if (!email || !password || !firstName || !lastName) {
      setError('Please fill in all fields'); return false;
    }
    if (!email.includes('@')) {
      setError('Please enter a valid email'); return false;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters'); return false;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match'); return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!businessName) {
      setError('Please enter your business name'); return false;
    }
    return true;
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

  const handleNext = () => {
    setError('');
    if (step === 1 && validateStep1()) setStep(2);
    else if (step === 2 && validateStep2()) setStep(3);
    else if (step === 3) setStep(4);
  };

  const handleBack = () => {
    setError('');
    if (step === 4 && paymentStep !== 'card') setPaymentStep('card');
    else setStep(step - 1);
  };

  const createAccountAndOrg = async () => {
    const { user } = await signUp(email, password, { first_name: firstName, last_name: lastName });
    if (!user) throw new Error('Registration failed');
    setCreatedUser(user);

    const org = await createOrganization({
      name: businessName,
      business_type: businessType,
      tin: tin || null,
      subscription_tier: selectedPlan,
      subscription_status: 'pending'
    });
    setCreatedOrg(org);

    await createUserProfile({
      id: user.id,
      email,
      first_name: firstName,
      last_name: lastName,
      organization_id: org.id,
      role: 'owner'
    });

    return { user, org };
  };

  const handleStartTrial = async () => {
    if (!validateCard()) return;
    setError('');
    setIsLoading(true);
    setPaymentStep('processing');

    try {
      let user = createdUser;
      let org = createdOrg;

      if (!user || !org) {
        const result = await createAccountAndOrg();
        user = result.user;
        org = result.org;
      }

      const [expiryMonth, expiryYear] = card.expiry.split('/');

      // Charge ₦100 for card verification (is_trial: true)
      const response = await fetch(`${config.SUPABASE_URL}/functions/v1/paystack`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': config.SUPABASE_ANON_KEY
        },
        body: JSON.stringify({
          action: 'charge_card',
          email,
          is_trial: true,
          plan: selectedPlan,
          card: {
            number: card.number.replace(/\s/g, ''),
            cvv: card.cvv,
            expiry_month: expiryMonth,
            expiry_year: '20' + expiryYear
          },
          metadata: { organization_id: org.id, user_id: user.id }
        })
      });

      const data = await response.json();

      if (data.success) {
        setPaymentReference(data.reference);

        if (data.status === 'success') {
          await verifyAndComplete(data.reference, org.id);
        } else if (data.status === 'send_otp' || data.status === 'send_pin') {
          setPaymentStep('otp');
          toast.success(data.display_text || 'Enter the OTP sent to your phone');
        } else if (data.status === '3ds_required') {
          window.open(data.url, '_blank', 'width=500,height=600');
          toast.success('Complete authentication in the popup');
          pollForCompletion(data.reference, org.id);
        } else {
          throw new Error(data.message || 'Card verification failed');
        }
      } else {
        throw new Error(data.error || 'Card verification failed');
      }
    } catch (err) {
      console.error('Trial start error:', err);
      setPaymentStep('card');
      if (err.message?.includes('already registered')) {
        setError('This email is already registered. Please sign in instead.');
      } else {
        setError(err.message || 'Card verification failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = async () => {
    if (!otpValue || otpValue.length < 4) {
      toast.error('Please enter valid OTP'); return;
    }
    setIsLoading(true);
    try {
      const response = await fetch(`${config.SUPABASE_URL}/functions/v1/paystack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': config.SUPABASE_ANON_KEY },
        body: JSON.stringify({ action: 'submit_otp', reference: paymentReference, otp: otpValue })
      });
      const data = await response.json();
      if (data.success && data.status === 'success') {
        await verifyAndComplete(paymentReference, createdOrg.id);
      } else {
        throw new Error(data.message || 'OTP verification failed');
      }
    } catch (err) {
      toast.error(err.message);
      setPaymentStep('otp');
    } finally {
      setIsLoading(false);
    }
  };

  const verifyAndComplete = async (reference, orgId) => {
    const response = await fetch(`${config.SUPABASE_URL}/functions/v1/paystack`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': config.SUPABASE_ANON_KEY },
      body: JSON.stringify({
        action: 'verify',
        reference,
        organization_id: orgId,
        plan: selectedPlan,
        is_trial: true
      })
    });
    const data = await response.json();
    if (data.success) {
      setPaymentStep('success');
      toast.success('14-day trial started! Welcome to TaxWise.');
      setTimeout(() => navigate('/login'), 2500);
    } else {
      throw new Error(data.error || 'Verification failed');
    }
  };

  const pollForCompletion = (reference, orgId) => {
    let attempts = 0;
    const poll = async () => {
      attempts++;
      if (attempts > 60) { toast.error('Authentication timeout'); setPaymentStep('card'); return; }
      try {
        const response = await fetch(`${config.SUPABASE_URL}/functions/v1/paystack`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': config.SUPABASE_ANON_KEY },
          body: JSON.stringify({ action: 'verify', reference, organization_id: orgId, plan: selectedPlan, is_trial: true })
        });
        const data = await response.json();
        if (data.success) {
          setPaymentStep('success');
          toast.success('Trial started!');
          setTimeout(() => navigate('/login'), 2500);
        } else {
          setTimeout(poll, 5000);
        }
      } catch { setTimeout(poll, 5000); }
    };
    setTimeout(poll, 5000);
  };

  const stepLabels = ['Account', 'Business', 'Plan', 'Card'];

  return (
    <div style={styles.container}>
      {/* Left — Form */}
      <div style={styles.formSection}>
        <div style={styles.formWrapper}>
          {/* Logo */}
          <div style={styles.logo}>
            <div style={styles.logoIcon}><Calculator size={28} color="#2563EB" /></div>
            <span style={styles.logoText}>TaxWise</span>
          </div>

          {/* Progress */}
          <div style={styles.progress}>
            {[1, 2, 3, 4].map(s => (
              <React.Fragment key={s}>
                <div style={{ ...styles.progressStep, backgroundColor: step >= s ? '#2563EB' : '#30363D', color: step >= s ? '#fff' : '#8B949E' }}>
                  {step > s ? <Check size={14} /> : s}
                </div>
                {s < 4 && <div style={{ ...styles.progressLine, backgroundColor: step > s ? '#2563EB' : '#30363D' }} />}
              </React.Fragment>
            ))}
          </div>
          <div style={styles.progressLabels}>
            {stepLabels.map((label, i) => (
              <span key={label} style={{ color: step === i + 1 ? '#E6EDF3' : '#6E7681' }}>{label}</span>
            ))}
          </div>

          <h1 style={styles.title}>
            {step === 1 && 'Create your account'}
            {step === 2 && 'Business information'}
            {step === 3 && 'Choose your plan'}
            {step === 4 && (paymentStep === 'success' ? 'Trial Started!' : 'Add card details')}
          </h1>

          {error && (
            <div style={styles.errorBox}>
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          {/* Step 1: Account */}
          {step === 1 && (
            <div style={styles.form}>
              <div style={styles.row}>
                <div style={styles.field}>
                  <label style={styles.label}>First Name</label>
                  <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="John" style={styles.input} autoFocus />
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>Last Name</label>
                  <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Doe" style={styles.input} />
                </div>
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Work Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" style={styles.input} />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Password</label>
                <div style={styles.passwordWrapper}>
                  <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 8 characters" style={styles.input} />
                  <button type="button" style={styles.eyeBtn} onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Confirm Password</label>
                <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="••••••••" style={styles.input} />
              </div>
              <button type="button" onClick={handleNext} style={styles.primaryBtn}>Continue</button>
            </div>
          )}

          {/* Step 2: Business */}
          {step === 2 && (
            <div style={styles.form}>
              <div style={styles.field}>
                <label style={styles.label}>Business Name</label>
                <input type="text" value={businessName} onChange={e => setBusinessName(e.target.value)} placeholder="Acme Nigeria Ltd" style={styles.input} autoFocus />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Business Type</label>
                <select value={businessType} onChange={e => setBusinessType(e.target.value)} style={styles.select}>
                  <option value="sole_proprietorship">Sole Proprietorship</option>
                  <option value="partnership">Partnership</option>
                  <option value="limited_company">Limited Liability Company</option>
                  <option value="plc">Public Limited Company</option>
                  <option value="ngo">NGO / Non-Profit</option>
                </select>
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Tax Identification Number <span style={{ color: '#6E7681' }}>(Optional)</span></label>
                <input type="text" value={tin} onChange={e => setTin(e.target.value)} placeholder="12345678-0001" style={styles.input} />
              </div>
              <div style={styles.btnRow}>
                <button type="button" onClick={handleBack} style={styles.secondaryBtn}>Back</button>
                <button type="button" onClick={handleNext} style={styles.primaryBtn}>Continue</button>
              </div>
            </div>
          )}

          {/* Step 3: Plan Selection */}
          {step === 3 && (
            <div style={styles.form}>
              <p style={styles.trialNote}>
                14-day full access trial — no charge until day 15. Cancel anytime.
              </p>
              <div style={styles.plansGrid}>
                {PLANS.map(plan => {
                  const Icon = plan.icon;
                  const isSelected = selectedPlan === plan.id;
                  return (
                    <div
                      key={plan.id}
                      onClick={() => setSelectedPlan(plan.id)}
                      style={{
                        ...styles.planCard,
                        borderColor: isSelected ? plan.color : '#30363D',
                        backgroundColor: isSelected ? `rgba(${hexToRgb(plan.color)}, 0.08)` : '#161B22',
                        transform: plan.popular ? 'scale(1.03)' : 'scale(1)'
                      }}
                    >
                      {plan.popular && (
                        <div style={{ ...styles.popularBadge, backgroundColor: plan.color }}>
                          <Star size={10} style={{ display: 'inline', marginRight: 4 }} />
                          Most Popular
                        </div>
                      )}
                      <div style={{ ...styles.planIcon, color: plan.color }}>
                        <Icon size={22} />
                      </div>
                      <h3 style={styles.planName}>{plan.name}</h3>
                      <div style={styles.planPrice}>
                        <span style={styles.priceValue}>₦{plan.price.toLocaleString()}</span>
                        <span style={styles.pricePeriod}>/mo + VAT</span>
                      </div>
                      <p style={styles.planDesc}>{plan.description}</p>
                      <ul style={styles.planFeatures}>
                        {plan.features.slice(0, 4).map((f, i) => (
                          <li key={i} style={styles.planFeature}>
                            <Check size={13} color="#22C55E" />
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
              <div style={styles.btnRow}>
                <button type="button" onClick={handleBack} style={styles.secondaryBtn}>Back</button>
                <button type="button" onClick={handleNext} style={styles.primaryBtn}>
                  <Zap size={18} />
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Card Details */}
          {step === 4 && (
            <div style={styles.form}>
              {/* Success */}
              {paymentStep === 'success' && (
                <div style={styles.successContainer}>
                  <div style={styles.successIcon}><Check size={48} color="#22C55E" /></div>
                  <h3 style={styles.successTitle}>Your 14-Day Trial Has Started</h3>
                  <p style={styles.successText}>
                    Full {selectedPlanData?.name} access activated. Your card won't be charged until day 15.
                    Redirecting to sign in…
                  </p>
                </div>
              )}

              {/* OTP */}
              {paymentStep === 'otp' && (
                <div style={styles.otpContainer}>
                  <Lock size={40} color="#2563EB" />
                  <h3 style={styles.otpTitle}>Enter OTP</h3>
                  <p style={styles.otpText}>Enter the code sent to your registered phone</p>
                  <input
                    type="text"
                    value={otpValue}
                    onChange={e => setOtpValue(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="------"
                    style={styles.otpInput}
                    maxLength={6}
                    autoFocus
                  />
                  <button onClick={handleOtpSubmit} style={styles.primaryBtn} disabled={isLoading}>
                    {isLoading ? <Loader size={20} className="spin" /> : 'Verify OTP'}
                  </button>
                </div>
              )}

              {/* Processing */}
              {paymentStep === 'processing' && (
                <div style={styles.processingContainer}>
                  <Loader size={40} color="#2563EB" className="spin" />
                  <h3 style={styles.otpTitle}>Verifying card…</h3>
                  <p style={styles.otpText}>A ₦100 verification charge will be applied and refunded</p>
                </div>
              )}

              {/* Card Form */}
              {paymentStep === 'card' && (
                <>
                  <div style={styles.secureNotice}>
                    <Lock size={14} />
                    <span>Secure card capture — encrypted end-to-end</span>
                  </div>

                  {/* Trial summary */}
                  <div style={styles.trialSummary}>
                    <div style={styles.trialSummaryHeader}>
                      <Shield size={18} color="#22C55E" />
                      <span style={{ color: '#22C55E', fontWeight: 600, fontSize: 14 }}>14-Day Free Trial</span>
                    </div>
                    <div style={styles.trialSummaryRow}>
                      <span style={{ color: '#8B949E' }}>Selected Plan</span>
                      <span style={{ color: '#E6EDF3', fontWeight: 600 }}>{selectedPlanData?.name}</span>
                    </div>
                    <div style={styles.trialSummaryRow}>
                      <span style={{ color: '#8B949E' }}>Trial Period</span>
                      <span style={{ color: '#22C55E', fontWeight: 600 }}>14 days FREE</span>
                    </div>
                    <div style={styles.trialSummaryRow}>
                      <span style={{ color: '#8B949E' }}>After Trial</span>
                      <span style={{ color: '#E6EDF3' }}>₦{selectedPlanData?.price.toLocaleString()}/month + VAT</span>
                    </div>
                    <div style={styles.trialDivider} />
                    <div style={styles.trialSummaryRow}>
                      <span style={{ color: '#6E7681', fontSize: 12 }}>Due today (card verification)</span>
                      <span style={{ color: '#6E7681', fontSize: 12 }}>₦100 (refundable)</span>
                    </div>
                  </div>

                  {/* Card Number */}
                  <div style={styles.field}>
                    <label style={styles.label}>Card Number</label>
                    <div style={styles.inputWrapper}>
                      <CreditCard size={18} style={styles.inputIcon} />
                      <input
                        type="text"
                        value={card.number}
                        onChange={e => setCard({ ...card, number: formatCardNumber(e.target.value) })}
                        placeholder="1234 5678 9012 3456"
                        style={{ ...styles.cardInput, ...(cardErrors.number && styles.inputError) }}
                        maxLength={19}
                      />
                    </div>
                    {cardErrors.number && <span style={styles.errorText}>{cardErrors.number}</span>}
                  </div>

                  <div style={styles.row}>
                    <div style={styles.field}>
                      <label style={styles.label}>Expiry Date</label>
                      <div style={styles.inputWrapper}>
                        <Calendar size={18} style={styles.inputIcon} />
                        <input
                          type="text"
                          value={card.expiry}
                          onChange={e => setCard({ ...card, expiry: formatExpiry(e.target.value) })}
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
                          onChange={e => setCard({ ...card, cvv: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                          placeholder="123"
                          style={{ ...styles.cardInput, ...(cardErrors.cvv && styles.inputError) }}
                          maxLength={4}
                        />
                      </div>
                      {cardErrors.cvv && <span style={styles.errorText}>{cardErrors.cvv}</span>}
                    </div>
                  </div>

                  <div style={styles.btnRow}>
                    <button type="button" onClick={handleBack} style={styles.secondaryBtn}>Back</button>
                    <button
                      type="button"
                      onClick={handleStartTrial}
                      disabled={isLoading}
                      style={{ ...styles.primaryBtn, opacity: isLoading ? 0.7 : 1 }}
                    >
                      {isLoading ? (
                        <><Loader size={18} className="spin" /><span>Verifying…</span></>
                      ) : (
                        <><Zap size={18} /><span>Start 14-Day Trial</span></>
                      )}
                    </button>
                  </div>

                  <p style={styles.disclaimer}>
                    A ₦100 refundable card verification charge will be applied. Your subscription of{' '}
                    ₦{selectedPlanData?.price.toLocaleString()}/month + VAT begins on day 15 unless you cancel.
                  </p>
                </>
              )}
            </div>
          )}

          <p style={styles.loginText}>
            Already have an account?{' '}
            <Link to="/login" style={styles.link}>Sign in</Link>
          </p>
        </div>
      </div>

      {/* Right — Brand */}
      <div style={styles.brandSection}>
        <div style={styles.brandContent}>
          <h2 style={styles.brandTitle}>Simple Pricing for Serious Businesses</h2>
          <p style={styles.brandSubtitle}>
            Full financial and tax compliance infrastructure. 14-day trial. Cancel anytime.
          </p>
          <div style={styles.trustBadges}>
            {['14-Day Business Trial', 'Audit-Ready Reports', 'VAT Compliant'].map(badge => (
              <div key={badge} style={styles.badge}>
                <Check size={14} color="#22C55E" />
                <span>{badge}</span>
              </div>
            ))}
          </div>
          <div style={styles.stats}>
            <div style={styles.stat}>
              <span style={styles.statValue}>₦2.5B+</span>
              <span style={styles.statLabel}>Tax Calculated</span>
            </div>
            <div style={styles.stat}>
              <span style={styles.statValue}>5,000+</span>
              <span style={styles.statLabel}>Businesses</span>
            </div>
            <div style={styles.stat}>
              <span style={styles.statValue}>99.9%</span>
              <span style={styles.statLabel}>Accuracy</span>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
};

// Helper — convert hex to r,g,b for rgba()
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
    : '37, 99, 235';
}

const styles = {
  container: { display: 'flex', height: '100%', backgroundColor: '#0D1117' },
  formSection: { width: '58%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, overflowY: 'auto' },
  formWrapper: { width: '100%', maxWidth: 560 },
  logo: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 },
  logoIcon: { width: 48, height: 48, borderRadius: 12, backgroundColor: 'rgba(37, 99, 235, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  logoText: { fontSize: 24, fontWeight: 700, color: '#E6EDF3' },
  progress: { display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  progressStep: { width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600 },
  progressLine: { width: 40, height: 2 },
  progressLabels: { display: 'flex', justifyContent: 'space-between', marginBottom: 24, fontSize: 11, paddingLeft: 5, paddingRight: 5 },
  title: { fontSize: 22, fontWeight: 700, color: '#E6EDF3', margin: '0 0 16px', textAlign: 'center' },
  errorBox: { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 8, color: '#EF4444', fontSize: 14, marginBottom: 16 },
  form: { display: 'flex', flexDirection: 'column', gap: 14 },
  row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 13, fontWeight: 500, color: '#E6EDF3' },
  input: { width: '100%', padding: '11px 14px', backgroundColor: '#161B22', border: '1px solid #30363D', borderRadius: 8, color: '#E6EDF3', fontSize: 14, outline: 'none', boxSizing: 'border-box' },
  select: { width: '100%', padding: '11px 14px', backgroundColor: '#161B22', border: '1px solid #30363D', borderRadius: 8, color: '#E6EDF3', fontSize: 14, outline: 'none', cursor: 'pointer' },
  passwordWrapper: { position: 'relative' },
  eyeBtn: { position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#6E7681', cursor: 'pointer', padding: 4 },
  btnRow: { display: 'flex', gap: 12, marginTop: 8 },
  primaryBtn: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, backgroundColor: '#2563EB', border: 'none', borderRadius: 8, color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer' },
  secondaryBtn: { flex: 1, padding: 14, backgroundColor: 'transparent', border: '1px solid #30363D', borderRadius: 8, color: '#E6EDF3', fontSize: 15, fontWeight: 500, cursor: 'pointer' },
  loginText: { textAlign: 'center', fontSize: 14, color: '#8B949E', marginTop: 20 },
  link: { color: '#2563EB', textDecoration: 'none', fontWeight: 500 },
  trialNote: { fontSize: 13, color: '#22C55E', textAlign: 'center', padding: '10px 16px', backgroundColor: 'rgba(34, 197, 94, 0.06)', border: '1px solid rgba(34, 197, 94, 0.2)', borderRadius: 8, margin: 0 },
  plansGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 },
  planCard: { position: 'relative', padding: '18px 14px', border: '2px solid', borderRadius: 12, cursor: 'pointer', transition: 'all 0.2s' },
  popularBadge: { position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)', padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap' },
  planIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#21262D', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  planName: { fontSize: 16, fontWeight: 700, color: '#E6EDF3', margin: '0 0 6px' },
  planPrice: { marginBottom: 6 },
  priceValue: { fontSize: 20, fontWeight: 700, color: '#E6EDF3' },
  pricePeriod: { fontSize: 12, color: '#8B949E' },
  planDesc: { fontSize: 11, color: '#6E7681', margin: '0 0 10px', lineHeight: 1.4 },
  planFeatures: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 },
  planFeature: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#8B949E' },
  // Payment
  secureNotice: { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'rgba(34, 197, 94, 0.08)', border: '1px solid rgba(34, 197, 94, 0.2)', borderRadius: 8, color: '#22C55E', fontSize: 12 },
  trialSummary: { padding: 16, background: '#161B22', borderRadius: 10, border: '1px solid #30363D', display: 'flex', flexDirection: 'column', gap: 8 },
  trialSummaryHeader: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 },
  trialSummaryRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 },
  trialDivider: { height: 1, backgroundColor: '#30363D', margin: '4px 0' },
  inputWrapper: { position: 'relative', display: 'flex', alignItems: 'center' },
  inputIcon: { position: 'absolute', left: 12, color: '#6E7681', zIndex: 1 },
  cardInput: { width: '100%', padding: '11px 14px 11px 40px', backgroundColor: '#161B22', border: '1px solid #30363D', borderRadius: 8, color: '#E6EDF3', fontSize: 14, outline: 'none', boxSizing: 'border-box' },
  inputError: { borderColor: '#EF4444' },
  errorText: { fontSize: 12, color: '#EF4444' },
  disclaimer: { fontSize: 11, color: '#6E7681', textAlign: 'center', lineHeight: 1.5 },
  successContainer: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: 24 },
  successIcon: { width: 72, height: 72, borderRadius: '50%', backgroundColor: 'rgba(34, 197, 94, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  successTitle: { fontSize: 18, fontWeight: 700, color: '#E6EDF3', margin: 0 },
  successText: { fontSize: 14, color: '#8B949E', margin: 0, textAlign: 'center', lineHeight: 1.6 },
  otpContainer: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: 24 },
  otpTitle: { fontSize: 17, fontWeight: 600, color: '#E6EDF3', margin: 0 },
  otpText: { fontSize: 13, color: '#8B949E', margin: 0, textAlign: 'center' },
  otpInput: { width: 200, padding: 14, background: '#161B22', border: '2px solid #30363D', borderRadius: 8, color: '#E6EDF3', fontSize: 24, textAlign: 'center', letterSpacing: 8, outline: 'none' },
  processingContainer: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: 24 },
  // Brand panel
  brandSection: { width: '42%', backgroundColor: '#0D1117', borderLeft: '1px solid #21262D', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 },
  brandContent: { maxWidth: 340 },
  brandTitle: { fontSize: 24, fontWeight: 700, color: '#E6EDF3', marginBottom: 12 },
  brandSubtitle: { fontSize: 14, color: '#8B949E', marginBottom: 24, lineHeight: 1.7 },
  trustBadges: { display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 32 },
  badge: { display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: '#E6EDF3' },
  stats: { display: 'flex', justifyContent: 'space-between', paddingTop: 24, borderTop: '1px solid #21262D' },
  stat: { display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: 700, color: '#2563EB' },
  statLabel: { fontSize: 11, color: '#8B949E' }
};

export default RegisterPage;
