'use client'

import { useState } from 'react'
import { Sun } from 'lucide-react'
import type { SyncPhase } from '@/lib/db/sync'
import { ChatPanel } from '@/components/app/chat/chat-panel'
import { SyncBanner } from '@/components/app/inbox/sync-banner'
import { BriefContent, type BriefGroup } from '@/components/app/brief/brief-content'
import { BriefSheet } from '@/components/app/brief/brief-sheet'
import type { ScheduleState } from '@/components/app/brief/schedule-controls'
import { SITE_CONFIG } from '@/lib/site-config'

interface SyncInitial {
  phase: SyncPhase
  pending: number
  listingComplete: boolean
  lastError: string | null
}

/**
 * The signed-in app chrome. On mobile it's a full-height, app-like layout —
 * sticky header, full-screen chat with a pinned composer, and the morning brief
 * in a slide-up sheet. On desktop (lg+) it keeps the original centered two-section
 * layout (chat card + inline brief). The page stays a server component and passes
 * data + server actions (signOut, runBriefNow) down here.
 */
export function AppShell({
  email,
  firstName,
  phase,
  syncInitial,
  schedule,
  groups,
  signOut,
  runBriefNow,
}: {
  email: string
  firstName: string
  phase: SyncPhase
  syncInitial: SyncInitial
  schedule: ScheduleState
  groups: BriefGroup[]
  signOut: () => Promise<void>
  runBriefNow: () => Promise<void>
}) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const banner = phase !== 'ready' ? <SyncBanner initial={syncInitial} /> : null

  return (
    <div className="flex h-[100dvh] flex-col xl:h-auto xl:min-h-screen">
      {/* Top navigation — shared across mobile and desktop. */}
      <header className="pt-safe sticky top-0 z-10 shrink-0 border-b border-neutral-200/70 bg-[var(--background)]/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 pb-3.5 sm:px-6">
          <div className="flex min-w-0 items-baseline gap-3">
            <span className="text-sm font-semibold tracking-tight text-neutral-900">
              {SITE_CONFIG.brand}
            </span>
            <span className="hidden text-xs text-neutral-400 sm:inline">
              Understand your inbox in minutes, not hours.
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm sm:gap-3">
            {/* Mobile-only brief trigger (small icon); desktop shows it inline. */}
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              aria-label="Morning brief"
              className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-200/60 hover:text-neutral-700 xl:hidden"
            >
              <Sun className="h-5 w-5" aria-hidden />
            </button>
            <span className="hidden text-neutral-500 sm:inline">{email}</span>
            <span
              className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-200 text-xs font-medium text-neutral-600"
              aria-hidden
            >
              {(email || '?').charAt(0).toUpperCase()}
            </span>
            <form action={signOut}>
              <button
                type="submit"
                className="text-neutral-400 underline-offset-4 hover:text-neutral-700 hover:underline"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Mobile: full-screen chat that fills the viewport. */}
      <main className="flex min-h-0 flex-1 flex-col xl:hidden">
        {banner ? <div className="px-3 pt-3">{banner}</div> : null}
        <div className="flex min-h-0 flex-1 flex-col">
          <ChatPanel fill phase={phase} firstName={firstName} />
        </div>
      </main>

      {/* Desktop: original centered two-section layout. */}
      <main className="mx-auto hidden w-full max-w-5xl flex-col gap-12 px-6 py-10 xl:flex">
        <section className="flex flex-col gap-4">
          {banner}
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">
              Chat with your inbox
            </h2>
            <p className="mt-1 text-sm text-neutral-500">
              Ask follow-ups, catch up on your latest mail, or dig into anyone —
              answers from your mail, read-only.
            </p>
          </div>
          <ChatPanel phase={phase} firstName={firstName} />
        </section>

        <section className="flex flex-col gap-4">
          <BriefContent
            schedule={schedule}
            groups={groups}
            runBriefNow={runBriefNow}
          />
        </section>
      </main>

      {/* Mobile brief sheet. */}
      <BriefSheet open={sheetOpen} onClose={() => setSheetOpen(false)}>
        <BriefContent
          schedule={schedule}
          groups={groups}
          runBriefNow={runBriefNow}
        />
      </BriefSheet>
    </div>
  )
}
