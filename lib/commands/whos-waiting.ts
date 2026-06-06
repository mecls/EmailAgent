import { runAgentLoop } from '@/lib/agent/agent-loop'

/**
 * Command C — "Who's waiting on me". Non-streaming agent run; the loop calls
 * query_email{ status:'awaiting_us', is_automated:false, order_by:'age_desc' }
 * (status is precomputed at index time → fast) and lists threads owed a reply.
 */
export async function whosWaiting(accountId: string): Promise<string> {
  return runAgentLoop({
    accountId,
    prompt:
      'Who is waiting on me to reply? Use query_email with status="awaiting_us", is_automated=false, order_by="age_desc". ' +
      'List each thread the oldest first with one line of context (who + what they need). Skip automated mail.',
  })
}
