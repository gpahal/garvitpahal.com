import type { ReadConfidence } from '../puzzles/types'

export type Candidate<TPuzzle> = {
  puzzle: TPuzzle
  /**
   * `callRank`: later calls run stronger configurations, so a higher rank wins. Each call is its own
   * configuration, so only reads of different ranks can agree.
   */
  rank: number
  confidence: ReadConfidence
  fingerprint: string | undefined
}

type Arbitration<TPuzzle> = {
  /**
   * The trusted read once settled, else the best suspect.
   */
  best: Candidate<TPuzzle> | undefined
  suspects: Array<Candidate<TPuzzle>>
  lastResort: Candidate<TPuzzle> | undefined
}

type Verdict = {
  isSettled: boolean
}

export function createArbitration<TPuzzle>(): Arbitration<TPuzzle> {
  return { best: undefined, suspects: [], lastResort: undefined }
}

/**
 * The caller stops once settled, so every read considered before then is a suspect or a misread.
 */
export function considerRead<TPuzzle>(
  arbitration: Arbitration<TPuzzle>,
  candidate: Candidate<TPuzzle>,
): Verdict {
  if (candidate.confidence === 'trusted') {
    arbitration.best = candidate
    return { isSettled: true }
  }

  if (candidate.confidence === 'suspect') {
    // Not proof: models misread the same things, such as a blurred 6 or 8.
    const twin =
      candidate.fingerprint === undefined
        ? undefined
        : arbitration.suspects.find(
            (other) => other.fingerprint === candidate.fingerprint && other.rank !== candidate.rank,
          )
    if (twin) {
      const agreed = candidate.rank > twin.rank ? candidate : twin
      arbitration.best = { ...agreed, confidence: 'trusted' }
      return { isSettled: true }
    }
    arbitration.suspects.push(candidate)
    // Unsettled, so `best` is a suspect too and rank alone decides.
    if (!arbitration.best || candidate.rank > arbitration.best.rank) arbitration.best = candidate
    return { isSettled: false }
  }

  // Proven wrong: kept only in case nothing better ever arrives.
  if (!arbitration.lastResort || candidate.rank > arbitration.lastResort.rank) {
    arbitration.lastResort = candidate
  }
  return { isSettled: false }
}
