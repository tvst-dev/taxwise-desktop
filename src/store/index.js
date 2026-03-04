/**
 * TaxWise Global State Store
 * Production-Ready State Management with Zustand
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ==================== AUTH STORE ====================

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      organization: null,
      isAuthenticated: false,
      isLoading: false,

      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setOrganization: (organization) => set({ organization }),
      setLoading: (isLoading) => set({ isLoading }),

      login: (user, organization) => set({
        user,
        organization,
        isAuthenticated: true,
        isLoading: false
      }),

      logout: () => {
        // Clear ALL persisted store data from localStorage
        [
          'taxwise-auth', 'taxwise-settings', 'taxwise-features',
          'taxwise-team', 'taxwise-entries', 'taxwise-pos',
          'taxwise-tax', 'taxwise-deductions', 'taxwise-reminders',
          'taxwise-bank', 'taxwise-documents'
        ].forEach(key => localStorage.removeItem(key));

        // Reset auth state
        set({ user: null, organization: null, isAuthenticated: false });

        // Reset all data stores in-memory so no stale data lingers
        useEntriesStore.setState({ entries: [] });
        useTaxStore.setState({ calculations: [] });
        useDeductionsStore.setState({ deductions: [] });
        useRemindersStore.setState({ reminders: [] });
        useBankStore.setState({ accounts: [], transactions: [] });
        useDocumentsStore.setState({ documents: [] });
        usePOSStore.setState({ products: [], cart: [], transactions: [] });
        useTeamStore.setState({ members: [], invitations: [] });
      },

      updateUser: (updates) => set((state) => ({
        user: state.user ? { ...state.user, ...updates } : null
      })),

      updateOrganization: (updates) => set((state) => ({
        organization: state.organization ? { ...state.organization, ...updates } : null
      })),

      hasPermission: (permission) => {
        const { user } = get();
        if (!user) return false;

        const rolePermissions = {
          owner: ['all'],
          admin: ['all'],
          manager: ['view', 'create', 'edit', 'approve', 'export', 'calculate', 'pos', 'team_view'],
          accountant: ['view', 'create', 'edit', 'export', 'calculate'],
          cashier: ['view', 'create', 'pos'],
          viewer: ['view']
        };

        const userPermissions = rolePermissions[user.role] || [];
        return userPermissions.includes('all') || userPermissions.includes(permission);
      },

      hasRole: (roles) => {
        const { user } = get();
        if (!user) return false;
        const roleArray = Array.isArray(roles) ? roles : [roles];
        return roleArray.includes(user.role);
      }
    }),
    {
      name: 'taxwise-auth',
      partialize: (state) => ({
        user: state.user,
        organization: state.organization,
        isAuthenticated: state.isAuthenticated
      })
    }
  )
);

// ==================== TEAM STORE ====================

export const useTeamStore = create(
  persist(
    (set, get) => ({
      members: [],
      invitations: [],
      isLoading: false,
      error: null,

      setMembers: (members) => set({ members }),
      
      addMember: (member) => set((state) => {
        const id = member.id || `member_${Date.now()}`;
        if (state.members.some(m => m.id === id)) return state;
        return { members: [...state.members, { ...member, id }] };
      }),
      
      updateMember: (id, updates) => set((state) => ({
        members: state.members.map((m) => (m.id === id ? { ...m, ...updates } : m))
      })),
      
      removeMember: (id) => set((state) => ({
        members: state.members.filter((m) => m.id !== id)
      })),

      setInvitations: (invitations) => set({ invitations }),

      addInvitation: (invitation) => set((state) => ({
        invitations: [...state.invitations, {
          status: 'pending',
          createdAt: new Date().toISOString(),
          ...invitation,
          id: invitation.id || `inv_${Date.now()}`
        }]
      })),

      removeInvitation: (id) => set((state) => ({
        invitations: state.invitations.filter((i) => i.id !== id)
      })),

      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),

      getMembersByRole: (role) => {
        const { members } = get();
        return members.filter((m) => m.role === role);
      },

      getMemberCount: () => {
        const { members } = get();
        return members.length;
      }
    }),
    {
      name: 'taxwise-team'
    }
  )
);

// ==================== FEATURES STORE ====================

export const useFeaturesStore = create(
  persist(
    (set, get) => ({
      posEnabled: false,
      autoBankTrackingEnabled: false,
      apiAccessEnabled: false,
      multiUserEnabled: false,
      documentAIEnabled: true,
      
      featureLimits: {
        maxUsers: 5,
        maxBankAccounts: 1,
        maxBranches: 1,
        monthlyCalculations: 100,
        documentUploads: 50
      },

      togglePOS: () => set((state) => ({ posEnabled: !state.posEnabled })),
      toggleAutoBankTracking: () => set((state) => ({ autoBankTrackingEnabled: !state.autoBankTrackingEnabled })),
      toggleAPIAccess: () => set((state) => ({ apiAccessEnabled: !state.apiAccessEnabled })),
      toggleMultiUser: () => set((state) => ({ multiUserEnabled: !state.multiUserEnabled })),
      toggleDocumentAI: () => set((state) => ({ documentAIEnabled: !state.documentAIEnabled })),

      setFeature: (feature, value) => set({ [feature]: value }),
      setFeatureLimits: (limits) => set((state) => ({
        featureLimits: { ...state.featureLimits, ...limits }
      })),

      isFeatureEnabled: (feature) => {
        const state = get();
        return state[feature] || false;
      }
    }),
    {
      name: 'taxwise-features'
    }
  )
);

// ==================== UI STORE ====================

export const useUIStore = create((set, get) => ({
  sidebarCollapsed: false,
  currentPage: 'dashboard',
  theme: 'dark',
  activeModal: null,
  modalData: null,
  modalStack: [],
  notifications: [],
  isExporting: false,
  globalLoading: false,

  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  setCurrentPage: (page) => set({ currentPage: page }),
  setTheme: (theme) => set({ theme }),

  openModal: (modalName, data = null) => set((state) => {
    if (state.activeModal) {
      return {
        modalStack: [...state.modalStack, { name: state.activeModal, data: state.modalData }],
        activeModal: modalName,
        modalData: data
      };
    }
    return { activeModal: modalName, modalData: data };
  }),

  closeModal: () => set((state) => {
    if (state.modalStack.length > 0) {
      const newStack = [...state.modalStack];
      const previousModal = newStack.pop();
      return {
        modalStack: newStack,
        activeModal: previousModal?.name || null,
        modalData: previousModal?.data || null
      };
    }
    return { activeModal: null, modalData: null };
  }),

  closeAllModals: () => set({ activeModal: null, modalData: null, modalStack: [] }),

  addNotification: (notification) => set((state) => ({
    notifications: [
      ...state.notifications,
      { 
        id: Date.now(), 
        ...notification, 
        createdAt: new Date().toISOString(),
        read: false
      }
    ]
  })),

  markNotificationRead: (id) => set((state) => ({
    notifications: state.notifications.map((n) => 
      n.id === id ? { ...n, read: true } : n
    )
  })),

  removeNotification: (id) => set((state) => ({
    notifications: state.notifications.filter((n) => n.id !== id)
  })),

  clearNotifications: () => set({ notifications: [] }),
  setExporting: (isExporting) => set({ isExporting }),
  setGlobalLoading: (globalLoading) => set({ globalLoading }),

  getUnreadCount: () => {
    const { notifications } = get();
    return notifications.filter((n) => !n.read).length;
  }
}));

// ==================== ENTRIES STORE ====================

export const useEntriesStore = create(
  persist(
    (set, get) => ({
      entries: [],
      categories: [],
      isLoading: false,
      error: null,
      filters: {
        entryType: null,
        status: null,
        category: null,
        startDate: null,
        endDate: null,
        searchTerm: ''
      },
      pagination: {
        page: 1,
        limit: 20,
        total: 0
      },

      setEntries: (entries) => set({ entries }),
      
      addEntry: (entry) => set((state) => {
        const id = entry.id || `entry_${Date.now()}`;
        if (state.entries.some(e => e.id === id)) return state;
        return {
          entries: [{ ...entry, id, createdAt: entry.createdAt || new Date().toISOString() }, ...state.entries]
        };
      }),
      
      updateEntry: (id, updates) => set((state) => ({
        entries: state.entries.map((e) => (e.id === id ? { ...e, ...updates, updatedAt: new Date().toISOString() } : e))
      })),
      
      removeEntry: (id) => set((state) => ({
        entries: state.entries.filter((e) => e.id !== id)
      })),

      setCategories: (categories) => set({ categories }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),

      setFilters: (filters) => set((state) => ({
        filters: { ...state.filters, ...filters }
      })),
      
      clearFilters: () => set({
        filters: {
          entryType: null,
          status: null,
          category: null,
          startDate: null,
          endDate: null,
          searchTerm: ''
        }
      }),

      setPagination: (pagination) => set((state) => ({
        pagination: { ...state.pagination, ...pagination }
      })),

      getFilteredEntries: () => {
        const { entries, filters } = get();
        return entries.filter((entry) => {
          if (filters.entryType && entry.entry_type !== filters.entryType) return false;
          if (filters.status && entry.status !== filters.status) return false;
          if (filters.category && entry.category !== filters.category) return false;
          if (filters.startDate && entry.date < filters.startDate) return false;
          if (filters.endDate && entry.date > filters.endDate) return false;
          if (filters.searchTerm) {
            const search = filters.searchTerm.toLowerCase();
            return (
              entry.description?.toLowerCase().includes(search) ||
              entry.vendor_customer?.toLowerCase().includes(search) ||
              entry.reference_number?.toLowerCase().includes(search)
            );
          }
          return true;
        });
      },

      getTotalsByType: () => {
        const { entries } = get();
        return entries.reduce((acc, entry) => {
          const type = entry.entry_type || 'other';
          acc[type] = (acc[type] || 0) + (entry.amount || 0);
          return acc;
        }, {});
      }
    }),
    {
      name: 'taxwise-entries'
    }
  )
);

// ==================== POS STORE ====================

export const usePOSStore = create(
  persist(
    (set, get) => ({
      products: [],
      categories: [
        { id: 'grains', name: 'Grains & Flour', color: '#F59E0B' },
        { id: 'dairy', name: 'Dairy', color: '#3B82F6' },
        { id: 'beverages', name: 'Beverages', color: '#22C55E' },
        { id: 'noodles', name: 'Noodles', color: '#EF4444' },
        { id: 'oils', name: 'Oils & Fats', color: '#8B5CF6' },
        { id: 'cereals', name: 'Cereals', color: '#EC4899' },
        { id: 'bakery', name: 'Bakery', color: '#F97316' },
        { id: 'seasonings', name: 'Seasonings', color: '#06B6D4' },
        { id: 'other', name: 'Other', color: '#6B7280' }
      ],
      cart: [],
      transactions: [],
      isLoading: false,
      error: null,

      setProducts: (products) => set({ products }),
      
      addProduct: (product) => set((state) => {
        const id = product.id || `prod_${Date.now()}`;
        if (state.products.some(p => p.id === id)) return state;
        return {
          products: [...state.products, { ...product, id, createdAt: product.createdAt || new Date().toISOString() }]
        };
      }),
      
      updateProduct: (id, updates) => set((state) => ({
        products: state.products.map((p) => (p.id === id ? { ...p, ...updates } : p))
      })),
      
      removeProduct: (id) => set((state) => ({
        products: state.products.filter((p) => p.id !== id)
      })),

      addCategory: (category) => set((state) => ({
        categories: [...state.categories, { ...category, id: category.id || `cat_${Date.now()}` }]
      })),

      updateCategory: (id, updates) => set((state) => ({
        categories: state.categories.map((c) => (c.id === id ? { ...c, ...updates } : c))
      })),

      removeCategory: (id) => set((state) => ({
        categories: state.categories.filter((c) => c.id !== id)
      })),

      addToCart: (product, quantity = 1) => set((state) => {
        const existingItem = state.cart.find((item) => item.productId === product.id);
        if (existingItem) {
          return {
            cart: state.cart.map((item) =>
              item.productId === product.id
                ? { ...item, quantity: item.quantity + quantity }
                : item
            )
          };
        }
        return {
          cart: [...state.cart, {
            productId: product.id,
            name: product.name,
            price: product.price,
            quantity,
            vatApplicable: product.vatApplicable !== false
          }]
        };
      }),

      updateCartItem: (productId, quantity) => set((state) => ({
        cart: quantity > 0
          ? state.cart.map((item) =>
              item.productId === productId ? { ...item, quantity } : item
            )
          : state.cart.filter((item) => item.productId !== productId)
      })),

      removeFromCart: (productId) => set((state) => ({
        cart: state.cart.filter((item) => item.productId !== productId)
      })),

      clearCart: () => set({ cart: [] }),

      addTransaction: (transaction) => set((state) => {
        const id = transaction.id || `txn_${Date.now()}`;
        if (state.transactions.some(t => t.id === id)) return state;
        return {
          transactions: [{ ...transaction, id, createdAt: transaction.createdAt || new Date().toISOString() }, ...state.transactions]
        };
      }),

      getCartTotal: () => {
        const { cart } = get();
        const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const vatableAmount = cart
          .filter((item) => item.vatApplicable)
          .reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const vat = vatableAmount * 0.075;
        return { subtotal, vatableAmount, vat, total: subtotal + vat };
      },

      getProductsByCategory: (categoryId) => {
        const { products } = get();
        return categoryId ? products.filter((p) => p.category === categoryId) : products;
      },

      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error })
    }),
    {
      name: 'taxwise-pos'
    }
  )
);

// ==================== TAX CALCULATIONS STORE ====================

export const useTaxStore = create(
  persist(
    (set, get) => ({
      calculations: [],
      currentCalculation: null,
      isLoading: false,
      error: null,

      setCalculations: (calculations) => set({ calculations }),
      
      addCalculation: (calculation) => set((state) => {
        const id = calculation.id || `calc_${Date.now()}`;
        if (state.calculations.some(c => c.id === id)) return state;
        return {
          calculations: [{ ...calculation, id, createdAt: calculation.createdAt || new Date().toISOString() }, ...state.calculations]
        };
      }),
      
      updateCalculation: (id, updates) => set((state) => ({
        calculations: state.calculations.map((c) => (c.id === id ? { ...c, ...updates } : c))
      })),

      removeCalculation: (id) => set((state) => ({
        calculations: state.calculations.filter((c) => c.id !== id)
      })),

      setCurrentCalculation: (calculation) => set({ currentCalculation: calculation }),
      clearCurrentCalculation: () => set({ currentCalculation: null }),

      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),

      getTotalTaxByType: () => {
        const { calculations } = get();
        const totals = {};
        calculations.forEach((calc) => {
          if (!totals[calc.tax_type]) {
            totals[calc.tax_type] = 0;
          }
          totals[calc.tax_type] += calc.net_tax_payable || 0;
        });
        return totals;
      }
    }),
    {
      name: 'taxwise-tax'
    }
  )
);

// ==================== DEDUCTIONS STORE ====================

export const useDeductionsStore = create(
  persist(
    (set, get) => ({
      deductions: [],
      deductionTypes: [
        { id: 'pension', name: 'Pension Contribution', rate: 8, maxAmount: null },
        { id: 'nhf', name: 'NHF Contribution', rate: 2.5, maxAmount: null },
        { id: 'nhis', name: 'NHIS Contribution', rate: 5, maxAmount: null },
        { id: 'life_insurance', name: 'Life Insurance', rate: null, maxAmount: null },
        { id: 'gratuity', name: 'Gratuity', rate: null, maxAmount: null }
      ],
      isLoading: false,
      error: null,

      setDeductions: (deductions) => set({ deductions }),
      
      addDeduction: (deduction) => set((state) => {
        const id = deduction.id || `ded_${Date.now()}`;
        if (state.deductions.some(d => d.id === id)) return state;
        return {
          deductions: [{ ...deduction, id, createdAt: deduction.createdAt || new Date().toISOString() }, ...state.deductions]
        };
      }),
      
      updateDeduction: (id, updates) => set((state) => ({
        deductions: state.deductions.map((d) => (d.id === id ? { ...d, ...updates } : d))
      })),
      
      removeDeduction: (id) => set((state) => ({
        deductions: state.deductions.filter((d) => d.id !== id)
      })),

      setDeductionTypes: (types) => set({ deductionTypes: types }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),

      getTotalDeductions: () => {
        const { deductions } = get();
        return deductions.reduce((sum, d) => sum + (d.amount || 0), 0);
      }
    }),
    {
      name: 'taxwise-deductions'
    }
  )
);

// ==================== REMINDERS STORE ====================

export const useRemindersStore = create(
  persist(
    (set, get) => ({
      reminders: [],
      isLoading: false,
      error: null,

      setReminders: (reminders) => set({ reminders }),
      
      addReminder: (reminder) => set((state) => {
        const id = reminder.id || `rem_${Date.now()}`;
        if (state.reminders.some(r => r.id === id)) return state;
        return {
          reminders: [{ ...reminder, id, status: reminder.status || 'active', createdAt: reminder.createdAt || new Date().toISOString() }, ...state.reminders]
        };
      }),
      
      updateReminder: (id, updates) => set((state) => ({
        reminders: state.reminders.map((r) => (r.id === id ? { ...r, ...updates } : r))
      })),
      
      removeReminder: (id) => set((state) => ({
        reminders: state.reminders.filter((r) => r.id !== id)
      })),

      markComplete: (id) => set((state) => ({
        reminders: state.reminders.map((r) => 
          r.id === id ? { ...r, status: 'completed', completedAt: new Date().toISOString() } : r
        )
      })),

      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),

      getUpcomingReminders: (days = 7) => {
        const { reminders } = get();
        const today = new Date();
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + days);

        return reminders.filter((r) => {
          const dueDate = new Date(r.due_date);
          return r.status === 'active' && dueDate >= today && dueDate <= futureDate;
        });
      },

      getOverdueReminders: () => {
        const { reminders } = get();
        const today = new Date();
        return reminders.filter((r) => {
          const dueDate = new Date(r.due_date);
          return r.status === 'active' && dueDate < today;
        });
      }
    }),
    {
      name: 'taxwise-reminders'
    }
  )
);

// ==================== BANK ACCOUNTS STORE ====================

export const useBankStore = create(
  persist(
    (set, get) => ({
      accounts: [],
      transactions: [],
      isConnecting: false,
      lastSync: null,
      error: null,

      setAccounts: (accounts) => set({ accounts }),
      
      addAccount: (account) => set((state) => {
        const id = account.id || `acc_${Date.now()}`;
        if (state.accounts.some(a => a.id === id)) return state;
        return { accounts: [...state.accounts, { ...account, id, connectedAt: account.connectedAt || new Date().toISOString() }] };
      }),
      
      updateAccount: (id, updates) => set((state) => ({
        accounts: state.accounts.map((a) => (a.id === id ? { ...a, ...updates } : a))
      })),
      
      removeAccount: (id) => set((state) => ({
        accounts: state.accounts.filter((a) => a.id !== id)
      })),

      setTransactions: (transactions) => set({ transactions }),
      
      addTransactions: (newTransactions) => set((state) => {
        const existingIds = new Set(state.transactions.map(t => t.id));
        const unique = newTransactions.filter(t => !existingIds.has(t.id));
        return { transactions: [...unique, ...state.transactions] };
      }),

      setConnecting: (isConnecting) => set({ isConnecting }),
      setLastSync: (lastSync) => set({ lastSync }),
      setError: (error) => set({ error }),

      getTotalBalance: () => {
        const { accounts } = get();
        return accounts.reduce((sum, a) => sum + (a.balance || 0), 0);
      }
    }),
    {
      name: 'taxwise-bank'
    }
  )
);

// ==================== DASHBOARD STORE ====================

export const useDashboardStore = create((set) => ({
  stats: {
    totalIncome: 0,
    totalExpenses: 0,
    netCashFlow: 0,
    bankBalance: 0,
    pendingDeductions: 0,
    netTaxable: 0,
    taxSummary: [],
    pendingReminders: 0
  },
  isLoading: false,
  error: null,
  dateRange: {
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  },

  setStats: (stats) => set((state) => ({ stats: { ...state.stats, ...stats } })),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  setDateRange: (dateRange) => set({ dateRange })
}));

// ==================== SETTINGS STORE ====================

export const useSettingsStore = create(
  persist(
    (set) => ({
      general: {
        language: 'en',
        currency: 'NGN',
        dateFormat: 'DD/MM/YYYY',
        fiscalYearStart: 1,
        timezone: 'Africa/Lagos'
      },
      notifications: {
        emailReminders: true,
        pushNotifications: true,
        reminderDays: 7,
        weeklyReport: false,
        monthlyReport: true
      },
      integrations: {
        autoBankTrackingEnabled: false,
        autoBankTrackingAccountId: null,
        openaiEnabled: true,
        paystackEnabled: false
      },
      display: {
        compactMode: false,
        showTaxTips: true,
        defaultDashboardPeriod: 'month'
      },

      updateGeneral: (updates) => set((state) => ({
        general: { ...state.general, ...updates }
      })),

      updateNotifications: (updates) => set((state) => ({
        notifications: { ...state.notifications, ...updates }
      })),

      updateIntegrations: (updates) => set((state) => ({
        integrations: { ...state.integrations, ...updates }
      })),

      updateDisplay: (updates) => set((state) => ({
        display: { ...state.display, ...updates }
      })),

      resetSettings: () => set({
        general: {
          language: 'en',
          currency: 'NGN',
          dateFormat: 'DD/MM/YYYY',
          fiscalYearStart: 1,
          timezone: 'Africa/Lagos'
        },
        notifications: {
          emailReminders: true,
          pushNotifications: true,
          reminderDays: 7,
          weeklyReport: false,
          monthlyReport: true
        },
        integrations: {
          autoBankTrackingEnabled: false,
          autoBankTrackingAccountId: null,
          openaiEnabled: true,
          paystackEnabled: false
        },
        display: {
          compactMode: false,
          showTaxTips: true,
          defaultDashboardPeriod: 'month'
        }
      })
    }),
    {
      name: 'taxwise-settings'
    }
  )
);

// ==================== DOCUMENTS STORE ====================

export const useDocumentsStore = create(
  persist(
    (set, get) => ({
      documents: [],
      
      setDocuments: (documents) => set({ documents }),
      
      addDocument: (document) => set((state) => {
        if (document.id && state.documents.some(d => d.id === document.id)) return state;
        return { documents: [document, ...state.documents] };
      }),
      
      updateDocument: (id, updates) => set((state) => ({
        documents: state.documents.map(doc => 
          doc.id === id ? { ...doc, ...updates } : doc
        )
      })),
      
      removeDocument: (id) => set((state) => ({
        documents: state.documents.filter(doc => doc.id !== id)
      })),
      
      getDocumentById: (id) => {
        return get().documents.find(doc => doc.id === id);
      },
      
      getDocumentsByType: (type) => {
        return get().documents.filter(doc => doc.type === type);
      },
      
      getProcessedDocuments: () => {
        return get().documents.filter(doc => doc.status === 'processed');
      },
      
      clearDocuments: () => set({ documents: [] })
    }),
    {
      name: 'taxwise-documents',
      partialize: (state) => ({
        // Only persist document metadata, not the file objects
        documents: state.documents.map(({ file, ...rest }) => rest)
      })
    }
  )
);

export default {
  useAuthStore,
  useTeamStore,
  useFeaturesStore,
  useUIStore,
  useEntriesStore,
  usePOSStore,
  useTaxStore,
  useDeductionsStore,
  useRemindersStore,
  useBankStore,
  useDashboardStore,
  useSettingsStore,
  useDocumentsStore
};
