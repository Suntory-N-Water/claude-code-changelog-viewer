import { describe, expect, test } from 'vitest';
import { extractKeywords } from '../parsers/keyword-extractor';
import type { ParsedItem } from '../types';

function makeItem(content: string): ParsedItem {
  return {
    content,
    prefix: 'Changed',
    tags: [],
    importance_score: 6,
  };
}

describe('extractKeywords', () => {
  describe('バッククォートキーワード抽出', () => {
    test('バッククォート内のキーワードを抽出する', () => {
      const item = makeItem(
        '- Added `CLAUDE_CODE_TMPDIR` environment variable',
      );
      const keywords = extractKeywords(item);

      expect(keywords.original).toContain('CLAUDE_CODE_TMPDIR');
    });

    test('複数のバッククォートキーワードを抽出する', () => {
      const item = makeItem('- Updated `foo` and `bar` configuration options');
      const keywords = extractKeywords(item);

      expect(keywords.original).toContain('foo');
      expect(keywords.original).toContain('bar');
    });

    test('バッククォートがない場合は original が空になりうる', () => {
      const item = makeItem('- Fixed a simple bug');
      const keywords = extractKeywords(item);

      // バッククォートも技術用語もないので空
      expect(keywords.original).toEqual([]);
    });

    test('ハイフンフラグを含むバッククォートキーワードを抽出する', () => {
      // v2.1.51 でバグを引き起こしたパターン
      const item = makeItem(
        '- BashTool now skips login shell (`-l` flag) by default',
      );
      const keywords = extractKeywords(item);

      expect(keywords.original).toContain('-l');
    });

    test('バッククォート内の複数語は normalized で分解される', () => {
      const item = makeItem('- Added `plan mode` support');
      const keywords = extractKeywords(item);

      expect(keywords.normalized).toContain('plan');
      expect(keywords.normalized).toContain('mode');
    });
  });

  describe('技術用語抽出', () => {
    test('大文字2文字以上の技術用語を抽出する', () => {
      const item = makeItem('- Updated MCP server integration');
      const keywords = extractKeywords(item);

      expect(keywords.original).toContain('MCP');
    });

    test('タグ内の大文字は技術用語として抽出しない', () => {
      const item = makeItem('- [SDK] Fixed a bug in the SDK');
      const keywords = extractKeywords(item);

      // [SDK] は extractTechnicalTerms でタグとして除外される
      // ただし本文中の "SDK" は抽出される
      expect(keywords.original).toContain('SDK');
    });

    test('小文字の技術語は抽出されず大文字の技術語は抽出される', () => {
      const item = makeItem('- Updated json parser for JSON payloads');
      const keywords = extractKeywords(item);

      expect(keywords.original).toContain('JSON');
      expect(keywords.original).not.toContain('json');
    });

    test('タグだけ存在して本文に技術語がない場合はタグ語を original に含めない', () => {
      const item = makeItem('- [SDK] Added support for local development');
      const keywords = extractKeywords(item);

      expect(keywords.original).not.toContain('SDK');
    });
  });

  describe('正規化', () => {
    test('記号を除去してスペースで分割する', () => {
      const item = makeItem(
        '- Added `CLAUDE_CODE_ENABLE_TASKS` environment variable',
      );
      const keywords = extractKeywords(item);

      expect(keywords.normalized).toContain('CLAUDE');
      expect(keywords.normalized).toContain('CODE');
      expect(keywords.normalized).toContain('ENABLE');
      expect(keywords.normalized).toContain('TASKS');
    });

    test('特殊記号 $ や [] を除去する', () => {
      const item = makeItem('- Fixed handling of `$ARGUMENTS[0]`');
      const keywords = extractKeywords(item);

      expect(keywords.normalized).toContain('ARGUMENTS');
      expect(keywords.normalized).toContain('0');
    });

    test('スラッシュコマンドの / を除去する', () => {
      const item = makeItem('- Added `/rename` command');
      const keywords = extractKeywords(item);

      expect(keywords.normalized).toContain('rename');
    });

    test('除外ワードが normalized からフィルタリングされる', () => {
      const item = makeItem('- Added `error` handling for the system');
      const keywords = extractKeywords(item);

      // "error" は EXCLUDED_WORDS に含まれる
      expect(keywords.normalized).not.toContain('error');
    });

    test('除外ワードが大文字小文字違いの場合の扱いを固定する', () => {
      const item = makeItem('- Updated `ADDED` marker handling');
      const keywords = extractKeywords(item);

      expect(keywords.normalized).toContain('ADDED');
    });

    test('接続詞が除外される', () => {
      const item = makeItem('- Fixed `with_for_to` utility');
      const keywords = extractKeywords(item);

      // "with", "for", "to" は除外ワード
      expect(keywords.normalized).not.toContain('with');
      expect(keywords.normalized).not.toContain('for');
      expect(keywords.normalized).not.toContain('to');
    });
  });

  describe('実データのケース', () => {
    test('v2.1.51 の `-l` フラグを含む項目', () => {
      const item = makeItem(
        '- BashTool now skips login shell (`-l` flag) by default when a shell snapshot is available, improving command execution performance.',
      );
      const keywords = extractKeywords(item);

      // `-l` がバッククォートキーワードとして抽出される
      expect(keywords.original).toContain('-l');
      // 正規化後は "l" のみ(ハイフンが除去される)
      expect(keywords.normalized).toContain('l');
    });

    test('環境変数を含む項目', () => {
      const item = makeItem(
        '- Added `CLAUDE_CODE_ACCOUNT_UUID`, `CLAUDE_CODE_USER_EMAIL`, and `CLAUDE_CODE_ORGANIZATION_UUID` environment variables',
      );
      const keywords = extractKeywords(item);

      expect(keywords.original).toContain('CLAUDE_CODE_ACCOUNT_UUID');
      expect(keywords.original).toContain('CLAUDE_CODE_USER_EMAIL');
      expect(keywords.original).toContain('CLAUDE_CODE_ORGANIZATION_UUID');
    });

    test('URL を含む項目', () => {
      const item = makeItem(
        '- Managed settings can now be set via macOS plist. Learn more at https://code.claude.com/docs/en/settings',
      );
      const keywords = extractKeywords(item);

      // "can now" パターンは prefix 検出に使われるが、ここでは content として渡される
      // 技術用語として抽出されるもの
      expect(keywords.original).toEqual([]); // バッククォートも大文字連続語もない
    });
  });

  describe('バッククォート境界ケース', () => {
    test('空のバッククォートは抽出しない', () => {
      // パターン /`([^`]+)`/ は [^`]+ で1文字以上を要求
      const item = makeItem('- Fixed `` empty backtick');
      const keywords = extractKeywords(item);

      // 空のバッククォートは [^`]+ にマッチしない
      expect(keywords.original.filter((k) => k === '')).toHaveLength(0);
    });

    test('同じキーワードがバッククォートと本文の両方にある場合は重複を保持する', () => {
      const item = makeItem('- Updated `JSON` parsing for JSON responses');
      const keywords = extractKeywords(item);

      expect(
        keywords.original.filter((keyword) => keyword === 'JSON'),
      ).toHaveLength(2);
    });
  });

  describe('技術用語の語境界', () => {
    test('ハイフン区切りの大文字は個別に抽出される', () => {
      // ハイフンはワード文字ではないので \b が成立する
      const item = makeItem('- Updated API-SDK integration');
      const keywords = extractKeywords(item);

      expect(keywords.original).toContain('API');
      expect(keywords.original).toContain('SDK');
    });

    test('括弧の直後の大文字は抽出される', () => {
      const item = makeItem('- Fixed (MCP) server crash');
      const keywords = extractKeywords(item);

      // () はワード文字ではないので \b が成立
      expect(keywords.original).toContain('MCP');
    });

    test('2文字の大文字略語は抽出される', () => {
      const item = makeItem('- Fixed AI model integration');
      const keywords = extractKeywords(item);

      expect(keywords.original).toContain('AI');
    });

    test('数字だけのキーワードが normalized に残る', () => {
      const item = makeItem('- Fixed handling of `$ARGUMENTS[0]`');
      const keywords = extractKeywords(item);

      expect(keywords.normalized).toContain('0');
    });
  });
});
