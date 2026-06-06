import { signInWithGoogle } from '@/app/actions/auth'
import { SITE_CONFIG } from '@/lib/site-config'

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  return (
    <main className="pt-safe pb-safe mx-auto flex min-h-[100dvh] w-full max-w-2xl flex-col justify-center gap-6 px-6">
      <p className="eyebrow">{SITE_CONFIG.wordmark}</p>
      <h1 className="font-serif-italic text-4xl text-balance sm:text-5xl">
        {SITE_CONFIG.tagline}
      </h1>
      <p className="max-w-prose text-neutral-600">{SITE_CONFIG.description}</p>

      {error ? (
        <p className="max-w-prose rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          Sign-in failed ({error}). Please try again.
        </p>
      ) : null}

      <form action={signInWithGoogle}>
        <button
          type="submit"
          className="cta-shadow inline-flex items-center rounded-full bg-[var(--brand-accent)] px-5 py-2.5 text-sm font-medium text-[var(--brand-accent-foreground)]"
        >
          Sign in with Google
        </button>
      </form>
    </main>
  )
}
