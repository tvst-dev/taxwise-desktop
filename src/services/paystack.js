/**
 * TaxWise Paystack Integration Service
 * 
 * This service handles subscription payments using Paystack.
 * It implements a secure, PCI-compliant flow where:
 * 1. Card data is captured via Paystack Inline JS (never touches our servers)
 * 2. Authorization tokens are stored for recurring billing
 * 3. Webhooks handle subscription status updates
 */

import React from 'react';

// Configuration - in production, load from secure config
const PAYSTACK_PUBLIC_KEY = 'pk_live_05804f729a24a0bc337ba66edd6b948a3b606002';
const API_BASE_URL = 'http://localhost:3001/api';

// Subscription Plans
export const SUBSCRIPTION_PLANS = {
  sme: {
    id: 'sme',
    name: 'SME Plan',
    code: 'PLN_sme_monthly',
    price: 24999,
    currency: 'NGN',
    interval: 'monthly',
    features: [
      'Interactive Tax Calculators (PAYE, CIT, WHT, VAT)',
      'Taxpayer Profile & History Logging',
      'Deductions Management',
      'Exportable Reports (PDF, DOC, Excel)',
      'Reminders & Schedules',
      'Multi-User Accounts (up to 5 users)',
      'Document Upload & AI Extraction',
      'Single-Account Banking Integration',
      'AI Tax Guidance',
      'Basic POS Features'
    ]
  },
  enterprise: {
    id: 'enterprise',
    name: 'Large Corporation',
    code: 'PLN_enterprise_monthly',
    price: 49999,
    currency: 'NGN',
    interval: 'monthly',
    features: [
      'All SME Features',
      'Multi-Branch Consolidated Calculations',
      'Advanced Analytics Dashboards',
      'Granular Role-Based Access',
      'Batch Document Processing',
      'Multi-Account Banking Integration',
      'Advanced AI Insights & Scenario Planning',
      'Multi-Terminal POS Management',
      'Offline Sync Capability',
      'Priority Support',
      'Custom Reports',
      'API Access'
    ]
  }
};

// Subscription Status Types
export const SUBSCRIPTION_STATUS = {
  ACTIVE: 'active',
  PENDING: 'pending',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
  PAYMENT_FAILED: 'payment_failed'
};

/**
 * PaystackService - Handles all Paystack-related operations
 */
class PaystackService {
  constructor() {
    this.isInitialized = false;
  }

  /**
   * Initialize Paystack Inline JS
   * This must be called before any payment operations
   */
  async initialize() {
    if (this.isInitialized) return;

    return new Promise((resolve, reject) => {
      // Check if already loaded
      if (window.PaystackPop) {
        this.isInitialized = true;
        resolve();
        return;
      }

      // Load Paystack Inline JS
      const script = document.createElement('script');
      script.src = 'https://js.paystack.co/v1/inline.js';
      script.async = true;
      
      script.onload = () => {
        this.isInitialized = true;
        resolve();
      };
      
      script.onerror = () => {
        reject(new Error('Failed to load Paystack'));
      };

      document.head.appendChild(script);
    });
  }

  /**
   * Initialize a new subscription payment
   * Opens Paystack popup for card capture (invisible to user as Paystack-branded)
   * 
   * @param {Object} params Payment parameters
   * @param {string} params.email Customer email
   * @param {string} params.planId Plan identifier (sme or enterprise)
   * @param {string} params.organizationId Organization ID
   * @param {Function} params.onSuccess Success callback
   * @param {Function} params.onCancel Cancel callback
   */
  async initializeSubscription({ email, planId, organizationId, onSuccess, onCancel }) {
    await this.initialize();

    const plan = SUBSCRIPTION_PLANS[planId];
    if (!plan) {
      throw new Error('Invalid plan selected');
    }

    // Generate unique reference
    const reference = `txw_${organizationId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create payment handler
    const handler = window.PaystackPop.setup({
      key: PAYSTACK_PUBLIC_KEY,
      email: email,
      amount: plan.price * 100, // Amount in kobo
      currency: plan.currency,
      ref: reference,
      plan: plan.code,
      metadata: {
        organization_id: organizationId,
        plan_id: planId,
        custom_fields: [
          {
            display_name: 'Plan',
            variable_name: 'plan_name',
            value: plan.name
          }
        ]
      },
      callback: async (response) => {
        try {
          // Verify transaction on backend
          const result = await this.verifyTransaction(response.reference);
          
          if (result.status === 'success') {
            // Store authorization for recurring billing
            await this.storeAuthorization({
              organizationId,
              authorizationCode: result.data.authorization.authorization_code,
              customerCode: result.data.customer.customer_code,
              cardType: result.data.authorization.card_type,
              last4: result.data.authorization.last4,
              expMonth: result.data.authorization.exp_month,
              expYear: result.data.authorization.exp_year,
              bank: result.data.authorization.bank
            });

            onSuccess?.({
              reference: response.reference,
              status: 'success',
              plan: plan
            });
          } else {
            throw new Error('Payment verification failed');
          }
        } catch (error) {
          console.error('Payment callback error:', error);
          onCancel?.({ message: error.message });
        }
      },
      onClose: () => {
        onCancel?.({ message: 'Payment cancelled' });
      }
    });

    handler.openIframe();
  }

  /**
   * Verify transaction on backend
   * @param {string} reference Transaction reference
   */
  async verifyTransaction(reference) {
    const response = await fetch(`${API_BASE_URL}/payments/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.getAuthToken()}`
      },
      body: JSON.stringify({ reference })
    });

    if (!response.ok) {
      throw new Error('Transaction verification failed');
    }

    return response.json();
  }

  /**
   * Store authorization token on backend for recurring billing
   * @param {Object} authData Authorization data
   */
  async storeAuthorization(authData) {
    const response = await fetch(`${API_BASE_URL}/payments/store-authorization`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.getAuthToken()}`
      },
      body: JSON.stringify(authData)
    });

    if (!response.ok) {
      throw new Error('Failed to store authorization');
    }

    return response.json();
  }

  /**
   * Update payment method (card)
   * Used when user wants to change their payment card
   * 
   * @param {Object} params Update parameters
   */
  async updatePaymentMethod({ email, organizationId, onSuccess, onCancel }) {
    await this.initialize();

    const reference = `txw_update_${organizationId}_${Date.now()}`;

    const handler = window.PaystackPop.setup({
      key: PAYSTACK_PUBLIC_KEY,
      email: email,
      amount: 50 * 100, // Small amount for card validation (₦50)
      currency: 'NGN',
      ref: reference,
      metadata: {
        organization_id: organizationId,
        type: 'card_update'
      },
      callback: async (response) => {
        try {
          const result = await this.verifyTransaction(response.reference);
          
          if (result.status === 'success') {
            // Update authorization
            await this.storeAuthorization({
              organizationId,
              authorizationCode: result.data.authorization.authorization_code,
              customerCode: result.data.customer.customer_code,
              cardType: result.data.authorization.card_type,
              last4: result.data.authorization.last4,
              expMonth: result.data.authorization.exp_month,
              expYear: result.data.authorization.exp_year,
              bank: result.data.authorization.bank,
              isUpdate: true
            });

            // Refund the validation amount
            await this.refundTransaction(response.reference);

            onSuccess?.({
              message: 'Payment method updated successfully',
              last4: result.data.authorization.last4
            });
          }
        } catch (error) {
          onCancel?.({ message: error.message });
        }
      },
      onClose: () => {
        onCancel?.({ message: 'Card update cancelled' });
      }
    });

    handler.openIframe();
  }

  /**
   * Refund a transaction
   * @param {string} reference Transaction reference
   */
  async refundTransaction(reference) {
    const response = await fetch(`${API_BASE_URL}/payments/refund`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.getAuthToken()}`
      },
      body: JSON.stringify({ reference })
    });

    return response.json();
  }

  /**
   * Get current subscription status
   * @param {string} organizationId Organization ID
   */
  async getSubscriptionStatus(organizationId) {
    const response = await fetch(`${API_BASE_URL}/subscriptions/${organizationId}/status`, {
      headers: {
        'Authorization': `Bearer ${this.getAuthToken()}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch subscription status');
    }

    const data = await response.json();
    
    // Map to user-friendly status
    return {
      status: this.mapStatus(data.status),
      planName: data.plan_name,
      currentPeriodEnd: data.current_period_end,
      cancelAtPeriodEnd: data.cancel_at_period_end,
      paymentMethod: data.payment_method ? {
        last4: data.payment_method.last4,
        cardType: data.payment_method.card_type,
        expiry: `${data.payment_method.exp_month}/${data.payment_method.exp_year}`
      } : null
    };
  }

  /**
   * Cancel subscription
   * @param {string} organizationId Organization ID
   */
  async cancelSubscription(organizationId) {
    const response = await fetch(`${API_BASE_URL}/subscriptions/${organizationId}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.getAuthToken()}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to cancel subscription');
    }

    return response.json();
  }

  /**
   * Reactivate a cancelled subscription
   * @param {string} organizationId Organization ID
   */
  async reactivateSubscription(organizationId) {
    const response = await fetch(`${API_BASE_URL}/subscriptions/${organizationId}/reactivate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.getAuthToken()}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to reactivate subscription');
    }

    return response.json();
  }

  /**
   * Get billing history
   * @param {string} organizationId Organization ID
   */
  async getBillingHistory(organizationId) {
    const response = await fetch(`${API_BASE_URL}/subscriptions/${organizationId}/invoices`, {
      headers: {
        'Authorization': `Bearer ${this.getAuthToken()}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch billing history');
    }

    return response.json();
  }

  /**
   * Map Paystack status to user-friendly status
   * @param {string} status Paystack subscription status
   */
  mapStatus(status) {
    const statusMap = {
      'active': SUBSCRIPTION_STATUS.ACTIVE,
      'non-renewing': SUBSCRIPTION_STATUS.ACTIVE, // Still active, won't renew
      'attention': SUBSCRIPTION_STATUS.PENDING, // Grace period
      'completed': SUBSCRIPTION_STATUS.EXPIRED,
      'cancelled': SUBSCRIPTION_STATUS.CANCELLED
    };

    return statusMap[status] || SUBSCRIPTION_STATUS.EXPIRED;
  }

  /**
   * Get authentication token from storage
   */
  getAuthToken() {
    const auth = localStorage.getItem('taxwise-auth');
    if (auth) {
      try {
        const parsed = JSON.parse(auth);
        return parsed.state?.token || '';
      } catch {
        return '';
      }
    }
    return '';
  }
}

// Export singleton instance
export const paystackService = new PaystackService();

/**
 * React Hook for subscription management
 */
export const useSubscription = () => {
  const [status, setStatus] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  const fetchStatus = async (organizationId) => {
    if (!organizationId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await paystackService.getSubscriptionStatus(organizationId);
      setStatus(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const subscribe = async (params) => {
    return paystackService.initializeSubscription(params);
  };

  const updateCard = async (params) => {
    return paystackService.updatePaymentMethod(params);
  };

  const cancel = async (organizationId) => {
    try {
      await paystackService.cancelSubscription(organizationId);
      await fetchStatus(organizationId);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  return {
    status,
    loading,
    error,
    fetchStatus,
    subscribe,
    updateCard,
    cancel,
    plans: SUBSCRIPTION_PLANS
  };
};

export default paystackService;
