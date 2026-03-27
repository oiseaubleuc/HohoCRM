import { corsHeaders, json, parseBody, getSyncStore, verifyOrCreateUser, saveDb } from './_crm-sync.mjs';

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: corsHeaders, body: '' };
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  const body = parseBody(event);
  if (!body) return json(400, { error: 'Invalid JSON' });
  const { username, password, db } = body;
  if (!db || typeof db !== 'object') return json(400, { error: 'Missing db' });

  try {
    const store = getSyncStore();
    const auth = await verifyOrCreateUser(store, username, password);
    if (!auth.ok) return json(401, { error: auth.error || 'Unauthorized' });

    const data = JSON.stringify(db);
    if (data.length > 4_500_000) return json(413, { error: 'DB too large' });
    await saveDb(store, auth.username, db);
    return json(200, { ok: true, savedAt: new Date().toISOString() });
  } catch (e) {
    console.error('crm-save', e);
    return json(500, { error: 'Server error' });
  }
};

