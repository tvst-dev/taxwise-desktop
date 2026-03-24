import React, { useState } from 'react';
import { Lock, Eye, EyeOff, Check } from 'lucide-react';
import { updatePassword } from '../../services/supabase';
import toast from 'react-hot-toast';

/**
 * Shown when an invited user first signs in via the taxwise:// deep link.
 * Forces them to set a password before accessing the app.
 */
const SetPasswordModal = ({ userName, onComplete }) => {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const isValid = password.length >= 8 && password === confirm;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isValid) return;

    setIsLoading(true);
    try {
      await updatePassword(password);
      toast.success('Password set! Welcome to TaxWise.');
      onComplete();
    } catch (err) {
      toast.error(err.message || 'Failed to set password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        {/* Icon */}
        <div style={styles.iconWrap}>
          <Lock size={28} color="#2563EB" />
        </div>

        <h2 style={styles.title}>Welcome to TaxWise!</h2>
        <p style={styles.subtitle}>
          {userName ? `Hi ${userName}, ` : ''}You've accepted your team invitation.
          Please set a password to secure your account.
        </p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>New Password</label>
            <div style={styles.inputWrap}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                style={styles.input}
                autoFocus
              />
              <button
                type="button"
                style={styles.eyeBtn}
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={16} color="#8B949E" /> : <Eye size={16} color="#8B949E" />}
              </button>
            </div>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Confirm Password</label>
            <div style={styles.inputWrap}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repeat your password"
                style={{
                  ...styles.input,
                  borderColor: confirm && !isValid ? '#EF4444' : confirm && isValid ? '#22C55E' : '#30363D'
                }}
              />
              {confirm && isValid && (
                <Check size={16} color="#22C55E" style={styles.eyeBtn} />
              )}
            </div>
            {confirm && password !== confirm && (
              <p style={styles.errorText}>Passwords do not match</p>
            )}
            {password && password.length < 8 && (
              <p style={styles.errorText}>Password must be at least 8 characters</p>
            )}
          </div>

          <button
            type="submit"
            disabled={!isValid || isLoading}
            style={{
              ...styles.submitBtn,
              opacity: !isValid || isLoading ? 0.5 : 1,
              cursor: !isValid || isLoading ? 'not-allowed' : 'pointer'
            }}
          >
            {isLoading ? 'Setting password...' : 'Set Password & Enter App'}
          </button>
        </form>
      </div>
    </div>
  );
};

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.85)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99999
  },
  modal: {
    width: '100%',
    maxWidth: '420px',
    backgroundColor: '#161B22',
    border: '1px solid #30363D',
    borderRadius: '16px',
    padding: '40px 32px',
    textAlign: 'center'
  },
  iconWrap: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    backgroundColor: 'rgba(37,99,235,0.12)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 20px'
  },
  title: {
    fontSize: '22px',
    fontWeight: '700',
    color: '#E6EDF3',
    margin: '0 0 8px 0'
  },
  subtitle: {
    fontSize: '14px',
    color: '#8B949E',
    lineHeight: '1.6',
    margin: '0 0 28px 0'
  },
  form: {
    textAlign: 'left'
  },
  field: {
    marginBottom: '18px'
  },
  label: {
    display: 'block',
    fontSize: '13px',
    fontWeight: '500',
    color: '#8B949E',
    marginBottom: '8px'
  },
  inputWrap: {
    position: 'relative'
  },
  input: {
    width: '100%',
    padding: '12px 44px 12px 14px',
    backgroundColor: '#0D1117',
    border: '1px solid #30363D',
    borderRadius: '8px',
    color: '#E6EDF3',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box'
  },
  eyeBtn: {
    position: 'absolute',
    right: '12px',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    display: 'flex',
    alignItems: 'center'
  },
  errorText: {
    fontSize: '12px',
    color: '#EF4444',
    margin: '6px 0 0 0'
  },
  submitBtn: {
    width: '100%',
    padding: '14px',
    backgroundColor: '#2563EB',
    border: 'none',
    borderRadius: '8px',
    color: 'white',
    fontSize: '15px',
    fontWeight: '600',
    marginTop: '8px'
  }
};

export default SetPasswordModal;
