import { STORAGE_KEYS } from './constants.js';

function get(keys) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(keys, (result) => {
      if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
      else resolve(result);
    });
  });
}

function set(items) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(items, () => {
      if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
      else resolve();
    });
  });
}

// --- Settings ---
export async function getSettings() {
  const result = await get(STORAGE_KEYS.SETTINGS);
  return result[STORAGE_KEYS.SETTINGS] || {
    provider: 'anthropic',
    model: 'claude-sonnet-4-6',
    autoApply: true,
  };
}

export async function saveSettings(settings) {
  await set({ [STORAGE_KEYS.SETTINGS]: settings });
}

// --- API Keys ---
export async function getKeys() {
  const result = await get(STORAGE_KEYS.KEYS);
  return result[STORAGE_KEYS.KEYS] || {};
}

export async function saveKey(provider, key) {
  const keys = await getKeys();
  keys[provider] = key;
  await set({ [STORAGE_KEYS.KEYS]: keys });
}

export async function deleteKey(provider) {
  const keys = await getKeys();
  delete keys[provider];
  await set({ [STORAGE_KEYS.KEYS]: keys });
}

// --- Site Designs ---
export async function getSites() {
  const result = await get(STORAGE_KEYS.SITES);
  return result[STORAGE_KEYS.SITES] || {};
}

export async function getSiteDesign(domain) {
  const sites = await getSites();
  return sites[domain] || null;
}

export async function saveSiteDesign(domain, design) {
  const sites = await getSites();
  sites[domain] = {
    ...design,
    lastModified: Date.now(),
    cssVersion: ((sites[domain] || {}).cssVersion || 0) + 1,
  };
  await set({ [STORAGE_KEYS.SITES]: sites });
}

export async function toggleSiteEnabled(domain, enabled) {
  const sites = await getSites();
  if (!sites[domain]) sites[domain] = { enabled, css: null, cssVersion: 0 };
  else sites[domain].enabled = enabled;
  await set({ [STORAGE_KEYS.SITES]: sites });
}

export async function deleteSiteDesign(domain) {
  const sites = await getSites();
  delete sites[domain];
  await set({ [STORAGE_KEYS.SITES]: sites });
}