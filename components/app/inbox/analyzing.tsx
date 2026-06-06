import { LoaderCircle } from 'lucide-react'

/**
 * Calm, modern loading state for the inbox scan. No jokes, no debug language —
 * just a spinner and reassuring copy about what's happening.
 */
export function Analyzing() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-neutral-200/80 bg-white px-6 py-12 text-center">
      <LoaderCircle
        className="h-6 w-6 animate-spin text-[var(--brand-accent)]"
        aria-hidden
      />
      <div>
        <p className="text-sm font-medium text-neutral-800">
          Analyzing your inbox…
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          Looking for human-written messages and important changes
        </p>
      </div>
    </div>
  )
}
