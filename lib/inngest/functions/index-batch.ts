import { inngest } from '../client'
import { getAccessToken } from '@/lib/google/oauth'
import { getMessage } from '@/lib/google/gmail'
import { direction, isAutomated } from '@/lib/classify'
import { stripQuoted, chunkText } from '@/lib/chunk'
import { embedBatch } from '@/lib/embeddings'
import {
  upsertMessages,
  getOwnerEmails,
  type MessageUpsert,
} from '@/lib/db/messages'
import {
  upsertEmbeddings,
  deleteEmbeddingsForMessages,
  type EmbeddingUpsert,
} from '@/lib/db/embeddings'
import { completeMessages, getSyncState, markSyncReady } from '@/lib/db/sync'

/**
 * Process ≤50 messages: fetch (format=full), classify, upsert metadata
 * (index-light — no body stored), embed the body chunks, and enqueue
 * derive-status for affected threads. Idempotent on (account_id, gmail_id).
 *
 * Fetch + embed happen in ONE step so the full bodies stay in memory and are
 * never serialized into step output (they're discarded after embedding).
 */
export const indexBatch = inngest.createFunction(
  {
    id: 'index-batch',
    // Edge embed load = this × embeddings CONCURRENCY; keep the product modest or
    // the embed function 546s (WORKER_RESOURCE_LIMIT). 3 × 2 = 6 peak in flight.
    concurrency: { key: 'event.data.accountId', limit: 3 },
    retries: 3,
  },
  { event: 'index.batch' },
  async ({ event, step }) => {
    const { accountId, ids, drain } = event.data

    const threadIds: string[] = await step.run('process', async () => {
      const token = await getAccessToken(accountId)
      const ownerEmails = await getOwnerEmails(accountId)

      const parsed = []
      for (const id of ids) {
        try {
          parsed.push(await getMessage(token, id))
        } catch (e) {
          console.error(`[index-batch] getMessage ${id} failed`, e)
        }
      }
      if (parsed.length === 0) return []

      const rows: MessageUpsert[] = parsed.map((p) => ({
        account_id: accountId,
        gmail_id: p.gmailId,
        thread_id: p.threadId,
        from_addr: p.from,
        from_name: p.fromName,
        to_addrs: p.to,
        to_names: p.toNames,
        sent_at: p.sentAt,
        subject: p.subject,
        snippet: p.snippet,
        direction: direction(p.from, ownerEmails),
        is_automated: isAutomated({
          from: p.from,
          listUnsubscribe: p.listUnsubscribe,
          labels: p.labels,
        }),
        labels: p.labels,
      }))

      const upserted = await upsertMessages(rows)
      const idByGmail = new Map(upserted.map((u) => [u.gmail_id, u.id]))

      // Build chunks across all messages, then embed them. Each message's text
      // is prefixed with a From/To/Subject identity header so semantic search can
      // surface a person by name ("catch me up on Miguel Rolo") — the raw body
      // rarely repeats the sender's name, so without this the embedding has no
      // who-signal at all.
      const chunkRows: Omit<EmbeddingUpsert, 'embedding'>[] = []
      for (const p of parsed) {
        const messageId = idByGmail.get(p.gmailId)
        if (!messageId) continue
        const fromLine = p.fromName
          ? `${p.fromName} <${p.from ?? ''}>`
          : (p.from ?? '')
        const toLine = p.to
          .map((addr, i) => (p.toNames[i] ? `${p.toNames[i]} <${addr}>` : addr))
          .join(', ')
        const header = [
          fromLine && `From: ${fromLine}`,
          toLine && `To: ${toLine}`,
          p.subject && `Subject: ${p.subject}`,
        ]
          .filter(Boolean)
          .join('\n')
        const base = [header, stripQuoted(p.bodyText)]
          .filter(Boolean)
          .join('\n\n')
        chunkText(base).forEach((content, idx) => {
          chunkRows.push({
            account_id: accountId,
            message_id: messageId,
            chunk_idx: idx,
            content,
          })
        })
      }

      if (chunkRows.length > 0) {
        const vectors = await embedBatch(chunkRows.map((c) => c.content))
        const messageIds = [...new Set(chunkRows.map((c) => c.message_id))]
        await deleteEmbeddingsForMessages(messageIds) // re-index idempotency
        await upsertEmbeddings(
          chunkRows.map((c, i) => ({ ...c, embedding: vectors[i] })),
        )
      }

      return [...new Set(upserted.map((u) => u.thread_id))]
    })

    if (threadIds.length > 0) {
      await step.sendEvent('derive-status', {
        name: 'index.derive-status',
        data: { accountId, threadIds },
      })
    }

    // Drain accounting only for full-sync batches. Decrement by the count that
    // was added (ids.length), regardless of per-message fetch failures.
    if (drain) {
      const finalized: boolean = await step.run('complete', async () => {
        const remaining = await completeMessages(accountId, ids.length)
        if (remaining <= 0) {
          const state = await getSyncState(accountId)
          if (state?.listing_complete) {
            await markSyncReady(accountId)
            return true
          }
        }
        return false
      })
      if (finalized) {
        await step.sendEvent('first-brief', {
          name: 'brief.generate',
          data: { accountId },
        })
      }
    }

    return { accountId, threads: threadIds.length }
  },
)
