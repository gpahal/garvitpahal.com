import type { ReactNode, RefObject } from 'react'

import type { Capture } from '@/lib/x/puzzle-solvers/capture/rectify'
import { PendingButton } from '@/components/shared/pending-button'
import { ReloadButton } from '@/components/shared/reload-button'
import { SignInLink } from '@/components/shared/sign-in-link'
import { Button } from '@/components/ui/button'

import { PictureDialog } from '../capture/picture-dialog'

type ReadActionsProps = {
  reference: Capture | undefined
  /**
   * `undefined` when reading again cannot help.
   */
  retry:
    | {
        label: string
        isPending: boolean
        pendingLabel: string
        onRetry: () => void
      }
    | undefined
  retryRef: RefObject<HTMLButtonElement | null>
  isBusy: boolean
  /**
   * The countdown to the next allowed read.
   */
  waitId: string | undefined
  hasSignInLink: boolean
  hasReload: boolean
  /**
   * Available during a read or solve, which it cancels.
   */
  choosePicture: { label: string; onChoose: () => void } | undefined
}

export function ReadActions({
  reference,
  retry,
  retryRef,
  isBusy,
  waitId,
  hasSignInLink,
  hasReload,
  choosePicture,
}: ReadActionsProps): ReactNode {
  if (!reference && !retry && !hasSignInLink && !hasReload && !choosePicture) return undefined
  const isWaiting = waitId !== undefined
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {reference ? <PictureDialog capture={reference} /> : undefined}
      {retry ? (
        <PendingButton
          ref={retryRef}
          variant="outline"
          isPending={retry.isPending}
          pendingLabel={retry.pendingLabel}
          disabled={isBusy || isWaiting}
          // Reachable during a wait, so a reader can hear how long it lasts.
          focusableWhenDisabled={isWaiting}
          aria-describedby={waitId}
          onClick={retry.onRetry}
        >
          {retry.label}
        </PendingButton>
      ) : undefined}
      {hasSignInLink ? <SignInLink /> : undefined}
      {hasReload ? <ReloadButton /> : undefined}
      {choosePicture ? (
        <Button variant="outline" onClick={choosePicture.onChoose}>
          {choosePicture.label}
        </Button>
      ) : undefined}
    </div>
  )
}
