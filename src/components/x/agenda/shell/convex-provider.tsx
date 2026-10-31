import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { PUBLIC_CONVEX_URL } from 'astro:env/client'

import { ConvexProvider, ConvexReactClient } from 'convex/react'

import { api } from '@convex/_generated/api'

import { checkConvexToken, createAccessTokenFetcher } from '@/lib/access-token'
import { boundaryFailure } from '@/lib/convex-errors'
import type { Failure } from '@/lib/failure'
import { sleepUntilWoken } from '@/lib/sleep-until-woken'
import { DialogErrorsContext } from '@/components/shared/dialog-contexts'
import { ErrorBoundary } from '@/components/shared/error-boundary'
import { NoticeAlert } from '@/components/shared/notice-alert'

import { AgendaConnectivity } from './connectivity'
import { RecordTimeZone } from './record-time-zone'
import { setTokenFetchProblem } from './token-fetch-problem'

/**
 * One client for the page's lifetime: an unmounting island never closes its client, so one per
 * mount would leak a WebSocket per navigation. It fetches tokens only while an Agenda root is
 * mounted. Auth is set here once, not by `ConvexProviderWithAuth`, which re-auths on every mount and
 * would pause queries on each arrival; set before render, no query runs without a token.
 */
function createClient(url: string): { client: ConvexReactClient; tryAgain: () => void } {
  const created = new ConvexReactClient(url, {
    // The first token was minted moments before, so the refetch Convex makes on confirming it would
    // only mint another.
    initialAuthTokenReuse: true,
    // Tokens are short-lived (`src/lib/server/convex-token.ts`); the default 10s leaves no room for
    // a failed fetch and retry, or a late timer in a hidden tab.
    authRefreshTokenLeewaySeconds: 60,
    // `useSubmit` holds the leave-page warning for every write until it settles, which covers
    // everything this one would.
    unsavedChangesWarning: false,
  })
  const { fetchToken, onRefreshChange, tryAgain } = createAccessTokenFetcher({
    fetchFn: fetch,
    sleep: sleepUntilWoken,
    whenWanted: whenAgendaMounted,
    onProblemChange: setTokenFetchProblem,
    // The smallest owner read there is: one task at most.
    checkToken: async (token) =>
      checkConvexToken(fetch, url, api.tasks.listOutstanding, { limit: 1 }, token),
  })
  created.setAuth(fetchToken, undefined, onRefreshChange)
  return { client: created, tryAgain }
}

/**
 * Counted, not flagged, so a StrictMode remount or overlapping roots in a view transition cannot
 * leave it wrong. Before the first mount the token is wanted anyway: only an Agenda island creates
 * the client.
 */
const agendaRoots = { mounted: 0, hasMounted: false, waiting: [] as Array<() => void> }

async function whenAgendaMounted(): Promise<void> {
  if (agendaRoots.mounted > 0 || !agendaRoots.hasMounted) {
    return
  }
  return new Promise((resolve) => {
    agendaRoots.waiting.push(resolve)
  })
}

function useCountAgendaRoot(): void {
  useEffect(() => {
    agendaRoots.mounted += 1
    agendaRoots.hasMounted = true
    for (const resolve of agendaRoots.waiting.splice(0)) {
      resolve()
    }
    return () => {
      agendaRoots.mounted -= 1
    }
  }, [])
}

const connection =
  PUBLIC_CONVEX_URL !== undefined && PUBLIC_CONVEX_URL !== ''
    ? createClient(PUBLIC_CONVEX_URL)
    : undefined

/**
 * What escapes `ListsBoundary` and every dialog's boundary lands here, by which time the drafts are
 * gone.
 */
function pageFailure(error: unknown): Failure {
  return boundaryFailure(error, { keepsDrafts: false })
}

function dialogFailure(error: unknown): Failure {
  return boundaryFailure(error, { keepsDrafts: true })
}

export function AgendaProvider({ children }: { children: ReactNode }): ReactNode {
  useCountAgendaRoot()
  return !connection ? (
    <NoticeAlert message="Agenda is not connected to its database. Set PUBLIC_CONVEX_URL, then restart the dev server or rebuild" />
  ) : (
    <ConvexProvider client={connection.client}>
      <ErrorBoundary failureOf={pageFailure}>
        <DialogErrorsContext value={dialogFailure}>
          <AgendaConnectivity onTryAgain={connection.tryAgain}>
            <RecordTimeZone />
            {children}
          </AgendaConnectivity>
        </DialogErrorsContext>
      </ErrorBoundary>
    </ConvexProvider>
  )
}
