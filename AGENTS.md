pnpm workspace モノレポ / TypeScript / Astro + Cloudflare Workers

- ログ・コメント・コミットメッセージは日本語で記載する
- 明示的に求められない限り、後方互換性を維持しない
- 常に正直な発言をする
- 不明な点は推測で断言せず、Context7 MCP・Web Search・公式ドキュメント・GitHub issue 等で調査してから回答する
- 調査しても根拠が得られない場合は「わからない」と明示する

| 目的 | コマンド |
|---|---|
| 静的解析 | `pnpm run ai-check`(Stop hook で自動実行) |
| テスト | `pnpm run --filter <app> test` |

- GitHub の情報取得には `gh` コマンドを使用する
  - カレントディレクトリからの自動解決するので、特定のリポジトリを指示しない限りは`--repo`オプションは使用しない
- ライブラリの仕様は Context7 MCP サーバーを使用する
- GitHub Actions 関連ファイルを変更後は `/actions-check` で静的解析を実施する
- `lint` エラー時は `unsafe-fix` を使用してから個別に修正する
