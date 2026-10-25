import { createContext } from 'react'

/**
 * A visible outage replaces progress messages while queries and mounted drafts keep their state.
 */
export const LoadingBlockedContext = createContext(false)
