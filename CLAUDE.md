# CLAUDE.md

Personal website: Astro (static output), MDX content, Tailwind CSS v4, deployed on Cloudflare on
push to `main`.

## Commands

```bash
pnpm dev                    # dev server on :4321
pnpm build                  # astro check && astro build
pnpm typecheck              # tsc --noEmit
pnpm lint / pnpm lint-fix   # eslint + stylelint
pnpm fmt / pnpm fmt-check   # prettier
pnpm pre-push               # typecheck + lint + fmt-check + astro check (git hook)
pnpm generate-color-theme   # regenerates src/styles/color-theme.css
```

## Guidelines

- Comments explain the constraint or the why. Never restate what the code already says, and prefer
  one line to three: delete rather than pad.

- Validate anything crossing a trust boundary with zod, and derive the type with `z.infer` rather
  than declaring it twice.

- Keep shared modules and these docs generic. Anything true of one puzzle only belongs in that
  puzzle's own directory.

## Conventions

- Path aliases: `@/*` → `src/*`, `@public/*` → `public/*`.

- Content is MDX under `src/content/<collection>/`, loaded by `src/content.config.ts`. Dates are
  `DD/MM/YYYY` strings, formatted with `date-fns`.

- Tooling comes from the `@gpahal/*` presets (eslint, prettier, stylelint, tsconfig, tailwind,
  remark). Don't inline config they already provide. The remark preset wants a blank line between
  list items.

## Styling and layout

- `global.css` styles bare HTML elements; add `.unstyled` to opt out. `color-theme.css` is
  **generated** by `scripts/generate-color-theme.ts`.

- Themes switch via `prefers-color-scheme` plus manual `.light-theme` / `.dark-theme`. Tailwind is
  customised in `@theme` blocks, not a config file.

- `src/layouts/layout.astro` wraps every page. `nav.astro` is the mobile nav, `blog.rss.xml.ts` the
  feed.

## Private `/x` area

Auth is Cloudflare Access, configured in the dashboard, not in this repo.

- The Access app must cover **both** `garvitpahal.com/x*` and `garvitpahal.com/api/x*`.
  `workers_dev: false` in `wrangler.jsonc` keeps the uncovered `*.workers.dev` URL off. Under
  `pnpm dev` nothing is gated.

- `/x` pages are prerendered with `noindex`. Only `/api/x/*` is on demand; the
  `assert-api-routes-are-on-demand` integration in `astro.config.ts` fails the build otherwise.

### Puzzle solvers

Capture → `prepare` → stream → judge → review. Where things live:

| Concern                                           | Where                                               |
| ------------------------------------------------- | --------------------------------------------------- |
| Camera, upload, corner editor, review dialog      | `src/components/x/capture/`                         |
| Pure pixel code: quad detection, rectify, enhance | `src/lib/capture/` (only `encode.ts` uses a canvas) |
| Lattice reading for square grids                  | `src/lib/grid/lines.ts`                             |
| Model allowlist, the model call, endpoint, client | `src/lib/vision/`                                   |
| Workspace, trust rule, review banner              | `src/components/x/workspace/`                       |
| Constraint solver over variables and values       | `src/lib/csp/`                                      |
| Everything puzzle-specific                        | `src/puzzles/<id>/`, endpoint in `src/pages/api/x/` |

Constraints that are not visible from any one file:

- **The Worker relays, it never solves.** Free plan (10 ms CPU per request), and workerd does not
  advance `Date.now()` during synchronous work. The endpoint streams every read that parses; the
  browser's `assess` is the oracle (`trusted` unique solve, `misread` unsolvable, else `suspect`),
  and two suspects agreeing from different models count as trusted. See `workspace.tsx`.

- Hedges all fire at once, fallbacks only after every hedge settles with the client still connected.
  Client disconnect needs the `enable_request_signal` flag in `wrangler.jsonc`. The 4 + 2 model cap
  and `maxRetries: 0` come from the Worker's 6 outbound connections.

- Strict structured output rejects `minItems`, `pattern` and `minimum`, so `parse.ts` checks lengths
  and characters. `max_output_tokens` covers reasoning too; exhausting it is `status: 'incomplete'`,
  not an error.

- **A wrong hint is worse than none.** `analyze.ts` omits any fact that is not clearly bimodal, and
  prompts present hints as measured, to be verified against the image.

- **Nothing shaped may move into the shared layer.** `src/puzzles/types.ts`, the workspace, the
  capture step and the endpoint must stay usable by a puzzle that is not a grid; `src/lib/grid/` is
  opt-in. `registry.ts` is imported by the browser: no React, vision SDK, zod or prompt text.

- Logs are one JSON object per line (`src/lib/x/log.ts`), correlated by `requestId`;
  `<puzzle>.settled` with `client_disconnected` after a read is the happy path. `wrangler tail` for
  live.

Adding a puzzle: mirror `src/puzzles/sudoku/` (the smaller of the two), register it in `registry.ts`
and `ui-registry.ts`, and add its endpoint with `export const prerender = false`.

The bench in `.bench/` (gitignored, see its `README.md`) settled the current prompts, model chains
and what each puzzle sends. Before changing any of those or `src/lib/capture`, run
`tsx .bench/prepare-inputs.ts` (all facts correct) and `tsx .bench/hedge.ts` (no false trust).

## Gotchas

- **`bg-red-500` renders nothing.** `color-theme.css` resets every default Tailwind colour; only
  `white`, `black`, `transparent`, `inherit`, `current` and the generated `gray-*`, `bg` and
  `anchor` exist. Reach for `gray-*`; `white` and `black` are for marks over video only.

- **`imageService: 'compile'` needs `prerenderEnvironment: 'node'`.** Only the Node prerenderer
  falls back to real sharp; workerd's encoder makes \~47% larger images, and `'custom'` ships sharp
  in the worker, where `/_image` then 500s.
