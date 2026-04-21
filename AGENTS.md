pnpm workspace モノレポ / TypeScript / Astro + Cloudflare Workers

- ログ・コメント・コミットメッセージは日本語で記載する
- 明示的に求められない限り、後方互換性を維持しない

| 目的 | コマンド |
|---|---|
| 静的解析 | `bun run ai-check`(Stop hook で自動実行) |
| テスト | `bun run --filter <app> test` |

- GitHub の情報取得には `gh` コマンドを使用する
- ライブラリの仕様は Context7 MCP サーバーを使用する
- 変更後は `/actions-check` で静的解析を実施する
- TypeScript / アプリ固有の規約は `.claude/rules/` を参照する
- `lint` エラー時は `unsafe-fix` を使用してから個別に修正する
