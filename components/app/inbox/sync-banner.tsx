'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'motion/react'
import { CheckCircle2, Loader2 } from 'lucide-react'

export interface SyncSnapshot {
  phase: 'pending' | 'indexing' | 'ready' | 'error'
  pending: number
  listingComplete: boolean
  lastError: string | null
}

interface View extends SyncSnapshot {
  /** Progress 0–100, or null while still listing (indeterminate). */
  pct: number | null
  /** Friendly ETA like "about 2 min", or null when not yet estimable. */
  eta: string | null
}

const POLL_MS = 2500
const SAMPLE_WINDOW = 8

/** "about 2 min", "under a minute", "a few seconds" — friendly, never precise. */
function formatEta(seconds: number): string {
  if (seconds <= 12) return 'a few seconds'
  if (seconds < 60) return 'under a minute'
  const mins = Math.round(seconds / 60)
  return `about ${mins} min`
}

/**
 * Live indexing banner. Seeded with a server snapshot (no flash), it polls the
 * sync status while the inbox is still setting up, drawing a progress bar from
 * the peak backlog and estimating an ETA from how fast the backlog is draining.
 * When indexing finishes it shows a brief "ready" state, then refreshes the page.
 */
export function SyncBanner({ initial }: { initial: SyncSnapshot }) {
  const router = useRouter()
  const [view, setView] = useState<View>({ ...initial, pct: null, eta: null })
  const peak = useRef(initial.pending)
  const samples = useRef<{ t: number; pending: number }[]>([])
  const refreshed = useRef(false)

  const active = view.phase === 'pending' || view.phase === 'indexing'

  // Poll while the inbox is still setting up; derive progress + ETA off-render.
  useEffect(() => {
    if (!active) return
    let alive = true
    const tick = async () => {
      try {
        const res = await fetch('/api/sync-status', { cache: 'no-store' })
        if (!res.ok || !alive) return
        const next = (await res.json()) as SyncSnapshot
        if (!alive) return

        peak.current = Math.max(peak.current, next.pending)

        let pct: number | null = null
        let eta: string | null = null
        if (next.listingComplete && peak.current > 0) {
          pct = Math.min(
            99,
            Math.max(3, ((peak.current - next.pending) / peak.current) * 100),
          )
          samples.current.push({ t: Date.now(), pending: next.pending })
          if (samples.current.length > SAMPLE_WINDOW) samples.current.shift()

          const s = samples.current
          if (s.length >= 2) {
            const dropped = s[0].pending - s[s.length - 1].pending
            const elapsed = (s[s.length - 1].t - s[0].t) / 1000
            if (dropped > 0 && elapsed > 0) {
              eta = formatEta(next.pending / (dropped / elapsed))
            }
          }
        }

        setView({ ...next, pct, eta })
      } catch {
        // transient — keep the last good view and try again next tick
      }
    }
    const id = setInterval(tick, POLL_MS)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [active])

  // When indexing finishes, reveal the rest of the app (greeting, brief, etc.).
  useEffect(() => {
    if (view.phase === 'ready' && !refreshed.current) {
      refreshed.current = true
      const id = setTimeout(() => router.refresh(), 1600)
      return () => clearTimeout(id)
    }
  }, [view.phase, router])

  if (view.phase === 'ready') {
    return (
      <Shell tone="ready">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
        <span className="text-sm font-medium text-emerald-800">
          Your inbox is ready.
        </span>
      </Shell>
    )
  }

  if (view.phase === 'error') {
    return (
      <Shell tone="error">
        <span className="text-sm text-amber-800">
          {view.lastError === 'reconnect_required'
            ? 'Your Gmail connection expired. '
            : 'Sync hit a snag. '}
          <a
            href="/connect"
            className="font-medium underline underline-offset-4"
          >
            Reconnect Gmail
          </a>
        </span>
      </Shell>
    )
  }

  // ── indexing / pending — the live state, as a compact hover-to-expand pill ──
  const detail = !view.listingComplete
    ? 'Scanning your inbox…'
    : view.pending <= 0
      ? 'Wrapping up…'
      : view.eta
        ? `${view.pending.toLocaleString()} email${view.pending === 1 ? '' : 's'} to go · ${view.eta} left`
        : `${view.pending.toLocaleString()} email${view.pending === 1 ? '' : 's'} to go`

  // Short label for the collapsed pill — count only, no ETA.
  const summary =
    view.listingComplete && view.pending > 0
      ? `· ${view.pending.toLocaleString()} to go`
      : null

  return <BusyPill summary={summary} detail={detail} pct={view.pct} />
}

/**
 * Collapsed-by-default sync indicator: a small pill that floats a details
 * popover (progress bar, ETA, and a "start asking now" hint) on hover, tap, or
 * keyboard focus — so the chat stays the first thing on the page.
 */
function BusyPill({
  summary,
  detail,
  pct,
}: {
  summary: string | null
  detail: string
  pct: number | null
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const panelId = useId()

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <motion.div
      ref={wrapRef}
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="relative w-fit"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocusCapture={() => setOpen(true)}
      onBlurCapture={(e) => {
        if (!wrapRef.current?.contains(e.relatedTarget as Node)) setOpen(false)
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-700 hover:border-neutral-300"
      >
        <Loader2
          className="h-3.5 w-3.5 shrink-0 animate-spin text-[var(--brand-accent)]"
          aria-hidden
        />
        <span className="font-medium text-neutral-800">
          Setting up your inbox
        </span>
        {summary ? (
          <span className="text-neutral-500">{summary}</span>
        ) : null}
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            id={panelId}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 z-20 mt-2 flex w-fit max-w-[28rem] min-w-[20rem] flex-col gap-2.5 rounded-xl border border-neutral-200 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_32px_-16px_rgba(0,0,0,0.12)]"
          >
            <p className="text-xs text-neutral-500">
              You can start asking now — answers sharpen as it finishes.
            </p>
            <ProgressBar pct={pct} />
            <p className="text-xs text-neutral-500">{detail}</p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  )
}

function ProgressBar({ pct }: { pct: number | null }) {
  return (
    <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-neutral-200/80">
      {pct === null ? (
        // Indeterminate: a highlight sweeping across while we're still listing.
        <motion.div
          className="absolute inset-y-0 w-1/3 rounded-full bg-[var(--brand-accent)]"
          animate={{ x: ['-110%', '320%'] }}
          transition={{ duration: 1.4, ease: 'easeInOut', repeat: Infinity }}
        />
      ) : (
        <motion.div
          className="h-full rounded-full bg-[var(--brand-accent)]"
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      )}
    </div>
  )
}

function Shell({
  tone,
  children,
}: {
  tone: 'busy' | 'ready' | 'error'
  children: React.ReactNode
}) {
  const cls =
    tone === 'error'
      ? 'border-amber-200 bg-amber-50'
      : tone === 'ready'
        ? 'border-emerald-200 bg-emerald-50'
        : 'border-neutral-200 bg-white'
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`flex items-center gap-2.5 rounded-xl border px-4 py-3 ${cls}`}
    >
      {children}
    </motion.div>
  )
}
