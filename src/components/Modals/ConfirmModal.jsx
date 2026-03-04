import React from 'react';
import { AlertTriangle, Info, CheckCircle, X } from 'lucide-react';
import { useUIStore } from '../../store';

const ConfirmModal = () => {
  const { activeModal, modalData, closeModal } = useUIStore();

  const isOpen = activeModal === 'confirm';

  if (!isOpen || !modalData) return null;

  const {
    title = 'Confirm Action',
    message = 'Are you sure you want to proceed?',
    type = 'warning', // 'warning', 'danger', 'info', 'success'
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    onConfirm,
    onCancel
  } = modalData;

  const icons = {
    warning: { icon: AlertTriangle, color: '#F59E0B' },
    danger: { icon: AlertTriangle, color: '#EF4444' },
    info: { icon: Info, color: '#3B82F6' },
    success: { icon: CheckCircle, color: '#22C55E' }
  };

  const IconComponent = icons[type]?.icon || AlertTriangle;
  const iconColor = icons[type]?.color || '#F59E0B';

  const handleConfirm = () => {
    if (onConfirm) onConfirm();
    closeModal();
  };

  const handleCancel = () => {
    if (onCancel) onCancel();
    closeModal();
  };

  return (
    <div style={styles.overlay} onClick={handleCancel}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button style={styles.closeButton} onClick={handleCancel}>
          <X size={18} />
        </button>
        
        <div style={styles.content}>
          <div style={{ ...styles.iconWrapper, backgroundColor: `${iconColor}15` }}>
            <IconComponent size={28} style={{ color: iconColor }} />
          </div>
          
          <h2 style={styles.title}>{title}</h2>
          <p style={styles.message}>{message}</p>
          
          <div style={styles.actions}>
            <button style={styles.cancelButton} onClick={handleCancel}>
              {cancelText}
            </button>
            <button 
              style={{
                ...styles.confirmButton,
                backgroundColor: type === 'danger' ? '#EF4444' : '#2563EB'
              }}
              onClick={handleConfirm}
            >
              {confirmText}
            </button>
          </div>
        </div>
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
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9100
  },
  modal: {
    position: 'relative',
    width: '100%',
    maxWidth: '400px',
    backgroundColor: '#161B22',
    borderRadius: '16px',
    border: '1px solid #30363D',
    overflow: 'hidden'
  },
  closeButton: {
    position: 'absolute',
    top: '16px',
    right: '16px',
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
    padding: '32px',
    textAlign: 'center'
  },
  iconWrapper: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 20px'
  },
  title: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#E6EDF3',
    margin: '0 0 12px 0'
  },
  message: {
    fontSize: '14px',
    color: '#8B949E',
    margin: '0 0 24px 0',
    lineHeight: '1.5'
  },
  actions: {
    display: 'flex',
    gap: '12px'
  },
  cancelButton: {
    flex: 1,
    padding: '12px',
    backgroundColor: 'transparent',
    border: '1px solid #30363D',
    borderRadius: '8px',
    color: '#8B949E',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer'
  },
  confirmButton: {
    flex: 1,
    padding: '12px',
    border: 'none',
    borderRadius: '8px',
    color: 'white',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer'
  }
};

export default ConfirmModal;
