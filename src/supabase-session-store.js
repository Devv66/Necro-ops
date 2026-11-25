import crypto from 'node:crypto';

const SESSION_ENDPOINT_PATH = '/functions/v1/necroops-session-gateway';

export function createSupabaseSessionStore({
  supabaseUrl = process.env.NECROOPS_SUPABASE_URL,
  publishableKey = process.env.NECROOPS_SUPABASE_PUBLISHABLE_KEY,
  gatewaySecret = process.env.NECROOPS_SUPABASE_GATEWAY_SECRET,
  fetchImpl = fetch
} = {}) {
  if (!supabaseUrl || !publishableKey || !gatewaySecret || !/^[0-9a-f]{96,}$/i.test(gatewaySecret)) {
    throw new Error('Supabase session gateway configuration is incomplete.');
  }
  const endpoint = new URL(SESSION_ENDPOINT_PATH, supabaseUrl).toString();
  async function call(payload) {
    const raw = JSON.stringify(payload);
    const signature = crypto.createHmac('sha256', Buffer.from(gatewaySecret, 'hex')).update(raw).digest('hex');
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', apikey: publishableKey, 'x-necroops-signature': signature },
      body: raw,
      signal: AbortSignal.timeout(8000)
    });
    const text = await response.text();
    if (!response.ok) {
      const error = new Error('Supabase session gateway request failed.');
      error.statusCode = response.status === 409 ? 409 : 503;
      error.code = response.status === 409 ? 'SESSION_CONFLICT' : 'SESSION_STORE_UNAVAILABLE';
      throw error;
    }
    try { return JSON.parse(text); }
    catch {
      const error = new Error('Supabase session gateway returned invalid JSON.');
      error.statusCode = 503;
      error.code = 'SESSION_STORE_INVALID_RESPONSE';
      throw error;
    }
  }
  const first = value => Array.isArray(value) ? value[0] ?? null : value;
  return {
    async createSession(sessionId, expiresAt) {
      return first(await call({ action: 'create', sessionId, expiresAt }));
    },
    async getSession(sessionId) {
      return first(await call({ action: 'get', sessionId }));
    },
    async compareAndSwap(sessionId, expectedRevision, exorcisedFixtureIds, expiresAt) {
      return first(await call({ action: 'cas', sessionId, expectedRevision, exorcisedFixtureIds, expiresAt }));
    }
  };
}
