---
source: claude-blog
url: https://claude.com/blog/a-field-guide-to-claude-fable-finding-your-unknowns
title: "A field guide to Claude Fable 5: Finding your unknowns | Claude | Claude
  by Anthropic"
published_at: "2026-07-06T00:00:00.000Z"
content_hash: 657dd9fbb828bc7ae1685d7bf3f673ae3d63cdec49f45588298a828e0a6047db
lang: en
---

When working with Claude Code, I’m often reminded of the difference between the map and the territory.

The map, a representation of the work to be done, is my prompts and skills and context, it’s what I give Claude. The territory is where the work needs to happen, the codebase, the real world, its actual constraints.

![](https://cdn.prod.website-files.com/68a44d4040f98a4adf2207b6/6a4be4919e159adcdfa3ec1c_94358c3c.png)

The difference between the map and the territory is what I call _unknowns_. When Claude runs into an unknown, it needs to make a decision based on its best guess of what I want. The more work being done, the more unknowns Claude might run into.

Claude Fable is the first model where I find the quality of the work is bottlenecked by my ability to clarify its unknowns.

Importantly, just planning ahead isn’t always enough. You can find unknowns deep in implementation, or your unknowns may point you to the fact that you should actually be solving the problem in a different way altogether.

I’ve found that working with Fable is an iterative process of discovering my unknowns before, during, and after implementation.
