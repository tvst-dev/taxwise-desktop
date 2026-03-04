import React from 'react';
import { Minus, Square, X, Calculator } from 'lucide-react';

const TitleBar = () => {
  const handleMinimize = () => {
    window.electronAPI?.window?.minimize();
  };

  const handleMaximize = () => {
    window.electronAPI?.window?.maximize();
  };

  const handleClose = () => {
    window.electronAPI?.window?.close();
  };

  return (
    <div style={styles.titleBar}>
      <div style={styles.dragRegion}>
        <div style={styles.appInfo}>
          <div style={styles.logo}>
            <Calculator size={18} color="#2563EB" strokeWidth={2.5} />
          </div>
          <span style={styles.appName}>TaxWise</span>
        </div>
      </div>
      <div style={styles.windowControls}>
        <button
          style={styles.controlButton}
          onClick={handleMinimize}
          onMouseEnter={(e) => e.target.style.backgroundColor = '#30363D'}
          onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
        >
          <Minus size={14} />
        </button>
        <button
          style={styles.controlButton}
          onClick={handleMaximize}
          onMouseEnter={(e) => e.target.style.backgroundColor = '#30363D'}
          onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
        >
          <Square size={12} />
        </button>
        <button
          style={{ ...styles.controlButton, ...styles.closeButton }}
          onClick={handleClose}
          onMouseEnter={(e) => e.target.style.backgroundColor = '#EF4444'}
          onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};

const styles = {
  titleBar: {
    height: '32px',
    backgroundColor: '#0D1117',
    borderBottom: '1px solid #21262D',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    WebkitAppRegion: 'drag',
    userSelect: 'none',
  },
  dragRegion: {
    flex: 1,
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    paddingLeft: '12px',
  },
  appInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appName: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#E6EDF3',
  },
  windowControls: {
    display: 'flex',
    height: '100%',
    WebkitAppRegion: 'no-drag',
  },
  controlButton: {
    width: '46px',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    border: 'none',
    color: '#8B949E',
    cursor: 'pointer',
    transition: 'background-color 0.15s ease',
  },
  closeButton: {
    // Hover effect handled inline
  },
};

export default TitleBar;
