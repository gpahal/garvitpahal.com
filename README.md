# garvitpahal.com

My personal website: [garvitpahal.com](https://garvitpahal.com/)

## Tech stack

- Framework: [Astro](https://astro.build/)
- Styling: [Tailwind CSS](https://tailwindcss.com/)
- Deployment infrastructure: [Cloudflare](https://www.cloudflare.com/)

## Personal area

`/x` is a private area behind
[Cloudflare Access](https://www.cloudflare.com/zero-trust/products/access/), configured outside this
repo. It hosts small personal tools.

**Puzzle solvers** (`/x/puzzle-solvers`): take a picture of a puzzle, Claude reads it, you correct
anything it misread, and it is solved in the browser. Set `ANTHROPIC_API_KEY` in `.dev.vars` (see
`.dev.vars.example`) to run it locally.

## Prerequisites

- [Node](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm)
- [pnpm](https://pnpm.io/installation)
- Install dependencies

```sh
pnpm install
```

## Running locally

Start the app in development mode, rebuilding assets on file changes

```sh
pnpm dev
```

## Deployment

Commit and push changes to [gpahal/garvitpahal.com](https://github.com/gpahal/garvitpahal.com) to
trigger automatic deployment.

## License

Licensed under MIT license ([LICENSE](LICENSE) or
[opensource.org/licenses/MIT](https://opensource.org/licenses/MIT))
