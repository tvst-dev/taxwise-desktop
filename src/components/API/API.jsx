import React, { useState, useEffect } from 'react';
import {
  Code, Key, Copy, Eye, EyeOff, RefreshCw,
  CheckCircle, AlertCircle,
  Terminal, Shield, Lock, Trash2, Plus
} from 'lucide-react';
import { useFeaturesStore, useAuthStore } from '../../store';
import { supabase } from '../../services/supabase';
import config from '../../config';
import toast from 'react-hot-toast';

const API = () => {
  const { organization, user } = useAuthStore();
  const { apiAccessEnabled } = useFeaturesStore();
  const [activeTab, setActiveTab] = useState('overview');
  const [apiKeys, setApiKeys] = useState([]);
  const [isLoadingKeys, setIsLoadingKeys] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [revealedKey, setRevealedKey] = useState(null); // { id, fullKey } — shown once after generation
  const [showKeys, setShowKeys] = useState({});

  useEffect(() => {
    if (apiAccessEnabled && organization?.id) {
      loadApiKeys();
    }
  }, [apiAccessEnabled, organization?.id]);

  const loadApiKeys = async () => {
    setIsLoadingKeys(true);
    try {
      const { data, error } = await supabase
        .from('api_keys')
        .select('id, name, key_prefix, permissions, rate_limit, is_active, last_used_at, created_at')
        .eq('organization_id', organization.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setApiKeys(data || []);
    } catch (err) {
      console.error('Failed to load API keys:', err.message);
    } finally {
      setIsLoadingKeys(false);
    }
  };

  const generateRandomKey = () => {
    const array = new Uint8Array(24);
    crypto.getRandomValues(array);
    return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const hashKey = async (key) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(key);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const handleGenerateKey = async () => {
    const name = newKeyName.trim() || `Key ${new Date().toLocaleDateString()}`;
    setIsGenerating(true);
    try {
      const rawKey = `tw_live_${generateRandomKey()}`;
      const keyHash = await hashKey(rawKey);
      const keyPrefix = rawKey.slice(0, 15); // e.g. "tw_live_a3f9b2"

      const { data, error } = await supabase
        .from('api_keys')
        .insert({
          organization_id: organization.id,
          name,
          key_hash: keyHash,
          key_prefix: keyPrefix,
          permissions: ['read', 'write'],
          rate_limit: 1000,
          created_by: user?.id || null,
        })
        .select('id, name, key_prefix, permissions, rate_limit, is_active, last_used_at, created_at')
        .single();

      if (error) throw error;

      setApiKeys(prev => [data, ...prev]);
      setRevealedKey({ id: data.id, fullKey: rawKey });
      setNewKeyName('');
      toast.success('API key generated — copy it now, it will not be shown again');
    } catch (err) {
      toast.error(`Failed to generate key: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRevokeKey = async (keyId) => {
    try {
      const { error } = await supabase
        .from('api_keys')
        .update({ is_active: false })
        .eq('id', keyId)
        .eq('organization_id', organization.id);
      if (error) throw error;
      setApiKeys(prev => prev.filter(k => k.id !== keyId));
      if (revealedKey?.id === keyId) setRevealedKey(null);
      toast.success('API key revoked');
    } catch (err) {
      toast.error(`Failed to revoke key: ${err.message}`);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

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

  const apiConfig = {
    baseUrl: `${config.SUPABASE_URL}/functions/v1`,
    version: 'v1'
  };

  const endpoints = [
    { method: 'POST', path: '/tax-calculate', description: 'Calculate tax liability (PAYE, CIT, VAT, WHT, CGT, EDT)' },
    { method: 'POST', path: '/paystack', description: 'Process payments and verify transactions' },
    { method: 'POST', path: '/send-invite', description: 'Send team member invitations' },
    { method: 'GET',  path: '/accept-invite', description: 'Accept team invitation (redirect handler)' },
  ];

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'endpoints', label: 'Endpoints' },
    { id: 'examples', label: 'Code Examples' }
  ];

  const baseUrl = `${config.SUPABASE_URL}/functions/v1`;
  const anonKey = config.SUPABASE_ANON_KEY;

  const codeExample = `// Example: Calculate Company Income Tax (CIT)
const response = await fetch('${baseUrl}/tax-calculate', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'apikey': '${anonKey}',
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
console.log(result.net_tax_payable);`;

  const vatExample = `// Example: Calculate VAT
const response = await fetch('${baseUrl}/tax-calculate', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'apikey': '${anonKey}',
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
            Integrate TaxWise calculations into your applications via Supabase edge functions
          </p>
        </div>
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
          {/* Revealed-key banner (shown once after generation) */}
          {revealedKey && (
            <div style={styles.revealBanner}>
              <AlertCircle size={16} color="#F59E0B" style={{ flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <span style={styles.revealTitle}>Save your key now — it won't be shown again</span>
                <code style={styles.revealKey}>{revealedKey.fullKey}</code>
              </div>
              <button style={styles.iconBtn} onClick={() => copyToClipboard(revealedKey.fullKey)} title="Copy">
                <Copy size={16} />
              </button>
              <button style={{ ...styles.iconBtn, color: '#EF4444' }} onClick={() => setRevealedKey(null)} title="Dismiss">
                ✕
              </button>
            </div>
          )}

          {/* API Keys Section */}
          <div style={styles.section}>
            <div style={styles.sectionRow}>
              <h2 style={styles.sectionTitle}>API Keys</h2>
              <div style={styles.generateRow}>
                <input
                  type="text"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="Key name (optional)"
                  style={styles.keyNameInput}
                  onKeyDown={(e) => e.key === 'Enter' && handleGenerateKey()}
                />
                <button style={styles.generateBtn} onClick={handleGenerateKey} disabled={isGenerating}>
                  {isGenerating ? <RefreshCw size={16} className="spin" /> : <Plus size={16} />}
                  {isGenerating ? 'Generating…' : 'Generate Key'}
                </button>
              </div>
            </div>

            {isLoadingKeys ? (
              <div style={styles.loadingRow}>
                <RefreshCw size={20} color="#8B949E" className="spin" />
                <span style={{ color: '#8B949E', fontSize: 14 }}>Loading keys…</span>
              </div>
            ) : apiKeys.length === 0 ? (
              <div style={styles.noKeysCard}>
                <div style={styles.noKeysIcon}><Lock size={32} color="#8B949E" /></div>
                <h3 style={styles.noKeysTitle}>No API Keys Yet</h3>
                <p style={styles.noKeysText}>
                  Generate an API key above to start integrating TaxWise into your backend applications.
                  Keep keys secure — never expose them in client-side or browser code.
                </p>
              </div>
            ) : (
              <div style={styles.keysGrid}>
                {apiKeys.map(k => (
                  <div key={k.id} style={styles.keyCard}>
                    <div style={styles.keyHeader}>
                      <span style={styles.keyLabel}>{k.name}</span>
                      <span style={styles.liveBadge}>Active</span>
                    </div>
                    <div style={styles.keyValue}>
                      <code style={styles.keyCode}>
                        {revealedKey?.id === k.id
                          ? (showKeys[k.id] ? revealedKey.fullKey : revealedKey.fullKey.slice(0, 15) + '•'.repeat(20))
                          : k.key_prefix + '•'.repeat(20)}
                      </code>
                      <div style={styles.keyActions}>
                        {revealedKey?.id === k.id && (
                          <button style={styles.iconBtn} onClick={() => copyToClipboard(revealedKey.fullKey)} title="Copy">
                            <Copy size={16} />
                          </button>
                        )}
                        <button
                          style={{ ...styles.iconBtn, color: '#EF4444' }}
                          onClick={() => handleRevokeKey(k.id)}
                          title="Revoke"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                    <div style={styles.keyMeta}>
                      <span>Created {new Date(k.created_at).toLocaleDateString()}</span>
                      {k.last_used_at && <span>Last used {new Date(k.last_used_at).toLocaleDateString()}</span>}
                      <span>Rate limit: {k.rate_limit?.toLocaleString()}/day</span>
                    </div>
                  </div>
                ))}
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
    <style>{`
      .spin { animation: spin 1s linear infinite; }
      @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    `}</style>
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
  sectionRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '16px',
    flexWrap: 'wrap',
    gap: '12px'
  },
  generateRow: {
    display: 'flex',
    gap: '10px',
    alignItems: 'center'
  },
  keyNameInput: {
    padding: '10px 14px',
    backgroundColor: '#161B22',
    border: '1px solid #30363D',
    borderRadius: '8px',
    color: '#E6EDF3',
    fontSize: '14px',
    outline: 'none',
    width: '200px'
  },
  loadingRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '32px 0'
  },
  keyMeta: {
    display: 'flex',
    gap: '16px',
    marginTop: '10px',
    fontSize: '12px',
    color: '#8B949E'
  },
  revealBanner: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    padding: '16px 20px',
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    border: '1px solid rgba(245, 158, 11, 0.3)',
    borderRadius: '10px',
    marginBottom: '24px'
  },
  revealTitle: {
    display: 'block',
    fontSize: '13px',
    fontWeight: '600',
    color: '#F59E0B',
    marginBottom: '8px'
  },
  revealKey: {
    display: 'block',
    fontFamily: 'monospace',
    fontSize: '13px',
    color: '#E6EDF3',
    wordBreak: 'break-all',
    background: '#0D1117',
    padding: '8px 12px',
    borderRadius: '6px'
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
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 20px',
    backgroundColor: '#2563EB',
    border: 'none',
    borderRadius: '8px',
    color: 'white',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    whiteSpace: 'nowrap'
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
