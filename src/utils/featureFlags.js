import { useFeaturesStore } from '../store';

const TIER_CONFIGS = {
  corporate: {
    features: { posEnabled: true, multiUserEnabled: true, apiAccessEnabled: true, autoBankTrackingEnabled: true, documentAIEnabled: true },
    limits: { maxUsers: 999, maxBankAccounts: 10, maxBranches: 999, monthlyCalculations: 99999, documentUploads: 9999 }
  },
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
  free: {
    features: { posEnabled: false, multiUserEnabled: false, apiAccessEnabled: false, autoBankTrackingEnabled: false, documentAIEnabled: true },
    limits: { maxUsers: 1, maxBankAccounts: 0, maxBranches: 1, monthlyCalculations: 50, documentUploads: 10 }
  }
};

export function applyFeatureFlags(tier) {
  const { setFeature, setFeatureLimits } = useFeaturesStore.getState();
  const config = TIER_CONFIGS[tier] || TIER_CONFIGS.startup;
  Object.entries(config.features).forEach(([key, value]) => setFeature(key, value));
  setFeatureLimits(config.limits);
}
