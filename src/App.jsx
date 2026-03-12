import React, { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

// Services
import { getCurrentSession, getUserProfile, createUserProfile, onAuthStateChange, handleDeepLink } from './services/supabase';
import { loadOrganizationData, clearLocalData } from './services/dataSync';

// Stores
import { useAuthStore, useFeaturesStore } from './store';

// Layout
import Layout from './components/Layout/Layout';
import TitleBar from './components/Layout/TitleBar';

// Auth Pages
import LoginPage from './components/Auth/LoginPage';
import RegisterPage from './components/Auth/RegisterPage';
import ForgotPasswordPage from './components/Auth/ForgotPasswordPage';
import ResetPasswordPage from './components/Auth/ResetPasswordPage';
import SubscriptionExpired from './components/Auth/SubscriptionExpired';

// Main Pages
import Dashboard from './components/Dashboard/Dashboard';
import Entries from './components/Entries/Entries';
import Analytics from './components/Analytics/Analytics';
import CashFlow from './components/CashFlow/CashFlow';
import TaxCalculator from './components/TaxCalculator/TaxCalculator';
import TaxHistory from './components/History/TaxHistory';
import Deductions from './components/Deductions/Deductions';
import Settings from './components/Settings/Settings';
import Reminders from './components/Reminders/Reminders';
import Audit from './components/Audit/Audit';
import POSSales from './components/POS/POSSales';
import Documents from './components/Documents/Documents';
import API from './components/API/API';
import Team from './components/Team/Team';
import UpdateNotification from './components/UpdateNotification';

// Protected Route
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuthStore();
  if (isLoading) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
};

// Public Route
const PublicRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuthStore();
  if (isLoading) return null;
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return children;
};

function App() {
  const [appReady, setAppReady] = useState(false);
  const [subscriptionBlocked, setSubscriptionBlocked] = useState(false);
  const { login, logout, setLoading, isLoading } = useAuthStore();

  useEffect(() => {
    let authSubscription = null;

    const initializeApp = async () => {
      setLoading(true);
      try {
        const session = await getCurrentSession();
        if (session?.user) {
          await loadUserData(session.user.id);
        }

        const { data: { subscription } } = onAuthStateChange(async (event, session) => {
          console.log('Auth event:', event);
          if (event === 'SIGNED_IN' && session?.user) {
            await loadUserData(session.user.id);
          } else if (event === 'PASSWORD_RECOVERY') {
            // Deep link token exchanged — send user to reset page
            window.location.hash = '/reset-password';
          } else if (event === 'SIGNED_OUT') {
            clearLocalData();
            logout();
          }
        });
        authSubscription = subscription;

        // Listen for taxwise:// deep links from the Electron main process
        if (window.electronAPI?.onDeepLink) {
          window.electronAPI.onDeepLink(async (url) => {
            try {
              await handleDeepLink(url);
              // onAuthStateChange above will handle the navigation
            } catch (err) {
              console.error('Deep link handling failed:', err.message);
            }
          });
        }
      } catch (error) {
        console.error('App init error:', error);
      } finally {
        setLoading(false);
        setAppReady(true);
      }
    };

    initializeApp();
    return () => authSubscription?.unsubscribe();
  }, []);

  const loadUserData = async (userId) => {
    try {
      let profile = null;

      try {
        profile = await getUserProfile(userId);
      } catch (profileErr) {
        // Profile doesn't exist yet — check if this is an invited user
        const session = await getCurrentSession();
        const meta = session?.user?.user_metadata;

        if (meta?.organization_id) {
          // Invited user — create their profile from invite metadata
          const nameParts = (meta.full_name || '').split(' ');
          await createUserProfile({
            id: userId,
            email: session.user.email,
            organization_id: meta.organization_id,
            role: meta.role || 'viewer',
            first_name: nameParts[0] || '',
            last_name: nameParts.slice(1).join(' ') || ''
          });
          // Re-fetch with organization join
          profile = await getUserProfile(userId);
        } else {
          throw profileErr;
        }
      }

      if (profile) {
        const user = {
          id: profile.id,
          email: profile.email,
          name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email,
          firstName: profile.first_name,
          lastName: profile.last_name,
          role: profile.role,
          avatar: profile.avatar_url
        };

        const organization = profile.organization ? {
          id: profile.organization.id,
          name: profile.organization.name,
          business_type: profile.organization.business_type,
          tin: profile.organization.tin,
          subscription_tier: profile.organization.subscription_tier,
          subscription_status: profile.organization.subscription_status
        } : null;

        login(user, organization);
        updateFeatureFlags(organization?.subscription_tier || 'startup');

        // Block access until payment is verified (pending) or subscription is no longer active
        const allowedStatuses = ['trial', 'active'];
        const isBlocked = !organization?.subscription_status || !allowedStatuses.includes(organization.subscription_status);
        setSubscriptionBlocked(isBlocked);

        if (organization?.id) {
          try {
            await loadOrganizationData(organization.id);
          } catch (err) {
            console.error('Failed to load organization data:', err);
          }
        }
      }
    } catch (error) {
      console.error('Load user error:', error);
      clearLocalData();
      logout();
    }
  };

  const updateFeatureFlags = (tier) => {
    const { setFeature, setFeatureLimits } = useFeaturesStore.getState();

    const configs = {
      corporate: {
        features: { posEnabled: true, multiUserEnabled: true, apiAccessEnabled: true, autoBankTrackingEnabled: true, documentAIEnabled: true },
        limits: { maxUsers: 999, maxBankAccounts: 10, maxBranches: 999, monthlyCalculations: 99999, documentUploads: 9999 }
      },
      // Legacy alias
      enterprise: {
        features: { posEnabled: true, multiUserEnabled: true, apiAccessEnabled: true, autoBankTrackingEnabled: true, documentAIEnabled: true },
        limits: { maxUsers: 999, maxBankAccounts: 10, maxBranches: 999, monthlyCalculations: 99999, documentUploads: 9999 }
      },
      sme: {
        features: { posEnabled: true, multiUserEnabled: true, apiAccessEnabled: false, autoBankTrackingEnabled: true, documentAIEnabled: true },
        limits: { maxUsers: 5, maxBankAccounts: 1, maxBranches: 1, monthlyCalculations: 100, documentUploads: 50 }
      },
      startup: {
        features: { posEnabled: false, multiUserEnabled: false, apiAccessEnabled: false, autoBankTrackingEnabled: false, documentAIEnabled: true },
        limits: { maxUsers: 1, maxBankAccounts: 0, maxBranches: 1, monthlyCalculations: 50, documentUploads: 10 }
      },
      // Legacy — map to startup
      free: {
        features: { posEnabled: false, multiUserEnabled: false, apiAccessEnabled: false, autoBankTrackingEnabled: false, documentAIEnabled: true },
        limits: { maxUsers: 1, maxBankAccounts: 0, maxBranches: 1, monthlyCalculations: 50, documentUploads: 10 }
      }
    };

    const tierConfig = configs[tier] || configs.startup;
    Object.entries(tierConfig.features).forEach(([key, value]) => setFeature(key, value));
    setFeatureLimits(tierConfig.limits);
  };

  if (!appReady || isLoading) {
    return (
      <div style={styles.loadingContainer}>
        <TitleBar />
        <div style={styles.loadingContent}>
          <div style={styles.spinner}></div>
          <p style={styles.loadingText}>Starting TaxWise...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Show subscription expired screen for blocked accounts (after app is ready and user is authenticated)
  if (appReady && !isLoading && subscriptionBlocked) {
    return (
      <div style={styles.appContainer}>
        <TitleBar />
        <SubscriptionExpired onReactivate={() => setSubscriptionBlocked(false)} />
      </div>
    );
  }

  return (
    <div style={styles.appContainer}>
      <TitleBar />
      <div style={styles.mainContent}>
        <HashRouter>
          <Routes>
            {/* Public Auth Routes */}
            <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
            <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
            <Route path="/forgot-password" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />

            {/* Protected App Routes */}
            <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="entries" element={<Entries />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="cash-flow" element={<CashFlow />} />
              <Route path="calculator" element={<TaxCalculator />} />
              <Route path="history" element={<TaxHistory />} />
              <Route path="deductions" element={<Deductions />} />
              <Route path="reminders" element={<Reminders />} />
              <Route path="audit" element={<Audit />} />
              <Route path="documents" element={<Documents />} />
              <Route path="pos" element={<POSSales />} />
              <Route path="api" element={<API />} />
              <Route path="team" element={<Team />} />
              <Route path="settings" element={<Settings />} />
            </Route>

            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </HashRouter>
      </div>

      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: { background: '#161B22', color: '#E6EDF3', border: '1px solid #30363D', borderRadius: '8px' },
          success: { iconTheme: { primary: '#22C55E', secondary: '#161B22' } },
          error: { iconTheme: { primary: '#EF4444', secondary: '#161B22' } },
        }}
      />
      <UpdateNotification />
    </div>
  );
}

const styles = {
  appContainer: { height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#0D1117' },
  mainContent: { flex: 1, overflow: 'hidden' },
  loadingContainer: { height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#0D1117' },
  loadingContent: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
  spinner: { width: 48, height: 48, border: '4px solid #30363D', borderTopColor: '#2563EB', borderRadius: '50%', animation: 'spin 1s linear infinite' },
  loadingText: { marginTop: 20, color: '#8B949E', fontSize: 16 }
};

export default App;