import { inngest } from '../client'

/**
 * M0 sanity cron. Confirms the Inngest app is registered and scheduled
 * functions fire on this deployment. Safe to delete once the real pipeline is
 * verified end to end.
 */
export const hello = inngest.createFunction(
  { id: 'hello' },
  { cron: '*/30 * * * *' },
  async ({ step }) => {
    await step.run('log', async () => {
      console.log(`[hello] emailagent inngest cron alive @ ${new Date().toISOString()}`)
      return { ok: true }
    })
    return { ok: true }
  },
)
