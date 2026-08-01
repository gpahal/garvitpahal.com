import { OPENAI_API_KEY } from 'astro:env/server'

/**
 * The env field is declared optional so that builds succeed without secrets present: the generated
 * `astro:env/server` module throws at import time for a missing required secret, and it is
 * evaluated while prerendering. Failing here instead turns that into a runtime error on the one
 * route that actually needs the key.
 */
export function getOpenAiApiKey(): string {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured')
  }
  return OPENAI_API_KEY
}
