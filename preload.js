const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close')
  },

  // Database operations
  db: {
    query: (sql, params) => ipcRenderer.invoke('db:query', { sql, params }),
    run: (sql, params) => ipcRenderer.invoke('db:run', { sql, params }),
    get: (sql, params) => ipcRenderer.invoke('db:get', { sql, params }),
    all: (sql, params) => ipcRenderer.invoke('db:all', { sql, params })
  },

  // File operations
  file: {
    save: (options) => ipcRenderer.invoke('file:save', options),
    saveBuffer: (options) => ipcRenderer.invoke('file:saveBuffer', options),
    open: (options) => ipcRenderer.invoke('file:open', options)
  },

  // Shell operations
  shell: {
    openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
    openPath: (path) => ipcRenderer.invoke('shell:openPath', path)
  },

  // App info
  app: {
    getVersion: () => ipcRenderer.invoke('app:getVersion'),
    getPath: (name) => ipcRenderer.invoke('app:getPath', name)
  },

  // Deep link handler (taxwise:// protocol — used for auth callbacks)
  onDeepLink: (callback) => {
    ipcRenderer.on('deep-link', (event, url) => callback(url));
  },

  // Secure store operations
  store: {
    get: (key) => ipcRenderer.invoke('store:get', key),
    set: (key, value) => ipcRenderer.invoke('store:set', { key, value }),
    delete: (key) => ipcRenderer.invoke('store:delete', key),
    clear: () => ipcRenderer.invoke('store:clear')
  },

  // Secure AI/OpenAI operations (keys never exposed to renderer)
  ai: {
    hasApiKey: () => ipcRenderer.invoke('ai:hasApiKey'),
    setApiKey: (apiKey) => ipcRenderer.invoke('ai:setApiKey', apiKey),
    removeApiKey: () => ipcRenderer.invoke('ai:removeApiKey'),
    extractDocument: (options) => ipcRenderer.invoke('ai:extractDocument', options),
    getUsage: () => ipcRenderer.invoke('ai:getUsage')
  },

  // Secure Supabase operations
  supabase: {
    hasCredentials: () => ipcRenderer.invoke('supabase:hasCredentials'),
    setCredentials: (credentials) => ipcRenderer.invoke('supabase:setCredentials', credentials),
    removeCredentials: () => ipcRenderer.invoke('supabase:removeCredentials'),
    auth: {
      signIn: (email, password) => ipcRenderer.invoke('supabase:signIn', { email, password }),
      signUp: (email, password, metadata) => ipcRenderer.invoke('supabase:signUp', { email, password, metadata }),
      signOut: () => ipcRenderer.invoke('supabase:signOut'),
      getUser: () => ipcRenderer.invoke('supabase:getUser'),
      resetPassword: (email) => ipcRenderer.invoke('supabase:resetPassword', email)
    },
    db: {
      select: (table, query) => ipcRenderer.invoke('supabase:select', { table, query }),
      insert: (table, data) => ipcRenderer.invoke('supabase:insert', { table, data }),
      update: (table, data, match) => ipcRenderer.invoke('supabase:update', { table, data, match }),
      delete: (table, match) => ipcRenderer.invoke('supabase:delete', { table, match })
    }
  },

  // Payment popup — opens Paystack checkout in a child BrowserWindow
  payment: {
    openPopup: (authorizationUrl) => ipcRenderer.invoke('payment:openPopup', { authorizationUrl }),
  },

  // Auto-update controls
  updates: {
    // Listen for events from main process
    onUpdateAvailable: (callback) => ipcRenderer.on('update-available', (_e, info) => callback(info)),
    onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', (_e, info) => callback(info)),
    // Actions
    check: () => ipcRenderer.invoke('updates:check'),
    install: () => ipcRenderer.invoke('updates:install')
  },

});
