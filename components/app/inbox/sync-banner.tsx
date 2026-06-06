'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'motion/react'

export interface SyncSnapshot {
  phase: 'pending' | 'indexing' | 'ready' | 'error'
  pending: number
  listingComplete: boolean
  lastError: string | null
}

const POLL_MS = 2500

/**
 * Indexing is intentionally invisible: the app looks ready immediately and the
 * agent answers from live Gmail search while the background index fills in. So
 * this component shows NOTHING for pending/indexing — it just quietly polls and,
 * when indexing completes, refreshes the page so semantic recall + the morning
 * brief light up. The only visible state is the error/reconnect banner.
 */
export function SyncBanner({ initial }: { initial: SyncSnapshot }) {
  const router = useRouter()
  const [phase, setPhase] = useState(initial.phase)
  const refreshed = useRef(false)

  const active = phase === 'pending' || phase === 'indexing'

  // Poll silently while setting up; flip local phase when it changes.
  useEffect(() => {
    if (!active) return
    let alive = true
    const tick = async () => {
      try {
        const res = await fetch('/api/sync-status', { cache: 'no-store' })
        if (!res.ok || !alive) return
        const next = (await res.json()) as SyncSnapshot
        if (alive) setPhase(next.phase)
      } catch {
        // transient — try again next tick
      }
    }
    const id = setInterval(tick, POLL_MS)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [active])

  // Reveal semantic recall + the brief once indexing finishes — silently.
  useEffect(() => {
    if (phase === 'ready' && !refreshed.current) {
      refreshed.current = true
      router.refresh()
    }
  }, [phase, router])

  if (phase !== 'error') return null

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3"
    >
      <span className="text-sm text-amber-800">
        {initial.lastError === 'reconnect_required'
          ? 'Your Gmail connection expired. '
          : 'Sync hit a snag. '}
        <a href="/connect" className="font-medium underline underline-offset-4">
          Reconnect Gmail
        </a>
      </span>
    </motion.div>
  )
}
