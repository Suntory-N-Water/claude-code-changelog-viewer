---
title: context-window
source: https://code.claude.com/docs/en/context-window.md
---

# Explore the context window

> An interactive simulation of how Claude Code's context window fills during a session. See what loads automatically, what each file read costs, and when rules and hooks fire.

Claude Code's context window holds everything Claude knows about your session: your instructions, the files it reads, its own responses, and content that never appears in your terminal. The timeline below walks through what loads and when. See [the written breakdown](#what-the-timeline-shows) for the same content as a list.

## What the timeline shows

The session walks through a realistic flow with representative token counts:

- **Before you type anything**: CLAUDE.md, auto memory, MCP tool names, and skill descriptions all load into context. Your own setup may add more here, like an [output style](/en/output-styles) or text from [`--append-system-prompt`](/en/cli-reference), which both go into the system prompt the same way.
- **As Claude works**: each file read adds to context, [path-scoped rules](/en/memory#path-specific-rules) load automatically alongside matching files, and a [PostToolUse hook](/en/hooks-guide) fires after each edit.
- **The follow-up prompt**: a [subagent](/en/sub-agents) handles the research in its own separate context window, so the large file reads stay out of yours. Only the summary and a small metadata trailer come back.
- **At the end**: `/compact` replaces the conversation with a structured summary. Most startup content reloads automatically. The [skill](/en/skills) listing is the one exception.

## Check your own session

The visualization uses representative numbers. To see your actual context usage at any point, run `/context` for a live breakdown by category with optimization suggestions. Run `/memory` to check which CLAUDE.md and auto memory files loaded at startup.

## Related resources

For deeper coverage of the features shown in the timeline, see these pages:

- [Extend Claude Code](/en/features-overview): when to use CLAUDE.md vs skills vs rules vs hooks vs MCP
- [Store instructions and memories](/en/memory): CLAUDE.md hierarchy and auto memory
- [Subagents](/en/sub-agents): delegate research to a separate context window
- [Best practices](/en/best-practices): managing context as your primary constraint
- [Reduce token usage](/en/costs#reduce-token-usage): strategies for keeping context usage low
