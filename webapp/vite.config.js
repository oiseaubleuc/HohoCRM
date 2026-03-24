import { defineConfig } from 'vite';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

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
  plugins: [crmAppCacheBust()],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: true,
  },
});
