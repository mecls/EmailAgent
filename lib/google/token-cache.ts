/**
 * In-memory Google access-token cache.
 *
 * Access tokens are NEVER persisted (no DB column exists for them by design).
 * This cache lives in the serverless instance's memory and is keyed by account;
 * cold starts simply refresh again. A 60s skew avoids handing out a token that
 * expires mid-request.
 */
interface Entry {
  token: string
  exp: number // epoch ms
}

const SKEW_MS = 60_000
const cache = new Map<string, Entry>()

export function getCachedToken(accountId: string): string | null {
  const hit = cache.get(accountId)
  if (hit && hit.exp - SKEW_MS > Date.now()) return hit.token
  return null
}

export function setCachedToken(
  accountId: string,
  token: string,
  expiresInSec: number,
): void {
  cache.set(accountId, { token, exp: Date.now() + expiresInSec * 1000 })
}

export function clearCachedToken(accountId: string): void {
  cache.delete(accountId)
}

/** Test helper: force the cached token to look expired (M2 acceptance check). */
export function expireCachedToken(accountId: string): void {
  const hit = cache.get(accountId)
  if (hit) hit.exp = 0
}
