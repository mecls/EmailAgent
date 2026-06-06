import { runAgentLoop } from '@/lib/agent/agent-loop'

/**
 * Command B — "Catch me up on <person/company/domain>". A non-streaming run of
 * the agent loop with a templated prompt; the loop resolves the target via
 * search_email + sender filter and returns a tight status report.
 */
export async function catchMeUp(
  accountId: string,
  target: string,
): Promise<string> {
  return runAgentLoop({
    accountId,
    prompt:
      `Catch me up on ${target}. Use search_email (and a sender filter if ${target} looks like a person, company, or domain). ` +
      `Give me: last contact, current state, any open question, what they're waiting on, and a suggested next step. 4–6 lines.`,
  })
}
