import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { signInWithGoogle } from '@/app/actions/auth'

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

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-5 px-6">
      {phase === 'error' ? (
        <>
          <p className="eyebrow">Reconnect required</p>
          <h1 className="font-serif-italic text-3xl">Your Gmail link expired</h1>
          <p className="text-sm text-neutral-600">
            Re-grant read-only access to keep your inbox indexed. (In testing
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
        </>
      ) : (
        <>
          <p className="eyebrow">
            {phase === 'ready' ? 'Connected' : 'Connecting Gmail'}
          </p>
          <h1 className="font-serif-italic text-3xl">
            {phase === 'ready'
              ? "You're all set"
              : "We're indexing your inbox"}
          </h1>
          <p className="text-sm text-neutral-600">
            Signed in as {user.email}.{' '}
            {phase === 'ready'
              ? 'Your inbox is indexed and kept fresh automatically.'
              : 'We’re reading the last 90 days in the background — usually a few minutes. Your first morning brief appears automatically when it’s ready.'}
          </p>
          <Link
            href="/app"
            className="text-sm font-medium text-[var(--brand-accent)] underline underline-offset-4"
          >
            Go to your inbox agent →
          </Link>
        </>
      )}
    </main>
  )
}
