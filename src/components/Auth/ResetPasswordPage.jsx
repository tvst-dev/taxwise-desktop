import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Calculator, AlertCircle, Loader, Eye, EyeOff, CheckCircle, Lock } from 'lucide-react';
import { updatePassword, getSupabase } from '../../services/supabase';
import toast from 'react-hot-toast';

const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [isValidSession, setIsValidSession] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const supabase = getSupabase();
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          setIsValidSession(true);
        } else {
          setError('Invalid or expired reset link. Please request a new one.');
        }
      } catch (err) {
        console.error('Session check error:', err);
        setError('Unable to verify reset link. Please try again.');
      } finally {
        setCheckingSession(false);
      }
    };

    checkSession();

    const supabase = getSupabase();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsValidSession(true);
        setCheckingSession(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const validatePassword = (pwd) => {
    if (pwd.length < 8) return 'Password must be at least 8 characters';
    if (!/[A-Z]/.test(pwd)) return 'Password must contain an uppercase letter';
    if (!/[a-z]/.test(pwd)) return 'Password must contain a lowercase letter';
    if (!/[0-9]/.test(pwd)) return 'Password must contain a number';
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!password || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      await updatePassword(password);
      setIsSuccess(true);
      toast.success('Password updated successfully!');
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      console.error('Update password error:', err);
      setError(err.message || 'Failed to update password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const getPasswordStrength = () => {
    if (!password) return { strength: 0, label: '', color: '#30363D' };
    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;

    const labels = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Very Strong'];
    const colors = ['#30363D', '#EF4444', '#F59E0B', '#F59E0B', '#22C55E', '#22C55E'];
    return { strength, label: labels[strength], color: colors[strength] };
  };

  const passwordStrength = getPasswordStrength();

  if (checkingSession) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingContainer}>
          <Loader size={32} style={{ animation: 'spin 1s linear infinite', color: '#2563EB' }} />
          <p style={{ color: '#8B949E', marginTop: 16 }}>Verifying reset link...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.formSection}>
        <div style={styles.formWrapper}>
          <div style={styles.logo}>
            <div style={styles.logoIcon}>
              <Calculator size={28} color="#2563EB" />
            </div>
            <span style={styles.logoText}>TaxWise</span>
          </div>

          {!isValidSession && !isSuccess ? (
            <div style={styles.errorContainer}>
              <AlertCircle size={48} color="#EF4444" />
              <h1 style={styles.title}>Link Expired</h1>
              <p style={styles.subtitle}>{error}</p>
              <Link to="/forgot-password" style={styles.requestNewLink}>
                Request a new reset link
              </Link>
            </div>
          ) : isSuccess ? (
            <div style={styles.successContainer}>
              <CheckCircle size={48} color="#22C55E" />
              <h1 style={styles.title}>Password Updated!</h1>
              <p style={styles.subtitle}>
                Your password has been successfully updated.<br />
                Redirecting you to login...
              </p>
            </div>
          ) : (
            <>
              <h1 style={styles.title}>Set new password</h1>
              <p style={styles.subtitle}>
                Your new password must be different from previously used passwords.
              </p>

              {error && (
                <div style={styles.errorBox}>
                  <AlertCircle size={18} />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} style={styles.form}>
                <div style={styles.field}>
                  <label style={styles.label}>New Password</label>
                  <div style={styles.passwordWrapper}>
                    <Lock size={18} style={styles.inputIcon} />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      style={styles.inputWithIcon}
                      autoFocus
                    />
                    <button type="button" style={styles.eyeBtn} onClick={() => setShowPassword(!showPassword)}>
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {password && (
                    <div style={styles.strengthContainer}>
                      <div style={styles.strengthBar}>
                        {[1, 2, 3, 4, 5].map(i => (
                          <div key={i} style={{ ...styles.strengthSegment, backgroundColor: i <= passwordStrength.strength ? passwordStrength.color : '#30363D' }} />
                        ))}
                      </div>
                      <span style={{ ...styles.strengthLabel, color: passwordStrength.color }}>{passwordStrength.label}</span>
                    </div>
                  )}
                </div>

                <div style={styles.field}>
                  <label style={styles.label}>Confirm Password</label>
                  <div style={styles.passwordWrapper}>
                    <Lock size={18} style={styles.inputIcon} />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      style={styles.inputWithIcon}
                    />
                    <button type="button" style={styles.eyeBtn} onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                      {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {confirmPassword && password === confirmPassword && (
                    <div style={styles.matchIndicator}>
                      <CheckCircle size={14} color="#22C55E" />
                      <span>Passwords match</span>
                    </div>
                  )}
                </div>

                <button type="submit" disabled={isLoading} style={{ ...styles.submitBtn, opacity: isLoading ? 0.7 : 1 }}>
                  {isLoading ? (
                    <>
                      <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} />
                      <span>Updating...</span>
                    </>
                  ) : (
                    'Reset Password'
                  )}
                </button>
              </form>
            </>
          )}

          <Link to="/login" style={styles.backLink}>Back to login</Link>
        </div>
      </div>

      <div style={styles.brandSection}>
        <div style={styles.brandContent}>
          <h2 style={styles.brandTitle}>Password Requirements</h2>
          <div style={styles.features}>
            {[
              { check: password.length >= 8, text: 'At least 8 characters' },
              { check: /[A-Z]/.test(password), text: 'One uppercase letter' },
              { check: /[a-z]/.test(password), text: 'One lowercase letter' },
              { check: /[0-9]/.test(password), text: 'One number' },
              { check: /[^A-Za-z0-9]/.test(password), text: 'One special character (optional)' }
            ].map((req, i) => (
              <div key={i} style={styles.feature}>
                <div style={{ ...styles.featureCheck, backgroundColor: req.check ? 'rgba(34, 197, 94, 0.1)' : 'rgba(107, 114, 128, 0.1)', color: req.check ? '#22C55E' : '#6B7280' }}>
                  {req.check ? '✓' : '○'}
                </div>
                <span>{req.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

const styles = {
  container: { display: 'flex', height: '100%', backgroundColor: '#0D1117' },
  loadingContainer: { width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
  formSection: { width: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 },
  formWrapper: { width: '100%', maxWidth: 400 },
  logo: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 },
  logoIcon: { width: 48, height: 48, borderRadius: 12, backgroundColor: 'rgba(37, 99, 235, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  logoText: { fontSize: 24, fontWeight: 700, color: '#E6EDF3' },
  title: { fontSize: 28, fontWeight: 700, color: '#E6EDF3', margin: '0 0 8px' },
  subtitle: { fontSize: 15, color: '#8B949E', margin: '0 0 24px', lineHeight: 1.5 },
  errorBox: { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 8, color: '#EF4444', fontSize: 14, marginBottom: 20 },
  errorContainer: { textAlign: 'center' },
  form: { display: 'flex', flexDirection: 'column', gap: 20 },
  field: { display: 'flex', flexDirection: 'column', gap: 8 },
  label: { fontSize: 14, fontWeight: 500, color: '#E6EDF3' },
  passwordWrapper: { position: 'relative' },
  inputIcon: { position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#6E7681' },
  inputWithIcon: { width: '100%', padding: '12px 44px', backgroundColor: '#161B22', border: '1px solid #30363D', borderRadius: 8, color: '#E6EDF3', fontSize: 14, outline: 'none', boxSizing: 'border-box' },
  eyeBtn: { position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#6E7681', cursor: 'pointer', padding: 4 },
  strengthContainer: { display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 },
  strengthBar: { display: 'flex', gap: 4, flex: 1 },
  strengthSegment: { height: 4, flex: 1, borderRadius: 2, transition: 'background-color 0.2s' },
  strengthLabel: { fontSize: 12, fontWeight: 500 },
  matchIndicator: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#22C55E', marginTop: 4 },
  submitBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: 14, backgroundColor: '#2563EB', border: 'none', borderRadius: 8, color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer', marginTop: 8 },
  backLink: { display: 'block', textAlign: 'center', color: '#8B949E', textDecoration: 'none', fontSize: 14, marginTop: 32 },
  requestNewLink: { display: 'inline-block', marginTop: 16, padding: '12px 24px', backgroundColor: '#2563EB', borderRadius: 8, color: '#fff', textDecoration: 'none', fontSize: 14, fontWeight: 600 },
  successContainer: { textAlign: 'center' },
  brandSection: { width: '50%', backgroundColor: '#161B22', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, borderLeft: '1px solid #21262D' },
  brandContent: { maxWidth: 400 },
  brandTitle: { fontSize: 24, fontWeight: 700, color: '#E6EDF3', marginBottom: 32 },
  features: { display: 'flex', flexDirection: 'column', gap: 16 },
  feature: { display: 'flex', alignItems: 'center', gap: 12, color: '#8B949E', fontSize: 15 },
  featureCheck: { width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, transition: 'all 0.2s' }
};

export default ResetPasswordPage;