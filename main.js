const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');

// Disable GPU acceleration to prevent GPU process errors on some Windows machines
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');

// Register taxwise:// as a custom URL protocol (for auth deep links)
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('taxwise', process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient('taxwise');
}

// Windows: enforce single instance so deep links open the existing window
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

// Database and services
let db = null;
let mainWindow = null;
let SQL = null;
let dbPath = null;
let pendingDeepLink = null;

// Determine if we're in development
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// Extract taxwise:// URL from command line args (Windows startup with deep link)
function extractDeepLinkUrl(argv) {
  return argv.find(arg => arg.startsWith('taxwise://')) || null;
}

// Send deep link to renderer — queue if window not ready yet
function sendDeepLink(url) {
  if (!url) return;
  if (mainWindow?.webContents) {
    mainWindow.webContents.send('deep-link', url);
  } else {
    pendingDeepLink = url;
  }
}

// Windows: second instance opened via deep link
app.on('second-instance', (event, commandLine) => {
  const url = extractDeepLinkUrl(commandLine);
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
    sendDeepLink(url);
  }
});

// macOS: deep link while app is already running
app.on('open-url', (event, url) => {
  event.preventDefault();
  sendDeepLink(url);
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      enableRemoteModule: false,
      nodeIntegration: false,
      webSecurity: true
    },
    icon: path.join(__dirname, 'src/assets/icon.svg'),
    backgroundColor: '#0D1117',
    show: false
  });

  // Load the app
  if (isDev) {
    mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
  }

  // Show window when ready; flush any deep link that arrived before window was ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    // Check if app was launched via deep link (Windows: URL in argv)
    const startupUrl = extractDeepLinkUrl(process.argv);
    if (startupUrl) sendDeepLink(startupUrl);
    // Flush any deep link that came in before the window was ready
    if (pendingDeepLink) {
      setTimeout(() => sendDeepLink(pendingDeepLink), 1000);
      pendingDeepLink = null;
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Initialize database using sql.js (pure JavaScript SQLite - no native compilation needed)
async function initializeDatabase() {
  const initSqlJs = require('sql.js');
  
  // Initialize SQL.js - it will find the WASM file automatically
  SQL = await initSqlJs();

  // Database file path
  dbPath = isDev 
    ? path.join(__dirname, 'database/taxwise.db')
    : path.join(app.getPath('userData'), 'taxwise.db');

  // Ensure directory exists
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  // Load existing database or create new one
  try {
    if (fs.existsSync(dbPath)) {
      const fileBuffer = fs.readFileSync(dbPath);
      db = new SQL.Database(fileBuffer);
      console.log('Database loaded from file:', dbPath);
    } else {
      db = new SQL.Database();
      console.log('New database created');
    }
  } catch (error) {
    console.error('Error loading database:', error);
    db = new SQL.Database();
  }

  // Create tables from schema
  const schemaPath = isDev
    ? path.join(__dirname, 'database/schema.sql')
    : path.join(process.resourcesPath, 'database/schema.sql');

  if (fs.existsSync(schemaPath)) {
    try {
      const schema = fs.readFileSync(schemaPath, 'utf-8');
      // Execute schema statements one by one
      const statements = schema.split(';').filter(s => s.trim());
      for (const stmt of statements) {
        try {
          db.run(stmt + ';');
        } catch (e) {
          // Ignore "table already exists" errors
          if (!e.message.includes('already exists')) {
            console.log('Schema statement error:', e.message);
          }
        }
      }
      console.log('Schema executed successfully');
    } catch (error) {
      console.log('Schema error:', error.message);
    }
  }

  // Save database periodically
  setInterval(() => saveDatabase(), 30000);

  return db;
}

// Save database to file
function saveDatabase() {
  if (db && dbPath) {
    try {
      const data = db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(dbPath, buffer);
      console.log('Database saved');
    } catch (error) {
      console.error('Error saving database:', error);
    }
  }
}

// App lifecycle
app.whenReady().then(async () => {
  // Paystack's button.min.css returns text/html — override Content-Type so
  // Electron's strict MIME checker accepts it without errors
  const { session } = require('electron');
  session.defaultSession.webRequest.onHeadersReceived(
    { urls: ['https://paystack.com/public/css/button.min.css'] },
    (details, callback) => {
      const headers = { ...details.responseHeaders };
      headers['content-type'] = ['text/css'];
      callback({ responseHeaders: headers });
    }
  );

  await initializeDatabase();
  createWindow();

  // Auto-update: only in packaged builds, not dev
  if (app.isPackaged) {
    // Configure logger for update diagnostics
    autoUpdater.logger = {
      info: (msg) => console.log('[updater]', msg),
      warn: (msg) => console.warn('[updater]', msg),
      error: (msg) => console.error('[updater]', msg)
    };

    autoUpdater.on('update-available', (info) => {
      console.log('[updater] Update available:', info.version);
      mainWindow?.webContents.send('update-available', { version: info.version });
    });

    autoUpdater.on('update-downloaded', (info) => {
      console.log('[updater] Update downloaded:', info.version);
      mainWindow?.webContents.send('update-downloaded', { version: info.version });
    });

    autoUpdater.on('error', (err) => {
      console.error('[updater] Error:', err.message);
    });

    // Check for update silently shortly after launch
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch((err) => {
        console.warn('[updater] Check failed:', err.message);
      });
    }, 5000);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// IPC: open Paystack payment popup — works with all card types worldwide
// Intercepts Paystack's redirect to our local callback URL to capture the reference
const PAYMENT_CALLBACK_HOST = 'localhost:52731';

ipcMain.handle('payment:openPopup', async (event, { authorizationUrl }) => {
  return new Promise((resolve) => {
    const payWin = new BrowserWindow({
      width: 500,
      height: 680,
      modal: true,
      parent: mainWindow,
      webPreferences: { nodeIntegration: false, contextIsolation: true },
      title: 'TaxWise — Secure Payment',
      resizable: false,
      minimizable: false,
      maximizable: false,
      autoHideMenuBar: true,
    });

    payWin.loadURL(authorizationUrl);

    let settled = false;
    const settle = (result) => {
      if (settled) return;
      settled = true;
      if (!payWin.isDestroyed()) payWin.destroy();
      resolve(result);
    };

    // Paystack redirects to callback_url after payment — intercept before it tries to load
    payWin.webContents.on('will-redirect', (e, url) => {
      if (url.includes(PAYMENT_CALLBACK_HOST)) {
        e.preventDefault();
        try {
          const u = new URL(url);
          const reference = u.searchParams.get('reference') || u.searchParams.get('trxref');
          settle({ success: true, reference });
        } catch { settle({ success: false, error: 'Invalid payment callback' }); }
      }
    });

    // Fallback: catches navigation that didn't trigger will-redirect
    payWin.webContents.on('did-navigate', (_, url) => {
      if (url.includes(PAYMENT_CALLBACK_HOST)) {
        try {
          const u = new URL(url);
          const reference = u.searchParams.get('reference') || u.searchParams.get('trxref');
          if (reference) settle({ success: true, reference });
        } catch {}
      }
    });

    // User closed the window manually
    payWin.on('closed', () => settle({ success: false, error: 'Payment cancelled' }));
  });
});

// IPC: manual update check from renderer
ipcMain.handle('updates:check', async () => {
  if (!app.isPackaged) return { available: false, message: 'Dev mode — updates disabled' };
  try {
    const result = await autoUpdater.checkForUpdates();
    return { available: !!result };
  } catch (err) {
    return { available: false, error: err.message };
  }
});

// IPC: install downloaded update (quits and relaunches)
ipcMain.handle('updates:install', () => {
  autoUpdater.quitAndInstall(false, true);
});

app.on('window-all-closed', () => {
  saveDatabase();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  saveDatabase();
});

// ==================== IPC HANDLERS ====================

// Window controls
ipcMain.handle('window:minimize', () => {
  mainWindow?.minimize();
});

ipcMain.handle('window:maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});

ipcMain.handle('window:close', () => {
  mainWindow?.close();
});

// Database operations
ipcMain.handle('db:query', async (event, { sql, params }) => {
  try {
    const isSelect = sql.trim().toUpperCase().startsWith('SELECT');
    
    if (isSelect) {
      const stmt = db.prepare(sql);
      if (params && params.length > 0) {
        stmt.bind(params);
      }
      
      const results = [];
      while (stmt.step()) {
        const row = stmt.getAsObject();
        results.push(row);
      }
      stmt.free();
      
      return { success: true, data: results };
    } else {
      if (params && params.length > 0) {
        db.run(sql, params);
      } else {
        db.run(sql);
      }
      
      // Get last insert ID and changes
      const lastIdResult = db.exec("SELECT last_insert_rowid()");
      const lastId = lastIdResult[0]?.values[0]?.[0] || 0;
      const changes = db.getRowsModified();
      
      // Save after modifications
      saveDatabase();
      
      return { success: true, data: { lastInsertRowid: lastId, changes } };
    }
  } catch (error) {
    console.error('Database error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db:run', async (event, { sql, params }) => {
  try {
    if (params && params.length > 0) {
      db.run(sql, params);
    } else {
      db.run(sql);
    }
    
    const lastIdResult = db.exec("SELECT last_insert_rowid()");
    const lastId = lastIdResult[0]?.values[0]?.[0] || 0;
    const changes = db.getRowsModified();
    
    saveDatabase();
    
    return { success: true, data: { lastInsertRowid: lastId, changes } };
  } catch (error) {
    console.error('Database error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db:get', async (event, { sql, params }) => {
  try {
    const stmt = db.prepare(sql);
    if (params && params.length > 0) {
      stmt.bind(params);
    }
    
    let result = null;
    if (stmt.step()) {
      result = stmt.getAsObject();
    }
    stmt.free();
    
    return { success: true, data: result };
  } catch (error) {
    console.error('Database error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db:all', async (event, { sql, params }) => {
  try {
    const stmt = db.prepare(sql);
    if (params && params.length > 0) {
      stmt.bind(params);
    }
    
    const results = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    
    return { success: true, data: results };
  } catch (error) {
    console.error('Database error:', error);
    return { success: false, error: error.message };
  }
});

// File operations
ipcMain.handle('file:save', async (event, { defaultPath, filters, content, encoding }) => {
  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath,
      filters: filters || [{ name: 'All Files', extensions: ['*'] }]
    });

    if (!result.canceled && result.filePath) {
      fs.writeFileSync(result.filePath, content, encoding || 'utf-8');
      return { success: true, filePath: result.filePath };
    }
    return { success: false, canceled: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('file:open', async (event, { filters, multiple }) => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      filters: filters || [{ name: 'All Files', extensions: ['*'] }],
      properties: multiple ? ['openFile', 'multiSelections'] : ['openFile']
    });

    if (!result.canceled && result.filePaths.length > 0) {
      const files = result.filePaths.map(filePath => ({
        path: filePath,
        name: path.basename(filePath),
        content: fs.readFileSync(filePath)
      }));
      return { success: true, files };
    }
    return { success: false, canceled: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('file:saveBuffer', async (event, { defaultPath, filters, buffer }) => {
  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath,
      filters: filters || [{ name: 'All Files', extensions: ['*'] }]
    });

    if (!result.canceled && result.filePath) {
      fs.writeFileSync(result.filePath, Buffer.from(buffer));
      return { success: true, filePath: result.filePath };
    }
    return { success: false, canceled: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Shell operations
ipcMain.handle('shell:openExternal', async (event, url) => {
  await shell.openExternal(url);
});

ipcMain.handle('shell:openPath', async (event, filePath) => {
  await shell.openPath(filePath);
});

// App info
ipcMain.handle('app:getVersion', () => {
  return app.getVersion();
});

ipcMain.handle('app:getPath', (event, name) => {
  return app.getPath(name);
});

// Store operations (for settings)
const Store = require('electron-store');
const store = new Store({
  name: 'taxwise-settings',
  encryptionKey: 'taxwise-secure-key-2024'
});

ipcMain.handle('store:get', (event, key) => {
  return store.get(key);
});

ipcMain.handle('store:set', (event, { key, value }) => {
  store.set(key, value);
  return true;
});

ipcMain.handle('store:delete', (event, key) => {
  store.delete(key);
  return true;
});

ipcMain.handle('store:clear', () => {
  store.clear();
  return true;
});

// ==================== SECURE OPENAI HANDLERS ====================
// All OpenAI API calls are made from main process for security
// API key is stored encrypted and never sent to renderer

const https = require('https');

// Secure store specifically for API keys (separate from regular settings)
const secureStore = new Store({
  name: 'taxwise-secure',
  encryptionKey: 'taxwise-api-secure-2024-ngn',
  clearInvalidConfig: true
});

// Validate OpenAI API key format
function isValidOpenAIKey(key) {
  return key && typeof key === 'string' && key.startsWith('sk-') && key.length > 20;
}

// Check if API key is configured
ipcMain.handle('ai:hasApiKey', () => {
  const key = secureStore.get('openai_api_key');
  return isValidOpenAIKey(key);
});

// Set API key (with validation)
ipcMain.handle('ai:setApiKey', async (event, apiKey) => {
  try {
    if (!isValidOpenAIKey(apiKey)) {
      return { success: false, error: 'Invalid API key format' };
    }

    // Validate key by making a simple API call
    const isValid = await validateOpenAIKey(apiKey);
    if (!isValid.success) {
      return { success: false, error: isValid.error || 'Invalid API key' };
    }

    // Store encrypted
    secureStore.set('openai_api_key', apiKey);
    console.log('OpenAI API key stored securely');
    return { success: true };
  } catch (error) {
    console.error('Error setting API key:', error);
    return { success: false, error: error.message };
  }
});

// Remove API key
ipcMain.handle('ai:removeApiKey', () => {
  secureStore.delete('openai_api_key');
  return { success: true };
});

// Validate OpenAI API key
async function validateOpenAIKey(apiKey) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'api.openai.com',
      path: '/v1/models',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    };

    const req = https.request(options, (res) => {
      if (res.statusCode === 200) {
        resolve({ success: true });
      } else if (res.statusCode === 401) {
        resolve({ success: false, error: 'Invalid API key' });
      } else {
        resolve({ success: false, error: `API error: ${res.statusCode}` });
      }
    });

    req.on('error', (error) => {
      resolve({ success: false, error: error.message });
    });

    req.setTimeout(10000, () => {
      req.destroy();
      resolve({ success: false, error: 'Request timeout' });
    });

    req.end();
  });
}

// Extract data from document using OpenAI Vision
ipcMain.handle('ai:extractDocument', async (event, { imageBase64, mimeType, documentType }) => {
  try {
    const apiKey = secureStore.get('openai_api_key');
    if (!isValidOpenAIKey(apiKey)) {
      return { success: false, error: 'API key not configured' };
    }

    const systemPrompt = getExtractionPrompt(documentType);
    
    const requestBody = JSON.stringify({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${imageBase64}`,
                detail: 'high'
              }
            },
            {
              type: 'text',
              text: 'Please extract all relevant information from this document and return it in the specified JSON format.'
            }
          ]
        }
      ],
      max_tokens: 2000,
      temperature: 0.1
    });

    const result = await makeOpenAIRequest('/v1/chat/completions', requestBody, apiKey);
    
    if (!result.success) {
      return result;
    }

    // Parse the response
    const content = result.data.choices[0]?.message?.content;
    if (!content) {
      return { success: false, error: 'No response from AI' };
    }

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { success: false, error: 'Could not parse AI response' };
    }

    const extractedData = JSON.parse(jsonMatch[0]);
    return { 
      success: true, 
      data: extractedData,
      usage: result.data.usage
    };

  } catch (error) {
    console.error('Document extraction error:', error);
    return { success: false, error: error.message };
  }
});

// Get usage/billing info
ipcMain.handle('ai:getUsage', async () => {
  try {
    const apiKey = secureStore.get('openai_api_key');
    if (!isValidOpenAIKey(apiKey)) {
      return { success: false, error: 'API key not configured' };
    }
    
    // OpenAI doesn't provide direct usage API, return placeholder
    return { 
      success: true, 
      data: { 
        message: 'Check usage at platform.openai.com/usage' 
      } 
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Make OpenAI API request
function makeOpenAIRequest(path, body, apiKey) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'api.openai.com',
      path: path,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode === 200) {
            resolve({ success: true, data: parsed });
          } else {
            resolve({ 
              success: false, 
              error: parsed.error?.message || `API error: ${res.statusCode}` 
            });
          }
        } catch (e) {
          resolve({ success: false, error: 'Failed to parse response' });
        }
      });
    });

    req.on('error', (error) => {
      resolve({ success: false, error: error.message });
    });

    req.setTimeout(60000, () => {
      req.destroy();
      resolve({ success: false, error: 'Request timeout' });
    });

    req.write(body);
    req.end();
  });
}

// Get extraction prompt based on document type
function getExtractionPrompt(documentType) {
  const prompts = {
    invoice: `You are a document data extraction expert. Extract data from this Nigerian invoice/bill.
Return ONLY valid JSON with this structure:
{
  "document_type": "invoice",
  "vendor_name": "Company/Business name",
  "vendor_address": "Full address if visible",
  "vendor_tin": "Tax Identification Number if visible",
  "invoice_number": "Invoice/Receipt number",
  "invoice_date": "Date in YYYY-MM-DD format",
  "due_date": "Due date if visible in YYYY-MM-DD format",
  "currency": "NGN or other currency",
  "line_items": [
    {
      "description": "Item description",
      "quantity": 1,
      "unit_price": 0,
      "amount": 0,
      "vat_applicable": true
    }
  ],
  "subtotal": 0,
  "vat_amount": 0,
  "vat_rate": 7.5,
  "total_amount": 0,
  "payment_method": "Cash/Transfer/Card if visible",
  "notes": "Any additional notes",
  "confidence": 0.95
}
Use null for fields that cannot be determined. Amounts should be numbers without currency symbols.`,

    receipt: `You are a document data extraction expert. Extract data from this Nigerian receipt.
Return ONLY valid JSON with this structure:
{
  "document_type": "receipt",
  "vendor_name": "Store/Business name",
  "vendor_address": "Address if visible",
  "receipt_number": "Receipt number",
  "date": "Date in YYYY-MM-DD format",
  "time": "Time if visible",
  "currency": "NGN",
  "items": [
    {
      "description": "Item name",
      "quantity": 1,
      "unit_price": 0,
      "amount": 0
    }
  ],
  "subtotal": 0,
  "vat_amount": 0,
  "total_amount": 0,
  "payment_method": "Cash/Card/Transfer",
  "category": "groceries/utilities/transport/etc",
  "confidence": 0.95
}
Use null for fields that cannot be determined.`,

    payslip: `You are a document data extraction expert. Extract data from this Nigerian payslip/salary slip.
Return ONLY valid JSON with this structure:
{
  "document_type": "payslip",
  "employer_name": "Company name",
  "employer_tin": "Employer TIN if visible",
  "employee_name": "Employee name",
  "employee_id": "Staff ID if visible",
  "pay_period": "Month/Year or date range",
  "payment_date": "Date in YYYY-MM-DD format",
  "currency": "NGN",
  "earnings": {
    "basic_salary": 0,
    "housing_allowance": 0,
    "transport_allowance": 0,
    "meal_allowance": 0,
    "other_allowances": 0,
    "overtime": 0,
    "bonus": 0,
    "gross_pay": 0
  },
  "deductions": {
    "paye_tax": 0,
    "pension": 0,
    "nhf": 0,
    "nhis": 0,
    "loan_repayment": 0,
    "other_deductions": 0,
    "total_deductions": 0
  },
  "net_pay": 0,
  "ytd_gross": 0,
  "ytd_tax": 0,
  "confidence": 0.95
}
Use null or 0 for fields that cannot be determined.`,

    bank_statement: `You are a document data extraction expert. Extract data from this Nigerian bank statement.
Return ONLY valid JSON with this structure:
{
  "document_type": "bank_statement",
  "bank_name": "Bank name",
  "account_name": "Account holder name",
  "account_number": "Account number (last 4 digits only for security)",
  "statement_period": {
    "from": "YYYY-MM-DD",
    "to": "YYYY-MM-DD"
  },
  "currency": "NGN",
  "opening_balance": 0,
  "closing_balance": 0,
  "total_credits": 0,
  "total_debits": 0,
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "description": "Transaction description",
      "type": "credit/debit",
      "amount": 0,
      "balance": 0
    }
  ],
  "confidence": 0.95
}
Extract up to 20 most recent transactions. Use null for fields that cannot be determined.`,

    general: `You are a document data extraction expert. Extract all relevant financial data from this document.
Return ONLY valid JSON with this structure:
{
  "document_type": "identified type",
  "title": "Document title/header",
  "date": "Date in YYYY-MM-DD format",
  "currency": "NGN or other",
  "total_amount": 0,
  "vendor_customer": "Other party name",
  "reference_number": "Any reference number",
  "description": "Brief description of document",
  "line_items": [
    {
      "description": "Item/service",
      "amount": 0
    }
  ],
  "category": "suggested category",
  "entry_type": "income/expense",
  "vat_amount": 0,
  "notes": "Any important notes",
  "confidence": 0.95
}
Use null for fields that cannot be determined.`
  };

  return prompts[documentType] || prompts.general;
}
