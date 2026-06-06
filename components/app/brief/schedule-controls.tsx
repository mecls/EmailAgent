'use client'

import { useEffect, useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { Check, Clock, Loader2, Mail, Pencil, Play, Send, Sun } from 'lucide-react'
import { cn } from '@/lib/utils'
import { saveBriefSchedule, setBriefPaused } from '@/app/actions/briefs'

/** "08:00" → "8:00 AM". Falls back to the raw value if it isn't HH:MM. */
function to12h(time: string): string {
  const m = time.match(/^(\d{2}):(\d{2})$/)
  if (!m) return time
  const h = Number(m[1])
  const period = h < 12 ? 'AM' : 'PM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${m[2]} ${period}`
}

export interface ScheduleState {
  configured: boolean
  time: string // "HH:MM"
  timezone: string
  paused: boolean
  recipient: string
}

type Toast = { message: string; tone: 'success' | 'error' }

const PRIMARY_BTN =
  'inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand-accent)] px-4 py-2.5 text-sm font-medium text-[var(--brand-accent-foreground)] transition-opacity hover:opacity-95 disabled:opacity-60'

/** A standalone on/off switch (no surrounding <form>; toggles via a callback). */
function Switch({
  checked,
  disabled,
  onCheckedChange,
}: {
  checked: boolean
  disabled?: boolean
  onCheckedChange: (next: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label="Morning brief on or off"
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors disabled:opacity-60',
        checked ? 'bg-[var(--brand-accent)]' : 'bg-neutral-300',
      )}
    >
      <span
        className={cn(
          'inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-[18px]' : 'translate-x-0.5',
        )}
      />
    </button>
  )
}

/** A transient confirmation toast, portaled to <body> so the sheet's transform
 * doesn't anchor it. Auto-dismiss is handled by the parent. */
function ToastView({ toast }: { toast: Toast }) {
  if (typeof document === 'undefined') return null
  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 12 }}
        transition={{ duration: 0.18 }}
        className={cn(
          'pointer-events-auto flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium shadow-lg',
          toast.tone === 'success'
            ? 'bg-neutral-900 text-white'
            : 'bg-red-600 text-white',
        )}
      >
        {toast.tone === 'success' ? (
          <Check className="h-4 w-4" aria-hidden />
        ) : null}
        {toast.message}
      </motion.div>
    </div>,
    document.body,
  )
}

/**
 * Morning-brief manager: a status-first schedule card with an on/off switch and
 * inline Edit, plus a single state-dependent primary action (turn on / send now
 * / resume). Run/pause/resume give optimistic feedback via a toast; edits go
 * through the brief server actions, which revalidate this page.
 */
export function ScheduleControls({
  state,
  runBriefNow,
}: {
  state: ScheduleState
  runBriefNow: () => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [time, setTime] = useState(state.time)
  const [isRunning, startRun] = useTransition()
  const [isToggling, startToggle] = useTransition()
  const [toast, setToast] = useState<Toast | null>(null)

  // Timezone follows the user's browser so the brief lands at their local hour.
  // Lazily resolved once; only ever read inside the edit form.
  const [timezone] = useState(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || state.timezone
    } catch {
      return state.timezone
    }
  })

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3200)
    return () => clearTimeout(t)
  }, [toast])

  const on = state.configured && !state.paused

  function handleRun() {
    startRun(async () => {
      try {
        await runBriefNow()
        setToast({ message: `Brief sent to ${state.recipient}`, tone: 'success' })
      } catch {
        setToast({
          message: "Couldn't send your brief — try again in a moment.",
          tone: 'error',
        })
      }
    })
  }

  /** `paused` is the desired new value. */
  function handleSetPaused(paused: boolean) {
    startToggle(async () => {
      const fd = new FormData()
      fd.set('paused', paused ? 'true' : 'false')
      try {
        await setBriefPaused(fd)
        setToast({
          message: paused ? 'Morning brief paused' : 'Morning brief resumed',
          tone: 'success',
        })
      } catch {
        setToast({ message: "Couldn't update — try again.", tone: 'error' })
      }
    })
  }

  let body: React.ReactNode

  if (editing) {
    body = (
      <form
        action={saveBriefSchedule}
        onSubmit={() => setEditing(false)}
        className="flex flex-wrap items-end gap-3 rounded-2xl border border-neutral-200 bg-white p-4"
      >
        <label className="flex flex-col gap-1 text-xs font-medium text-neutral-600">
          Delivery time
          <input
            type="time"
            name="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            required
            className="rounded-lg border border-neutral-200 px-2.5 py-1.5 text-sm text-neutral-900 outline-none focus:border-[var(--brand-accent)]"
          />
        </label>
        <input type="hidden" name="timezone" value={timezone} />
        <span className="pb-2 text-xs text-neutral-400">{timezone}</span>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setTime(state.time)
              setEditing(false)
            }}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded-lg bg-[var(--brand-accent)] px-3 py-1.5 text-xs font-medium text-[var(--brand-accent-foreground)] hover:opacity-95"
          >
            Save schedule
          </button>
        </div>
      </form>
    )
  } else if (!state.configured) {
    body = (
      <div className="flex flex-col gap-3">
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-neutral-300 bg-white px-6 py-7 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--brand-accent)]/10">
            <Sun className="h-5 w-5 text-[var(--brand-accent)]" aria-hidden />
          </span>
          <p className="max-w-xs text-sm text-neutral-600">
            Start your day with a summary of what matters. We’ll send it at{' '}
            <span className="font-medium text-neutral-900">
              {to12h(state.time)}
            </span>{' '}
            — you can change the time anytime.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className={PRIMARY_BTN}
        >
          <Sun className="h-4 w-4" aria-hidden />
          Turn on Morning brief
        </button>
      </div>
    )
  } else {
    body = (
      <div className="flex flex-col gap-3">
        {/* Status-first schedule card. */}
        <div
          className={cn(
            'rounded-2xl border border-neutral-200 bg-white px-4 py-3.5 transition-opacity',
            on ? 'opacity-100' : 'opacity-70',
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-100">
                <Clock className="h-4 w-4 text-neutral-500" aria-hidden />
              </span>
              <div className="flex flex-col gap-0.5">
                <p className="text-[15px] leading-tight text-neutral-900">
                  <span className="font-semibold">{to12h(state.time)}</span>
                  <span className="text-neutral-500"> · Every day</span>
                </p>
                <p className="flex items-center gap-1.5 text-xs text-neutral-500">
                  <Mail className="h-3 w-3 shrink-0" aria-hidden />
                  <span className="break-all">{state.recipient}</span>
                </p>
              </div>
            </div>
            <Switch
              checked={on}
              disabled={isToggling}
              onCheckedChange={(next) => handleSetPaused(!next)}
            />
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-neutral-100 pt-2.5">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700"
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden />
              Edit
            </button>
            <span
              className={cn(
                'text-xs font-medium',
                on ? 'text-neutral-400' : 'text-amber-600',
              )}
            >
              {on ? 'Active' : 'Paused'}
            </span>
          </div>
        </div>

        {/* One state-dependent primary action. */}
        {state.paused ? (
          <button
            type="button"
            onClick={() => handleSetPaused(false)}
            disabled={isToggling}
            className={PRIMARY_BTN}
          >
            {isToggling ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Play className="h-4 w-4" aria-hidden />
            )}
            Resume brief
          </button>
        ) : (
          <button
            type="button"
            onClick={handleRun}
            disabled={isRunning}
            className={PRIMARY_BTN}
          >
            {isRunning ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Sending…
              </>
            ) : (
              <>
                <Send className="h-4 w-4" aria-hidden />
                Send today’s brief now
              </>
            )}
          </button>
        )}
      </div>
    )
  }

  return (
    <>
      {body}
      <AnimatePresence>
        {toast ? <ToastView toast={toast} /> : null}
      </AnimatePresence>
    </>
  )
}
