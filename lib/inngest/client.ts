import { Inngest, EventSchemas } from 'inngest'

/**
 * Event catalogue for the indexing pipeline + briefs.
 *
 * Every event carries `accountId` — the pipeline is account-scoped end to end
 * and the worker uses the service-role key (RLS bypassed), so each function MUST
 * filter by `accountId` itself. Cron functions (freshness poll, brief scheduler,
 * token refresh, hello) are triggered by schedule, not events, so they don't
 * appear here.
 */
export type Events = {
  // Indexing fan-out: kickoff → page → batch → derive-status.
  // `drain: true` means a batch counts toward the full-sync drain counter (set
  // by kickoff). Freshness deltas omit it so they don't fire spurious finalizes.
  'index.kickoff': { data: { accountId: string; sinceDays?: number } }
  'index.page': { data: { accountId: string; ids: string[]; drain?: boolean } }
  'index.batch': { data: { accountId: string; ids: string[]; drain?: boolean } }
  'index.derive-status': { data: { accountId: string; threadIds: string[] } }
  // Incremental freshness (one per account, fanned out from the poll cron).
  'freshness.account': { data: { accountId: string } }
  // Briefs (also fanned out from the scheduler cron).
  'brief.generate': { data: { accountId: string; manual?: boolean } }
}

export const inngest = new Inngest({
  id: 'emailagent',
  schemas: new EventSchemas().fromRecord<Events>(),
})
