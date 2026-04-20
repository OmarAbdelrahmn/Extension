'use strict';

const TOKEN_KEYS = [
  'rooster_dhh_token',
  'token',
  'access_token',
  'auth_token',
  'authToken',
  'jwt',
  'id_token',
  'bearer',
];

function findToken() {
  for (const key of TOKEN_KEYS) {
    const val = localStorage.getItem(key) || sessionStorage.getItem(key);
    if (val && val.length > 20) return val;
  }
  return null;
}

/** Generate W3C-compatible Sentry trace headers.
 *  The Cloudflare WAF custom rule checks for their presence.
 *  Values are randomly generated per-request (same format the Sentry SDK uses). */
function sentryHeaders() {
  const hex = len =>
    Array.from({ length: len }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('');

  const traceId    = hex(32);
  const spanId     = hex(16);
  const sampleRand = Math.random().toFixed(16);

  return {
    'sentry-trace': `${traceId}-${spanId}-0`,
    'baggage': [
      'sentry-environment=production',
      'sentry-release=v1.226.6-release',
      'sentry-public_key=bae9a64470a6472aaffcd3d3a7c40fb5',
      `sentry-trace_id=${traceId}`,
      'sentry-org_id=516780',
      'sentry-transaction=%2Flive-3pl',
      'sentry-sampled=false',
      `sentry-sample_rand=${sampleRand}`,
      'sentry-sample_rate=0.02',
    ].join(','),
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== 'API_FETCH') return false;

  const token = findToken();

  const headers = {
    'Accept':       'application/json',
    'Content-Type': 'application/json',
    ...sentryHeaders(),          // ← the missing piece
  };

  if (token) {
    headers['Authorization'] = token.startsWith('Bearer ')
      ? token
      : `Bearer ${token}`;
  }

  fetch(message.url, { credentials: 'include', headers })
    .then(async res => {
      const ct = res.headers.get('content-type') || '';

      if (ct.includes('text/html')) {
        sendResponse({ error: 'CF_AUTH', status: res.status });
        return;
      }

      if (!res.ok) {
        sendResponse({ error: `HTTP ${res.status}`, status: res.status });
        return;
      }

      try {
        const data = await res.json();
        sendResponse({ data });
      } catch (e) {
        sendResponse({ error: `JSON parse error: ${e.message}` });
      }
    })
    .catch(err => sendResponse({ error: err.message }));

  return true;
});