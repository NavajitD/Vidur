/**
 * Generic OpenAI-compatible client.
 * Works for: OpenAI, OpenRouter, Groq, Together AI, Ollama, LM Studio.
 */
export async function callOpenAICompatible({ baseUrl, apiKey, model, systemPrompt, userPrompt }) {
  const headers = {
    'content-type': 'application/json',
  };

  // Local providers (Ollama, LM Studio) don't require auth
  if (apiKey) {
    headers['authorization'] = `Bearer ${apiKey}`;
  }

  // OpenRouter requires these for usage tracking
  if (baseUrl.includes('openrouter.ai')) {
    headers['http-referer'] = 'https://github.com/NavajitD/vidur';
    headers['x-title'] = 'Vidur';
  }

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt },
      ],
    }),
  });

  if (res.status === 401 || res.status === 403) {
    throw new Error('AUTH_ERROR: API key is invalid or revoked.');
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`API error ${res.status} from ${baseUrl}: ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}