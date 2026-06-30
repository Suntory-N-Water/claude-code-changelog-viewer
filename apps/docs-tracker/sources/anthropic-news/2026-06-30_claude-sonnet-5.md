---
source: anthropic-news
url: https://www.anthropic.com/news/claude-sonnet-5
title: Introducing Claude Sonnet 5
published_at: "2026-06-30T00:00:00.000Z"
content_hash: 7e2a2cc5373f0477deec39788f843c1571acaf1fbf9be65057fcc4473f2aac98
lang: en
---

Claude Sonnet 5 is built to be the most agentic Sonnet model yet. It can make plans, use tools like browsers and terminals, and run autonomously at a level that, just a few months ago, required larger and more expensive models.

For many developers, the agentic AI era began with Sonnet-class models: Claude Sonnet 3.5, 3.6, and 3.7 were the first models that showed impressive skills in coding and tool use. More recently, though, the clearest gains in agentic capabilities have been in our Opus-class models.

Sonnet 5 narrows the gap: its performance is close to that of Opus 4.8, but at lower prices. It’s a substantial improvement over its predecessor, Sonnet 4.6, on important aspects of agentic performance like reasoning, tool use, coding, and knowledge work:

_Scores for Sonnet 5 on a variety of evaluations compared to those of Sonnet 4.6 and Opus 4.8 (a more generally capable model, for reference). The [Claude Sonnet 5 System Card](https://www.anthropic.com/claude-sonnet-5-system-card) reports a broader set of evaluations in detail._

Our safety assessments found that Sonnet 5 shows an overall lower rate of undesirable behaviors than Sonnet 4.6, and is generally safer to use in agentic contexts. Evaluations also show that it has a much lower ability to perform cybersecurity tasks than our current Opus models.

From today, Claude Sonnet 5 is available across all plans: it is the default model for Free and Pro plans, and is available to Max, Team, and Enterprise users. It’s also available in Claude Code and on the Claude Platform, where it launches with introductory pricing of $2 per million input tokens and $10 per million output tokens through August 31, 2026, after which it will be priced at $3 per million input tokens and $15 per million output tokens. Developers can use `claude-sonnet-5` via the [Claude API](https://platform.claude.com/docs/en/about-claude/models/overview).

## Working with Claude Sonnet 5

The charts below compare the performance of Sonnet 5 with Sonnet 4.6 and Opus 4.8 at different [effort](https://platform.claude.com/docs/en/build-with-claude/effort) levels on the agentic search evaluation [BrowseComp](https://arxiv.org/abs/2504.12516) and the computer use evaluation [OSWorld-Verified](https://xlang.ai/blog/osworld-verified). Sonnet 5 (orange line) is a strict improvement over Sonnet 4.6 (gray line). Opus 4.8 (yellow line) is still the model of choice for higher accuracy on these tasks, but Sonnet 5 provides developers with lower-priced options that are of much higher quality than what was previously available. Between Sonnet 5 and Opus 4.8, users can adjust the effort level to find the right balance of cost and performance.

Agentic searchAgentic computer use

_Cost-performance curves at different effort levels. The previous best Sonnet model (Sonnet 4.6) fell well short of Opus 4.8. Now Sonnet 5 and Opus 4.8 cover a single range, with Sonnet 5 offering impressive capabilities at a lower cost and Opus 4.8 offering greater accuracy at a higher price. The charts show Sonnet 5 priced at $3 per million input tokens and $15 per million output tokens. Furthermore, with the introductory launch pricing through August 31 ($2/MTok input and $10/MTok output), the effective cost of Sonnet 5 is even lower than shown here. Opus 4.8 is priced at $5/MTok input and $25/MTok output. xhigh = extra high effort level._

_Cost-performance curves at different effort levels. The previous best Sonnet model (Sonnet 4.6) fell well short of Opus 4.8. Now Sonnet 5 and Opus 4.8 cover a single range, with Sonnet 5 offering impressive capabilities at a lower cost and Opus 4.8 offering greater accuracy at a higher price. The charts show Sonnet 5 priced at $3 per million input tokens and $15 per million output tokens. Furthermore, with the introductory launch pricing through August 31 ($2/MTok input and $10/MTok output), the effective cost of Sonnet 5 is even lower than shown here. Opus 4.8 is priced at $5/MTok input and $25/MTok output. xhigh = extra high effort level._

Feedback from our early access partners has been consistent: Sonnet 5 is much more agentic than its predecessors. Testers described how it finishes complex tasks where previous Sonnet models would stop short, how it checks its own output without explicitly being asked, and how it does all this agentic work at an attractive price point:

![ logo](https://www-cdn.anthropic.com/images/4zrzovbb/website/18f900625532e1baaa3302bdf9539f73592bdf60-164x64.svg)

> Claude Sonnet 5 gives our agents a strong execution layer for multi-step software engineering work. It handles sustained coding, tool use, and debugging well across messy technical contexts, and has been especially useful for workflows where follow-through and technical grounding matter.
> 
> Zimu Li  
> Member of Technical Staff

![ logo](https://www-cdn.anthropic.com/images/4zrzovbb/website/f343481e6a953bc7b5390e6d9f61cf387c2ceb11-103x64.svg)

> We handed Claude Sonnet 5 a two-part job—update Salesforce account tiers, send a launch announcement to enterprise contacts—and it finished end to end. That used to stall halfway. For day-to-day automation, it’s a no-brainer
> 
> Daniel Shepard  
> Senior Engineer

![ logo](https://www-cdn.anthropic.com/images/4zrzovbb/website/40a2a6a28afd8ac8fbf0e764b6bbf4ebf06a1977-133x64.svg)

> Claude Sonnet 5 gets more done with less. Same output quality, fewer steps to get there. It refuses unsafe requests cleanly and consistently, too. At Lovable, we’re putting powerful tools in the hands of millions of builders. A model that knows when to say no is just as important as one that knows how to build.
> 
> Fabian Hedin  
> Co-founder

![ logo](https://www-cdn.anthropic.com/images/4zrzovbb/website/73b380711885c6beb5270575119dbf31d7f71236-107x64.svg)

> We ran Claude Sonnet 5 against dozens of our most challenging real pull requests, and it carried each one through to a tested, verified result on its own — freeing our engineers to focus on the judgment, the decision, and the final sign-off.
> 
> Yusuke Kaji  
> GM, AI for Business

![ logo](https://www-cdn.anthropic.com/images/4zrzovbb/website/0cd3307b18e36ea9146a2fa1cbcb2966c4ccfd36-107x64.svg)

> I asked Claude Sonnet 5 to investigate a bug. Unprompted, it wrote a reproducing test, implemented the fix, then stashed it to confirm the bug came back without the change. All in a single pass.
> 
> Neel Chotai  
> Rust Engineer and Software Engineer

![ logo](https://www-cdn.anthropic.com/images/4zrzovbb/website/f084c88e65466636019709c40cc477aadce2f718-151x64.svg)

> With Claude Sonnet 5, agents stay on plan, follow our conventions, and ship clean multi-step changes, all at an efficient cost.
> 
> Sualeh Asif  
> Co-founder

![ logo](https://www-cdn.anthropic.com/images/4zrzovbb/website/ade72922c1b58726e1b7c17f0e500054e3d74aa0-92x37.svg)

> Claude Sonnet 5 is at its best on brownfield code—race conditions, hidden tests, the parts nobody wants to touch. It traces a failure to its actual root cause and ships a durable fix instead of patching the symptom.
> 
> Dominic Elm  
> Founding Engineer

![ logo](https://www-cdn.anthropic.com/images/4zrzovbb/website/b130e0ceb83f1514a925c7dc93f9768ed60232e3-85x64.svg)

> Claude Sonnet 5 sits on the Pareto frontier for Eve’s plaintiff-law tasks. We see the clearest gains in legal research and analysis, at a price-to-performance ratio that made the choice to migrate easy.
> 
> Mauricio Wulfovich  
> Staff ML Engineer

![ logo](https://www-cdn.anthropic.com/images/4zrzovbb/website/d97a1e1d49be76a2b9cc3df04843793e9a803214-180x64.svg)

> ClickHouse agents explore live data and produce insights on the fly, so time-to-insight matters when testing new models. Claude Sonnet 5 reasons in tighter steps and gets our users to answers noticeably faster. That speed is a difference our customers feel.
> 
> Ryadh Dahimene  
> Director PM AI/ML

![ logo](https://www-cdn.anthropic.com/images/4zrzovbb/website/7504d4d2c41a3baa1ac5cb0d4e7bd19abc57e07d-105x64.svg)

> At Pace, our computer-use agents run insurance workflows—submission intake, FNOL, loss runs—on the systems our operations teams already use. Claude Sonnet 5 consistently takes the right action and does it quickly, which is what real insurance work demands.
> 
> Eric He  
> Member of Technical Staff

01 / 10

## Safety evaluations

Our pre-deployment safety evaluations found that Sonnet 5 was overall an improvement on Sonnet 4.6. On agentic safety, the model is better at refusing malicious requests and resisting hijack attempts in prompt injection attacks. The model shows lower rates of hallucination and sycophancy than Sonnet 4.6. On our automated behavioral audit, which tests a wide range of misaligned behaviors such as cooperation with misuse and deception, Sonnet 5 scored lower (that is, safer) overall. However, it did show somewhat higher rates of misaligned behavior on this assessment compared to the more capable Opus 4.8 and Claude Mythos Preview.

_Rates of misaligned behavior on our automated behavioral audit, which tests for a very wide range of undesirable behaviors across many situations and contexts (see Section 6.4 of the [Sonnet 5 System Card](https://www.anthropic.com/claude-sonnet-5-system-card) for a complete list and results for each specific behavior). Sonnet 5 shows an overall lower rate of misaligned behavior than Sonnet 4.6, though a higher rate than Mythos Preview and Opus 4.8._

We did not deliberately train Sonnet 5 on cybersecurity tasks. It can perform some routine, non-harmful cyber tasks, but on evaluations testing potentially dangerous cyber skills, such as developing software exploits, it shows substantially poorer performance than models such as Opus 4.8 and Mythos 5. Scores from one evaluation, which tested models’ ability to develop exploits for vulnerabilities in the Firefox browser, are shown in the chart below. Sonnet 5 was never able to develop a full working exploit, but it does show a slightly higher rate of _partial_ success than Sonnet 4.6. This latter change is likely due to improvements in general intelligence rather than specific training.

_Scores measuring models’ success at developing exploits for software vulnerabilities in Firefox 147 (this evaluation was developed [in collaboration with Mozilla](https://www.anthropic.com/news/mozilla-firefox-security); all vulnerabilities have been patched in Firefox 148). For each model, the left-hand bar shows how often the model (without safeguards) developed a working exploit; the right-hand bar shows how often the model had partial success. Neither of the Sonnet models could successfully develop a working exploit (both scored 0.0%); Sonnet 5 showed a slightly higher partial success rate than Sonnet 4.6. Both Sonnet models have substantially poorer cyber capabilities than Opus 4.8 and Mythos 5. For full details, see Section 3.2.4 of the [Sonnet 5 System Card](https://www.anthropic.com/claude-sonnet-5-system-card)._

Since Sonnet 5 is somewhat stronger than its predecessor on these tasks, we’ve launched it with cyber safeguards enabled by default. These [safeguards](https://support.claude.com/en/articles/14604842-real-time-cyber-safeguards-on-claude)—which detect and block dangerous cyber usage in real time—are the same as those present in Claude Opus 4.7 and 4.8 (because we judged that the overall level of cybersecurity risk from Sonnet 5 was low, the safeguards are less strict than those launched with Fable 5, which block a much wider range of cybersecurity tasks).1

Our full assessment of Sonnet 5 across many safety and capability evaluations is reported in the [Claude Sonnet 5 System Card](https://www.anthropic.com/claude-sonnet-5-system-card).

## Availability and pricing

Claude Sonnet 5 is available everywhere today at an introductory price of $2 per million input tokens and $10 per million output tokens through August 31, 2026. It then moves to standard pricing at $3 per million input tokens and $15 per million output tokens.2 We’ve increased rate limits across Chat, Cowork, Claude Code, and the Claude Platform3 to accommodate the higher token usage of higher effort levels; users can select whichever level makes sense for their particular project.
