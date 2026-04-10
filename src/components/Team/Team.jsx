import React, { useState, useEffect } from 'react';
import {
  Users, Plus, Search, Mail, Shield, Edit2, Trash2,
  Crown, Check, X, AlertCircle, UserPlus,
  Clock, RefreshCw, ChevronDown
} from 'lucide-react';
import { useTeamStore, useFeaturesStore, useAuthStore } from '../../store';
import { inviteTeamMember, sendTeamInvite, cancelInvitation, getInvitations } from '../../services/supabase';
import toast from 'react-hot-toast';

const Team = () => {
  const { user, organization } = useAuthStore();
  const { multiUserEnabled, featureLimits } = useFeaturesStore();
  const {
    members, invitations,
    addMember, updateMember, removeMember,
    addInvitation, removeInvitation, setInvitations
  } = useTeamStore();

  // Refresh invitations from Supabase on mount so accepted invites don't show as pending
  useEffect(() => {
    if (!organization?.id) return;
    getInvitations(organization.id)
      .then((fresh) => setInvitations(fresh))
      .catch((e) => console.warn('Could not refresh invitations:', e.message));
  }, [organization?.id]);

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [pendingInviteLink, setPendingInviteLink] = useState(null); // { email, link }
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [inviteForm, setInviteForm] = useState({
    email: '',
    name: '',
    role: 'accountant'
  });

  const roles = [
    { 
      value: 'admin', 
      label: 'Admin', 
      description: 'Full access to all features and settings',
      color: '#EF4444',
      permissions: ['all']
    },
    { 
      value: 'manager', 
      label: 'Manager', 
      description: 'Can approve entries, manage team, and view reports',
      color: '#F59E0B',
      permissions: ['view', 'create', 'edit', 'approve', 'export', 'calculate', 'pos', 'team_view']
    },
    { 
      value: 'accountant', 
      label: 'Accountant', 
      description: 'Can create, edit entries and run tax calculations',
      color: '#3B82F6',
      permissions: ['view', 'create', 'edit', 'export', 'calculate']
    },
    { 
      value: 'cashier', 
      label: 'Cashier', 
      description: 'POS access and basic entry creation',
      color: '#22C55E',
      permissions: ['view', 'create', 'pos']
    },
    { 
      value: 'viewer', 
      label: 'Viewer', 
      description: 'Read-only access to view data',
      color: '#8B949E',
      permissions: ['view']
    }
  ];

  // Filter members — exclude the account owner so they only appear in the Owner section
  const filteredMembers = members.filter((member) => {
    if (member.id === user?.id || member.email === user?.email) return false;
    const matchesSearch = member.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         member.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === 'all' || member.role === filterRole;
    return matchesSearch && matchesRole;
  });

  const handleInvite = async () => {
    if (!inviteForm.email) {
      toast.error('Please enter an email address');
      return;
    }

    if (members.length >= featureLimits.maxUsers) {
      toast.error(`You've reached the maximum of ${featureLimits.maxUsers} users for your plan`);
      return;
    }

    // Check if already a member
    const existingMember = members.find(m => m.email === inviteForm.email);
    if (existingMember) {
      toast.error('This email is already a team member');
      return;
    }

    const loadingToast = toast.loading(`Sending invitation to ${inviteForm.email}...`);

    try {
      // Send invite via Edge Function — generates invite link + sends email if Resend is configured
      const result = await sendTeamInvite(
        inviteForm.email,
        inviteForm.role,
        organization?.id,
        organization?.name,
        user?.name || user?.email
      );

      // Record in team_invitations table (non-critical)
      let saved = null;
      try {
        saved = await inviteTeamMember(
          organization?.id,
          inviteForm.email,
          inviteForm.role,
          user?.id
        );
      } catch (dbErr) {
        console.warn('Could not save invite record to DB (non-critical):', dbErr.message);
      }

      addInvitation({
        ...(saved || {}),
        email: inviteForm.email,
        name: inviteForm.name,
        role: inviteForm.role,
        status: 'pending'
      });

      const emailCopy = inviteForm.email;
      setInviteForm({ email: '', name: '', role: 'accountant' });
      setShowInviteModal(false);

      if (result?.email_sent) {
        toast.success(`Invitation email sent to ${emailCopy}!`, { id: loadingToast });
      } else if (result?.invite_link) {
        // Email service not configured — show the link so admin can share it manually
        toast.dismiss(loadingToast);
        setPendingInviteLink({ email: emailCopy, link: result.invite_link });
      } else {
        toast.success(`Invitation created for ${emailCopy}!`, { id: loadingToast });
      }
    } catch (e) {
      console.error('Invite error:', e.message);
      toast.error(`Failed to send invitation: ${e.message}`, { id: loadingToast });
    }
  };

  const handleUpdateMember = () => {
    if (!selectedMember) return;
    
    updateMember(selectedMember.id, {
      role: selectedMember.role,
      name: selectedMember.name
    });
    
    toast.success('Team member updated');
    setShowEditModal(false);
    setSelectedMember(null);
  };

  const handleRemoveMember = (member) => {
    if (window.confirm(`Are you sure you want to remove ${member.name || member.email}?`)) {
      removeMember(member.id);
      toast.success('Team member removed');
    }
  };

  const handleResendInvite = async (invitation) => {
    const loadingToast = toast.loading(`Resending to ${invitation.email}...`);
    try {
      await sendTeamInvite(
        invitation.email,
        invitation.role,
        organization?.id,
        organization?.name,
        user?.name || user?.email
      );
      toast.success(`Invitation resent to ${invitation.email}`, { id: loadingToast });
    } catch (e) {
      toast.error(`Resend failed: ${e.message}`, { id: loadingToast });
    }
  };

  const handleCancelInvite = async (invitation) => {
    try {
      await cancelInvitation(invitation.id);
    } catch (e) {
      console.warn('DB cancel failed:', e.message);
    }
    removeInvitation(invitation.id);
    toast.success('Invitation cancelled');
  };

  const getRoleInfo = (roleValue) => {
    return roles.find(r => r.value === roleValue) || roles[4];
  };

  const copyInviteLink = (invitation) => {
    // The accept-invite edge function is the canonical invite URL — it bridges
    // Supabase auth tokens to the taxwise:// deep link after email confirmation.
    // For manual sharing, we note that the recipient still needs to click "Send Invite"
    // first to trigger Supabase to send them the auth email with the real token.
    const link = `https://xgicdlwxjkqtarfytbgz.supabase.co/functions/v1/accept-invite`;
    navigator.clipboard.writeText(link);
    toast('Resend the invite email to share the invite link — email contains the secure token');
  };

  // Feature disabled state
  if (!multiUserEnabled) {
    return (
      <div style={styles.container}>
        <div style={styles.disabledState}>
          <div style={styles.disabledIcon}>
            <Users size={48} color="#8B949E" />
          </div>
          <h2 style={styles.disabledTitle}>Multi-User Feature Not Enabled</h2>
          <p style={styles.disabledText}>
            Enable multi-user access to invite team members and collaborate on tax management.
            Go to Settings → Features to enable this feature.
          </p>
          <a href="#/settings" style={styles.enableButton}>
            <Shield size={16} />
            Go to Settings
          </a>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Team Management</h1>
          <p style={styles.subtitle}>
            Manage team members and their access permissions
            <span style={styles.memberCount}>
              {members.length + 1}/{featureLimits.maxUsers} members
            </span>
          </p>
        </div>
        <button 
          style={styles.inviteButton}
          onClick={() => setShowInviteModal(true)}
          disabled={members.length >= featureLimits.maxUsers - 1}
        >
          <UserPlus size={16} />
          Invite Member
        </button>
      </div>

      {/* Search and Filter */}
      <div style={styles.toolbar}>
        <div style={styles.searchBox}>
          <Search size={18} color="#8B949E" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={styles.searchInput}
          />
        </div>
        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          style={styles.filterSelect}
        >
          <option value="all">All Roles</option>
          {roles.map(role => (
            <option key={role.value} value={role.value}>{role.label}</option>
          ))}
        </select>
      </div>

      {/* Owner Card */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Owner</h3>
        <div style={styles.memberCard}>
          <div style={styles.memberAvatar}>
            <span>{user?.name?.charAt(0) || user?.email?.charAt(0) || 'U'}</span>
          </div>
          <div style={styles.memberInfo}>
            <div style={styles.memberName}>
              {user?.name || 'Account Owner'}
              <Crown size={14} color="#F59E0B" style={{ marginLeft: '8px' }} />
            </div>
            <div style={styles.memberEmail}>{user?.email}</div>
          </div>
          <div style={styles.memberRole}>
            <span style={{ ...styles.roleBadge, backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#F59E0B' }}>
              Owner
            </span>
          </div>
          <div style={styles.memberStatus}>
            <span style={styles.activeStatus}>
              <span style={styles.statusDot}></span>
              Active
            </span>
          </div>
          <div style={styles.memberActions}>
            {/* No actions for owner */}
          </div>
        </div>
      </div>

      {/* Team Members */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Team Members ({filteredMembers.length})</h3>
        {filteredMembers.length === 0 ? (
          <div style={styles.emptyState}>
            <Users size={40} color="#8B949E" />
            <p>No team members yet</p>
            <span>Invite your first team member to get started</span>
          </div>
        ) : (
          filteredMembers.map((member) => {
            const roleInfo = getRoleInfo(member.role);
            return (
              <div key={member.id} style={styles.memberCard}>
                <div style={styles.memberAvatar}>
                  <span>{member.name?.charAt(0) || member.email?.charAt(0) || 'U'}</span>
                </div>
                <div style={styles.memberInfo}>
                  <div style={styles.memberName}>{member.name || 'Unnamed User'}</div>
                  <div style={styles.memberEmail}>{member.email}</div>
                </div>
                <div style={styles.memberRole}>
                  <span style={{ 
                    ...styles.roleBadge, 
                    backgroundColor: `${roleInfo.color}15`, 
                    color: roleInfo.color 
                  }}>
                    {roleInfo.label}
                  </span>
                </div>
                <div style={styles.memberStatus}>
                  <span style={styles.activeStatus}>
                    <span style={styles.statusDot}></span>
                    Active
                  </span>
                </div>
                <div style={styles.memberActions}>
                  <button 
                    style={styles.actionButton}
                    onClick={() => {
                      setSelectedMember(member);
                      setShowEditModal(true);
                    }}
                    title="Edit"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button 
                    style={{ ...styles.actionButton, color: '#EF4444' }}
                    onClick={() => handleRemoveMember(member)}
                    title="Remove"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pending Invitations */}
      {invitations.length > 0 && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Pending Invitations ({invitations.length})</h3>
          {invitations.map((invitation) => {
            const roleInfo = getRoleInfo(invitation.role);
            return (
              <div key={invitation.id} style={{ ...styles.memberCard, opacity: 0.8 }}>
                <div style={{ ...styles.memberAvatar, backgroundColor: '#30363D' }}>
                  <Mail size={18} color="#8B949E" />
                </div>
                <div style={styles.memberInfo}>
                  <div style={styles.memberName}>{invitation.name || invitation.email}</div>
                  <div style={styles.memberEmail}>{invitation.email}</div>
                </div>
                <div style={styles.memberRole}>
                  <span style={{ 
                    ...styles.roleBadge, 
                    backgroundColor: `${roleInfo.color}15`, 
                    color: roleInfo.color 
                  }}>
                    {roleInfo.label}
                  </span>
                </div>
                <div style={styles.memberStatus}>
                  <span style={styles.pendingStatus}>
                    <Clock size={12} />
                    Pending
                  </span>
                </div>
                <div style={styles.memberActions}>
                  <button
                    style={{ ...styles.actionButton, color: '#3B82F6' }}
                    onClick={() => handleResendInvite(invitation)}
                    title="Resend invite email"
                  >
                    <RefreshCw size={14} />
                  </button>
                  <button
                    style={{ ...styles.actionButton, color: '#EF4444' }}
                    onClick={() => handleCancelInvite(invitation)}
                    title="Cancel invite"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Role Permissions Info */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Role Permissions</h3>
        <div style={styles.rolesGrid}>
          {roles.map((role) => (
            <div key={role.value} style={styles.roleCard}>
              <div style={styles.roleHeader}>
                <span style={{ 
                  ...styles.roleBadge, 
                  backgroundColor: `${role.color}15`, 
                  color: role.color 
                }}>
                  {role.label}
                </span>
              </div>
              <p style={styles.roleDescription}>{role.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div style={styles.modalOverlay} onClick={() => setShowInviteModal(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Invite Team Member</h3>
              <button style={styles.modalClose} onClick={() => setShowInviteModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div style={styles.modalBody}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Email Address *</label>
                <input
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                  style={styles.input}
                  placeholder="colleague@company.com"
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Full Name</label>
                <input
                  type="text"
                  value={inviteForm.name}
                  onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
                  style={styles.input}
                  placeholder="John Doe"
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Role *</label>
                <select
                  value={inviteForm.role}
                  onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
                  style={styles.select}
                >
                  {roles.map(role => (
                    <option key={role.value} value={role.value}>{role.label}</option>
                  ))}
                </select>
                <p style={styles.helpText}>
                  {roles.find(r => r.value === inviteForm.role)?.description}
                </p>
              </div>
            </div>
            <div style={styles.modalFooter}>
              <button style={styles.cancelButton} onClick={() => setShowInviteModal(false)}>
                Cancel
              </button>
              <button style={styles.submitButton} onClick={handleInvite}>
                <Mail size={16} />
                Send Invitation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedMember && (
        <div style={styles.modalOverlay} onClick={() => setShowEditModal(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Edit Team Member</h3>
              <button style={styles.modalClose} onClick={() => setShowEditModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div style={styles.modalBody}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Full Name</label>
                <input
                  type="text"
                  value={selectedMember.name || ''}
                  onChange={(e) => setSelectedMember({ ...selectedMember, name: e.target.value })}
                  style={styles.input}
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Email</label>
                <input
                  type="email"
                  value={selectedMember.email}
                  style={{ ...styles.input, backgroundColor: '#21262D' }}
                  disabled
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Role</label>
                <select
                  value={selectedMember.role}
                  onChange={(e) => setSelectedMember({ ...selectedMember, role: e.target.value })}
                  style={styles.select}
                >
                  {roles.map(role => (
                    <option key={role.value} value={role.value}>{role.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div style={styles.modalFooter}>
              <button style={styles.cancelButton} onClick={() => setShowEditModal(false)}>
                Cancel
              </button>
              <button style={styles.submitButton} onClick={handleUpdateMember}>
                <Check size={16} />
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invite Link Modal — shown when email service isn't configured */}
      {pendingInviteLink && (
        <div style={styles.modalOverlay} onClick={() => setPendingInviteLink(null)}>
          <div style={{ ...styles.modal, maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Share Invite Link</h3>
              <button style={styles.modalClose} onClick={() => setPendingInviteLink(null)}>
                <X size={20} />
              </button>
            </div>
            <div style={styles.modalBody}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16,
                background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)',
                borderRadius: 8, padding: '10px 14px' }}>
                <AlertCircle size={16} color="#F59E0B" style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: '#FCD34D', lineHeight: 1.5 }}>
                  Email delivery is not configured. Share this link directly with <strong>{pendingInviteLink.email}</strong>.
                </span>
              </div>
              <p style={{ fontSize: 13, color: '#8B949E', marginBottom: 10 }}>
                Invite link (expires in 7 days):
              </p>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  readOnly
                  value={pendingInviteLink.link}
                  style={{ flex: 1, padding: '10px 12px', background: '#0D1117', border: '1px solid #30363D',
                    borderRadius: 8, color: '#E6EDF3', fontSize: 12, fontFamily: 'monospace',
                    outline: 'none', overflow: 'hidden', textOverflow: 'ellipsis' }}
                />
                <button
                  style={{ ...styles.submitButton, padding: '10px 16px', gap: 6, flexShrink: 0 }}
                  onClick={() => {
                    navigator.clipboard.writeText(pendingInviteLink.link);
                    toast.success('Invite link copied!');
                  }}
                >
                  Copy
                </button>
              </div>
              <p style={{ marginTop: 12, fontSize: 12, color: '#64748B', lineHeight: 1.5 }}>
                To enable automatic email delivery, add a <strong>RESEND_API_KEY</strong> to your
                Supabase project secrets (Supabase Dashboard → Edge Functions → Secrets).
              </p>
            </div>
            <div style={styles.modalFooter}>
              <button style={styles.cancelButton} onClick={() => setPendingInviteLink(null)}>
                Close
              </button>
              <a
                href={`mailto:${pendingInviteLink.email}?subject=You're invited to TaxWise&body=Click this link to accept your invitation: ${encodeURIComponent(pendingInviteLink.link)}`}
                style={{ ...styles.submitButton, textDecoration: 'none', display: 'inline-flex',
                  alignItems: 'center', gap: 6 }}
              >
                <Mail size={16} />
                Open in Email Client
              </a>
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
  disabledState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '64px 24px',
    textAlign: 'center',
    minHeight: '60vh'
  },
  disabledIcon: {
    width: '96px',
    height: '96px',
    borderRadius: '50%',
    backgroundColor: '#161B22',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '24px'
  },
  disabledTitle: {
    fontSize: '24px',
    fontWeight: '600',
    color: '#E6EDF3',
    margin: '0 0 12px 0'
  },
  disabledText: {
    fontSize: '15px',
    color: '#8B949E',
    maxWidth: '400px',
    lineHeight: '1.6',
    margin: '0 0 24px 0'
  },
  enableButton: {
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
    fontSize: '28px',
    fontWeight: '600',
    color: '#E6EDF3',
    margin: '0 0 4px 0'
  },
  subtitle: {
    fontSize: '14px',
    color: '#8B949E',
    margin: 0,
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  memberCount: {
    padding: '4px 10px',
    backgroundColor: '#21262D',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: '500'
  },
  inviteButton: {
    display: 'flex',
    alignItems: 'center',
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
  toolbar: {
    display: 'flex',
    gap: '12px',
    marginBottom: '24px'
  },
  searchBox: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    backgroundColor: '#161B22',
    border: '1px solid #30363D',
    borderRadius: '8px'
  },
  searchInput: {
    flex: 1,
    backgroundColor: 'transparent',
    border: 'none',
    color: '#E6EDF3',
    fontSize: '14px',
    outline: 'none'
  },
  filterSelect: {
    padding: '12px 16px',
    backgroundColor: '#161B22',
    border: '1px solid #30363D',
    borderRadius: '8px',
    color: '#E6EDF3',
    fontSize: '14px',
    outline: 'none',
    cursor: 'pointer',
    minWidth: '140px'
  },
  section: {
    marginBottom: '32px'
  },
  sectionTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#8B949E',
    margin: '0 0 16px 0',
    textTransform: 'uppercase',
    letterSpacing: '0.05em'
  },
  memberCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '16px 20px',
    backgroundColor: '#161B22',
    border: '1px solid #30363D',
    borderRadius: '12px',
    marginBottom: '8px'
  },
  memberAvatar: {
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    backgroundColor: '#2563EB',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    fontWeight: '600',
    fontSize: '16px',
    flexShrink: 0
  },
  memberInfo: {
    flex: 1,
    minWidth: 0
  },
  memberName: {
    display: 'flex',
    alignItems: 'center',
    fontSize: '15px',
    fontWeight: '500',
    color: '#E6EDF3',
    marginBottom: '2px'
  },
  memberEmail: {
    fontSize: '13px',
    color: '#8B949E',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  memberRole: {
    flexShrink: 0
  },
  roleBadge: {
    padding: '6px 12px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '500'
  },
  memberStatus: {
    flexShrink: 0,
    width: '80px'
  },
  activeStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '13px',
    color: '#22C55E'
  },
  pendingStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '13px',
    color: '#F59E0B'
  },
  statusDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: '#22C55E'
  },
  memberActions: {
    display: 'flex',
    gap: '8px',
    flexShrink: 0
  },
  actionButton: {
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
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px',
    backgroundColor: '#161B22',
    borderRadius: '12px',
    border: '1px solid #30363D',
    textAlign: 'center'
  },
  rolesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '12px'
  },
  roleCard: {
    padding: '16px',
    backgroundColor: '#161B22',
    border: '1px solid #30363D',
    borderRadius: '8px'
  },
  roleHeader: {
    marginBottom: '8px'
  },
  roleDescription: {
    fontSize: '13px',
    color: '#8B949E',
    margin: 0,
    lineHeight: '1.5'
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999
  },
  modal: {
    width: '100%',
    maxWidth: '440px',
    backgroundColor: '#161B22',
    borderRadius: '16px',
    border: '1px solid #30363D',
    overflow: 'hidden'
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 24px',
    borderBottom: '1px solid #30363D'
  },
  modalTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#E6EDF3',
    margin: 0
  },
  modalClose: {
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
  modalBody: {
    padding: '24px'
  },
  modalFooter: {
    display: 'flex',
    gap: '12px',
    padding: '20px 24px',
    borderTop: '1px solid #30363D'
  },
  formGroup: {
    marginBottom: '20px'
  },
  label: {
    display: 'block',
    fontSize: '13px',
    fontWeight: '500',
    color: '#8B949E',
    marginBottom: '8px'
  },
  input: {
    width: '100%',
    padding: '12px 16px',
    backgroundColor: '#0D1117',
    border: '1px solid #30363D',
    borderRadius: '8px',
    color: '#E6EDF3',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box'
  },
  select: {
    width: '100%',
    padding: '12px 16px',
    backgroundColor: '#0D1117',
    border: '1px solid #30363D',
    borderRadius: '8px',
    color: '#E6EDF3',
    fontSize: '14px',
    outline: 'none',
    cursor: 'pointer',
    boxSizing: 'border-box'
  },
  helpText: {
    fontSize: '12px',
    color: '#8B949E',
    marginTop: '8px',
    marginBottom: 0
  },
  cancelButton: {
    flex: 1,
    padding: '12px',
    backgroundColor: 'transparent',
    border: '1px solid #30363D',
    borderRadius: '8px',
    color: '#8B949E',
    fontSize: '14px',
    cursor: 'pointer'
  },
  submitButton: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '12px',
    backgroundColor: '#2563EB',
    border: 'none',
    borderRadius: '8px',
    color: 'white',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer'
  }
};

export default Team;
