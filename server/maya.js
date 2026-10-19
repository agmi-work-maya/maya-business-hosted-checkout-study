const baseUrl = () => process.env.MAYA_BASE_URL || 'https://pg-sandbox.paymaya.com';

export class MayaError extends Error {
  constructor(status, body) {
    super(body?.message || body?.error || `Maya request failed (${status})`);
    this.status = status;
    this.body = body;
  }
}

async function request(method, path, key, body) {
  if (!key) throw new Error('Maya API key is not set');

  const res = await fetch(baseUrl() + path, {
    method,
    headers: {
      // Basic auth: API key as username, empty password
      Authorization: 'Basic ' + Buffer.from(`${key}:`).toString('base64'),
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) throw new MayaError(res.status, data);
  return data;
}

// POST /checkout/v1/checkouts (public key) — https://developers.maya.ph/reference/createv1checkout
// Returns { checkoutId, redirectUrl }
export function createCheckout(payload) {
  return request('POST', '/checkout/v1/checkouts', process.env.MAYA_PUBLIC_KEY, payload);
}

// GET /checkout/v1/checkouts/:id (secret key)
export function getCheckout(id) {
  return request('GET', `/checkout/v1/checkouts/${encodeURIComponent(id)}`, process.env.MAYA_SECRET_KEY);
}
