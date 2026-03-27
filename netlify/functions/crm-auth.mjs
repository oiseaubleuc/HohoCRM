import { corsHeaders, json, parseBody, getSyncStore, verifyOrCreateUser } from './_crm-sync.mjs';

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: corsHeaders, body: '' };
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  const body = parseBody(event);
  if (!body) return json(400, { error: 'Invalid JSON' });
  const { username, password } = body;

  try {
    const store = getSyncStore();
    const result = await verifyOrCreateUser(store, username, password);
    if (!result.ok) return json(401, { error: result.error || 'Unauthorized' });
    return json(200, { ok: true, created: !!result.created, username: result.username });
  } catch (e) {
    console.error('crm-auth', e);
    return json(500, { error: 'Server error' });
  }
};

