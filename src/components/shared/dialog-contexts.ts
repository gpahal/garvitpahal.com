import { createContext } from 'react'
import type { ReactNode } from 'react'

import type { Failure } from '@/lib/failure'

/**
 * Has each dialog catch what its content throws, so one failing dialog costs only its own draft.
 * Without it, errors reach whatever boundary holds the dialog. Give a function that keeps its
 * identity, or every dialog re-renders.
 */
export const DialogErrorsContext = createContext<((error: unknown) => Failure) | undefined>(
  undefined,
)

/**
 * For content whose header renders from the read and so sits above the boundary, where a throw
 * would take the screen behind with it.
 */
export type DialogReadFailure = {
  error: Error
  /**
   * The content is still on its last result, so the failure is a notice above the body and a save
   * still goes to the server. Without one it takes the body's place.
   */
  hasResult: boolean
}

export const DialogReadFailureContext = createContext<DialogReadFailure | undefined>(undefined)

/**
 * What no dialog can fix, such as being offline, repeated in a dialog because a modal covers the
 * page's own notice. Only dialogs that save or have nothing else to show repeat it, so a stack of
 * dialogs shows one copy.
 */
export const DialogNoticeContext = createContext<ReactNode>(undefined)

/**
 * Shown above the fields, such as the subject changing elsewhere since the form opened.
 */
export const FormNoticeContext = createContext<string | undefined>(undefined)
