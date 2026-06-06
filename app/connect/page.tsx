import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { signInWithGoogle } from '@/app/actions/auth'
import { SetupSplash } from '@/components/connect/setup-splash'

export default async function ConnectPage() {
  const user = await getUser()
  if (!user) redirect('/')

  // RLS-scoped read of the caller's own sync state.
  const supabase = await createSupabaseServerClient()
  const { data: sync } = await supabase
    .from('sync_state')
    .select('phase, last_error')
    .limit(1)
    .maybeSingle()
  const phase = (sync?.phase as string | undefined) ?? 'pending'

  // The reconnect case must be actionable; everything else is just the brief
  // post-connect splash that auto-advances into the app.
  if (phase === 'error') {
    return (
      <main className="pt-safe pb-safe mx-auto flex min-h-[100dvh] w-full max-w-md flex-col justify-center gap-5 px-6">
        <p className="eyebrow">Reconnect required</p>
        <h1 className="font-serif-italic text-3xl">Your Gmail link expired</h1>
        <p className="text-sm text-neutral-600">
          Re-grant read-only access to keep your inbox up to date. (In testing
          mode, Google expires the grant every 7 days.)
        </p>
        <form action={signInWithGoogle}>
          <button
            type="submit"
            className="cta-shadow inline-flex w-full items-center justify-center rounded-full bg-[var(--brand-accent)] px-5 py-3 text-sm font-medium text-[var(--brand-accent-foreground)]"
          >
            Reconnect Gmail
          </button>
        </form>
      </main>
    )
  }

  return <SetupSplash email={user.email} />
}
