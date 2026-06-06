import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Server Supabase client (anon key + the caller's session cookies). Reads run
 * through RLS as the logged-in user. Safe in Server Components, Server Actions,
 * and Route Handlers.
 *
 * `setAll` is wrapped in try/catch: Server Components can't write cookies, and
 * that's fine — the proxy (lib/supabase/proxy.ts) refreshes the session on every
 * request. In Actions/Route Handlers the writes succeed.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(
          cookiesToSet: { name: string; value: string; options: CookieOptions }[],
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // Called from a Server Component — cookie writes are not allowed
            // there. The proxy handles session refresh, so this is safe.
          }
        },
      },
    },
  )
}
