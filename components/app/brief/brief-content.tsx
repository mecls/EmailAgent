import { cn } from '@/lib/utils'
import { ScheduleControls, type ScheduleState } from './schedule-controls'

export interface BriefGroup {
  group: string
  lines: string[]
}

/** A small status chip shown beside the title once a brief is configured. */
function StatePill({ tone }: { tone: 'on' | 'paused' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        tone === 'on'
          ? 'bg-emerald-100 text-emerald-700'
          : 'bg-amber-100 text-amber-700',
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          tone === 'on' ? 'bg-emerald-500' : 'bg-amber-500',
        )}
        aria-hidden
      />
      {tone === 'on' ? 'On' : 'Paused'}
    </span>
  )
}

/**
 * The morning-brief body — a stacked header (title + status pill + description),
 * the schedule manager (status card, on/off switch, and the single primary
 * action), and the most recent brief's grouped lines. Presentational and reused
 * in two places: inline as a section on desktop, and inside the slide-up sheet
 * on mobile. `runBriefNow` is a server action passed down to the manager.
 */
export function BriefContent({
  schedule,
  groups,
  runBriefNow,
}: {
  schedule: ScheduleState
  groups: BriefGroup[]
  runBriefNow: () => Promise<void>
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2.5">
          <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">
            Morning brief
          </h2>
          {schedule.configured ? (
            <StatePill tone={schedule.paused ? 'paused' : 'on'} />
          ) : null}
        </div>
        <p className="text-sm text-neutral-500">
          A daily summary of what matters in your inbox — delivered each morning.
        </p>
      </div>

      <ScheduleControls state={schedule} runBriefNow={runBriefNow} />

      {groups.length > 0 ? (
        <div className="rounded-2xl border border-neutral-200/80 bg-white p-5">
          <div className="flex flex-col gap-4">
            {groups.map((g) => (
              <div key={g.group} className="flex flex-col gap-1.5">
                <p className="text-xs font-semibold tracking-wide text-[var(--brand-accent)] uppercase">
                  {g.group}
                </p>
                {g.lines.map((line, i) => (
                  <p key={i} className="text-sm text-neutral-700">
                    {line}
                  </p>
                ))}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="px-1 text-sm text-neutral-500">
          No brief yet — send one now, or check back after your next scheduled
          brief.
        </p>
      )}
    </div>
  )
}
