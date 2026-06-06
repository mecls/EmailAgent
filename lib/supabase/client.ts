'use client'

import { createBrowserClient } from '@supabase/ssr'

/**
 * Browser Supabase client (anon key). Used by client components to kick off
 * sign-in and read tenant data through RLS. PKCE is the default flow in
 * @supabase/ssr; the session lives in cookies.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
