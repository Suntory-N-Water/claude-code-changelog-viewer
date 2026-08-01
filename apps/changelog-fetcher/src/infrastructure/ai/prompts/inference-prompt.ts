import type { IndexedAnalyzedEntry } from '../../../usecase/inference-batch';

type PromptItem = IndexedAnalyzedEntry;

/**
 * タスク1(推論+翻訳: inferred_items)のプロンプトセクションを構築する。
 *
 * 対象は relatedDocs が1件以上ある項目(inferenceItems)のみ。
 * dry-run 出力と buildBatchInferencePrompt の両方から利用する。
 */
export function buildInferenceTaskSection(indexedItems: PromptItem[]): string {
  const inferenceSection = indexedItems
    .filter(({ entry }) => entry.relatedDocs.length >= 1)
    .map(({ entry, id }) => {
      const snippetsText = entry.relatedDocs
        .map((doc) => {
          const snippets = doc.snippets.join('\n');
          return [['#### ', doc.file].join(''), snippets].join('\n');
        })
        .join('\n\n');

      return [
        ['### 項目 id=', id].join(''),
        ['- prefix: ', entry.prefix].join(''),
        ['- content: ', entry.content].join(''),
        '',
        '### 関連情報',
        snippetsText,
      ].join('\n');
    })
    .join('\n\n');

  return [
    '# タスク1: 推論+翻訳 (inferred_items)',
    '',
    '## 前提',
    '- 各項目には関連ドキュメント(snippets)が付属しており、これが推論の根拠となる',
    '- 技術用語を適切に日本語化し、開発者にとって分かりやすい自然な日本語で表現する',
    '- 専門用語を使う場合は必ず文脈で意味が分かるように説明する',
    '',
    '## 目的',
    '各項目の content_ja / before / after / benefit を生成する。',
    '',
    '## 動機',
    'ユーザーは「何が変わったか」の事実よりも「自分の作業がどう変わるか」を知りたい。',
    'before/after で変更前後の具体的な差分を	描写し、benefit で得られる恩恵を示すことで、各変更を試す価値があるか即座に判断できるようにする。',
    '',
    '## 制約',
    '- snippets に記載がない推測は避ける',
    '- バグ修正(prefix: "Fixed")は CHANGELOG の記述から症状を推測してよい',
    '- 機能追加(prefix: "Added", "Enabled")は snippets から変更前の状態を推測してよい',
    '- before / after は各2-3文で簡潔に',
    '- benefit は1文で「ユーザーが何をしなくてよくなるか / 何だけで済むようになるか」を書く(行動変化に限定)',
    '  - 良い例: 「CLAUDE.md のどこを削るか自分で判断する必要がなくなります」',
    '  - 悪い例: 「CLAUDE.md を効率的にスリム化でき、AIのパフォーマンスを維持できます」',
    '- benefit 禁止表現: 「〜が向上します」「〜を維持できます」「〜のリスクを減らせます」「〜が可能になります」「〜を確保できます」のような結果の抽象化は不可',
    '- content_ja / benefit は体言止めにしない。動詞の終止形(「〜した」「〜になる」)で終えること',
    '- id は入力値をそのまま返すこと',
    '',
    '## 対象項目',
    '',
    inferenceSection || '(対象なし)',
  ].join('\n');
}

export function buildBatchInferencePrompt(
  indexedItems: PromptItem[],
  version: string,
  options: { modelContext: string },
): string {
  const { modelContext } = options;
  const inferenceItems: { item: PromptItem['entry']; id: string }[] = [];
  const translationItems: { item: PromptItem['entry']; id: string }[] = [];
  for (const { entry, id } of indexedItems) {
    (entry.relatedDocs.length >= 1 ? inferenceItems : translationItems).push({
      item: entry,
      id,
    });
  }

  const translationSection = translationItems
    .map(({ item, id }) =>
      [
        ['### 項目 id=', id].join(''),
        ['- prefix: ', item.prefix].join(''),
        ['- content: ', item.content].join(''),
      ].join('\n'),
    )
    .join('\n\n');

  const allItemsText = indexedItems
    .map(({ entry }) => ['- [', entry.prefix, '] ', entry.content].join(''))
    .join('\n');

  const featureAreaItemsText = indexedItems
    .map(({ entry, id }) =>
      ['- id=', id, ', content: ', entry.content].join(''),
    )
    .join('\n');

  return [
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
    buildInferenceTaskSection(indexedItems),
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
    '- 2-3文で、具体的な変更を最大3件だけ取り上げる。すべての変更カテゴリを網羅しようとしない',
    '- 掲載順位は、(1) デフォルト挙動・互換性・権限・データに影響する変更、(2) 多くのユーザーが試せる新機能、(3) 作業を妨げる具体的な不具合修正、の順にする',
    '- 各文には、変更対象の固有名詞(コマンド・設定・ツール・機能名など)と、変わる挙動を必ず書く。固有名詞が書けない変更はサマリーに含めない',
    '- CHANGELOG に書かれていない効果・評価・背景を補わない。変更内容そのものを簡潔に言い換える',
    '- 技術用語は適切に日本語化',
    '- 「です・ます」調で統一',
    '- **禁止**: 「操作性」「利便性」「安定性」「信頼性」「安全性」「パフォーマンス」「堅牢性」「使いやすさ」が「向上・強化・改善された」とだけ述べる抽象的な総評',
    '- **禁止**: 「各種の不具合修正」「その他の改善」「全体的に」「より良い環境」のように、対象と挙動を示さない締めの文',
    '- **禁止**: 「このバージョンでは」「バージョン vX.X.X では」「本バージョンでは」「今回のリリースでは」などの接頭辞を一切使わない',
    '- 必ず変更内容・機能・改善点そのものから書き始める(例: 「〇〇機能が追加され…」「〇〇の問題が修正され…」)',
    '',
    '## 出力例',
    '',
    '変更項目:',
    '- [Changed] `AskUserQuestion` dialogs no longer auto-continue by default; users can opt into an idle timeout from `/config`',
    '- [Changed] Renamed the `default` permission mode to `Manual`',
    '- [Fixed] Background sessions silently stopping mid-turn after sleep/wake',
    '',
    '良いサマリー:',
    '`AskUserQuestion` はデフォルトで自動継続しなくなり、`/config` からアイドルタイムアウトを選べるようになりました。パーミッションモードの `default` は `Manual` に名称変更され、スリープ復帰後にバックグラウンドセッションが途中で停止する問題も修正されています。',
    '',
    '悪いサマリー:',
    'ユーザーへの質問ダイアログの仕様変更により操作性が向上しました。各種不具合修正によって、より堅牢で使いやすい環境を提供します。',
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
    '',
    '---',
    '',
    '# タスク5: impact 判定 (impact_items)',
    '',
    '## 動機 (Motive)',
    'この判定は、後で人間が「今週試す価値のある変更」を選ぶための判断材料になる。狙いは、文面が地味でも実際にはユーザーのワークフローを変える変更(デフォルト挙動が黙って変わる等)を浮かせること。語彙の派手さ・キーワードのマッチ数ではなく、ユーザーの日常作業への実際の影響の大きさで判断する。',
    '',
    '## 判定 (Purpose)',
    '各項目が Claude Code ユーザーにとってどれだけ試す価値・注目度があるかを、下記の原則に沿って判定する。**全項目を返す**(関連ドキュメントの有無を問わない)。',
    '',
    '## level (総合ラベル)',
    '',
    '- **high**: 多数のユーザーの日常ワークフローを変える新機能・破壊的変更、または中核ツール(Bash・Edit・権限(Permissions)・hooks・settings)の挙動変化。例: 「Bash ツールがデフォルトでサンドボックス実行になった」「権限の許可プロンプトの挙動が変わった」',
    '- **medium**: 特定機能の便利な改善・追加、条件付きで効くバグ修正。例: 「/config に新しいオプションが追加された」「特定の環境でのみ発生していたクラッシュを修正」',
    '- **low**: 軽微・限定環境・内部的・表示微修正。例: 「ログ出力のタイポを修正」「特定 OS のまれなエッジケースを修正」',
    '',
    '## default_behavior_change (boolean)',
    '',
    'opt-out 可能でも、ユーザーが何もしなければデフォルトの挙動が黙って変わるものは true。文面が地味でも重要な変更を機械的に浮かせるためのフラグ。例: 「AskUserQuestion がデフォルトで有効化された(設定で無効化は可能)」は true。純粋な新規追加・任意オプトインは false。',
    '',
    '## breaking (boolean)',
    '',
    '今すでに従来の使い方が壊れるものに限定して true(設定の削除・非互換化・API の signature 変更など)。default_behavior_change とは切り分ける: デフォルトが変わるだけで従来の使い方が壊れないものは breaking=false。',
    '',
    '## 制約',
    '- reason は日本語1文。結論(level)より先に理由を出力すること(propertyOrdering に従う)',
    '- id は入力値をそのまま返すこと',
    '- **全項目**について1件ずつ返す',
    '',
    '## 対象項目',
    '',
    'タスク4 の「対象項目」に列挙した**全項目**を対象とする。タスク4 は該当タグが付与される項目のみ返すが、タスク5 は同じ入力対象の**全項目について 1 件ずつ impact 判定を返す**こと(該当なしでも省略しない)。',
  ].join('\n');
}
