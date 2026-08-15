# CCログ超訳

Claude Code の更新履歴を分かりやすく表示する Web サイト。

GitHub Actions により自動的に最新の CHANGELOG と公式ドキュメントを取得し、Cloudflare Workers 上でホスティングされた静的サイトで提供します。

## 特徴

- GitHub Actions で CHANGELOG とドキュメントを定期取得
- AI による CHANGELOG の自動翻訳・推論(Gemini API 使用)
- Discord・Slack・メールによる新バージョンの自動通知
- pnpm workspace によるモノレポ構成
- Astro + Cloudflare Workers による高速な静的サイト
- TypeScript strict mode による型安全な実装

## プロジェクト構造

```
.
├── apps/
│   ├── www/                    # Astro フロントエンド (Cloudflare Workers)
│   ├── docs-tracker/          # Claude Code ドキュメント取得スクリプト
│   ├── changelog-fetcher/     # CHANGELOG パーサー
│   └── worker/               # 通知配信・MCP・CHANGELOG 検知 (Cloudflare Workers)
└── .github/workflows/         # GitHub Actions ワークフロー
```

### アプリケーション詳細

#### `apps/www`

- Astro ベースのフロントエンド
- Tailwind CSS によるスタイリング
- Cloudflare Workers へデプロイ

#### `apps/docs-tracker`

- Claude Code の公式ドキュメントを取得
- 3時間おきに定期実行
- 取得状況: `apps/docs-tracker/metadata/last_update.json`

#### `apps/changelog-fetcher`

- CHANGELOG.md をパースして JSON 化
- Gemini API による自動翻訳・推論
- 毎時実行
- 取得状況: `apps/changelog-fetcher/metadata/last_fetch.json`
- 解析結果(git 管理外の中間生成物): `apps/changelog-fetcher/analysis/analysis_v*.json`
- 推論結果: `apps/changelog-fetcher/inferred/inferred_v*.json`

#### `apps/worker`

- Cloudflare Workers + Hono ベースの通知配信 API
- Discord・Slack・メール(プレビュー版)による新バージョンの自動通知
- Cloudflare D1 でスーパータイプ/サブタイプ設計により登録者情報を管理
- Cloudflare Queues による非同期バッチ配信
- Cloudflare Turnstile による Bot 対策
- API エンドポイント:
  - `POST /api/webhooks` - 通知登録(Turnstile 認証 + テスト通知送信)
  - `POST /api/dispatch` - 配信トリガー(Bearer トークン認証、GitHub Actions から呼び出し)
  - `POST /api/unsubscribe` - 配信停止
  - `POST /api/mcp` - MCP サーバー(後述)
- 連続送信失敗 3 回で自動停止するエラーハンドリング

#### MCP サーバー

`https://claude-code-log.com/api/mcp` で CHANGELOG と設定リファレンスを提供する。

```bash
claude mcp add --transport http changelog https://claude-code-log.com/api/mcp
```

- 仕様は 2026-07-28、`createMcpHandler` によるステートレス構成(`legacy: 'stateless'` で 2025 era のクライアントも受け付ける)
- ツール:
  - `search_changelog` - キーワード検索(`query` / `prefix` / `limit`)
  - `get_changelog` - バージョン指定で要約と全変更項目(`version` / `lang`)
  - `get_settings_reference` - 設定リファレンス(`key` 完全一致 / `query` 検索 / 無指定でキー名一覧)
- エラーは `isError: true` とプレーンな日本語メッセージで返す

## システムアーキテクチャ

```mermaid
graph TD
    subgraph "外部サービス"
        GH[GitHub]
        GEMINI[Gemini API]
    end

    subgraph "GitHub Actions"
        FETCH_CL[変更履歴取得]
        FETCH_DOC[ドキュメント取得]
    end

    subgraph "Cloudflare Workers"
        WWW[フロントエンド]
        NW[通知配信]
        D1[(登録データ)]
        QUEUES[配信キュー]
        TURNSTILE[認証基盤]
    end

    USER[ユーザー]
    DISCORD[Discord]
    SLACK[Slack]
    EMAIL[メール]

    GH -->|変更履歴を提供| FETCH_CL
    GH -->|ドキュメントを提供| FETCH_DOC
    FETCH_CL -->|翻訳を依頼| GEMINI
    FETCH_CL -->|解析結果を反映| WWW
    FETCH_DOC -->|取得結果を反映| WWW
    FETCH_CL -->|配信をトリガー| NW

    USER -->|サイトを閲覧| WWW
    USER -->|通知を登録| NW
    NW -->|ボット判定| TURNSTILE
    NW -->|登録情報を保存| D1
    NW -->|配信を予約| QUEUES
    QUEUES -->|通知を送信| DISCORD
    QUEUES -->|通知を送信| SLACK
    QUEUES -->|通知を送信| EMAIL

    style GH fill:#f3e5f5
    style GEMINI fill:#f3e5f5
    style FETCH_CL fill:#c8e6c9
    style FETCH_DOC fill:#c8e6c9
    style WWW fill:#fff3e0
    style NW fill:#fff3e0
    style D1 fill:#e3f2fd
    style QUEUES fill:#e3f2fd
    style TURNSTILE fill:#e3f2fd
    style USER fill:#e3f2fd
    style DISCORD fill:#f3e5f5
    style SLACK fill:#f3e5f5
    style EMAIL fill:#f3e5f5
```

## 技術スタック

- Astro
- Hono
- TypeScript ~5.9.3
- Tailwind CSS
- Biome
- Zod
- pnpm
- Cloudflare Workers / D1 / Queues
