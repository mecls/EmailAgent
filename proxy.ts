import { type NextRequest } from 'next/server'
import { updateSession, redirectWithCookies } from '@/lib/supabase/proxy'

/**
 * Route protection (Next 16 renamed middleware → proxy). This is an *optimistic*
 * gate only: it refreshes the session and redirects obvious cases. Real
 * authorization (account scoping) is re-checked inside every Route Handler /
 * Server Action — never trust the proxy alone (per the Next 16 data-security
 * guidance). Do not set a `runtime` export here; it's forbidden in proxy.
 *
 * `/api/*` is excluded from the matcher: those handlers enforce their own auth
 * (the agent route via the session, the Inngest route via request signature) and
 * must not be 308'd to a GET login page mid-POST.
 */
export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request)
  const { pathname } = request.nextUrl

  const isPublic = pathname === '/' || pathname.startsWith('/auth/')

  if (!user && !isPublic) {
    return redirectWithCookies(new URL('/', request.url), response)
  }

  if (user && pathname === '/') {
    return redirectWithCookies(new URL('/app', request.url), response)
  }

  return response
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
}
