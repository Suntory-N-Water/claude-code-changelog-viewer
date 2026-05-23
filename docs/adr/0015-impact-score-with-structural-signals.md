# ADR 0015: importance_score を構造的シグナル + Gemini 判定の impact_score に移行する

## Status

Proposed

## Context

このプロジェクトでは CHANGELOG の各項目に `importance_score` を付与し、サイト上の表示優先度や通知の重要度判定に使用している。

### 解決したい課題

現在の `importance_score` は prefix（Fixed / Added / Breaking 等）の固定値のみで決まる。

```ts
// apps/changelog-fetcher/src/parsers/changelog-parser.ts
const IMPORTANCE_SCORES: Record<string, number> = {
  Breaking: 9,
  Added: 8,
  Deprecated: 7,
  Changed: 6,
  // ...
};
importance_score = IMPORTANCE_SCORES[prefix] + (tags.includes('Breaking') ? 3 : 0);
```

この方式には以下の問題がある。

- **内容を見ていない**: 「Bash ツールのオプションが1つ追加された」と「全ユーザーの設定ファイルが破壊的変更される」が同じスコアになりえる
- **影響範囲が推定できない**: `settings.json` のキー変更や組み込みツールへの変更はユーザーへの影響が大きいが、現状では検出していない
- **意味的な判定ができない**: prefix は AI が推定した分類であり、実際の影響度とは独立している

### 検討した選択肢

1. **ベクトル類似度（embedding）による意味検索**
2. **構造的シグナル（完全一致）+ Gemini 判定**（採用）
3. **現状維持**（固定 prefix ベース）

### 各選択肢の評価

| 観点 | ① ベクトル類似度 | ② 構造的シグナル + Gemini | ③ 現状維持 |
|------|----------------|--------------------------|---------|
| 実装コスト | 高（embedding モデル・インフラ追加） | 中（外部 fetch + Gemini プロンプト改修） | なし |
| 精度 | 高（意味的類似）| 高（決定論的 + 意味的）| 低（内容無視） |
| 保守性 | 低（チューニング必須） | 高（ルールが明示的） | 高（固定値） |
| 追加コスト | embedding API 費用 | なし（既存 Gemini 呼び出し拡張） | なし |
| 根拠の説明可能性 | 低（類似度のみ） | 高（どのシグナルが根拠か明示） | 高（固定ルール） |

ベクトル類似度は「Before/After/Benefit テキスト」を input にする案も検討したが、これらは AI が既存知識から生成した二次情報であり、実際のドキュメント変更内容とは独立している。embedding の input として不適切と判断した。

ベクトル類似度の input として有効な「実際のドキュメント変更差分」は現状 `related_docs` スニペットとして既に Gemini へ渡している。Gemini に意味解釈を委ねるなら、あえて別途 embedding を立てる必要はない。

## Decision

**構造的シグナル（settings スキーマの完全一致・ビルトイン一覧の完全一致）を Gemini に補助情報として渡し、既存の Gemini 推論呼び出し内で `impact_score`（1〜10）を出力させる。**

### 1. 構造的シグナルの定義

CHANGELOG テキストに対して完全一致で照合し、2 種類のシグナルを生成する。

| シグナル | ソース | 内容 |
|---------|--------|------|
| `matched_settings` | `settings_*.json`（既存ローカルデータ） | 一致した設定キー名 |
| `matched_builtins` | 外部リポジトリからの取得データ | 一致したツール・コマンド・スキル・サブエージェント名 |

### 2. ビルトインデータの取得元

| データ | ソース | 対象 |
|--------|--------|------|
| ツール名・コマンド名・スキル名 | `marckrenn/claude-code-changelog`（`meta/cli-surface.md`） | `## Tools`, `## Commands → ### Names`, `## Skills` |
| サブエージェント名 | `Piebald-AI/claude-code-system-prompts`（GitHub API） | `agent-prompt-*.md` のファイル名 |

環境変数（642 件）は内部変数が多くノイズになるため対象外とする。

取得データは `apps/changelog-fetcher/builtin-data/*.json` にローカル保存し、GitHub Actions で定期更新する。

### 3. Gemini への統合

既存の推論呼び出し（`inference-prompt.ts`）に以下を追加する。

```
# 入力追加（空配列の場合は省略）
- matched_settings: ["hooks", "mcpServers"]
- matched_builtins: ["Bash", "/review"]

# 指示追加
各項目に対して impact_score（1〜10）を付与してください。
判定基準：
- 10: すべてのユーザーの既存ワークフローが壊れる
- 7〜9: 設定変更や対応が必要
- 4〜6: 影響はあるが対応不要
- 1〜3: 特定ユーザーのみ・影響軽微
matched_settings・matched_builtins・related_docs スニペットを根拠として使用すること。
```

### 4. 既存 importance_score との共存

- 既存の `importance_score`（prefix 固定値）は**残す**
- 新たに `impact_score`（Gemini 判定）を**併存**させる
- `impact_score` の精度が実運用で確認できた段階で `importance_score` を廃止する

### 5. 実装ステップ

| ステップ | 内容 | 対象ファイル |
|---------|------|------------|
| Step 1 | ビルトインデータ定期 fetch | `src/fetch-builtin-data.ts`, `fetch-builtin-data.yml` |
| Step 2 | 構造的照合ロジック統合 | `src/analyze-changelog.ts`, `packages/types` |
| Step 3 | Gemini プロンプト・スキーマ更新 | `src/prompts/inference-prompt.ts`, `src/clients/gemini-client.ts` |

## Consequences

### Positive

- CHANGELOG 項目の内容に基づいた意味的な重要度スコアが得られる
- 構造的シグナルにより Gemini の判定根拠が明示的になり、説明可能性が上がる
- 既存の Gemini 呼び出しを拡張するだけなので追加 API コストがほぼ発生しない

### Negative

- Gemini の出力が非決定論的なため、同一入力でもスコアが変わりうる
  - → 現時点では許容。`importance_score` を残すことで既存挙動へのフォールバックを維持する
- ビルトインデータが外部リポジトリに依存するため、外部の更新が遅れると照合精度が落ちる
  - → GitHub Actions で日次更新し、陳腐化を抑制する

### Risks

- 外部リポジトリ（marckrenn / Piebald-AI）が廃止・フォーマット変更された場合、fetch が失敗する
  - → 失敗時は GitHub Issue を自動作成し、手動対応する。`builtin-data/*.json` が欠損しても既存処理には影響しない設計にする

## 決めていないこと

| 項目 | 決めない理由 | いつ決めるか |
|------|------------|------------|
| `importance_score` の廃止時期 | `impact_score` の精度が実運用で未検証 | Step 3 実装後、数バージョン分の結果を確認してから判断 |
| `impact_score` をサイト表示・通知にどう組み込むか | Step 3 完了後に改めて設計が必要 | Step 3 実装完了後 |

## Notes

### 参考資料

- 実装計画: `docs/importance-score-redesign.md`
- ビルトインデータソース: [marckrenn/claude-code-changelog](https://github.com/marckrenn/claude-code-changelog)
- ビルトインデータソース: [Piebald-AI/claude-code-system-prompts](https://github.com/Piebald-AI/claude-code-system-prompts)
