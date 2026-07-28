import { defineConfig } from 'vite';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Vite's public-middleware matcht alleen exacte paden (…/index.html).
 * Paden met trailing slash vallen anders door naar de SPA (verkeerde index.html).
 */
function publicHtmlIndexRewrite() {
  const map = {
    '/vitrine': '/vitrine/index.html',
    '/vitrine/': '/vitrine/index.html',
    '/downloads': '/downloads/index.html',
    '/downloads/': '/downloads/index.html',
  };
  return {
    name: 'public-html-index-rewrite',
    enforce: 'pre',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const raw = req.url ?? '';
        const q = raw.includes('?') ? '?' + raw.split('?').slice(1).join('?') : '';
        const pathOnly = raw.split('?')[0] ?? '';
        const target = map[pathOnly];
        if (target) req.url = target + q;
        next();
      });
    },
  };
}

/** Vervangt __CRM_APP_HASH__ in index.html zodat browsers geen oude crm-app.js cachen. */
function crmAppCacheBust() {
  let root = process.cwd();
  return {
    name: 'crm-app-cache-bust',
    configResolved(c) {
      root = c.root;
    },
    transformIndexHtml(html) {
      try {
        const file = join(root, 'public', 'crm-app.js');
        const buf = readFileSync(file);
        const h = createHash('sha256').update(buf).digest('hex').slice(0, 12);
        return html.replaceAll('__CRM_APP_HASH__', h);
      } catch {
        return html.replaceAll('__CRM_APP_HASH__', '0');
      }
    },
  };
}

export default defineConfig({
  root: '.',
  publicDir: 'public',
  plugins: [publicHtmlIndexRewrite(), crmAppCacheBust()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      // Digiteal Peppol via Orion API (anti-CORS)
      '/v1/peppol': {
        target: 'http://127.0.0.1:4000',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://127.0.0.1:4000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: true,
  },
});
