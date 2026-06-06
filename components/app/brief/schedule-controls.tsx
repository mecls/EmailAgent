'use client'

import { useState } from 'react'
import { Clock, Pause, Pencil, Play, Sun } from 'lucide-react'
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

/**
 * Morning-brief schedule: a clean summary row with Edit + Pause/Resume, or a
 * designed empty state inviting the user to schedule one. Writes go through the
 * brief server actions, which revalidate this page.
 */
export function ScheduleControls({ state }: { state: ScheduleState }) {
  const [editing, setEditing] = useState(false)
  const [time, setTime] = useState(state.time)
  // Timezone follows the user's browser so the brief lands at their local hour.
  // Lazily resolved once; only ever read inside the edit form (which mounts on a
  // client click), so there's no SSR/hydration value to mismatch.
  const [timezone] = useState(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || state.timezone
    } catch {
      return state.timezone
    }
  })

  if (editing) {
    return (
      <form
        action={saveBriefSchedule}
        onSubmit={() => setEditing(false)}
        className="flex flex-wrap items-end gap-3 rounded-xl border border-neutral-200 bg-white p-4"
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
  }

  if (!state.configured) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-neutral-200 bg-white px-6 py-8 text-center">
        <Sun className="h-6 w-6 text-[var(--brand-accent)]" aria-hidden />
        <p className="text-sm text-neutral-600">
          You don’t have a morning brief scheduled yet.
        </p>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="rounded-lg bg-[var(--brand-accent)] px-4 py-2 text-sm font-medium text-[var(--brand-accent-foreground)] hover:opacity-95"
        >
          Schedule a morning brief
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
      <div className="flex items-center gap-2.5 text-sm text-neutral-700">
        <Clock className="h-4 w-4 text-neutral-400" aria-hidden />
        <span>
          Every day at{' '}
          <span className="font-medium text-neutral-900">{to12h(state.time)}</span>{' '}
          to {state.recipient}
        </span>
        {state.paused ? (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
            Paused
          </span>
        ) : null}
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700"
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden />
          Edit schedule
        </button>
        <form action={setBriefPaused}>
          <input
            type="hidden"
            name="paused"
            value={state.paused ? 'false' : 'true'}
          />
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700"
          >
            {state.paused ? (
              <>
                <Play className="h-3.5 w-3.5" aria-hidden />
                Resume
              </>
            ) : (
              <>
                <Pause className="h-3.5 w-3.5" aria-hidden />
                Pause
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
