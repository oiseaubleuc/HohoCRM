/**
 * Verifies signed requests from the Next.js BFF (server-side fetch only).
 * Payload: HMAC-SHA256(secret, `${userId}:${tenantId}:${ts}`) as hex; ts within 5 minutes.
 */
import crypto from 'node:crypto';

const WINDOW_MS = 5 * 60 * 1000;

function timingSafeEqualHex(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  try {
    const ba = Buffer.from(a, 'hex');
    const bb = Buffer.from(b, 'hex');
    if (ba.length !== bb.length) return false;
    return crypto.timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

/**
 * @returns {Promise<{ error?: string, status?: number, prisma?: import('@prisma/client').PrismaClient, tenant?: object, membership?: object, userId?: string, role?: string }>}
 */
export async function resolveBffTenantContext(req, prisma) {
  const secret = process.env.ORION_BFF_SECRET?.trim();
  const userId = req.headers['x-orion-user-id'];
  const tenantId = req.headers['x-orion-tenant-id'];
  const ts = req.headers['x-orion-ts'];
  const sig = req.headers['x-orion-signature'];

  if (!secret) {
    return { error: 'BFF_SECRET_UNCONFIGURED', status: 503 };
  }
  if (!userId || !tenantId || !ts || !sig) {
    return { error: 'MISSING_BFF_AUTH', status: 401 };
  }
  if (typeof userId !== 'string' || typeof tenantId !== 'string' || typeof ts !== 'string' || typeof sig !== 'string') {
    return { error: 'INVALID_BFF_AUTH', status: 401 };
  }

  const t = Number(ts);
  if (!Number.isFinite(t) || Math.abs(Date.now() - t) > WINDOW_MS) {
    return { error: 'STALE_BFF_AUTH', status: 401 };
  }

  const payload = `${userId}:${tenantId}:${ts}`;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  if (!timingSafeEqualHex(expected, sig)) {
    return { error: 'INVALID_BFF_SIGNATURE', status: 401 };
  }

  const membership = await prisma.membership.findUnique({
    where: { tenantId_userId: { tenantId, userId } },
  });

  if (!membership?.acceptedAt) {
    return { error: 'NO_MEMBERSHIP', status: 403 };
  }

  const tenant = await prisma.tenant.findFirst({
    where: { id: tenantId, deletedAt: null },
  });

  if (!tenant) {
    return { error: 'TENANT_NOT_FOUND', status: 404 };
  }

  return {
    prisma,
    tenant,
    membership,
    userId,
    role: membership.role,
  };
}
