import { useQuery } from 'convex/react'
import type { OptionalRestArgsOrSkip } from 'convex/react'
import { getFunctionName } from 'convex/server'
import type { FunctionArgs, FunctionReference, FunctionReturnType } from 'convex/server'

import { useStandIn } from '@/hooks/use-stand-in'

type GrowingRead<Result> = {
  /**
   * `undefined` until the first read lands, and again once any argument but the limit changes.
   */
  result: Result | undefined
  /**
   * A raised limit is on its way, with the last result standing in.
   */
  isLoading: boolean
}

/**
 * While a raised limit loads, the last result stands in so the list does not blank under "Load
 * more". It stands in only for the same query and arguments bar the limit, so rows never carry over
 * to another day or to boundaries moved by a change of zone.
 */
export function useGrowingRead<Query extends FunctionReference<'query'>>(
  query: Query,
  args: FunctionArgs<Query> | 'skip',
): GrowingRead<FunctionReturnType<Query>> {
  // The spread type cannot be resolved for an unknown query, though `[args]` is always one.
  const current = useQuery(query, ...([args] as OptionalRestArgsOrSkip<Query>))
  const last = useStandIn(
    current,
    JSON.stringify([
      getFunctionName(query),
      args === 'skip' ? 'skip' : { ...args, limit: undefined },
    ]),
  )
  return { result: last, isLoading: last !== undefined && current === undefined }
}
