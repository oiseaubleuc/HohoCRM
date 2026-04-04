/**
 * Centrale SaaS-config: persistent in backend/data/platform-config.json.
 * Hiermee overschrijf je o.a. release-manifestvelden, feature flags en standaard-branding
 * zonder de statische webapp opnieuw te deployen.
 */
import fs from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.PLATFORM_DATA_DIR?.trim() || join(__dirname, '../data');
const CONFIG_FILE = join(DATA_DIR, 'platform-config.json');

let memory = null;

function deepMerge(base, patch) {
  if (patch == null || typeof patch !== 'object' || Array.isArray(patch)) {
    return base;
  }
  const out = base && typeof base === 'object' && !Array.isArray(base) ? { ...base } : {};
  for (const k of Object.keys(patch)) {
    const pv = patch[k];
    const bv = out[k];
    if (
      pv &&
      typeof pv === 'object' &&
      !Array.isArray(pv) &&
      bv &&
      typeof bv === 'object' &&
      !Array.isArray(bv)
    ) {
      out[k] = deepMerge(bv, pv);
    } else {
      out[k] = pv;
    }
  }
  return out;
}

function defaultConfig() {
  return {
    releaseManifestPatch: {},
    featureFlags: {},
    brandingDefaults: {},
    messages: {},
    updatedAt: null,
  };
}

export function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function loadPlatformConfig() {
  if (memory) return memory;
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      memory = deepMerge(defaultConfig(), raw);
    } else {
      memory = defaultConfig();
    }
  } catch (e) {
    console.error('[platform-config] lezen mislukt:', e.message);
    memory = defaultConfig();
  }
  return memory;
}

/** Forceer opnieuw lezen van schijf (na externe wijziging) */
export function reloadPlatformConfigFromDisk() {
  memory = null;
  return loadPlatformConfig();
}

export function mergePlatformConfig(patch) {
  if (!patch || typeof patch !== 'object') {
    throw new Error('Body moet een JSON-object zijn');
  }
  const current = loadPlatformConfig();
  const next = deepMerge(current, patch);
  next.updatedAt = new Date().toISOString();
  ensureDataDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(next, null, 2), 'utf8');
  memory = next;
  return next;
}

export function getPublicSettingsSlice() {
  const c = loadPlatformConfig();
  return {
    featureFlags: c.featureFlags || {},
    brandingDefaults: c.brandingDefaults || {},
    messages: c.messages || {},
    updatedAt: c.updatedAt || null,
  };
}

export function getReleaseManifestPatch() {
  const c = loadPlatformConfig();
  return c.releaseManifestPatch && typeof c.releaseManifestPatch === 'object' ? c.releaseManifestPatch : {};
}

export { deepMerge, CONFIG_FILE, DATA_DIR };
