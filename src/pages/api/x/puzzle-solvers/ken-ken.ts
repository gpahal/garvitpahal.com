import { createExtractHandler } from '@/lib/vision/extract-endpoint'
import { KEN_KEN_MAX_IMAGE_BYTES, puzzleToWire, type KenKenPuzzleWire } from '@/puzzles/ken-ken/api'
import { KEN_KEN_EXTRACTION_SCHEMA, kenKenExtractionPrompt } from '@/puzzles/ken-ken/extraction'
import { kenKenHintsSchema, type KenKenHints } from '@/puzzles/ken-ken/hints'
import { kenKenRawSchema, parseKenKen, type KenKenRaw } from '@/puzzles/ken-ken/parse'

// eslint-disable-next-line unicorn/consistent-boolean-name
export const prerender = false

/**
Parse only. Whether a read is trustworthy is the browser's call, where the solver has a real clock.
*/
export const POST = createExtractHandler<KenKenRaw, KenKenPuzzleWire, KenKenHints>({
  puzzleId: 'ken-ken',
  maxImageBytes: KEN_KEN_MAX_IMAGE_BYTES,
  schema: KEN_KEN_EXTRACTION_SCHEMA,
  hintsSchema: kenKenHintsSchema,
  prompt: kenKenExtractionPrompt,
  responseSchema: kenKenRawSchema,
  interpret: (raw) => {
    const parsed = parseKenKen(raw)
    if (!parsed.ok) {
      return { ok: false, message: parsed.message }
    }
    return {
      ok: true,
      result: puzzleToWire(parsed.puzzle),
      logFields: {
        n: parsed.puzzle.grid.n,
        cageCount: parsed.puzzle.grid.cages.length,
        contradictions: parsed.puzzle.contradictions.length,
        unreviewedCount: parsed.puzzle.unreviewedCages.length,
      },
    }
  },
})
