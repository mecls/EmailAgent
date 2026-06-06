import { supabaseService } from '@/lib/supabase/service'

export interface ThreadMessageRow {
  sent_at: string | null
  direction: string | null
  is_automated: boolean
  subject: string | null
}

export async function getThreadMessages(
  accountId: string,
  threadId: string,
): Promise<ThreadMessageRow[]> {
  const { data, error } = await supabaseService()
    .from('messages')
    .select('sent_at, direction, is_automated, subject')
    .eq('account_id', accountId)
    .eq('thread_id', threadId)
  if (error) throw new Error(`getThreadMessages failed: ${error.message}`)
  return (data as ThreadMessageRow[]) ?? []
}

export interface ThreadUpsert {
  account_id: string
  thread_id: string
  subject: string | null
  last_message_at: string | null
  last_direction: string | null
  status: string
}

export async function upsertThread(row: ThreadUpsert): Promise<void> {
  const { error } = await supabaseService()
    .from('threads')
    .upsert(row, { onConflict: 'account_id,thread_id' })
  if (error) throw new Error(`upsertThread failed: ${error.message}`)
}
