/**
 * Nebula API — fundamentserver (Express).
 * Start: cd backend && npm install && cp .env.example .env && npm start
 * Database: optioneel; zonder DATABASE_URL draait alleen health + stubs.
 */
import express from 'express';
import pg from 'pg';
import { loadReleaseManifest, sanitizeManifestForPublic, invalidateReleaseManifestCache } from './releases.mjs';
import {
  mergePlatformConfig,
  loadPlatformConfig,
  reloadPlatformConfigFromDisk,
  getPublicSettingsSlice,
} from './platformConfig.mjs';
import {
  trustProxy,
  securityHeaders,
  rateLimit,
  requireInternalApiKey,
  requireAdminApiKey,
  sanitizeErrorForClient,
  manifestErrorPayload,
} from './security.mjs';

const app = express();
app.disable('x-powered-by');
trustProxy(app);

const isProd = process.env.NODE_ENV === 'production';
const RL_PUBLIC_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000);
const RL_PUBLIC_MAX = Number(process.env.RATE_LIMIT_MAX || 120);

app.use(securityHeaders);
app.use(express.json({ limit: '2mb' }));

function corsReleases(_req, res, next) {
  const origin = process.env.CORS_ORIGIN?.trim();
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (!isProd) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  next();
}

const PORT = Number(process.env.PORT || 4000);
const HOST = process.env.LISTEN_HOST || '127.0.0.1';
const { Pool } = pg;
const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, max: 10 })
  : null;

const limitHealth = rateLimit({ windowMs: RL_PUBLIC_MS, max: Number(process.env.RATE_LIMIT_HEALTH_MAX || 300), keyPrefix: 'health' });
const limitPublic = rateLimit({ windowMs: RL_PUBLIC_MS, max: RL_PUBLIC_MAX, keyPrefix: 'api' });

app.get('/health', limitHealth, (_req, res) => {
  res.json({
    ok: true,
    product: 'Nebula',
    vendor: 'HohohSolutions',
    db: pool ? 'configured' : 'disabled',
    time: new Date().toISOString(),
  });
});

app.get('/v1/meta', limitPublic, (_req, res) => {
  res.json({
    name: 'Nebula',
    tagline: 'Intelligence for modern operations',
    version: '0.1.0',
    capabilities: [
      'health',
      'auth_stub',
      'tenant_stub',
      'releases',
      'public_settings',
      'admin_platform_config',
    ],
  });
});

/** Publiek: veilige defaults voor clients (geen secrets). CRM/native kunnen dit periodiek ophalen. */
app.get('/v1/public/settings', limitPublic, (_req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=120');
  res.json(getPublicSettingsSlice());
});

/**
 * SaaS-beheer (INTERNAL_API_KEY verplicht): centrale JSON — merge over statisch manifest.
 * PUT body: gedeeltelijk object; velden zoals releaseManifestPatch overschrijven downloads live.
 */
app.get('/v1/admin/platform-config', limitPublic, requireAdminApiKey, (_req, res) => {
  res.json(loadPlatformConfig());
});

app.put('/v1/admin/platform-config', limitPublic, requireAdminApiKey, (req, res) => {
  try {
    const next = mergePlatformConfig(req.body || {});
    invalidateReleaseManifestCache();
    res.json({ ok: true, config: next });
  } catch (e) {
    res.status(400).json({ error: 'merge_failed', message: e.message });
  }
});

app.post('/v1/admin/platform-config/reload', limitPublic, requireAdminApiKey, (_req, res) => {
  reloadPlatformConfigFromDisk();
  invalidateReleaseManifestCache();
  res.json({ ok: true, config: loadPlatformConfig() });
});

/** SaaS: laatste macOS-installers — basisbestand + optionele patch uit platform-config */
app.get('/v1/releases/latest', limitPublic, corsReleases, (_req, res) => {
  const raw = loadReleaseManifest();
  if (raw._error) {
    const status = raw._error === 'invalid_RELEASE_MANIFEST_JSON' ? 500 : 503;
    return res.status(status).json(manifestErrorPayload(raw));
  }
  res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
  res.json(sanitizeManifestForPublic(raw));
});

app.options('/v1/releases/latest', corsReleases, (_req, res) => {
  res.status(204).end();
});

app.post('/v1/auth/register', limitPublic, (_req, res) => {
  res.status(501).json({
    error: 'not_implemented',
    message: 'Registratie komt in volgende iteratie — gebruik nu de lokale Nebula webapp.',
  });
});

app.post('/v1/auth/login', limitPublic, (_req, res) => {
  res.status(501).json({
    error: 'not_implemented',
    message: 'Login API nog niet geactiveerd.',
  });
});

/**
 * Lijst tenants — in productie: zet INTERNAL_API_KEY en stuur Authorization: Bearer <key> of X-Internal-Key.
 * Tot echte JWT/tenant-auth dit is de minimale bescherming tegen open datalek.
 */
app.get('/v1/tenants', limitPublic, requireInternalApiKey, async (_req, res) => {
  if (!pool) {
    return res.status(503).json({ error: 'database_unconfigured' });
  }
  try {
    const { rows } = await pool.query(
      'SELECT id, name, slug, plan, created_at FROM tenants WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 50'
    );
    res.json({ tenants: rows });
  } catch (e) {
    console.error(e);
    const { message } = sanitizeErrorForClient(e, 'Databasefout');
    res.status(500).json({ error: 'query_failed', message });
  }
});

app.listen(PORT, HOST, () => {
  if (isProd && !process.env.CORS_ORIGIN?.trim()) {
    console.warn('[security] NODE_ENV=production maar CORS_ORIGIN ontbreekt — cross-origin browsercalls naar /v1/releases/* falen tot je dit zet.');
  }
  if (isProd && pool && !process.env.INTERNAL_API_KEY?.trim()) {
    console.warn('[security] DATABASE_URL actief maar INTERNAL_API_KEY ontbreekt — GET /v1/tenants is publiek bereikbaar.');
  }
  console.log(`Nebula API listening on http://${HOST}:${PORT}`);
});
