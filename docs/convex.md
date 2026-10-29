# Convex

Shared backend: Agenda stores its data here and Puzzle solvers meters reads. Before writing Convex code, read [`convex/_generated/ai/guidelines.md`](../convex/_generated/ai/guidelines.md); the rules below take precedence. Refresh it with `pnpm convex-guidelines`.

## Browser boundary

`src/` may import only `_generated/` and `shared/`. Put a rule in `shared/` when browser and server must decide identically, since a disagreement refuses a save the browser believed valid; server-only rules go in `lib/`. The `/x` island chunks are public assets outside Access, so browser code holds no secrets.

## Authentication

The Worker verifies the Access JWT, refuses any email but `OWNER_EMAIL` and mints a short-lived token ([`owner-token.ts`](../src/lib/server/owner-token.ts)) that [`auth.config.ts`](../convex/auth.config.ts) accepts; [`lib/auth.ts`](../convex/lib/auth.ts) checks Convex's own `OWNER_EMAIL` again. The `/api/x` gate mints a token for each request it admits: Agenda fetches it from `/api/x/token` ([`access-token.ts`](../src/lib/access-token.ts)), and paid routes meter with it. The signing key is the only trust anchor, so [rotate](deployment.md#rotating-the-convex-token-key) a leaked one at once. Convex's `OWNER_EMAIL` and `CONVEX_JWT_JWKS` are set from the Worker's `OWNER_EMAIL` and `CONVEX_JWT_PRIVATE_KEY` ([`convex-env.ts`](../scripts/convex-env.ts)), by `pnpm convex-dev-set-env` locally and by Deploy in production.

Under `pnpm dev`, a loopback request without Access, Cloudflare or proxy headers (`isDirectLocalRequest`) gets the owner's token unverified, signed with the development key ([`dev-owner-token.ts`](../src/lib/server/dev-owner-token.ts)). Anyone who reaches the dev server is the owner, so it refuses `--host`. A build drops the path, so `pnpm preview` cannot sign in.

## Functions

- Build functions with [`lib/functionBuilders.ts`](../convex/lib/functionBuilders.ts), so every public function runs the owner check and every write keeps the aggregate trigger. Check inputs with [`lib/validate.ts`](../convex/lib/validate.ts).
- Name indexes after their fields, with underscores for dots: `by_done_at_and_showAt`.
- A mutation repeated from a second tab, such as complete, archive or remove, succeeds as a no-op and never moves a recorded instant.
- A mutation on a document deleted elsewhere throws its `requireDoc` message ([`lib/documents.ts`](../convex/lib/documents.ts)); `remove` treats an already-deleted document as done.
- `undefined` is stripped in transit, so clearing a field takes its own mutation or an empty string.
- Cap stored rows only when a read depends on the cap.
- Commit `convex/_generated`; `pnpm convex-dev` or `pnpm exec convex codegen` regenerates it.

## Errors

`UNAUTHENTICATED` and `FORBIDDEN` ([`shared/errorCodes.ts`](../convex/shared/errorCodes.ts)) are the owner check's refusals. The browser shows every other `ConvexError` string verbatim, so follow the [message rules](../AGENTS.md#writing), name the way out and never suggest a reload for a recoverable refusal, since a reload discards drafts.

## Rate limits

[`rateLimits.ts`](../convex/rateLimits.ts) meters puzzle reads in one Convex transaction, so the budget holds across Cloudflare locations, and caps calls weighted by price, not the bill ([OpenAI](deployment.md#openai)). A paid route consumes its admissions before reading the body (`consumeRateLimit` in [`convex-server.ts`](../src/lib/x/puzzle-solvers/vision/server/convex-server.ts)), never refunds them and answers 503 without paid work when metering is unavailable.

## Tests

The `handlers` Vitest project (`pnpm test --project handlers`) runs the top-level `convex/*.test.ts` files, most with `convex-test`, for what pure tests cannot show: aggregates, owner authorisation, scheduled deletion, completion guards and metering. [`ownerAccess.test.ts`](../convex/ownerAccess.test.ts) checks that every public function refuses a stranger and an anonymous caller.

- Start each test from `handlerTest` or `setup` (signed in as the owner) in [`handlerTest.setup.ts`](../convex/handlerTest.setup.ts).
- Write through public handlers. Seed rows directly only through `withTriggers`, so the aggregate stays in step, unless a test needs a row the aggregate lacks.
- The mock runs no crons: drive continuations through the scheduler and call recovery handlers explicitly.
