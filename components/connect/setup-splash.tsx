'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'motion/react'
import { CheckCircle2, Loader2 } from 'lucide-react'

const SETUP_MS = 3500
const DONE_MS = 2500

/**
 * Brief, reassuring post-connect splash. The real work (storing credentials,
 * kicking off the background index) already happened in the auth callback, so
 * this is purely cosmetic: show "setting up", then "all set", then drop the user
 * into the app. Indexing keeps running in the background and is never surfaced.
 */
export function SetupSplash({ email }: { email?: string | null }) {
  const router = useRouter()
  const [stage, setStage] = useState<'setup' | 'done'>('setup')

  useEffect(() => {
    const toDone = setTimeout(() => setStage('done'), SETUP_MS)
    const toApp = setTimeout(() => router.push('/app'), SETUP_MS + DONE_MS)
    return () => {
      clearTimeout(toDone)
      clearTimeout(toApp)
    }
  }, [router])

  return (
    <main className="pt-safe pb-safe mx-auto flex min-h-[100dvh] w-full max-w-md flex-col justify-center gap-5 px-6">
      <AnimatePresence mode="wait">
        {stage === 'setup' ? (
          <motion.div
            key="setup"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25 }}
            className="flex flex-col gap-5"
          >
            <p className="eyebrow flex items-center gap-2">
              <Loader2
                className="h-3.5 w-3.5 animate-spin text-[var(--brand-accent)]"
                aria-hidden
              />
              Setting up
            </p>
            <h1 className="font-serif-italic text-3xl">
              Setting up your account
            </h1>
            <p className="text-sm text-neutral-600">
              {email ? `Signed in as ${email}. ` : ''}Getting your inbox ready —
              this only takes a moment.
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="done"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25 }}
            className="flex flex-col gap-5"
          >
            <p className="eyebrow flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
              All set
            </p>
            <h1 className="font-serif-italic text-3xl">You&rsquo;re all set</h1>
            <p className="text-sm text-neutral-600">
              Taking you to your inbox agent. We&rsquo;ll keep things up to date
              in the background.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  )
}
