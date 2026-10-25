import type { APIRoute } from 'astro'
import { OPENAI_API_KEY } from 'astro:env/server'

import { EXTRACTIONS } from '@/lib/x/puzzle-solvers/puzzles/server/extraction-registry'
import { consumeRateLimit } from '@/lib/x/puzzle-solvers/vision/server/convex-server'
import { serveExtraction } from '@/lib/x/puzzle-solvers/vision/server/extract-handler'
import type { ExtractHandlerDeps } from '@/lib/x/puzzle-solvers/vision/server/extract-handler'
import { extractStructured } from '@/lib/x/puzzle-solvers/vision/server/openai-exchange'

export const prerender = false

const DEPS: ExtractHandlerDeps = {
  isConfigured: () => Boolean(OPENAI_API_KEY),
  consumeRateLimit,
  // The handler asks `isConfigured` before any call.
  extractStructured: async (options) =>
    extractStructured(options, { apiKey: OPENAI_API_KEY ?? '', fetchFn: fetch }),
}

export const POST: APIRoute = async (context) => serveExtraction(context, EXTRACTIONS, DEPS)
