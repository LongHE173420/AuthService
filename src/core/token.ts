import { now } from "./time";
import type { Tokens } from "./types";

export const ACCESS_TTL_MS = 60_000;        // demo 1 phút
export const REFRESH_TTL_MS = 10 * 60_000;  // demo 10 phút

export function issueTokens(username: string, trust: boolean): Tokens {
  const t = now();
  return {
    accessToken: `access.${username}.${t}`,
    refreshToken: `refresh.${username}.${t}`,
    accessExp: t + ACCESS_TTL_MS,
    refreshExp: t + REFRESH_TTL_MS,
    trust
  };
}

export function tokenIssuedAt(token: string) {
  const parts = token.split(".");
  const ts = Number(parts[2]);
  return Number.isFinite(ts) ? ts : 0;
}

export function usernameFromToken(token: string): string {
  const parts = token.split(".");
  if (parts.length < 3) return "";
  return String(parts[1] ?? "").toLowerCase();
}

export function isAccessExpired(accessToken: string): boolean {
  const ts = tokenIssuedAt(accessToken);
  if (!ts) return true;
  return now() > ts + ACCESS_TTL_MS;
}

export function isRefreshExpired(refreshToken: string): boolean {
  const ts = tokenIssuedAt(refreshToken);
  if (!ts) return true;
  return now() > ts + REFRESH_TTL_MS;
}