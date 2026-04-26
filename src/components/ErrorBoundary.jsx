import React from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={styles.container}>
          <div style={styles.card}>
            <div style={styles.iconBox}>
              <AlertTriangle size={40} color="#F59E0B" />
            </div>
            <h2 style={styles.title}>Something went wrong</h2>
            <p style={styles.subtitle}>
              An unexpected error occurred in the application. You can try to recover or reload the app.
            </p>
            <div style={styles.actions}>
              <button style={styles.retryBtn} onClick={this.handleRetry}>
                <RefreshCw size={16} />
                Try Again
              </button>
              <button style={styles.reloadBtn} onClick={this.handleReload}>
                Reload App
              </button>
            </div>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details style={styles.details}>
                <summary style={styles.summary}>Error details</summary>
                <pre style={styles.pre}>{this.state.error.toString()}</pre>
                <pre style={styles.pre}>{this.state.errorInfo?.componentStack}</pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const styles = {
  container: {
    height: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0D1117',
    padding: '24px'
  },
  card: {
    maxWidth: '480px',
    width: '100%',
    backgroundColor: '#161B22',
    border: '1px solid #30363D',
    borderRadius: '16px',
    padding: '40px',
    textAlign: 'center'
  },
  iconBox: {
    width: '72px',
    height: '72px',
    borderRadius: '50%',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 20px'
  },
  title: {
    fontSize: '22px',
    fontWeight: '700',
    color: '#E6EDF3',
    margin: '0 0 8px'
  },
  subtitle: {
    fontSize: '14px',
    color: '#8B949E',
    margin: '0 0 24px',
    lineHeight: '1.6'
  },
  actions: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'center'
  },
  retryBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 24px',
    backgroundColor: '#2563EB',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer'
  },
  reloadBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 24px',
    backgroundColor: 'transparent',
    border: '1px solid #30363D',
    borderRadius: '8px',
    color: '#8B949E',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer'
  },
  details: {
    marginTop: '24px',
    textAlign: 'left',
    backgroundColor: '#0D1117',
    border: '1px solid #30363D',
    borderRadius: '8px',
    padding: '12px',
    overflow: 'auto'
  },
  summary: {
    color: '#8B949E',
    fontSize: '13px',
    cursor: 'pointer',
    fontWeight: '500'
  },
  pre: {
    color: '#EF4444',
    fontSize: '12px',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    marginTop: '8px',
    lineHeight: '1.5'
  }
};

export default ErrorBoundary;

