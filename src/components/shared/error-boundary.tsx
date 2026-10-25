import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

import type { Failure } from '@/lib/failure'
import { isFocusLost } from '@/lib/final-focus'
import { NoticeAlert } from '@/components/shared/notice-alert'
import { remedyActions } from '@/components/shared/remedy-actions'
import { Button } from '@/components/ui/button'

type ErrorBoundaryProps = {
  failureOf: (error: unknown) => Failure
  /**
   * Offers Try again unless the failure says `noRetry`. The press re-renders the children, which
   * removes the button, so this must move focus off it first.
   */
  onTryAgain?: (button: HTMLButtonElement) => void
  leadingAction?: ReactNode
  /**
   * Clears a caught error when it changes, such as the day shown. A `key` would remount the
   * children on every change, failed or not.
   */
  resetKey?: unknown
  className?: string
  children: ReactNode
}

type ErrorBoundaryState = { error: unknown }

/**
 * Takes focus only when the throw took it with the children, so it does not fall to the page.
 * After Try again, the new Try again takes it, so a keyboard stays there rather than landing on a
 * leading Close.
 */
function focusFallback(fallback: HTMLDivElement | null, isRetry: boolean): void {
  const target =
    (isRetry ? fallback?.querySelector<HTMLElement>('[data-try-again]') : undefined) ??
    fallback?.querySelector<HTMLElement>('a[href], button') ??
    fallback?.querySelector<HTMLElement>('[data-slot="alert"]')
  if (target != null && (isRetry || isFocusLost(target))) {
    target.focus()
  }
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { error }
  }

  /**
   * Cleared by the commit after a Try again press. A fallback's ref runs before the boundary's
   * `componentDidUpdate`, so a fallback that commit mounts still sees it.
   */
  private isRetrying = false

  private readonly focusFallback = (fallback: HTMLDivElement | null): void => {
    focusFallback(fallback, this.isRetrying)
  }

  override state: ErrorBoundaryState = { error: undefined }

  readonly reset = (): void => {
    this.setState({ error: undefined })
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error(error, info.componentStack)
  }

  override componentDidUpdate(prevProps: ErrorBoundaryProps, prevState: ErrorBoundaryState): void {
    this.isRetrying = false
    // An error caught in this same update, perhaps thrown for the new key, stays shown.
    if (
      this.state.error !== undefined &&
      prevState.error !== undefined &&
      prevProps.resetKey !== this.props.resetKey
    ) {
      this.reset()
    }
  }

  override render(): ReactNode {
    const { error } = this.state
    const { failureOf, onTryAgain, leadingAction, className, children } = this.props
    if (error === undefined) {
      return children
    }
    const failure = failureOf(error)
    const tryAgain =
      onTryAgain === undefined || failure.noRetry ? undefined : (
        <Button
          variant="outline"
          data-try-again
          onClick={(event) => {
            onTryAgain(event.currentTarget)
            this.isRetrying = true
            this.reset()
          }}
        >
          Try again
        </Button>
      )
    const actions = remedyActions(failure, tryAgain, leadingAction)
    return (
      <div ref={this.focusFallback} className={className}>
        <NoticeAlert
          message={failure.message}
          action={actions}
          isFocusable={actions === undefined}
        />
      </div>
    )
  }
}
