# garvitpahal.com

Personal website: Astro with Markdown content and React islands, Tailwind CSS v4, a Cloudflare Worker and Convex. [README](README.md) covers running it, [docs/deployment.md](docs/deployment.md) production. Run `pnpm check` and `pnpm build` before handing off changes.

Before changing an area, read its doc: [Convex](docs/convex.md) for backend functions, authentication or metering; [Agenda](docs/agenda.md); [Puzzle solvers](docs/puzzle-solvers.md); [Content](docs/content.md) for `src/content/`, dates and the resume.

## Writing

- British -ise spelling in prose; identifiers, config names, URLs and quotations keep theirs. Sentence case for headings, titles, labels and buttons.
- User-facing messages are full sentences with no final full stop; titles, subtitles and captions have none. When the device causes a refusal, say what to change on it. Put the cause in the log line, never point the user at logs.
- Straight quotes and apostrophes everywhere, content included (`smartPunctuation.quotes` is off in [`astro.config.ts`](astro.config.ts)). No serial comma: 'tasks, routines and logs'.

## Comments and docs

- Comment only what the code and types cannot say: a constraint and its reason, a security assumption, a failure mode or a workaround with its upstream link and removal condition. A shortened comment keeps these and its non-obvious trade-offs.
- A doc block is one to three sentences on what a caller must know. Name another file only when the two must change together.
- Explain each mechanism once, beside its code. `docs/` holds only behaviour that spans files, citing files with Markdown links (`pnpm lint:links`).

## Code

- Every dependency goes in `dependencies`: the deploy installs the full toolchain, and bundles hold only imported code.
- Validate trust-boundary inputs with zod (`zod/mini` in browser code) and derive types with `z.infer`. Convex functions use the owner-checked builders, `v` validators and [`convex/lib/validate.ts`](convex/lib/validate.ts) ([Functions](docs/convex.md#functions)).
- Tests are Vitest over pure modules, beside them, with the clock, zone, `fetch` and environment passed in, and no DOM tests. Convex handler tests are the exception ([Tests](docs/convex.md#tests)).
- A new check in `checks/` must fail when what it guards is removed. Site URLs have no trailing slash. Use the `@gpahal/*` tooling presets rather than copying their configuration.

## Where code lives

Code that names no feature is whole-site from its first caller (`src/components/shared/`, `src/hooks/`, `src/lib/`, layouts, styles and public pages) and imports no feature; features pass their limits, wording and notices in.

A feature lives under its name in `src/pages/x/`, `src/pages/api/x/`, `src/components/x/` and `src/lib/x/`, domain library included until another feature needs it. React-free logic goes in `src/lib/x/`; class-name builders, hooks and each page's island (at the folder root) go in the components folder. List a new private tool in `PRIVATE_TOOLS` in [`src/lib/site.ts`](src/lib/site.ts) and public navigation in [`src/components/nav/content.astro`](src/components/nav/content.astro).

`server/` folders hold what must never reach the browser, such as prompts, SDKs, keys, JWT verification, token minting and the metering client: `src/lib/server/` for whole-site code, nested ones for features. Every other `src/lib` module is browser-safe, except the build-time [`blog.ts`](src/lib/blog.ts) and [`dates.ts`](src/lib/dates.ts).

`scripts/` runs under Node type stripping, so a script imports only packages and relative `.ts` modules that do the same.

## Styling and layout

- Add shadcn components with `pnpm shadcn add <name>`, then `pnpm fmt` and `pnpm lint-fix`. Edit the output like other source and keep only what something uses.
- [`global.css`](src/styles/global.css) is CLI output plus exceptions that open with `Not CLI output` and a reason. Dark mode follows the OS; read its note before adding CLI output.
- Prose styles live in [`prose-classes.ts`](src/components/shared/prose-classes.ts), which styles rendered Markdown and the components in [`typography.tsx`](src/components/shared/typography.tsx). Open each page except `/nav` and the standalone `/resume-print` with [`page-header.astro`](src/components/shared/page-header.astro).
- Wrap `buttonVariants(...)` in `cn()` outside `Button`, and style a link as a button with [`button-link.tsx`](src/components/shared/button-link.tsx).

## Private `/x` area

Cloudflare Access gates `/x` and `/api/x`.

- Never hand the Access JWT to the page: `/api/x/token` exchanges it for a Convex token ([Authentication](docs/convex.md#authentication)). [`access-session.ts`](src/lib/access-session.ts) tells an expired session from a network failure.
- Every `/api/x` route returns a secret or spends money, so [`src/middleware.ts`](src/middleware.ts) gates them all before any body is read; a route reads the owner's token with `ownerOf`. Paid work first consumes its Convex admissions and fails closed ([Rate limits](docs/convex.md#rate-limits)).
- A private route outside `/api/x` needs its own [Access destinations](docs/deployment.md#cloudflare); a new server secret follows [Adding a server secret](docs/deployment.md#adding-a-server-secret).

## Gotchas

- **Secrets live only in Infisical**, never in a file: `dev` for `pnpm dev`, which needs the Infisical CLI signed in, and `prod` for Deploy. `pnpm dev:public` runs without it, and the private tools then refuse to sign in. The committed `.env.development` names the Convex dev deployment; `.env.local` is the Convex CLI's own copy and is user-owned: never delete or overwrite it.
- Refresh the Convex guidelines with `pnpm convex-guidelines`. Never run `convex ai-files install`, `update` or `enable`: they rewrite `AGENTS.md` and `CLAUDE.md`.
- The CSP exists only in built output: allow a new origin in [`content-security-policy.ts`](src/lib/server/content-security-policy.ts) and verify it under `pnpm build` and `pnpm preview`.
- Inject dev-only UI with an integration, as `fontTesterInDev` in [`astro.config.ts`](astro.config.ts) does.
- Read `serveDepSourcesFresh` and `separateViteCaches` in [`astro.config.ts`](astro.config.ts) before changing dependencies or components: duplicate React modules leave islands silently empty.
- Under a coding agent, `pnpm dev`, `pnpm dev:public` and `pnpm preview` start in the background: manage them with `pnpm astro dev status|logs|stop` and `pnpm astro preview status|logs|stop`, and stop preview before `pnpm build`.
