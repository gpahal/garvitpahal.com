# Puzzle solvers

Reads a photographed Sudoku or Ken Ken with a vision model, then checks and solves it in the browser. Each puzzle owns `puzzles/<id>/` in both `src/lib/x/puzzle-solvers/` and `src/components/x/puzzle-solvers/`.

## Where work runs

The Cloudflare endpoint only validates, meters and relays model reads: its CPU allowance is small and its clock does not advance during synchronous work, so it could not enforce compute deadlines. A browser module Worker prepares pictures, assesses reads and solves, and solving never falls back to the UI thread. `canReadPictures` in [`vision/read-picture.ts`](../src/lib/x/puzzle-solvers/vision/read-picture.ts) sets the oldest browsers that can read a picture.

Each puzzle splits in two so each bundle carries only what it runs. `definition.ts` is the page half (identity, wire read, review and solve rules), listed in [`puzzles/registry.ts`](../src/lib/x/puzzle-solvers/puzzles/registry.ts); `compute.ts` is the Worker half (preparation, fingerprint, solving), listed in [`puzzles/compute-registry.ts`](../src/lib/x/puzzle-solvers/puzzles/compute-registry.ts), with its import convention on `PuzzleCompute` in [`puzzles/types.ts`](../src/lib/x/puzzle-solvers/puzzles/types.ts). Prompts, model chains, hint validation and provider schemas stay in `server/`. Lint enforces both fences.

The Worker's `prepare` job encodes the picture as a JPEG within `MAX_IMAGE_BYTES`, which bounds the endpoint's CPU time ([`vision/image-limit.ts`](../src/lib/x/puzzle-solvers/vision/image-limit.ts) says what to measure before changing it). To drop a puzzle's measured hints, delete its `analyze.ts`, `server/hints.ts`, their tests and the hints type, return `hints: {}` from `prepare`, make `hintsSchema` `z.strictObject({})` and take `describeHints` out of the prompt.

## Trust

The browser grades each read by solving it (`assessSolve` in [`puzzles/solve-result.ts`](../src/lib/x/puzzle-solvers/puzzles/solve-result.ts), with the puzzle's `fingerprint`) and ranks reads in [`vision/read-arbitration.ts`](../src/lib/x/puzzle-solvers/vision/read-arbitration.ts):

| Confidence | Meaning |
| --- | --- |
| `misread` | Proven unsolvable; shown only as a last resort for editing, when no puzzle is on screen |
| `suspect` | Usable but unverified, including interrupted or failed assessments |
| `trusted` | A unique solve with a fingerprint, or matching fingerprints from two distinct configurations |

Only a read with a fingerprint can be promoted. `assessSolve` drops it for a second solution or a search that timed out before finding one, and each puzzle's `compute.ts` withholds it from a read it distrusts, such as guessed Sudoku boxes or a Ken Ken read that contradicts itself. A search that times out after one solution (`isUnique: false`) keeps it, so two configurations agreeing make that read trusted. Agreement counts only between different calls, and the browser never learns which model made a read, so every call in a chain must differ in model or effort (`agreementKey` in [`vision/server/models.ts`](../src/lib/x/puzzle-solvers/vision/server/models.ts), which ignores the `fast` tier); [`extraction-registry.test.ts`](../src/lib/x/puzzle-solvers/puzzles/server/extraction-registry.test.ts) checks this. Neither a unique solve nor agreement proves the transcription, so even a trusted read needs the owner's review.

The puzzle on screen stays while a read runs, and the read replaces it once, as it ends, with the read arbitration ranks best (`finishRead` in [`vision/read-picture.ts`](../src/lib/x/puzzle-solvers/vision/read-picture.ts)). A read that fails or is cancelled leaves the screen as it was. A trusted read, a committed edit, a pending cage draft or cancellation ends the read.

## Timing and cost

One browser deadline (`READ_DEADLINE_MS` in [`vision/read-phases.ts`](../src/lib/x/puzzle-solvers/vision/read-phases.ts)) covers a read: two parallel model calls, then at most one fallback call if nothing was trusted and another model might fix every failure, while the server caps each request's window by phase (`EXTRACT_DEADLINE_MS` in [`vision/extract-wire.ts`](../src/lib/x/puzzle-solvers/vision/extract-wire.ts)). Each call consumes admissions from the puzzle-read budget ([rate limits](convex.md#rate-limits)) at its model's price (`admissionsOf` in [`vision/server/models.ts`](../src/lib/x/puzzle-solvers/vision/server/models.ts)): one, or two on the priority lane. [`extraction-registry.test.ts`](../src/lib/x/puzzle-solvers/puzzles/server/extraction-registry.test.ts) checks that each chain fits one full read and an immediate Try again in the burst limit.

## Stale tabs

The server keeps no old request shapes, so a tab from before a deploy is told to reload. The phase and call travel in the query, so a malformed one is refused before metering, but a body the server cannot accept is refused after it.

The browser still treats every answer as untrusted input:

- Validate every incoming puzzle with its wire schema before mapping it to editor state, including size against this build's sizes and array lengths and cell values against that size.
- Check every id or flag against the grid, and accept each once. Every count the review banner shows needs a highlight the owner can clear.
- Take a refusal's remedy from its body (`readFailureSchema` in [`vision/extract-wire.ts`](../src/lib/x/puzzle-solvers/vision/extract-wire.ts)), and read an absent one as the safe choice: no fallback, no sign-in link.
- A JSON answer this build cannot read means the endpoint is newer: ask for a reload, keeping any usable read the other call delivered. Transport failures, a body cut short included, stay failures even beside a delivered read, so they cannot authorise a fallback.

[`vision/extract-wire.ts`](../src/lib/x/puzzle-solvers/vision/extract-wire.ts) defines the request and answers, and [`vision/extract-client.ts`](../src/lib/x/puzzle-solvers/vision/extract-client.ts) validates transport and puzzles.

## Adding a puzzle

Follow Sudoku, the smaller example.

1. Under the library's `puzzles/<id>/`, add model, solver and analysis, `definition.ts` (build `read` with `createWireRead`; its `timeoutHint` names what slows its search) and `compute.ts`. Put wire schemas in `api.ts`, with wire-schema tests in both directions. In `server/`, put hint validation (typed with `HintsShape`) and `describeHints` in `hints.ts`, the classic-zod response schema in `parse.ts`, and prompts and the model chain in `extraction.ts`, whose config `createExtractHandler` binds.
2. Under the components' `puzzles/<id>/`, add an editor and solution view, and pair them with the definition in `PUZZLE_WORKSPACES` in [`puzzle-workspace.tsx`](../src/components/x/puzzle-solvers/puzzle-workspace.tsx). Each editor honours the contract on `PuzzleEditorProps` in [`puzzles/puzzle-ui.ts`](../src/components/x/puzzle-solvers/puzzles/puzzle-ui.ts). Build the grid on [`grid/grid-frame.tsx`](../src/components/x/puzzle-solvers/grid/grid-frame.tsx) and [`grid/use-grid-selection.ts`](../src/components/x/puzzle-solvers/grid/use-grid-selection.ts), which focus restoration relies on.
3. Add the definition to `PUZZLES` in [`puzzles/registry.ts`](../src/lib/x/puzzle-solvers/puzzles/registry.ts), then fill in the entries the typecheck asks for: [`puzzles/compute-registry.ts`](../src/lib/x/puzzle-solvers/puzzles/compute-registry.ts) and `EXTRACTIONS` in [`puzzles/server/extraction-registry.ts`](../src/lib/x/puzzle-solvers/puzzles/server/extraction-registry.ts). Its test also builds each provider schema, which the endpoint builds only after metering.

Pages, the index and routing need nothing more: they come from `listPuzzles`, and `run_worker_first` already covers `/api/x/*`.

## Verification

No test makes a paid call or measures transcription accuracy. Check in a browser: responsive cancellation, reference viewing, retry, discard focus, camera cleanup, Worker loading under the production CSP and the browser's leave-page prompt ([`src/lib/unload-warning.ts`](../src/lib/unload-warning.ts)) on reload and on a sidebar link while a read is in flight, on screen or edited, but not on Back.

Under `astro dev` a cancelled read still runs its model call to the end, because the browser's abort never reaches the endpoint. Production is unverified: once after a deploy, cancel a read and check with `pnpm exec wrangler tail` that its `<puzzle>.done` line says `client_disconnected` well before the model would have answered.
