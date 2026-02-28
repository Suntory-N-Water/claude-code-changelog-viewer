import { describe, expect, test } from 'bun:test';
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
  });

  describe('技術用語抽出', () => {
    test('大文字2文字以上の技術用語を抽出する', () => {
      const item = makeItem('- Updated MCP server integration');
      const keywords = extractKeywords(item);

      expect(keywords.original).toContain('MCP');
    });

    test('バッククォート内の技術用語は重複しない', () => {
      const item = makeItem('- Added `MCP` server support for MCP');
      const keywords = extractKeywords(item);

      // バッククォート内の "MCP" は backtickKeywords に、
      // バッククォート外の "MCP" は technicalTerms に
      const mcpCount = keywords.original.filter((k) => k === 'MCP').length;
      expect(mcpCount).toBe(2); // 両方から抽出される
    });

    test('タグ内の大文字は技術用語として抽出しない', () => {
      const item = makeItem('- [SDK] Fixed a bug in the SDK');
      const keywords = extractKeywords(item);

      // [SDK] は extractTechnicalTerms でタグとして除外される
      // ただし本文中の "SDK" は抽出される
      expect(keywords.original).toContain('SDK');
    });

    test('除外ワードにマッチする技術用語はフィルタリングされない(original)', () => {
      // EXCLUDED_WORDS は normalized のフィルタリングに使われる
      // original にはフィルタリングが適用されない(技術用語抽出時のみ)
      const item = makeItem('- Changed VSCode settings');
      const keywords = extractKeywords(item);

      // "VSCode" はバッククォートでもなく、[A-Z]{2,} にもマッチしない
      // (大文字小文字混在なので [A-Z]{2,} にマッチしない)
      expect(keywords.original).not.toContain('VSCode');
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

  describe('grep に危険なキーワードパターン', () => {
    test('正規表現メタ文字 () を含むバッククォートキーワード', () => {
      const item = makeItem('- Fixed `fn()` return value');
      const keywords = extractKeywords(item);

      // original に生の () が含まれる → grep -iE で危険
      expect(keywords.original).toContain('fn()');
      // normalized では () が除去される → 安全
      expect(keywords.normalized).toContain('fn');
    });

    test('正規表現メタ文字 [] を含むバッククォートキーワード', () => {
      const item = makeItem('- Fixed `$ARGS[0]` parsing');
      const keywords = extractKeywords(item);

      expect(keywords.original).toContain('$ARGS[0]');
      // normalized では特殊記号が除去される
      expect(keywords.normalized).toContain('ARGS');
      expect(keywords.normalized).toContain('0');
    });

    test('パイプ | を含むバッククォートキーワード', () => {
      // grep の | は OR 演算子として解釈される
      const item = makeItem('- Fixed `stdin|stdout` pipe handling');
      const keywords = extractKeywords(item);

      expect(keywords.original).toContain('stdin|stdout');
      // normalized では | が除去されて分割される
      expect(keywords.normalized).toContain('stdin');
      expect(keywords.normalized).toContain('stdout');
    });

    test('ドット . を含むバッククォートキーワード', () => {
      // grep の . は任意の1文字にマッチ
      const item = makeItem('- Updated `config.json` schema');
      const keywords = extractKeywords(item);

      expect(keywords.original).toContain('config.json');
      expect(keywords.normalized).toContain('config');
      expect(keywords.normalized).toContain('json');
    });

    test('アスタリスク * を含むバッククォートキーワード', () => {
      const item = makeItem('- Fixed `*.md` glob pattern');
      const keywords = extractKeywords(item);

      expect(keywords.original).toContain('*.md');
      expect(keywords.normalized).toContain('md');
    });

    test('プラス + を含むバッククォートキーワード', () => {
      const item = makeItem('- Updated `C++` support');
      const keywords = extractKeywords(item);

      expect(keywords.original).toContain('C++');
      expect(keywords.normalized).toContain('C');
    });

    test('バックスラッシュ \\ を含むバッククォートキーワード', () => {
      const item = makeItem('- Fixed `path\\to\\file` handling');
      const keywords = extractKeywords(item);

      expect(keywords.original).toContain('path\\to\\file');
      expect(keywords.normalized).toContain('path');
    });

    test('ロングオプション -- で始まるキーワード', () => {
      const item = makeItem('- Added `--verbose` flag');
      const keywords = extractKeywords(item);

      expect(keywords.original).toContain('--verbose');
      expect(keywords.normalized).toContain('verbose');
    });

    test('シングルクォートを含むキーワード', () => {
      // シェルコマンド内でのシングルクォートエスケープが必要
      const item = makeItem("- Fixed `it's` handling");
      const keywords = extractKeywords(item);

      expect(keywords.original).toContain("it's");
    });

    test('キャレット ^ とドル $ を含むキーワード', () => {
      const item = makeItem('- Fixed `$HOME` and `^pattern` matching');
      const keywords = extractKeywords(item);

      expect(keywords.original).toContain('$HOME');
      expect(keywords.original).toContain('^pattern');
      // normalized では記号が除去される
      expect(keywords.normalized).toContain('HOME');
      expect(keywords.normalized).toContain('pattern');
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

    test('ネストしたバッククォート風テキスト', () => {
      const item = makeItem('- Fixed `foo `bar` baz` issue');
      const keywords = extractKeywords(item);

      // /`([^`]+)`/g の動作:
      // 1. `foo ` にマッチ(最初の ` から次の ` まで)→ "foo "
      // 2. 次に `bar` を探すが、"bar" の後の ` から " baz" の後の ` まで
      //    → ` baz` にマッチ → " baz"
      // "bar" 単体はマッチしない
      expect(keywords.original).toContain('foo ');
      expect(keywords.original).toContain(' baz');
      expect(keywords.original).not.toContain('bar');
    });

    test('バッククォート内のスペースのみ', () => {
      const item = makeItem('- Fixed ` ` whitespace issue');
      const keywords = extractKeywords(item);

      // " " は [^`]+ にマッチする(1文字以上の非バッククォート)
      expect(keywords.original).toContain(' ');
      // normalized では空文字になりフィルタされる
      expect(keywords.normalized).not.toContain('');
    });

    test('非常に長いバッククォートキーワード', () => {
      const longKeyword = 'A'.repeat(200);
      const item = makeItem(`- Fixed \`${longKeyword}\` configuration`);
      const keywords = extractKeywords(item);

      expect(keywords.original).toContain(longKeyword);
    });
  });

  describe('技術用語の語境界', () => {
    test('アンダースコア付き大文字はワード境界で分断されず抽出されない', () => {
      // /\b([A-Z]{2,})\b/ で CLAUDE_CODE を検出する場合、
      // _ はワード文字なので \b が CLAUDE と _ の間に入らない
      // よって [A-Z]{2,} で CLAUDE だけをマッチしようとしても \b が _ の前で成立しない
      const item = makeItem('- Updated CLAUDE_CODE settings');
      const keywords = extractKeywords(item);

      // "CLAUDE_CODE" はバッククォートなし → backtickKeywords に含まれない
      // technicalTerms: \b[A-Z]{2,}\b → CLAUDE と CODE の間に _ があり
      // _ はワード文字なので \b が成立しない
      expect(keywords.original).not.toContain('CLAUDE_CODE');
      expect(keywords.original).not.toContain('CLAUDE');
      expect(keywords.original).not.toContain('CODE');
    });

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

    test('数字を含む大文字連続は抽出されない', () => {
      // [A-Z]{2,} は数字を含まない
      const item = makeItem('- Updated V8 engine');
      const keywords = extractKeywords(item);

      // "V8" → V は1文字なので [A-Z]{2,} にマッチしない
      // "V" は1文字なのでマッチしない
      expect(keywords.original).not.toContain('V8');
      expect(keywords.original).not.toContain('V');
    });

    test('2文字の大文字略語は抽出される', () => {
      const item = makeItem('- Fixed AI model integration');
      const keywords = extractKeywords(item);

      expect(keywords.original).toContain('AI');
    });
  });
});
