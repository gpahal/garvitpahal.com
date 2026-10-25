import { useMemo, useState, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'

import { useConvexConnectionState } from 'convex/react'

import type { TokenFetchProblem } from '@/lib/access-token'
import type { Failure } from '@/lib/failure'
import { createStore } from '@/lib/store'
import { useHasWaited } from '@/hooks/use-has-waited'
import { DialogNoticeContext } from '@/components/shared/dialog-contexts'
import { LoadingBlockedContext } from '@/components/shared/loading-blocked-context'
import { NoticeAlert } from '@/components/shared/notice-alert'
import { PendingButton } from '@/components/shared/pending-button'
import { focusDialogOnRemoval, refocusOnRemoval } from '@/components/shared/refocus-on-removal'
import { remedyActions } from '@/components/shared/remedy-actions'
import { SignInLink } from '@/components/shared/sign-in-link'

import { tokenFetchProblem } from './token-fetch-problem'

function useTokenFetchProblem(): TokenFetchProblem | undefined {
  return useSyncExternalStore(tokenFetchProblem.subscribe, tokenFetchProblem.get, () => undefined)
}

const online = createStore(true, (set) => {
  const update = (): void => {
    set(navigator.onLine)
  }
  update()
  globalThis.addEventListener('online', update)
  globalThis.addEventListener('offline', update)
  return () => {
    globalThis.removeEventListener('online', update)
    globalThis.removeEventListener('offline', update)
  }
})

function useIsOffline(): boolean {
  return !useSyncExternalStore(online.subscribe, online.get, () => true)
}

/**
 * Long enough that a reconnect after sleep or a network change never flashes it.
 */
const UNREACHABLE_AFTER_MS = 15_000

type Problem = Failure & {
  detail?: string
  /**
   * `pending` from the press until Convex accepts or rejects the held-back token (`access-token.ts`).
   */
  tryAgain?: 'offered' | 'pending'
}

const PROBLEMS = {
  expired: {
    message:
      'Your session has expired. Sign in again in a new tab. This page carries on once you have, with anything unsaved still here',
    signIn: true,
    reload: true,
  },
  unreadable: {
    message:
      'The server would not renew your session. Still trying. If this lasts, reload, which loses anything unsaved',
    reload: true,
  },
  // The page retries by itself and recovers alone, while a reload during an outage shows the
  // browser's offline page and loses any draft.
  unreachable: {
    message:
      'Cannot reach the server to renew your session. Still trying. This page carries on once it gets through',
  },
  unreachableBeforeSignIn: {
    message:
      'Cannot reach the server to sign you in. Still trying. This page carries on once it gets through',
  },
  offline: {
    message:
      'This device is offline. Reconnect it to the internet, and anything loading or saving carries on',
  },
  disconnected: {
    message:
      'Cannot reach the server. Still trying. Anything loading or saving carries on once it gets through',
  },
} satisfies Record<string, Problem>

const REJECTED_MESSAGE =
  "The server turned down this page's sign-in because its sign-in keys do not match. Once they match, try again"

/**
 * Neither signing in nor reloading helps until the keys agree, and nothing retries by itself
 * (`createAccessTokenFetcher` says why). Each outcome has its own words, so the live region
 * announces it.
 */
const REJECTED_MESSAGES: Record<Extract<TokenFetchProblem, { kind: 'rejected' }>['retry'], string> =
  {
    none: REJECTED_MESSAGE,
    pending: REJECTED_MESSAGE,
    rejected: 'The keys still do not match. Once they match, try again',
    unknown: 'Could not check the keys just now. Try again shortly',
  }

/**
 * Problems only the server can diagnose keep its wording. Only another account is fixed by signing
 * in, and a refused browser never gets through, so its message stands alone.
 */
function problemOf(tokenProblem: TokenFetchProblem, hasEverConnected: boolean): Problem {
  switch (tokenProblem.kind) {
    case 'refused':
    case 'unavailable': {
      const { message, signIn, noRetry } = tokenProblem.failure
      return signIn
        ? { message, signIn, detail: 'This page carries on once you have' }
        : noRetry
          ? { message }
          : { message, detail: 'Still trying. This page carries on once it gets through' }
    }
    case 'rejected': {
      return {
        message: REJECTED_MESSAGES[tokenProblem.retry],
        tryAgain: tokenProblem.retry === 'pending' ? 'pending' : 'offered',
      }
    }
    case 'unreachable': {
      // The socket opens only once the first token is in (`convex-provider.tsx`), so a page that
      // has never connected has no session to renew yet.
      return hasEverConnected ? PROBLEMS.unreachable : PROBLEMS.unreachableBeforeSignIn
    }
    case 'expired':
    case 'unreadable': {
      return PROBLEMS[tokenProblem.kind]
    }
  }
}

/**
 * Offline comes first: nothing else can be fixed until the device reconnects.
 */
function useConnectivityProblem(): Problem | undefined {
  const isOffline = useIsOffline()
  const tokenProblem = useTokenFetchProblem()
  const { isWebSocketConnected, hasEverConnected } = useConvexConnectionState()
  // The client retries a dropped socket for ever and says nothing, so a query stays on "Loading…"
  // and a mutation stays pending with no reason given.
  const isServerUnreachable = useHasWaited(!isWebSocketConnected, UNREACHABLE_AFTER_MS)
  if (isOffline) {
    return PROBLEMS.offline
  }
  if (tokenProblem !== undefined) {
    return problemOf(tokenProblem, hasEverConnected)
  }
  return isServerUnreachable ? PROBLEMS.disconnected : undefined
}

/**
 * Over once the problem has cleared and the socket is up again, until the next problem.
 */
function useHasRecovered(hasProblem: boolean): boolean {
  const { isWebSocketConnected } = useConvexConnectionState()
  const [phase, setPhase] = useState<'clear' | 'problem' | 'recovered'>(
    hasProblem ? 'problem' : 'clear',
  )
  if (hasProblem && phase !== 'problem') {
    setPhase('problem')
  } else if (phase === 'problem' && !hasProblem && isWebSocketConnected) {
    setPhase('recovered')
  }
  return phase === 'recovered'
}

/**
 * Moves focus to the page heading when a focused notice goes, as it does when trying again works.
 */
const pageNoticeRef = refocusOnRemoval(() => {
  document.querySelector<HTMLElement>('#main h1')?.focus()
})

/**
 * Keeps queries, content and forms mounted during outages; only progress indicators yield to the
 * notice. Form dialogs repeat it, so no reload loses a draft. The message is announced once, from a
 * live region that modal dialogs leave exposed, and recovery once from its own region.
 */
export function AgendaConnectivity({
  children,
  onTryAgain,
}: {
  children: ReactNode
  onTryAgain: () => void
}): ReactNode {
  const problem = useConnectivityProblem()
  const hasRecovered = useHasRecovered(problem !== undefined)
  const tryAgain = problem?.tryAgain
  const tryAgainButton = useMemo(
    () =>
      tryAgain === undefined ? undefined : (
        <PendingButton
          variant="outline"
          isPending={tryAgain === 'pending'}
          pendingLabel="Trying…"
          onClick={onTryAgain}
        >
          Try again
        </PendingButton>
      ),
    [tryAgain, onTryAgain],
  )
  const notice = useMemo(
    () =>
      problem === undefined ? undefined : (
        <div ref={focusDialogOnRemoval}>
          <NoticeAlert
            message={problem.message}
            description={problem.detail}
            announce="none"
            action={problem.signIn ? <SignInLink /> : tryAgainButton}
          />
        </div>
      ),
    [problem, tryAgainButton],
  )
  return (
    <LoadingBlockedContext value={problem !== undefined}>
      <p aria-live="assertive" className="sr-only">
        {problem === undefined
          ? undefined
          : [problem.message, problem.detail].filter((part) => part !== undefined).join('. ')}
      </p>
      {/* Its own region: good news need not interrupt. */}
      <p role="status" className="sr-only">
        {hasRecovered ? 'Connected to the server' : undefined}
      </p>
      {problem === undefined ? undefined : (
        <div ref={pageNoticeRef} className="mb-8">
          <NoticeAlert
            message={problem.message}
            description={problem.detail}
            announce="none"
            action={remedyActions(problem, tryAgainButton)}
          />
        </div>
      )}
      <DialogNoticeContext value={notice}>{children}</DialogNoticeContext>
    </LoadingBlockedContext>
  )
}
