import React, { useState } from 'react';
import {
  User, Building2, Users, Sparkles, CreditCard, Link2,
  Save, Camera, Mail, Phone, MapPin, Globe, Shield,
  Bell, Eye, EyeOff, Plus, Trash2, Edit2, Check, X,
  ChevronRight, AlertCircle, ShoppingCart, Landmark, Code,
  FileText, RefreshCw, ExternalLink, Crown, Zap
} from 'lucide-react';
import { 
  useAuthStore, useSettingsStore, useFeaturesStore, 
  useTeamStore, useUIStore 
} from '../../store';
import ToggleSwitch from '../common/ToggleSwitch';
import toast from 'react-hot-toast';

const Settings = () => {
  const [activeTab, setActiveTab] = useState('profile');
  const { user, organization, updateUser, updateOrganization } = useAuthStore();
  const { general, notifications, integrations, updateGeneral, updateNotifications, updateIntegrations } = useSettingsStore();
  const { 
    posEnabled, autoBankTrackingEnabled, apiAccessEnabled, multiUserEnabled, documentAIEnabled,
    togglePOS, toggleAutoBankTracking, toggleAPIAccess, toggleMultiUser, toggleDocumentAI,
    featureLimits 
  } = useFeaturesStore();
  const { members, invitations, addMember, removeMember, addInvitation, removeInvitation } = useTeamStore();
  const { openModal } = useUIStore();

  // Profile form state
  const [profileForm, setProfileForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    role: user?.role || 'owner'
  });

  // Organization form state
  const [orgForm, setOrgForm] = useState({
    name: organization?.name || '',
    business_type: organization?.business_type || 'sole_proprietorship',
    tin: organization?.tin || '',
    address: organization?.address || '',
    state: organization?.state || '',
    industry: organization?.industry || ''
  });

  // Invite form state
  const [inviteForm, setInviteForm] = useState({
    email: '',
    role: 'accountant'
  });

  const [isEditing, setIsEditing] = useState({});

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'organization', label: 'Organization', icon: Building2 },
    { id: 'team', label: 'Team', icon: Users },
    { id: 'features', label: 'Features', icon: Sparkles },
    { id: 'billing', label: 'Billing', icon: CreditCard },
    { id: 'integrations', label: 'Integrations', icon: Link2 }
  ];

  const roles = [
    { value: 'admin', label: 'Admin', description: 'Full access to all features' },
    { value: 'manager', label: 'Manager', description: 'Can approve and manage entries' },
    { value: 'accountant', label: 'Accountant', description: 'Can create and edit entries' },
    { value: 'cashier', label: 'Cashier', description: 'POS and basic entry access' },
    { value: 'viewer', label: 'Viewer', description: 'Read-only access' }
  ];

  const businessTypes = [
    { value: 'sole_proprietorship', label: 'Sole Proprietorship' },
    { value: 'partnership', label: 'Partnership' },
    { value: 'limited_company', label: 'Limited Liability Company' },
    { value: 'plc', label: 'Public Limited Company' },
    { value: 'ngo', label: 'NGO/Non-Profit' }
  ];

  const nigerianStates = [
    'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno',
    'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT', 'Gombe',
    'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara',
    'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau',
    'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara'
  ];

  const handleSaveProfile = () => {
    updateUser(profileForm);
    toast.success('Profile updated successfully');
  };

  const handleSaveOrganization = () => {
    updateOrganization(orgForm);
    toast.success('Organization updated successfully');
  };

  const handleInviteMember = () => {
    if (!inviteForm.email) {
      toast.error('Please enter an email address');
      return;
    }
    addInvitation({
      email: inviteForm.email,
      role: inviteForm.role
    });
    setInviteForm({ email: '', role: 'accountant' });
    toast.success('Invitation sent successfully');
  };

  const handleToggleFeature = (feature, toggleFn, featureName) => {
    toggleFn();
    toast.success(`${featureName} ${!feature ? 'enabled' : 'disabled'}`);
  };

  const renderProfileTab = () => (
    <div style={styles.tabContent}>
      <div style={styles.sectionHeader}>
        <h3 style={styles.sectionTitle}>Personal Information</h3>
        <p style={styles.sectionDescription}>Update your account details and preferences.</p>
      </div>

      <div style={styles.avatarSection}>
        <div style={styles.avatarLarge}>
          {user?.avatar ? (
            <img src={user.avatar} alt="Profile" style={styles.avatarImg} />
          ) : (
            <span style={styles.avatarInitials}>
              {profileForm.name ? profileForm.name.split(' ').map(n => n[0]).join('').slice(0, 2) : 'U'}
            </span>
          )}
        </div>
        <button style={styles.avatarButton}>
          <Camera size={16} />
          <span>Change Photo</span>
        </button>
      </div>

      <div style={styles.formGrid}>
        <div style={styles.formGroup}>
          <label style={styles.label}>Full Name</label>
          <input
            type="text"
            value={profileForm.name}
            onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
            style={styles.input}
            placeholder="Enter your full name"
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>Email Address</label>
          <input
            type="email"
            value={profileForm.email}
            onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
            style={styles.input}
            placeholder="Enter your email"
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>Phone Number</label>
          <input
            type="tel"
            value={profileForm.phone}
            onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
            style={styles.input}
            placeholder="+234 XXX XXX XXXX"
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>Role</label>
          <input
            type="text"
            value={profileForm.role.charAt(0).toUpperCase() + profileForm.role.slice(1)}
            style={{ ...styles.input, backgroundColor: '#21262D' }}
            disabled
          />
        </div>
      </div>

      <div style={styles.formActions}>
        <button style={styles.saveButton} onClick={handleSaveProfile}>
          <Save size={16} />
          <span>Save Changes</span>
        </button>
      </div>
    </div>
  );

  const renderOrganizationTab = () => (
    <div style={styles.tabContent}>
      <div style={styles.sectionHeader}>
        <h3 style={styles.sectionTitle}>Organization Details</h3>
        <p style={styles.sectionDescription}>Manage your business information for tax compliance.</p>
      </div>

      <div style={styles.formGrid}>
        <div style={styles.formGroup}>
          <label style={styles.label}>Business Name</label>
          <input
            type="text"
            value={orgForm.name}
            onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })}
            style={styles.input}
            placeholder="Your business name"
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>Business Type</label>
          <select
            value={orgForm.business_type}
            onChange={(e) => setOrgForm({ ...orgForm, business_type: e.target.value })}
            style={styles.select}
          >
            {businessTypes.map((type) => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>Tax Identification Number (TIN)</label>
          <input
            type="text"
            value={orgForm.tin}
            onChange={(e) => setOrgForm({ ...orgForm, tin: e.target.value })}
            style={styles.input}
            placeholder="Enter your TIN"
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>Industry</label>
          <input
            type="text"
            value={orgForm.industry}
            onChange={(e) => setOrgForm({ ...orgForm, industry: e.target.value })}
            style={styles.input}
            placeholder="e.g., Retail, Technology, Manufacturing"
          />
        </div>

        <div style={{ ...styles.formGroup, gridColumn: 'span 2' }}>
          <label style={styles.label}>Business Address</label>
          <input
            type="text"
            value={orgForm.address}
            onChange={(e) => setOrgForm({ ...orgForm, address: e.target.value })}
            style={styles.input}
            placeholder="Street address"
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>State</label>
          <select
            value={orgForm.state}
            onChange={(e) => setOrgForm({ ...orgForm, state: e.target.value })}
            style={styles.select}
          >
            <option value="">Select state</option>
            {nigerianStates.map((state) => (
              <option key={state} value={state}>{state}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={styles.formActions}>
        <button style={styles.saveButton} onClick={handleSaveOrganization}>
          <Save size={16} />
          <span>Save Changes</span>
        </button>
      </div>
    </div>
  );

  const renderTeamTab = () => (
    <div style={styles.tabContent}>
      <div style={styles.sectionHeader}>
        <div>
          <h3 style={styles.sectionTitle}>Team Members</h3>
          <p style={styles.sectionDescription}>
            Manage who has access to your organization. 
            <span style={styles.limitText}> ({members.length}/{featureLimits.maxUsers} users)</span>
          </p>
        </div>
        {multiUserEnabled && (
          <button style={styles.addButton} onClick={() => setIsEditing({ ...isEditing, invite: true })}>
            <Plus size={16} />
            <span>Invite Member</span>
          </button>
        )}
      </div>

      {!multiUserEnabled && (
        <div style={styles.featureDisabledCard}>
          <Users size={32} style={{ color: '#8B949E' }} />
          <div>
            <h4 style={styles.disabledTitle}>Multi-User Feature Disabled</h4>
            <p style={styles.disabledText}>
              Enable multi-user access in the Features tab to invite team members.
            </p>
          </div>
          <button 
            style={styles.enableButton}
            onClick={() => setActiveTab('features')}
          >
            Enable Feature
          </button>
        </div>
      )}

      {multiUserEnabled && isEditing.invite && (
        <div style={styles.inviteCard}>
          <h4 style={styles.inviteTitle}>Invite New Member</h4>
          <div style={styles.inviteForm}>
            <input
              type="email"
              value={inviteForm.email}
              onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
              style={styles.input}
              placeholder="Email address"
            />
            <select
              value={inviteForm.role}
              onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
              style={styles.select}
            >
              {roles.map((role) => (
                <option key={role.value} value={role.value}>{role.label}</option>
              ))}
            </select>
            <div style={styles.inviteActions}>
              <button style={styles.cancelButtonSmall} onClick={() => setIsEditing({ ...isEditing, invite: false })}>
                Cancel
              </button>
              <button style={styles.saveButtonSmall} onClick={handleInviteMember}>
                Send Invite
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Current User (Owner) */}
      <div style={styles.memberCard}>
        <div style={styles.memberAvatar}>
          <span>{user?.name?.charAt(0) || 'U'}</span>
        </div>
        <div style={styles.memberInfo}>
          <span style={styles.memberName}>{user?.name || 'You'}</span>
          <span style={styles.memberEmail}>{user?.email}</span>
        </div>
        <span style={styles.ownerBadge}>
          <Crown size={12} />
          Owner
        </span>
      </div>

      {/* Team Members */}
      {members.map((member) => (
        <div key={member.id} style={styles.memberCard}>
          <div style={styles.memberAvatar}>
            <span>{member.name?.charAt(0) || member.email?.charAt(0) || 'U'}</span>
          </div>
          <div style={styles.memberInfo}>
            <span style={styles.memberName}>{member.name || member.email}</span>
            <span style={styles.memberEmail}>{member.email}</span>
          </div>
          <span style={styles.roleBadge}>{member.role}</span>
          <button 
            style={styles.deleteButton}
            onClick={() => removeMember(member.id)}
          >
            <Trash2 size={16} />
          </button>
        </div>
      ))}

      {/* Pending Invitations */}
      {invitations.length > 0 && (
        <>
          <h4 style={styles.subsectionTitle}>Pending Invitations</h4>
          {invitations.map((inv) => (
            <div key={inv.id} style={{ ...styles.memberCard, opacity: 0.7 }}>
              <div style={styles.memberAvatar}>
                <Mail size={16} />
              </div>
              <div style={styles.memberInfo}>
                <span style={styles.memberName}>{inv.email}</span>
                <span style={styles.memberEmail}>Pending • {inv.role}</span>
              </div>
              <button 
                style={styles.deleteButton}
                onClick={() => removeInvitation(inv.id)}
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </>
      )}
    </div>
  );

  const renderFeaturesTab = () => (
    <div style={styles.tabContent}>
      <div style={styles.sectionHeader}>
        <h3 style={styles.sectionTitle}>Features & Modules</h3>
        <p style={styles.sectionDescription}>Enable or disable features based on your business needs.</p>
      </div>

      <div style={styles.featuresList}>
        {/* POS Feature */}
        <div style={styles.featureCard}>
          <div style={styles.featureIcon}>
            <ShoppingCart size={24} color="#F59E0B" />
          </div>
          <div style={styles.featureContent}>
            <div style={styles.featureHeader}>
              <h4 style={styles.featureName}>Point of Sale (POS)</h4>
              <ToggleSwitch
                checked={posEnabled}
                onChange={() => handleToggleFeature(posEnabled, togglePOS, 'POS')}
              />
            </div>
            <p style={styles.featureDescription}>
              Enable retail sales tracking with automatic VAT calculation. 
              Manage products, process sales, and generate receipts.
            </p>
          </div>
        </div>

        {/* Multi-User Feature */}
        <div style={styles.featureCard}>
          <div style={styles.featureIcon}>
            <Users size={24} color="#3B82F6" />
          </div>
          <div style={styles.featureContent}>
            <div style={styles.featureHeader}>
              <h4 style={styles.featureName}>Multi-User Access</h4>
              <ToggleSwitch
                checked={multiUserEnabled}
                onChange={() => handleToggleFeature(multiUserEnabled, toggleMultiUser, 'Multi-User')}
              />
            </div>
            <p style={styles.featureDescription}>
              Invite team members with role-based permissions. 
              Supports up to {featureLimits.maxUsers} users on your current plan.
            </p>
          </div>
        </div>

        {/* Auto-Bank Tracking Feature */}
        <div style={{ ...styles.featureCard, opacity: 0.72 }}>
          <div style={{ ...styles.featureIcon, backgroundColor: 'rgba(34, 197, 94, 0.1)' }}>
            <Landmark size={24} color="#22C55E" />
          </div>
          <div style={styles.featureContent}>
            <div style={styles.featureHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h4 style={styles.featureName}>Auto-Bank Tracking</h4>
                <span style={{
                  padding: '2px 8px',
                  backgroundColor: 'rgba(245, 158, 11, 0.15)',
                  border: '1px solid rgba(245, 158, 11, 0.4)',
                  borderRadius: '9999px',
                  fontSize: '11px',
                  fontWeight: '600',
                  color: '#F59E0B',
                  letterSpacing: '0.04em'
                }}>
                  COMING SOON
                </span>
              </div>
              <ToggleSwitch
                checked={false}
                onChange={() => toast.info('Auto-Bank Tracking is coming soon. Stay tuned!')}
              />
            </div>
            <p style={styles.featureDescription}>
              Automatically sync transactions from Nigerian banks including GTBank, Access Bank,
              First Bank, UBA, and Zenith Bank. Banking integration is in final testing — available very soon.
            </p>
          </div>
        </div>

        {/* API Access Feature */}
        <div style={styles.featureCard}>
          <div style={styles.featureIcon}>
            <Code size={24} color="#8B5CF6" />
          </div>
          <div style={styles.featureContent}>
            <div style={styles.featureHeader}>
              <h4 style={styles.featureName}>API Access</h4>
              <ToggleSwitch
                checked={apiAccessEnabled}
                onChange={() => handleToggleFeature(apiAccessEnabled, toggleAPIAccess, 'API Access')}
              />
            </div>
            <p style={styles.featureDescription}>
              Integrate TaxWise with your existing systems. 
              Access tax calculations and data via REST API.
            </p>
          </div>
        </div>

        {/* Document AI Feature */}
        <div style={styles.featureCard}>
          <div style={styles.featureIcon}>
            <FileText size={24} color="#EC4899" />
          </div>
          <div style={styles.featureContent}>
            <div style={styles.featureHeader}>
              <h4 style={styles.featureName}>Document AI</h4>
              <ToggleSwitch
                checked={documentAIEnabled}
                onChange={() => handleToggleFeature(documentAIEnabled, toggleDocumentAI, 'Document AI')}
              />
            </div>
            <p style={styles.featureDescription}>
              Automatically extract data from invoices and receipts using AI.
              Supports PDF, JPG, and PNG files.
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderBillingTab = () => (
    <div style={styles.tabContent}>
      <div style={styles.sectionHeader}>
        <h3 style={styles.sectionTitle}>Billing & Subscription</h3>
        <p style={styles.sectionDescription}>Manage your subscription plan and payment methods.</p>
      </div>

      {/* Current Plan */}
      <div style={styles.planCard}>
        <div style={styles.planHeader}>
          <div>
            <span style={styles.planLabel}>Current Plan</span>
            <h4 style={styles.planName}>SME Plan</h4>
          </div>
          <span style={styles.planBadge}>Active</span>
        </div>
        <div style={styles.planPrice}>
          <span style={styles.priceAmount}>₦24,999</span>
          <span style={styles.pricePeriod}>/month</span>
        </div>
        <div style={styles.planFeatures}>
          <div style={styles.planFeature}>
            <Check size={14} color="#22C55E" />
            <span>Up to 5 users</span>
          </div>
          <div style={styles.planFeature}>
            <Check size={14} color="#22C55E" />
            <span>1 Bank account integration</span>
          </div>
          <div style={styles.planFeature}>
            <Check size={14} color="#22C55E" />
            <span>100 monthly calculations</span>
          </div>
          <div style={styles.planFeature}>
            <Check size={14} color="#22C55E" />
            <span>50 document uploads</span>
          </div>
        </div>
        <div style={styles.planActions}>
          <button 
            style={styles.upgradeButton}
            onClick={() => openModal('subscription')}
          >
            <Zap size={16} />
            <span>Upgrade Plan</span>
          </button>
          <button style={styles.manageButton}>
            Manage Subscription
          </button>
        </div>
      </div>

      {/* Billing Info */}
      <div style={styles.billingSection}>
        <h4 style={styles.subsectionTitle}>Payment Method</h4>
        {/* TODO: Integrate with Paystack for payment method management */}
        <div style={styles.emptyPayment}>
          <CreditCard size={32} color="#6E7681" />
          <p style={styles.emptyText}>No payment method added</p>
          <button 
            style={styles.addPaymentButton}
            onClick={() => toast.info('Payment integration coming soon')}
          >
            <Plus size={16} />
            Add Payment Method
          </button>
        </div>
      </div>

      {/* Billing History */}
      <div style={styles.billingSection}>
        <h4 style={styles.subsectionTitle}>Billing History</h4>
        {/* TODO: Fetch from backend API */}
        <div style={styles.emptyInvoices}>
          <FileText size={32} color="#6E7681" />
          <p style={styles.emptyText}>No billing history yet</p>
          <span style={styles.emptyHint}>Your invoices will appear here once you subscribe</span>
        </div>
      </div>
    </div>
  );

  const renderIntegrationsTab = () => (
    <div style={styles.tabContent}>
      <div style={styles.sectionHeader}>
        <h3 style={styles.sectionTitle}>Integrations</h3>
        <p style={styles.sectionDescription}>Connect TaxWise with external services.</p>
      </div>

      <div style={styles.integrationsList}>
        {/* Auto-Bank Tracking Integration */}
        <div style={styles.integrationCard}>
          <div style={styles.integrationIcon}>
            <Landmark size={32} color="#22C55E" />
          </div>
          <div style={styles.integrationContent}>
            <h4 style={styles.integrationName}>Auto-Bank Tracking</h4>
            <p style={styles.integrationDescription}>
              Automatically sync transactions from Nigerian banks including GTBank, Access Bank, 
              First Bank, UBA, Zenith Bank, and more.
            </p>
            {autoBankTrackingEnabled ? (
              <div style={styles.connectedStatus}>
                <Check size={14} color="#22C55E" />
                <span>Connected</span>
                <button style={styles.disconnectButton}>Disconnect</button>
              </div>
            ) : (
              <button 
                style={styles.connectButton}
                onClick={() => {
                  toggleAutoBankTracking();
                  toast.success('Auto-Bank Tracking enabled. Configure in Features tab.');
                }}
              >
                Connect Bank
              </button>
            )}
          </div>
        </div>

        {/* Paystack Integration */}
        <div style={styles.integrationCard}>
          <div style={{ ...styles.integrationIcon, backgroundColor: 'rgba(0, 168, 184, 0.1)' }}>
            <CreditCard size={32} color="#00A8B8" />
          </div>
          <div style={styles.integrationContent}>
            <h4 style={styles.integrationName}>Paystack</h4>
            <p style={styles.integrationDescription}>
              Process subscription payments securely. PCI-DSS compliant payment processing
              with support for Nigerian cards.
            </p>
            <div style={styles.connectedStatus}>
              <Check size={14} color="#22C55E" />
              <span>Configured</span>
            </div>
          </div>
        </div>

        {/* OpenAI Integration */}
        <div style={styles.integrationCard}>
          <div style={{ ...styles.integrationIcon, backgroundColor: 'rgba(16, 163, 127, 0.1)' }}>
            <Sparkles size={32} color="#10A37F" />
          </div>
          <div style={styles.integrationContent}>
            <h4 style={styles.integrationName}>AI Document Extraction</h4>
            <p style={styles.integrationDescription}>
              Powered by AI to automatically extract data from invoices, receipts, 
              and other financial documents.
            </p>
            {documentAIEnabled ? (
              <div style={styles.connectedStatus}>
                <Check size={14} color="#22C55E" />
                <span>Enabled</span>
              </div>
            ) : (
              <button 
                style={styles.connectButton}
                onClick={() => setActiveTab('features')}
              >
                Enable in Features
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'profile': return renderProfileTab();
      case 'organization': return renderOrganizationTab();
      case 'team': return renderTeamTab();
      case 'features': return renderFeaturesTab();
      case 'billing': return renderBillingTab();
      case 'integrations': return renderIntegrationsTab();
      default: return renderProfileTab();
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Settings</h1>
        <p style={styles.subtitle}>Manage your account, organization, and preferences.</p>
      </div>

      <div style={styles.content}>
        {/* Tabs Sidebar */}
        <div style={styles.tabsSidebar}>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                style={{
                  ...styles.tabButton,
                  ...(activeTab === tab.id ? styles.tabButtonActive : {})
                }}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon size={18} />
                <span>{tab.label}</span>
                <ChevronRight size={16} style={styles.tabArrow} />
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div style={styles.tabPanel}>
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    padding: '24px',
    minHeight: '100%',
    backgroundColor: '#0D1117'
  },
  header: {
    marginBottom: '24px'
  },
  title: {
    fontSize: '28px',
    fontWeight: '600',
    color: '#E6EDF3',
    margin: '0 0 8px 0'
  },
  subtitle: {
    fontSize: '14px',
    color: '#8B949E',
    margin: 0
  },
  content: {
    display: 'flex',
    gap: '24px'
  },
  tabsSidebar: {
    width: '240px',
    flexShrink: 0
  },
  tabButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    width: '100%',
    padding: '12px 16px',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '8px',
    color: '#8B949E',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    textAlign: 'left',
    marginBottom: '4px',
    transition: 'all 0.15s ease'
  },
  tabButtonActive: {
    backgroundColor: '#161B22',
    color: '#E6EDF3'
  },
  tabArrow: {
    marginLeft: 'auto',
    opacity: 0.5
  },
  tabPanel: {
    flex: 1,
    backgroundColor: '#161B22',
    borderRadius: '12px',
    border: '1px solid #30363D',
    overflow: 'hidden'
  },
  tabContent: {
    padding: '24px'
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '24px'
  },
  sectionTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#E6EDF3',
    margin: '0 0 4px 0'
  },
  sectionDescription: {
    fontSize: '14px',
    color: '#8B949E',
    margin: 0
  },
  limitText: {
    color: '#F59E0B'
  },
  avatarSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '24px'
  },
  avatarLarge: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    backgroundColor: '#2563EB',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden'
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover'
  },
  avatarInitials: {
    fontSize: '28px',
    fontWeight: '600',
    color: 'white'
  },
  avatarButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 16px',
    backgroundColor: '#21262D',
    border: '1px solid #30363D',
    borderRadius: '8px',
    color: '#E6EDF3',
    fontSize: '14px',
    cursor: 'pointer'
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '16px',
    marginBottom: '24px'
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  label: {
    fontSize: '13px',
    fontWeight: '500',
    color: '#8B949E'
  },
  input: {
    padding: '12px 16px',
    backgroundColor: '#0D1117',
    border: '1px solid #30363D',
    borderRadius: '8px',
    color: '#E6EDF3',
    fontSize: '14px',
    outline: 'none'
  },
  select: {
    padding: '12px 16px',
    backgroundColor: '#0D1117',
    border: '1px solid #30363D',
    borderRadius: '8px',
    color: '#E6EDF3',
    fontSize: '14px',
    outline: 'none',
    appearance: 'none',
    cursor: 'pointer'
  },
  formActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    paddingTop: '16px',
    borderTop: '1px solid #30363D'
  },
  saveButton: {
    display: 'flex',
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
  addButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 16px',
    backgroundColor: '#2563EB',
    border: 'none',
    borderRadius: '8px',
    color: 'white',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer'
  },
  featureDisabledCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '24px',
    backgroundColor: '#21262D',
    borderRadius: '8px',
    marginBottom: '16px'
  },
  disabledTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#E6EDF3',
    margin: '0 0 4px 0'
  },
  disabledText: {
    fontSize: '13px',
    color: '#8B949E',
    margin: 0
  },
  enableButton: {
    marginLeft: 'auto',
    padding: '8px 16px',
    backgroundColor: '#2563EB',
    border: 'none',
    borderRadius: '6px',
    color: 'white',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer'
  },
  inviteCard: {
    padding: '20px',
    backgroundColor: '#21262D',
    borderRadius: '8px',
    marginBottom: '16px'
  },
  inviteTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#E6EDF3',
    margin: '0 0 16px 0'
  },
  inviteForm: {
    display: 'flex',
    gap: '12px',
    alignItems: 'flex-start',
    flexWrap: 'wrap'
  },
  inviteActions: {
    display: 'flex',
    gap: '8px'
  },
  cancelButtonSmall: {
    padding: '10px 16px',
    backgroundColor: 'transparent',
    border: '1px solid #30363D',
    borderRadius: '6px',
    color: '#8B949E',
    fontSize: '13px',
    cursor: 'pointer'
  },
  saveButtonSmall: {
    padding: '10px 16px',
    backgroundColor: '#2563EB',
    border: 'none',
    borderRadius: '6px',
    color: 'white',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer'
  },
  memberCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    backgroundColor: '#21262D',
    borderRadius: '8px',
    marginBottom: '8px'
  },
  memberAvatar: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    backgroundColor: '#2563EB',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    fontWeight: '600',
    fontSize: '14px'
  },
  memberInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column'
  },
  memberName: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#E6EDF3'
  },
  memberEmail: {
    fontSize: '12px',
    color: '#8B949E'
  },
  ownerBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 10px',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: '9999px',
    fontSize: '12px',
    fontWeight: '500',
    color: '#F59E0B'
  },
  roleBadge: {
    padding: '4px 10px',
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
    borderRadius: '9999px',
    fontSize: '12px',
    fontWeight: '500',
    color: '#2563EB',
    textTransform: 'capitalize'
  },
  deleteButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '32px',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '6px',
    color: '#8B949E',
    cursor: 'pointer'
  },
  subsectionTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#E6EDF3',
    margin: '24px 0 12px 0'
  },
  featuresList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  featureCard: {
    display: 'flex',
    gap: '16px',
    padding: '20px',
    backgroundColor: '#21262D',
    borderRadius: '8px'
  },
  featureIcon: {
    width: '48px',
    height: '48px',
    borderRadius: '10px',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  featureContent: {
    flex: 1
  },
  featureHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px'
  },
  featureName: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#E6EDF3',
    margin: 0
  },
  featureDescription: {
    fontSize: '13px',
    color: '#8B949E',
    margin: 0,
    lineHeight: '1.5'
  },
  toggle: {
    position: 'relative',
    display: 'inline-block',
    width: '44px',
    height: '24px'
  },
  toggleInput: {
    opacity: 0,
    width: 0,
    height: 0
  },
  toggleSlider: {
    position: 'absolute',
    cursor: 'pointer',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#30363D',
    borderRadius: '12px',
    transition: 'background-color 0.2s ease'
  },
  planCard: {
    padding: '24px',
    backgroundColor: '#21262D',
    borderRadius: '12px',
    marginBottom: '24px'
  },
  planHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '16px'
  },
  planLabel: {
    fontSize: '12px',
    color: '#8B949E',
    display: 'block',
    marginBottom: '4px'
  },
  planName: {
    fontSize: '20px',
    fontWeight: '600',
    color: '#E6EDF3',
    margin: 0
  },
  planBadge: {
    padding: '4px 12px',
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderRadius: '9999px',
    fontSize: '12px',
    fontWeight: '500',
    color: '#22C55E'
  },
  planPrice: {
    marginBottom: '20px'
  },
  priceAmount: {
    fontSize: '36px',
    fontWeight: '700',
    color: '#E6EDF3'
  },
  pricePeriod: {
    fontSize: '14px',
    color: '#8B949E'
  },
  planFeatures: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '12px',
    marginBottom: '20px'
  },
  planFeature: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    color: '#E6EDF3'
  },
  planActions: {
    display: 'flex',
    gap: '12px'
  },
  upgradeButton: {
    display: 'flex',
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
  manageButton: {
    padding: '12px 24px',
    backgroundColor: 'transparent',
    border: '1px solid #30363D',
    borderRadius: '8px',
    color: '#8B949E',
    fontSize: '14px',
    cursor: 'pointer'
  },
  billingSection: {
    marginBottom: '24px'
  },
  paymentCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '16px',
    backgroundColor: '#21262D',
    borderRadius: '8px'
  },
  cardIcon: {
    width: '40px',
    height: '40px',
    borderRadius: '8px',
    backgroundColor: '#0D1117',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#8B949E'
  },
  cardInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column'
  },
  cardNumber: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#E6EDF3'
  },
  cardExpiry: {
    fontSize: '12px',
    color: '#8B949E'
  },
  editButton: {
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
  invoiceList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  invoiceRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '12px 16px',
    backgroundColor: '#21262D',
    borderRadius: '8px'
  },
  invoiceDate: {
    flex: 1,
    fontSize: '14px',
    color: '#E6EDF3'
  },
  invoiceAmount: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#E6EDF3'
  },
  invoiceStatus: {
    padding: '4px 10px',
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderRadius: '9999px',
    fontSize: '12px',
    color: '#22C55E'
  },
  downloadButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '32px',
    backgroundColor: 'transparent',
    border: 'none',
    color: '#8B949E',
    cursor: 'pointer'
  },
  integrationsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  integrationCard: {
    display: 'flex',
    gap: '20px',
    padding: '24px',
    backgroundColor: '#21262D',
    borderRadius: '12px'
  },
  integrationIcon: {
    width: '64px',
    height: '64px',
    borderRadius: '12px',
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  integrationContent: {
    flex: 1
  },
  integrationName: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#E6EDF3',
    margin: '0 0 8px 0'
  },
  integrationDescription: {
    fontSize: '13px',
    color: '#8B949E',
    margin: '0 0 16px 0',
    lineHeight: '1.5'
  },
  connectedStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    color: '#22C55E'
  },
  connectButton: {
    padding: '10px 20px',
    backgroundColor: '#2563EB',
    border: 'none',
    borderRadius: '8px',
    color: 'white',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer'
  },
  disconnectButton: {
    marginLeft: '16px',
    padding: '6px 12px',
    backgroundColor: 'transparent',
    border: '1px solid #30363D',
    borderRadius: '6px',
    color: '#8B949E',
    fontSize: '12px',
    cursor: 'pointer'
  },
  emptyPayment: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px',
    backgroundColor: '#21262D',
    borderRadius: '12px',
    textAlign: 'center'
  },
  emptyInvoices: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px',
    backgroundColor: '#21262D',
    borderRadius: '12px',
    textAlign: 'center'
  },
  emptyText: {
    fontSize: '14px',
    color: '#8B949E',
    margin: '12px 0 4px'
  },
  emptyHint: {
    fontSize: '12px',
    color: '#6E7681'
  },
  addPaymentButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginTop: '16px',
    padding: '10px 20px',
    backgroundColor: '#2563EB',
    border: 'none',
    borderRadius: '8px',
    color: 'white',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer'
  },
  primaryButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '12px 20px',
    backgroundColor: '#2563EB',
    border: 'none',
    borderRadius: '8px',
    color: 'white',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer'
  },
  secondaryButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '12px 20px',
    backgroundColor: 'transparent',
    border: '1px solid #30363D',
    borderRadius: '8px',
    color: '#E6EDF3',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer'
  },
  hint: {
    fontSize: '12px',
    color: '#6E7681',
    marginTop: '4px'
  }
};

// Add toggle slider styling via useEffect or inline CSS
const toggleSliderChecked = `
  .toggle input:checked + .toggleSlider {
    background-color: #2563EB;
  }
  .toggle input:checked + .toggleSlider:before {
    transform: translateX(20px);
  }
  .toggleSlider:before {
    content: "";
    position: absolute;
    height: 18px;
    width: 18px;
    left: 3px;
    bottom: 3px;
    background-color: white;
    border-radius: 50%;
    transition: transform 0.2s ease;
  }
`;

export default Settings;
