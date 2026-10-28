# Content

Pages and posts are Markdown under `src/content/`. [`src/content.config.ts`](../src/content.config.ts) defines the collections with strict schemas, so an unknown frontmatter key or an empty or blank required field fails the build. Collection keys are camelCase and their folders kebab-case. Prettier formats them and ESLint lints them like any other Markdown. They take no components: `proseClasses` in [`astro.config.ts`](../astro.config.ts) styles the rendered HTML.

## Collections

- **Blog posts**: one file each, directly in `src/content/blog/` (the loader skips subfolders); the URL is `/blog/<file name>`, and `description` is both the meta description and the feed summary. Optional `tags` go into the page's `article:tag` metadata and the feed's categories, not onto the page. Put images in `src/content/blog/images/` and reference them relatively (`./images/<name>.jpg`) so Astro optimises them.
- **Work experiences and notable personal projects**: timelines on `/work`. Leave out `endedOn` for an ongoing entry; it shows "Present". An empty or `null` `endedOn` fails the build.
- **Pages**: an entry renders only where a route passes its id to [`src/layouts/content-page.astro`](../src/layouts/content-page.astro). A new top-level page also needs an entry in `links` in [`src/components/nav/content.astro`](../src/components/nav/content.astro).

`/projects` is hard-coded in [`src/pages/projects.astro`](../src/pages/projects.astro), not a collection. [`pages/about.md`](../src/content/pages/about.md) and [`work-experiences/independent-software-development-and-research.md`](../src/content/work-experiences/independent-software-development-and-research.md) describe recent projects in the same words, and the intro of [`src/pages/work.astro`](../src/pages/work.astro) links them by name. When a project changes, check all four. [`public/docs/resume.pdf`](../public/docs/resume.pdf) repeats the work entries and recent projects; update it with them.

## Dates

Write dates as `DD/MM/YYYY`. [`src/lib/dates.ts`](../src/lib/dates.ts) validates them and keeps them as date-only `YYYY-MM-DD` strings rather than instants, so no time zone can shift them; an invalid date, or an end before its start ([`src/content.config.ts`](../src/content.config.ts)), fails the build.

Agenda's instants and local readings follow [its own rules](agenda.md#time-and-goals).
