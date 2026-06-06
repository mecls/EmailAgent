import { Resend } from 'resend'
import { render } from '@react-email/components'
import { inngest } from '../client'
import { generateBrief } from '@/lib/commands/morning-brief'
import { getLatestBrief, createBrief, markBriefDelivered } from '@/lib/db/briefs'
import { supabaseService } from '@/lib/supabase/service'
import { MorningBriefEmail } from '@/emails/morning-brief'

const DEDUP_WINDOW_MS = 18 * 60 * 60 * 1000 // ~once per day

/**
 * Command A as a job: generate the brief, store it to the feed, and (if items +
 * Resend configured) email it. Idempotent per day for scheduled runs; manual
 * runs always generate.
 */
export const briefGenerate = inngest.createFunction(
  {
    id: 'brief-generate',
    concurrency: { key: 'event.data.accountId', limit: 1 },
    retries: 2,
  },
  { event: 'brief.generate' },
  async ({ event, step }) => {
    const { accountId, manual } = event.data

    const plan: { skip: boolean; since: string | null } = await step.run(
      'resolve-since',
      async () => {
        const latest = await getLatestBrief(accountId)
        if (!manual && latest) {
          const ageMs = Date.now() - new Date(latest.generated_at).getTime()
          if (ageMs < DEDUP_WINDOW_MS) return { skip: true, since: null }
        }
        const since =
          latest?.generated_at ??
          new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        return { skip: false, since }
      },
    )
    if (plan.skip) return { accountId, skipped: true }

    const brief = await step.run('generate', () =>
      generateBrief(accountId, plan.since ?? undefined),
    )

    const briefId: number = await step.run('store', async () => {
      const row = await createBrief(accountId, plan.since, brief.items)
      return row.id
    })

    await step.run('deliver', async () => {
      if (brief.items.length === 0) return { delivered: false }

      const resendKey = process.env.RESEND_API_KEY
      const fromEmail = process.env.BRIEF_FROM_EMAIL
      if (!resendKey || !fromEmail) {
        console.warn('[brief-generate] Resend not configured; brief stored only')
        return { delivered: false }
      }

      const { data: acct } = await supabaseService()
        .from('accounts')
        .select('owner_email')
        .eq('id', accountId)
        .maybeSingle()
      const to = (acct as { owner_email?: string } | null)?.owner_email
      if (!to) return { delivered: false }

      const html = await render(
        MorningBriefEmail({
          items: brief.items,
          date: new Date().toISOString().slice(0, 10),
        }),
      )
      const result = await new Resend(resendKey).emails.send({
        from: fromEmail,
        to,
        subject: 'Your morning brief',
        html,
      })
      if (result.error) {
        throw new Error(`Resend send failed: ${result.error.message}`)
      }
      await markBriefDelivered(briefId)
      return { delivered: true }
    })

    return { accountId, items: brief.items.length }
  },
)
