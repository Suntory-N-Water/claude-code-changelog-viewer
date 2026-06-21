---
source: anthropic-news
url: https://www.anthropic.com/news/claude-3-7-sonnet
title: Claude 3.7 Sonnet and Claude Code
published_at: "2025-02-23T15:00:00.000Z"
content_hash: ce8faa7e90cfee8510be4fd2f8d460762bcd0f0294819d45f6c56bab9e486d58
lang: en
---

Today, we’re announcing Claude 3.7 Sonnet1, our most intelligent model to date and the first hybrid reasoning model on the market. Claude 3.7 Sonnet can produce near-instant responses or extended, step-by-step thinking that is made [visible to the user](https://youtu.be/t3nnDXa81Hs). API users also have fine-grained control over _how long_ the model can think for.

Claude 3.7 Sonnet shows particularly strong improvements in coding and front-end web development. Along with the model, we’re also introducing a command line tool for agentic coding, Claude Code. Claude Code is available as a limited research preview, and enables developers to delegate substantial engineering tasks to Claude directly from their terminal.

Claude 3.7 Sonnet is now available on all [Claude](https://claude.ai/redirect/website.v1.cdbe73f9-f240-463a-a3dc-08711e45d2e0/new) plans—including Free, Pro, Team, and Enterprise—as well as the [Claude Developer Platform](https://docs.claude.com/en/docs/about-claude/models), [Amazon Bedrock](https://aws.amazon.com/bedrock/claude/), and [Google Cloud’s Vertex AI](https://cloud.google.com/vertex-ai/generative-ai/docs/partner-models/use-claude). Extended thinking mode is available on all surfaces except the free Claude tier.

In both standard and extended thinking modes, Claude 3.7 Sonnet has the same price as its predecessors: $3 per million input tokens and $15 per million output tokens—which includes thinking tokens.

## Claude 3.7 Sonnet: Frontier reasoning made practical

We’ve developed Claude 3.7 Sonnet with a different philosophy from other reasoning models on the market. Just as humans use a single brain for both quick responses and deep reflection, we believe reasoning should be an integrated capability of frontier models rather than a separate model entirely. This unified approach also creates a more seamless experience for users.

Claude 3.7 Sonnet embodies this philosophy in several ways. First, Claude 3.7 Sonnet is both an ordinary LLM and a reasoning model in one: you can pick when you want the model to answer normally and when you want it to [think longer before answering](https://www.anthropic.com/research/visible-extended-thinking). In the standard mode, Claude 3.7 Sonnet represents an upgraded version of Claude 3.5 Sonnet. In [extended thinking mode](https://docs.anthropic.com/en/docs/build-with-claude/extended-thinking), it self-reflects before answering, which improves its performance on math, physics, instruction-following, coding, and many other tasks. We generally find that prompting for the model works similarly in both modes.

Second, when using Claude 3.7 Sonnet through the API, users can also control the _budget_ for thinking: you can tell Claude to think for no more than N tokens, for any value of N up to its output limit of 128K tokens. This allows you to trade off speed (and cost) for quality of answer.

Third, in developing our reasoning models, we’ve optimized somewhat less for math and computer science competition problems, and instead shifted focus towards real-world tasks that better reflect how businesses actually use LLMs.

[Early testing](https://www.anthropic.com/claude/sonnet#customer-stories) demonstrated Claude’s leadership in coding capabilities across the board: Cursor noted Claude is once again best-in-class for real-world coding tasks, with significant improvements in areas ranging from handling complex codebases to advanced tool use. Cognition found it far better than any other model at planning code changes and handling full-stack updates. Vercel highlighted Claude’s exceptional precision for complex agent workflows, while Replit has successfully deployed Claude to build sophisticated web apps and dashboards from scratch, where other models stall. In Canva’s evaluations, Claude consistently produced production-ready code with superior design taste and drastically reduced errors.

Claude 3.7 Sonnet achieves state-of-the-art performance on SWE-bench Verified, which evaluates AI models’ ability to solve real-world software issues. See the appendix for more information on scaffolding.

Claude 3.7 Sonnet achieves state-of-the-art performance on TAU-bench, a framework that tests AI agents on complex real-world tasks with user and tool interactions. See the appendix for more information on scaffolding.

Claude 3.7 Sonnet excels across instruction-following, general reasoning, multimodal capabilities, and agentic coding, with extended thinking providing a notable boost in math and science. Beyond traditional benchmarks, it even outperformed all previous models in our [Pokémon gameplay tests](https://www.anthropic.com/research/visible-extended-thinking).

## Claude Code

Since June 2024, Sonnet has been the preferred model for developers worldwide. Today, we're empowering developers further by introducing [Claude Code](https://docs.anthropic.com/en/docs/agents-and-tools/claude-code)—our first agentic coding tool—in a limited research preview.

Claude Code is an active collaborator that can search and read code, edit files, write and run tests, commit and push code to GitHub, and use command line tools—keeping you in the loop at every step.

Claude Code is an early product but has already become indispensable for our team, especially for test-driven development, debugging complex issues, and large-scale refactoring. In early testing, Claude Code completed tasks in a single pass that would normally take 45+ minutes of manual work, reducing development time and overhead.

In the coming weeks, we plan to continually improve it based on our usage: enhancing tool call reliability, adding support for long-running commands, improved in-app rendering, and expanding Claude's own understanding of its capabilities.

Our goal with Claude Code is to better understand how developers use Claude for coding to inform future model improvements. By [joining this preview](https://docs.anthropic.com/en/docs/agents-and-tools/claude-code/overview#install-and-authenticate), you’ll get access to the same powerful tools we use to build and improve Claude, and your feedback will directly shape its future.

## Working with Claude on your codebase

We’ve also improved the coding experience on Claude.ai. Our GitHub integration is now available on all Claude plans—enabling developers to connect their code repositories directly to Claude.

Claude 3.7 Sonnet is our best coding model to date. With a deeper understanding of your personal, work, and open source projects, it becomes a more powerful partner for fixing bugs, developing features, and building documentation across your most important GitHub projects.

## Building responsibly

We’ve conducted extensive testing and evaluation of Claude 3.7 Sonnet, working with external experts to ensure it meets our standards for security, safety, and reliability. Claude 3.7 Sonnet also makes more nuanced distinctions between harmful and benign requests, reducing [unnecessary refusals by 45%](https://www.anthropic.com/claude-3-7-sonnet-system-card) compared to its predecessor.

The [system card](https://www.anthropic.com/claude-3-7-sonnet-system-card) for this release covers new safety results in several categories, providing a detailed breakdown of our Responsible Scaling Policy evaluations that other AI labs and researchers can apply to their work. The card also addresses emerging risks that come with computer use, particularly prompt injection attacks, and explains how we evaluate these vulnerabilities and train Claude to resist and mitigate them. Additionally, it examines potential safety benefits from reasoning models: the ability to understand how models make decisions, and whether model reasoning is genuinely trustworthy and reliable. Read the full [system card](https://www.anthropic.com/claude-3-7-sonnet-system-card) to learn more.

## Looking ahead

Claude 3.7 Sonnet and Claude Code mark an important step towards AI systems that can truly augment human capabilities. With their ability to reason deeply, work autonomously, and collaborate effectively, they bring us closer to a future where AI enriches and expands what [humans can achieve](https://darioamodei.com/machines-of-loving-grace).

We're excited for you to explore these new capabilities and to see what you’ll create with them. As always, we welcome your [feedback](<mailto: feedback@anthropic.com>) as we continue to improve and evolve our models.
