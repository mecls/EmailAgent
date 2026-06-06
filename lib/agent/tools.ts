import type OpenAI from 'openai'
import { z } from 'zod'

// ── search_email ─────────────────────────────────────────────────────────────
export const SearchInput = z.object({
  query: z.string().min(1),
  sender: z.string().optional(),
  since: z.string().optional(), // ISO date/datetime
  limit: z.number().int().min(1).max(25).optional(),
})
export type SearchInput = z.infer<typeof SearchInput>

export const SEARCH_TOOL: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'search_email',
    description:
      "Semantic search over the user's indexed email. Returns the most relevant messages with subject, sender name, sender email, date, snippet, and a similarity score. To catch up on a specific person, pass their name/email in `sender` (it matches whether they sent or received the mail). Optionally also pass a since date (ISO).",
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Natural-language search query.' },
        sender: {
          type: 'string',
          description:
            'Optional person to filter by — a display name (e.g. "Miguel Rolo") OR an email/domain substring. Matches whether they are the sender or a recipient.',
        },
        since: {
          type: 'string',
          description: 'Optional ISO date; only messages on/after this.',
        },
        limit: {
          type: 'integer',
          description: 'Max results (default 10, max 25).',
        },
      },
      required: ['query'],
    },
  },
}

// ── search_gmail_live ─────────────────────────────────────────────────────────
export const LiveSearchInput = z.object({
  query: z.string().min(1),
  sender: z.string().optional(),
  since: z.string().optional(), // ISO lower date bound
  until: z.string().optional(), // ISO upper date bound
  limit: z.number().int().min(1).max(10).optional(),
})
export type LiveSearchInput = z.infer<typeof LiveSearchInput>

export const SEARCH_LIVE_TOOL: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'search_gmail_live',
    description:
      "Search the user's FULL email history live, including mail older than the last few weeks (search_email only covers recent mail). This is slower than search_email, so use it only when search_email returns little or nothing, or when the user clearly wants older history (e.g. 'what did we discuss last year'). Returns subject, sender name, sender email, date, and snippet. Pass a person's name or email in `sender` to focus on them (matches whether they sent or received).",
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'Keywords to search for (Gmail keyword search, not semantic). Use the key terms, names, or phrases.',
        },
        sender: {
          type: 'string',
          description:
            'Optional person to focus on — a name or email/domain. Matches whether they sent or received.',
        },
        since: {
          type: 'string',
          description: 'Optional ISO date lower bound (on/after).',
        },
        until: {
          type: 'string',
          description: 'Optional ISO date upper bound (on/before).',
        },
        limit: {
          type: 'integer',
          description: 'Max results (default 10, max 10).',
        },
      },
      required: ['query'],
    },
  },
}

// ── query_email ──────────────────────────────────────────────────────────────
export const QueryInput = z.object({
  status: z.enum(['awaiting_us', 'awaiting_them', 'closed']).optional(),
  direction: z.enum(['inbound', 'outbound']).optional(),
  is_automated: z.boolean().optional(),
  since: z.string().optional(),
  until: z.string().optional(),
  sender: z.string().optional(),
  order_by: z.enum(['date_desc', 'age_desc']).optional(),
  limit: z.number().int().min(1).max(50).optional(),
})
export type QueryInput = z.infer<typeof QueryInput>

export const QUERY_TOOL: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'query_email',
    description:
      'Structured filter over the user\'s mail. With status set, queries threads by reply state (awaiting_us = user owes a reply; awaiting_them = waiting on the other party; closed). Without status, queries messages by direction, automated flag, sender, and date range. Use order_by="age_desc" to surface the most overdue first.',
    parameters: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['awaiting_us', 'awaiting_them', 'closed'],
          description: 'Thread reply state.',
        },
        direction: {
          type: 'string',
          enum: ['inbound', 'outbound'],
          description: 'Message direction (only without status).',
        },
        is_automated: {
          type: 'boolean',
          description: 'Filter automated/bulk mail; set false to exclude it.',
        },
        since: { type: 'string', description: 'ISO lower bound on date.' },
        until: { type: 'string', description: 'ISO upper bound on date.' },
        sender: {
          type: 'string',
          description:
            "Person to filter by: a display name (e.g. \"Miguel Rolo\") or an email/domain substring, matched against the message's sender.",
        },
        order_by: {
          type: 'string',
          enum: ['date_desc', 'age_desc'],
          description: 'Ordering (default date_desc).',
        },
        limit: {
          type: 'integer',
          description: 'Max results (default 25, max 50).',
        },
      },
      required: [],
    },
  },
}
