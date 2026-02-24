# インシデント: CI Doctor によるブランチ・PR 量産問題

**発生日**: 2026-02-24
**影響範囲**: リポジトリのブランチ、Issue #35、CI Doctor ワークフロー実行
**根本原因**: CI Doctor ワークフローに重複防止機構がなかった
**ステータス**: 対策済み

---

## 何が起きたか

CI Doctor ワークフロー (`ci-doctor.md`) が、**同じ原因の CI 失敗に対して毎時間ブランチと PR を新規作成し続けた。**

結果として `fix/grep-*` ブランチが **10 本**量産され、Issue #35 には同じ内容のコメントが 4 件追加された。

### タイムライン

| 時刻 (UTC) | イベント |
|-------------|----------|
| 03:09 | `changelog-auto-inference` ワークフローが失敗。Issue #35 が自動作成される |
| 04:43 | CI Doctor が初回実行。根本原因を特定し、修正 PR と `fix/grep-*` ブランチを作成 |
| 05:33 | 同じ失敗が再発。CI Doctor が **別の** `fix/grep-*` ブランチと PR を作成 |
| 06:31 〜 12:24 | 毎時間同じパターンが繰り返され、ブランチが増殖 |

最終的に 10 本のブランチが作られた:

```
fix/grep-executor-pattern-separator-af9ec9298fb33952
fix/grep-option-injection-31d84f47004f2a6b
fix/grep-option-pattern-parsing-d00ca484b51297c3
fix/grep-option-separator-e48cfbd491b5569a
fix/grep-pattern-dash-option-5e72758e0268048f
fix/grep-pattern-dash-option-9bf0a8765477c2f4
fix/grep-pattern-dash-prefix-51d11d47dcb310e7
fix/grep-pattern-option-ambiguity-01a7cc0f50639ee2
fix/grep-pattern-starting-with-dash-8652a9bf9158feae
fix/grep-pattern-starting-with-dash-86dfd2ffc4a8b272
```

---

## なぜ起きたか

### 直接原因: CI の失敗

コミット `9186b04` で導入された `grep-executor.ts` の修正に問題があった。CHANGELOG エントリ「BashTool now skips login shell (`-l` flag) by default」から抽出されたキーワード `-l` が grep のオプションフラグとして誤認識され、`grep: invalid option -- '|'` エラーが発生した。

### 根本原因: CI Doctor に重複防止機構がなかった

CI Doctor ワークフローには以下の 2 つの問題があった:

```
                CI 失敗発生 (毎時間)
                       │
                       ▼
              CI Doctor が起動
                       │
                       ▼
              根本原因を分析
                       │
                       ▼
    ┌──── 既存PRを確認する仕組みがない ────┐
    │                                       │
    ▼                                       ▼
  毎回「新しい問題」と判断           新しいブランチとPRを作成
    │                                       │
    └───────────── 繰り返し ────────────────┘
```

**問題 1: フロントマターレベルのガードがなかった**

GH-AW には `skip-if-match` という機能があり、GitHub 検索クエリにマッチがあればワークフロー自体をスキップできる。しかしこれが設定されていなかったため、**AI エージェントに到達する前に重複を検出する手段がなかった。**

**問題 2: プロンプトの重複チェック指示が不十分だった**

Markdown 本文に「既存 Issue を検索する」という指示はあったが:
- 既存 **PR** の検索指示がなかった
- 「PR が既にあればスキップ」という明確な禁止ルールがなかった
- エージェントが「修正 PR を作成する」方向に暴走しやすい構造だった

---

## 対策

### 対策 1: `skip-if-match` による事前ガード (フロントマター)

```yaml
on:
  workflow_run:
    ...
  skip-if-match: 'is:pr is:open label:ci-doctor'
```

`ci-doctor` ラベルのオープン PR が 1 つでも存在すれば、**AI エージェントが起動する前にワークフロー全体がスキップされる。** これにより:

- AI の実行コスト (Copilot プレミアムリクエスト) を節約
- ブランチの重複作成を完全に防止
- Issue へのコメント重複も防止

> 参考: [GH-AW 公式ドキュメント - skip-if-match](https://github.github.io/gh-aw/reference/triggers/#skip-if-match-condition-skip-if-match)

### 対策 2: `cache-memory` による診断結果の永続化 (フロントマター)

```yaml
tools:
  cache-memory: true
```

ラン間で `/tmp/gh-aw/cache-memory/last-diagnosis.json` に診断結果を保存する。`skip-if-match` を通過したケース (PR はないが同じ原因の場合) でも、キャッシュを参照して重複対応を防止できる。

### 対策 3: プロンプトの重複チェック強化 (Markdown 本文)

フェーズ 3 (重複チェック) を以下のように強化:

- `skip-if-match` の動作を前提として明記
- キャッシュの `root_cause` 一致で「対応済み」と判定する手順を追加
- 既存 Issue に PR リンクが含まれている場合は PR 作成をスキップする指示を追加
- 「重要な制約」セクションの冒頭に PR 重複禁止ルールを太字で明記

### 防御の多層構造

```
┌─────────────────────────────────────────────────┐
│  第1層: skip-if-match (フロントマター)           │
│  → ci-doctor ラベルのオープンPRがあれば即スキップ │
├─────────────────────────────────────────────────┤
│  第2層: cache-memory (AI 実行前に参照)           │
│  → 前回と同じ root_cause ならコメント追加のみ     │
├─────────────────────────────────────────────────┤
│  第3層: プロンプト指示 (AI 判断)                  │
│  → 既存Issue/PRを検索し、重複があればスキップ     │
├─────────────────────────────────────────────────┤
│  第4層: safe-outputs max: 1 (GH-AW ガードレール) │
│  → 1回の実行で作成できるPRは最大1つ              │
└─────────────────────────────────────────────────┘
```

---

## 教訓

1. **AI エージェントのプロンプト指示だけに頼らない** — AI は指示を「解釈」するため、確実に守るとは限らない。フロントマターの `skip-if-match` のようなインフラレベルのガードを優先する
2. **GH-AW の `safe-outputs.max: 1` は「1 回の実行で 1 つまで」** — 複数回実行されれば複数作られる。実行自体を止める `skip-if-match` と組み合わせて初めて重複防止が完成する
3. **定期実行されるワークフローは必ず冪等性を設計する** — 同じ入力に対して同じ結果を返すように、重複チェックの仕組みを複数層で組み込む

---

## 関連リンク

- [Issue #35: Changelog processing failed](https://github.com/Suntory-N-Water/claude-code-changelog-viewer/issues/35)
- [PR #37: fix: grep パターンの修正 (最終的にマージされた PR)](https://github.com/Suntory-N-Water/claude-code-changelog-viewer/pull/37)
- [原因コミット 9186b04](https://github.com/Suntory-N-Water/claude-code-changelog-viewer/commit/9186b048faa48bb16d4b4d17a8726459713a0668)
- [GH-AW skip-if-match ドキュメント](https://github.github.io/gh-aw/reference/triggers/#skip-if-match-condition-skip-if-match)
- [GH-AW cache-memory ドキュメント](https://github.github.io/gh-aw/reference/memory/)
