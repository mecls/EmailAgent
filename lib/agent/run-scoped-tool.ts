import { SearchInput, QueryInput } from './tools'
import { embedQuery } from '@/lib/embeddings'
import { searchEmbeddings, queryThreads, queryMessages } from '@/lib/db/search'

/**
 * Execute a tool call, scoped to a SERVER-DERIVED accountId. The model fills the
 * params; this code Zod-validates them and builds the (always account-filtered)
 * query. The account id is injected here and is impossible for the model to
 * override — the core tenancy guarantee. No tool writes or sends anything.
 */
export async function runScopedTool(
  name: string,
  rawInput: unknown,
  accountId: string,
): Promise<unknown> {
  if (name === 'search_email') {
    const input = SearchInput.parse(rawInput)
    const vector = await embedQuery(input.query)
    return searchEmbeddings(accountId, vector, {
      limit: input.limit ?? 10,
      sender: input.sender,
      since: input.since,
    })
  }

  if (name === 'query_email') {
    const input = QueryInput.parse(rawInput)
    if (input.status) {
      return queryThreads(accountId, {
        status: input.status,
        orderBy: input.order_by,
        limit: input.limit ?? 25,
      })
    }
    return queryMessages(accountId, {
      direction: input.direction,
      isAutomated: input.is_automated,
      sender: input.sender,
      since: input.since,
      until: input.until,
      orderBy: input.order_by,
      limit: input.limit ?? 25,
    })
  }

  throw new Error(`unknown tool: ${name}`)
}
