import { env } from '@/lib/env'

/**
 * Embeddings via the Supabase `embed` Edge Function (Supabase.ai gte-small,
 * 384-dim). Replaces Voyage — no external embeddings provider/billing. The worker
 * calls the function with the service-role key. Vectors come back aligned to
 * input order.
 *
 * One text per request: gte-small inference in the Edge Runtime is memory/CPU
 * heavy, and batching multiple per call trips WORKER_RESOURCE_LIMIT (HTTP 546),
 * especially on the Free plan. Matches Supabase's own embeddings quickstart.
 * Tunable upward if you're on a larger plan / see headroom in the function logs.
 */
const BATCH = 1

function endpoint(): string {
  return `${env.supabaseUrl().replace(/\/$/, '')}/functions/v1/embed`
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return []
  const key = env.supabaseServiceRoleKey()
  const url = endpoint()
  const out: number[][] = []

  for (let i = 0; i < texts.length; i += BATCH) {
    const slice = texts.slice(i, i + BATCH)
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
        apikey: key,
      },
      body: JSON.stringify({ input: slice }),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(
        `embeddings failed (${res.status}): ${body.slice(0, 300)}`,
      )
    }
    const json = (await res.json()) as { embeddings: number[][] }
    out.push(...json.embeddings)
  }
  return out
}

export async function embedQuery(text: string): Promise<number[]> {
  const [vector] = await embedBatch([text])
  return vector
}
