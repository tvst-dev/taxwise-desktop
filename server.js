/**
 * TaxWise — Paystack Payment Proxy Server
 * Runs on port 5555 inside the Electron app (main process).
 * Secret key is NEVER exposed to the renderer/frontend.
 */
const path = require('path');

// Load .env — in packaged app, DOTENV_PATH is set by main.js to process.resourcesPath/.env
require('dotenv').config({
  path: process.env.DOTENV_PATH || path.join(__dirname, '.env'),
});

const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;

// Callback URL that Paystack redirects to after payment.
// main.js intercepts navigations to this host to extract the payment reference.
const CALLBACK_URL = 'http://localhost:52731';

app.post('/api/init-transaction', async (req, res) => {
  try {
    const { email, amount, metadata, channels } = req.body;
    const response = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        email,
        amount,
        metadata: metadata || {},
        channels: channels || ['card', 'bank_transfer'],
        callback_url: CALLBACK_URL,
      },
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET}`,
          'Content-Type': 'application/json',
        },
      }
    );
    return res.json({
      status: true,
      authUrl: response.data.data.authorization_url,
      accessCode: response.data.data.access_code,
      reference: response.data.data.reference,
    });
  } catch (err) {
    console.error('[paystack] init-transaction error:', err.response?.data || err.message);
    return res.status(500).json({ status: false, error: err.response?.data?.message || err.message });
  }
});

app.get('/api/verify/:reference', async (req, res) => {
  try {
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${req.params.reference}`,
      {
        headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` },
      }
    );
    return res.json(response.data);
  } catch (err) {
    console.error('[paystack] verify error:', err.response?.data || err.message);
    return res.status(500).json({ status: false, error: err.response?.data?.message || err.message });
  }
});

app.post('/api/subscribe', async (req, res) => {
  try {
    const { email, plan } = req.body;
    const response = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      { email, plan, channels: ['card'] },
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET}`,
          'Content-Type': 'application/json',
        },
      }
    );
    return res.json({ authUrl: response.data.data.authorization_url });
  } catch (err) {
    console.error('[paystack] subscribe error:', err.response?.data || err.message);
    return res.status(500).json({ status: false, error: err.response?.data?.message || err.message });
  }
});

app.listen(5555, () => console.log('[paystack-server] Running on port 5555'));

module.exports = app;
