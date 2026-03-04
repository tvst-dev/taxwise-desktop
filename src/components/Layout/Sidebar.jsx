import React, { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  BarChart3,
  TrendingUp,
  Calculator,
  Clock,
  Shield,
  Receipt,
  Bell,
  Settings,
  ShoppingCart,
  Code,
  FileUp,
  Users,
  ChevronLeft,
  ChevronRight,
  Building2,
  LogOut,
  MoreVertical
} from 'lucide-react';
import { useAuthStore, useUIStore, useFeaturesStore } from '../../store';
import { signOut } from '../../services/supabase';
import { clearLocalData } from '../../services/dataSync';
import toast from 'react-hot-toast';

const Sidebar = () => {
  const navigate = useNavigate();
  const { user, organization, hasPermission, logout } = useAuthStore();
  const { sidebarCollapsed, toggleSidebar } = useUIStore();
  const { posEnabled, apiAccessEnabled, multiUserEnabled, documentAIEnabled } = useFeaturesStore();
  const location = useLocation();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Handle logout
  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await signOut();
      clearLocalData();
      logout();
      toast.success('Logged out successfully');
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
      // Force logout even if API fails
      clearLocalData();
      logout();
      navigate('/login');
    } finally {
      setLoggingOut(false);
    }
  };

  // Build navigation dynamically based on features and permissions
  const buildNavigation = () => {
    const nav = [
      {
        section: 'OVERVIEW',
        items: [
          { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
          { path: '/entries', icon: FileText, label: 'Entries' },
          { path: '/analytics', icon: BarChart3, label: 'Analytics' },
          { path: '/cash-flow', icon: TrendingUp, label: 'Cash Flow' }
        ]
      },
      {
        section: 'TAX OPERATIONS',
        items: [
          { path: '/calculator', icon: Calculator, label: 'Tax Calculator' },
          { path: '/history', icon: Clock, label: 'Tax History' },
          { path: '/audit', icon: Shield, label: 'Audit' },
          { path: '/deductions', icon: Receipt, label: 'Deductions' },
          ...(documentAIEnabled ? [{ path: '/documents', icon: FileUp, label: 'Documents' }] : []),
          { path: '/reminders', icon: Bell, label: 'Reminders' }
        ]
      }
    ];

    // Add Enterprise section based on enabled features
    const enterpriseItems = [];

    if (posEnabled && hasPermission('pos')) {
      enterpriseItems.push({ path: '/pos', icon: ShoppingCart, label: 'POS Sales' });
    }

    if (multiUserEnabled && hasPermission('team_view')) {
      enterpriseItems.push({ path: '/team', icon: Users, label: 'Team' });
    }

    if (apiAccessEnabled) {
      enterpriseItems.push({ path: '/api', icon: Code, label: 'API Access' });
    }

    enterpriseItems.push({ path: '/settings', icon: Settings, label: 'Settings' });

    if (enterpriseItems.length > 0) {
      nav.push({
        section: 'MANAGEMENT',
        items: enterpriseItems
      });
    }

    return nav;
  };

  const navigation = buildNavigation();

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <aside style={{
      ...styles.sidebar,
      width: sidebarCollapsed ? '72px' : '260px'
    }}>
      {/* Logo & Brand */}
      <div style={styles.brand}>
        <div style={styles.logoContainer}>
          <div style={styles.logo}>
            <Calculator size={24} color="#2563EB" />
          </div>
          {!sidebarCollapsed && (
            <div style={styles.brandText}>
              <span style={styles.brandName}>TaxWise</span>
              <span style={styles.brandTagline}>Nigeria</span>
            </div>
          )}
        </div>
        <button
          style={styles.collapseButton}
          onClick={toggleSidebar}
          title={sidebarCollapsed ? 'Expand' : 'Collapse'}
        >
          {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Organization Info */}
      {!sidebarCollapsed && organization && (
        <div style={styles.orgInfo}>
          <div style={styles.orgIcon}>
            <Building2 size={16} color="#8B949E" />
          </div>
          <div style={styles.orgDetails}>
            <span style={styles.orgName}>{organization.name || 'My Business'}</span>
            <span style={styles.orgType}>{organization.business_type || 'Business'}</span>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav style={styles.nav}>
        {navigation.map((group) => (
          <div key={group.section} style={styles.navGroup}>
            {!sidebarCollapsed && (
              <span style={styles.sectionLabel}>{group.section}</span>
            )}
            <div style={styles.navItems}>
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;

                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    style={{
                      ...styles.navItem,
                      ...(isActive ? styles.navItemActive : {}),
                      justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                      padding: sidebarCollapsed ? '12px' : '10px 16px'
                    }}
                    title={sidebarCollapsed ? item.label : undefined}
                  >
                    <Icon size={20} style={{ minWidth: '20px' }} />
                    {!sidebarCollapsed && (
                      <span style={styles.navLabel}>{item.label}</span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User Profile Section */}
      <div style={styles.userSection}>
        {/* User Profile */}
        <div 
          style={{
            ...styles.userProfile,
            justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
            padding: sidebarCollapsed ? '12px' : '12px 16px',
            backgroundColor: showUserMenu ? '#21262D' : 'transparent'
          }}
          onClick={() => setShowUserMenu(!showUserMenu)}
        >
          <div style={styles.avatar}>
            {user?.avatar ? (
              <img src={user.avatar} alt={user.name} style={styles.avatarImg} />
            ) : (
              <span style={styles.avatarText}>
                {getInitials(user?.name || user?.email)}
              </span>
            )}
          </div>
          {!sidebarCollapsed && (
            <>
              <div style={styles.userDetails}>
                <span style={styles.userName}>{user?.name || 'User'}</span>
                <span style={styles.userRole}>
                  {user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'Owner'}
                </span>
              </div>
              <MoreVertical size={16} color="#6E7681" style={{ marginLeft: 'auto' }} />
            </>
          )}
        </div>

        {/* User Menu Dropdown */}
        {showUserMenu && (
          <div style={styles.userMenu}>
            <NavLink 
              to="/settings" 
              style={styles.menuItem}
              onClick={() => setShowUserMenu(false)}
            >
              <Settings size={16} />
              {!sidebarCollapsed && <span>Settings</span>}
            </NavLink>
            <button 
              style={styles.logoutButton}
              onClick={handleLogout}
              disabled={loggingOut}
            >
              <LogOut size={16} />
              {!sidebarCollapsed && <span>{loggingOut ? 'Logging out...' : 'Log out'}</span>}
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};

const styles = {
  sidebar: {
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#161B22',
    borderRight: '1px solid #30363D',
    transition: 'width 0.2s ease',
    height: '100%',
    overflow: 'hidden'
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px',
    borderBottom: '1px solid #30363D'
  },
  logoContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  logo: {
    width: '40px',
    height: '40px',
    borderRadius: '10px',
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  brandText: {
    display: 'flex',
    flexDirection: 'column'
  },
  brandName: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#E6EDF3'
  },
  brandTagline: {
    fontSize: '11px',
    color: '#8B949E',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  collapseButton: {
    width: '28px',
    height: '28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#21262D',
    border: '1px solid #30363D',
    borderRadius: '6px',
    color: '#8B949E',
    cursor: 'pointer'
  },
  orgInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 16px',
    margin: '12px',
    backgroundColor: '#21262D',
    borderRadius: '8px'
  },
  orgIcon: {
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0D1117',
    borderRadius: '6px'
  },
  orgDetails: {
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
  },
  orgName: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#E6EDF3',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  orgType: {
    fontSize: '11px',
    color: '#8B949E'
  },
  nav: {
    flex: 1,
    padding: '8px',
    overflowY: 'auto'
  },
  navGroup: {
    marginBottom: '16px'
  },
  sectionLabel: {
    display: 'block',
    fontSize: '10px',
    fontWeight: '600',
    color: '#6E7681',
    letterSpacing: '0.05em',
    padding: '8px 16px 4px',
    textTransform: 'uppercase'
  },
  navItems: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px'
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 16px',
    borderRadius: '8px',
    color: '#8B949E',
    textDecoration: 'none',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'all 0.15s ease'
  },
  navItemActive: {
    backgroundColor: 'rgba(37, 99, 235, 0.15)',
    color: '#2563EB'
  },
  navLabel: {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  userSection: {
    borderTop: '1px solid #30363D',
    padding: '8px'
  },
  userProfile: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'background-color 0.15s ease'
  },
  avatar: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    backgroundColor: '#2563EB',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover'
  },
  avatarText: {
    fontSize: '14px',
    fontWeight: '600',
    color: 'white'
  },
  userDetails: {
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    flex: 1
  },
  userName: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#E6EDF3',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  userRole: {
    fontSize: '11px',
    color: '#8B949E'
  },
  userMenu: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    marginTop: '4px',
    padding: '4px',
    backgroundColor: '#21262D',
    borderRadius: '8px',
    border: '1px solid #30363D'
  },
  menuItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 12px',
    borderRadius: '6px',
    color: '#8B949E',
    textDecoration: 'none',
    fontSize: '13px',
    fontWeight: '500',
    transition: 'all 0.15s ease'
  },
  logoutButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 12px',
    borderRadius: '6px',
    backgroundColor: 'transparent',
    border: 'none',
    color: '#EF4444',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    width: '100%',
    textAlign: 'left'
  }
};

export default Sidebar;