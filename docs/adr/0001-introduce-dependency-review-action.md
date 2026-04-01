# ADR 0001: dependency-review-action の導入

## Status

Proposed

## Context

本プロジェクトは Bun workspace モノレポ構成で、npm パッケージに依存している。

### 解決したい課題

2026年3月、サプライチェーン攻撃が短期間に連続して発生した。

- **2026-03-19**: Trivy（セキュリティスキャナ）の GitHub Actions が侵害され、CI 実行時に SSH 鍵やクラウドトークンが窃取される状態になった
- **2026-03-24**: Trivy の侵害を起点に PyPI の LiteLLM にも波及し、数時間にわたり悪意あるバージョンが配布された
- **2026-03-31**: npm の axios メンテナアカウントが乗っ取られ、RAT（Remote Access Trojan）が仕込まれたバージョンが公開された

これらの攻撃は「有名・信頼済みのパッケージだから安全」という前提を崩すものであり、PR で依存関係を変更した際に既知の脆弱性を含むバージョンをマージ前に検出する仕組みが必要になった。

### 検討した選択肢

1. **actions/dependency-review-action** を導入する
2. **`bun audit`（または `npm audit`）をCIに組み込む** — ロックファイル全体をスキャンする既存アプローチ
3. **対応しない** — 現状維持

### 各選択肢の評価

| 観点 | dependency-review-action | bun audit (CI) | 対応しない |
|------|--------------------------|----------------|-----------|
| PR 差分に絞ったスキャン | ✅ PRで追加/変更された依存のみ | ❌ ロックファイル全体 | — |
| マージ前ブロック | ✅ CI 失敗でブロック可能 | ✅ 同様に可能 | ❌ |
| PR へのコメント通知 | ✅ サマリを自動コメント | ❌ ログ参照が必要 | — |
| ライセンスチェック | ✅ 対応 | ❌ 非対応 | — |
| 導入コスト | 低（YAML 数行） | 低 | — |
| GitHub Dependency Graph との連携 | ✅ 活用 | ❌ 独自スキャン | — |

## Decision

**PR で追加・変更される依存関係に既知の脆弱性が含まれる場合にマージをブロックするため、`actions/dependency-review-action` を導入する。**

### 1. ワークフロー設定

`.github/workflows/dependency-review.yml` を追加する。

```yaml
name: Dependency Review

on:
  pull_request:
    branches: [main]

permissions: {}

jobs:
  dependency-review:
    name: dependency-review
    timeout-minutes: 5
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
    steps:
      - uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6.0.2
        with:
          persist-credentials: false
      - uses: actions/dependency-review-action@2031cfc080254a8a887f58cffee85186f0e49e48 # v4.9.0
        with:
          comment-summary-in-pr: always
          fail-on-severity: moderate
```

### 2. 設定の根拠

- `fail-on-severity: moderate` — low は許容し、moderate 以上でブロック。緊急度の低いアラートノイズを減らしつつ実質的なリスクを防ぐ
- `comment-summary-in-pr: always` — 検出結果を PR コメントとして可視化し、レビュアーが脆弱性の詳細を把握できるようにする
- `pull-requests: write` — PRへのコメント投稿に必要な最小限の権限
- `permissions: {}` — ジョブレベルで必要な権限のみ付与するため、トップレベルは空にする

## Consequences

### Positive

- `moderate` 以上の脆弱性を含む依存関係変更を PR 段階でブロックできる
- スキャン結果が PR コメントに自動投稿されるため、レビュアーが状況を把握しやすい
- `bun audit` と異なり PR 差分に絞ったスキャンのため、既存の未修正脆弱性によるノイズが出ない
- ライセンスチェック機能を将来的に追加できる（`allow-licenses` / `deny-licenses` オプション）

### Negative

- GitHub の Dependency Graph および Advisory Database に依存するため、それらに登録されていない脆弱性は検出できない
  - → `bun audit` など他のスキャン手段と組み合わせることで補完できる
- `moderate` 未満の脆弱性はブロックされない
  - → 許容リスクとして受け入れる。閾値は `fail-on-severity` で変更可能

### Risks

- スキャン精度は GitHub Advisory Database の更新に依存するため、公開直後の脆弱性には対応できない可能性がある
  - → クールダウン設定（`minimumReleaseAge`）と組み合わせることで緩和を検討する

## Notes

### 参考資料

- [actions/dependency-review-action](https://github.com/actions/dependency-review-action)
- [Socket — axios npm Package Compromised](https://socket.dev/blog/axios-npm-package-compromised)
- [Kaspersky — Trojanization of Trivy, Checkmarx, and LiteLLM](https://www.kaspersky.com/blog/critical-supply-chain-attack-trivy-litellm-checkmarx-teampcp/55510/)
- [Andrew Nesbitt — Package Managers Need to Cool Down](https://nesbitt.io/2026/03/04/package-managers-need-to-cool-down.html)
