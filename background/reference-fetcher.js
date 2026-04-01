import { REFERENCE_FETCH_TIMEOUT_MS } from '../shared/constants.js';

/**
 * Fetches a reference site and extracts its visual design tokens.
 * Returns a compact style profile string for LLM consumption.
 */
export async function fetchReferenceStyle(url) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REFERENCE_FETCH_TIMEOUT_MS);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Vidur/1.0)' },
    });
    clearTimeout(timer);

    if (!res.ok) return null;

    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');

    // Collect inline styles
    const inlineStyles = [...doc.querySelectorAll('style')]
      .map(s => s.textContent)
      .join('\n');

    // Collect external stylesheet URLs (up to 3)
    const linkHrefs = [...doc.querySelectorAll('link[rel="stylesheet"]')]
      .map(l => l.getAttribute('href'))
      .filter(Boolean)
      .slice(0, 3)
      .map(href => resolveUrl(href, url));

    const externalStyles = (
      await Promise.allSettled(linkHrefs.map(href => fetchCss(href)))
    )
      .filter(r => r.status === 'fulfilled' && r.value)
      .map(r => r.value)
      .join('\n');

    const allCss = (inlineStyles + '\n' + externalStyles).slice(0, 150000);

    return extractDesignTokens(allCss);
  } catch {
    return null;
  }
}

async function fetchCss(url) {
  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const text = await res.text();
    return text.slice(0, 50000);
  } catch {
    return null;
  }
}

function resolveUrl(href, base) {
  try { return new URL(href, base).href; } catch { return href; }
}

function extractDesignTokens(css) {
  const tokens = {
    colors: new Set(),
    fonts: new Set(),
    radii: new Set(),
    shadows: new Set(),
    customProps: {},
  };

  // CSS custom properties
  for (const m of css.matchAll(/--[\w-]+\s*:\s*([^;}{]+)/g)) {
    const name = m[0].split(':')[0].trim();
    const val  = m[1].trim();
    if (name.match(/color|bg|background|text|primary|secondary|accent|surface/i) ||
        name.match(/font|radius|shadow|spacing|size/i)) {
      tokens.customProps[name] = val;
    }
  }

  // Colors
  for (const m of css.matchAll(/#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|hsl[a]?\([^)]+\)/g)) {
    tokens.colors.add(m[0]);
  }

  // Font families
  for (const m of css.matchAll(/font-family\s*:\s*([^;}{]+)/g)) {
    tokens.fonts.add(m[1].trim().split(',')[0].replace(/['"]/g, '').trim());
  }

  // Border radii
  for (const m of css.matchAll(/border-radius\s*:\s*([^;}{]+)/g)) {
    tokens.radii.add(m[1].trim());
  }

  // Shadows
  for (const m of css.matchAll(/box-shadow\s*:\s*([^;}{]+)/g)) {
    if (!m[1].includes('none')) tokens.shadows.add(m[1].trim());
  }

  // Build compact summary
  const lines = ['=== Reference Site Style Profile ==='];

  if (tokens.colors.size) {
    lines.push(`Colors (${tokens.colors.size}): ${[...tokens.colors].slice(0, 20).join(', ')}`);
  }
  if (tokens.fonts.size) {
    lines.push(`Font families: ${[...tokens.fonts].join(', ')}`);
  }
  if (tokens.radii.size) {
    lines.push(`Border radii: ${[...tokens.radii].slice(0, 5).join(', ')}`);
  }
  if (tokens.shadows.size) {
    lines.push(`Shadows: ${[...tokens.shadows].slice(0, 3).join(' | ')}`);
  }
  const cp = Object.entries(tokens.customProps).slice(0, 30);
  if (cp.length) {
    lines.push('CSS Custom Properties:');
    cp.forEach(([k, v]) => lines.push(`  ${k}: ${v}`));
  }

  return lines.join('\n');
}