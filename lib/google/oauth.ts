import { env } from '@/lib/env'
import { readGoogleRefresh } from '@/lib/vault'
import { markSyncError } from '@/lib/db/sync'
import {
  getCachedToken,
  setCachedToken,
  clearCachedToken,
} from './token-cache'
import { ReconnectRequiredError } from './errors'

const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'

interface GoogleTokenResponse {
  access_token: string
  expires_in: number
  scope?: string
  token_type?: string
}

/**
 * Return a valid Gmail access token for an account, refreshing from Vault if the
 * cached one is missing/expired. Supabase does not refresh Google tokens — we do
 * it here against Google's token endpoint. Access tokens are cached in memory
 * only (see token-cache).
 *
 * Throws ReconnectRequiredError if the refresh token is invalid (and marks the
 * account's sync_state as `error`).
 */
export async function getAccessToken(accountId: string): Promise<string> {
  const cached = getCachedToken(accountId)
  if (cached) return cached
  return refreshAccessToken(accountId)
}

export async function refreshAccessToken(accountId: string): Promise<string> {
  const refreshToken = await readGoogleRefresh(accountId)

  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.googleClientId(),
      client_secret: env.googleClientSecret(),
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })

  const json: unknown = await res.json().catch(() => ({}))

  if (!res.ok) {
    const errorCode =
      typeof json === 'object' && json !== null && 'error' in json
        ? String((json as { error: unknown }).error)
        : 'unknown'
    if (errorCode === 'invalid_grant') {
      clearCachedToken(accountId)
      try {
        await markSyncError(accountId, 'reconnect_required')
      } catch (e) {
        console.error('[oauth] markSyncError failed', e)
      }
      throw new ReconnectRequiredError(accountId)
    }
    throw new Error(`google token refresh failed (${res.status}): ${errorCode}`)
  }

  const data = json as GoogleTokenResponse
  setCachedToken(accountId, data.access_token, data.expires_in)
  return data.access_token
}
