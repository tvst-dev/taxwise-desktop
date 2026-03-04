/**
 * TaxWise Paystack Subscription Service
 * Handles subscription billing with completely invisible Paystack integration
 * 
 * Key Features:
 * - PCI-DSS compliant tokenization
 * - Zero raw card data stored
 * - Invisible to end users
 * - Supports SME and Enterprise plans
 */

import config from '../config';

// Paystack public key - in production, this should be loaded from config
const PAYSTACK_PUBLIC_KEY = config.PAYSTACK_PUBLIC_KEY;

// Plan definitions — keep in sync with config.js and Paystack edge function
export const SUBSCRIPTION_PLANS = {
  startup: {
    id: 'startup',
    name: 'Startup',
    monthlyPrice: 10000,
    features: [
      'Income & expense tracking',
      'Automated tax calculations',
      'Basic compliance reports',
      'Single business profile',
      'Document AI Extraction'
    ],
    limits: {
      users: 1,
      bankAccounts: 0,
      branches: 1,
      monthlyCalculations: 50,
      documentUploads: 10
    }
  },
  sme: {
    id: 'sme',
    name: 'SME',
    monthlyPrice: 25000,
    features: [
      'Everything in Startup',
      'Audit-ready reports',
      'Multi-income streams',
      'Export-ready documentation',
      'Compliance reminders',
      'Accountant access (up to 5 users)',
      'POS Sales Tracking',
      'Bank Account Integration'
    ],
    limits: {
      users: 5,
      bankAccounts: 1,
      branches: 1,
      monthlyCalculations: 100,
      documentUploads: 50
    }
  },
  corporate: {
    id: 'corporate',
    name: 'Corporate',
    monthlyPrice: 60000,
    features: [
      'Everything in SME',
      'Multi-user roles & permissions',
      'Advanced reporting',
      'API integrations',
      'Priority support',
      'Unlimited users & calculations',
      'Multi-account bank integration'
    ],
    limits: {
      users: -1,       // Unlimited
      bankAccounts: 10,
      branches: -1,    // Unlimited
      monthlyCalculations: -1,
      documentUploads: -1
    }
  }
};

// Subscription statuses
export const SUBSCRIPTION_STATUS = {
  TRIAL: 'trial',       // 14-day trial period
  ACTIVE: 'active',     // Paid and current
  PENDING: 'pending',   // Awaiting first payment
  PAST_DUE: 'past_due', // Payment failed — grace period
  EXPIRED: 'expired',
  CANCELLED: 'cancelled'
};

/**
 * Initialize Paystack Inline for card capture
 * This creates an invisible iframe that captures card data
 * and returns authorization tokens
 */
export const initializePaystackCapture = (config) => {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Paystack can only be initialized in browser'));
      return;
    }

    // Load Paystack inline script if not already loaded
    const loadPaystackScript = () => {
      return new Promise((res, rej) => {
        if (window.PaystackPop) {
          res(window.PaystackPop);
          return;
        }

        const script = document.createElement('script');
        script.src = 'https://js.paystack.co/v1/inline.js';
        script.async = true;
        script.onload = () => res(window.PaystackPop);
        script.onerror = () => rej(new Error('Failed to load Paystack'));
        document.head.appendChild(script);
      });
    };

    loadPaystackScript()
      .then((PaystackPop) => {
        const handler = PaystackPop.setup({
          key: PAYSTACK_PUBLIC_KEY,
          email: config.email,
          amount: config.amount * 100, // Paystack uses kobo
          currency: 'NGN',
          ref: `txw_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          metadata: {
            organizationId: config.organizationId,
            planId: config.planId,
            billingCycle: config.billingCycle,
            custom_fields: [
              {
                display_name: 'Organization',
                variable_name: 'organization_name',
                value: config.organizationName
              }
            ]
          },
          channels: ['card'],
          // Callback when payment is successful
          callback: (response) => {
            resolve({
              reference: response.reference,
              transactionId: response.trans,
              message: response.message
            });
          },
          // Callback when payment window is closed
          onClose: () => {
            reject(new Error('Payment cancelled'));
          }
        });

        handler.openIframe();
      })
      .catch(reject);
  });
};

/**
 * Custom card capture form handler
 * Uses Paystack Inline but with custom form
 */
export class PaystackCardCapture {
  constructor(containerId, config) {
    this.containerId = containerId;
    this.config = config;
    this.iframe = null;
  }

  /**
   * Create a hidden iframe for Paystack card tokenization
   */
  initialize() {
    // This would be implemented with Paystack's Inline or Custom JS
    // For now, we'll use the popup method which is PCI compliant
    return initializePaystackCapture(this.config);
  }

  /**
   * Validate card number using Luhn algorithm
   */
  static validateCardNumber(number) {
    const cleaned = number.replace(/\s/g, '');
    if (!/^\d{13,19}$/.test(cleaned)) return false;

    let sum = 0;
    let isEven = false;

    for (let i = cleaned.length - 1; i >= 0; i--) {
      let digit = parseInt(cleaned[i], 10);

      if (isEven) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }

      sum += digit;
      isEven = !isEven;
    }

    return sum % 10 === 0;
  }

  /**
   * Get card type from number
   */
  static getCardType(number) {
    const cleaned = number.replace(/\s/g, '');
    
    const patterns = {
      visa: /^4/,
      mastercard: /^5[1-5]|^2[2-7]/,
      verve: /^506|^507|^650/
    };

    for (const [type, pattern] of Object.entries(patterns)) {
      if (pattern.test(cleaned)) return type;
    }

    return 'unknown';
  }
}

/**
 * Subscription management service
 */
export const SubscriptionService = {
  /**
   * Get current subscription status
   */
  async getStatus(organizationId) {
    try {
      // In production, this would call the backend API
      const stored = localStorage.getItem(`subscription_${organizationId}`);
      if (stored) {
        return JSON.parse(stored);
      }
      
      return {
        status: SUBSCRIPTION_STATUS.TRIAL,
        plan: null,
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        currentPeriodEnd: null
      };
    } catch (error) {
      console.error('Error getting subscription status:', error);
      throw error;
    }
  },

  /**
   * Start subscription with card capture
   */
  async subscribe(config) {
    try {
      // Initialize Paystack capture
      const paymentResult = await initializePaystackCapture(config);
      
      // In production, send the reference to backend to verify and create subscription
      // Backend would:
      // 1. Verify the transaction with Paystack
      // 2. Get the authorization_code and customer_code
      // 3. Create subscription with Paystack
      // 4. Store tokens securely
      // 5. Return subscription details
      
      // For now, simulate success
      const subscription = {
        id: `sub_${Date.now()}`,
        organizationId: config.organizationId,
        planId: config.planId,
        status: SUBSCRIPTION_STATUS.ACTIVE,
        billingCycle: config.billingCycle,
        amount: config.amount,
        currentPeriodStart: new Date().toISOString(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        paymentReference: paymentResult.reference,
        createdAt: new Date().toISOString()
      };

      // Store locally (in production, this comes from backend)
      localStorage.setItem(
        `subscription_${config.organizationId}`,
        JSON.stringify(subscription)
      );

      return subscription;
    } catch (error) {
      console.error('Subscription error:', error);
      throw error;
    }
  },

  /**
   * Update payment method
   */
  async updatePaymentMethod(organizationId, email) {
    try {
      // Re-capture card to get new authorization token
      const result = await initializePaystackCapture({
        email,
        amount: 100, // Minimal amount for verification (will be refunded)
        organizationId,
        planId: 'verification'
      });

      // Backend would update the stored authorization token
      return { success: true, reference: result.reference };
    } catch (error) {
      console.error('Update payment method error:', error);
      throw error;
    }
  },

  /**
   * Cancel subscription
   */
  async cancel(organizationId) {
    try {
      // In production, call backend to cancel with Paystack
      const stored = localStorage.getItem(`subscription_${organizationId}`);
      if (stored) {
        const subscription = JSON.parse(stored);
        subscription.status = SUBSCRIPTION_STATUS.CANCELLED;
        localStorage.setItem(`subscription_${organizationId}`, JSON.stringify(subscription));
        return subscription;
      }
      throw new Error('Subscription not found');
    } catch (error) {
      console.error('Cancel subscription error:', error);
      throw error;
    }
  },

  /**
   * Get subscription status display text
   */
  getStatusDisplay(status) {
    const displays = {
      [SUBSCRIPTION_STATUS.TRIAL]:     { text: '14-Day Trial', color: '#3B82F6' },
      [SUBSCRIPTION_STATUS.ACTIVE]:    { text: 'Active', color: '#22C55E' },
      [SUBSCRIPTION_STATUS.PENDING]:   { text: 'Payment Pending', color: '#F59E0B' },
      [SUBSCRIPTION_STATUS.PAST_DUE]:  { text: 'Payment Failed', color: '#EF4444' },
      [SUBSCRIPTION_STATUS.EXPIRED]:   { text: 'Expired', color: '#EF4444' },
      [SUBSCRIPTION_STATUS.CANCELLED]: { text: 'Cancelled', color: '#8B949E' }
    };
    return displays[status] || displays[SUBSCRIPTION_STATUS.EXPIRED];
  },

  /**
   * Check if feature is available for plan
   */
  isFeatureAvailable(planId, feature) {
    const plan = SUBSCRIPTION_PLANS[planId];
    if (!plan) return false;
    return plan.features.some(f => f.toLowerCase().includes(feature.toLowerCase()));
  },

  /**
   * Check if limit is exceeded
   */
  isLimitExceeded(planId, limitType, currentValue) {
    const plan = SUBSCRIPTION_PLANS[planId];
    if (!plan) return true;
    
    const limit = plan.limits[limitType];
    if (limit === -1) return false; // Unlimited
    
    return currentValue >= limit;
  }
};

export default SubscriptionService;
