import { supabaseService } from '@/lib/supabase/service'

export interface BriefItem {
  group: string
  line: string
}

export interface BriefRow {
  id: number
  account_id: string
  generated_at: string
  since: string | null
  items: BriefItem[]
  delivered: boolean
}

export async function getLatestBrief(
  accountId: string,
): Promise<BriefRow | null> {
  const { data, error } = await supabaseService()
    .from('briefs')
    .select('*')
    .eq('account_id', accountId)
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(`getLatestBrief failed: ${error.message}`)
  return (data as BriefRow | null) ?? null
}

export async function listBriefs(
  accountId: string,
  limit = 14,
): Promise<BriefRow[]> {
  const { data, error } = await supabaseService()
    .from('briefs')
    .select('*')
    .eq('account_id', accountId)
    .order('generated_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(`listBriefs failed: ${error.message}`)
  return (data as BriefRow[]) ?? []
}

export async function createBrief(
  accountId: string,
  since: string | null,
  items: BriefItem[],
): Promise<BriefRow> {
  const { data, error } = await supabaseService()
    .from('briefs')
    .insert({ account_id: accountId, since, items })
    .select('*')
    .single()
  if (error || !data) {
    throw new Error(`createBrief failed: ${error?.message ?? 'no data'}`)
  }
  return data as BriefRow
}

export async function markBriefDelivered(id: number): Promise<void> {
  const { error } = await supabaseService()
    .from('briefs')
    .update({ delivered: true })
    .eq('id', id)
  if (error) throw new Error(`markBriefDelivered failed: ${error.message}`)
}
