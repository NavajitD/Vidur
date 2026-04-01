export const STORAGE_KEYS = {
  SETTINGS:  'vidur:settings',
  KEYS:      'vidur:keys',
  SITES:     'vidur:sites',
};

export const PROVIDERS = {
  // Proprietary
  anthropic:  { label: 'Anthropic',       type: 'proprietary', baseUrl: 'https://api.anthropic.com' },
  openai:     { label: 'OpenAI',           type: 'proprietary', baseUrl: 'https://api.openai.com/v1' },
  gemini:     { label: 'Google Gemini',    type: 'proprietary', baseUrl: 'https://generativelanguage.googleapis.com' },

  // Open Source — Cloud
  openrouter: { label: 'OpenRouter',       type: 'oss-cloud',   baseUrl: 'https://openrouter.ai/api/v1' },
  groq:       { label: 'Groq',             type: 'oss-cloud',   baseUrl: 'https://api.groq.com/openai/v1' },
  together:   { label: 'Together AI',      type: 'oss-cloud',   baseUrl: 'https://api.together.xyz/v1' },
  cloudflare: { label: 'Cloudflare AI',    type: 'oss-cloud',   baseUrl: 'https://api.cloudflare.com/client/v4/accounts' },

  // Open Source — Local
  ollama:     { label: 'Ollama (local)',    type: 'local',       baseUrl: 'http://localhost:11434/v1' },
  lmstudio:   { label: 'LM Studio (local)',type: 'local',       baseUrl: 'http://localhost:1234/v1' },
};

export const DEFAULT_MODELS = {
  anthropic:  'claude-sonnet-4-6',
  openai:     'gpt-4o',
  gemini:     'gemini-1.5-pro',
  openrouter: 'meta-llama/llama-3.3-70b-instruct',
  groq:       'llama-3.3-70b-versatile',
  together:   'Qwen/Qwen2.5-Coder-32B-Instruct',
  cloudflare: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  ollama:     'llama3.3',
  lmstudio:   'local-model',
};

export const PROVIDER_RECOMMENDED_MODELS = {
  anthropic:  ['claude-sonnet-4-6', 'claude-haiku-4-5'],
  openai:     ['gpt-4o', 'gpt-4o-mini'],
  gemini:     ['gemini-1.5-pro', 'gemini-1.5-flash'],
  openrouter: ['meta-llama/llama-3.3-70b-instruct', 'qwen/qwen-2.5-coder-32b-instruct', 'mistralai/mistral-large'],
  groq:       ['llama-3.3-70b-versatile', 'mixtral-8x7b-32768'],
  together:   ['Qwen/Qwen2.5-Coder-32B-Instruct', 'meta-llama/Llama-3.3-70B-Instruct-Turbo'],
  cloudflare: ['@cf/meta/llama-3.3-70b-instruct-fp8-fast', '@cf/qwen/qwen2.5-coder-32b-instruct'],
  ollama:     ['llama3.3', 'qwen2.5-coder', 'mistral'],
  lmstudio:   ['local-model'],
};

export const ATTR_ACTIVE = 'data-vidur-active';
export const STYLE_ID    = 'vidur-injected-css';
export const MAX_CSS_LENGTH = 60000;
export const REFERENCE_FETCH_TIMEOUT_MS = 8000;
export const MAX_PAGE_PROFILE_BYTES = 4000;