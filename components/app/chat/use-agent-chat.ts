'use client'

import { useCallback, useRef, useState } from 'react'
import type { InboxSummary } from '@/lib/commands/inbox-summary-types'

export interface ChatMessage {
  id: string
  role: 'user' | 'agent'
  body: string
  /** Epoch ms the message was created — rendered as a bubble timestamp. */
  createdAt: number
  /** Accumulated reasoning tokens (display-only); shown in the thinking trace. */
  reasoning?: string
  /** A structured "Catch me up" result, rendered as rich cards in-thread. */
  summary?: InboxSummary
  /** True while a "Catch me up" summary is being generated. */
  loadingSummary?: boolean
}

interface UseAgentChatOptions {
  /** Seeded opening assistant message (e.g. an indexing-aware greeting). */
  greeting?: string
}

/**
 * Drives the chat surface against POST /api/agent, consuming its SSE stream
 * (`data: {"t": "..."}` chunks, then `{"done":true}`). Appends a user message
 * and a streaming agent message, growing the agent message as chunks arrive.
 *
 * Also seeds an opening assistant greeting and exposes `retry` (re-send the last
 * user prompt) and `note` (append a local, no-network assistant message) so the
 * panel can offer structured follow-up actions instead of free-floating text.
 */
export function useAgentChat({ greeting }: UseAgentChatOptions = {}) {
  const counter = useRef(0)
  const nextId = () => `m${++counter.current}`

  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    greeting
      ? [{ id: 'greeting', role: 'agent', body: greeting, createdAt: Date.now() }]
      : [],
  )
  const [isStreaming, setIsStreaming] = useState(false)
  const lastPrompt = useRef<string | null>(null)

  const send = useCallback(async (text: string) => {
    const clean = text.trim()
    if (!clean) return
    lastPrompt.current = clean

    const agentId = nextId()
    setMessages((m) => [
      ...m,
      { id: nextId(), role: 'user', body: clean, createdAt: Date.now() },
      { id: agentId, role: 'agent', body: '', createdAt: Date.now() },
    ])
    setIsStreaming(true)

    const appendToAgent = (chunk: string) =>
      setMessages((m) =>
        m.map((x) => (x.id === agentId ? { ...x, body: x.body + chunk } : x)),
      )
    const appendReasoningToAgent = (chunk: string) =>
      setMessages((m) =>
        m.map((x) =>
          x.id === agentId
            ? { ...x, reasoning: (x.reasoning ?? '') + chunk }
            : x,
        ),
      )
    const setAgent = (body: string) =>
      setMessages((m) =>
        m.map((x) => (x.id === agentId ? { ...x, body } : x)),
      )

    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: clean }),
      })
      if (!res.ok || !res.body) throw new Error(`agent ${res.status}`)

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const events = buffer.split('\n\n')
        buffer = events.pop() ?? ''
        for (const evt of events) {
          const dataLine = evt
            .split('\n')
            .find((l) => l.startsWith('data: '))
          if (!dataLine) continue
          let payload: {
            t?: string
            r?: string
            done?: boolean
            error?: string
          }
          try {
            payload = JSON.parse(dataLine.slice(6))
          } catch {
            continue
          }
          if (payload.r) appendReasoningToAgent(payload.r)
          else if (payload.t) appendToAgent(payload.t)
          else if (payload.error)
            setAgent("I couldn't get to your inbox just now. Give it another try in a moment.")
        }
      }
    } catch {
      setMessages((m) =>
        m.map((x) =>
          x.id === agentId && !x.body
            ? {
                ...x,
                body: "I couldn't get to your inbox just now. Give it another try in a moment.",
              }
            : x,
        ),
      )
    } finally {
      setIsStreaming(false)
    }
  }, [])

  /** Re-run the most recent user prompt (the "Try again" action). */
  const retry = useCallback(() => {
    if (lastPrompt.current) void send(lastPrompt.current)
  }, [send])

  /**
   * Run the structured inbox summary (POST /api/summary) and render it as a
   * rich card message in the thread — the "Catch me up" launcher action.
   */
  const catchMeUp = useCallback(async () => {
    const agentId = nextId()
    setMessages((m) => [
      ...m,
      {
        id: nextId(),
        role: 'user',
        body: 'Catch me up on my inbox',
        createdAt: Date.now(),
      },
      {
        id: agentId,
        role: 'agent',
        body: '',
        loadingSummary: true,
        createdAt: Date.now(),
      },
    ])
    setIsStreaming(true)
    try {
      const res = await fetch('/api/summary', { method: 'POST' })
      if (!res.ok) throw new Error(`summary ${res.status}`)
      const summary = (await res.json()) as InboxSummary
      setMessages((m) =>
        m.map((x) =>
          x.id === agentId ? { ...x, loadingSummary: false, summary } : x,
        ),
      )
    } catch {
      setMessages((m) =>
        m.map((x) =>
          x.id === agentId
            ? {
                ...x,
                loadingSummary: false,
                body: "I couldn't pull together a summary just now. Give it another try in a moment.",
              }
            : x,
        ),
      )
    } finally {
      setIsStreaming(false)
    }
  }, [])

  /** Append a local assistant message with no network call (canned help text). */
  const note = useCallback((body: string) => {
    setMessages((m) => [
      ...m,
      { id: `n${Date.now()}`, role: 'agent', body, createdAt: Date.now() },
    ])
  }, [])

  return {
    messages,
    isStreaming,
    send,
    retry,
    note,
    catchMeUp,
    canRetry: !!lastPrompt.current,
  }
}
