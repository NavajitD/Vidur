import { MSG } from '../shared/message-types.js';
import { getSettings, getKeys, getSiteDesign, saveSiteDesign, toggleSiteEnabled, deleteSiteDesign } from '../shared/storage-schema.js';
import { routeToLLM }        from './llm-router.js';
import { fetchReferenceStyle } from './reference-fetcher.js';

// ─── Keepalive (prevents service worker from dying during long LLM calls) ────
chrome.alarms.create('vidur-keepalive', { periodInMinutes: 0.4 });
chrome.alarms.onAlarm.addListener(() => { /* no-op: just keeps SW alive */ });

// ─── On install: open options if no key is set ───────────────────────────────
chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason === 'install') {
    const keys = await getKeys();
    if (!Object.keys(keys).length) {
      chrome.runtime.openOptionsPage();
    }
  }
});

// ─── Apply saved design when a tab finishes loading ──────────────────────────
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') return;
  if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('about:')) return;

  const settings = await getSettings();
  if (!settings.autoApply) return;

  let domain;
  try { domain = new URL(tab.url).hostname; } catch { return; }

  const design = await getSiteDesign(domain);
  if (design?.enabled && design?.css) {
    chrome.tabs.sendMessage(tabId, { type: MSG.APPLY_CSS, css: design.css }).catch(() => {});
  }
});

// ─── Message handler ─────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // SECURITY: reject any message asking for keys
  if (message.type === 'GET_KEYS') {
    sendResponse({ type: MSG.ERROR, error: 'Forbidden' });
    return false;
  }

  handleMessage(message, sender)
    .then(result => sendResponse({ type: MSG.SUCCESS, ...result }))
    .catch(err => {
      const isAuth = err.message?.startsWith('AUTH_ERROR:');
      sendResponse({ type: MSG.ERROR, error: err.message, isAuthError: isAuth });
    });

  return true; // keep channel open for async response
});

async function handleMessage(message, sender) {
  switch (message.type) {

    case MSG.EXTRACT_AND_REDESIGN: {
      const { pageProfile, prompt, referenceUrl, domain } = message;

      const settings = await getSettings();
      const keys     = await getKeys();
      const apiKey   = keys[settings.provider];

      // Local providers (Ollama, LM Studio) don't need a key
      const localProviders = ['ollama', 'lmstudio'];
      if (!apiKey && !localProviders.includes(settings.provider)) {
        throw new Error('No API key set. Please open Vidur settings to add your key.');
      }

      let referenceStyle = null;
      if (referenceUrl) {
        referenceStyle = await fetchReferenceStyle(referenceUrl);
      }

      const css = await routeToLLM({
        provider:        settings.provider,
        model:           settings.model,
        apiKey,
        pageProfile,
        userInstruction: prompt,
        referenceStyle,
      });

      if (!css || css.length < 10) {
        throw new Error('The AI returned empty CSS. Try a more specific prompt.');
      }

      await saveSiteDesign(domain, {
        enabled:      true,
        css,
        promptUsed:   prompt,
        referenceUrl: referenceUrl || null,
      });

      // Push CSS to the calling tab
      const tabId = sender.tab?.id;
      if (tabId) {
        chrome.tabs.sendMessage(tabId, { type: MSG.APPLY_CSS, css }).catch(() => {});
      }

      return { css };
    }

    case MSG.GET_SAVED_DESIGN: {
      const design = await getSiteDesign(message.domain);
      return { design };
    }

    case MSG.TOGGLE_SITE: {
      const { domain, enabled } = message;
      await toggleSiteEnabled(domain, enabled);

      // Tell the tab to apply or clear
      const tabs = await chrome.tabs.query({ url: `*://${domain}/*` });
      for (const tab of tabs) {
        if (enabled) {
          const design = await getSiteDesign(domain);
          if (design?.css) {
            chrome.tabs.sendMessage(tab.id, { type: MSG.APPLY_CSS, css: design.css }).catch(() => {});
          }
        } else {
          chrome.tabs.sendMessage(tab.id, { type: MSG.CLEAR_CSS }).catch(() => {});
        }
      }
      return {};
    }

    case MSG.DELETE_DESIGN: {
      await deleteSiteDesign(message.domain);
      const tabs = await chrome.tabs.query({ url: `*://${message.domain}/*` });
      for (const tab of tabs) {
        chrome.tabs.sendMessage(tab.id, { type: MSG.CLEAR_CSS }).catch(() => {});
      }
      return {};
    }

    case MSG.GET_SITE_STATE: {
      const design = await getSiteDesign(message.domain);
      return { design };
    }

    default:
      throw new Error(`Unknown message type: ${message.type}`);
  }
}