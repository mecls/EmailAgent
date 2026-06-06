import { inngest } from '../client'
import { getThreadMessages, upsertThread } from '@/lib/db/threads'
import { deriveThread } from '@/lib/classify'

/**
 * Recompute per-thread reply state (last_message_at, last_direction, status) from
 * all of a thread's currently-indexed messages, and upsert `threads`. Re-runs
 * are safe and converge: a later batch touching the same thread re-enqueues this.
 */
export const indexDeriveStatus = inngest.createFunction(
  {
    id: 'index-derive-status',
    concurrency: { key: 'event.data.accountId', limit: 5 },
    retries: 3,
  },
  { event: 'index.derive-status' },
  async ({ event, step }) => {
    const { accountId, threadIds } = event.data

    await step.run('derive', async () => {
      for (const threadId of threadIds) {
        const messages = await getThreadMessages(accountId, threadId)
        if (messages.length === 0) continue
        const latest = [...messages].sort((a, b) =>
          (a.sent_at ?? '').localeCompare(b.sent_at ?? ''),
        )[messages.length - 1]
        const derived = deriveThread(messages)
        await upsertThread({
          account_id: accountId,
          thread_id: threadId,
          subject: latest.subject ?? null,
          ...derived,
        })
      }
      return { threads: threadIds.length }
    })

    return { accountId, threads: threadIds.length }
  },
)
