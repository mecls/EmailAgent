import { serve } from 'inngest/next'
import { inngest } from '@/lib/inngest/client'
import { functions } from '@/lib/inngest/functions'

// Inngest steps run inside this Vercel function. Indexing fans out into short
// (≤50-message) batches, but give the route headroom so a step never gets cut
// off mid-flight. Node runtime: the worker uses the Supabase service-role SDK
// and Node crypto.
export const runtime = 'nodejs'
export const maxDuration = 300

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions,
})
