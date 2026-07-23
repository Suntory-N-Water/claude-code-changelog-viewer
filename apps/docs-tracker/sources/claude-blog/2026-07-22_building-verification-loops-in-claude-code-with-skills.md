---
source: claude-blog
url: https://claude.com/blog/building-verification-loops-in-claude-code-with-skills
title: Building verification loops in Claude Code with skills | Claude by Anthropic
published_at: "2026-07-22T00:00:00.000Z"
content_hash: a1c9b9f3da33b5480645e221cfe880c3ae718f62c4074761e3c28332da4044a1
lang: en
---

Most [agentic coding](https://claude.com/blog/introduction-to-agentic-coding) sessions follow a loop: you ask for a change, Claude gathers context, takes action, verifies the results, and if needed, loops back to gather additional context.

Verification is how agents check their work before responding. Claude already does some of this from observing the deterministic signals in your codebase, including type checkers, linters, tests, and runtime errors. Whatever Claude can't infer becomes the steps you take to manually check a feature. 

These manual steps, however, can be transformed into verification loops. In [Claude Code](https://claude.com/product/claude-code), a verification loop is an iterative process where Claude checks and attempts to fix the work.

![diagram of the agentic loop: 1. gathering context, 2. taking action, 3. verifying results.](https://cdn.prod.website-files.com/68a44d4040f98a4adf2207b6/6a60f2068656db3211c097af_5b4284f8.png)

_The agentic loop: 1. gathering context, 2. taking action, 3. verifying results._

In this article, we cover the most common types of verification loops and show you what we use inside Anthropic. Then we’ll show how to encode the manual checks you already do as skills, so Claude can close its own feedback loop and you can work on something else while it iterates.

## Built-in verification loops

Before diving into designing custom verification loops, it can be helpful to understand the built-in support Claude has for a number of different verification loops. Common features and approaches include:

*   **/verify skill**: builds, runs, and observes the changes in your application.
*   **Toolchain**: Claude aims to catch and act on error codes and warnings from any tool you provide such as a linter. A good practice is to list your exact build and test commands in CLAUDE.md so Claude doesn't have to infer them.
*   **Code Review (research preview)**: A managed multi-agent service that runs an automated review pass on PRs in the repos you enable. You can manually fix the finding and push, or close the loop by commenting @claude on the finding (if you’ve already set up and configured GitHub Actions, below).
*   **GitHub Actions**: Define a job that invokes Claude with a verification skill, and the same checks you run locally fire on every push or PR.
*   **Spec validation**: A skill that helps verify each change against a markdown spec in the repo and looks to fix violations.
*   **Rubrics in Claude Managed Agents (beta)**: A managed agentic service that allows you to verify outcomes against a rubric using a separate grader agent. Failures loop back for rework automatically.

## Writing verification loops 

When you have an existing project and you find yourself making the same small corrections every time Claude implements a new feature for you, it’s time to turn those steps into your own custom verification loop. The first step is to write down everything that you find yourself doing every time 

The same goes if you're starting a new project and need to figure out how the project should behave. Write the best-practices version in plain English, the way you'd hand it to a new teammate on day one.

If you're struggling to articulate the verification check itself, ask Claude for best practices first and edit from there. Your version probably differs on a few specific points, and those differences are exactly what you want to capture.

**Pro tip**: The check doesn't have to be qualitative to belong here. "Reject any migration that drops a column without a backfill step" is a deterministic rule no generic linter will catch but a project-specific one will. Anything you keep having to enforce by hand as a manual check qualifies for capture as a loop.
