---
project: design2code-rl
href: https://github.com/gpahal/design2code-rl
startedOn: 01/05/2026
endedOn: 31/05/2026
resume: RL environment grading coding agents on rebuilding websites from screenshots. Claude Code scored 0.80 over 100 trials
---

[design2code-rl](https://github.com/gpahal/design2code-rl) is a synthetic-data and RL-environment pipeline. It generates multi-page websites from scratch and grades how well a coding agent rebuilds them from screenshots, grading the rendered pages, text, code quality and consistency. It runs on [Harbor](https://github.com/harbor-framework/harbor) and [Modal](https://modal.com/) over 50 generated sites, and an ensemble of Opus 4.7 judges compares desktop and mobile screenshots of each page.

Over 100 trials, Claude Code with Opus 4.7 scored a mean reward of 0.80, against 0.98 for the oracle that feeds the ground truth back to itself. The task, not the attempt, decided most of the score: minimal layouts scored above 0.87, illustrated and decorative ones below 0.75, and retro designs cost the agent about 0.18 against minimal ones.
