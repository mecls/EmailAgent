/**
 * Shared, client-safe types for the structured "Ask your inbox" summary.
 * Kept free of server imports so both the API route and the React UI can use it.
 *
 * The shape the API returns: trustworthy fields (ids, sender, date, snippet)
 * come straight from the indexed DB row; the LLM only contributes the display
 * subject, category chip, and natural-language takeaway.
 */

export type CardDirection = 'received' | 'sent'

export interface SummaryCard {
  gmail_id: string
  thread_id: string
  /** Display subject — normalized / translated to English where needed. */
  subject: string
  from_name: string
  from_addr: string
  sent_at: string | null
  /** Pill label, e.g. "Meeting confirmation", "Calendar invite". */
  category: string
  /** One concise, natural sentence explaining what the email is about. */
  takeaway: string
  snippet: string | null
  direction: CardDirection
  /** The single most important item, surfaced in the bottom-line panel. */
  standout: boolean
}

export interface InboxSummary {
  /** 2–3 sentence paragraph summarizing the important, human-written mail. */
  summary: string
  /** Category tags for the whole batch, e.g. ["Meetings", "Calendar"]. */
  tags: string[]
  /** Transparency: how many recent emails we scanned and how many were human. */
  checked: { total: number; human: number }
  cards: SummaryCard[]
  /** Confident, natural-language "what matters most" line. */
  bottomLine: string
}
