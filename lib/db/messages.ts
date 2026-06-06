import { supabaseService } from '@/lib/supabase/service'
import { getGoogleCredentials } from './credentials'

export interface MessageUpsert {
  account_id: string
  gmail_id: string
  thread_id: string
  from_addr: string | null
  from_name: string | null
  to_addrs: string[]
  to_names: string[]
  sent_at: string | null
  subject: string | null
  snippet: string
  direction: string
  is_automated: boolean
  labels: string[]
}

export interface UpsertedMessage {
  id: number
  gmail_id: string
  thread_id: string
}

/**
 * Upsert message rows; idempotent on (account_id, gmail_id). Returns the db ids
 * keyed by gmail_id (needed to attach embeddings). body_text is intentionally
 * never written (index-light).
 */
export async function upsertMessages(
  rows: MessageUpsert[],
): Promise<UpsertedMessage[]> {
  if (rows.length === 0) return []
  const { data, error } = await supabaseService()
    .from('messages')
    .upsert(rows, { onConflict: 'account_id,gmail_id' })
    .select('id, gmail_id, thread_id')
  if (error) throw new Error(`upsertMessages failed: ${error.message}`)
  return (data as UpsertedMessage[]) ?? []
}

/** The account owner's email addresses (for inbound/outbound classification). */
export async function getOwnerEmails(accountId: string): Promise<Set<string>> {
  const set = new Set<string>()
  const creds = await getGoogleCredentials(accountId)
  if (creds?.email) set.add(creds.email.toLowerCase())
  const { data } = await supabaseService()
    .from('accounts')
    .select('owner_email')
    .eq('id', accountId)
    .maybeSingle()
  const ownerEmail = (data as { owner_email?: string } | null)?.owner_email
  if (ownerEmail) set.add(ownerEmail.toLowerCase())
  return set
}
