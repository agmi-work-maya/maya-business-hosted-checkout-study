import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { createCheckout, getCheckout, MayaError } from './maya.js';

const app = express();
const PORT = process.env.PORT || 3000;
const BASE = process.env.APP_BASE_URL || `http://localhost:${PORT}`;
const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');

// requestReferenceNumber -> { id, status } (demo only; use a database in production)
const checkouts = new Map();

app.use(express.json());
app.use(express.static(publicDir));

// Create a Maya checkout. Keys and redirect URLs stay on the server.
app.post('/api/checkouts', async (req, res) => {
  const { amount, currency = 'PHP', description = 'Test order', firstName, lastName, email, phone } = req.body ?? {};
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) {
    return res.status(400).json({ error: 'amount must be a positive number' });
  }

  const ref = `order-${crypto.randomUUID()}`;
  const redirect = (status) => `${BASE}/result.html?ref=${ref}&status=${status}`;
  const payload = {
    totalAmount: { value, currency },
    buyer: {
      firstName: firstName || 'Customer',
      ...(lastName ? { lastName } : {}),
      ...(phone || email ? { contact: { ...(phone ? { phone } : {}), ...(email ? { email } : {}) } } : {}),
    },
    items: [{
      name: description,
      quantity: 1,
      totalAmount: { value },
    }],
    redirectUrl: {
      success: redirect('success'),
      failure: redirect('failure'),
      cancel: redirect('cancel'),
    },
    requestReferenceNumber: ref,
  };

  try {
    const checkout = await createCheckout(payload);
    checkouts.set(ref, { id: checkout.checkoutId, status: 'PENDING' });
    res.status(201).json({ reference: ref, checkout, redirect_url: checkout.redirectUrl ?? null });
  } catch (err) {
    if (err instanceof MayaError) return res.status(err.status).json({ error: err.message, details: err.body });
    console.error(err);
    res.status(500).json({ error: 'Internal error' });
  }
});

// Authoritative checkout status, fetched from Maya (don't trust the return URL)
app.get('/api/checkouts/:ref', async (req, res) => {
  const local = checkouts.get(req.params.ref);
  if (!local) return res.status(404).json({ error: 'Not found' });
  try {
    const checkout = await getCheckout(local.id);
    local.status = checkout.paymentStatus || checkout.status || local.status;
    res.json({ reference: req.params.ref, status: local.status, checkout });
  } catch (err) {
    if (err instanceof MayaError) return res.status(err.status).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Internal error' });
  }
});

// Maya webhook receiver — register via Maya Manager or the Webhook API.
// Payloads are unsigned, so treat them as a hint and re-fetch status from Maya.
app.post('/webhooks/maya', async (req, res) => {
  const { requestReferenceNumber, status, paymentStatus } = req.body ?? {};
  console.log('webhook', requestReferenceNumber, paymentStatus || status);
  const local = checkouts.get(requestReferenceNumber);
  if (local) {
    try {
      const c = await getCheckout(local.id);
      local.status = c.paymentStatus || c.status || local.status;
    } catch (err) {
      console.error('webhook status refresh failed', err.message);
    }
  }
  res.status(200).end();
});

app.listen(PORT, () => console.log(`Listening on ${BASE}`));
