import { describe, expect, test } from 'bun:test';
import type { ChangelogItem } from '@claude-code-changelog-viewer/types';
import { buildBatchInferencePrompt } from '../ai/prompts/inference-prompt';

/**
 * テスト用の ChangelogItem を生成するヘルパー
 * related_docs の件数で推論対象/翻訳のみ対象が決まるため、
 * docsCount で制御できるようにしている
 */
function makeItem(
  overrides: Partial<ChangelogItem> & { docsCount?: number } = {},
): ChangelogItem {
  const { docsCount = 0, ...rest } = overrides;

  const related_docs = Array.from({ length: docsCount }, (_, i) => ({
    file: `docs/en/doc${i}.md`,
    hit_count: 1,
    context_score: 5,
    total_score: 6,
    snippets: [`スニペット${i}`],
  }));

  return {
    content: 'Fixed a bug in the login flow',
    prefix: 'Fixed',
    importance_score: 4,
    related_docs,
    ...rest,
  };
}

describe('buildBatchInferencePrompt', () => {
  describe('推論対象と翻訳対象の振り分け', () => {
    test('related_docs が 1件以上の項目は推論セクションに含まれる', () => {
      const items = [makeItem({ docsCount: 1, content: 'Added MCP support' })];

      const prompt = buildBatchInferencePrompt(items, 'v2.1.30', '');

      expect(prompt).toContain('#### 項目 id=0');
      expect(prompt).toContain('- content: Added MCP support');
      // 推論セクションに含まれ、翻訳のみセクションには "(対象なし)" が表示される
      expect(prompt).toContain('# タスク2: 翻訳のみ');
      expect(prompt).toMatch(/## 対象項目\n\n\(対象なし\)\n\n---\n\n# タスク3/);
    });

    test('related_docs が 0件の項目は翻訳のみセクションに含まれる', () => {
      const items = [
        makeItem({ docsCount: 0, content: 'Fixed typo in README' }),
      ];

      const prompt = buildBatchInferencePrompt(items, 'v2.1.30', '');

      // 翻訳セクションに含まれる
      expect(prompt).toContain('# タスク2: 翻訳のみ');
      expect(prompt).toContain('- content: Fixed typo in README');
      // 推論セクションには "(対象なし)" が表示される
      expect(prompt).toMatch(
        /# タスク1: 推論\+翻訳[\s\S]*?## 対象項目\n\n\(対象なし\)/,
      );
    });

    test('複数項目が正しく振り分けられる', () => {
      const items = [
        makeItem({ docsCount: 2, prefix: 'Added', content: 'Added hooks' }),
        makeItem({ docsCount: 0, prefix: 'Fixed', content: 'Fixed crash' }),
        makeItem({
          docsCount: 1,
          prefix: 'Changed',
          content: 'Changed API',
        }),
      ];

      const prompt = buildBatchInferencePrompt(items, 'v2.1.30', '');

      // 推論セクションに id=0 と id=2 が含まれる(related_docs >= 1)
      expect(prompt).toContain('#### 項目 id=0');
      expect(prompt).toContain('- content: Added hooks');
      expect(prompt).toContain('#### 項目 id=2');
      expect(prompt).toContain('- content: Changed API');

      // 翻訳セクションに id=1 が含まれる(related_docs = 0)
      expect(prompt).toContain('#### 項目 id=1');
      expect(prompt).toContain('- content: Fixed crash');
    });
  });

  describe('id(インデックス)の保持', () => {
    test('元の配列インデックスが id として使われる', () => {
      const items = [
        makeItem({ docsCount: 0, content: '項目0' }),
        makeItem({ docsCount: 1, content: '項目1' }),
        makeItem({ docsCount: 0, content: '項目2' }),
        makeItem({ docsCount: 2, content: '項目3' }),
      ];

      const prompt = buildBatchInferencePrompt(items, 'v2.1.30', '');

      // 推論セクション: id=1, id=3(related_docs >= 1)
      expect(prompt).toContain('#### 項目 id=1\n- prefix:');
      expect(prompt).toContain('#### 項目 id=3\n- prefix:');
      // 翻訳セクション: id=0, id=2(related_docs < 1)
      expect(prompt).toContain('#### 項目 id=0\n- prefix:');
      expect(prompt).toContain('#### 項目 id=2\n- prefix:');
    });
  });

  describe('プロンプト構造', () => {
    test('バージョン番号がプロンプトに埋め込まれる', () => {
      const prompt = buildBatchInferencePrompt([], 'v2.1.50', '');

      expect(prompt).toContain('バージョン v2.1.50 の CHANGELOG を処理する');
    });

    test('modelContext がプロンプトに埋め込まれる', () => {
      const modelContext =
        'Claude 4.5 Sonnet (claude-sonnet-4-5-20250514) が最新モデルです';

      const prompt = buildBatchInferencePrompt([], 'v2.1.30', modelContext);

      expect(prompt).toContain(modelContext);
      expect(prompt).toContain('## Claude Code のモデル情報 (重要)');
    });

    test('サマリーセクションに全項目のリストが含まれる', () => {
      const items = [
        makeItem({ prefix: 'Added', content: 'Added new feature' }),
        makeItem({ prefix: 'Fixed', content: 'Fixed a bug' }),
      ];

      const prompt = buildBatchInferencePrompt(items, 'v2.1.30', '');

      expect(prompt).toContain('- [Added] Added new feature');
      expect(prompt).toContain('- [Fixed] Fixed a bug');
    });

    test('項目数がプロンプトに含まれる', () => {
      const items = [makeItem(), makeItem(), makeItem()];

      const prompt = buildBatchInferencePrompt(items, 'v2.1.30', '');

      expect(prompt).toContain('全 3 項目');
    });
  });

  describe('関連ドキュメントのスニペット', () => {
    test('推論対象項目のスニペットがプロンプトに含まれる', () => {
      const items = [
        makeItem({
          docsCount: 0,
          content: 'Added MCP server support',
          related_docs: [
            {
              file: 'docs/en/mcp.md',
              hit_count: 3,
              context_score: 8,
              total_score: 11,
              snippets: [
                'MCP はモデルコンテキストプロトコルです',
                '設定例: ...',
              ],
            },
            {
              file: 'docs/en/config.md',
              hit_count: 1,
              context_score: 4,
              total_score: 5,
              snippets: ['設定ファイルの書き方'],
            },
          ],
        }),
      ];

      const prompt = buildBatchInferencePrompt(items, 'v2.1.30', '');

      expect(prompt).toContain('### docs/en/mcp.md');
      expect(prompt).toContain('MCP はモデルコンテキストプロトコルです');
      expect(prompt).toContain('設定例: ...');
      expect(prompt).toContain('### docs/en/config.md');
      expect(prompt).toContain('設定ファイルの書き方');
    });
  });

  describe('機能領域タグセクション', () => {
    test('feature_areas がプロンプトに含まれる', () => {
      const items = [
        makeItem({
          content: 'Added MCP support',
          feature_areas: ['MCP', 'Settings'],
        }),
      ];

      const prompt = buildBatchInferencePrompt(items, 'v2.1.30', '');

      expect(prompt).toContain(
        'id=0, tags=[MCP, Settings], content: Added MCP support',
      );
    });

    test('feature_areas が undefined の項目は空タグとして出力される', () => {
      const items = [makeItem({ content: 'Some change' })];

      const prompt = buildBatchInferencePrompt(items, 'v2.1.30', '');

      expect(prompt).toContain('id=0, tags=[], content: Some change');
    });
  });

  describe('空入力', () => {
    test('項目が 0件のとき両セクションに "(対象なし)" が出力される', () => {
      const prompt = buildBatchInferencePrompt([], 'v2.1.30', '');

      // 推論セクションと翻訳セクションの両方に "(対象なし)" が含まれる
      const matches = prompt.match(/\(対象なし\)/g);
      expect(matches).toHaveLength(2);
    });

    test('項目が 0件でも全体構造は維持される', () => {
      const prompt = buildBatchInferencePrompt([], 'v2.1.30', '');

      expect(prompt).toContain('# タスク1: 推論+翻訳');
      expect(prompt).toContain('# タスク2: 翻訳のみ');
      expect(prompt).toContain('# タスク3: サマリー');
      expect(prompt).toContain('# タスク4: 機能領域タグの補正');
    });
  });
});
