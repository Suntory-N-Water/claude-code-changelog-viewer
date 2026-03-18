# CLAUDE.md

Bun workspace モノレポ / TypeScript / Astro + Cloudflare Workers

- ログ・コメント・コミットメッセージは日本語で記載する
- 明示的に求められない限り、後方互換性を維持しない

<important if="you need to run commands to build, test, lint, or analyze code">

| 目的 | コマンド |
|---|---|
| 静的解析 | `bun run ai-check`(Stop hook で自動実行) |
| テスト | `bun run --filter <app> test` |
</important>

<important if="you are retrieving GitHub repository or issue information">

- GitHub の情報取得には `gh` コマンドを使用する
</important>

<important if="you need to check library specifications or API documentation">

- ライブラリの仕様は Context7 MCP サーバーを使用する
</important>

<important if="you are modifying or creating GitHub Actions workflows">

- 変更後は `/dev:actions-check` で静的解析を実施する
</important>

<important if="you are writing TypeScript or working on app-specific code">

- TypeScript / アプリ固有の規約は `.claude/rules/` を参照する
</important>
