'use client'

import { useState } from 'react'
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  ExternalLink,
  Reply,
  Undo2,
} from 'lucide-react'
import type { SummaryCard } from '@/lib/commands/inbox-summary-types'
import { gmailThreadUrl, gmailComposeUrl } from '@/lib/gmail-links'
import { cn } from '@/lib/utils'

/** "Jun 3, 2026" — quiet, locale-stable date label. */
function formatDate(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/**
 * One important email, rendered as a clean, scannable card. Actions are
 * deliberately unobtrusive; only "Open in inbox" carries stronger emphasis.
 * "Mark handled" is a local-only dismiss — this app never mutates the inbox.
 */
export function EmailCard({ card }: { card: SummaryCard }) {
  const [handled, setHandled] = useState(false)
  const date = formatDate(card.sent_at)
  const received = card.direction === 'received'
  const DirIcon = received ? ArrowDownLeft : ArrowUpRight

  if (handled) {
    return (
      <div className="flex items-center justify-between rounded-xl border border-neutral-200/70 bg-neutral-50 px-4 py-2.5 text-sm text-neutral-500">
        <span className="flex items-center gap-2">
          <Check className="h-4 w-4 text-neutral-400" aria-hidden />
          Marked handled
        </span>
        <button
          type="button"
          onClick={() => setHandled(false)}
          className="flex items-center gap-1 text-xs font-medium text-neutral-500 hover:text-neutral-700"
        >
          <Undo2 className="h-3.5 w-3.5" aria-hidden />
          Undo
        </button>
      </div>
    )
  }

  return (
    <div className="group rounded-xl border border-neutral-200/80 bg-white p-4 transition-colors hover:border-neutral-300 hover:bg-neutral-50/60">
      <div className="flex items-start justify-between gap-3">
        <h4 className="text-[0.95rem] leading-snug font-semibold text-neutral-900">
          {card.subject}
        </h4>
        <span
          className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-[0.7rem] font-medium text-neutral-500"
          title={received ? 'Received' : 'Sent'}
        >
          <DirIcon className="h-3 w-3" aria-hidden />
          {received ? 'Received' : 'Sent'}
        </span>
      </div>

      <p className="mt-1 text-xs text-neutral-500">
        {received ? 'From' : 'To'} {card.from_name}
        {date ? <> · {date}</> : null}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="rounded-full bg-[rgb(var(--brand-accent-rgb)/0.08)] px-2.5 py-0.5 text-xs font-medium text-[var(--brand-accent)]">
          {card.category}
        </span>
      </div>

      <p className="mt-2 text-sm leading-relaxed text-neutral-700">
        {card.takeaway}
      </p>

      {card.snippet ? (
        <p className="mt-1.5 truncate text-xs text-neutral-400">
          {card.snippet}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-1">
        <a
          href={gmailThreadUrl(card.thread_id)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 px-2.5 py-2 text-xs font-medium text-white hover:bg-neutral-800"
        >
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          Open in inbox
        </a>
        {received && card.from_addr ? (
          <a
            href={gmailComposeUrl(card.from_addr, card.subject)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700"
          >
            <Reply className="h-3.5 w-3.5" aria-hidden />
            Reply
          </a>
        ) : null}
        <button
          type="button"
          onClick={() => setHandled(true)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium text-neutral-500',
            'hover:bg-neutral-100 hover:text-neutral-700',
          )}
        >
          <Check className="h-3.5 w-3.5" aria-hidden />
          Mark handled
        </button>
      </div>
    </div>
  )
}
