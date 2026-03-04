import React, { useEffect, useState } from 'react';
import { Download, RefreshCw, X, ArrowUpCircle } from 'lucide-react';

/**
 * UpdateNotification — shown as a persistent banner when an app update is available.
 * Listens to electron-updater events via the preload bridge.
 */
const UpdateNotification = () => {
  const [state, setState] = useState(null); // null | 'available' | 'downloaded'
  const [version, setVersion] = useState('');
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!window.electronAPI?.updates) return;

    window.electronAPI.updates.onUpdateAvailable((info) => {
      setVersion(info?.version || '');
      setState('available');
      setDismissed(false);
    });

    window.electronAPI.updates.onUpdateDownloaded((info) => {
      setVersion(info?.version || '');
      setState('downloaded');
      setDismissed(false);
    });
  }, []);

  const handleInstall = () => {
    window.electronAPI?.updates?.install();
  };

  if (!state || dismissed) return null;

  return (
    <div style={styles.banner}>
      <div style={styles.left}>
        {state === 'downloaded' ? (
          <ArrowUpCircle size={18} color="#22C55E" style={{ flexShrink: 0 }} />
        ) : (
          <Download size={18} color="#3B82F6" style={{ flexShrink: 0 }} />
        )}
        <div>
          <span style={styles.text}>
            {state === 'downloaded'
              ? `TaxWise ${version ? `v${version} ` : ''}is ready to install`
              : `A new version of TaxWise${version ? ` (v${version})` : ''} is downloading…`}
          </span>
          {state === 'available' && (
            <span style={styles.subtext}> Update will be ready shortly.</span>
          )}
        </div>
      </div>

      <div style={styles.right}>
        {state === 'downloaded' && (
          <button style={styles.installBtn} onClick={handleInstall}>
            <RefreshCw size={14} />
            Restart & Install
          </button>
        )}
        <button style={styles.dismissBtn} onClick={() => setDismissed(true)} title="Dismiss">
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

const styles = {
  banner: {
    position: 'fixed',
    bottom: '16px',
    right: '16px',
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
    padding: '12px 16px',
    backgroundColor: '#161B22',
    border: '1px solid #30363D',
    borderRadius: '10px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
    maxWidth: '420px',
    minWidth: '280px'
  },
  left: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flex: 1
  },
  text: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#E6EDF3'
  },
  subtext: {
    fontSize: '12px',
    color: '#8B949E'
  },
  right: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexShrink: 0
  },
  installBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '7px 14px',
    backgroundColor: '#22C55E',
    border: 'none',
    borderRadius: '6px',
    color: '#fff',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    whiteSpace: 'nowrap'
  },
  dismissBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '28px',
    height: '28px',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '6px',
    color: '#6E7681',
    cursor: 'pointer'
  }
};

export default UpdateNotification;
