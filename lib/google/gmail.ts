/**
 * Minimal Gmail REST client (plain fetch — we touch only a handful of
 * endpoints). All calls are read-only (gmail.readonly). Callers pass an access
 * token obtained from lib/google/oauth.
 */

const BASE = 'https://gmail.googleapis.com/gmail/v1/users/me'

/** Raised when users.history.list returns 404 (startHistoryId expired). */
export class HistoryExpiredError extends Error {
  constructor() {
    super('Gmail historyId expired; full resync required')
    this.name = 'HistoryExpiredError'
  }
}

export interface MessageRef {
  id: string
  threadId: string
}

export interface ParsedMessage {
  gmailId: string
  threadId: string
  from: string | null
  /** Sender display name ("Miguel Rolo"), null for a bare address. */
  fromName: string | null
  to: string[]
  /** Recipient display names, index-aligned with `to` ('' where absent). */
  toNames: string[]
  subject: string | null
  sentAt: string | null // ISO
  snippet: string
  labels: string[]
  listUnsubscribe: boolean
  bodyText: string
}

interface GmailHeader {
  name: string
  value: string
}
interface GmailPart {
  mimeType?: string
  filename?: string
  headers?: GmailHeader[]
  body?: { data?: string; size?: number }
  parts?: GmailPart[]
}
interface GmailMessage {
  id: string
  threadId: string
  snippet?: string
  labelIds?: string[]
  internalDate?: string
  payload?: GmailPart
}

const MAX_RETRIES = 5

async function gmailFetch<T>(
  accessToken: string,
  path: string,
): Promise<T> {
  let attempt = 0
  // Exponential backoff on 429 / 5xx (Gmail quota is 6,000 units/min/user).
  for (;;) {
    const res = await fetch(`${BASE}${path}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (res.ok) return (await res.json()) as T
    if (res.status === 404) {
      // Surface to caller (history expiry handling); other 404s are real.
      const body = await res.text().catch(() => '')
      throw new GmailFetchError(404, body)
    }
    if ((res.status === 429 || res.status >= 500) && attempt < MAX_RETRIES) {
      const delay = Math.min(2 ** attempt * 500, 16_000)
      await sleep(delay)
      attempt++
      continue
    }
    const body = await res.text().catch(() => '')
    throw new GmailFetchError(res.status, body)
  }
}

export class GmailFetchError extends Error {
  readonly status: number
  constructor(status: number, body: string) {
    super(`Gmail API ${status}: ${body.slice(0, 300)}`)
    this.name = 'GmailFetchError'
    this.status = status
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** List message ids matching a query, one page at a time. */
export async function listMessageIds(
  accessToken: string,
  opts: { query: string; pageToken?: string; maxResults?: number },
): Promise<{ ids: MessageRef[]; nextPageToken?: string }> {
  const params = new URLSearchParams({
    q: opts.query,
    maxResults: String(opts.maxResults ?? 500),
  })
  if (opts.pageToken) params.set('pageToken', opts.pageToken)
  const data = await gmailFetch<{
    messages?: MessageRef[]
    nextPageToken?: string
  }>(accessToken, `/messages?${params.toString()}`)
  return { ids: data.messages ?? [], nextPageToken: data.nextPageToken }
}

/** Current mailbox historyId — the baseline cursor for incremental sync. */
export async function getProfileHistoryId(
  accessToken: string,
): Promise<string> {
  const data = await gmailFetch<{ historyId: string }>(accessToken, `/profile`)
  return data.historyId
}

/** Fetch + parse a single message (format=full so we can embed the body). */
export async function getMessage(
  accessToken: string,
  id: string,
): Promise<ParsedMessage> {
  const m = await gmailFetch<GmailMessage>(
    accessToken,
    `/messages/${id}?format=full`,
  )
  const headers = m.payload?.headers ?? []
  const header = (name: string): string | null => {
    const h = headers.find((x) => x.name.toLowerCase() === name.toLowerCase())
    return h?.value ?? null
  }
  const toRaw = header('To') ?? ''
  const fromParsed = parseAddressFull(header('From'))
  const toParsed = toRaw
    .split(',')
    .map((s) => parseAddressFull(s))
    .filter((x): x is ParsedAddress => x !== null)
  return {
    gmailId: m.id,
    threadId: m.threadId,
    from: fromParsed?.email ?? null,
    fromName: fromParsed?.name ?? null,
    to: toParsed.map((x) => x.email),
    toNames: toParsed.map((x) => x.name ?? ''),
    subject: header('Subject'),
    sentAt: m.internalDate
      ? new Date(Number(m.internalDate)).toISOString()
      : null,
    snippet: decodeHtmlEntities(m.snippet ?? ''),
    labels: m.labelIds ?? [],
    listUnsubscribe: Boolean(header('List-Unsubscribe')),
    bodyText: extractBodyText(m.payload),
  }
}

export interface HistoryResult {
  /** Newly-added/changed message refs since startHistoryId. */
  added: MessageRef[]
  /** The latest historyId to persist as the new cursor. */
  historyId: string | null
}

/**
 * Incremental changes since startHistoryId. Throws HistoryExpiredError on 404 so
 * the caller can trigger a full resync.
 */
export async function listHistory(
  accessToken: string,
  startHistoryId: string,
): Promise<HistoryResult> {
  const added = new Map<string, MessageRef>()
  let pageToken: string | undefined
  let latest: string | null = null
  try {
    for (;;) {
      const params = new URLSearchParams({
        startHistoryId,
        historyTypes: 'messageAdded',
      })
      if (pageToken) params.set('pageToken', pageToken)
      const data = await gmailFetch<{
        history?: { messagesAdded?: { message: MessageRef }[] }[]
        historyId?: string
        nextPageToken?: string
      }>(accessToken, `/history?${params.toString()}`)
      latest = data.historyId ?? latest
      for (const h of data.history ?? []) {
        for (const a of h.messagesAdded ?? []) {
          added.set(a.message.id, a.message)
        }
      }
      if (!data.nextPageToken) break
      pageToken = data.nextPageToken
    }
  } catch (e) {
    if (e instanceof GmailFetchError && e.status === 404) {
      throw new HistoryExpiredError()
    }
    throw e
  }
  return { added: [...added.values()], historyId: latest }
}

// ── parsing helpers ──────────────────────────────────────────────────────────

interface ParsedAddress {
  email: string
  name: string | null
}

/**
 * Parse a "Name <addr>" header into its display name + bare lowercase email.
 * The name is what lets the agent find a person by name ("catch me up on
 * Miguel Rolo") — Gmail headers are the only place it's available, so we keep it.
 */
function parseAddressFull(raw: string | null): ParsedAddress | null {
  if (!raw) return null
  const m = raw.match(/<([^>]+)>/)
  const email = (m ? m[1] : raw).trim().toLowerCase()
  if (!email) return null
  let name: string | null = null
  if (m && m.index !== undefined) {
    // Everything before "<addr>" is the display name; drop surrounding quotes.
    name = raw.slice(0, m.index).trim().replace(/^"(.*)"$/, '$1').trim() || null
  }
  if (name && name.toLowerCase() === email) name = null
  return { email, name }
}

/** Walk the MIME tree for a text/plain part; fall back to stripped text/html. */
function extractBodyText(payload: GmailPart | undefined): string {
  if (!payload) return ''
  const plain = findPart(payload, 'text/plain')
  if (plain?.body?.data) return decodeBase64Url(plain.body.data)
  const html = findPart(payload, 'text/html')
  if (html?.body?.data) return stripHtml(decodeBase64Url(html.body.data))
  if (payload.body?.data) return decodeBase64Url(payload.body.data)
  return ''
}

function findPart(part: GmailPart, mime: string): GmailPart | null {
  if (part.mimeType === mime && part.body?.data) return part
  for (const child of part.parts ?? []) {
    const found = findPart(child, mime)
    if (found) return found
  }
  return null
}

function decodeBase64Url(data: string): string {
  return Buffer.from(data, 'base64url').toString('utf8')
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
}
