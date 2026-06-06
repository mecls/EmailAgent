'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowUp,
  Clock,
  Inbox,
  RotateCcw,
  Sparkles,
  UserSearch,
  HelpCircle,
} from 'lucide-react'
import type { SyncPhase } from '@/lib/db/sync'
import { useAgentChat, type ChatMessage } from './use-agent-chat'
import { MarkdownLite } from './markdown-lite'
import { ThinkingTrace } from './thinking-trace'
import { PlusMenu, type PlusMenuItem } from './plus-menu'
import { SummaryBlock } from '@/components/app/inbox/summary-block'
import { EmailCard } from '@/components/app/inbox/email-card'
import { BottomLine } from '@/components/app/inbox/bottom-line'
import { Analyzing } from '@/components/app/inbox/analyzing'
import { cn } from '@/lib/utils'

const SUGGESTIONS = [
  "Who's waiting on me?",
  'What needs my attention today?',
  'Catch me up on my last 10 emails',
]

const INDEXING_EXPLAINER =
  "Getting set up just means I'm quietly reading through your past emails so I can answer in an instant. It runs once on its own in the background — you don't have to do anything, and a bigger inbox simply takes a little longer. As it finishes, my answers get more complete."

function greetingFor(phase: SyncPhase, name: string): string {
  const hi = `Hi ${name} — `
  if (phase === 'ready') {
    return `${hi}ask me anything about your inbox. I can recap recent threads, tell you who's waiting on a reply, or dig into a specific person. I only read your mail; I never send.`
  }
  if (phase === 'error') {
    return `${hi}I'm having trouble reaching your inbox right now. You can reconnect from the banner above, and I'll pick up where you left off.`
  }
  return `${hi}I'm still getting your inbox ready. You can start asking now, and my answers will fill in as I finish.`
}

function phaseStatus(phase: SyncPhase): { label: string; tone: string } {
  switch (phase) {
    case 'ready':
      return { label: 'Read-only · Ready', tone: 'bg-emerald-500' }
    case 'error':
      return { label: 'Read-only · Reconnect needed', tone: 'bg-amber-500' }
    default:
      return { label: 'Read-only · Setting up your inbox…', tone: 'bg-amber-400' }
  }
}

const timeFmt = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit',
})

export function ChatPanel({
  phase = 'ready',
  firstName = 'there',
}: {
  phase?: SyncPhase
  firstName?: string
}) {
  const greeting = useMemo(() => greetingFor(phase, firstName), [phase, firstName])
  const { messages, isStreaming, send, retry, note, catchMeUp, canRetry } =
    useAgentChat({ greeting })
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })
  }, [messages])

  const submit = () => {
    const text = input.trim()
    if (!text || isStreaming) return
    setInput('')
    void send(text)
  }

  const askAboutPerson = () => {
    setInput('Catch me up on ')
    inputRef.current?.focus()
  }

  const menuItems: PlusMenuItem[] = [
    {
      icon: Sparkles,
      label: 'Catch me up',
      description: 'Summarize your latest emails',
      onClick: () => void catchMeUp(),
    },
    {
      icon: Clock,
      label: "Who's waiting on me?",
      divider: true,
      onClick: () => void send("Who's waiting on me?"),
    },
    {
      icon: Inbox,
      label: 'What needs my attention today?',
      onClick: () => void send('What needs my attention today?'),
    },
  ]

  const status = phaseStatus(phase)
  const hasConversation = messages.some((m) => m.role === 'user')
  const last = messages[messages.length - 1]
  const showActions =
    !isStreaming &&
    hasConversation &&
    last?.role === 'agent' &&
    !last.summary &&
    !last.loadingSummary
  const showSuggestions = !isStreaming && !hasConversation

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-neutral-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_32px_-16px_rgba(0,0,0,0.12)]">
      {/* Header — reinforces "this is a chat", not a search box. */}
      <div className="flex items-center gap-2.5 border-b border-neutral-200/70 px-4 py-3">
        <Avatar size="md" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-neutral-900">
            Inbox assistant
          </p>
          <p className="flex items-center gap-1.5 text-xs text-neutral-400">
            <span
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                status.tone,
                phase !== 'ready' && 'animate-pulse',
              )}
              aria-hidden
            />
            {status.label}
          </p>
        </div>
      </div>

      {/* Transcript */}
      <div className="flex max-h-[34rem] min-h-[22rem] flex-col gap-5 overflow-y-auto px-4 py-5">
        <DaySeparator />
        {messages.map((m) => (
          <Bubble
            key={m.id}
            message={m}
            isStreaming={isStreaming}
            live={m === last}
            onRefineSummary={() => void catchMeUp()}
          />
        ))}

        {showActions ? (
          <div className="flex flex-wrap gap-2 pl-10">
            {canRetry ? (
              <ActionChip icon={RotateCcw} label="Try again" onClick={retry} />
            ) : null}
            <ActionChip
              icon={UserSearch}
              label="Ask about a person"
              onClick={askAboutPerson}
            />
            <ActionChip
              icon={HelpCircle}
              label="Learn about indexing"
              onClick={() => note(INDEXING_EXPLAINER)}
            />
          </div>
        ) : null}

        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="border-t border-neutral-200/70 bg-neutral-50/50 px-3 pt-3 pb-3">
        {showSuggestions ? (
          <div className="mb-2.5 flex flex-wrap gap-2">
            {SUGGESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => void send(q)}
                className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-600 transition-colors hover:border-[var(--brand-accent)] hover:text-[var(--brand-accent)]"
              >
                {q}
              </button>
            ))}
          </div>
        ) : null}

        <div className="flex items-end gap-2">
          <PlusMenu items={menuItems} disabled={isStreaming} />
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                submit()
              }
            }}
            rows={1}
            placeholder="Ask anything about your inbox…"
            className="max-h-32 min-h-[2.75rem] flex-1 resize-none rounded-xl border border-neutral-200 bg-white px-3.5 py-3 text-sm outline-none focus:border-[var(--brand-accent)]"
          />
          <button
            onClick={submit}
            disabled={!input.trim() || isStreaming}
            aria-label="Send"
            className="cta-shadow flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-accent)] text-[var(--brand-accent-foreground)] transition-opacity disabled:opacity-40"
          >
            <ArrowUp className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  )
}

// ── pieces ───────────────────────────────────────────────────────────────────

function Bubble({
  message,
  isStreaming,
  live,
  onRefineSummary,
}: {
  message: ChatMessage
  isStreaming: boolean
  live: boolean
  onRefineSummary: () => void
}) {
  const isUser = message.role === 'user'
  const time = timeFmt.format(message.createdAt)

  if (isUser) {
    return (
      <div className="flex flex-col items-end gap-1">
        <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-[var(--brand-accent)] px-4 py-2.5 text-sm whitespace-pre-wrap text-[var(--brand-accent-foreground)]">
          {message.body}
        </div>
        <span className="pr-1 text-[11px] text-neutral-400">{time}</span>
      </div>
    )
  }

  // Rich "Catch me up" result — rendered full-width in-thread, no bubble chrome.
  if (message.loadingSummary || message.summary) {
    return (
      <div className="flex items-start gap-2.5">
        <Avatar size="sm" />
        <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
          {message.loadingSummary ? (
            <Analyzing />
          ) : message.summary ? (
            <div className="flex w-full flex-col gap-4">
              <SummaryBlock data={message.summary} />
              {message.summary.cards.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {message.summary.cards.map((card) => (
                    <EmailCard key={card.gmail_id} card={card} />
                  ))}
                </div>
              ) : null}
              <BottomLine data={message.summary} onRefine={onRefineSummary} />
            </div>
          ) : null}
          <span className="pl-1 text-[11px] text-neutral-400">{time}</span>
        </div>
      </div>
    )
  }

  const streamingNow = isStreaming && live
  return (
    <div className="flex items-start gap-2.5">
      <Avatar size="sm" />
      <div className="flex min-w-0 flex-col items-start gap-1">
        <div className="max-w-full rounded-2xl rounded-tl-sm border border-neutral-200/70 bg-neutral-50 px-4 py-3">
          {message.reasoning || (streamingNow && !message.body) ? (
            <ThinkingTrace
              reasoning={message.reasoning ?? ''}
              answering={message.body.length > 0}
              streaming={streamingNow}
            />
          ) : null}
          <MarkdownLite text={message.body} streaming={streamingNow} />
        </div>
        <span className="pl-1 text-[11px] text-neutral-400">{time}</span>
      </div>
    </div>
  )
}

function Avatar({ size }: { size: 'sm' | 'md' }) {
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-lg bg-[var(--brand-accent)] text-[var(--brand-accent-foreground)]',
        size === 'sm' ? 'h-7 w-7' : 'h-8 w-8',
      )}
      aria-hidden
    >
      <Sparkles className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
    </span>
  )
}

function ActionChip({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof RotateCcw
  label: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-600 transition-colors hover:border-[var(--brand-accent)] hover:text-[var(--brand-accent)]"
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {label}
    </button>
  )
}

function DaySeparator() {
  return (
    <div className="flex items-center justify-center">
      <span className="text-[11px] font-medium tracking-wide text-neutral-400">
        Today
      </span>
    </div>
  )
}
