# UI改善タスク

## 現状の問題

### 1. バッジサイズが大きすぎる
- 重要度バッジと分析ステータスバッジが目立ちすぎて、肝心の変更内容テキストが小さすぎる
- 視覚的なヒエラルキーが逆転している

### 2. レスポンシブデザイン未対応
- モバイルやタブレットでUIが破壊される
- 特に `ChangelogItemCard.astro` の横並びレイアウト（バッジ配置）が問題

### 3. Markdown形式のテキストがそのまま表示
- 変更内容が `- Added env var \`CLAUDE_CODE_ENABLE_TASKS\`, set to \`false\` to keep the old system temporarily` のように生テキストで表示
- バッククォートがそのまま表示されMarkdown臭い
- プレフィックス（`- Added`, `- Fixed`）が見出しとして機能していない

## 修正方針

### 1. バッジサイズの縮小
**ファイル**: `apps/www/src/components/changelog/ImportanceBadge.astro`, `AnalysisStatusBadge.astro`

- `text-sm` → `text-xs`
- `px-3 py-1` → `px-2 py-0.5`
- より控えめなスタイルに変更

### 2. レスポンシブ対応
**ファイル**: `apps/www/src/components/changelog/ChangelogItemCard.astro`

現在の問題箇所:
```astro
<div class="flex items-start justify-between gap-4">
  <div class="flex-1">
    <p class="text-base text-pretty mb-3">{item.content}</p>
  </div>
  <div class="flex flex-col gap-2 items-end">
    <ImportanceBadge score={item.importance_score} />
    <AnalysisStatusBadge status={item.analysis_status} />
  </div>
</div>
```

修正案:
- モバイルでは縦並び（バッジを下に配置）
- タブレット以上で横並び
- `flex-wrap` や `md:` ブレークポイントを活用

### 3. Markdownテキストのパース・整形
**ファイル**: `apps/www/src/components/changelog/ChangelogItemCard.astro` または新規ヘルパー関数

問題:
- `item.content` に `-` プレフィックスとバッククォートが含まれる
- プレフィックス（`Added`, `Fixed`等）を視覚的に強調すべき

修正案:
1. プレフィックスを抽出して別要素で表示（バッジやラベルとして）
2. バッククォート内のテキストを `<code>` タグでラップ
3. 本文テキストをクリーンに整形

実装例:
```typescript
function parseChangelogContent(content: string) {
  // "- Added env var `CLAUDE_CODE_ENABLE_TASKS`..."
  const match = content.match(/^-\s*(\w+)\s+(.+)$/);
  if (!match) return { prefix: '', body: content };

  const [, prefix, body] = match;
  // バッククォートを<code>に変換
  const formattedBody = body.replace(/`([^`]+)`/g, '<code class="...">$1</code>');

  return { prefix, body: formattedBody };
}
```

または、プレフィックスは既に `item.prefix` に入っているので、それを活用：
```astro
<div class="mb-2">
  <span class="inline-block px-2 py-0.5 rounded text-xs font-medium bg-gray-100">
    {item.prefix}
  </span>
</div>
<p class="text-base text-pretty" set:html={formatMarkdown(item.content)} />
```

### 4. その他の調整
- カード全体のパディングを調整（`p-4` → `p-3` または `p-6`）
- テキストサイズを大きく（`text-base` → `text-lg`）
- 行間を調整（`leading-relaxed` 追加）

## 実装順序

1. バッジサイズ縮小（最速）
2. Markdownテキスト整形（重要度高）
3. レスポンシブ対応（中規模変更）
4. 全体の余白・サイズ調整

## 検証方法

- デスクトップ（1920x1080以上）
- タブレット（768px - 1024px）
- モバイル（375px - 428px）
- agent-browserでスクリーンショット撮影して確認

## 参考ファイル

- `apps/www/src/components/changelog/ChangelogItemCard.astro`
- `apps/www/src/components/changelog/ImportanceBadge.astro`
- `apps/www/src/components/changelog/AnalysisStatusBadge.astro`
- `packages/types/src/index.ts` (ヘルパー関数追加の場合)
