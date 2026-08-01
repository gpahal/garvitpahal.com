import { createExtractHandler } from '@/lib/vision/extract-endpoint'
import { KEN_KEN_MAX_IMAGE_BYTES, puzzleToWire, type KenKenPuzzleWire } from '@/puzzles/ken-ken/api'
import { KEN_KEN_EXTRACTION_PROMPT, KEN_KEN_EXTRACTION_SCHEMA } from '@/puzzles/ken-ken/extraction'
import { kenKenRawSchema, parseKenKen, type KenKenRaw } from '@/puzzles/ken-ken/parse'
import { solveKenKen } from '@/puzzles/ken-ken/solve'

// eslint-disable-next-line unicorn/consistent-boolean-name
export const prerender = false

/** Only decides whether a read looks trustworthy, so it is tighter than a user-initiated solve. */
const VERIFY_TIMEOUT_MS = 1000

export const POST = createExtractHandler<KenKenRaw, KenKenPuzzleWire>({
  puzzleId: 'ken-ken',
  maxImageBytes: KEN_KEN_MAX_IMAGE_BYTES,
  schema: KEN_KEN_EXTRACTION_SCHEMA,
  prompt: KEN_KEN_EXTRACTION_PROMPT,
  responseSchema: kenKenRawSchema,
  interpret: (raw) => {
    const parsed = parseKenKen(raw)
    if (!parsed.ok) {
      return { ok: false, message: parsed.message }
    }

    // A printed Ken Ken has exactly one solution, so anything else means a border or clue was
    // misread. A solve that ran out of time before ruling out a second solution proves nothing, so
    // it is not enough to trust. Nor is a cage the parser flagged, even if the puzzle happens to
    // solve: the checks caught a real disagreement about what is on the page.
    const solved = solveKenKen(parsed.puzzle, { timeoutMs: VERIFY_TIMEOUT_MS })
    const isTrusted =
      solved.status === 'solved' && solved.isUnique && parsed.puzzle.unreviewedCages.length === 0

    return {
      ok: true,
      result: puzzleToWire(parsed.puzzle),
      confidence: isTrusted ? 'trusted' : 'suspect',
      logFields: {
        n: parsed.puzzle.grid.n,
        cageCount: parsed.puzzle.grid.cages.length,
        solveStatus: solved.status,
        isUnique: solved.status === 'solved' ? solved.isUnique : null,
        unreviewedCount: parsed.puzzle.unreviewedCages.length,
      },
    }
  },
})
