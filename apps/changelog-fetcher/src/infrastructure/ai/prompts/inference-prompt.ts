import type { IndexedAnalyzedEntry } from '../../../usecase/inference-batch';

type PromptItem = IndexedAnalyzedEntry;

/**
 * 一括推論・翻訳・サマリー生成プロンプトを構築
 *
 * 入力: 全 CHANGELOG 項目 + バージョン番号
 * 出力: inferred_items(推論+翻訳)/ translated_items(翻訳のみ)/ summary
 */
export function buildBatchInferencePrompt(
  indexedItems: PromptItem[],
  version: string,
  modelContext: string,
): string {
  const inferenceItems: { item: PromptItem['entry']; index: number }[] = [];
  const translationItems: { item: PromptItem['entry']; index: number }[] = [];
  for (const { entry, originalIndex } of indexedItems) {
    (entry.relatedDocs.length >= 1 ? inferenceItems : translationItems).push({
      item: entry,
      index: originalIndex,
    });
  }

  const inferenceSection = inferenceItems
    .map(({ item, index }) => {
      const snippetsText = item.relatedDocs
        .map((doc) => {
          const snippets = doc.snippets.join('\n');
          return [['### ', doc.file].join(''), snippets].join('\n');
        })
        .join('\n\n');

      return [
        ['#### 項目 id=', index].join(''),
        ['- prefix: ', item.prefix].join(''),
        ['- content: ', item.content].join(''),
        '- 関連情報:',
        snippetsText,
      ].join('\n');
    })
    .join('\n\n');

  const translationSection = translationItems
    .map(({ item, index }) =>
      [
        ['#### 項目 id=', index].join(''),
        ['- prefix: ', item.prefix].join(''),
        ['- content: ', item.content].join(''),
      ].join('\n'),
    )
    .join('\n\n');

  const allItemsText = indexedItems
    .map(({ entry }) => ['- [', entry.prefix, '] ', entry.content].join(''))
    .join('\n');

  const featureAreaItemsText = indexedItems
    .map(({ entry, originalIndex }) =>
      ['- id=', originalIndex, ', content: ', entry.content].join(''),
    )
    .join('\n');

  return [
    '# 思考のレンズ',
    '',
    '## 前提 (Premise)',
    '- Claude Code は開発者向けの AI アシスタント CLI ツールである',
    '- ユーザーは技術的な詳細よりも「自分にとって何が良くなるか」を知りたい',
    '- 変更の背景には必ず具体的な問題や不便があった',
    '- 技術文書の翻訳では、正確性と自然な日本語表現の両立が求められる',
    '',
    '## Claude Code のモデル情報 (重要)',
    modelContext,
    '',
    '## 状況 (Situation)',
    [
      'バージョン ',
      version,
      ' の CHANGELOG を処理する。全 ',
      indexedItems.length,
      ' 項目。',
    ].join(''),
    '',
    '## 目的 (Purpose)',
    '以下の3つのタスクを一度に実行する:',
    '1. **推論+翻訳** (inferred_items): 関連ドキュメントがある項目について、翻訳 + Before/After/Benefit を生成',
    '2. **翻訳のみ** (translated_items): 関連ドキュメントがない項目について、日本語翻訳のみ生成',
    '3. **サマリー** (summary): バージョン全体の日本語サマリーを生成',
    '',
    '## 動機 (Motive)',
    '単なる事実の羅列ではなく、ユーザーが「この変更で自分の作業がどう楽になるか」を直感的に理解できる説明を生成する。snippets の情報を活用し、技術的に正確で具体的な説明を心がける。',
    '',
    '---',
    '',
    '# タスク1: 推論+翻訳 (inferred_items)',
    '',
    '以下の各項目について、content_ja / before / after / benefit を生成する。',
    '',
    '## 制約',
    '- content_ja: 技術用語を適切に日本語化し、開発者にとって分かりやすい自然な日本語で翻訳する',
    '- 専門用語を使う場合は必ず文脈で意味が分かるように説明する',
    '- before / after / benefit は各2-3文で簡潔に',
    '- snippets に記載がない推測は避ける',
    '- バグ修正(prefix: "Fixed")の場合、before はバグの症状を CHANGELOG の記述から推測してよい',
    '- 機能追加(prefix: "Added", "Enabled")の場合、before は snippets から変更前の状態を推測する',
    '- id は入力値をそのまま返すこと',
    '',
    '## 対象項目',
    '',
    inferenceSection || '(対象なし)',
    '',
    '---',
    '',
    '# タスク2: 翻訳のみ (translated_items)',
    '',
    '以下の各項目について、content_ja のみを生成する。',
    '',
    '## 制約',
    '- 技術用語(CLI、API、VSCode など)はカタカナ表記またはそのまま英語を使用してよい',
    '- 1-2文程度の簡潔な翻訳にする',
    '- 原文の意味を正確に保つ',
    '- 開発者にとって分かりやすい自然な日本語表現を心がける',
    '- id は入力値をそのまま返すこと',
    '',
    '## 対象項目',
    '',
    translationSection || '(対象なし)',
    '',
    '---',
    '',
    '# タスク3: サマリー (summary)',
    '',
    ['バージョン ', version, ' の全変更項目:'].join(''),
    allItemsText,
    '',
    '## 制約',
    '- 2-3文で簡潔にまとめる',
    '- 主要な新機能、重要な改善点、注目すべきバグ修正を優先的に言及',
    '- 技術用語は適切に日本語化',
    '- 「です・ます」調で統一',
    '- **禁止**: 「このバージョンでは」「バージョン vX.X.X では」「本バージョンでは」「今回のリリースでは」などの接頭辞を一切使わない',
    '- 必ず変更内容・機能・改善点そのものから書き始める(例: 「〇〇機能が追加され…」「〇〇の問題が修正され…」)',
    '',
    '---',
    '',
    '# タスク4: 機能領域タグの付与 (feature_area_corrections)',
    '',
    '各項目のタグは空配列から始まる。内容を精査し、該当する機能領域タグを付与する。',
    '',
    '## 定義済みタグ一覧',
    '',
    '- **IDE**: VS Code・JetBrains など IDE 固有の拡張・連携機能に直接関わる変更(拡張機能の動作・インストール・アップデート・IDE 固有の UI・ステータスバー)。除外: CLI 全般の改善・キーボードショートカット・認証',
    '- **Hooks**: hooks.md / hooks-guide.md に記載されているフック機能に関わる変更(PreToolUse・PostToolUse・Notification・Stop 等のフックタイプ・フックスクリプトの実行・フック設定)。除外: MCP ツール呼び出し・スキル実行',
    '- **MCP**: mcp.md に記載されている Model Context Protocol に関わる変更(MCP サーバーの接続・設定・ツール呼び出し・リソース管理・MCP クライアントの動作)。除外: 通常の CLI ツール使用・一般的な API 呼び出し',
    '- **Skills**: skills.md に記載されているスキル機能に関わる変更(/skill コマンド・スキルの定義・実行・管理)。除外: 一般的なスラッシュコマンド・MCP ツール',
    '- **Agent Teams**: agent-teams.md に記載されているエージェントチーム・チームメイト機能に関わる変更(複数エージェントの協調・チームメイトへの委譲・並列実行の調整)。除外: 単一エージェントの動作・サブエージェント単体',
    '- **Sub-agents**: sub-agents.md に記載されているサブエージェント機能に関わる変更(Agent ツールによるサブエージェント起動・委譲・結果取得・サブエージェントの隔離)。除外: メインエージェントの動作・チームメイト機能',
    '- **Plan**: プランモード(permission-modes.md の "plan" モード)に関わる変更(Shift+Tab・/plan コマンドでの移行・読み取り専用での調査・計画の提示・承認フロー)。除外: UltraPlan(クラウドブラウザプランニング)・一般的なタスク実行',
    '- **Plugins**: plugins.md / plugins-reference.md に記載されているプラグイン機能に関わる変更(プラグインのインストール・管理・プラグイン API・マーケットプレイス)。除外: MCP サーバー・スキル・組み込みツール',
    '- **Settings**: settings.json / managed-settings.json の設定項目に直接関わる変更(settings.json のキー・スコープ設定・/config コマンド・管理者によるポリシー設定)。除外: CLAUDE.md(→ Memory)・キーボードショートカット・UI 表示・認証・モデル設定・環境変数',
    '- **Memory**: memory.md に記載されているメモリ機能に関わる変更(CLAUDE.md の読み込み・管理・メモリの保存・参照・/memory コマンド)。除外: 一般的なコンテキスト管理・会話履歴',
    '- **Permissions**: permissions.md / permission-modes.md に記載されているパーミッション・権限機能に関わる変更(ツール使用の許可・拒否・許可モード・allowlist/blocklist・承認フロー)。除外: 認証・ログイン・API キー管理',
    '',
    '## 制約',
    '- タグが付与される項目のみ返す(全項目を返す必要はない)',
    '- 1項目に複数タグを付与してよい',
    '- 該当するタグがなければその項目は返さない',
    '',
    '## 対象項目',
    '',
    featureAreaItemsText,
  ].join('\n');
}
