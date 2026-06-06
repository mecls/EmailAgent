import type { InboxSummary } from '@/lib/commands/inbox-summary-types'

/**
 * The summary block at the top of the results: a short paragraph, category tags,
 * and a quiet transparency line about how many emails we scanned.
 */
export function SummaryBlock({ data }: { data: InboxSummary }) {
  const { summary, tags, checked } = data
  return (
    <div className="rounded-2xl border border-neutral-200/80 bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-neutral-900">Summary</h3>
        {checked.total > 0 ? (
          <span className="text-xs text-neutral-400">
            Checked your last {checked.total} email
            {checked.total === 1 ? '' : 's'} · {checked.human} human-written
          </span>
        ) : null}
      </div>

      <p className="mt-2 text-sm leading-relaxed text-neutral-700">{summary}</p>

      {tags.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-600"
            >
              {tag}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}
