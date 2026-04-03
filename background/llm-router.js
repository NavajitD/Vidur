import { PROVIDERS, DEFAULT_MODELS, MAX_CSS_LENGTH } from '../shared/constants.js';
import { callAnthropic }          from './anthropic-client.js';
import { callOpenAICompatible }   from './openai-compatible-client.js';
import { callGemini }             from './gemini-client.js';
import { callCloudflare }         from './cloudflare-client.js';

const SYSTEM_PROMPT = `You are a CSS-only visual redesign engine for a browser extension called Vidur.

Rules you MUST follow:
1. Start with a single CSS comment: /* Summary: <one sentence describing what you changed> */
   If you cannot fully achieve the requested look with CSS alone, say so in this comment (e.g. "/* Summary: Partial terminal theme — black background and green text applied; full terminal layout not achievable via CSS only */").
2. After the summary comment, output ONLY valid CSS. No other explanations, no markdown, no code fences.
3. Do NOT modify HTML structure or content.
4. Do NOT use JavaScript. You MAY use a single @import at the very top (before the summary comment) for Google Fonts only.
5. Target elements using existing tag names, classes, and IDs listed in the page profile.
6. Prefix ALL selectors with [data-vidur-active] to scope your styles (e.g. [data-vidur-active] body { ... }).
7. Use CSS custom properties on [data-vidur-active] for all repeated colors and fonts.
8. Use !important on background-color, color, font-family, border-color, and fill properties — sites have high-specificity rules that will silently win without it.
9. Ensure text always remains readable — never make text invisible or the same color as its background.
10. Keep output under 50KB.
11. Be thorough: cover body, main content area, headings, paragraphs, links, nav, sidebar, buttons, inputs, tables, and footer.`;

function buildUserPrompt({ pageProfile, userInstruction, referenceStyle }) {
  const parts = ['=== Current Page Structure ===', pageProfile, ''];

  if (referenceStyle) {
    parts.push(referenceStyle, '');
  }

  parts.push('=== Redesign Instruction ===', userInstruction);
  parts.push('', 'Now output the CSS redesign. CSS only, no explanations.');

  return parts.join('\n');
}

export function extractSummary(css) {
  const m = css.match(/\/\*\s*Summary:\s*(.+?)\s*\*\//i);
  return m ? m[1].trim() : null;
}

function sanitizeCss(raw) {
  // Strip markdown fences if LLM wrapped output
  let css = raw.replace(/^```(?:css)?\s*/im, '').replace(/\s*```\s*$/im, '').trim();

  // Block dangerous patterns
  const dangerous = [
    /javascript\s*:/gi,
    /expression\s*\(/gi,
    /-moz-binding/gi,
    /behavior\s*:/gi,
  ];
  for (const pattern of dangerous) {
    css = css.replace(pattern, '/* removed */');
  }

  // Validate brace balance
  let depth = 0;
  let lastValid = 0;
  for (let i = 0; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') {
      depth--;
      if (depth < 0) { css = css.slice(0, i); break; }
      lastValid = i + 1;
    }
  }
  // If unclosed braces remain, truncate to last complete rule
  if (depth > 0) css = css.slice(0, lastValid);

  return css.slice(0, MAX_CSS_LENGTH);
}

export async function routeToLLM({ provider, model, apiKey, pageProfile, userInstruction, referenceStyle }) {
  const providerInfo = PROVIDERS[provider];
  if (!providerInfo) throw new Error(`Unknown provider: ${provider}`);

  const resolvedModel = model || DEFAULT_MODELS[provider];
  const userPrompt = buildUserPrompt({ pageProfile, userInstruction, referenceStyle });

  let raw = '';

  if (provider === 'anthropic') {
    raw = await callAnthropic({ apiKey, model: resolvedModel, systemPrompt: SYSTEM_PROMPT, userPrompt });
  } else if (provider === 'gemini') {
    raw = await callGemini({ apiKey, model: resolvedModel, systemPrompt: SYSTEM_PROMPT, userPrompt });
  } else if (provider === 'cloudflare') {
    raw = await callCloudflare({ apiKey, model: resolvedModel, systemPrompt: SYSTEM_PROMPT, userPrompt });
  } else {
    // All OpenAI-compatible providers: openai, openrouter, groq, together, ollama, lmstudio
    raw = await callOpenAICompatible({
      baseUrl: providerInfo.baseUrl,
      apiKey,
      model: resolvedModel,
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
    });
  }

  const css = sanitizeCss(raw);
  return { css, summary: extractSummary(raw) };
}