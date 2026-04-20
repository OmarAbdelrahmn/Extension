'use strict';

/**
 * Content Script — API Relay
 * ─────────────────────────────────────────────────────────────────────────────
 * This script is injected into every tab at sa.me.logisticsbackoffice.com/*.
 * Because it runs inside the website's page context, every fetch() it makes
 * is treated as a same-origin request by the browser — Cloudflare Access
 * cookies (CF_Authorization) and session cookies are sent automatically,
 * and there is no CORS overhead at all.
 *
 * The background service worker (background.js) finds this tab and forwards
 * API_FETCH messages here. The content script fetches the URL and sends the
 * result back through the message channel.
 * ─────────────────────────────────────────────────────────────────────────────
 */

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== 'API_FETCH') return false;

  fetch(message.url, { credentials: 'include' })
    .then(async res => {
      const ct = res.headers.get('content-type') || '';

      // Cloudflare Access redirects expired sessions to an HTML login page.
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

  // Keep the message channel open for the async response.
  return true;
});