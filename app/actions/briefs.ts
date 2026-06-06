'use server'

import { revalidatePath } from 'next/cache'
import { requireAccountId } from '@/lib/auth/session'
import { inngest } from '@/lib/inngest/client'
import { setConfig } from '@/lib/db/config'

/** "Run brief now" — enqueues a manual brief for the current user's account. */
export async function runBriefNow(): Promise<void> {
  const { accountId } = await requireAccountId()
  await inngest.send({
    name: 'brief.generate',
    data: { accountId, manual: true },
  })
}

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/

/**
 * Save the morning-brief schedule (delivery time + timezone). Validates the
 * time as 24h HH:MM; the scheduler fans out per-account by matching local time.
 */
export async function saveBriefSchedule(formData: FormData): Promise<void> {
  const { accountId } = await requireAccountId()
  const time = String(formData.get('time') ?? '').trim()
  const timezone = String(formData.get('timezone') ?? '').trim()
  if (!TIME_RE.test(time)) throw new Error('invalid time')
  if (!timezone) throw new Error('missing timezone')

  await Promise.all([
    setConfig(accountId, 'brief_time', time),
    setConfig(accountId, 'timezone', timezone),
    setConfig(accountId, 'brief_paused', false),
  ])
  revalidatePath('/app')
}

/** Pause or resume the scheduled morning brief. */
export async function setBriefPaused(formData: FormData): Promise<void> {
  const { accountId } = await requireAccountId()
  const paused = String(formData.get('paused') ?? '') === 'true'
  await setConfig(accountId, 'brief_paused', paused)
  revalidatePath('/app')
}
