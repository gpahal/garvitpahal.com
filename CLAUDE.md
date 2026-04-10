# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this
repository.

## Overview

This is a personal website built with Astro, deployed on Cloudflare. The site features blog posts,
work experience, personal projects, and uses a custom design system with Tailwind CSS and color
theming.

## Tech Stack

- **Framework**: Astro with SSG (Static Site Generation)
- **Content**: MDX files with content collections
- **Styling**: Tailwind CSS v4 with custom color themes
- **Integrations**: astro-expressive-code for syntax highlighting, sitemap, RSS
- **Package Manager**: pnpm
- **Git Hooks**: simple-git-hooks for pre-push validation

## Development Commands

```bash
# Install dependencies
pnpm install

# Development server (port 4321 by default)
pnpm dev
# or
pnpm start

# Build for production
pnpm build
# Runs type checking and Astro check before building

# Preview production build
pnpm preview

# Type checking (without emitting files)
pnpm typecheck

# Linting
pnpm lint           # Runs all linters (ESLint + Stylelint)
pnpm lint-fix       # Auto-fixes lint issues

# Formatting
pnpm fmt            # Format all files with Prettier
pnpm fmt-check      # Check formatting without writing

# Generate color theme CSS
pnpm generate-color-theme

# Pre-push validation (runs automatically via git hook)
pnpm pre-push       # Runs typecheck, lint, fmt-check, and astro check
```

## Architecture

### Content Collections

The site uses Astro's content collections with three collections defined in `src/content/config.ts`:

1. **blog** (`src/content/blog/`): Blog posts with title, publishedOn date, and optional tags

1. **workExperiences** (`src/content/work-experiences/`): Work history with company, role,
   startedOn, endedOn

1. **notablePersonalProjects** (`src/content/notable-personal-projects/`): Personal projects with
   project name, startedOn, endedOn

All dates use DD/MM/YYYY format and are parsed at build time using `date-fns`.

### Color Theme System

The color theme is generated from `scripts/generate-color-theme.ts` which:

- Uses Radix UI color palettes (slate theme)
- Generates `src/styles/color-theme.css` with light/dark theme CSS variables
- Supports both sRGB and P3 color spaces
- Uses the custom `@gpahal/tailwindcss-color-themes` package

Theme switching is handled via CSS media queries (`prefers-color-scheme`) and manual
`.light-theme` / `.dark-theme` classes.

### Styling Approach

- **Global styles**: `src/styles/global.css` defines comprehensive base styles for all HTML elements
- **Tailwind v4**: Uses the new `@theme` directive for custom configuration
- **Variants**: Uses `@gpahal/tailwindcss-variants` for additional utilities
- **Font**: Satoshi variable font loaded from `/public/fonts/satoshi/`
- **Unstyled class**: Use `.unstyled` class on elements to opt out of global styles

### Layout & Routing

- **Main layout**: `src/layouts/layout.astro` includes:
  - Global CSS imports
  - Meta tags for SEO/social media
  - Navigation component
  - Astro view transitions via `<ClientRouter />`
  - Inline script for drawer/menu functionality

- **Pages** (`src/pages/`):
  - `index.astro`: Homepage
  - `blog.astro`: Blog listing
  - `blog/[id].astro`: Dynamic blog post pages
  - `blog.rss.xml.ts`: RSS feed generator
  - `work.astro`: Work experience
  - `projects.astro`: Personal projects
  - `uses.astro`: Tools/setup page
  - `nav.astro`: Navigation page (mobile full-screen nav)

### Component Structure

- **Heading components** (`src/components/heading/`): h1-h4 with consistent styling
- **Nav components** (`src/components/nav/`): Navigation with desktop sidebar and mobile drawer
- **Icons** (`src/icons/`): Astro components for SVG icons organized by category (nav, social, blog)

### Custom Packages

This project uses several custom packages from the `@gpahal` namespace:

- `@gpahal/eslint-config`: ESLint configuration with Astro support
- `@gpahal/prettier-config`: Prettier configuration
- `@gpahal/stylelint-config`: Stylelint configuration
- `@gpahal/tailwindcss-color-themes`: Color theme generation utility
- `@gpahal/tailwindcss-variants`: Additional Tailwind utilities
- `@gpahal/std`: Standard library utilities (e.g., string trimming)
- `@gpahal/tsconfig`: Shared TypeScript configuration

## Code Style Conventions

### Path Aliases

Use `@/` prefix for imports from the `src/` directory:

```typescript
import Layout from '@/layouts/layout.astro'
import H1 from '@/components/heading/h1.astro'
```

### Date Handling

- Use `date-fns` for all date formatting and parsing
- Content dates are in DD/MM/YYYY format and parsed with timezone handling
- Display dates typically use `format(date, 'MMM yyyy')` format

### Content Collections Details

When working with collections:

- Use `getCollection('collectionName')` to fetch all entries
- Use `render(entry)` to get the Content component from MDX
- Content is always MDX, never plain Markdown

## Build & Deployment

- Deployment happens automatically on push to the main branch (via Cloudflare)

- The build process runs `astro check` (TypeScript + Astro validation) before
  building

- All checks must pass in the pre-push hook before pushing

## Git Workflow

- Pre-push hook runs: `typecheck`, `lint`, `fmt-check`, and `astro check`
- Ensure all validations pass before pushing
- Configuration: `.simple-git-hooks.json`
