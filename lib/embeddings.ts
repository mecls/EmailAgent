import { env } from '@/lib/env'
import { mapPool } from '@/lib/pool'

/**
 * Embeddings via the Supabase `embed` Edge Function (Supabase.ai gte-small,
 * 384-dim). Replaces Voyage — no external embeddings provider/billing. The worker
 * calls the function with the service-role key. Vectors come back aligned to
 * input order.
 *
 * One text per request: gte-small inference in the Edge Runtime is memory/CPU
 * heavy, and batching multiple inputs into a SINGLE call trips
 * WORKER_RESOURCE_LIMIT (HTTP 546), especially on the Free plan.
 *
 * Concurrency is the real constraint: each in-flight request spins a worker that
 * loads the model, so too many at once ALSO trips 546. We keep it low here, and
 * because several index-batch functions run in parallel (each calling this), the
 * effective edge load is CONCURRENCY × index-batch concurrency — keep the product
 * modest. On top of that we back off and retry 546/429/5xx so transient resource
 * pressure self-heals instead of failing (and retrying) the whole batch.
 */
const CONCURRENCY = 2
const MAX_RETRIES = 6

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function endpoint(): string {
  return `${env.supabaseUrl().replace(/\/$/, '')}/functions/v1/embed`
}

async function embedOne(
  url: string,
  key: string,
  text: string,
): Promise<number[]> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
        apikey: key,
      },
      body: JSON.stringify({ input: [text] }),
    })
    if (res.ok) {
      const json = (await res.json()) as { embeddings: number[][] }
      return json.embeddings[0]
    }
    // 546 = WORKER_RESOURCE_LIMIT (edge function out of compute, usually from too
    // much concurrency); 429/5xx are transient too. Back off with jitter so a
    // burst that all 546s doesn't retry in lockstep, then try again.
    const retryable = res.status === 546 || res.status === 429 || res.status >= 500
    if (retryable && attempt < MAX_RETRIES) {
      const delay = Math.min(2 ** attempt * 500, 8000) + Math.random() * 250
      await sleep(delay)
      continue
    }
    const body = await res.text().catch(() => '')
    throw new Error(`embeddings failed (${res.status}): ${body.slice(0, 300)}`)
  }
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return []
  const key = env.supabaseServiceRoleKey()
  const url = endpoint()
  // mapPool preserves input order, so vectors stay aligned with `texts`.
  return mapPool(texts, CONCURRENCY, (text) => embedOne(url, key, text))
}

export async function embedQuery(text: string): Promise<number[]> {
  const [vector] = await embedBatch([text])
  return vector
}
