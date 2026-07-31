import type { APIContext } from 'astro'

import { z } from 'zod'

import { extractStructured, VisionExtractionError } from '@/lib/vision/extract'
import { visionModelsSchema, type VisionModel } from '@/lib/vision/model'
import { elapsedMs, getRequestId, logEvent } from '@/lib/x/log'
import { extractErrorResponse, jsonResponse } from '@/lib/x/response'
import {
  gridToWire,
  SUDOKU_MAX_IMAGE_BYTES,
  type SudokuExtractResponse,
  type SudokuGridWire,
} from '@/puzzles/sudoku/api'
import { SUDOKU_EXTRACTION_PROMPT, SUDOKU_EXTRACTION_SCHEMA } from '@/puzzles/sudoku/extraction'
import { parseSudoku, sudokuRawSchema, type SudokuRaw } from '@/puzzles/sudoku/parse'
import { solveSudoku } from '@/puzzles/sudoku/solve'
import type { CellRef, ExtractErrorCode, SolveResult } from '@/puzzles/types'

// eslint-disable-next-line unicorn/consistent-boolean-name
export const prerender = false

/** Size is checked separately below: it is the one failure with its own status code. */
const extractRequestSchema = z.strictObject({
  mediaType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  data: z.string().min(1),
  models: visionModelsSchema,
})

/** Only decides whether a read looks trustworthy, so it is tighter than a user-initiated solve. */
const VERIFY_TIMEOUT_MS = 1000

type ReadResult =
  | {
      kind: 'grid'
      puzzle: SudokuGridWire
      uncertain: Array<CellRef>
      solveStatus: SolveResult<unknown>['status']
    }
  | { kind: 'error'; outcome: string; code: ExtractErrorCode; status: number; message: string }

export async function POST(context: APIContext): Promise<Response> {
  const requestId = getRequestId(context.request)
  const startedAt = Date.now()

  /** Every exit goes through here: `outcome` says which branch ended it, the status cannot. */
  function done(outcome: string, response: Response, fields?: Record<string, unknown>): Response {
    logEvent('sudoku.done', {
      requestId,
      outcome,
      status: response.status,
      ms: elapsedMs(startedAt),
      ...fields,
    })
    return response
  }

  let json: unknown
  try {
    json = await context.request.json()
  } catch {
    return done(
      'invalid_json',
      extractErrorResponse({ code: 'invalid_request', message: 'Expected a JSON body.' }, 400),
    )
  }

  const parsedRequest = extractRequestSchema.safeParse(json)
  if (!parsedRequest.success) {
    const message = z.prettifyError(parsedRequest.error)
    return done(
      'invalid_request',
      extractErrorResponse({ code: 'invalid_request', message }, 400),
      { message },
    )
  }
  const { mediaType, data, models } = parsedRequest.data

  // Check the encoded length before decoding so an oversized payload costs nothing.
  const approximateBytes = Math.floor((data.length * 3) / 4)
  if (approximateBytes > SUDOKU_MAX_IMAGE_BYTES) {
    return done(
      'image_too_large',
      extractErrorResponse({ code: 'image_too_large', message: 'That image is too large.' }, 413),
      { approximateBytes },
    )
  }

  logEvent('sudoku.request', {
    requestId,
    mediaType,
    approximateBytes,
    primaryModel: models.primary.id,
  })

  const image = { mediaType, data }
  let model = models.primary
  let result = await read(image, model, requestId)

  for (const fallback of models.fallbacks) {
    if (!shouldEscalate(result)) {
      break
    }

    logEvent('sudoku.escalated', {
      requestId,
      from: model.id,
      to: fallback.id,
      reason: result.kind === 'grid' ? `solve_${result.solveStatus}` : result.outcome,
    })

    const retried = await read(image, fallback, requestId)
    // A grid the user can correct beats an error page, so an earlier grid survives a failed retry.
    result = retried.kind === 'grid' || result.kind === 'error' ? retried : result
    model = fallback
  }

  if (result.kind === 'error') {
    return done(
      result.outcome,
      extractErrorResponse({ code: result.code, message: result.message }, result.status),
    )
  }

  // An unverified grid is still returned: the review step exists to fix what the model got wrong.
  return done(
    'ok',
    jsonResponse<SudokuExtractResponse>(
      { ok: true, puzzle: result.puzzle, uncertain: result.uncertain },
      200,
    ),
    { solveStatus: result.solveStatus, uncertainCount: result.uncertain.length },
  )
}

/**
 * A printed puzzle is well-formed, so anything but a unique solution means a misread. Config and
 * upstream failures are excluded: another call cannot fix a missing key, and a retried timeout just
 * doubles the wait.
 */
function shouldEscalate(result: ReadResult): boolean {
  return result.kind === 'grid'
    ? result.solveStatus !== 'solved'
    : RETRYABLE_OUTCOMES.has(result.outcome)
}

/** Bad model output rather than a bad request: a stronger model gets another go at all of these. */
const RETRYABLE_OUTCOMES = new Set([
  'extraction_truncated',
  'extraction_empty',
  'extraction_unparseable',
  'unparseable_grid',
])

async function read(
  image: { mediaType: string; data: string },
  model: VisionModel,
  requestId: string,
): Promise<ReadResult> {
  let raw: SudokuRaw
  try {
    raw = await extractStructured<SudokuRaw>({
      image,
      schema: SUDOKU_EXTRACTION_SCHEMA,
      responseSchema: sudokuRawSchema,
      prompt: SUDOKU_EXTRACTION_PROMPT,
      model,
      requestId,
    })
  } catch (error) {
    if (error instanceof VisionExtractionError) {
      // A missing secret is a server misconfiguration, not a bad picture - say so, and use 5xx that
      // does not imply the upstream model rejected anything.
      return error.reason === 'not_configured'
        ? {
            kind: 'error',
            outcome: 'not_configured',
            code: 'not_configured',
            status: 503,
            message: error.message,
          }
        : {
            kind: 'error',
            outcome: `extraction_${error.reason}`,
            code: 'model_failed',
            status: 502,
            message: error.message,
          }
    }
    return {
      kind: 'error',
      outcome: 'unexpected_error',
      code: 'model_failed',
      status: 502,
      message: 'Could not read the puzzle from that image.',
    }
  }

  const parsed = parseSudoku(raw)
  if (!parsed.ok) {
    return {
      kind: 'error',
      outcome: 'unparseable_grid',
      code: 'unparseable',
      status: 422,
      message: parsed.message,
    }
  }

  const solveStatus = solveSudoku(parsed.grid, { timeoutMs: VERIFY_TIMEOUT_MS }).status
  logEvent('sudoku.verified', { requestId, model: model.id, n: parsed.grid.n, solveStatus })

  return {
    kind: 'grid',
    puzzle: gridToWire(parsed.grid),
    uncertain: parsed.uncertain,
    solveStatus,
  }
}
