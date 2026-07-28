/**
 * Digiteal Peppol proxy — browser → Orion API → Digiteal (vermijdt CORS).
 * Client stuurt Digiteal Basic-auth + X-Digiteal-Sandbox: 1|0.
 */
import express from 'express';

const SANDBOX_BASE = 'https://test.digiteal.eu/api/v1';
const PROD_BASE = 'https://app.digiteal.eu/api/v1';

function setPeppolCors(req, res) {
  const origin = req.headers.origin;
  const isProd = process.env.NODE_ENV === 'production';
  const allowList = new Set(
    [
      'http://127.0.0.1:5173',
      'http://localhost:5173',
      'http://127.0.0.1:4173',
      'http://localhost:4173',
      'http://127.0.0.1:3001',
      'http://localhost:3001',
      process.env.CORS_ORIGIN?.trim(),
    ].filter(Boolean)
  );
  if (origin && (allowList.has(origin) || (!isProd && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
  } else if (!isProd) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Digiteal-Sandbox, Accept'
  );
}

export const peppolProxyRouter = express.Router();

peppolProxyRouter.use((req, res, next) => {
  setPeppolCors(req, res);
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

peppolProxyRouter.use(async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth || !String(auth).startsWith('Basic ')) {
    return res.status(401).json({
      error: {
        code: 'MISSING_DIGITEAL_AUTH',
        message: 'Authorization: Basic <Digiteal apiKey:apiSecret> is verplicht.',
      },
    });
  }

  const sandboxHeader = String(req.headers['x-digiteal-sandbox'] ?? '1').trim();
  const sandbox = sandboxHeader !== '0' && sandboxHeader.toLowerCase() !== 'false';
  const digitealBase = sandbox ? SANDBOX_BASE : PROD_BASE;

  // Express mount strip: /v1/peppol + /peppol/... → req.url is relative to mount
  const suffix = req.url || '/';
  const targetUrl = `${digitealBase}${suffix.startsWith('/') ? suffix : `/${suffix}`}`;

  const headers = {
    Authorization: auth,
    Accept: req.headers.accept || 'application/json, application/xml, text/plain, */*',
  };

  const contentType = req.headers['content-type'];
  let body;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    if (typeof req.body === 'string' && req.body.length) {
      headers['Content-Type'] = contentType || 'application/xml';
      body = req.body;
    } else if (req.rawBody != null && String(req.rawBody).length) {
      headers['Content-Type'] = contentType || 'application/xml';
      body = req.rawBody;
    } else if (req.body != null && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(req.body);
    }
  }

  try {
    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
    });
    const text = await upstream.text();
    const ct = upstream.headers.get('content-type') || 'application/json';
    res.status(upstream.status);
    res.setHeader('Content-Type', ct);
    res.send(text);
  } catch (e) {
    console.error('[peppol-proxy]', e);
    res.status(502).json({
      error: {
        code: 'DIGITEAL_UNREACHABLE',
        message: e instanceof Error ? e.message : 'Digiteal niet bereikbaar',
      },
    });
  }
});
