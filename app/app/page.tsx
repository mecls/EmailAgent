import { redirect } from 'next/navigation'
import { getUser, requireAccountId } from '@/lib/auth/session'
import { getLatestBrief } from '@/lib/db/briefs'
import { getAllConfig } from '@/lib/db/config'
import { getSyncState, type SyncPhase } from '@/lib/db/sync'
import { signOut } from '@/app/actions/auth'
import { runBriefNow } from '@/app/actions/briefs'
import { AppShell } from '@/components/app/app-shell'
import type { ScheduleState } from '@/components/app/brief/schedule-controls'

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

  const phase = ((sync?.phase as string | undefined) ?? 'pending') as SyncPhase
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
    <AppShell
      email={user.email ?? ''}
      firstName={firstName}
      phase={phase}
      syncInitial={{
        phase,
        pending: sync?.pending_messages ?? 0,
        listingComplete: sync?.listing_complete ?? false,
        lastError: sync?.last_error ?? null,
      }}
      schedule={schedule}
      groups={groups}
      signOut={signOut}
      runBriefNow={runBriefNow}
    />
  )
}
