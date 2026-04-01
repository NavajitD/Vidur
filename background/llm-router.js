import { PROVIDERS, DEFAULT_MODELS, MAX_CSS_LENGTH } from '../shared/constants.js';
import { callAnthropic }          from './anthropic-client.js';
import { callOpenAICompatible }   from './openai-compatible-client.js';
import { callGemini }             from './gemini-client.js';
import { callCloudflare }         from './cloudflare-client.js';

const SYSTEM_PROMPT = `You are a CSS-only visual redesign engine for a browser extension called Vidur.

Rules you MUST follow:
1. Output ONLY valid CSS. No explanations, no markdown, no code fences.
2. Do NOT modify HTML structure or content.
3. Do NOT use JavaScript or @import.
4. Do NOT reference external resources via url() — no external images or fonts unless from Google Fonts @import at the very top.
5. Target elements using existing tag names, classes, and IDs from the page.
6. Prefix all selectors with [data-vidur-active] to scope your styles (e.g. [data-vidur-active] body { ... }).
7. Output CSS in priority order: layout → color/background → typography → borders/shadows → animations.
8. Use CSS custom properties on :root for all colors and fonts to make the design cohesive.
9. Ensure text remains readable — never make text invisible or unreadable.
10. Keep output under 50KB.`;

function buildUserPrompt({ pageProfile, userInstruction, referenceStyle }) {
  const parts = ['=== Current Page Structure ===', pageProfile, ''];

  if (referenceStyle) {
    parts.push(referenceStyle, '');
  }

  parts.push('=== Redesign Instruction ===', userInstruction);
  parts.push('', 'Now output the CSS redesign. CSS only, no explanations.');

  return parts.join('\n');
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

  return sanitizeCss(raw);
}