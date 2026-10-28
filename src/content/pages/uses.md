---
title: Uses
description: The hardware, development tools and apps Garvit Pahal uses daily as a software engineer
---

This is a rough list of the products I use daily as a software engineer. Check out [uses.tech](https://uses.tech/) for a list of other people's `/uses` pages!

There was a time in my early 20s when I used to enjoy building my own desktop and OS from scratch. I still enjoy tinkering with new tech, but I depend on a simple setup so that I can focus more on my work.

## Hardware

- Laptop: MacBook Pro M3 Max 14"

- Desktop: an always-on Ubuntu machine that I use from the Mac over SSH

- Monitor: [Dell S2722QC 27-inch 4K UHD](https://www.dell.com/en-us/shop/dell-27-4k-uhd-usb-c-monitor-s2722qc/apd/210-bbqt/monitors-monitor-accessories)

- Keyboard: [NuPhy Air75 V3](https://nuphy.com/products/nuphy-air75-v3)

- Mouse: [Logitech MX Master 4](https://www.logitech.com/en-us/shop/p/mx-master-4)

- Shortcut keys: [Elgato Stream Deck MK.2](https://www.elgato.com/us/en/p/stream-deck)

- Headphones: [Philips SHP9500 wired headphones](https://www.usa.philips.com/c-p/SHP9500S_27/hifi-stereo-headphones) and [Technics EAH-AZ100 wireless earphones](https://www.technics.com/sg/products/headphones-learn/headphones/the-future-of-sound-innovation-true-wireless-earbuds-eah-az100.html)

## Two machines

I work from the Mac, and an Ubuntu desktop runs around the clock beside it. My [dotfiles](https://github.com/gpahal/dotfiles) set up both, so the shell, editors, launcher and hotkeys match.

- Connection: OpenSSH over [Tailscale](https://tailscale.com/), not Tailscale SSH, which drops sessions when tailscaled restarts. The desktop accepts only keys, and only from private ranges and the tailnet.

- Sessions: tmux starts at boot on Ubuntu and brings back its sessions after a reboot. tmux and Vim copy to the Mac's clipboard through OSC 52, and agents' notifications reach Ghostty on the Mac over SSH.

- What runs there: the T3 Code server, as a service that T3 Code on the Mac and my phone share, with Claude Code, Codex and Docker for its agents

- Desk: a USB switch moves the keyboard, mouse and Stream Deck between the two machines, and the monitor's input follows over DDC/CI. Elgato's app doesn't run on Linux, so on Ubuntu a daemon draws the same Stream Deck keys, and GNOME gets the hotkeys Hammerspoon sets on the Mac.

- Uptime: suspend is off, a UPS shuts the desktop down on low battery and starts it when power returns, and security updates install daily. Disk health, a daily check and each boot push alerts to my phone through [ntfy](https://ntfy.sh/).

## Development tools

- IDE: [Zed](https://zed.dev/)

- Coding agents: [Claude Code](https://claude.com/product/claude-code) in [T3 Code](https://t3.codes/)

- Terminal: [Ghostty](https://ghostty.org/) with the [Monaspace](https://monaspace.githubnext.com/) Neon font

- Shell: zsh with [starship](https://starship.rs/) for the prompt and [atuin](https://atuin.sh/) for history

- Terminal multiplexer: [tmux](https://github.com/tmux/tmux), with [tmux-sessionizer](https://github.com/gpahal/dotfiles/blob/main/tmux/bin/tmux-sessionizer) to open a session for a project

- Terminal editor: [Vim](https://www.vim.org/)

- Git: [lazygit](https://github.com/jesseduffield/lazygit), [difftastic](https://github.com/Wilfred/difftastic) for diffs and [git wt](https://github.com/gpahal/dotfiles/blob/main/git/bin/git-wt) for worktrees

- Code management: [GitHub](https://github.com/)

- Containers: [OrbStack](https://orbstack.dev/) on the Mac and [Docker](https://www.docker.com/) on Ubuntu

- Packages and runtimes: [Homebrew](https://brew.sh/) for CLI tools and apps, [mise](https://mise.jdx.dev/) for Node and Go, [rustup](https://rustup.rs/) for Rust, [uv](https://docs.astral.sh/uv/) for Python and [pnpm](https://pnpm.io/) for JavaScript

## AI coding setup

T3 Code runs the Claude Code and [Codex](https://github.com/openai/codex) CLIs, so their settings and skills apply there too. The [`ai_tools`](https://github.com/gpahal/dotfiles/tree/main/ai_tools) folder in my dotfiles sets them up on both machines.

- Worktrees: every T3 Code thread works in its own git worktree. Claude Code's subagents and background sessions make theirs with git wt under `~/.worktrees`.

- Instructions: one user-level file, copied to `~/.claude/CLAUDE.md` and `~/.codex/AGENTS.md`. It tells agents to work through to done without check-ins, ask before adding a dependency, never weaken a test to make it pass and commit only when asked. This site and my dotfiles keep their conventions in `AGENTS.md`, which their `CLAUDE.md` imports.

- Skills: shared by Claude Code and Codex. The engineering ones take a feature from spec to design, tickets, implementation and review, and the productivity ones cover writing and questioning a plan. Most are modified copies from [Matt Pocock's skills](https://github.com/mattpocock/skills) and [poteto's pstack](https://github.com/cursor/plugins/tree/main/pstack).

- Defaults: Claude Opus 5.5 at medium effort in auto mode

## Productivity tools

- Browser: [Google Chrome](https://www.google.com/intl/en_in/chrome/)

- AI assistant: [Claude](https://claude.ai/) and [ChatGPT](https://chatgpt.com/)

- Command centre: [Vicinae](https://www.vicinae.com/) on both machines, for apps, clipboard history and Raycast extensions

- Hotkeys: [Hammerspoon](https://www.hammerspoon.org/)

- Window management: [Rectangle](https://rectangleapp.com/)

- Dictation: [Wispr Flow](https://wisprflow.ai/)

- Knowledge base: [Notion](https://www.notion.com/)

- Task management: [Linear](https://linear.app/)

- Email: [Gmail](https://mail.google.com/)

- Calendar: [Google Calendar](https://calendar.google.com/)

- File management and backup: [Google Drive](https://drive.google.com/) and [Dropbox](https://www.dropbox.com/)

## Design tools

- Interface design: [Figma](https://www.figma.com/)

- Graphic design: [Canva](https://www.canva.com/)

## Misc

- DNS: [Cloudflare 1.1.1.1](https://1.1.1.1/)

- VPN: [Mullvad](https://mullvad.net/en)

- Break reminders: [Time Out](https://www.dejal.com/timeout/)

- Blue light filter: [f.lux](https://justgetflux.com/)

- CLI tools and configs: [dotfiles](https://github.com/gpahal/dotfiles)

## This site

This site is built with [Astro](https://astro.build/), Markdown, [React](https://react.dev/) islands and [Tailwind CSS](https://tailwindcss.com/). It runs on a [Cloudflare Worker](https://workers.cloudflare.com/), and [Convex](https://www.convex.dev/) backs its private tools. The source is on [GitHub](https://github.com/gpahal/garvitpahal.com).

Last updated October 2026
