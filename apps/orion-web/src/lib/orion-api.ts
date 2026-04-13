import "server-only";

import { createHmac } from "node:crypto";
import { auth } from "@/auth";

export type OrionErrorBody = { error?: { code?: string; message?: string } };

function apiBase() {
  return (
    process.env.ORION_API_BASE ||
    process.env.NEXT_PUBLIC_ORION_API_BASE ||
    "http://127.0.0.1:4000"
  ).replace(/\/$/, "");
}

function signBff(userId: string, tenantId: string, ts: string, secret: string) {
  const payload = `${userId}:${tenantId}:${ts}`;
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export type OrionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string };

/**
 * Server-only: Auth.js-sessie + HMAC voor Express /v1/app.
 */
export async function orionGet<T>(path: string): Promise<OrionResult<T>> {
  const session = await auth();
  if (!session?.user?.id || !session.user.tenantId) {
    return {
      ok: false,
      error: "Niet ingelogd of geen workspace in sessie.",
      code: "UNAUTHORIZED",
    };
  }

  const secret = process.env.ORION_BFF_SECRET?.trim();
  if (!secret) {
    return {
      ok: false,
      error: "ORION_BFF_SECRET ontbreekt in .env.local — zelfde waarde als backend.",
      code: "MISCONFIG",
    };
  }

  const p = path.startsWith("/") ? path : `/${path}`;
  const url = `${apiBase()}${p}`;
  const ts = String(Date.now());
  const signature = signBff(session.user.id, session.user.tenantId, ts, secret);

  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "X-Orion-User-Id": session.user.id,
        "X-Orion-Tenant-Id": session.user.tenantId,
        "X-Orion-Ts": ts,
        "X-Orion-Signature": signature,
      },
      cache: "no-store",
    });
    const body = (await res.json().catch(() => ({}))) as T & OrionErrorBody;
    if (!res.ok) {
      const msg = body?.error?.message || `HTTP ${res.status}`;
      const code = body?.error?.code;
      return { ok: false, error: msg, code };
    }
    return { ok: true, data: body as T };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Netwerkfout";
    return { ok: false, error: msg, code: "NETWORK" };
  }
}
