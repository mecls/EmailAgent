import { inngest } from '../client'
import { supabaseService } from '@/lib/supabase/service'

/** Does `now` fall in the same 15-min slice as briefTime in the given tz? */
function matchesSlice(now: Date, tz: string, briefTime: string): boolean {
  let hh: number
  let mm: number
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(now)
    hh = Number(parts.find((p) => p.type === 'hour')?.value ?? '0') % 24
    mm = Number(parts.find((p) => p.type === 'minute')?.value ?? '0')
  } catch {
    return false // invalid timezone string
  }
  const [bh, bm] = briefTime.split(':').map((n) => Number(n))
  return hh === bh && Math.floor(mm / 15) === Math.floor((bm || 0) / 15)
}

/**
 * Every 15 minutes, fan out brief.generate for accounts whose local brief_time
 * falls in the current slice. brief.generate is idempotent per day, so an
 * occasional double-trigger near a slice boundary is harmless.
 */
export const briefScheduler = inngest.createFunction(
  { id: 'brief-scheduler' },
  { cron: '*/15 * * * *' },
  async ({ step }) => {
    const due: string[] = await step.run('select-due', async () => {
      const { data, error } = await supabaseService()
        .from('config')
        .select('account_id, key, value')
        .in('key', ['brief_time', 'timezone', 'brief_paused'])
      if (error) throw new Error(`select-due failed: ${error.message}`)

      const byAccount = new Map<
        string,
        { brief_time?: string; timezone?: string; paused?: boolean }
      >()
      for (const row of data ?? []) {
        const cfg = byAccount.get(row.account_id as string) ?? {}
        if (row.key === 'brief_time') cfg.brief_time = String(row.value)
        if (row.key === 'timezone') cfg.timezone = String(row.value)
        if (row.key === 'brief_paused') cfg.paused = row.value === true
        byAccount.set(row.account_id as string, cfg)
      }

      const now = new Date()
      const ids: string[] = []
      for (const [accountId, cfg] of byAccount) {
        if (cfg.paused) continue
        if (matchesSlice(now, cfg.timezone || 'UTC', cfg.brief_time || '08:00')) {
          ids.push(accountId)
        }
      }
      return ids
    })

    if (due.length > 0) {
      await step.sendEvent(
        'fanout',
        due.map((accountId) => ({
          name: 'brief.generate' as const,
          data: { accountId },
        })),
      )
    }

    return { due: due.length }
  },
)
