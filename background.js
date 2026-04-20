'use strict';

/**
 * Background Service Worker — Message Router
 * ─────────────────────────────────────────────────────────────────────────────
 * Receives API_FETCH requests from the dashboard page and routes them to the
 * content script running inside a sa.me.logisticsbackoffice.com tab.
 *
 * WHY NOT FETCH DIRECTLY FROM HERE?
 * Background service workers are cross-origin from the website. Cloudflare
 * Access validates the CF_Authorization cookie together with the request origin.
 * A service-worker fetch appears as cross-origin and gets rejected (403) even
 * when cookies are present. A content script fetch, by contrast, runs inside
 * the website's origin context and is treated as same-origin — Cloudflare
 * passes it through without any CORS check.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const SITE_ORIGIN = 'https://sa.me.logisticsbackoffice.com/*';

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== 'API_FETCH') return false;

  chrome.tabs.query({ url: SITE_ORIGIN }, tabs => {
    // ── No website tab open ──────────────────────────────────────────────────
    if (!tabs || tabs.length === 0) {
      sendResponse({
        error: 'NO_TAB',
        message: 'يرجى فتح الموقع https://sa.me.logisticsbackoffice.com في أحد التبويبات أولاً',
      });
      return;
    }

    // Prefer a tab that has already loaded (status === 'complete')
    const target = tabs.find(t => t.status === 'complete') || tabs[0];

    chrome.tabs.sendMessage(target.id, message, response => {
      if (chrome.runtime.lastError) {
        // Content script not yet injected in this tab (e.g. page still loading).
        // Try injecting it programmatically and retrying once.
        chrome.scripting.executeScript(
          { target: { tabId: target.id }, files: ['content.js'] },
          () => {
            if (chrome.runtime.lastError) {
              sendResponse({ error: `Script inject failed: ${chrome.runtime.lastError.message}` });
              return;
            }
            // Retry after a short delay to let the script initialise
            setTimeout(() => {
              chrome.tabs.sendMessage(target.id, message, response2 => {
                if (chrome.runtime.lastError) {
                  sendResponse({ error: chrome.runtime.lastError.message });
                } else {
                  sendResponse(response2);
                }
              });
            }, 300);
          }
        );
      } else {
        sendResponse(response);
      }
    });
  });

  // Keep the channel open for the async response.
  return true;
});