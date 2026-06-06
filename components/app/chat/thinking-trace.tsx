'use client'

import { useEffect, useRef, useState } from 'react'
import { Brain, ChevronDown, ChevronRight, LoaderCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Discloses the model's reasoning above its answer. While the agent is still
 * thinking (no answer text yet) the trace is expanded and streams reasoning
 * live; once the answer starts it auto-collapses to a re-openable toggle.
 *
 * Degrades gracefully: with no reasoning yet on the active message it shows just
 * the animated "Thinking…" header — a generic indicator — and nothing to expand.
 */
export function ThinkingTrace({
  reasoning,
  answering,
  streaming,
  activity,
}: {
  reasoning: string
  /** The answer has begun streaming (message body is non-empty). */
  answering: boolean
  /** This is the live, in-flight message. */
  streaming: boolean
  /** A live "searching…"-style status shown during the tool-execution gap. */
  activity?: string
}) {
  const thinking = streaming && !answering
  const [open, setOpen] = useState(thinking)

  // Auto-collapse exactly once, when the answer starts. The user's manual toggle
  // after that is respected (we don't force `open` back on).
  const collapsed = useRef(false)
  useEffect(() => {
    if (answering && !collapsed.current) {
      collapsed.current = true
      setOpen(false)
    }
  }, [answering])

  const hasReasoning = reasoning.length > 0
  const expandable = hasReasoning

  return (
    <div className="mb-2">
      <button
        type="button"
        onClick={() => expandable && setOpen((o) => !o)}
        disabled={!expandable}
        className={cn(
          'flex items-center gap-1.5 text-xs font-medium text-neutral-500',
          expandable ? 'hover:text-neutral-700' : 'cursor-default',
        )}
      >
        {thinking ? (
          <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden />
        ) : (
          <Brain className="h-3.5 w-3.5" aria-hidden />
        )}
        <span>
          {thinking ? (activity ?? 'Thinking…') : 'Thought for a bit'}
        </span>
        {expandable ? (
          open ? (
            <ChevronDown className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          )
        ) : null}
      </button>

      {open && hasReasoning ? (
        <p className="mt-1.5 border-l-2 border-neutral-200 pl-3 text-xs leading-relaxed whitespace-pre-wrap text-neutral-500">
          {reasoning}
        </p>
      ) : null}
    </div>
  )
}
