---
source: claude-blog
url: https://claude.com/blog/using-claude-code-the-unreasonable-effectiveness-of-html
title: "Using Claude Code: The unreasonable effectiveness of HTML"
published_at: "2026-05-19T15:00:00.000Z"
content_hash: 911903cc55351a1b5e13e180f37017fd6f9f12da2bb8c8896098c6abb349b5e0
lang: en
---

Markdown has become the dominant file format used by agents to communicate with humans. It’s simple, portable, has some rich text capability and is easy to edit. Claude has even gotten surprisingly good at using ASCII to make diagrams inside of Markdown files.

But as agents have become more and more powerful, I’ve found that Markdown has become an increasingly restrictive format. Specifically, I find it difficult to read a Markdown file of more than a hundred lines; I want to use Claude to generate richer visualizations, color and diagrams; and I want to be able to share these outputs more easily.

I also am increasingly not editing these files myself, but using them as specs and reference files. When I do make edits, I’m usually prompting Claude to edit them, which removes one of Markdown’s largest benefits.

Instead, I’ve started preferring HTML as an output format instead of Markdown and increasingly see this pattern being applied by others on the Claude Code team. In this post, I share why and how our team uses HTML to produce richer, more readable Claude Code outputs. If you'd like to follow along, you can start using these [HTML file templates](https://thariqs.github.io/html-effectiveness/#code-review) for common use cases, too.
