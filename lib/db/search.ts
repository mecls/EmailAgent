import { supabaseService } from '@/lib/supabase/service'

function toVectorLiteral(v: number[]): string {
  return `[${v.join(',')}]`
}

export interface SearchHit {
  gmail_id: string
  subject: string | null
  from_addr: string | null
  from_name: string | null
  sent_at: string | null
  snippet: string | null
  score: number
}

/** Semantic search over an account's embeddings (server-derived account id). */
export async function searchEmbeddings(
  accountId: string,
  queryVec: number[],
  opts: { limit: number; sender?: string; since?: string },
): Promise<SearchHit[]> {
  const { data, error } = await supabaseService().rpc('search_embeddings', {
    p_account_id: accountId,
    p_query: toVectorLiteral(queryVec),
    p_limit: opts.limit,
    p_sender: opts.sender ?? null,
    p_since: opts.since ?? null,
  })
  if (error) throw new Error(`searchEmbeddings failed: ${error.message}`)
  return (data as SearchHit[]) ?? []
}

export interface ThreadHit {
  thread_id: string
  subject: string | null
  last_message_at: string | null
  last_direction: string | null
  status: string | null
}

export async function queryThreads(
  accountId: string,
  opts: { status: string; orderBy?: string; limit: number },
): Promise<ThreadHit[]> {
  // age_desc = oldest activity first (most overdue); date_desc = newest first.
  const ascending = opts.orderBy === 'age_desc'
  const { data, error } = await supabaseService()
    .from('threads')
    .select('thread_id, subject, last_message_at, last_direction, status')
    .eq('account_id', accountId)
    .eq('status', opts.status)
    .order('last_message_at', { ascending, nullsFirst: false })
    .limit(opts.limit)
  if (error) throw new Error(`queryThreads failed: ${error.message}`)
  return (data as ThreadHit[]) ?? []
}

export interface MessageHit {
  gmail_id: string
  thread_id: string
  from_addr: string | null
  from_name: string | null
  to_addrs: string[] | null
  subject: string | null
  snippet: string | null
  sent_at: string | null
  direction: string | null
  is_automated: boolean
}

export async function queryMessages(
  accountId: string,
  opts: {
    direction?: string
    isAutomated?: boolean
    sender?: string
    since?: string
    until?: string
    orderBy?: string
    limit: number
  },
): Promise<MessageHit[]> {
  let q = supabaseService()
    .from('messages')
    .select(
      'gmail_id, thread_id, from_addr, from_name, to_addrs, subject, snippet, sent_at, direction, is_automated',
    )
    .eq('account_id', accountId)

  if (opts.direction) q = q.eq('direction', opts.direction)
  if (opts.isAutomated !== undefined) q = q.eq('is_automated', opts.isAutomated)
  if (opts.sender) {
    // Match a person by display name OR email. Strip chars that are syntax in
    // PostgREST's or() mini-language so a name can't break the filter.
    const s = opts.sender.replace(/[,()]/g, ' ').trim()
    q = q.or(`from_addr.ilike.*${s}*,from_name.ilike.*${s}*`)
  }
  if (opts.since) q = q.gte('sent_at', opts.since)
  if (opts.until) q = q.lte('sent_at', opts.until)

  const ascending = opts.orderBy === 'age_desc'
  q = q.order('sent_at', { ascending, nullsFirst: false }).limit(opts.limit)

  const { data, error } = await q
  if (error) throw new Error(`queryMessages failed: ${error.message}`)
  return (data as MessageHit[]) ?? []
}

/**
 * Most recent inbound messages (automated included) — the raw input for the
 * "Ask your inbox" summary. Automated mail is kept so the summary can be honest
 * about how many of the last N emails were human-written vs. newsletters.
 */
export async function getRecentInbound(
  accountId: string,
  limit = 15,
): Promise<MessageHit[]> {
  const { data, error } = await supabaseService()
    .from('messages')
    .select(
      'gmail_id, thread_id, from_addr, from_name, to_addrs, subject, snippet, sent_at, direction, is_automated',
    )
    .eq('account_id', accountId)
    .eq('direction', 'inbound')
    .order('sent_at', { ascending: false, nullsFirst: false })
    .limit(limit)
  if (error) throw new Error(`getRecentInbound failed: ${error.message}`)
  return (data as MessageHit[]) ?? []
}

/** Non-automated messages since a timestamp — the morning brief's raw input. */
export async function getBriefMessages(
  accountId: string,
  since: string,
  limit = 120,
): Promise<MessageHit[]> {
  const { data, error } = await supabaseService()
    .from('messages')
    .select(
      'gmail_id, thread_id, from_addr, from_name, to_addrs, subject, snippet, sent_at, direction, is_automated',
    )
    .eq('account_id', accountId)
    .eq('is_automated', false)
    .gte('sent_at', since)
    .order('sent_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(`getBriefMessages failed: ${error.message}`)
  return (data as MessageHit[]) ?? []
}
