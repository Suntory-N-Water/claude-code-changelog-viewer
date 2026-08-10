---
source: claude-blog
url: https://claude.com/blog/run-claude-code-sessions-on-your-own-compute
title: Self-hosted environments for Claude Code | Claude by Anthropic
published_at: "2026-08-06T00:00:00.000Z"
content_hash: 9ecf43a04cb7e8630f79f9a82a8f3ef30fb15d6c8261c5bc90a197f44c89d254
lang: en
---

Now in public beta, self-hosted environments let you run Claude Code sessions on your own infrastructure. Start a session from the web, mobile, desktop, or a routine, and it runs inside your network, next to your internal services, toolchains, and security controls, rather than on Anthropic-hosted infrastructure.

For most enterprises, we strongly recommend our hosted offering for operational simplicity with no infrastructure to run or maintain. Self-hosted environments are for teams whose network, tooling, or compliance requirements call for keeping agent execution on infrastructure they control. If you go this route, plan to staff engineering to own setup and ongoing maintenance.

### **Why self-host**

We saw organizations in our preview program adopt self-hosted environments for a few key reasons:

*   **Network access:** sessions run inside your network and can reach internal services, databases, and registries without exposing them to the public internet
*   **Customizability:** pre-install compilers, SDKs, and internal CLIs in your environment so every session starts ready to build
*   **Compliance:** source code and build artifacts stay on infrastructure you control
