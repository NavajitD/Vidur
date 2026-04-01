/**
 * Cloudflare Workers AI client.
 * Requires: API token + Account ID (stored as key in format "accountId|apiToken").
 */
export async function callCloudflare({ apiKey, model, systemPrompt, userPrompt }) {
  const [accountId, apiToken] = apiKey.split('|');
  if (!accountId || !apiToken) {
    throw new Error('Cloudflare credentials must be in format: accountId|apiToken');
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'authorization': `Bearer ${apiToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt },
      ],
    }),
  });

  if (res.status === 401 || res.status === 403) {
    throw new Error('AUTH_ERROR: Cloudflare API token is invalid or revoked.');
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Cloudflare AI error ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  return data.result?.response ?? '';
}