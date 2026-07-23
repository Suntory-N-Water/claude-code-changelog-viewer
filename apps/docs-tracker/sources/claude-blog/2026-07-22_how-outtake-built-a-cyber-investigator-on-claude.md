---
source: claude-blog
url: https://claude.com/blog/how-outtake-built-a-cyber-investigator-on-claude
title: How Outtake built a cyber investigator on Claude | Claude by Anthropic
published_at: "2026-07-22T00:00:00.000Z"
content_hash: e2518023218cbd02b29318ef0e2a765a6a1a55ec48df52e5eb2f39a1a82d157b
lang: en
---

_In our series,_ **How startups build with Claude,** we highlight how startups are transforming their industries with AI. In this article, we share how Outtake built an autonomous cyber investigator that detects, investigates, and dismantles digital threats, from cloned login pages to entire adversarial networks.

Even with strong safeguards and controls, bad actors can mask their use of AI in seemingly benign purposes that hide their malicious intent. Code generation platforms can create convincing login portals, agentic go-to-market tooling can power the distribution of phishing attacks, and image generation capabilities can spoof identity. Traditional cybersecurity defenses struggle to keep up.

“If you put on the bad actor's hat, it's actually a great time to be running attacks,” says Alex Dhillon, founder and CEO of AI cybersecurity platform [Outtake](https://www.outtake.ai/). “The average attack is not only executed faster because of AI, but it also captures deeper access due to AI”

Outtake unifies the full [digital trust attack chain](https://www.outtake.ai/blog/2026-digital-trust-industry-pain-report) into a single defense, using fleets of AI agents to autonomously detect, investigate, and dismantle threats aimed at their customers, which include leading AI labs, major hedge funds, and US federal agencies. 

Here’s how the Outtake team recently built the Recon Agent, a long-running autonomous cyber investigator, on Claude using [Claude Code](https://code.claude.com/docs/en/quickstart) and the [Agent SDK](https://code.claude.com/docs/en/agent-sdk/overview).

## **Agentic offense needs agentic defense**

When targeting a company, attackers typically move through the same process: weaponize public data → build impersonations as lures → exploit internal systems. This process has been accelerated by AI.

Before breaking into anything, they harvest publicly available information about an organization, and its executives and employees.

They then turn that intelligence into bait, like a fake website with a fraudulent login page, to trick victims into handing over credentials. The access gained from these lures help the attacker get inside the perimeter to reach an organization’s most valuable and sensitive assets.

   
This three-part sequence is predictable, but legacy security tooling guards only one slice at a time:

*   Threat intelligence tools monitor the public-data stage,
*   Brand protection tools watch for impersonations, and
*   Endpoint tools guard the internal systems. 

Outtake’s Recon Agent investigates the full network behind an impersonation. Instead of just taking down a cloned login page, for example, the agent gathers and classifies evidence from the impersonation event. 

It follows those leads to connected infrastructure, like a fake Telegram account that presents itself as “Customer Support,” and maps this adversarial network in a graph. The agent’s final step produces a report explaining the investigation process, a profile of the threat actor, and a reconstructed timeline of what the attacker did. 

To carry out this sophisticated workflow, the Recon Agent can read, write, and run code. It can even interact with malicious login pages directly to see where stolen credentials actually go. 

These investigations can require agents to run autonomously for long periods of time. Agent sessions run a median of 16 minutes, but routinely stretch to an hour and beyond; the longest run thus far lasted two hours of agentic work before returning results.
