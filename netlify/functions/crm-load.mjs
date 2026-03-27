import { corsHeaders, json, parseBody, getSyncStore, verifyOrCreateUser, loadDb } from './_crm-sync.mjs';

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: corsHeaders, body: '' };
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  const body = parseBody(event);
  if (!body) return json(400, { error: 'Invalid JSON' });
  const { username, password } = body;

  try {
    const store = getSyncStore();
    const auth = await verifyOrCreateUser(store, username, password);
    if (!auth.ok) return json(401, { error: auth.error || 'Unauthorized' });
    const db = await loadDb(store, auth.username);
    return json(200, { ok: true, db: db || null });
  } catch (e) {
    console.error('crm-load', e);
    return json(500, { error: 'Server error' });
  }
};

