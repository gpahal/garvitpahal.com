import type { ReadAssessment, SolveOptions, SolveResult } from './types'

/**
 * A `timeoutMs` of zero or less reports a timeout before any work.
 */
export function solveDeadline(options: SolveOptions): { now: () => number; deadline: number } {
  const now = options.now ?? (() => performance.now())
  return { now, deadline: now() + options.timeoutMs }
}

/**
 * Uniqueness is confidence, not proof of transcription. A proven second solution drops the
 * fingerprint: a printed puzzle has one solution, so configurations that agree on this read share a
 * mistake. A `timeout` drops it too, since it has not shown the read is solvable.
 */
export function assessSolve(solved: SolveResult, fingerprint: string | undefined): ReadAssessment {
  switch (solved.status) {
    case 'unsolvable': {
      return { confidence: 'misread' }
    }
    case 'multiple':
    case 'timeout': {
      return { confidence: 'suspect' }
    }
    case 'solved': {
      if (fingerprint === undefined) return { confidence: 'suspect' }
      return { confidence: solved.isUnique ? 'trusted' : 'suspect', fingerprint }
    }
  }
}
