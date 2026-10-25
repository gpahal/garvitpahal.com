# garvitpahal.com

The source of my personal website, [garvitpahal.com](https://garvitpahal.com): who I am, what I've worked on, a blog and a couple of private tools only I can sign in to.

It's built with [Astro](https://astro.build/), MDX, React, [Tailwind CSS](https://tailwindcss.com/) and [shadcn/ui](https://ui.shadcn.com/), runs on [Cloudflare Workers](https://developers.cloudflare.com/workers/) and keeps the private tools' data in [Convex](https://www.convex.dev/) and their secrets in [Infisical](https://infisical.com/).

## Getting started

You'll need:

- Node 24.22 or newer and pnpm.
- The [Infisical CLI](https://infisical.com/docs/cli/install) (`brew install infisical/get-cli/infisical` on macOS), signed in with `infisical login` to Infisical's US Cloud as an account with access to the project [`.infisical.yaml`](.infisical.yaml) names. `pnpm dev` reads the private tools' secrets from its `dev` environment and stops if the CLI is signed out or the project is out of reach.

```sh
pnpm install
pnpm dev
```

The site is now at <http://localhost:4321>, with a font tester for trying any [Fontsource](https://fontsource.org) font or static [Fontshare](https://www.fontshare.com) font. Without Infisical, `pnpm dev:public` serves the same site with no secrets: every public page works, and the private tools say the server is not set up correctly.

| Command            | What it does                                             |
| ------------------ | -------------------------------------------------------- |
| `pnpm dev`         | Start the dev server with the secrets from Infisical     |
| `pnpm dev:public`  | Start the dev server without secrets or Infisical        |
| `pnpm check`       | Typecheck, lint, check formatting, run tests             |
| `pnpm test [path]` | Run the Vitest suites, or only the files matching a path |
| `pnpm build`       | Build the site                                           |
| `pnpm preview`     | Serve the build with its production headers              |
| `pnpm fmt`         | Format the code                                          |
| `pnpm lint-fix`    | Fix lint and comment layout                              |

GitHub runs `pnpm check` on every pull request and deploy.

## What's where

- `src/content/`: posts, work history and page text ([docs/content.md](docs/content.md)).
- `src/pages/`, `src/components/` and `src/lib/`: routes, UI and logic.
- `convex/`: the backend for the private tools.
- `checks/`: repo-level checks, such as build guards and site links.
- `scripts/`: the signing-key generator, the script that sets Convex's settings from the Worker's secrets, the Convex guidelines refresher and the deploy and Access verification scripts.
- `docs/`: how the trickier parts work.

## Private tools

Everything under `/x` sits behind Cloudflare Access, so only I can sign in.

- **Agenda** keeps my tasks and recurring goals ([docs/agenda.md](docs/agenda.md)).
- **Puzzle solvers** read a photo of a Sudoku or Ken Ken with an OpenAI vision model, then check and solve it in the browser ([docs/puzzle-solvers.md](docs/puzzle-solvers.md)).

### Running the private tools

They need the Infisical CLI signed in ([Getting started](#getting-started)). Once:

1. Copy [`.env.local.example`](.env.local.example) to `.env.local`, unless it exists. It holds what the Convex CLI manages and never a secret: `pnpm convex-dev` fills in `PUBLIC_CONVEX_URL`.
2. In Infisical's `dev` environment, at the root path `/`, add these secrets:
   - `OWNER_EMAIL`: your email.
   - `CONVEX_JWT_PRIVATE_KEY`: the JSON line `pnpm convex-jwt-key` prints, a development key separate from production's.
   - For the puzzle solvers, `OPENAI_API_KEY`: a key from a separate OpenAI project with a low hard limit.
3. Run `pnpm convex-dev` and choose a **local** deployment (if you're logged in to Convex, run `pnpm exec convex deployment select local` first).
4. In a second terminal, run `pnpm convex-dev-set-env`, which sets the local deployment's `OWNER_EMAIL` and `CONVEX_JWT_JWKS` from those secrets. Until then `pnpm convex-dev` fails to push; restart it if it doesn't retry.

After that, keep `pnpm convex-dev` and `pnpm dev` running side by side. After changing a secret in Infisical, restart `pnpm dev`; after changing `OWNER_EMAIL` or the key, or if Agenda says its sign-in keys don't match, also run `pnpm convex-dev-set-env` again.

## Deploying

Pushing to `main` deploys the site with the secrets from Infisical's `prod` environment ([docs/deployment.md](docs/deployment.md)).

## Licence

[MIT](LICENSE).
