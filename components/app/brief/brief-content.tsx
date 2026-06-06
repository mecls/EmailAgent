import { ScheduleControls, type ScheduleState } from './schedule-controls'

export interface BriefGroup {
  group: string
  lines: string[]
}

/**
 * The morning-brief body — title, "Run brief now", schedule controls, and the
 * grouped brief lines. Presentational and reused in two places: inline as a
 * section on desktop, and inside the slide-up sheet on mobile. `runBriefNow` is
 * a server action passed down and wired as a form action.
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
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">
            Morning brief
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            Get a daily summary of your most important emails, delivered every
            morning.
          </p>
        </div>
        <form action={runBriefNow}>
          <button
            type="submit"
            className="shrink-0 rounded-lg border border-neutral-200 bg-white px-3.5 py-2 text-sm font-medium text-neutral-700 hover:border-neutral-300"
          >
            Run brief now
          </button>
        </form>
      </div>

      <ScheduleControls state={schedule} />

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
          No brief yet — run one now, or check back after your next scheduled
          brief.
        </p>
      )}
    </div>
  )
}
