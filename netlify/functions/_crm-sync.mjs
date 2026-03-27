import crypto from 'node:crypto';
import { getStore } from '@netlify/blobs';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ITER = 120000;
const KEYLEN = 32;
const DIGEST = 'sha256';

export function json(statusCode, body) {
  return { statusCode, headers: corsHeaders, body: JSON.stringify(body) };
}

export function parseBody(event) {
  try {
    return JSON.parse(event.body || '{}');
  } catch {
    return null;
  }
}

function userKey(username) {
  return `users/${username.toLowerCase()}`;
}

function dbKey(username) {
  return `db/${username.toLowerCase()}`;
}

function hashPassword(password, saltHex) {
  return crypto.pbkdf2Sync(password, Buffer.from(saltHex, 'hex'), ITER, KEYLEN, DIGEST).toString('hex');
}

function safeEqHex(aHex, bHex) {
  try {
    const a = Buffer.from(aHex, 'hex');
    const b = Buffer.from(bHex, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function getSyncStore() {
  return getStore('crm-sync');
}

export async function getUserRecord(store, username) {
  const raw = await store.get(userKey(username));
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export async function setUserRecord(store, username, rec) {
  await store.set(userKey(username), JSON.stringify(rec));
}

export async function verifyOrCreateUser(store, username, password) {
  const u = String(username || '').trim().toLowerCase();
  const p = String(password || '');
  if (!u || !p) return { ok: false, error: 'Missing username/password' };
  if (u !== 'admin') return { ok: false, error: 'Only admin account is allowed' };

  let rec = await getUserRecord(store, u);
  if (!rec) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = hashPassword(p, salt);
    rec = { username: u, salt, hash, createdAt: new Date().toISOString(), lastLoginAt: new Date().toISOString() };
    await setUserRecord(store, u, rec);
    return { ok: true, created: true, username: u };
  }

  const expected = hashPassword(p, rec.salt);
  if (!safeEqHex(expected, rec.hash)) return { ok: false, error: 'Invalid credentials' };
  rec.lastLoginAt = new Date().toISOString();
  await setUserRecord(store, u, rec);
  return { ok: true, created: false, username: u };
}

export async function loadDb(store, username) {
  const raw = await store.get(dbKey(username));
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export async function saveDb(store, username, db) {
  await store.set(dbKey(username), JSON.stringify(db));
}

