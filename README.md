# Vidur

AI-powered visual redesign for any website — without changing content.

## Features

- **Redesign any site** using a prompt or a reference site URL
- **Persistent** — saved designs auto-apply on every visit
- **BYOK** — bring your own API key; keys never leave your device
- **9 providers** supported out of the box

## Supported Providers

| Provider | Type | Notes |
|---|---|---|
| Anthropic | Proprietary | Best CSS quality |
| OpenAI | Proprietary | GPT-4o |
| Google Gemini | Proprietary | 1.5 Pro / Flash |
| OpenRouter | OSS Cloud | 100+ models, one key |
| Groq | OSS Cloud | Fastest inference |
| Together AI | OSS Cloud | Qwen 2.5 Coder recommended |
| Cloudflare Workers AI | OSS Cloud | `accountId\|apiToken` format |
| Ollama | Local | No key needed |
| LM Studio | Local | No key needed |

## Loading the Extension

### Chrome / Edge
1. Go to `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select this folder

### Firefox
1. Go to `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on** → select `manifest.json`

### Safari
Use Xcode's Web Extension Converter tool.

## Icons

Generate PNG icons from `icons/icon.svg` at 16×16, 32×32, 48×48, 128×128 and place them in `icons/`. You can use [squoosh.app](https://squoosh.app) or any SVG-to-PNG tool.

## Security

- API keys are stored in `chrome.storage.local` — device-only, never synced
- Keys are only read in the background service worker
- Content scripts never have access to keys
- All generated CSS is sanitized before injection