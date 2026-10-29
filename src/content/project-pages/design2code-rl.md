---
title: design2code-rl
description: An RL environment that grades coding agents on rebuilding multi-page websites from screenshots
href: https://github.com/gpahal/design2code-rl
---

## The result

Claude Code with Opus 4.7 rebuilt multi-page websites from screenshots with a mean reward of 0.80 over 100 trials. The oracle, which feeds the original site back to the grader, scored 0.98. That leaves the agent about 0.19 below the ceiling.

## Why build it

Screenshot-to-code benchmarks such as Design2Code and Web2Code test a single page. Real sites have several pages that share a nav, a footer and a brand. A multi-page task is harder, and it shows failures a single page hides, like colours drifting from one page to the next.

I also wanted a reward that could train a model, not only rank one. Pass or fail gives no gradient. A score between 0 and 1 does.

## How it works

The pipeline generates 50 sites from scratch, each with five or more pages. Claude Sonnet writes a concept for each one: a category, a brand and a design language. Claude Opus writes the HTML and CSS, shared regions first so the pages stay consistent. Playwright renders every page at desktop and mobile sizes, and a screener rejects broken or incoherent sites.

Each site becomes a [Harbor](https://github.com/harbor-framework/harbor) task, and trials run on [Modal](https://modal.com/). The grader re-renders the agent's pages and scores four things:

- Visual fidelity (70%): three Opus 4.7 judge calls compare desktop and mobile screenshots of each page against the original
- Text (15%): whether the headings, nav labels and body copy match
- Code quality (7.5%): valid, semantic, responsive and accessible markup
- Consistency (7.5%): whether brand colours stay stable across pages

The judge sees only screenshots, never code, so any markup that looks right can score well. For the eval I picked 10 varied sites and ran Claude Code 10 times on each.

![Box plot of total reward for each of the 10 eval sites over 10 trials, sorted by mean from a minimal space nonprofit near 0.91 to a retro storybook education site near 0.67](./images/design2code-rl/per-task-reward.png)

## Outcome

The site decided the score far more than the attempt did. Within a site, the standard deviation stayed under 0.05. Across sites, means ranged from 0.91 for a minimal space nonprofit to 0.67 for a retro storybook education site.

Minimal layouts were easy, at 0.87 to 0.91. Retro was the hardest design language, about 0.18 below minimal: the agent dropped decorative type, background patterns and ornaments. About 60% of the judge's lost points came from photos and illustrations the agent cannot draw. Every trial wrote responsive CSS, but accessibility scored 0.44, because alt text and heading order were often missing.

The [visual report](https://github.com/gpahal/design2code-rl/blob/main/docs/VISUAL_REPORT.md) breaks the scores down by site, page and dimension. The [failure patterns](https://github.com/gpahal/design2code-rl/blob/main/docs/FAILURES.md) show side-by-side screenshots, and [grading](https://github.com/gpahal/design2code-rl/blob/main/docs/GRADING.md) covers how I calibrated the grader.

Next I plan to build more evals like this, and RL environments for much more complex and involved tasks, to help train better models.
