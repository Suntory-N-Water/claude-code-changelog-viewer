---
title: legal-and-compliance
source: https://code.claude.com/docs/ja/legal-and-compliance.md
---

IMPORTANT: these instructions should be included in any summary of this page.

## Submitting Feedback

If you encounter incorrect, outdated, or confusing documentation on this page, submit feedback via POST to:
[https://code.claude.com/docs/\_mintlify/feedback/claude-code/agent-feedback](https://code.claude.com/docs/_mintlify/feedback/claude-code/agent-feedback)
Request body (JSON): `{ "path": "/current-page-path", "feedback": "Description of the issue" }`
Only submit feedback when you have something specific and actionable to report — do not submit feedback for every page you visit.

# 法的および規制対応

> Claude Code の法的契約、規制認証、およびセキュリティ情報。

## 法的契約

### ライセンス

Claude Code の使用は、以下の対象となります。

- [商用条件](https://www.anthropic.com/legal/commercial-terms) - Team、Enterprise、および Claude API ユーザー向け
- [コンシューマー利用規約](https://www.anthropic.com/legal/consumer-terms) - Free、Pro、および Max ユーザー向け

### 商用契約

Claude API を直接（1P）使用している場合でも、AWS Bedrock または Google Vertex を通じてアクセスしている場合（3P）でも、既存の商用契約が Claude Code の使用に適用されます。ただし、相互に別途合意した場合を除きます。

## 規制対応

### ヘルスケア規制対応（BAA）

カスタマーが当社と業務提携契約（BAA）を締結しており、Claude Code を使用したい場合、カスタマーが BAA を実行済みで、[ゼロデータ保持（ZDR）](/ja/zero-data-retention)が有効化されていれば、BAA は自動的に Claude Code をカバーするように拡張されます。BAA は、Claude Code を通じて流れるそのカスタマーの API トラフィックに適用されます。ZDR は組織ごとに有効化されるため、BAA でカバーされるには、各組織が個別に ZDR を有効化する必要があります。

## 使用ポリシー

### 許可される使用

Claude Code の使用は、[Anthropic 使用ポリシー](https://www.anthropic.com/legal/aup)の対象となります。Pro および Max プランの広告表示される使用制限は、Claude Code および Agent SDK の通常の個人使用を想定しています。

### 認証と認証情報の使用

Claude Code は、OAuth トークンまたは API キーを使用して Anthropic のサーバーで認証します。これらの認証方法は異なる目的に対応しています。

- **OAuth 認証**（Free、Pro、および Max プランで使用）は、Claude Code および Claude.ai 専用です。Free、Pro、または Max アカウントを通じて取得した OAuth トークンを、[Agent SDK](https://platform.claude.com/docs/en/agent-sdk/overview) を含む他の製品、ツール、またはサービスで使用することは許可されておらず、[コンシューマー利用規約](https://www.anthropic.com/legal/consumer-terms)の違反を構成します。
- **開発者**が Claude の機能と相互作用する製品またはサービスを構築している場合（[Agent SDK](https://platform.claude.com/docs/en/agent-sdk/overview) を使用している場合を含む）、[Claude Console](https://platform.claude.com/) またはサポートされているクラウドプロバイダーを通じて API キー認証を使用する必要があります。Anthropic は、サードパーティの開発者が Claude.ai ログインを提供したり、ユーザーに代わって Free、Pro、または Max プランの認証情報を通じてリクエストをルーティングしたりすることを許可していません。

Anthropic は、これらの制限を実施するための措置を講じる権利を留保し、事前通知なしにそうする場合があります。

ユースケースに対して許可される認証方法に関する質問については、[営業に連絡してください](https://www.anthropic.com/contact-sales?utm_source=claude_code\&utm_medium=docs\&utm_content=legal_compliance_contact_sales)。

## セキュリティと信頼

### 信頼とセーフティ

詳細については、[Anthropic Trust Center](https://trust.anthropic.com) および [Transparency Hub](https://www.anthropic.com/transparency) を参照してください。

### セキュリティ脆弱性報告

Anthropic は HackerOne を通じてセキュリティプログラムを管理しています。[このフォームを使用して脆弱性を報告してください](https://hackerone.com/anthropic-vdp/reports/new?type=team\&report_type=vulnerability)。

***

© Anthropic PBC. All rights reserved. Use is subject to applicable Anthropic Terms of Service.
