---
source: claude-blog
url: https://claude.com/blog/whats-new-in-claude-managed-agents
title: "New in Claude Managed Agents: run agents on a schedule and store
  environment variables in vaults"
published_at: "2026-06-08T15:00:00.000Z"
content_hash: 8539a8a8ef57780d9fb28f49130bb7c4fab795a7f963aaf5fe42befd8369425b
lang: en
---

Starting today, Claude Managed Agents can run on a schedule and securely access CLI tools and other authenticated services. Both features are now available in public beta on the Claude Platform.

## **Run agents on a schedule**

Agents can now run on a schedule, completing routine work automatically. A [scheduled deployment](https://platform.claude.com/docs/en/managed-agents/scheduled-deployments) gives an agent a cron schedule. Each time the schedule fires, the agent starts a new session and completes its task, with no scheduler for you to build or host. 

Use it for recurring work like a nightly data sync, a weekly compliance scan, or a daily digest. Once a deployment is live, you can pause, resume, or archive it at any time, or trigger additional runs on demand.

![](https://cdn.prod.website-files.com/68a44d4040f98a4adf2207b6/6a2704ab5b6bc1de3bb952fc_Claude-Console-Scheduled-Deployments.png)

Teams are already using scheduled deployments to automate recurring work:

*   [Rakuten](https://claude.com/customers/rakuten-qa) uses scheduled deployments to analyze spreadsheet data and produce reports and decks on a weekly or monthly schedule. Teams also monitor production logs and metrics, allowing product managers to see application health without creating a dashboard.
*   [Actively AI](https://actively.ai/) uses Managed Agents to power cross-account agentic search for sales teams. Scheduled deployments refresh answers regularly, simplifying their stack by replacing scheduling infrastructure the team initially built themselves.[‍](https://ando.so/)
*   [Ando](https://ando.so/) uses scheduled deployments to keep hiring and sales teams moving. Agents autonomously watch channels for proposed next steps, follow up when they're due, and send meeting reminders.

## **Store environment variables in vaults to authenticate CLIs and other tools**

Agents [connect to external systems](https://claude.com/blog/building-agents-that-reach-production-systems-with-mcp) through direct API calls, CLIs, and MCP. Now we're extending [vaults](https://platform.claude.com/docs/en/managed-agents/vaults) to support environment variables, so CLIs and other tools can make authenticated requests. CLIs let agents drive existing command-line tools directly through a shell, making them a fast, lightweight integration path. Register an API key with an environment variable name and the domains it can reach, and the CLIs installed in an agent's sandbox can use it to make authenticated API calls.

The agent never sees your key because the sandbox only holds a placeholder. The real key is attached at the network boundary, and only on requests to domains you allow, so it only goes where you’ve approved. To change a key, update it in the vault, and running sessions will pick up the new value on their next call. Most CLIs that send their key in an HTTP request work this way, including the Browserbase, KERNEL, Notion, Ramp, and Sentry CLIs. [Browserbase](https://docs.browserbase.com/integrations/anthropic/managed-agents/quickstart) and [KERNEL](https://www.kernel.sh/docs/integrations/claude-managed-agents) give Managed Agents browser capabilities for the first time, so agents can navigate and interact with the web alongside their other tools.

![](https://cdn.prod.website-files.com/68a44d4040f98a4adf2207b6/6a27074e40b19ba74e79b134_Claude-Managed-Agents-CLI-credential-vaults-diagram%20\(1\).png)

Teams are using environment variables in vaults to give agents secure access to authenticated tools:

*   [Notion](https://claude.com/customers/notion-qa) uses environment variables in vaults to roll out its CLI alongside MCP tools, adding file-upload capabilities to its agents without API tokens ever being handed to the model.
*   [Browserbase](https://www.browserbase.com/) built its public catalog of browser skills using the [browse CLI](https://www.npmjs.com/package/browse), authenticated through vaults. A scheduled deployment periodically validates the catalog to keep it accurate.
*   [KERNEL](https://www.kernel.sh/docs/integrations/claude-managed-agents) uses environment variables in vaults to securely connect agents to the databases where it tracks usage and customer conversations. The agent flags usage surges as they happen, so the team can confirm with customers if the activity is intended.[‍](https://getmilana.ai/)
*   [Milana](https://getmilana.ai/) uses environment variables in vaults to securely connect its AI product engineer to a customer's codebase. The agent finds and fixes bugs automatically, with large-scale data analysis running faster than before.
