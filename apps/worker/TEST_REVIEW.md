# Worker テストレビュー

## 目的と判断基準

`apps/worker` のテストを、退行に対する保護、リファクタリングへの耐性、迅速なフィードバック、保守のしやすさの4項目で見直す。カバレッジ率そのものは目標にせず、利用者や外部システムから観察できる振る舞いと、D1・Queue・Workflow・HTTP の境界を優先する。

## 対象範囲

- 対象機能: CHANGELOG 検知、通知購読・配信、通知メッセージ、HTTP route、D1 永続化、公式ドキュメント同期、設定リファレンス、Workflow
- 対象 API / ユースケース: `apps/worker/src` の公開関数と worker entry point
- テストレベル: 純粋な状態遷移・変換は単体、route と管理下の D1・Queue の接続は統合、Cloudflare Workflow は worker pool 統合テスト
- `packages/common` は worker が利用する契約を確認したが、今回の変更対象となる不足・重複は見つからなかった

## 基準状態

- `pnpm run --filter changelog-viewer-worker test`: 31ファイル、185ケースが成功
- 実行時間: 1.42秒
- カバレッジは未保護領域を探す補助として取得。全体は statements 74.32%、branches 66.28%

## テストマップ

| 機能 | 主な観察結果 | 単体 | 統合 | 判断 |
|---|---|---|---|---|
| CHANGELOG 検知 | Workflow の起動・待機・成功確定・失敗上限 | 状態遷移を網羅 | GitHub / KV / Workflow の配線 | 3回目の実行結果を確認しない欠落を修正する |
| 通知チャンネル | 生成時の不変条件、停止・再開、失敗閾値 | 集約の境界値を追加 | 購読 route と Queue 配信で D1 状態を確認 | 統合テストに偏っていたドメイン規則を単体へ移す |
| dispatch route | 認証、入力検証、Queue 投入、Queue 障害 | 原則不要 | worker entry point から確認 | 重複する route 単体テストを削除して統合へ集約する |
| 通知メッセージ | 表示順、翻訳 fallback、プラットフォーム上限 | 純粋な出力値を確認 | notifier の送信境界は既存テストで確認 | 存在確認だけのテストを具体的な出力契約へ書き換える |
| 公式ドキュメント同期・検索 | 差分保存、削除安全性、FTS5 検索、切り詰め | 規則・抽出を確認 | D1 / FTS5 を確認 | 現状維持 |
| 推論・設定リファレンス | AI 入出力変換、バッチ、D1 保存、再試行 | 変換・検証を確認 | Workflow と D1 の接続を確認 | 現状維持 |
| ingest / site-data / MCP | 認証、永続化、公開レスポンス | 重複させない | D1 を含む公開 API を確認 | 現状維持 |

## テストケース設計

### CHANGELOG 検知の単体テスト

- 同じ内容がすでに確認済みのとき、確認済みのまま確認時刻だけ更新されること
- 最大回数で起動した Workflow が実行中のとき、完了を待つこと
- 最大回数で起動した Workflow が成功したとき、検知が確認済みになること
- 最大回数で起動した Workflow が失敗したとき、再起動せず上限到達になること

最大試行回数は「起動できる回数」の上限であり、最後に起動した Workflow の結果確認を省略する条件ではない。現在の実装は `attempts >= 3` を実行状態より先に判定するため、3回目が成功しても永久に未確認となる。先に失敗するテストを追加してから状態遷移を修正する。

### 通知チャンネル集約の単体テスト

- Discord / Slack / Email の通知先から新規作成したとき、種別・通知先・有効状態・失敗回数0が揃うこと
- 有効チャンネルの恒久失敗が閾値未満のとき、失敗回数だけが増えること
- 有効チャンネルの恒久失敗が閾値に達したとき、指定日時に system 停止されること
- 停止済みチャンネルで失敗したとき、状態が変わらないこと
- 送信成功時に失敗回数が0へ戻ること
- 停止済みチャンネルを再開したとき、有効状態かつ失敗回数0になること
- 各通知先・通知頻度が有効な形式なら受理され、不正な形式なら拒否されること

### dispatch route の統合テスト

- 正しい認証と有効な payload のとき、Queue に契約どおりのメッセージが入ること
- 認証に失敗したとき、Queue が変更されないこと
- payload が不正なとき、Queue が変更されないこと
- nullable な要約・翻訳を含む有効な payload のとき、Queue に入ること
- Queue への投入が失敗したとき、500を返すこと

### 通知メッセージの単体テスト

- 複数の変更種別が入力順に関係なく既定順で並び、日本語訳が表示されること
- 日本語要約・翻訳がないとき、既定要約と英語原文が表示されること
- Slack のセクションが上限を超えるとき、3000文字へ切り詰められること

## テストレビュー結果

### 対応必須

| ファイル | 観察事項 | 根拠（改善項目） | 対応 |
|---|---|---|---|
| `domain/changelog-detection/changelog-detection.ts` | 最大試行回数に達すると最後の Workflow の成功・実行中状態を確認できない | 退行に対する保護 | 状態遷移テストを先に追加し、結果確認後に上限を判定する |

### 主要改善

| ファイル | 観察事項 | 根拠（改善項目） | 対応 |
|---|---|---|---|
| `routes/dispatch.test.ts` | `dispatch.integration.test.ts` と認証・入力検証・Queue 投入が重複し、内部 Hono app とモック環境を別に構築している | リファクタリングへの耐性、保守のしやすさ | 削除し、公開 entry point の統合テストへ必要な境界ケースを集約する |
| `infrastructure/notification/notification-subset-coverage.test.ts` | `toBeTruthy` と `not.toThrow` が中心で、誤った本文や並び順でも成功する | 退行に対する保護 | 公開される送信 payload の具体的な内容・fallback・上限を検証するテストへ置換する |
| `domain/channel/*` | 失敗閾値、停止・再開、通知先値の規則が Queue / route 統合テストに偏っている | 迅速なフィードバック、保守のしやすさ | プロセス外依存のない集約規則を単体テストへ追加する |

### 軽微な改善

| ファイル | 現在の状態 | 根拠（改善項目） | 対応 |
|---|---|---|---|
| 変更対象の既存テスト名 | 一部が「〜する」で終わる | 保守のしやすさ | 変更するケースは「〜のとき、〜であること」へ揃える |

### 確認済み・現状維持

| テスト群 | 評価 |
|---|---|
| `cron/docs-sync.integration.test.ts`、`usecases/sync-docs.test.ts`、`domain/docs-sync/*` | D1 接続と削除安全ポリシーの責務が分かれている |
| `routes/ingest-changelog.integration.test.ts`、`routes/site-data.integration.test.ts`、`routes/mcp.integration.test.ts` | 公開 API と D1 の変換・永続化・検索を観察している |
| `routes/webhooks.integration.test.ts`、`routes/unsubscribe.integration.test.ts` | 購読の状態遷移と D1 の事後状態を確認している |
| `queue/consumer.integration.test.ts` | 通知結果、再試行、冪等性、D1 の最終状態を確認している |
| `queue/consumer.test.ts` | Queue 固有の不正メッセージ破棄と複数メッセージ処理を高速に確認している |
| `workflows/*.integration.test.ts` | Cloudflare Workflow の step 再試行と外部境界を専用 worker pool で確認している |
| `domain/changelog-inference/*`、`infrastructure/ai/*` | 純粋な推論統合と管理外 AI 境界の応答検証に分かれている |
| `infrastructure/docs-search.integration.test.ts` | ADR 0002 / 0004 の検索順位・件数・切り詰め契約を実物の FTS5 で確認している |
| `infrastructure/github/*test.ts`、`infrastructure/turnstile.test.ts` | 管理外 HTTP 境界へ渡す要求と応答変換を確認している |
| `packages/common/src/__tests__/*` | worker が利用するログコンテキストと Discord 上限の共通契約を確認している |

## 実施結果

### テスト構成の変化

- テストファイル: 31ファイルのまま
- テストケース: 185件から197件へ変更（12件増）
- `routes/dispatch.test.ts` の7件を削除し、公開 entry point を使う `dispatch.integration.test.ts` に5件を集約
- `notification-subset-coverage.test.ts` の3件を削除し、具体的な payload 契約を確認する `changelog-message.test.ts` 4件へ置換
- 通知チャンネル集約の単体テスト12件を追加
- CHANGELOG 検知の状態遷移テスト4件を追加

### 実装修正

- 最大試行回数に達した時点で `max_attempts` に固定せず、最後に起動した Workflow の状態を確認するよう判定順を変更
  - 確認済みなら `confirmed` を維持する
  - 3回目が pending なら待機する
  - 3回目が succeeded なら確認済みにする
  - 3回目が failed の場合だけ `max_attempts` にする
- `createSlackChangelogMessage` が常に返している `blocks` を必須の戻り値型として宣言し、実行時の保証と型契約を一致させた

### 検証結果

- `pnpm run --filter changelog-viewer-worker test`: 31ファイル、197ケース成功
- `pnpm run --filter changelog-viewer-worker test:coverage`: 成功
  - 全体 statements 74.32% → 75.26%、branches 66.28% → 67.52%
  - `domain/channel` statements 65.11% → 95.34%
  - `routes/dispatch.ts` statements 92.30% → 100%
- `pnpm run ai-check`: 成功（0 errors）
- `apps/www` の未使用 import 4件は既存 warning であり、今回の範囲外のため変更していない
