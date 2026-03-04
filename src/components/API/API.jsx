import React, { useState } from 'react';
import {
  Code, Key, Copy, Eye, EyeOff, RefreshCw,
  Book, ExternalLink, Clock, CheckCircle, AlertCircle,
  Terminal, Shield, Lock
} from 'lucide-react';
import { useFeaturesStore, useAuthStore } from '../../store';
import toast from 'react-hot-toast';

const API = () => {
  const { organization } = useAuthStore();
  const { apiAccessEnabled } = useFeaturesStore();
  const [showApiKey, setShowApiKey] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  // Feature gate check
  if (!apiAccessEnabled) {
    return (
      <div style={styles.disabledContainer}>
        <div style={styles.disabledCard}>
          <div style={styles.disabledIcon}>
            <Code size={40} color="#8B949E" />
          </div>
          <h2 style={styles.disabledTitle}>API Access Not Enabled</h2>
          <p style={styles.disabledText}>
            Enable API access to integrate TaxWise with your systems.
            Go to Settings → Features to enable this feature.
          </p>
          <a href="#/settings" style={styles.enableBtn}>
            <Shield size={16} />
            Go to Settings
          </a>
        </div>
      </div>
    );
  }

  // API configuration (placeholder - will be replaced with real keys from backend)
  const apiConfig = {
    hasKeys: false, // Set to true when API keys are generated
    liveKey: null,
    testKey: null,
    baseUrl: 'https://api.taxwise.ng',
    version: 'v1'
  };

  const endpoints = [
    { method: 'POST', path: '/v1/tax/calculate', description: 'Calculate tax liability for various tax types' },
    { method: 'GET', path: '/v1/tax/rates', description: 'Get current Nigerian tax rates' },
    { method: 'GET', path: '/v1/entries', description: 'List all financial entries' },
    { method: 'POST', path: '/v1/entries', description: 'Create a new entry' },
    { method: 'GET', path: '/v1/deductions', description: 'List eligible deductions' },
    { method: 'GET', path: '/v1/analytics', description: 'Get financial analytics data' }
  ];

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'endpoints', label: 'Endpoints' },
    { id: 'examples', label: 'Code Examples' }
  ];

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const handleGenerateKeys = () => {
    toast.info('API key generation will be available once backend is connected');
  };

  const codeExample = `// Example: Calculate Company Income Tax
const response = await fetch('https://api.taxwise.ng/v1/tax/calculate', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    tax_type: 'cit',
    fiscal_year: 2024,
    company_category: 'medium',
    total_revenue: 75000000,
    allowable_expenses: 45000000,
    capital_allowances: 2500000
  })
});

const result = await response.json();
console.log(result.tax_payable);`;

  const vatExample = `// Example: Calculate VAT
const response = await fetch('https://api.taxwise.ng/v1/tax/calculate', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    tax_type: 'vat',
    taxable_supplies: 5000000,
    exempt_supplies: 500000,
    zero_rated_supplies: 200000,
    input_vat: 150000
  })
});

const result = await response.json();
console.log(result.vat_payable);`;

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>API Access</h1>
          <p style={styles.subtitle}>
            Integrate TaxWise tax calculations into your applications
          </p>
        </div>
        <a
          href="https://docs.taxwise.ng/api"
          target="_blank"
          rel="noopener noreferrer"
          style={styles.docsBtn}
        >
          <Book size={16} />
          Documentation
          <ExternalLink size={14} />
        </a>
      </div>

      {/* Tabs */}
      <div style={styles.tabs}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            style={{
              ...styles.tab,
              ...(activeTab === tab.id ? styles.tabActive : {})
            }}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div style={styles.content}>
          {/* API Keys Section */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>API Keys</h2>
            
            {!apiConfig.hasKeys ? (
              <div style={styles.noKeysCard}>
                <div style={styles.noKeysIcon}>
                  <Lock size={32} color="#8B949E" />
                </div>
                <h3 style={styles.noKeysTitle}>No API Keys Generated</h3>
                <p style={styles.noKeysText}>
                  Generate your API keys to start integrating TaxWise into your applications.
                  Keep your keys secure and never expose them in client-side code.
                </p>
                <button style={styles.generateBtn} onClick={handleGenerateKeys}>
                  <Key size={16} />
                  Generate API Keys
                </button>
              </div>
            ) : (
              <div style={styles.keysGrid}>
                <div style={styles.keyCard}>
                  <div style={styles.keyHeader}>
                    <span style={styles.keyLabel}>Live Key</span>
                    <span style={styles.liveBadge}>Production</span>
                  </div>
                  <div style={styles.keyValue}>
                    <code style={styles.keyCode}>
                      {showApiKey ? apiConfig.liveKey : '•'.repeat(40)}
                    </code>
                    <div style={styles.keyActions}>
                      <button
                        style={styles.iconBtn}
                        onClick={() => setShowApiKey(!showApiKey)}
                      >
                        {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                      <button
                        style={styles.iconBtn}
                        onClick={() => copyToClipboard(apiConfig.liveKey)}
                      >
                        <Copy size={16} />
                      </button>
                    </div>
                  </div>
                </div>

                <div style={styles.keyCard}>
                  <div style={styles.keyHeader}>
                    <span style={styles.keyLabel}>Test Key</span>
                    <span style={styles.testBadge}>Sandbox</span>
                  </div>
                  <div style={styles.keyValue}>
                    <code style={styles.keyCode}>
                      {showApiKey ? apiConfig.testKey : '•'.repeat(40)}
                    </code>
                    <div style={styles.keyActions}>
                      <button
                        style={styles.iconBtn}
                        onClick={() => setShowApiKey(!showApiKey)}
                      >
                        {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                      <button
                        style={styles.iconBtn}
                        onClick={() => copyToClipboard(apiConfig.testKey)}
                      >
                        <Copy size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Quick Info */}
          <div style={styles.infoGrid}>
            <div style={styles.infoCard}>
              <Terminal size={24} color="#2563EB" />
              <div>
                <span style={styles.infoLabel}>Base URL</span>
                <code style={styles.infoValue}>{apiConfig.baseUrl}</code>
              </div>
            </div>
            <div style={styles.infoCard}>
              <Code size={24} color="#22C55E" />
              <div>
                <span style={styles.infoLabel}>Version</span>
                <span style={styles.infoValue}>{apiConfig.version}</span>
              </div>
            </div>
            <div style={styles.infoCard}>
              <Shield size={24} color="#F59E0B" />
              <div>
                <span style={styles.infoLabel}>Auth</span>
                <span style={styles.infoValue}>Bearer Token</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Endpoints Tab */}
      {activeTab === 'endpoints' && (
        <div style={styles.content}>
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>Available Endpoints</h2>
            <div style={styles.endpointsList}>
              {endpoints.map((endpoint, index) => (
                <div key={index} style={styles.endpointCard}>
                  <div style={styles.endpointMethod}>
                    <span style={{
                      ...styles.methodBadge,
                      backgroundColor: endpoint.method === 'GET' 
                        ? 'rgba(34, 197, 94, 0.1)' 
                        : 'rgba(37, 99, 235, 0.1)',
                      color: endpoint.method === 'GET' ? '#22C55E' : '#2563EB'
                    }}>
                      {endpoint.method}
                    </span>
                  </div>
                  <div style={styles.endpointInfo}>
                    <code style={styles.endpointPath}>{endpoint.path}</code>
                    <span style={styles.endpointDesc}>{endpoint.description}</span>
                  </div>
                  <button 
                    style={styles.copyPathBtn}
                    onClick={() => copyToClipboard(apiConfig.baseUrl + endpoint.path)}
                  >
                    <Copy size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Code Examples Tab */}
      {activeTab === 'examples' && (
        <div style={styles.content}>
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>Code Examples</h2>
            
            <div style={styles.exampleCard}>
              <div style={styles.exampleHeader}>
                <span style={styles.exampleTitle}>Calculate Company Income Tax</span>
                <button 
                  style={styles.copyBtn}
                  onClick={() => copyToClipboard(codeExample)}
                >
                  <Copy size={14} />
                  Copy
                </button>
              </div>
              <pre style={styles.codeBlock}>
                <code>{codeExample}</code>
              </pre>
            </div>

            <div style={styles.exampleCard}>
              <div style={styles.exampleHeader}>
                <span style={styles.exampleTitle}>Calculate VAT</span>
                <button 
                  style={styles.copyBtn}
                  onClick={() => copyToClipboard(vatExample)}
                >
                  <Copy size={14} />
                  Copy
                </button>
              </div>
              <pre style={styles.codeBlock}>
                <code>{vatExample}</code>
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    padding: '24px',
    minHeight: '100%',
    backgroundColor: '#0D1117'
  },
  disabledContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100%',
    padding: '24px',
    backgroundColor: '#0D1117'
  },
  disabledCard: {
    textAlign: 'center',
    padding: '48px',
    backgroundColor: '#161B22',
    borderRadius: '16px',
    border: '1px solid #30363D',
    maxWidth: '400px'
  },
  disabledIcon: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    backgroundColor: '#21262D',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 24px'
  },
  disabledTitle: {
    fontSize: '20px',
    fontWeight: '600',
    color: '#E6EDF3',
    margin: '0 0 12px 0'
  },
  disabledText: {
    fontSize: '14px',
    color: '#8B949E',
    margin: '0 0 24px 0',
    lineHeight: '1.6'
  },
  enableBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 24px',
    backgroundColor: '#2563EB',
    borderRadius: '8px',
    color: 'white',
    textDecoration: 'none',
    fontSize: '14px',
    fontWeight: '500'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '24px'
  },
  title: {
    fontSize: '24px',
    fontWeight: '600',
    color: '#E6EDF3',
    margin: '0 0 4px 0'
  },
  subtitle: {
    fontSize: '14px',
    color: '#8B949E',
    margin: 0
  },
  docsBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 16px',
    backgroundColor: '#161B22',
    border: '1px solid #30363D',
    borderRadius: '8px',
    color: '#E6EDF3',
    textDecoration: 'none',
    fontSize: '14px'
  },
  tabs: {
    display: 'flex',
    gap: '4px',
    padding: '4px',
    backgroundColor: '#161B22',
    borderRadius: '10px',
    marginBottom: '24px',
    width: 'fit-content'
  },
  tab: {
    padding: '10px 20px',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '6px',
    color: '#8B949E',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer'
  },
  tabActive: {
    backgroundColor: '#21262D',
    color: '#E6EDF3'
  },
  content: {},
  section: {
    marginBottom: '32px'
  },
  sectionTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#E6EDF3',
    margin: '0 0 16px 0'
  },
  noKeysCard: {
    textAlign: 'center',
    padding: '48px',
    backgroundColor: '#161B22',
    border: '1px solid #30363D',
    borderRadius: '12px'
  },
  noKeysIcon: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    backgroundColor: '#21262D',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 16px'
  },
  noKeysTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#E6EDF3',
    margin: '0 0 8px 0'
  },
  noKeysText: {
    fontSize: '14px',
    color: '#8B949E',
    margin: '0 0 24px 0',
    maxWidth: '400px',
    marginLeft: 'auto',
    marginRight: 'auto',
    lineHeight: '1.6'
  },
  generateBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 24px',
    backgroundColor: '#2563EB',
    border: 'none',
    borderRadius: '8px',
    color: 'white',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer'
  },
  keysGrid: {
    display: 'grid',
    gap: '16px'
  },
  keyCard: {
    padding: '20px',
    backgroundColor: '#161B22',
    border: '1px solid #30363D',
    borderRadius: '12px'
  },
  keyHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '12px'
  },
  keyLabel: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#E6EDF3'
  },
  liveBadge: {
    padding: '2px 8px',
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '500',
    color: '#22C55E'
  },
  testBadge: {
    padding: '2px 8px',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '500',
    color: '#F59E0B'
  },
  keyValue: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    backgroundColor: '#0D1117',
    borderRadius: '8px'
  },
  keyCode: {
    flex: 1,
    fontFamily: 'monospace',
    fontSize: '13px',
    color: '#8B949E',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  keyActions: {
    display: 'flex',
    gap: '8px'
  },
  iconBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '32px',
    backgroundColor: 'transparent',
    border: '1px solid #30363D',
    borderRadius: '6px',
    color: '#8B949E',
    cursor: 'pointer'
  },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '16px'
  },
  infoCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '20px',
    backgroundColor: '#161B22',
    border: '1px solid #30363D',
    borderRadius: '12px'
  },
  infoLabel: {
    display: 'block',
    fontSize: '12px',
    color: '#8B949E',
    marginBottom: '4px'
  },
  infoValue: {
    display: 'block',
    fontSize: '14px',
    fontWeight: '500',
    color: '#E6EDF3',
    fontFamily: 'monospace'
  },
  endpointsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  endpointCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '16px 20px',
    backgroundColor: '#161B22',
    border: '1px solid #30363D',
    borderRadius: '10px'
  },
  endpointMethod: {},
  methodBadge: {
    padding: '4px 10px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '600',
    fontFamily: 'monospace'
  },
  endpointInfo: {
    flex: 1
  },
  endpointPath: {
    display: 'block',
    fontSize: '14px',
    fontWeight: '500',
    color: '#E6EDF3',
    fontFamily: 'monospace',
    marginBottom: '4px'
  },
  endpointDesc: {
    fontSize: '13px',
    color: '#8B949E'
  },
  copyPathBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '32px',
    backgroundColor: 'transparent',
    border: '1px solid #30363D',
    borderRadius: '6px',
    color: '#8B949E',
    cursor: 'pointer'
  },
  exampleCard: {
    marginBottom: '24px',
    backgroundColor: '#161B22',
    border: '1px solid #30363D',
    borderRadius: '12px',
    overflow: 'hidden'
  },
  exampleHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    borderBottom: '1px solid #30363D'
  },
  exampleTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#E6EDF3'
  },
  copyBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    backgroundColor: '#21262D',
    border: '1px solid #30363D',
    borderRadius: '6px',
    color: '#8B949E',
    fontSize: '12px',
    cursor: 'pointer'
  },
  codeBlock: {
    margin: 0,
    padding: '20px',
    backgroundColor: '#0D1117',
    overflow: 'auto',
    fontFamily: 'monospace',
    fontSize: '13px',
    lineHeight: '1.6',
    color: '#8B949E'
  }
};

export default API;
