import { createContext, use, useEffect, useLayoutEffect } from 'react'
import type { ComponentProps } from 'react'

import { retainUnloadWarning } from '@/lib/unload-warning'
import type { DialogContent } from '@/components/ui/dialog'

/**
 * Untouched defaults are not `dirty`.
 */
export type WorkState = { dirty: boolean; pending: boolean }

/**
 * One context costs no extra renders: none of it changes while the dialog is open.
 */
type DialogScope = {
  finalFocus: ComponentProps<typeof DialogContent>['finalFocus']
  register: (work: WorkState) => () => void
}

export const DialogScopeContext = createContext<DialogScope | undefined>(undefined)

export function useDialogWork(isDirty: boolean, isPending: boolean): void {
  const register = use(DialogScopeContext)?.register
  useEffect(() => (isDirty ? retainUnloadWarning() : undefined), [isDirty])
  useLayoutEffect(
    () => register?.({ dirty: isDirty, pending: isPending }),
    [register, isDirty, isPending],
  )
}
