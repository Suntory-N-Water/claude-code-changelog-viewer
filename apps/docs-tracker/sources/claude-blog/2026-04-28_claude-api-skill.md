---
source: claude-blog
url: https://claude.com/blog/claude-api-skill
title: Claude API skill now in CodeRabbit, JetBrains, Resolve AI, and Warp
published_at: "2026-04-28T15:00:00.000Z"
content_hash: 73c72aaf8da50c2c2e708bad928b37349a573d7a38093ecc6fd6b4990f204e88
lang: en
---

Today, CodeRabbit, JetBrains, Resolve AI, and Warp are bundling the [claude-api skill](https://github.com/anthropics/skills/tree/main/skills/claude-api), giving developers production-ready Claude API code wherever they build. First introduced in Claude Code in March, the skill is now in more of the tools developers already use.

## Building with the Claude API skill

The `claude-api` skill captures the details that make Claude API code work well, like which agent pattern fits a given job, what parameters change between model generations, and when to apply prompt caching. The result is fewer errors, better caching, cleaner agent patterns, and smoother model migrations. 

It stays current as our SDKs change. When a new model is released or the API gains a feature, Claude already knows.

Anywhere the skill is available, ask Claude to:

*   **"Improve my cache hit rate."** The skill applies prompt caching rules many developers miss.
*   **"Add context compaction to my agent."** It walks you through the compaction primitives and agent patterns in our docs.
*   **"Upgrade me to the latest Claude model."** Claude reviews your code and walks you through updating model names, prompts, and effort settings for a new model like [Opus 4.7](https://www.anthropic.com/news/claude-opus-4-7). In Claude Code, you can also run this directly with `/claude-api migrate.`**‍**
*   **"Build a deep research agent for my industry."** Claude walks you through configuring [Claude Managed Agents](https://platform.claude.com/docs/en/managed-agents/overview), so long-running research is a few prompts, not a custom project. In Claude Code, you can also run this directly with `/claude-api managed-agents-onboard`.
