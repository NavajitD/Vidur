/**
 * Vidur content script — CSS injector.
 * Applies and maintains generated CSS, survives SPA navigation.
 */

const STYLE_ID  = 'vidur-injected-css';
const ATTR      = 'data-vidur-active';
const MSG       = { APPLY_CSS: 'APPLY_CSS', CLEAR_CSS: 'CLEAR_CSS',
                    GET_SAVED_DESIGN: 'GET_SAVED_DESIGN', SUCCESS: 'SUCCESS' };

let currentCss = null;
let observer   = null;

// ─── Apply CSS to the page ───────────────────────────────────────────────────
function applyCSS(css) {
  currentCss = css;
  document.documentElement.setAttribute(ATTR, '');

  let styleEl = document.getElementById(STYLE_ID);
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = STYLE_ID;
    (document.head || document.documentElement).appendChild(styleEl);
  }
  styleEl.textContent = css;
  startObserver();
}

function clearCSS() {
  currentCss = null;
  document.documentElement.removeAttribute(ATTR);
  document.getElementById(STYLE_ID)?.remove();
  stopObserver();
}

// ─── MutationObserver — re-inject if SPA strips the <style> ─────────────────
function startObserver() {
  if (observer) return;
  observer = new MutationObserver(() => {
    if (currentCss && !document.getElementById(STYLE_ID)) {
      applyCSS(currentCss);
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

function stopObserver() {
  observer?.disconnect();
  observer = null;
}

// ─── Listen for SPA navigation (popstate / hash changes) ────────────────────
window.addEventListener('popstate',    () => currentCss && applyCSS(currentCss));
window.addEventListener('hashchange', () => currentCss && applyCSS(currentCss));

// ─── Listen for messages from background / popup ─────────────────────────────
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === MSG.APPLY_CSS && message.css) {
    applyCSS(message.css);
  } else if (message.type === MSG.CLEAR_CSS) {
    clearCSS();
  }
});

// ─── On load: check if this domain has a saved enabled design ────────────────
(async function init() {
  const domain = location.hostname;

  try {
    const res = await chrome.runtime.sendMessage({ type: MSG.GET_SAVED_DESIGN, domain });
    if (res?.type === MSG.SUCCESS && res.design?.enabled && res.design?.css) {
      applyCSS(res.design.css);
    }
  } catch {
    // Extension context may not be ready yet on very fast loads — safe to ignore
  }
})();

// ─── DOM extractor — collects page profile for LLM prompt ───────────────────
// Exposed as a function triggered via chrome.scripting.executeScript from popup
window.__vidurExtractPageProfile = function () {
  const profile = {};

  // Semantic landmarks
  const landmarks = ['header', 'nav', 'main', 'footer', 'aside', 'article', 'section'];
  profile.landmarks = landmarks.filter(tag => document.querySelector(tag));

  // Tag frequency (top 15 most used tags)
  const tagCounts = {};
  document.querySelectorAll('*').forEach(el => {
    const t = el.tagName.toLowerCase();
    tagCounts[t] = (tagCounts[t] || 0) + 1;
  });
  profile.tags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([tag, count]) => `${tag}(${count})`);

  // Computed styles from top visible elements
  const colors = new Set();
  const fonts  = new Set();
  let sampleCount = 0;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
  while (walker.nextNode() && sampleCount < 30) {
    const el = walker.currentNode;
    const rect = el.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) continue;
    const cs = getComputedStyle(el);
    if (cs.color)           colors.add(cs.color);
    if (cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)') colors.add(cs.backgroundColor);
    if (cs.fontFamily)      fonts.add(cs.fontFamily.split(',')[0].replace(/['"]/g, '').trim());
    sampleCount++;
  }
  profile.colors = [...colors].slice(0, 15);
  profile.fonts  = [...fonts].slice(0, 5);

  // Layout type
  const body = document.body;
  const bodyCs = getComputedStyle(body);
  profile.layout = bodyCs.display === 'grid' ? 'grid' :
                   bodyCs.display === 'flex'  ? 'flex'  : 'block';

  // Page title & meta description (for LLM context)
  profile.title = document.title?.slice(0, 80) || '';
  profile.metaDesc = document.querySelector('meta[name="description"]')
    ?.getAttribute('content')?.slice(0, 120) || '';

  // Top-level class names (hints at CSS framework in use)
  const rootClasses = [...document.documentElement.classList,
                       ...document.body.classList].slice(0, 10);
  profile.rootClasses = rootClasses;

  return JSON.stringify(profile).slice(0, 4000);
};