#!/usr/bin/env node
/**
 * Orion — cross-platform CLI: download .pkg / .dmg / zip via release-manifest (zelfde als SaaS API).
 * Gebruik: node scripts/download-orion-pkg.mjs [--api URL] [--manifest URL] [--file path] [--type pkg|dmg|nativeZip] [-o out]
 */
import { createHash } from 'crypto';
import { createWriteStream, readFileSync, existsSync } from 'fs';
import { pipeline } from 'stream/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

function parseArgs() {
  const a = process.argv.slice(2);
  const o = {
    api: process.env.ORION_API_BASE || 'http://127.0.0.1:4000',
    manifest: process.env.ORION_MANIFEST_URL || '',
    file: process.env.ORION_MANIFEST_FILE || '',
    type: 'pkg',
    out: '',
    install: false,
    skipHash: false,
  };
  for (let i = 0; i < a.length; i++) {
    if (a[i] === '--api') o.api = a[++i];
    else if (a[i] === '--manifest') o.manifest = a[++i];
    else if (a[i] === '--file') o.file = a[++i];
    else if (a[i] === '--type') o.type = a[++i];
    else if (a[i] === '-o') o.out = a[++i];
    else if (a[i] === '--install') o.install = true;
    else if (a[i] === '--no-hash') o.skipHash = true;
    else if (a[i] === '-h' || a[i] === '--help') {
      console.log(`Usage: node scripts/download-orion-pkg.mjs [options]
  --api URL       API base (default ORION_API_BASE or http://127.0.0.1:4000)
  --manifest URL  Direct manifest JSON URL
  --file PATH     Local manifest (default repo: ${join(ROOT, 'webapp/public/releases/orion-release-manifest.json')})
  --type pkg|dmg|nativeZip
  -o PATH         Output file
  --install       macOS: open .pkg/.dmg after download
  --no-hash       Skip SHA-256 verify`);
      process.exit(0);
    }
  }
  return o;
}

async function fetchJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
  return r.json();
}

async function downloadFile(url, destPath) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Download failed ${r.status} ${url}`);
  const ws = createWriteStream(destPath);
  await pipeline(r.body, ws);
}

function sha256File(path) {
  const h = createHash('sha256');
  h.update(readFileSync(path));
  return h.digest('hex');
}

async function main() {
  const opt = parseArgs();
  let data;

  if (opt.file) {
    if (!existsSync(opt.file)) throw new Error(`Manifest not found: ${opt.file}`);
    data = JSON.parse(readFileSync(opt.file, 'utf8'));
  } else if (opt.manifest) {
    data = await fetchJson(opt.manifest);
  } else {
    const url = `${opt.api.replace(/\/$/, '')}/v1/releases/latest`;
    data = await fetchJson(url);
    if (data.error) throw new Error(data.message || data.error);
  }

  const block = data[opt.type];
  if (!block?.url) {
    throw new Error(`No ${opt.type}.url in manifest — fill webapp/public/releases/orion-release-manifest.json`);
  }

  const fname = block.filename || `orion.${opt.type === 'nativeZip' ? 'zip' : opt.type}`;
  const out = opt.out || join(process.cwd(), fname);

  console.error('→', block.url);
  console.error('→', out);
  await downloadFile(block.url, out);

  if (!opt.skipHash && block.sha256) {
    const got = sha256File(out);
    if (got.toLowerCase() !== String(block.sha256).toLowerCase()) {
      const fs = await import('fs/promises');
      await fs.unlink(out);
      throw new Error('SHA-256 mismatch — file removed');
    }
    console.error('✓ SHA-256 OK');
  } else if (!opt.skipHash && !block.sha256) {
    console.warn('⚠ No sha256 in manifest — run scripts/fill-release-manifest.sh');
  }

  console.log(out);

  if (opt.install && process.platform === 'darwin') {
    const { execFileSync } = await import('child_process');
    execFileSync('open', [out], { stdio: 'inherit' });
  }
}

main().catch((e) => {
  console.error('✗', e.message || e);
  process.exit(1);
});
