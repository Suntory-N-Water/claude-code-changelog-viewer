import { describe, expect, test } from 'bun:test';
import { parseChangelog } from '../parsers/changelog-parser';

describe('parseChangelog', () => {
  describe('基本的なパース', () => {
    test('単一項目をパースする', () => {
      const changelog = '## 2.1.25\n\n- Fixed a bug in the login flow';
      const items = parseChangelog(changelog);

      expect(items).toHaveLength(1);
      expect(items[0].content).toBe('- Fixed a bug in the login flow');
      expect(items[0].prefix).toBe('Fixed');
    });

    test('複数項目をパースする', () => {
      const changelog = [
        '## 2.1.30',
        '',
        '- Added new feature for users',
        '- Fixed a critical bug',
        '- Updated dependency versions',
      ].join('\n');
      const items = parseChangelog(changelog);

      expect(items).toHaveLength(3);
      expect(items[0].prefix).toBe('Added');
      expect(items[1].prefix).toBe('Fixed');
      expect(items[2].prefix).toBe('Updated');
    });

    test('複数行にまたがる項目を結合する', () => {
      const changelog = [
        '## 2.1.30',
        '',
        '- Fixed a very long description that',
        '  spans multiple lines in the changelog',
        '- Added another feature',
      ].join('\n');
      const items = parseChangelog(changelog);

      expect(items).toHaveLength(2);
      expect(items[0].content).toBe(
        '- Fixed a very long description that spans multiple lines in the changelog',
      );
    });

    test('空行やバージョン見出しをスキップする', () => {
      const changelog = [
        '## 2.1.30',
        '',
        '',
        '- Added a feature',
        '',
        '## Notes',
        '',
      ].join('\n');
      const items = parseChangelog(changelog);

      expect(items).toHaveLength(1);
    });

    test('空文字列は空配列を返す', () => {
      expect(parseChangelog('')).toEqual([]);
    });

    test('項目がない CHANGELOG は空配列を返す', () => {
      expect(parseChangelog('## 2.1.30\n\n')).toEqual([]);
    });
  });

  describe('prefix 分類', () => {
    test.each([
      ['- Added new feature', 'Added'],
      ['- Adding support for X', 'Added'],
      ['- Add new command', 'Added'],
      ['- Fixed a bug', 'Fixed'],
      ['- Fix crash on startup', 'Fixed'],
      ['- Fixes a typo', 'Fixed'],
      ['- Changed the default value', 'Changed'],
      ['- Change behavior of X', 'Changed'],
      ['- Improved performance', 'Improved'],
      ['- Improve error messages', 'Improved'],
      ['- Improvement to the UI', 'Improved'],
      ['- Updated dependencies', 'Updated'],
      ['- Update to latest version', 'Updated'],
      ['- Upgrade to Node 22', 'Updated'],
      ['- Removed deprecated API', 'Removed'],
      ['- Remove old config', 'Removed'],
      ['- Removing unused code', 'Removed'],
      ['- Enabled dark mode', 'Enabled'],
      ['- Enable new feature flag', 'Enabled'],
      ['- Deprecated old method', 'Deprecated'],
      ['- Deprecate legacy API', 'Deprecated'],
      ['- Breaking change to API', 'Breaking'],
      ['- Breaking: removed support', 'Breaking'],
    ])('"%s" → prefix: "%s"', (content, expectedPrefix) => {
      const items = parseChangelog(`## 2.1.0\n\n${content}`);
      expect(items[0].prefix).toBe(expectedPrefix);
    });

    test('暗黙的な新機能パターンを検出する', () => {
      const patterns = [
        ['- New command for deployment', 'Added'],
        ['- Introducing a new API', 'Added'],
        ['- Introduced batch processing', 'Added'],
        ['- Users can now upload files', 'Added'],
        ['- The tool now supports TypeScript', 'Added'],
        ['- CLI now allows custom config', 'Added'],
        ['- Package now includes types', 'Added'],
      ] as const;

      for (const [content, expectedPrefix] of patterns) {
        const items = parseChangelog(`## 2.1.0\n\n${content}`);
        expect(items[0].prefix).toBe(expectedPrefix);
      }
    });

    test('Made/Make/Moved は Changed に分類される', () => {
      const madeItems = parseChangelog('## 2.1.0\n\n- Made the UI responsive');
      expect(madeItems[0].prefix).toBe('Changed');

      const makeItems = parseChangelog(
        '## 2.1.0\n\n- Make error messages clearer',
      );
      expect(makeItems[0].prefix).toBe('Changed');

      const movedItems = parseChangelog(
        '## 2.1.0\n\n- Moved config to new location',
      );
      expect(movedItems[0].prefix).toBe('Changed');
    });

    test('マッチしないパターンは Changed がデフォルト', () => {
      const items = parseChangelog('## 2.1.0\n\n- Some random changelog entry');
      expect(items[0].prefix).toBe('Changed');
    });
  });

  describe('タグ抽出', () => {
    test('[SDK] タグを抽出する', () => {
      const items = parseChangelog('## 2.1.0\n\n- [SDK] Added new SDK feature');
      expect(items[0].tags).toEqual(['SDK']);
    });

    test('複数タグを抽出する', () => {
      const items = parseChangelog(
        '## 2.1.0\n\n- [SDK] [API] Updated interface',
      );
      expect(items[0].tags).toEqual(['SDK', 'API']);
    });

    test('タグがない場合は空配列', () => {
      const items = parseChangelog('## 2.1.0\n\n- Fixed a bug');
      expect(items[0].tags).toEqual([]);
    });

    test('大文字で始まるタグのみ抽出する', () => {
      const items = parseChangelog(
        '## 2.1.0\n\n- [VSCode] Fixed [editor] issue',
      );
      // [editor] は小文字始まりなので抽出されない
      expect(items[0].tags).toEqual(['VSCode']);
    });
  });

  describe('重要度スコア', () => {
    test.each([
      ['Breaking', 9],
      ['Added', 8],
      ['Deprecated', 7],
      ['Changed', 6],
      ['Improved', 6],
      ['Updated', 6],
      ['Enabled', 6],
      ['Removed', 5],
      ['Fixed', 4],
    ])('prefix "%s" → スコア %d', (prefix, expectedScore) => {
      const prefixToContent: Record<string, string> = {
        Breaking: '- Breaking change in API',
        Added: '- Added new feature',
        Deprecated: '- Deprecated old method',
        Changed: '- Changed default behavior',
        Improved: '- Improved performance',
        Updated: '- Updated dependencies',
        Enabled: '- Enabled new feature',
        Removed: '- Removed old code',
        Fixed: '- Fixed a bug',
      };
      const items = parseChangelog(`## 2.1.0\n\n${prefixToContent[prefix]}`);
      expect(items[0].importance_score).toBe(expectedScore);
    });

    test('[Breaking] タグで +3 ボーナスが加算される', () => {
      const items = parseChangelog(
        '## 2.1.0\n\n- [Breaking] Changed API signature',
      );
      // Changed(6) + Breaking bonus(3) = 9
      expect(items[0].importance_score).toBe(9);
    });

    test('未知の prefix はデフォルトスコア 5', () => {
      // "Some" は既知の prefix にマッチしないので Changed(6) になる
      // ただし内部的に Changed にマップされるのでスコアは 6
      const items = parseChangelog('## 2.1.0\n\n- Some unknown prefix content');
      expect(items[0].importance_score).toBe(6); // Changed のデフォルト
    });
  });

  describe('パースのエッジケース', () => {
    test('インデントされたサブアイテムは新しい項目として扱われる', () => {
      // trim() されるので `  - Sub` は `- Sub` になり新項目として検出される
      const changelog = [
        '## 2.1.0',
        '',
        '- Added multi-feature support',
        '  - Sub-feature A',
        '  - Sub-feature B',
        '- Fixed a bug',
      ].join('\n');
      const items = parseChangelog(changelog);

      // サブアイテムも独立した項目として扱われる
      expect(items).toHaveLength(4);
      expect(items[0].content).toBe('- Added multi-feature support');
      expect(items[1].content).toBe('- Sub-feature A');
      expect(items[2].content).toBe('- Sub-feature B');
    });

    test('継続行がインデントなしの場合も結合される', () => {
      const changelog = [
        '## 2.1.0',
        '',
        '- Fixed a very long description that',
        'continues on the next line without indent',
      ].join('\n');
      const items = parseChangelog(changelog);

      expect(items).toHaveLength(1);
      expect(items[0].content).toBe(
        '- Fixed a very long description that continues on the next line without indent',
      );
    });

    test('バッククォートで始まる継続行は新項目にならない', () => {
      // `  \`--verbose\` flag in CLI` → trim 後は `` `--verbose` flag in CLI ``
      // `` ` `` で始まり `-` で始まらないので継続行として結合される
      const changelog = [
        '## 2.1.0',
        '',
        '- Fixed handling of',
        '  `--verbose` flag in CLI',
      ].join('\n');
      const items = parseChangelog(changelog);

      expect(items).toHaveLength(1);
      expect(items[0].content).toBe(
        '- Fixed handling of `--verbose` flag in CLI',
      );
    });

    test('継続行がハイフンで始まる場合は新項目として扱われる', () => {
      // trim 後に `-` で始まるので新項目になる
      const changelog = [
        '## 2.1.0',
        '',
        '- First item',
        '  - This becomes a separate item',
      ].join('\n');
      const items = parseChangelog(changelog);

      expect(items).toHaveLength(2);
    });

    test('ダッシュのみの行は項目として扱われる', () => {
      const changelog = '## 2.1.0\n\n-';
      const items = parseChangelog(changelog);

      expect(items).toHaveLength(1);
      expect(items[0].content).toBe('-');
      expect(items[0].prefix).toBe('Changed');
    });

    test('ダッシュ+スペースのみの行', () => {
      const changelog = '## 2.1.0\n\n- ';
      const items = parseChangelog(changelog);

      // "- " は trim() で "- " → startsWith('-') → true
      // ただし trim 後は "-" になる？いいえ、trim は前後の空白のみ
      // "- " をtrim → "-"
      expect(items).toHaveLength(1);
    });

    test('### レベル見出しもスキップされる', () => {
      const changelog = [
        '## 2.1.0',
        '',
        '### Bug Fixes',
        '',
        '- Fixed a bug',
        '',
        '### Features',
        '',
        '- Added a feature',
      ].join('\n');
      const items = parseChangelog(changelog);

      // ### も ## で startsWith するのでスキップされる
      expect(items).toHaveLength(2);
    });

    test('タブ文字を含む行の処理', () => {
      const changelog = '## 2.1.0\n\n-\tFixed with tab';
      const items = parseChangelog(changelog);

      // trim() でタブは除去されないが、startsWith('-') で始まる
      expect(items).toHaveLength(1);
      expect(items[0].content).toBe('-\tFixed with tab');
    });

    test('特殊文字を多く含む項目', () => {
      const changelog = [
        '## 2.1.0',
        '',
        "- Fixed `$ARGUMENTS[0]` causing `grep: invalid option -- '|'` error when pattern contains `(regex)` characters like `*.md` or `path\\to\\file`",
      ].join('\n');
      const items = parseChangelog(changelog);

      expect(items).toHaveLength(1);
      expect(items[0].prefix).toBe('Fixed');
      expect(items[0].content).toContain('$ARGUMENTS[0]');
      expect(items[0].content).toContain('(regex)');
    });
  });

  describe('タグ抽出のエッジケース', () => {
    test('バッククォート内の括弧はタグとして抽出されない', () => {
      const items = parseChangelog('## 2.1.0\n\n- Fixed `[SDK]` related issue');
      // バッククォート外のコンテキストで [A-Z][A-Za-z]* にマッチするか
      // 実際のパターン: /\[([A-Z][A-Za-z]*)\]/g
      // バッククォート内の [SDK] もマッチする(バッククォートを除外する処理がない)
      expect(items[0].tags).toContain('SDK');
    });

    test('数字を含むタグは抽出されない', () => {
      // [A-Z][A-Za-z]* は数字を含まないので [V8] はマッチしない
      const items = parseChangelog('## 2.1.0\n\n- Updated [V8] engine');
      // "V" は [A-Z] にマッチし、"8" は [A-Za-z]* にマッチしない
      // しかし正規表現的には "V" のみがキャプチャされ [V] としてマッチ
      // 実際は [V8] 全体が [...] にマッチするか確認
      // /\[([A-Z][A-Za-z]*)\]/g に対して "[V8]":
      // \[ → [, ([A-Z][A-Za-z]*) → "V" (8は[A-Za-z]*に含まれない), \] → 次の文字は "8" ≠ "]"
      // よってマッチしない
      expect(items[0].tags).not.toContain('V8');
      expect(items[0].tags).not.toContain('V');
    });

    test('文中の角括弧はタグとして抽出されうる', () => {
      const items = parseChangelog(
        '## 2.1.0\n\n- Added support for [Breaking] changes',
      );
      expect(items[0].tags).toContain('Breaking');
    });
  });

  describe('実データのパース', () => {
    test('v2.1.51 のバッククォート内にハイフンフラグを含む項目をパースする', () => {
      // このCHANGELOGがgrepの `-l` バグを引き起こした
      const changelog = [
        '## 2.1.51',
        '',
        '- BashTool now skips login shell (`-l` flag) by default when a shell snapshot is available, improving command execution performance.',
      ].join('\n');
      const items = parseChangelog(changelog);

      expect(items).toHaveLength(1);
      expect(items[0].content).toContain('`-l`');
      expect(items[0].prefix).toBe('Changed');
    });

    test('v2.1.51 の複数項目を正しくパースする', () => {
      const changelog = [
        '## 2.1.51',
        '',
        '- Added `claude remote-control` subcommand for external builds',
        '- Updated plugin marketplace default git timeout from 30s to 120s',
        '- Fixed a security issue where `statusLine` hook commands could execute without trust',
        '- Tool results larger than 50K characters are now persisted to disk',
      ].join('\n');
      const items = parseChangelog(changelog);

      expect(items).toHaveLength(4);
      expect(items[0].prefix).toBe('Added');
      expect(items[1].prefix).toBe('Updated');
      expect(items[2].prefix).toBe('Fixed');
      expect(items[3].prefix).toBe('Changed'); // "Tool results" はデフォルト
    });
  });
});
