import { supabaseService } from '@/lib/supabase/service'

export interface EmbeddingUpsert {
  account_id: string
  message_id: number
  chunk_idx: number
  content: string
  embedding: number[]
}

/** pgvector accepts its text literal form `[1,2,3]`. */
function toVectorLiteral(v: number[]): string {
  return `[${v.join(',')}]`
}

export async function deleteEmbeddingsForMessages(
  messageIds: number[],
): Promise<void> {
  if (messageIds.length === 0) return
  const { error } = await supabaseService()
    .from('embeddings')
    .delete()
    .in('message_id', messageIds)
  if (error) {
    throw new Error(`deleteEmbeddingsForMessages failed: ${error.message}`)
  }
}

export async function upsertEmbeddings(rows: EmbeddingUpsert[]): Promise<void> {
  if (rows.length === 0) return
  const payload = rows.map((r) => ({
    account_id: r.account_id,
    message_id: r.message_id,
    chunk_idx: r.chunk_idx,
    content: r.content,
    embedding: toVectorLiteral(r.embedding),
  }))
  const { error } = await supabaseService()
    .from('embeddings')
    .upsert(payload, { onConflict: 'message_id,chunk_idx' })
  if (error) throw new Error(`upsertEmbeddings failed: ${error.message}`)
}
