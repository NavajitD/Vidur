import { MSG } from '../shared/message-types.js';
import { getKeys, getSiteDesign } from '../shared/storage-schema.js';

const $ = id => document.getElementById(id);

let currentDomain = null;
let currentDesign = null;

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.url || tab.url.startsWith('chrome://') || tab.url.startsWith('about:')) {
    showState('noKey');
    $('noKeyState').querySelector('p').textContent = 'Vidur cannot run on this page.';
    return;
  }

  try {
    currentDomain = new URL(tab.url).hostname;
  } catch {
    return;
  }

  // Check if any key is configured
  const keys = await getKeys();
  if (!Object.keys(keys).length) {
    showState('noKey');
    return;
  }

  $('domainLabel').textContent = currentDomain;
  showState('main');

  // Load existing design state
  currentDesign = await getSiteDesign(currentDomain);
  renderDesignState();

  // Wire up toggle
  const toggle = $('siteToggle');
  toggle.checked = currentDesign?.enabled ?? false;
  toggle.addEventListener('change', async () => {
    await chrome.runtime.sendMessage({
      type: MSG.TOGGLE_SITE,
      domain: currentDomain,
      enabled: toggle.checked,
    });
    currentDesign = await getSiteDesign(currentDomain);
    renderDesignState();
  });

  // Wire up redesign button
  $('redesignBtn').addEventListener('click', handleRedesign);

  // Wire up delete
  $('deleteDesign').addEventListener('click', handleDelete);

  // Settings buttons
  $('openSettings').addEventListener('click', () => chrome.runtime.openOptionsPage());
  $('goToSettings')?.addEventListener('click', () => chrome.runtime.openOptionsPage());
}

function showState(state) {
  $('noKeyState').classList.toggle('hidden', state !== 'noKey');
  $('mainState').classList.toggle('hidden',  state !== 'main');
}

function renderDesignState() {
  const hasDesign = currentDesign?.css;

  if (hasDesign) {
    $('existingDesign').classList.remove('hidden');
    $('savedPrompt').textContent = currentDesign.promptUsed || 'Custom design applied';
  } else {
    $('existingDesign').classList.add('hidden');
  }

  // Pre-fill prompt if there's a saved one
  if (currentDesign?.promptUsed && !$('promptInput').value) {
    $('promptInput').value = currentDesign.promptUsed;
  }
  if (currentDesign?.referenceUrl && !$('referenceUrl').value) {
    $('referenceUrl').value = currentDesign.referenceUrl || '';
  }
}

async function handleRedesign() {
  const prompt = $('promptInput').value.trim();
  if (!prompt) {
    showError('Please describe how you want the site redesigned.');
    return;
  }

  setLoading(true);
  clearError();

  try {
    // Extract page profile from the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const [{ result: pageProfile }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.__vidurExtractPageProfile?.() || '{}',
    });

    const res = await chrome.runtime.sendMessage({
      type:         MSG.EXTRACT_AND_REDESIGN,
      domain:       currentDomain,
      tabId:        tab.id,
      pageProfile:  pageProfile || '{}',
      prompt,
      referenceUrl: $('referenceUrl').value.trim() || null,
    });

    if (res.type === MSG.ERROR) {
      if (res.isAuthError) {
        showError('API key invalid. Please update it in Settings.');
      } else {
        showError(res.error || 'Something went wrong. Please try again.');
      }
      return;
    }

    // Refresh design state
    currentDesign = await getSiteDesign(currentDomain);
    $('siteToggle').checked = true;
    renderDesignState();

  } catch (err) {
    showError(err.message || 'Unexpected error. Please try again.');
  } finally {
    setLoading(false);
  }
}

async function handleDelete() {
  if (!confirm(`Remove Vidur design for ${currentDomain}?`)) return;

  await chrome.runtime.sendMessage({ type: MSG.DELETE_DESIGN, domain: currentDomain });
  currentDesign = null;
  $('siteToggle').checked = false;
  $('promptInput').value = '';
  $('referenceUrl').value = '';
  renderDesignState();
}

function setLoading(loading) {
  $('redesignBtn').disabled = loading;
  $('btnLabel').textContent = loading ? 'Redesigning…' : 'Redesign';
  $('btnSpinner').classList.toggle('hidden', !loading);
}

function showError(msg) {
  const el = $('errorMsg');
  el.textContent = msg;
  el.classList.remove('hidden');
}

function clearError() {
  $('errorMsg').classList.add('hidden');
}

init();