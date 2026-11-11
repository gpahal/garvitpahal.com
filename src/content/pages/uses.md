---
title: Uses
description: The hardware, development tools and apps Garvit Pahal uses daily as a software engineer
---

The hardware and software I use daily. More `/uses` pages are on [uses.tech](https://uses.tech/).

## Hardware

- Laptop: MacBook Pro M3 Max 14"

- Desktop: an always-on Ubuntu machine I use from the Mac over SSH

- Monitor: [Dell S2722QC 27-inch 4K](https://www.dell.com/en-us/shop/dell-27-4k-uhd-usb-c-monitor-s2722qc/apd/210-bbqt/monitors-monitor-accessories)

- Keyboard: [NuPhy Air75 V3](https://nuphy.com/products/nuphy-air75-v3)

- Mouse: [Logitech MX Master 4](https://www.logitech.com/en-us/shop/p/mx-master-4)

- Shortcut keys: [Elgato Stream Deck MK.2](https://www.elgato.com/us/en/p/stream-deck)

- Headphones: [Philips SHP9500](https://www.usa.philips.com/c-p/SHP9500S_27/hifi-stereo-headphones) wired and [Technics EAH-AZ100](https://www.technics.com/sg/products/headphones-learn/headphones/the-future-of-sound-innovation-true-wireless-earbuds-eah-az100.html) wireless

## Two machines

My [dotfiles](https://github.com/gpahal/dotfiles) set up both, so the shell, editors, launcher and hotkeys match.

- Connection: OpenSSH over [Tailscale](https://tailscale.com/) with keys only, since Tailscale SSH drops sessions when tailscaled restarts

- Sessions: tmux starts at boot and restores its sessions after a reboot. Copies (OSC 52) and agent notifications reach the Mac over SSH

- Services: the T3 Code server, shared by the Mac and my phone, with Claude Code, Codex and Docker for its agents

- Desk: a USB switch moves the keyboard, mouse and Stream Deck between the machines, and the monitor input follows over DDC/CI. On Ubuntu a daemon draws the Stream Deck keys and GNOME gets the Mac's Hammerspoon hotkeys

- Uptime: no suspend, a UPS that shuts down and restarts with the power, daily security updates and health alerts to my phone through [ntfy](https://ntfy.sh/)

## Development tools

- Editors: [Zed](https://zed.dev/), and [Vim](https://www.vim.org/) in the terminal

- Terminal: [Ghostty](https://ghostty.org/) with [Monaspace](https://monaspace.githubnext.com/) Neon

- Shell: zsh with [starship](https://starship.rs/) and [atuin](https://atuin.sh/)

- Multiplexer: [tmux](https://github.com/tmux/tmux) with [tmux-sessionizer](https://github.com/gpahal/dotfiles/blob/main/tmux/bin/tmux-sessionizer)

- Git: [lazygit](https://github.com/jesseduffield/lazygit), [difftastic](https://github.com/Wilfred/difftastic) and [git wt](https://github.com/gpahal/dotfiles/blob/main/git/bin/git-wt) for worktrees

- Containers: [OrbStack](https://orbstack.dev/) on the Mac, [Docker](https://www.docker.com/) on Ubuntu

- Packages and runtimes: [Homebrew](https://brew.sh/), [mise](https://mise.jdx.dev/) for Node and Go, [rustup](https://rustup.rs/), [uv](https://docs.astral.sh/uv/) and [pnpm](https://pnpm.io/)

## AI coding

I run [Claude Code](https://claude.com/product/claude-code), on Claude Opus 5.5 at medium effort in auto mode, and [Codex](https://github.com/openai/codex) inside [T3 Code](https://t3.codes/). The [`ai_tools`](https://github.com/gpahal/dotfiles/tree/main/ai_tools) folder in my dotfiles sets them up on both machines.

- Worktrees: every T3 Code thread, subagent and background session gets its own git worktree

- Instructions: one user-level file for both agents. Work through to done, ask before adding a dependency, never weaken a test and commit only when asked

- Skills: shared by both, from spec to review and writing, mostly adapted from [Matt Pocock's skills](https://github.com/mattpocock/skills) and [poteto's pstack](https://github.com/cursor/plugins/tree/main/pstack)

## Apps

- AI assistants: [Claude](https://claude.ai/) and [ChatGPT](https://chatgpt.com/)

- Launcher: [Vicinae](https://www.vicinae.com/) on both machines, for apps, clipboard history and Raycast extensions

- Hotkeys and windows: [Hammerspoon](https://www.hammerspoon.org/) and [Rectangle](https://rectangleapp.com/)

- Dictation: [Wispr Flow](https://wisprflow.ai/)

- Notes and tasks: [Notion](https://www.notion.com/) and [Linear](https://linear.app/)

- Design: [Figma](https://www.figma.com/) and [Canva](https://www.canva.com/)

- Everyday: Chrome, Gmail, Google Calendar, Google Drive and Dropbox

- Privacy: [Cloudflare 1.1.1.1](https://1.1.1.1/) and [Mullvad](https://mullvad.net/en)

- Eyes and breaks: [f.lux](https://justgetflux.com/) and [Time Out](https://www.dejal.com/timeout/)

## This site

Built with [Astro](https://astro.build/), Markdown, [React](https://react.dev/) islands and [Tailwind CSS](https://tailwindcss.com/) on a [Cloudflare Worker](https://workers.cloudflare.com/), with [Convex](https://www.convex.dev/) behind the private tools. The source is on [GitHub](https://github.com/gpahal/garvitpahal.com).
