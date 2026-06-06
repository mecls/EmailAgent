import { inngest } from '../client'
import { supabaseService } from '@/lib/supabase/service'

/**
 * Every 15 minutes, fan out an incremental sync for each ready account. Keeping
 * the per-account work in its own function bounds each step and lets concurrency
 * keys serialize per tenant.
 */
export const freshnessPoll = inngest.createFunction(
  { id: 'freshness-poll' },
  { cron: '*/15 * * * *' },
  async ({ step }) => {
    const accountIds: string[] = await step.run('select-accounts', async () => {
      const { data, error } = await supabaseService()
        .from('sync_state')
        .select('account_id')
        .eq('phase', 'ready')
      if (error) throw new Error(`select-accounts failed: ${error.message}`)
      return (data ?? []).map((r) => r.account_id as string)
    })

    if (accountIds.length > 0) {
      await step.sendEvent(
        'fanout',
        accountIds.map((accountId) => ({
          name: 'freshness.account' as const,
          data: { accountId },
        })),
      )
    }

    return { accounts: accountIds.length }
  },
)
