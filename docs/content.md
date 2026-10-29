# Content

Pages and posts are Markdown under `src/content/`. [`src/content.config.ts`](../src/content.config.ts) defines the collections with strict schemas, so an unknown frontmatter key or a blank required field fails the build. Collection keys are camelCase and their folders kebab-case. Content takes no components: `proseClasses` in [`astro.config.ts`](../astro.config.ts) styles the rendered HTML, and Expressive Code ([`ec.config.mjs`](../ec.config.mjs)) styles code blocks with neutrals copied from `--sidebar`, `--sidebar-foreground` and `--muted-foreground`. After changing `ec.config.mjs`, start `pnpm dev --force` or run `pnpm build --force` for each one you use, or the content cache keeps entries that link the old, missing stylesheet.

## Collections

- **Blog posts**: one file each, directly in `src/content/blog/` (the loader skips subfolders, so a post in one stays unpublished); the URL is `/blog/<file name>`, and `description` is both the meta description and the feed summary. Optional `tags` go into the page's `article:tag` metadata and the feed's categories, not onto the page. Put images in `src/content/blog/images/<post>/` and reference them relatively (`./images/<post>/<name>.jpg`) so Astro optimises them.
- **Work experiences and notable personal projects**: timelines on `/work`. Leave out `endedOn` for an ongoing entry; it shows "Present". An empty or `null` `endedOn` fails the build. A role left and later resumed keeps its latest period in `startedOn` and `endedOn` and lists the others, newest first, in `earlierPeriods`, so it sorts where it is current. `resume` holds the resume's terser wording: bullets for a work entry, and one line for a project, which stays off the resume without it.
- **Resume**: [`resume/profile.yaml`](../src/content/resume/profile.yaml) holds the resume's summary, skills, education and awards; `/work` shows the education and awards too.
- **Project pages**: case studies of featured projects in `src/content/project-pages/`, served at `/projects/<file name>`. Nothing links to them; the sitemap lists them.
- **Pages**: an entry renders only where a route passes its id to [`src/layouts/content-page.astro`](../src/layouts/content-page.astro). A new top-level page also needs an entry in `links` in [`src/components/nav/content.astro`](../src/components/nav/content.astro).

`/projects` is hard-coded in [`src/pages/projects.astro`](../src/pages/projects.astro). When a project changes, check it there, in [`pages/about.md`](../src/content/pages/about.md), in its notable personal project and in its project page.

## Share images

A blog post or project page can set `image` (`src`, relative like a post image, and `alt`) for the picture its shared link shows, resized to a JPEG at most 1200 pixels wide. Every other page shows [`public/images/og-card.png`](../public/images/og-card.png); after changing the site's name, tagline or photo, run `pnpm og-card` on a Mac and commit the PNG ([`og-card.ts`](../scripts/og-card.ts)).

## Resume

[`src/pages/resume-print.astro`](../src/pages/resume-print.astro) builds the resume from the collections above as a standalone, unlisted A4 document, and `pnpm resume` prints it to [`public/docs/resume.pdf`](../public/docs/resume.pdf) with headless Chrome ([`resume-pdf.ts`](../scripts/resume-pdf.ts)). Run it on a Mac after changing any of them and commit the PDF: the page prints in Avenir Next, which only macOS ships, and the deploy only copies the committed file. The script fails unless the PDF is one page with no Type 3 fonts, whose text extracts broken for applicant tracking systems; `RESUME_PHONE` writes a copy with a phone number to `tmp/` instead.

## Dates

Write dates as `DD/MM/YYYY`. [`src/lib/dates.ts`](../src/lib/dates.ts) validates them and keeps them as date-only `YYYY-MM-DD` strings rather than instants, so no time zone can shift them; an invalid date, or an end before its start ([`src/content.config.ts`](../src/content.config.ts)), fails the build.

Agenda's instants and local readings follow [its own rules](agenda.md#time-and-goals).
