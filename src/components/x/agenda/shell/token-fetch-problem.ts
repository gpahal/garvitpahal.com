import type { TokenFetchProblem } from '@/lib/access-token'
import { createStore } from '@/lib/store'

/**
 * Module-level like the token fetcher that reports to it, so a remount sees a problem under way.
 */
export const tokenFetchProblem = createStore<TokenFetchProblem | undefined>(undefined)

export const setTokenFetchProblem = tokenFetchProblem.set
