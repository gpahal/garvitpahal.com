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

## Conventions

- Imports use path aliases: `@/*` → `src/*`, `@public/*` → `public/*`.

- All content is MDX, never plain Markdown.

- Content dates are `DD/MM/YYYY` strings, parsed to `Date` by the collection schemas. Format for
  display with `date-fns` (usually `format(date, 'MMM yyyy')`).

- Markdown/MDX is linted by `@gpahal/remark-preset-lint` (config in `package.json`); it wants a
  blank line between list items.

- Tooling comes from the `@gpahal/*` packages (eslint, prettier, stylelint, tsconfig, tailwind
  color-themes/variants, std). Don't inline config that those presets already provide.

## Content collections

Defined in `src/content.config.ts` using `glob()` loaders over `src/content/<dir>`:

| Collection                | Directory                    | Fields                              |
| ------------------------- | ---------------------------- | ----------------------------------- |
| `blog`                    | `blog/`                      | title, publishedOn, tags?           |
| `workExperiences`         | `work-experiences/`          | company, role?, startedOn, endedOn? |
| `notablePersonalProjects` | `notable-personal-projects/` | project, startedOn, endedOn?        |

Read with `getCollection(name)` and `render(entry)`.

## Styling

- `src/styles/global.css` styles bare HTML elements globally; add the `.unstyled` class to opt out.

- `src/styles/color-theme.css` is **generated** — edit `scripts/generate-color-theme.ts` and rerun
  `pnpm generate-color-theme` instead of hand-editing it.

- Theme switches via `prefers-color-scheme` plus manual `.light-theme` / `.dark-theme` classes.

- Tailwind v4 is wired through the `@tailwindcss/vite` plugin; customization lives in `@theme`
  blocks, not a `tailwind.config` file.

## Layout

`src/layouts/layout.astro` wraps every page: global CSS, SEO/social meta, nav, `<ClientRouter />`
view transitions, and the inline drawer/menu script. Pages live in `src/pages/`; `nav.astro` is the
mobile full-screen nav and `blog.rss.xml.ts` generates the feed.
