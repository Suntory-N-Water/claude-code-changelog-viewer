# GH-AW セキュリティ・ベストプラクティス

> Source: https://github.github.com/gh-aw/introduction/architecture/
> Source: https://github.github.com/gh-aw/reference/safe-outputs-specification/index

## セキュリティアーキテクチャ

### 多層防御 (4層)

1. **Substrate-Level** - VM・コンテナランタイム・ネットワークファイアウォール
2. **Configuration-Level** - Actions ステップ・ネットワークポリシー・MCP設定
3. **Plan-Level (Safe Outputs)** - エージェントは読み取り専用。書き込みはNDJSON経由で別ジョブが実行
4. **Compilation-Time** - JSONスキーマ検証・Action SHAピン留め・セキュリティスキャナー

### Agent Workflow Firewall (AWF)

エージェントコンテナのHTTP/HTTPSトラフィックをプロキシ経由に強制。

```yaml
sandbox: "awf"   # デフォルト。エージェントの外部通信を宣言済みドメインのみに制限
```

- MCP Gateway は常に有効で無効化不可
- `sandbox.agent: false` はファイアウォール無効化。必要な場合のみ使用

---

## 権限分離の原則

書き込み権限はAI推論と別の実行コンテキストに置く。

- エージェントは `read-only` で動作
- 操作リクエストは構造化アーティファクトとして宣言
- 別の特権ジョブがアーティファクトを検証・実行
- プロンプトインジェクション成功時も被害は読み取り操作に限定

---

## AI出力のサニタイズ (7段階)

1. **Secret Redaction** - 秘密情報の検出・除去
2. **URL Domain Filtering** - 許可外URLを `(redacted)` に置換
3. **XML Escaping** - `< > &` のエスケープ
4. **Command Neutralization** - コマンドインジェクションパターン無力化
5. **Mention Filtering** - @メンションのフィルタリング
6. **Markdown Safety** - マークダウン構造の安全化
7. **Truncation** - サイズ制限超過時の切り捨て

---

## プロンプトインジェクション対策

### 自動脅威検出

```yaml
threat-detection:
  enabled: true
  prompt: "Focus on SQL injection"  # 追加分析指示
```

検出対象: プロンプトインジェクション、シークレットリーク、悪意あるパッチ

### ロックダウンモード

公開リポジトリで `GH_AW_GITHUB_TOKEN` 設定時に自動有効化。プッシュアクセスを持つユーザーのコンテンツのみエージェントに提示。

### APIプロキシによるトークン保護

エージェントコンテナ内にはトークンが存在しない。AWFの `api-proxy` が認証を仲介。

---

## ベストプラクティス

### 権限

- デフォルトは read-only。書き込みは `safe-outputs` のみ
- `write` 権限を直接付与しない
- クロスリポジトリPATのスコープは最小化
- GitHub App の利用で自動トークン失効・細粒度パーミッション

### ネットワーク

- 最小権限: 必要なドメイン・エコシステムのみ許可
- エコシステム識別子 (`python`, `node`) を個別ドメインより優先
- `strict: true` を維持

```yaml
network:
  allowed:
    - defaults
    - python
    - node
```

### 運用

- 最小 `max` 値から開始し徐々に調整
- TrialOps パターンで隔離リポジトリにてテスト
- 低リスク出力 (コメント・レポート) から始める
- PRは自動マージされない。人間が常にレビュー・承認
- ワークフローのMarkdownをコードとして扱い、変更をレビュー

### コスト管理

- Copilot: 1実行あたり1-2プレミアムリクエスト
- Claude: Anthropicアカウントへの直接課金
- Codex: OpenAIアカウントへの直接課金
- `engine.model` でモデルを変更してコスト調整
- `cache-memory` で結果をキャッシュ
- `gh aw audit <run-id>` でトークン使用量確認

---

## トラブルシューティング

### コンパイルエラー

| エラー                            | 対処                                         |
| --------------------------------- | -------------------------------------------- |
| `frontmatter not properly closed` | `---` で正しく閉じる                         |
| `failed to parse frontmatter`     | インデントにスペース使用、特殊文字をクォート |
| フィールド名タイポ                | "Did you mean" サジェスト確認                |

```bash
gh aw compile --verbose  # 詳細エラー確認
```

### 権限エラー

- 書き込み失敗 → `safe-outputs` を使用
- Copilot License エラー → PATアカウントのCopilotサブスクリプション確認

### ネットワークエラー

- パッケージレジストリ接続失敗 → エコシステム識別子を `network.allowed` に追加
- URL が `(redacted)` → 対象ドメインを `allowed` に追加

### デバッグコマンド

```bash
gh aw logs                     # ログ確認
gh aw audit <run-id>           # コスト確認
gh aw mcp inspect <workflow>   # MCP設定確認
gh aw compile --verbose        # コンパイルデバッグ
```
