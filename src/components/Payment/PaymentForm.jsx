/**
 * TaxWise Custom Payment Form
 * Invisible Paystack integration - no popup
 */
import React, { useState } from 'react';
import { CreditCard, Lock, Calendar, Shield, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import config from '../../config';

const PaymentForm = ({ 
  email, 
  amount, 
  plan, 
  organizationId,
  onSuccess, 
  onError,
  buttonText = 'Pay Now'
}) => {
  const [card, setCard] = useState({
    number: '',
    expiry: '',
    cvv: '',
    name: ''
  });
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('card'); // card, otp, 3ds, success
  const [otpValue, setOtpValue] = useState('');
  const [reference, setReference] = useState('');
  const [errors, setErrors] = useState({});

  // Format card number with spaces
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

  // Format expiry date
  const formatExpiry = (value) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    if (v.length >= 2) {
      return v.substring(0, 2) + '/' + v.substring(2, 4);
    }
    return v;
  };

  // Validate card
  const validateCard = () => {
    const newErrors = {};
    const cardNum = card.number.replace(/\s/g, '');
    
    if (!cardNum || cardNum.length < 16) {
      newErrors.number = 'Valid card number required';
    }
    if (!card.expiry || card.expiry.length < 5) {
      newErrors.expiry = 'Valid expiry required';
    }
    if (!card.cvv || card.cvv.length < 3) {
      newErrors.cvv = 'Valid CVV required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Get session token
  const getSessionToken = async () => {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token;
  };

  // Charge card
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateCard()) return;

    setLoading(true);
    try {
      const [expiryMonth, expiryYear] = card.expiry.split('/');
      const token = await getSessionToken();
      
      const response = await fetch(`${config.SUPABASE_URL}/functions/v1/paystack`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': config.SUPABASE_ANON_KEY,
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify({
          action: 'charge_card',
          email,
          amount: amount * 100, // Convert to kobo
          plan,
          card: {
            number: card.number.replace(/\s/g, ''),
            cvv: card.cvv,
            expiry_month: expiryMonth,
            expiry_year: '20' + expiryYear
          },
          metadata: { organization_id: organizationId }
        })
      });

      const data = await response.json();

      if (data.success) {
        setReference(data.reference);
        
        if (data.status === 'success') {
          // Payment successful, verify and save authorization
          await verifyPayment(data.reference);
        } else if (data.status === 'send_otp' || data.status === 'send_pin') {
          setStep('otp');
          toast.success(data.display_text || 'Please enter the OTP sent to your phone');
        } else if (data.status === '3ds_required') {
          setStep('3ds');
          // Open 3DS URL in new window
          window.open(data.url, '_blank', 'width=500,height=600');
          toast.success('Complete authentication in the new window');
          // Poll for completion
          pollForCompletion(data.reference);
        }
      } else {
        throw new Error(data.error || 'Payment failed');
      }
    } catch (error) {
      console.error('Payment error:', error);
      toast.error(error.message);
      onError?.(error);
    } finally {
      setLoading(false);
    }
  };

  // Submit OTP
  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    if (!otpValue || otpValue.length < 4) {
      toast.error('Please enter valid OTP');
      return;
    }

    setLoading(true);
    try {
      const token = await getSessionToken();
      
      const response = await fetch(`${config.SUPABASE_URL}/functions/v1/paystack`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': config.SUPABASE_ANON_KEY,
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify({
          action: 'submit_otp',
          reference,
          otp: otpValue
        })
      });

      const data = await response.json();

      if (data.status && data.data?.status === 'success') {
        await verifyPayment(reference);
      } else {
        throw new Error(data.message || 'OTP verification failed');
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Verify payment and save authorization
  const verifyPayment = async (ref) => {
    try {
      const token = await getSessionToken();
      
      const response = await fetch(`${config.SUPABASE_URL}/functions/v1/paystack`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': config.SUPABASE_ANON_KEY,
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify({
          action: 'verify',
          reference: ref,
          organization_id: organizationId,
          plan
        })
      });

      const data = await response.json();

      if (data.success) {
        setStep('success');
        toast.success('Payment successful!');
        onSuccess?.(data);
      } else {
        throw new Error(data.error || 'Verification failed');
      }
    } catch (error) {
      toast.error(error.message);
      onError?.(error);
    }
  };

  // Poll for 3DS completion
  const pollForCompletion = async (ref) => {
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes
    
    const poll = async () => {
      attempts++;
      if (attempts > maxAttempts) {
        toast.error('Authentication timeout');
        setStep('card');
        return;
      }

      try {
        const token = await getSessionToken();
        const response = await fetch(`${config.SUPABASE_URL}/functions/v1/paystack`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': config.SUPABASE_ANON_KEY,
            ...(token && { 'Authorization': `Bearer ${token}` })
          },
          body: JSON.stringify({
            action: 'verify',
            reference: ref,
            organization_id: organizationId,
            plan
          })
        });

        const data = await response.json();
        
        if (data.success) {
          setStep('success');
          toast.success('Payment successful!');
          onSuccess?.(data);
        } else {
          setTimeout(poll, 5000);
        }
      } catch {
        setTimeout(poll, 5000);
      }
    };

    setTimeout(poll, 5000);
  };

  // Success state
  if (step === 'success') {
    return (
      <div style={styles.successContainer}>
        <CheckCircle size={64} color="#22C55E" />
        <h3 style={styles.successTitle}>Payment Successful!</h3>
        <p style={styles.successText}>Your subscription is now active.</p>
      </div>
    );
  }

  // OTP state
  if (step === 'otp') {
    return (
      <form onSubmit={handleOtpSubmit} style={styles.form}>
        <div style={styles.otpContainer}>
          <Shield size={48} color="#2563EB" />
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
          
          <button type="submit" style={styles.submitButton} disabled={loading}>
            {loading ? <Loader2 size={20} className="spin" /> : 'Verify OTP'}
          </button>
        </div>
      </form>
    );
  }

  // 3DS state
  if (step === '3ds') {
    return (
      <div style={styles.threeDsContainer}>
        <Loader2 size={48} color="#2563EB" className="spin" />
        <h3 style={styles.otpTitle}>Authenticating...</h3>
        <p style={styles.otpText}>Complete authentication in the popup window</p>
      </div>
    );
  }

  // Card form
  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <div style={styles.secureNotice}>
        <Lock size={14} />
        <span>Secure payment - Your card details are encrypted</span>
      </div>

      {/* Card Number */}
      <div style={styles.inputGroup}>
        <label style={styles.label}>Card Number</label>
        <div style={styles.inputWrapper}>
          <CreditCard size={18} style={styles.inputIcon} />
          <input
            type="text"
            value={card.number}
            onChange={(e) => setCard({ ...card, number: formatCardNumber(e.target.value) })}
            placeholder="1234 5678 9012 3456"
            style={{ ...styles.input, ...(errors.number && styles.inputError) }}
            maxLength={19}
          />
        </div>
        {errors.number && <span style={styles.errorText}>{errors.number}</span>}
      </div>

      {/* Expiry and CVV */}
      <div style={styles.row}>
        <div style={{ ...styles.inputGroup, flex: 1 }}>
          <label style={styles.label}>Expiry Date</label>
          <div style={styles.inputWrapper}>
            <Calendar size={18} style={styles.inputIcon} />
            <input
              type="text"
              value={card.expiry}
              onChange={(e) => setCard({ ...card, expiry: formatExpiry(e.target.value) })}
              placeholder="MM/YY"
              style={{ ...styles.input, ...(errors.expiry && styles.inputError) }}
              maxLength={5}
            />
          </div>
          {errors.expiry && <span style={styles.errorText}>{errors.expiry}</span>}
        </div>

        <div style={{ ...styles.inputGroup, flex: 1 }}>
          <label style={styles.label}>CVV</label>
          <div style={styles.inputWrapper}>
            <Lock size={18} style={styles.inputIcon} />
            <input
              type="password"
              value={card.cvv}
              onChange={(e) => setCard({ ...card, cvv: e.target.value.replace(/\D/g, '').slice(0, 4) })}
              placeholder="123"
              style={{ ...styles.input, ...(errors.cvv && styles.inputError) }}
              maxLength={4}
            />
          </div>
          {errors.cvv && <span style={styles.errorText}>{errors.cvv}</span>}
        </div>
      </div>

      {/* Amount Display */}
      <div style={styles.amountDisplay}>
        <span>Amount to pay:</span>
        <span style={styles.amount}>₦{amount?.toLocaleString()}</span>
      </div>

      {/* Submit Button */}
      <button type="submit" style={styles.submitButton} disabled={loading}>
        {loading ? (
          <>
            <Loader2 size={20} className="spin" />
            Processing...
          </>
        ) : (
          <>
            <Lock size={18} />
            {buttonText}
          </>
        )}
      </button>

      <p style={styles.disclaimer}>
        By proceeding, you agree to our terms. Your card will be saved for automatic renewal.
      </p>

      <style>{`
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </form>
  );
};

const styles = {
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16
  },
  secureNotice: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
    background: 'rgba(34, 197, 94, 0.1)',
    border: '1px solid rgba(34, 197, 94, 0.3)',
    borderRadius: 8,
    color: '#22C55E',
    fontSize: 12
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6
  },
  label: {
    fontSize: 13,
    fontWeight: 500,
    color: '#8B949E'
  },
  inputWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center'
  },
  inputIcon: {
    position: 'absolute',
    left: 12,
    color: '#8B949E'
  },
  input: {
    width: '100%',
    padding: '12px 12px 12px 40px',
    background: '#0D1117',
    border: '1px solid #30363D',
    borderRadius: 8,
    color: '#E6EDF3',
    fontSize: 14,
    outline: 'none',
    transition: 'border-color 0.2s'
  },
  inputError: {
    borderColor: '#EF4444'
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444'
  },
  row: {
    display: 'flex',
    gap: 12
  },
  amountDisplay: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    background: '#161B22',
    borderRadius: 8,
    fontSize: 14,
    color: '#8B949E'
  },
  amount: {
    fontSize: 20,
    fontWeight: 700,
    color: '#E6EDF3'
  },
  submitButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '14px 24px',
    background: '#2563EB',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background 0.2s'
  },
  disclaimer: {
    fontSize: 11,
    color: '#6E7681',
    textAlign: 'center',
    lineHeight: 1.5
  },
  successContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
    padding: 32
  },
  successTitle: {
    fontSize: 20,
    fontWeight: 600,
    color: '#E6EDF3',
    margin: 0
  },
  successText: {
    fontSize: 14,
    color: '#8B949E',
    margin: 0
  },
  otpContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
    padding: 24
  },
  otpTitle: {
    fontSize: 18,
    fontWeight: 600,
    color: '#E6EDF3',
    margin: 0
  },
  otpText: {
    fontSize: 14,
    color: '#8B949E',
    margin: 0
  },
  otpInput: {
    width: 200,
    padding: 16,
    background: '#0D1117',
    border: '2px solid #30363D',
    borderRadius: 8,
    color: '#E6EDF3',
    fontSize: 24,
    textAlign: 'center',
    letterSpacing: 8,
    outline: 'none'
  },
  threeDsContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
    padding: 32
  }
};

export default PaymentForm;