/**
 * Basis security: headers, eenvoudige rate limits, productie-vriendelijke fouten.
 */
const isProd = process.env.NODE_ENV === 'production';

/** Express trust proxy (achter nginx/Render/Fly) — alleen aanzetten als je weet wat je doet */
export function trustProxy(app) {
  if (process.env.TRUST_PROXY === '1') {
    app.set('trust proxy', 1);
  }
}

export function securityHeaders(_req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (process.env.ENABLE_HSTS === '1') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
}

function clientIp(req) {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

/**
 * In-memory rate limit (per proces). Voor productie achter meerdere pods: gebruik Redis + limiter.
 */
export function rateLimit({ windowMs, max, keyPrefix = '' }) {
  const buckets = new Map();
  return function rateLimitMiddleware(req, res, next) {
    const key = `${keyPrefix}:${clientIp(req)}`;
    const now = Date.now();
    let times = buckets.get(key) || [];
    times = times.filter((t) => now - t < windowMs);
    if (times.length >= max) {
      res.setHeader('Retry-After', String(Math.ceil(windowMs / 1000)));
      return res.status(429).json({ error: 'rate_limited', message: 'Te veel verzoeken. Probeer later opnieuw.' });
    }
    times.push(now);
    buckets.set(key, times);
    next();
  };
}

/** Alleen JSON-body; geen onbeperkte query-complexiteit hier */
/** SaaS-beheer: alleen als INTERNAL_API_KEY gezet is (strict). */
export function requireAdminApiKey(req, res, next) {
  const expected = process.env.INTERNAL_API_KEY?.trim();
  if (!expected) {
    return res.status(503).json({
      error: 'admin_disabled',
      message: 'Zet INTERNAL_API_KEY in .env om platform-beheer te activeren.',
    });
  }
  const hdr = req.headers.authorization;
  const bearer = hdr?.startsWith('Bearer ') ? hdr.slice(7).trim() : '';
  const alt = req.headers['x-internal-key'];
  const provided = bearer || (typeof alt === 'string' ? alt.trim() : '');
  if (provided !== expected) {
    return res.status(401).json({ error: 'unauthorized', message: 'Ongeldige of ontbrekende API-sleutel.' });
  }
  next();
}

export function requireInternalApiKey(req, res, next) {
  const expected = process.env.INTERNAL_API_KEY?.trim();
  if (!expected) {
    return next();
  }
  const hdr = req.headers.authorization;
  const bearer = hdr?.startsWith('Bearer ') ? hdr.slice(7).trim() : '';
  const alt = req.headers['x-internal-key'];
  const provided = bearer || (typeof alt === 'string' ? alt.trim() : '');
  if (provided !== expected) {
    return res.status(401).json({ error: 'unauthorized', message: 'Ongeldige of ontbrekende API-sleutel.' });
  }
  next();
}

export function sanitizeErrorForClient(err, fallback = 'Interne fout') {
  if (!isProd && err?.message) {
    return { message: err.message };
  }
  return { message: fallback };
}

export function manifestErrorPayload(raw) {
  const base = {
    error: raw._error,
    message:
      raw.message ||
      'Configureer het release-manifest (RELEASE_MANIFEST_PATH of webapp/public/releases/nebula-release-manifest.json).',
  };
  if (!isProd && raw.path) {
    base.path = raw.path;
  }
  return base;
}
