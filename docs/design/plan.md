# Claude Code CHANGELOG解析・恩恵推論システム

## やりたいこと

Claude Codeの公式CHANGELOGから各変更項目を読み取り、「何が変わったか（事実）」と「これによりもたらされた恩恵（AI解釈）」を自動生成してWebサイトで表示する。

### 背景・目的
- Claude Codeは更新が頻繁で新機能が多く、何が対応されたか把握しにくい
- 公式CHANGELOGを見ても変更の恩恵がピンとこない
- 各変更がユーザーにどう役立つのかをAIが解釈・説明することで理解を促進

## 現在の課題

### 技術的な課題
1. **関連ドキュメントの検索**: CHANGELOG項目から関連する公式ドキュメントを見つける方法
2. **恩恵の推論精度**: 表面的な説明ではなく、深い洞察を得る方法
3. **コスト管理**: LLM APIコストを抑えつつ精度を維持

### 前提条件
- CHANGELOGのクロールは別システムで既に実装済み（Markdownファイルとしてローカル保存）
- 公式ドキュメントのクロールも同様に実装済み
- 実行環境: GitHub Actions
- ドキュメント規模: 約50ページ

### 参考リポジトリ・データソース
- **公式ドキュメントクロール参考**: https://github.com/oikon48/docs-tracker
  - Claude Code公式ドキュメントを4回/日で自動取得
  - llms.txt と docs_map.md から URL リストを取得
  - Markdown形式で直接保存
  - Git-based tracking で変更履歴を管理
- **CHANGELOG取得元**: https://github.com/anthropics/claude-code/tags
  - リリースタグからCHANGELOGを取得可能

## 決定事項

### 1. ドキュメント検索方式: GREP検索（RAG不要）

**理由**:
- CHANGELOG項目にはキーワードが明確（コマンド名、環境変数名など）
- 専門用語が多く表記ゆれが少ない
- ベクトル検索（RAG）を導入するコストとメリットが見合わない

**実装方針**:
```
1. CHANGELOG項目からキーワード抽出
   - バッククォート内の文字列（コマンド、変数名など）- 最優先
   - タグ（[SDK], [VSCode]など）
   - 固有名詞（大文字始まり、2語以上連続など）

   除外ワード（ブラックリスト）:
   - 動詞系: Fixed, Added, Changed, Improved, Updated, Removed
   - 汎用名詞: bug, issue, error, feature, performance, overall
   - 冠詞・接続詞: the, and, or, with, for

2. GREP検索で関連ドキュメントを特定
   grep -iE "(keyword1|keyword2|...)" docs/**/*.md

3. ヒット数でスコアリング
   - ヒット数が多いファイルを優先
   - 上位2-3件のみ本文を読み込み
   - 50件以上ヒット → キーワードが汎用的すぎるため処理スキップ

4. GREP検索失敗時の処理
   - キーワード抽出が0個 → 処理スキップ
   - 検索ヒット0件 → LLM推論を実行せず、UIに「未分析」表示

5. LLMに投げて恩恵を推論（関連ドキュメントがある場合のみ）
```

### 2. 重要度判定: 動詞ベースの自動スコアリング

CHANGELOGの動詞パターンで重要度を自動判定（LLM不要）:

- `Added` → 8点（新機能）
- `Changed` → 6点（変更）
- `Fixed` → 4点（バグ修正）
- `[Breaking]`タグ → +3点ボーナス

**効果**:
- 重要な変更に注力できる
- スコアに応じて分析の深さを変える
  - 8-10点: 詳細分析（多段階プロンプト）
  - 4-7点: 標準分析
  - 0-3点: 簡易説明

### 3. プロンプト戦略: 段階的洗練（Chain of Thought）

一発で恩恵を推論するのではなく、多段階で思考:

```
Step 1: 変更内容の分解
  「この変更は具体的に何を変えたのか？」

Step 2: 影響範囲の特定
  「この変更はどの機能・ワークフローに影響するか？」

Step 3: Before/Afterの明確化
  「変更前はどうだったか？変更後はどうなったか？」

Step 4: 恩恵の推論
  「Step 1-3を踏まえて、ユーザーにとっての恩恵は？」
```

**効果**:
- 表面的な説明から深い洞察へ
- LLMが論理的に思考するため精度向上

### 4. 関連項目のグルーピング

同じバージョン内でキーワードが重複する項目をグループ化して分析:

**グルーピング基準**:
1. **プリフィックスで事前フィルタ**（必須条件）
   - 同じプリフィックス（動詞）の項目のみグループ化対象
   - `Added` 同士、`Fixed` 同士、`Changed` 同士
   - 異なる動詞同士は絶対にグループ化しない

2. **キーワード一致判定**
   - 抽出キーワードが2個以上一致
   - かつ同じプリフィックス
   → グループ化

**例**:
```
Version 2.1.19:
✅ グループ化OK
- Added shorthand `$0`, `$1`...
- Added indexed argument syntax `$ARGUMENTS[0]`
  → "Added" + "arguments" 関連 → まとめて分析

❌ グループ化NG
- Fixed bug in arguments
- Added `$0` syntax
  → プリフィックスが異なる（Fixed vs Added）
```

**効果**:
- 「一連の改善」として説明できる
- 個別に見るより深い洞察が得られる
- バグ修正と新機能追加が混ざらない

### 5. タグベースの検索キーワード強化

CHANGELOG項目のタグ（`[SDK]`, `[VSCode]`など）を検索クエリに追加:

```
"[SDK] Added replay of queued_command"
  ↓
検索キーワード: ["SDK", "replay", "queued_command", "attachment"]
```

**効果**:
- タグがあれば検索精度向上
- タグがなくても動作（柔軟性）

## CHANGELOGフォーマット（参考）

```markdown
## [Version Number]

- Added/Fixed/Changed [description]
- [Tag] Description
  - タグ例: [SDK], [VSCode], [Windows], [IDE]
```

**特徴**:
- 粒度が細かい（1バージョンに10個以上の項目）
- 動詞で始まる（Added/Fixed/Changed）
- コマンド名や環境変数名がバッククォートで囲まれている

## 実装の流れ（概要）

```
GitHub Actionsで定期実行:

1. CHANGELOGを読み込み
2. 各項目の重要度を判定（動詞ベース）
3. 関連項目をグルーピング
4. 各項目/グループごとに:
   a. キーワード抽出（タグ活用）
   b. GREP検索で関連ドキュメント特定（スコアリング）
   c. 上位2-3件の本文を読み込み
   d. 段階的プロンプトで恩恵を推論
5. 結果をMarkdownファイルに生成
6. コミット & デプロイ
```

## 開発順序

### 1. データ取得（最優先）

#### 1-1. 公式ドキュメントのクロール

**目的**: Claude Code公式ドキュメントをMarkdown形式でローカルに保存

**参考実装**: https://github.com/oikon48/docs-tracker

**実装内容**:
- llms.txt と docs_map.md から URL リストを取得
- 各ドキュメントを Markdown 形式で取得
- `docs/` ディレクトリに保存
- Git-based tracking で変更履歴を管理

**成果物**: `docs/en/*.md` (約50ファイル)

#### 1-2. CHANGELOGのクロール

**目的**: Claude CodeのリリースタグからCHANGELOGを取得

**データソース**: https://github.com/anthropics/claude-code/tags

**実装内容**:
- GitHub API または直接クロールでタグ一覧を取得
- 各リリースのCHANGELOGを取得
- `changelogs/` ディレクトリに保存

**成果物**: `changelogs/*.md`

#### 1-3. 動作確認

**確認事項**:
- ドキュメントが正しく取得できているか
- CHANGELOGが正しく取得できているか
- ファイルフォーマットが想定通りか
- GitHub Actionsで定期実行が動作するか

---

### 2. 分析ロジックのプロトタイプ（データがある状態で実装）

**目的**: 実データで試行錯誤し、キーワード抽出・GREP検索・恩恵推論の実効性を確認

**実装内容**:
- 実際のCHANGELOG 1-2バージョン分で試作
- キーワード抽出ロジックの実装（除外ワード適用）
- GREP検索の実効性確認（ヒット率、精度）
- グルーピング判定の試作
- プロンプト戦略は実装時にスキル・ベストプラクティスを参照（未確定）

**成果物**: 生成される恩恵説明のサンプル（JSON or Markdown）

---

### 3. UI部分の構築（Astro）

**目的**: プロトタイプで生成したデータを元に表示確認しながら構築

**技術選択**: Astro

**表示内容**:
- 変更内容（事実）※常に表示
- 変更前後の比較（関連ドキュメントがある場合のみ）
  - 変更前: この機能がなかった時、どうしていたか
  - 変更後: この機能で何ができるようになったか
- 恩恵（AI解釈）（関連ドキュメントがある場合のみ）
- 重要度スコア（8-10点: 重要、4-7点: 標準、0-3点: 軽微）※常に表示
- 関連ドキュメントへのリンク（ある場合のみ）

**関連ドキュメント0件の場合の表示**:
```
[未分析]
この変更は新機能またはドキュメント未整備のため、
恩恵の推論を保留しています。
公式ドキュメント: (該当なし)
```
※変更内容（CHANGELOG原文）と重要度スコアは表示する

**ページ構成**:
- 各バージョンごとに個別ページ生成
- 変更項目を重要度順に表示
- 全バージョンの一覧ページ

**注**: タグ（[SDK], [VSCode]など）は内部処理（GREP検索）のみで使用し、UIには表示しない

---

### 4. GitHub Actions統合

**目的**: 全体パイプラインの自動化

**実装内容**:
- クロール → 分析 → デプロイの一連の流れを自動化
- 定期実行の設定

---

## 実装基盤の選択

### GitHub Copilot CLIベースでの実装

**採用技術**: GitHub Copilot CLI（スタンドアロン版）

2026年1月時点で、GitHub Copilot CLIはスタンドアロン実行可能な自律エージェントとして提供されており、以下の機能を備えています:

#### 主要機能
- ファイルシステム操作（読み込み、書き込み、編集）
- Git操作（コミット、プッシュ）
- マルチステップタスクの計画・実行
- GitHub Actions統合（公式サポート）
- マルチモデル対応（Anthropic Claude、OpenAI、Googleなど）

#### GitHub Actions統合の技術仕様
- CI/CD認証: `GITHUB_ASKPASS` 環境変数でトークン設定
- スクリプト実行: `copilot -p` フラグでプロンプトベース実行
- 自動更新: パッケージマネージャーインストール時に自動更新対応
- GitHub Codespaces: デフォルトイメージに含まれる
- Dev Container Feature: 利用可能

#### エージェント機能
- **Explore agent**: コードベース分析に特化
- **Task agent**: テスト・ビルドなどのコマンド実行
- 並列エージェント実行サポート

#### 技術的な制約
- 現在Technical Previewステータス（本番環境利用は慎重に検討が必要）
- GitHub Copilotサブスクリプション必須
- プレミアムリクエスト課金モデル（月間上限あり）

### 参考資料
- [GitHub Copilot CLI Gets Native Integration](https://blockchain.news/news/github-copilot-cli-native-integration-january-2026)
- [GitHub Copilot CLI: Architecture, Features, and Operational Protocols](https://shubh7.medium.com/github-copilot-cli-architecture-features-and-operational-protocols-f230b8b3789f)
- [Using GitHub Copilot CLI in GitHub Actions for Smart Failures](https://dev.to/vevarunsharma/injecting-ai-agents-into-cicd-using-github-copilot-cli-in-github-actions-for-smart-failures-58m8)
- [GitHub Copilot CLI: Enhanced agents, context management](https://github.blog/changelog/2026-01-14-github-copilot-cli-enhanced-agents-context-management-and-new-ways-to-install/)
- [GitHub Copilot SDK Repository](https://github.com/github/copilot-sdk)
- [Mastering GitHub Copilot CLI Guide](https://www.promptfu.com/blog/github-copilot-cli-mastery-guide/)

---

## トークン消費削減の最終決定事項（2026-01-26）

### 現状の課題

初回実装（analyze-changelogスキル）で120Kトークン消費が発生。主な原因:
- 関連ドキュメントの全文読み込み
- 多段階プロンプト（4ステップ）

### 解決策

#### 1. スニペットベースの推論

**方針**: grep結果の前後3行のみを使用

```bash
grep -A 3 -B 3 -iE "(keyword1|keyword2)" docs/**/*.md
```

**効果**: 全文読み込みを廃止し、必要最小限の情報のみを取得

#### 2. 1ステッププロンプトへの簡素化

**従来**: 変更分解 → 影響範囲 → Before/After → 恩恵（4ステップ）
**新方式**: 変更内容+スニペット → Before/After/Benefit（1ステップ）

**プロンプト構成**:
```
入力:
- CHANGELOG項目テキスト
- 関連ドキュメントのスニペット（前後3行、最大2-3ファイル）

出力:
- Before: 変更前の状況
- After: 変更後の状況
- Benefit: ユーザーへの恩恵
- Target: 対象ユーザー
```

**効果**: 推論の深さを犠牲にしつつ、大幅なトークン削減

#### 3. TypeScriptパーサー実装

**選定理由**:
- 既存のTypeScript環境を活用
- エラーハンドリングが容易
- テスト可能

**実装内容**:
- キーワード抽出ロジック
- grep実行とJSON化
- スコアリング機能（ヒット数 × コンテキストスコア）

#### 4. Copilot CLIの採用

**選定理由**:
- GitHub Actions統合が容易
- マルチモデル対応（Claude、OpenAI、Google）
- 公式サポートのCI/CD統合

**課題**:
- Technical Previewステータス（慎重に検討）
- 認証方式の調査が必要（`GITHUB_ASKPASS`、Copilotサブスクリプション）
- プレミアムリクエスト課金モデル

**代替案**: Claude API直接呼び出し（Anthropic SDKを使用）

#### 5. 品質担保戦略

**方針**: スニペットで推論が不十分な場合は「未分析」マーク

**理由**:
- 無理に推論せず安全性優先
- 後で手動レビュー可能
- トークン消費の予測可能性

**エラー対応**: リトライなし、即座に未分析マーク

#### 6. 新バージョン検出

**方針**: 既存のfetch-changelog.ymlのgit diffを流用

**実装**:
```yaml
- name: Check for changes
  id: git-check
  run: |
    git add -A
    git diff --staged --quiet || echo "changed=true" >> "$GITHUB_OUTPUT"

- name: Infer benefits
  if: steps.git-check.outputs.changed == 'true'
  run: # Copilot CLI実行
```

**効果**: シンプルで実績のある方式を活用

### トークン削減目標

| 項目 | 現在 | 目標 | 削減率 |
|------|------|------|--------|
| トークン消費 | 120K | 30-40K | 約70% |
| 1項目あたり | 約7K | 2-3K | 約65% |

**削減要因**:
- 全文読み込み廃止: 約50%削減
- 1ステッププロンプト: 約20%削減

### 実装優先順位

#### Phase 1: 基盤整備（最優先）
1. **Copilot CLI認証調査**
   - GitHub ActionsでのCopilot CLI認証方式を調査
   - Technical Previewの制約を文書化
   - 代替案（Claude API直接呼び出し）の準備

2. **スニペット取得ロジックの実装**
   - TypeScriptでgrep実行とJSON化
   - キーワード抽出ロジック（既存スキルを参考）
   - スコアリング機能

#### Phase 2: 推論ロジック実装
3. **1ステッププロンプトの設計**
   - コグニティブ・デザイン形式を維持しつつ簡素化
   - トークン目標：項目あたり2-3K

4. **プロトタイプ検証**
   - 実データ（v2.1.19など）で検証
   - トークン消費の測定
   - 推論品質の評価

#### Phase 3: CI/CD統合
5. **GitHub Actions統合**
   - fetch-changelog.ymlを拡張
   - Copilot CLI実行スクリプトの追加
   - エラーハンドリング

6. **UIへの統合**
   - 生成されたJSON（final_vX.X.X.json）をAstroで表示
   - 未分析項目の表示方法

---

## 実装完了（2026-01-26）

### Phase 1: 恩恵推論機能の実装

**実装内容**:
- ✅ GitHub Copilot SDK統合（`@github/copilot-sdk`）
- ✅ Valibotスキーマ定義（`InferenceResultSchema`を`analysis.ts`に統合、DRY原則適用）
- ✅ プロンプト分離（`src/prompts/inference-prompt.ts`）
- ✅ 推論スクリプト（`src/infer-benefits.ts`）
- ✅ GitHub Actions統合（`.github/workflows/fetch-changelog.yml`）

**技術決定**:
- モデル設定: 環境変数 `COPILOT_MODEL`（デフォルトなしで事故防止）
- タイムアウト: `120 * 1000`（2分）
- 出力形式: Before/After/Benefit（**Target削除**）
- エラーハンドリング: try-catchで一括処理、`inference_failed`マーク

**テスト結果（v2.1.19）**:
- 成功: 5/5件（100%）
- トークン削減: スニペットベース推論により目標達成
- 品質: SKILL.md準拠のコグニティブ・デザイン形式で高品質な日本語説明生成

**ファイル構成**:
```
apps/changelog-fetcher/src/
├── infer-benefits.ts           # エントリー（81行）
├── prompts/
│   └── inference-prompt.ts     # プロンプト構築（70行）
├── schemas/
│   └── analysis.ts             # スキーマ統合（inference含む）
└── utils/
    └── json-extractor.ts       # JSON抽出
```

---

## 次のタスク

### Phase 2: UI実装（Astro）

**目的**: `final_vX.X.X.json`を読み込んでWebページに表示

**実装内容**:
1. **バージョン一覧ページ**
   - `final_*.json`の一覧表示
   - 各バージョンへのリンク

2. **バージョン詳細ページ**（例: `/changelog/v2.1.19`）
   - CHANGELOG項目一覧
   - 各項目の表示:
     - 変更内容（`content`）
     - 重要度スコア（`importance_score`）
     - Before（`inference.before`）
     - After（`inference.after`）
     - Benefit（`inference.benefit`）
     - 関連ドキュメントリンク（`related_docs[]`）

3. **未分析項目の表示**
   - `analysis_status === "inference_failed"`: 「推論失敗」
   - `analysis_status === "no_docs_found"`: 「関連ドキュメント未発見」
   - `analysis_status === "sdk_only"`: 「SDK専用（一般ユーザー向けではない）」

**技術選択**: Astro + Tailwind CSS

---

## 未決定事項・今後の検討課題

- **既存バージョンの一括分析**: v2.1.19以外のバージョンも分析
- **トークン消費の最適化**: 必要に応じてHaiku 4.5に切り替え
- **グルーピングの閾値**: 実データで調整（キーワード重複度など）
- **メタデータ生成のタイミング**: git diffで変更検出時のみ実行
