---
source: claude-blog
url: https://claude.com/blog/steering-claude-code-skills-hooks-rules-subagents-and-more
title: "Steering Claude Code: skills, hooks, subagents and more"
published_at: "2026-06-17T15:00:00.000Z"
content_hash: 46baa985bb7ea2c15c8f70155b253d0810cbe5f43373e5f839cf82d832f8951f
lang: en
---

Claude is built to work the way you work, and in Claude Code you can customize it.

There are seven methods for instructing Claude's behavior: CLAUDE.md files, rules, [**skills**](https://code.claude.com/docs/en/skills), [**subagents**](https://code.claude.com/docs/en/sub-agents), [**hooks**](https://code.claude.com/docs/en/hooks-guide), output styles, and appending the system prompt.

Each method controls:

*   When an instruction loads into context; 
*   Whether it persists through long sessions (compaction behavior); and 
*   How much authority it carries.

The table below provides a quick summary of key differences across each method while the post provides additional detail and decision framework for determining where each of your Claude instructions belongs.

## The seven methods for delivering instructions

### CLAUDE.md files

CLAUDE.md is a markdown file at the root of your project. It loads into context at session start and stays there for the entire session.

Build commands, directory layout, monorepo structure, coding conventions, and team norms all fit naturally here.

There are two types, and they load differently: 

*   **Always loaded**: The first type is a root CLAUDE.md file, either in a shared repository and/or saved locally for your personal preferences specific to a project. All these files load at session start, and won’t get lost or degraded across long sessions. When Claude Code compacts the conversation, it re-reads these files.
*   **On-demand:** CLAUDE.md files in subdirectories below the folder where you initialized the session. For example, `app/api/CLAUDE.md` loads when Claude reads a file under `app/api`, not at session start. It shares the compaction behavior of path-scoped rules: gone until that subdirectory is touched again. 

![](https://cdn.prod.website-files.com/68a44d4040f98a4adf2207b6/6a340f852d1f938ab8675599_65a737a9.png)

All subdirectory CLAUDE.md files below the cwd load when Claude reads a file within that directory.

In a shared repository, CLAUDE.md grows the way any unowned config file does: every team appends its own instructions and nothing gets deleted. The cost compounds at scale.

Every line loads into every session for every engineer working in the repo, whether it's relevant to their task or not. This consumes tokens and dilutes adherence to the instructions that actually matter. As the file grows, push team-specific conventions into path-scoped rules and procedures into skills, where they load only when relevant.

**Tip:** Keep CLAUDE.md under 200 lines, give it an owner, and review changes to it like code. Think of this file as giving Claude an overview of your codebase, or as an index pointing to other files where Claude can find more information as needed.

In monorepos, give each team's directory its own subdirectory CLAUDE.md so teams only load their own conventions, and developers can use the claudeMdExcludes setting to skip files from teams whose code they never touch.

For standards that must apply to every repository in the organization — security policies, compliance requirements — a centrally managed CLAUDE.md can be deployed to developer machines via MDM or config management, and it can't be excluded by individual settings.

More on setting up CLAUDE.md in our blog post, [CLAUDE.md files: Customizing Claude Code for your codebase](https://claude.com/blog/using-claude-md-files).
