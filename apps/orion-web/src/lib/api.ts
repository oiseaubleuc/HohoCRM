/**
 * API client for Orion Express backend (legacy helper).
 * Prefer `orion-api.ts` voor BFF-getekende calls naar `/v1/app`.
 * Env: NEXT_PUBLIC_ORION_API_BASE.
 */

const base = () =>
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_ORION_API_BASE) ||
  "http://127.0.0.1:4000";

export type ApiError = {
  error: { code: string; message: string; details?: Record<string, unknown> };
};

export async function apiGet<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${base()}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
    next: { revalidate: 0 },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as ApiError;
    throw new Error(body.error?.message || res.statusText);
  }
  return res.json() as Promise<T>;
}
