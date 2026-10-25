/// <reference types="astro/client" />

declare namespace App {
  /**
   * `@astrojs/cloudflare`'s own declaration names the Workers `ExecutionContext` type, which
   * nothing here loads, so the part routes use is declared here.
   */

  interface Locals {
    cfContext: { waitUntil: (promise: Promise<unknown>) => void }
    /**
     * Set by the `/api/x` gate. Read it with `ownerOf` (`src/lib/server/api-gate.ts`).
     */
    owner?: { token: string; requestId: string }
  }
}
