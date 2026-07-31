import type { ReactNode, RefObject } from 'react'

import { Dialog as BaseDialog } from '@base-ui/react/dialog'

/**
 * Thin wrapper over Base UI's dialog: `Portal + Backdrop + Popup` are composed into a single
 * `DialogContent` so call sites carry no plumbing.
 *
 * Base UI handles focus trapping, Esc, focus restore, `aria-modal`, background inertness and scroll
 * locking. Note the part names differ from Radix: Backdrop (not Overlay) and Popup (not Content).
 */
export const Dialog = BaseDialog.Root
export const DialogTrigger = BaseDialog.Trigger
export const DialogClose = BaseDialog.Close

type DialogContentProps = {
  children: ReactNode
  className?: string
  /** Visually hidden titles still announce correctly; omitting the title entirely does not. */
  title: string
  hideTitle?: boolean
  description?: string
  showCloseButton?: boolean
  /**
   * Focused when the dialog opens. Base UI otherwise takes the first tabbable element, which is
   * whatever happens to be highest in the DOM rather than the action the dialog exists for.
   */
  initialFocus?: RefObject<HTMLElement | null>
}

export function DialogContent({
  children,
  className,
  title,
  hideTitle = false,
  description,
  showCloseButton = true,
  initialFocus,
}: DialogContentProps): ReactNode {
  return (
    <BaseDialog.Portal>
      {/*
        Transitions rather than keyframes: Base UI can cancel a transition smoothly if the dialog is
        dismissed mid-animation. Exit timing needs no `keepMounted` - Base UI waits on
        `element.getAnimations()` before unmounting.
      */}
      <BaseDialog.Backdrop className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm data-ending-style:opacity-0 data-starting-style:opacity-0 motion-safe:transition-opacity motion-safe:duration-150" />
      <BaseDialog.Popup
        initialFocus={initialFocus}
        className={`fixed top-1/2 left-1/2 z-50 flex max-h-[90dvh] w-[min(32rem,calc(100vw-2rem))] -translate-1/2 flex-col overflow-hidden rounded-xl border border-gray-6 bg-bg shadow-lg shadow-gray-a-5 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0 motion-safe:transition-[opacity,transform] motion-safe:duration-150 ${className ?? ''}`}
      >
        <div className={hideTitle ? 'sr-only' : 'shrink-0 border-b border-gray-6 px-5 py-3'}>
          <BaseDialog.Title className="my-0! text-base! font-semibold!">{title}</BaseDialog.Title>
          {description ? (
            <BaseDialog.Description className="my-0! mt-1! text-sm! text-gray-11">
              {description}
            </BaseDialog.Description>
          ) : undefined}
        </div>

        {children}

        {showCloseButton ? (
          <BaseDialog.Close
            aria-label="Close"
            className="unstyled absolute top-2.5 right-2.5 inline-flex size-8 items-center justify-center rounded-md text-gray-11 focus-visible:ring-2 focus-visible:ring-anchor focus-visible:outline-none hocus-visible:bg-gray-4 hocus-visible:text-gray-12"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="size-5 stroke-[1.5]"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </BaseDialog.Close>
        ) : undefined}
      </BaseDialog.Popup>
    </BaseDialog.Portal>
  )
}

export function DialogBody({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}): ReactNode {
  return <div className={`min-h-0 flex-1 overflow-auto ${className ?? ''}`}>{children}</div>
}

export function DialogFooter({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}): ReactNode {
  return (
    <div className={`shrink-0 border-t border-gray-6 px-5 py-3 ${className ?? ''}`}>{children}</div>
  )
}
