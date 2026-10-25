import { useQuery } from 'convex-helpers/react'
import type { OptionalRestArgsOrSkip } from 'convex/react'
import type { FunctionReference, FunctionReturnType } from 'convex/server'

/**
 * Hands back the read's error rather than throwing it as `convex/react`'s `useQuery` does, for the
 * dialog to show (`DialogReadFailure`). Keyed by value, so fresh argument objects keep their
 * subscription.
 */
export function useDialogQuery<Query extends FunctionReference<'query'>>(
  query: Query,
  ...args: OptionalRestArgsOrSkip<Query>
): FunctionReturnType<Query> | undefined | Error {
  const { data, error } = useQuery(query, ...args)
  return error ?? data
}

/**
 * Subscribes to the document by id, never to the screen's list. `null` once deleted; `undefined`
 * until the subscription lands, while the opened document stands in (`LiveSubjectContent`).
 */
export function useLiveDoc<Doc extends { _id: string }>(
  query: FunctionReference<'query', 'public', { id: Doc['_id'] }, Doc | null>,
  opened: Doc,
): Doc | null | undefined | Error {
  // The spread type cannot be resolved for a generic query, though `[args]` is always one.
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- the spread, as above
  return useDialogQuery(query, ...([{ id: opened._id }] as OptionalRestArgsOrSkip<typeof query>))
}
