---
source: claude-blog
url: https://claude.com/blog/getting-started-with-loops
title: Getting started with loops | Claude by Anthropic
published_at: "2026-06-30T00:00:00.000Z"
content_hash: 8e8aee12660a427105d45c81731c4c39cd4e05eca4f6c6a21abe850bf25594d9
lang: en
---

There’s a lot of talk right now about "designing loops" instead of prompting your coding agent. If you spend some time on X trying to pin down what a loop actually is, you'll come across multiple different answers. 

On the Claude Code team, we define **loops as agents repeating cycles of work until a stop condition is met**. We categorize a few different types of loops based on:

*   How they are triggered
*   How they are stopped
*   What Claude Code primitive is used
*   What type of task is most appropriate for each.

We’ll cover the main loop types, when to use each, and how to maintain code quality while managing token usage. Not all tasks require complex loops; start with the simplest solution and use these patterns selectively.
