import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Calculator, AlertCircle, Loader } from 'lucide-react';
import { signIn } from '../../services/supabase';
import toast from 'react-hot-toast';

const LoginPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    setIsLoading(true);

    try {
      await signIn(email, password);
      toast.success('Welcome back!');
      navigate('/dashboard');
    } catch (err) {
      console.error('Login error:', err);
      if (err.message?.includes('Invalid login')) {
        setError('Invalid email or password');
      } else if (err.message?.includes('Email not confirmed')) {
        setError('Please verify your email address');
      } else {
        setError(err.message || 'Login failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

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

          <h1 style={styles.title}>Welcome back</h1>
          <p style={styles.subtitle}>Sign in to manage your taxes efficiently.</p>

          {error && (
            <div style={styles.errorBox}>
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} style={styles.form}>
            <div style={styles.field}>
              <label style={styles.label}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                style={styles.input}
                autoFocus
              />
            </div>

            <div style={styles.field}>
              <div style={styles.labelRow}>
                <label style={styles.label}>Password</label>
                <Link to="/forgot-password" style={styles.forgotLink}>Forgot password?</Link>
              </div>
              <div style={styles.passwordWrapper}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={styles.input}
                />
                <button type="button" style={styles.eyeBtn} onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={isLoading} style={{ ...styles.submitBtn, opacity: isLoading ? 0.7 : 1 }}>
              {isLoading ? (
                <>
                  <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} />
                  <span>Signing in...</span>
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <p style={styles.signupText}>
            Don't have an account? <Link to="/register" style={styles.link}>Create account</Link>
          </p>
        </div>
      </div>

      <div style={styles.brandSection}>
        <div style={styles.brandContent}>
          <h2 style={styles.brandTitle}>Nigerian Tax Management Made Simple</h2>
          <div style={styles.features}>
            <div style={styles.feature}><div style={styles.featureCheck}>✓</div><span>PAYE, CIT, VAT & WHT Calculations</span></div>
            <div style={styles.feature}><div style={styles.featureCheck}>✓</div><span>AI-Powered Document Extraction</span></div>
            <div style={styles.feature}><div style={styles.featureCheck}>✓</div><span>Automatic Bank Transaction Tracking</span></div>
            <div style={styles.feature}><div style={styles.featureCheck}>✓</div><span>Team Collaboration & Multi-User Access</span></div>
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
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
  subtitle: { fontSize: 15, color: '#8B949E', margin: '0 0 24px' },
  errorBox: { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 8, color: '#EF4444', fontSize: 14, marginBottom: 20 },
  form: { display: 'flex', flexDirection: 'column', gap: 20 },
  field: { display: 'flex', flexDirection: 'column', gap: 8 },
  labelRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 14, fontWeight: 500, color: '#E6EDF3' },
  forgotLink: { fontSize: 13, color: '#2563EB', textDecoration: 'none', fontWeight: 500 },
  input: { width: '100%', padding: '12px 14px', backgroundColor: '#161B22', border: '1px solid #30363D', borderRadius: 8, color: '#E6EDF3', fontSize: 14, outline: 'none', boxSizing: 'border-box' },
  passwordWrapper: { position: 'relative' },
  eyeBtn: { position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#6E7681', cursor: 'pointer', padding: 4 },
  submitBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: 14, backgroundColor: '#2563EB', border: 'none', borderRadius: 8, color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer', marginTop: 8 },
  signupText: { textAlign: 'center', fontSize: 14, color: '#8B949E', marginTop: 24 },
  link: { color: '#2563EB', textDecoration: 'none', fontWeight: 500 },
  brandSection: { width: '50%', backgroundColor: '#161B22', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, borderLeft: '1px solid #21262D' },
  brandContent: { maxWidth: 400 },
  brandTitle: { fontSize: 24, fontWeight: 700, color: '#E6EDF3', marginBottom: 32 },
  features: { display: 'flex', flexDirection: 'column', gap: 16 },
  feature: { display: 'flex', alignItems: 'center', gap: 12, color: '#8B949E', fontSize: 15 },
  featureCheck: { width: 24, height: 24, borderRadius: '50%', backgroundColor: 'rgba(34, 197, 94, 0.1)', color: '#22C55E', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600 }
};

export default LoginPage;