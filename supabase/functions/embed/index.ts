// Supabase Edge Function: gte-small embeddings (384-dim).
//
// Runs the built-in Supabase.ai gte-small model (the only embedding model in the
// Edge Runtime). The Inngest worker POSTs { input: string | string[] } with the
// service-role key and gets back { embeddings: number[][] } aligned to input
// order. Deploy with: `supabase functions deploy embed`.
//
// Deno / Edge Runtime file — not part of the Next.js TS build.

const session = new Supabase.ai.Session('gte-small')

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('method not allowed', { status: 405 })
  }

  let body: { input?: unknown }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const texts = Array.isArray(body.input)
    ? (body.input as string[])
    : typeof body.input === 'string'
      ? [body.input]
      : null
  if (!texts) {
    return new Response(
      JSON.stringify({ error: 'input must be a string or string[]' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  try {
    const embeddings: number[][] = []
    for (const text of texts) {
      const vector = (await session.run(text, {
        mean_pool: true,
        normalize: true,
      })) as number[]
      embeddings.push(vector)
    }
    return new Response(JSON.stringify({ embeddings }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'embedding failed'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})

// Minimal ambient declaration so editors don't choke on the Edge-Runtime global.
// The real type ships with the Supabase Edge Runtime at deploy time.
declare const Supabase: {
  ai: {
    Session: new (model: string) => {
      run(
        input: string,
        opts?: { mean_pool?: boolean; normalize?: boolean },
      ): Promise<number[]>
    }
  }
}
