export type Direction = 'inbound' | 'outbound'
export type ThreadStatus = 'awaiting_us' | 'awaiting_them' | 'closed'

/** Outbound if the sender is one of the account owner's addresses. */
export function direction(
  from: string | null,
  ownerEmails: Set<string>,
): Direction {
  if (from && ownerEmails.has(from.toLowerCase())) return 'outbound'
  return 'inbound'
}

const AUTOMATED_LABELS = new Set([
  'CATEGORY_PROMOTIONS',
  'CATEGORY_UPDATES',
  'CATEGORY_FORUMS',
])
const NOREPLY =
  /(no-?reply|do-?not-?reply|notifications?@|mailer-daemon|postmaster@|bounce)/i

/** Bulk/automated mail: has List-Unsubscribe, a no-reply sender, or bulk labels. */
export function isAutomated(args: {
  from: string | null
  listUnsubscribe: boolean
  labels: string[]
}): boolean {
  if (args.listUnsubscribe) return true
  if (args.from && NOREPLY.test(args.from)) return true
  if (args.labels.some((l) => AUTOMATED_LABELS.has(l))) return true
  return false
}

export interface ThreadMessage {
  sent_at: string | null
  direction: Direction | string | null
  is_automated: boolean
}

const STALE_DAYS = 30

/**
 * Derive a thread's reply state from its messages. Computed at index time so
 * "who's waiting on me" is a cheap lookup, not an LLM pass.
 * - awaiting_us:   last message inbound, not automated, recent
 * - awaiting_them: last message outbound (we replied)
 * - closed:        last inbound but automated, or inactive > STALE_DAYS
 */
export function deriveThread(messages: ThreadMessage[]): {
  last_message_at: string | null
  last_direction: Direction | null
  status: ThreadStatus
} {
  const sorted = [...messages].sort((a, b) =>
    (a.sent_at ?? '').localeCompare(b.sent_at ?? ''),
  )
  const last = sorted[sorted.length - 1]
  const last_message_at = last?.sent_at ?? null
  const last_direction = (last?.direction as Direction | undefined) ?? null

  const ageDays = last_message_at
    ? (Date.now() - new Date(last_message_at).getTime()) / 86_400_000
    : Infinity

  let status: ThreadStatus
  if (last_direction === 'outbound') {
    status = 'awaiting_them'
  } else if (last?.is_automated) {
    status = 'closed'
  } else if (ageDays > STALE_DAYS) {
    status = 'closed'
  } else {
    status = 'awaiting_us'
  }

  return { last_message_at, last_direction, status }
}
