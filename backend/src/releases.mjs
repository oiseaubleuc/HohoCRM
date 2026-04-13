/**
 * Laadt het Orion release-manifest (macOS .pkg / .dmg / zip) voor SaaS-downloads.
 * Standaard: webapp/public/releases/orion-release-manifest.json in de monorepo.
 */
import fs from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { getReleaseManifestPatch } from './platformConfig.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

function defaultManifestPath() {
  return join(__dirname, '../../webapp/public/releases/orion-release-manifest.json');
}

export function resolveManifestPath() {
  const override = process.env.RELEASE_MANIFEST_PATH?.trim();
  if (override) {
    return override.startsWith('/') ? override : join(process.cwd(), override);
  }
  return defaultManifestPath();
}

let cache = { data: null, mtimeMs: 0, path: '' };

export function invalidateReleaseManifestCache() {
  cache = { data: null, mtimeMs: 0, path: '' };
}

function deepMergeManifest(base, patch) {
  if (!patch || typeof patch !== 'object') return base;
  const out = JSON.parse(JSON.stringify(base));
  for (const key of Object.keys(patch)) {
    const pv = patch[key];
    const bv = out[key];
    if (
      pv &&
      typeof pv === 'object' &&
      !Array.isArray(pv) &&
      bv &&
      typeof bv === 'object' &&
      !Array.isArray(bv)
    ) {
      out[key] = { ...bv, ...pv };
    } else {
      out[key] = pv;
    }
  }
  return out;
}

export function loadReleaseManifest() {
  const rawJson = process.env.RELEASE_MANIFEST_JSON?.trim();
  if (rawJson) {
    try {
      const data = JSON.parse(rawJson);
      return applyManifestPatch(data);
    } catch (e) {
      return { _error: 'invalid_RELEASE_MANIFEST_JSON', message: e.message };
    }
  }

  const path = resolveManifestPath();
  try {
    const st = fs.statSync(path);
    if (cache.path === path && st.mtimeMs === cache.mtimeMs && cache.data) {
      return cache.data;
    }
    const data = JSON.parse(fs.readFileSync(path, 'utf8'));
    const merged = applyManifestPatch(data);
    cache = { data: merged, mtimeMs: st.mtimeMs, path };
    return merged;
  } catch (e) {
    return {
      _error: 'manifest_unreadable',
      path,
      message: e.message,
    };
  }
}

function applyManifestPatch(data) {
  try {
    const patch = getReleaseManifestPatch();
    if (patch && Object.keys(patch).length > 0) {
      return deepMergeManifest(data, patch);
    }
  } catch {
    /* ignore */
  }
  return data;
}

export function sanitizeManifestForPublic(raw) {
  if (!raw || raw._error) {
    return raw;
  }
  const copy = JSON.parse(JSON.stringify(raw));
  for (const key of ['pkg', 'dmg', 'nativeZip', 'webappZip']) {
    const a = copy[key];
    if (a && typeof a === 'object') {
      delete a.notes;
    }
  }
  return copy;
}
