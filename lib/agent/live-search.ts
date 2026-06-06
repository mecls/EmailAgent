import { getAccessToken } from '@/lib/google/oauth'
import {
  listMessageIds,
  getMessageMetadata,
  buildGmailQuery,
} from '@/lib/google/gmail'
import { mapPool } from '@/lib/pool'

/**
 * A live Gmail search hit — mirrors the fields of an indexed SearchHit (minus the
 * similarity score) so the model sees a uniform shape across both tools.
 */
export interface LiveHit {
  gmail_id: string
  subject: string | null
  from_addr: string | null
  from_name: string | null
  sent_at: string | null
  snippet: string | null
}

export interface LiveSearchOpts {
  query: string
  sender?: string
  since?: string
  until?: string
  limit?: number
}

/** How many metadata fetches to run at once for one live search. */
const FETCH_CONCURRENCY = 5

/**
 * Search the user's FULL Gmail history live (covers mail older than the indexed
 * window). Uses Gmail's own keyword search, then fetches metadata (headers +
 * snippet, no body) for the top matches. The accountId is server-derived by the
 * caller — never model-supplied — so the search is always scoped to the user.
 */
export async function searchGmailLive(
  accountId: string,
  opts: LiveSearchOpts,
): Promise<LiveHit[]> {
  const limit = Math.min(Math.max(opts.limit ?? 10, 1), 10)
  const token = await getAccessToken(accountId)
  const query = buildGmailQuery({
    query: opts.query,
    sender: opts.sender,
    after: opts.since,
    before: opts.until,
  })
  const { ids } = await listMessageIds(token, { query, maxResults: limit })
  if (ids.length === 0) return []

  const hits = await mapPool(
    ids,
    FETCH_CONCURRENCY,
    async (ref): Promise<LiveHit | null> => {
      try {
        const m = await getMessageMetadata(token, ref.id)
        return {
          gmail_id: m.gmailId,
          subject: m.subject,
          from_addr: m.from,
          from_name: m.fromName,
          sent_at: m.sentAt,
          snippet: m.snippet,
        }
      } catch (e) {
        console.error(`[live-search] getMessageMetadata ${ref.id} failed`, e)
        return null
      }
    },
  )
  return hits.filter((h): h is LiveHit => h !== null)
}
