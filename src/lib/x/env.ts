import { ANTHROPIC_API_KEY } from 'astro:env/server'

/**
 * The env field is declared optional so that builds succeed without secrets present: the generated
 * `astro:env/server` module throws at import time for a missing required secret, and it is
 * evaluated while prerendering. Failing here instead turns that into a runtime error on the one
 * route that actually needs the key.
 */
export function getAnthropicApiKey(): string {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not configured')
  }
  return ANTHROPIC_API_KEY
}
