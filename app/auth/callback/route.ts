import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { provisionAccount } from '@/lib/auth/provision'
import { storeGoogleRefresh } from '@/lib/vault'
import { upsertGoogleCredentials, hasGoogleCredentials } from '@/lib/db/credentials'
import { inngest } from '@/lib/inngest/client'
import { INDEX_WINDOW_DAYS } from '@/lib/inngest/functions/index-kickoff'
import { GMAIL_SCOPE } from '@/lib/google/scopes'

// Node runtime: uses the service-role SDK + Vault rpc. This is the ONLY place
// provider_refresh_token is available — Supabase does not persist or refresh it.
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  if (!code) {
    return NextResponse.redirect(new URL('/?error=missing_code', request.url))
  }

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)
  if (error || !data.session) {
    return NextResponse.redirect(new URL('/?error=oauth', request.url))
  }

  const session = data.session
  const user = session.user

  let accountId: string
  try {
    accountId = await provisionAccount(user)
  } catch (e) {
    console.error('[callback] provisionAccount failed', e)
    return NextResponse.redirect(new URL('/?error=provision', request.url))
  }

  // provider_refresh_token is present ONLY here, immediately after the exchange.
  const refresh = session.provider_refresh_token
  if (refresh) {
    try {
      const secretId = await storeGoogleRefresh(accountId, refresh)
      const meta = user.user_metadata ?? {}
      await upsertGoogleCredentials({
        accountId,
        googleSub:
          (meta.sub as string | undefined) ??
          (meta.provider_id as string | undefined) ??
          null,
        email: user.email ?? null,
        refreshSecretId: secretId,
        scope: GMAIL_SCOPE,
      })
    } catch (e) {
      console.error('[callback] storing credentials failed', e)
      return NextResponse.redirect(new URL('/?error=store', request.url))
    }

    // Kick off indexing (non-blocking). Don't fail sign-in if the worker isn't
    // wired up yet (the handler lands in M3).
    try {
      await inngest.send({
        name: 'index.kickoff',
        data: { accountId, sinceDays: INDEX_WINDOW_DAYS },
      })
    } catch (e) {
      console.error('[callback] index.kickoff enqueue failed', e)
    }

    return NextResponse.redirect(new URL('/connect', request.url))
  }

  // Re-login without a fresh consent (no refresh token). Keep existing creds.
  const dest = (await hasGoogleCredentials(accountId)) ? '/app' : '/connect'
  return NextResponse.redirect(new URL(dest, request.url))
}
