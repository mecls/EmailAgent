import { ExternalLink, RotateCw } from 'lucide-react'
import type { InboxSummary } from '@/lib/commands/inbox-summary-types'
import { gmailThreadUrl } from '@/lib/gmail-links'

/**
 * "Bottom line" panel — the confident wrap-up under the cards, on a tinted
 * rounded surface to set it apart. Actions are explicit calls to action, never
 * rhetorical questions.
 */
export function BottomLine({
  data,
  onRefine,
}: {
  data: InboxSummary
  onRefine: () => void
}) {
  const standout = data.cards.find((c) => c.standout) ?? data.cards[0]

  return (
    <div className="rounded-2xl border border-[rgb(var(--brand-accent-rgb)/0.15)] bg-[rgb(var(--brand-accent-rgb)/0.04)] p-5">
      <h3 className="text-sm font-semibold text-neutral-900">Bottom line</h3>
      <p className="mt-2 text-sm leading-relaxed text-neutral-700">
        {data.bottomLine}
      </p>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        {standout ? (
          <a
            href={gmailThreadUrl(standout.thread_id)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--brand-accent)] px-3 py-2 text-xs font-medium text-[var(--brand-accent-foreground)] hover:opacity-90 sm:w-auto sm:justify-start sm:py-1.5"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            <span className="truncate">View “{standout.subject}”</span>
          </a>
        ) : null}
        <button
          type="button"
          onClick={onRefine}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-700 hover:border-neutral-300 sm:w-auto sm:justify-start sm:py-1.5"
        >
          <RotateCw className="h-3.5 w-3.5" aria-hidden />
          Refine this summary
        </button>
      </div>
    </div>
  )
}
