import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Calculator, AlertCircle, Loader, Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import { resetPasswordRequest } from '../../services/supabase';
import toast from 'react-hot-toast';

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email) {
      setError('Please enter your email address');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setIsLoading(true);

    try {
      await resetPasswordRequest(email);
      setIsSuccess(true);
      toast.success('Password reset email sent!');
    } catch (err) {
      console.error('Reset password error:', err);
      // Don't reveal if email exists or not for security
      if (err.message?.includes('rate limit')) {
        setError('Too many requests. Please try again later.');
      } else {
        // Show success even if email doesn't exist (security best practice)
        setIsSuccess(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      {/* Left - Form */}
      <div style={styles.formSection}>
        <div style={styles.formWrapper}>
          {/* Logo */}
          <div style={styles.logo}>
            <div style={styles.logoIcon}>
              <Calculator size={28} color="#2563EB" />
            </div>
            <span style={styles.logoText}>TaxWise</span>
          </div>

          {!isSuccess ? (
            <>
              <h1 style={styles.title}>Forgot password?</h1>
              <p style={styles.subtitle}>
                No worries, we'll send you reset instructions.
              </p>

              {error && (
                <div style={styles.errorBox}>
                  <AlertCircle size={18} />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} style={styles.form}>
                <div style={styles.field}>
                  <label style={styles.label}>Email</label>
                  <div style={styles.inputWrapper}>
                    <Mail size={18} style={styles.inputIcon} />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@company.com"
                      style={styles.inputWithIcon}
                      autoFocus
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  style={{ ...styles.submitBtn, opacity: isLoading ? 0.7 : 1 }}
                >
                  {isLoading ? (
                    <>
                      <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} />
                      <span>Sending...</span>
                    </>
                  ) : (
                    'Reset Password'
                  )}
                </button>
              </form>
            </>
          ) : (
            <div style={styles.successContainer}>
              <div style={styles.successIcon}>
                <CheckCircle size={48} color="#22C55E" />
              </div>
              <h1 style={styles.title}>Check your email</h1>
              <p style={styles.subtitle}>
                We sent a password reset link to<br />
                <strong style={{ color: '#E6EDF3' }}>{email}</strong>
              </p>
              <p style={styles.hintText}>
                Didn't receive the email? Check your spam folder or{' '}
                <button 
                  onClick={() => setIsSuccess(false)} 
                  style={styles.resendBtn}
                >
                  try another email address
                </button>
              </p>
            </div>
          )}

          <Link to="/login" style={styles.backLink}>
            <ArrowLeft size={16} />
            <span>Back to login</span>
          </Link>
        </div>
      </div>

      {/* Right - Brand */}
      <div style={styles.brandSection}>
        <div style={styles.brandContent}>
          <h2 style={styles.brandTitle}>Secure Password Recovery</h2>
          <div style={styles.features}>
            <div style={styles.feature}>
              <div style={styles.featureCheck}>1</div>
              <span>Enter your registered email address</span>
            </div>
            <div style={styles.feature}>
              <div style={styles.featureCheck}>2</div>
              <span>Check your inbox for the reset link</span>
            </div>
            <div style={styles.feature}>
              <div style={styles.featureCheck}>3</div>
              <span>Create a new secure password</span>
            </div>
            <div style={styles.feature}>
              <div style={styles.featureCheck}>4</div>
              <span>Sign in with your new password</span>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

const styles = {
  container: { display: 'flex', height: '100%', backgroundColor: '#0D1117' },
  formSection: { width: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 },
  formWrapper: { width: '100%', maxWidth: 400 },
  logo: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 },
  logoIcon: { width: 48, height: 48, borderRadius: 12, backgroundColor: 'rgba(37, 99, 235, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  logoText: { fontSize: 24, fontWeight: 700, color: '#E6EDF3' },
  title: { fontSize: 28, fontWeight: 700, color: '#E6EDF3', margin: '0 0 8px' },
  subtitle: { fontSize: 15, color: '#8B949E', margin: '0 0 24px', lineHeight: 1.5 },
  errorBox: { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 8, color: '#EF4444', fontSize: 14, marginBottom: 20 },
  form: { display: 'flex', flexDirection: 'column', gap: 20 },
  field: { display: 'flex', flexDirection: 'column', gap: 8 },
  label: { fontSize: 14, fontWeight: 500, color: '#E6EDF3' },
  inputWrapper: { position: 'relative' },
  inputIcon: { position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#6E7681' },
  inputWithIcon: { width: '100%', padding: '12px 14px 12px 44px', backgroundColor: '#161B22', border: '1px solid #30363D', borderRadius: 8, color: '#E6EDF3', fontSize: 14, outline: 'none', boxSizing: 'border-box' },
  submitBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: 14, backgroundColor: '#2563EB', border: 'none', borderRadius: 8, color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer', marginTop: 8 },
  backLink: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#8B949E', textDecoration: 'none', fontSize: 14, marginTop: 32 },
  successContainer: { textAlign: 'center' },
  successIcon: { marginBottom: 24 },
  hintText: { fontSize: 14, color: '#6E7681', marginTop: 16, lineHeight: 1.5 },
  resendBtn: { background: 'none', border: 'none', color: '#2563EB', cursor: 'pointer', fontSize: 14, padding: 0, fontWeight: 500 },
  brandSection: { width: '50%', backgroundColor: '#161B22', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, borderLeft: '1px solid #21262D' },
  brandContent: { maxWidth: 400 },
  brandTitle: { fontSize: 24, fontWeight: 700, color: '#E6EDF3', marginBottom: 32 },
  features: { display: 'flex', flexDirection: 'column', gap: 16 },
  feature: { display: 'flex', alignItems: 'center', gap: 12, color: '#8B949E', fontSize: 15 },
  featureCheck: { width: 24, height: 24, borderRadius: '50%', backgroundColor: 'rgba(37, 99, 235, 0.1)', color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600 }
};

export default ForgotPasswordPage;