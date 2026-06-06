'use server'

import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { env } from '@/lib/env'
import { GMAIL_SCOPE } from '@/lib/google/scopes'

/**
 * Start Google sign-in bundling the gmail.readonly grant. `access_type=offline`
 * + `prompt=consent` forces Google to return a refresh_token, which we capture
 * in the callback. One consent does both login and the data grant.
 */
export async function signInWithGoogle() {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      scopes: GMAIL_SCOPE,
      redirectTo: `${env.appBaseUrl()}/auth/callback`,
      queryParams: { access_type: 'offline', prompt: 'consent' },
    },
  })
  if (error) throw new Error(`signInWithGoogle failed: ${error.message}`)
  if (data.url) redirect(data.url)
}

export async function signOut() {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()
  redirect('/')
}
