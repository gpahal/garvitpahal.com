import { createContext, use, useState } from 'react'

/**
 * True once a form was submitted with errors, which reveals them all.
 */
export const ErrorsRevealedContext = createContext(false)

/**
 * A just-appeared empty input is not a mistake yet, so its error waits until the input is changed
 * or left, or the form is submitted.
 */
export function useErrorOnceTouched<TError>(
  error: TError | undefined,
  isTouchedAtFirst = false,
): { shownError: TError | undefined; touch: () => void } {
  const [isTouched, setIsTouched] = useState(isTouchedAtFirst)
  const isRevealed = use(ErrorsRevealedContext)
  return {
    shownError: isTouched || isRevealed ? error : undefined,
    touch: () => {
      setIsTouched(true)
    },
  }
}
