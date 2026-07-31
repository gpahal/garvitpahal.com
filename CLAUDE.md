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
  one line to three — delete rather than pad.

- Validate anything crossing a trust boundary with zod, and derive the type with `z.infer` rather
  than declaring it twice.

- Keep shared modules and these docs generic. Anything true of one puzzle only belongs in that
  puzzle's own directory.

## Conventions

- Path aliases: `@/*` → `src/*`, `@public/*` → `public/*`.

- All content is MDX, never plain Markdown. Dates are `DD/MM/YYYY` strings, parsed by the collection
  schemas and formatted with `date-fns`.

- `@gpahal/remark-preset-lint` lints Markdown/MDX (config in `package.json`); it wants a blank line
  between list items.

- Tooling comes from the `@gpahal/*` presets (eslint, prettier, stylelint, tsconfig, tailwind
  color-themes/variants, std). Don't inline config they already provide.

## Content collections

`src/content.config.ts`, `glob()` loaders over `src/content/<dir>`; read with `getCollection` and
`render`.

| Collection                | Directory                    | Fields                              |
| ------------------------- | ---------------------------- | ----------------------------------- |
| `blog`                    | `blog/`                      | title, publishedOn, tags?           |
| `workExperiences`         | `work-experiences/`          | company, role?, startedOn, endedOn? |
| `notablePersonalProjects` | `notable-personal-projects/` | project, startedOn, endedOn?        |

## Styling and layout

- `global.css` styles bare HTML elements; add `.unstyled` to opt out. `color-theme.css` is
  **generated** — edit `scripts/generate-color-theme.ts` and rerun `pnpm generate-color-theme`.

- Themes switch via `prefers-color-scheme` plus manual `.light-theme` / `.dark-theme`. Tailwind v4
  is wired through `@tailwindcss/vite`; customization lives in `@theme` blocks, not a config file.

- `src/layouts/layout.astro` wraps every page: global CSS, SEO meta, nav, `<ClientRouter />`, and
  the drawer script. `nav.astro` is the mobile nav, `blog.rss.xml.ts` the feed.

## Private `/x` area

**Auth is Cloudflare Access, configured in the dashboard — not in this repo**; there is no
application-level auth code.

- The Access app must cover **both** `garvitpahal.com/x*` and `garvitpahal.com/api/x*`. Missing the
  second leaves the API endpoints open.

- `workers_dev: false` in `wrangler.jsonc`: a `*.workers.dev` URL is not covered by an Access app
  scoped to the apex domain.

- Access cannot protect `localhost`, so `/x` is ungated under `pnpm dev`.

`/x` pages are prerendered — Access enforces at the edge — and use the public `layout.astro` with
`noindex`. Only `/api/x/*` needs `export const prerender = false`; the
`assert-api-routes-are-on-demand` integration fails the build if one is missing it.

### Extraction

`src/lib/vision/extract.ts` owns every puzzle's Claude call.

- Each puzzle names its own `primary` and `fallbacks` and sends them with the request, so they are
  untrusted: the endpoint re-validates against the allowlist in `src/lib/vision/model.ts`. It
  verifies each read server-side, escalates through the fallbacks while the result looks wrong, and
  returns the best one it got — the review step is there to correct it.

- `max_tokens` caps thinking **plus** the response. Effort is per-model; Haiku 4.5 rejects it
  outright, and is unreliable on real pictures regardless. Shrinking the image does not make the
  call faster — prefill is not the bottleneck. The call streams; non-streaming risks the SDK's
  HTTP timeout at this budget.

- Logs are one JSON object per line via `src/lib/x/log.ts`, correlated by `requestId` (`cf-ray`):
  `<puzzle>.request` → `vision.*` → `<puzzle>.done`, plus `<puzzle>.escalated` per retry.
  `observability` is on in `wrangler.jsonc`; `wrangler tail` for live.

### Adding a puzzle

1. `src/puzzles/<id>/` — `model.ts`, `api.ts` (endpoint path + response types), `parse.ts`,
   `solve.ts`, `extraction.ts` (schema + prompt, **server-only**), `index.ts`, `editor.tsx`,
   `solution.tsx`.

1. Register in `src/puzzles/registry.ts` and `src/puzzles/ui-registry.ts`.

1. Add `src/pages/api/x/puzzle-solvers/<id>.ts` calling `extractStructured` with that puzzle's own
   schema and prompt.

Keep `registry.ts` free of React, the Anthropic SDK, and prompt text — the browser imports it.
Solvers must be pure and isomorphic; they run client-side.

## Gotchas

- **`bg-red-500` renders nothing.** `color-theme.css` resets `--color-*: initial`, removing every
  default Tailwind colour. Only what `global.css` re-adds in its `@theme` block exists: `white`,
  `black`, `transparent`, `inherit`, `current`, plus the generated `gray-*`, `bg` and `anchor`.
  Reach for `gray-*` first - `white` and `black` are for scrims and marks over video, which must not
  follow the theme.

- **`imageService: 'custom'`** in `astro.config.ts` is deliberate. `'compile'` filters sharp out by
  name and forces the workerd encoder, producing ~47% larger images.
