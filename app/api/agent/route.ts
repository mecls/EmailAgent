import { type NextRequest } from 'next/server'
import { requireAccountId } from '@/lib/auth/session'
import { runAgentLoop } from '@/lib/agent/agent-loop'
import { getSyncState, type SyncPhase } from '@/lib/db/sync'

// Node runtime (Anthropic SDK + service-role). Generous duration for the loop.
export const runtime = 'nodejs'
export const maxDuration = 300

/**
 * Streams the agent loop as Server-Sent Events. The account id is re-derived from
 * the verified session — never taken from the client — so every tool call is
 * scoped to the caller's own mail.
 */
export async function POST(req: NextRequest) {
  let accountId: string
  try {
    ;({ accountId } = await requireAccountId())
  } catch {
    return new Response('unauthorized', { status: 401 })
  }

  let body: { prompt?: string }
  try {
    body = (await req.json()) as { prompt?: string }
  } catch {
    return new Response('bad request', { status: 400 })
  }
  const prompt = (body.prompt ?? '').trim()
  if (!prompt) return new Response('empty prompt', { status: 400 })

  // Frame empty results honestly: a search returning nothing during setup is a
  // "still getting ready" message, not an error. Best-effort — never block the
  // chat on it.
  let indexState: SyncPhase | undefined
  try {
    indexState = (await getSyncState(accountId))?.phase
  } catch {
    indexState = undefined
  }

  const encoder = new TextEncoder()
  let closed = false
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // The client can vanish mid-stream (navigation, a new message, React
      // strict-mode double-render). Once it does, the controller is closed and
      // enqueueing throws ERR_INVALID_STATE — which would surface as a bogus
      // "agent loop failed". Guard every write/close and treat it as a no-op.
      const send = (obj: unknown) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`))
        } catch {
          closed = true
        }
      }
      try {
        await runAgentLoop({
          prompt,
          accountId,
          indexState,
          emit: (text) => send({ t: text }),
          emitReasoning: (text) => send({ r: text }),
          signal: req.signal,
        })
        send({ done: true })
      } catch (e) {
        // A disconnect aborts the loop too — that's expected, not an error.
        if (!req.signal.aborted) console.error('[agent] loop failed', e)
        send({ error: 'agent_error' })
      } finally {
        if (!closed) {
          closed = true
          try {
            controller.close()
          } catch {
            // already closed by the client — nothing to do
          }
        }
      }
    },
    cancel() {
      closed = true
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
