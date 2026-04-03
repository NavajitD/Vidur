import { PROVIDERS, DEFAULT_MODELS, PROVIDER_RECOMMENDED_MODELS } from '../shared/constants.js';
import { getKeys, saveKey, deleteKey, getSettings, saveSettings, getSites, deleteSiteDesign } from '../shared/storage-schema.js';

const $ = id => document.getElementById(id);

// ─── Initialise ──────────────────────────────────────────────────────────────
async function init() {
  const [keys, settings, sites] = await Promise.all([getKeys(), getSettings(), getSites()]);

  renderKeyStatuses(keys);
  renderProviderSelect(settings);
  renderModelSection(settings);
  renderSavedDesigns(sites);
  checkLocalProviders();

  $('autoApplyToggle').checked = settings.autoApply ?? true;

  // Key save/clear buttons
  document.querySelectorAll('.key-save-btn').forEach(btn => {
    btn.addEventListener('click', () => handleKeySave(btn.dataset.provider));
  });
  document.querySelectorAll('.key-clear-btn').forEach(btn => {
    btn.addEventListener('click', () => handleKeyClear(btn.dataset.provider));
  });
  document.querySelectorAll('.key-show-btn').forEach(btn => {
    btn.addEventListener('click', () => toggleKeyVisibility(btn.dataset.provider));
  });

  // Provider select change → update model suggestions
  $('providerSelect').addEventListener('change', () => {
    const p = $('providerSelect').value;
    $('modelInput').value = DEFAULT_MODELS[p] || '';
    renderModelSuggestions(p);
  });

  // Save settings
  $('saveSettings').addEventListener('click', handleSaveSettings);
}

// ─── Key management ──────────────────────────────────────────────────────────
function renderKeyStatuses(keys) {
  Object.keys(PROVIDERS).forEach(provider => {
    const el = document.querySelector(`.key-status[data-provider="${provider}"]`);
    if (!el) return;
    const hasKey = !!keys[provider];
    el.textContent = hasKey ? '● Key saved' : '○ No key';
    el.className = `key-status ${hasKey ? 'set' : 'missing'}`;

    // Pre-fill input with masked value if key exists
    const input = document.querySelector(`.key-input[data-provider="${provider}"]`);
    if (input && hasKey) {
      input.placeholder = '••••••••••••' + keys[provider].slice(-4);
    }
  });
}

async function handleKeySave(provider) {
  const input = document.querySelector(`.key-input[data-provider="${provider}"]`);
  const key = input?.value.trim();
  if (!key) return;

  await saveKey(provider, key);
  input.value = '';
  input.placeholder = '••••••••••••' + key.slice(-4);

  const statusEl = document.querySelector(`.key-status[data-provider="${provider}"]`);
  if (statusEl) {
    statusEl.textContent = '● Key saved';
    statusEl.className = 'key-status set';
  }

  // Auto-switch active provider if the current one has no key
  const [settings, allKeys] = await Promise.all([getSettings(), getKeys()]);
  if (!allKeys[settings.provider]) {
    const newSettings = { ...settings, provider, model: DEFAULT_MODELS[provider] || settings.model };
    await saveSettings(newSettings);
    $('providerSelect').value = provider;
    $('modelInput').value = newSettings.model;
    renderModelSuggestions(provider);
    flashConfirm(`Key saved · Active provider set to ${PROVIDERS[provider]?.label || provider}`);
  } else {
    flashConfirm(`Key saved for ${PROVIDERS[provider]?.label || provider}`);
  }
}

async function handleKeyClear(provider) {
  if (!confirm(`Remove API key for ${PROVIDERS[provider]?.label || provider}?`)) return;

  await deleteKey(provider);

  const input = document.querySelector(`.key-input[data-provider="${provider}"]`);
  if (input) {
    input.value = '';
    input.placeholder = getDefaultPlaceholder(provider);
  }

  const statusEl = document.querySelector(`.key-status[data-provider="${provider}"]`);
  if (statusEl) {
    statusEl.textContent = '○ No key';
    statusEl.className = 'key-status missing';
  }
}

function toggleKeyVisibility(provider) {
  const input = document.querySelector(`.key-input[data-provider="${provider}"]`);
  if (!input) return;
  input.type = input.type === 'password' ? 'text' : 'password';
}

function getDefaultPlaceholder(provider) {
  const map = {
    anthropic:  'sk-ant-…',
    openai:     'sk-…',
    gemini:     'AIza…',
    openrouter: 'sk-or-…',
    groq:       'gsk_…',
    together:   '…',
    cloudflare: 'accountId|apiToken',
  };
  return map[provider] || '…';
}

// ─── Provider & model ────────────────────────────────────────────────────────
function renderProviderSelect(settings) {
  const sel = $('providerSelect');
  sel.innerHTML = '';

  const groups = {
    'Proprietary':          ['anthropic', 'openai', 'gemini'],
    'Open Source · Cloud':  ['openrouter', 'groq', 'together', 'cloudflare'],
    'Local · No key':       ['ollama', 'lmstudio'],
  };

  for (const [groupLabel, providers] of Object.entries(groups)) {
    const og = document.createElement('optgroup');
    og.label = groupLabel;
    providers.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p;
      opt.textContent = PROVIDERS[p]?.label || p;
      opt.selected = p === settings.provider;
      og.appendChild(opt);
    });
    sel.appendChild(og);
  }
}

function renderModelSection(settings) {
  $('modelInput').value = settings.model || DEFAULT_MODELS[settings.provider] || '';
  renderModelSuggestions(settings.provider);
}

function renderModelSuggestions(provider) {
  const container = $('modelSuggestions');
  container.innerHTML = '';
  const models = PROVIDER_RECOMMENDED_MODELS[provider] || [];
  models.forEach(model => {
    const chip = document.createElement('button');
    chip.className = 'suggestion-chip';
    chip.textContent = model;
    chip.addEventListener('click', () => { $('modelInput').value = model; });
    container.appendChild(chip);
  });
}

async function handleSaveSettings() {
  const settings = {
    provider:  $('providerSelect').value,
    model:     $('modelInput').value.trim() || DEFAULT_MODELS[$('providerSelect').value],
    autoApply: $('autoApplyToggle').checked,
  };

  await saveSettings(settings);
  flashConfirm('Settings saved');
  renderModelSuggestions(settings.provider);
}

// ─── Saved designs ───────────────────────────────────────────────────────────
function renderSavedDesigns(sites) {
  const container = $('savedDesignsList');
  const entries = Object.entries(sites).filter(([, d]) => d.css);

  if (!entries.length) {
    container.innerHTML = '<p class="empty-state">No saved designs yet.</p>';
    return;
  }

  container.innerHTML = '';
  entries.forEach(([domain, design]) => {
    const item = document.createElement('div');
    item.className = 'design-item';

    const date = design.lastModified
      ? new Date(design.lastModified).toLocaleDateString()
      : '';

    item.innerHTML = `
      <div>
        <div class="design-domain">${escapeHtml(domain)}</div>
        <div class="design-info">${escapeHtml(design.promptUsed || 'Custom design')} · ${date}</div>
      </div>
      <div class="design-item-actions">
        <button class="btn btn-sm btn-danger" data-domain="${escapeHtml(domain)}">Delete</button>
      </div>
    `;

    item.querySelector('.btn-danger').addEventListener('click', async () => {
      if (!confirm(`Delete design for ${domain}?`)) return;
      await deleteSiteDesign(domain);
      const sites = await getSites();
      renderSavedDesigns(sites);
    });

    container.appendChild(item);
  });
}

// ─── Local provider health check ─────────────────────────────────────────────
async function checkLocalProviders() {
  checkLocal('http://localhost:11434/api/tags', 'ollamaDot',    'ollamaStatusText');
  checkLocal('http://localhost:1234/v1/models', 'lmstudioDot', 'lmstudioStatusText');
}

async function checkLocal(url, dotId, textId) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
    if (res.ok) {
      $(dotId).className = 'dot online';
      $(textId).textContent = 'Running';
    } else {
      throw new Error();
    }
  } catch {
    $(dotId).className = 'dot offline';
    $(textId).textContent = 'Not detected';
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function flashConfirm(msg) {
  const el = $('saveConfirm');
  el.textContent = msg + ' ✓';
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 2500);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

init();