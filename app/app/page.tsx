import { redirect } from 'next/navigation'
import { getUser, requireAccountId } from '@/lib/auth/session'
import { getLatestBrief } from '@/lib/db/briefs'
import { getAllConfig } from '@/lib/db/config'
import { getSyncState, type SyncPhase } from '@/lib/db/sync'
import { signOut } from '@/app/actions/auth'
import { runBriefNow } from '@/app/actions/briefs'
import { ChatPanel } from '@/components/app/chat/chat-panel'
import { SyncBanner } from '@/components/app/inbox/sync-banner'
import {
  ScheduleControls,
  type ScheduleState,
} from '@/components/app/brief/schedule-controls'
import { SITE_CONFIG } from '@/lib/site-config'

/** A friendly given name for greetings, derived from the user's email. */
function friendlyName(email: string | undefined): string {
  const local = (email ?? '').split('@')[0]?.split(/[._+-]/)[0] ?? ''
  return local ? local.charAt(0).toUpperCase() + local.slice(1) : 'there'
}

interface BriefItem {
  group: string
  line: string
}

const GROUP_ORDER = ['Leads', 'Clients', 'Ops', 'To sign']

export default async function AppPage() {
  const user = await getUser()
  if (!user) redirect('/')
  const { accountId } = await requireAccountId()

  const [sync, brief, config] = await Promise.all([
    getSyncState(accountId),
    getLatestBrief(accountId),
    getAllConfig(accountId),
  ])

  const phase = (sync?.phase as string | undefined) ?? 'pending'
  const firstName = friendlyName(user.email ?? undefined)
  const items = (brief?.items as BriefItem[] | undefined) ?? []
  const groups = GROUP_ORDER.map((group) => ({
    group,
    lines: items.filter((i) => i.group === group).map((i) => i.line),
  })).filter((g) => g.lines.length > 0)

  const schedule: ScheduleState = {
    configured: typeof config.brief_time === 'string',
    time: typeof config.brief_time === 'string' ? config.brief_time : '08:00',
    timezone: typeof config.timezone === 'string' ? config.timezone : 'UTC',
    paused: config.brief_paused === true,
    recipient: user.email ?? 'your inbox',
  }

  return (
    <div className="min-h-screen">
      {/* Top navigation */}
      <header className="border-b border-neutral-200/70 bg-[var(--background)]/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-6 py-3.5">
          <div className="flex items-baseline gap-3">
            <span className="text-sm font-semibold tracking-tight text-neutral-900">
              {SITE_CONFIG.brand}
            </span>
            <span className="hidden text-xs text-neutral-400 sm:inline">
              Understand your inbox in minutes, not hours.
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-neutral-500 sm:inline">
              {user.email}
            </span>
            <span
              className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-200 text-xs font-medium text-neutral-600"
              aria-hidden
            >
              {(user.email ?? '?').charAt(0).toUpperCase()}
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

      <main className="mx-auto flex w-full max-w-5xl flex-col gap-12 px-6 py-10">
        {/* Chat with your inbox — the primary surface. */}
        <section className="flex flex-col gap-4">
          {phase !== 'ready' ? (
            <SyncBanner
              initial={{
                phase: phase as SyncPhase,
                pending: sync?.pending_messages ?? 0,
                listingComplete: sync?.listing_complete ?? false,
                lastError: sync?.last_error ?? null,
              }}
            />
          ) : null}

          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">
              Chat with your inbox
            </h2>
            <p className="mt-1 text-sm text-neutral-500">
              Ask follow-ups, catch up on your latest mail, or dig into anyone —
              answers from your mail, read-only.
            </p>
          </div>
          <ChatPanel phase={phase as SyncPhase} firstName={firstName} />
        </section>

        {/* Morning brief */}
        <section className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">
                Morning brief
              </h2>
              <p className="mt-1 text-sm text-neutral-500">
                Get a daily summary of your most important emails, delivered
                every morning.
              </p>
            </div>
            <form action={runBriefNow}>
              <button
                type="submit"
                className="shrink-0 rounded-lg border border-neutral-200 bg-white px-3.5 py-2 text-sm font-medium text-neutral-700 hover:border-neutral-300"
              >
                Run brief now
              </button>
            </form>
          </div>

          <ScheduleControls state={schedule} />

          {groups.length > 0 ? (
            <div className="rounded-2xl border border-neutral-200/80 bg-white p-5">
              <div className="flex flex-col gap-4">
                {groups.map((g) => (
                  <div key={g.group} className="flex flex-col gap-1.5">
                    <p className="text-xs font-semibold tracking-wide text-[var(--brand-accent)] uppercase">
                      {g.group}
                    </p>
                    {g.lines.map((line, i) => (
                      <p key={i} className="text-sm text-neutral-700">
                        {line}
                      </p>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="px-1 text-sm text-neutral-500">
              No brief yet — run one now, or check back after your next scheduled
              brief.
            </p>
          )}
        </section>
      </main>
    </div>
  )
}
