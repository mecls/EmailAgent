'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { ArrowUp, Bell, Clock, Inbox, RotateCcw, Sparkles, UserSearch } from 'lucide-react'
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
  { icon: Clock, label: "Who's waiting on me?" },
  { icon: Inbox, label: 'What needs my attention today?' },
  { icon: Sparkles, label: 'Recap my last 10 emails' },
  { icon: Bell, label: "Anything urgent I've missed?" },
]

function greetingFor(phase: SyncPhase, name: string): string {
  const hi = `Hi ${name} — `
  if (phase === 'error') {
    return `${hi}I'm having trouble reaching your inbox right now. You can reconnect from the banner above, and I'll pick up where you left off.`
  }
  // pending/indexing are intentionally indistinguishable from ready — the agent
  // answers from live search while the background index fills in.
  return `${hi}ask me anything about your inbox. I can recap recent threads, tell you who's waiting on a reply, or dig into a specific person. I only read your mail; I never send.`
}

function phaseStatus(phase: SyncPhase): { label: string; tone: string } {
  if (phase === 'error') {
    return { label: 'Read-only · Reconnect needed', tone: 'bg-amber-500' }
  }
  return { label: 'Read-only · Ready', tone: 'bg-emerald-500' }
}

const timeFmt = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit',
})

export function ChatPanel({
  phase = 'ready',
  firstName = 'there',
  fill = false,
}: {
  phase?: SyncPhase
  firstName?: string
  /** Fill the parent height (full-screen mobile) instead of a bounded card. */
  fill?: boolean
}) {
  const greeting = useMemo(() => greetingFor(phase, firstName), [phase, firstName])
  const { messages, isStreaming, send, retry, catchMeUp, canRetry } =
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

  return (
    <div
      className={cn(
        'flex flex-col overflow-hidden',
        // Fill (mobile): blend into the page canvas — no card, no rounding.
        fill
          ? 'h-full min-h-0'
          : 'rounded-2xl border border-neutral-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_32px_-16px_rgba(0,0,0,0.12)]',
      )}
    >
      {/* Header — reinforces "this is a chat", not a search box. Hidden on the
          full-bleed mobile view so the chat reads as part of the page. */}
      <div
        className={cn(
          'flex items-center gap-2.5 border-b border-neutral-200/70 px-4 py-3',
          fill && 'hidden',
        )}
      >
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
                phase === 'error' && 'animate-pulse',
              )}
              aria-hidden
            />
            {status.label}
          </p>
        </div>
      </div>

      {/* Transcript */}
      <div
        className={cn(
          'flex flex-col gap-5 overflow-y-auto px-4 py-5',
          fill ? 'min-h-0 flex-1' : 'max-h-[34rem] min-h-[22rem]',
        )}
      >
        {hasConversation ? (
          <>
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
              </div>
            ) : null}
          </>
        ) : (
          <IntroHero
            firstName={firstName}
            phase={phase}
            onPrompt={(q) => void send(q)}
          />
        )}

        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div
        className={cn(
          'border-t border-neutral-200/70 px-3 pt-3',
          // Fill (mobile): transparent so it sits on the page canvas.
          fill ? 'pb-safe bg-transparent' : 'bg-neutral-50/50 pb-3',
        )}
      >
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
            className="max-h-32 min-h-[2.75rem] flex-1 resize-none rounded-xl border border-neutral-200 bg-white px-3.5 py-3 text-base outline-none focus:border-[var(--brand-accent)] sm:text-sm"
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
        <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-[var(--brand-accent)] px-4 py-2.5 text-sm whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-[var(--brand-accent-foreground)]">
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
          {message.reasoning ||
          message.activity ||
          (streamingNow && !message.body) ? (
            <ThinkingTrace
              reasoning={message.reasoning ?? ''}
              answering={message.body.length > 0}
              streaming={streamingNow}
              activity={message.activity}
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
  const dim = size === 'sm' ? 28 : 32
  return (
    <Image
      src="/icons/icon-192.png"
      alt=""
      width={dim}
      height={dim}
      className={cn('shrink-0 rounded-lg', size === 'sm' ? 'h-7 w-7' : 'h-8 w-8')}
      aria-hidden
    />
  )
}

/**
 * The first-run hero, shown until the user sends their first message. Replaces
 * the lone greeting bubble with a scannable intro: greeting, what the assistant
 * can do, a persistent read-only reassurance, and a tappable prompt grid (the
 * quickest path to a successful first query). On an inbox-connection error it
 * stays calm and points at the reconnect banner instead of offering prompts.
 */
function IntroHero({
  firstName,
  phase,
  onPrompt,
}: {
  firstName: string
  phase: SyncPhase
  onPrompt: (q: string) => void
}) {
  const isError = phase === 'error'
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 px-2 py-6 text-center">
      <Avatar size="md" />

      <div className="flex flex-col items-center gap-2">
        <h2 className="text-lg font-semibold text-neutral-900">
          Hi {firstName} 👋
        </h2>
        <p className="max-w-sm text-sm text-neutral-500">
          {isError
            ? "I'm having trouble reaching your inbox right now. Reconnect from the banner above and I'll pick up where you left off."
            : 'Ask anything about your inbox, or start with one of these.'}
        </p>
      </div>

      {!isError ? (
        <>
          <div className="flex w-full max-w-md flex-col gap-2 pt-1">
            <span className="text-[11px] font-medium tracking-wide text-neutral-400 uppercase">
              Try
            </span>
            <div className="grid gap-2 sm:grid-cols-2">
              {SUGGESTIONS.map(({ icon: Icon, label }) => (
                <button
                  key={label}
                  onClick={() => onPrompt(label)}
                  className="flex items-center gap-2.5 rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-left text-sm text-neutral-700 transition-colors hover:border-[var(--brand-accent)] hover:text-[var(--brand-accent)]"
                >
                  <Icon
                    className="h-4 w-4 shrink-0 text-neutral-400"
                    aria-hidden
                  />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </div>
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
