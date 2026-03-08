/**
 * 実データによる差分検知の検証テスト
 *
 * anthropics/claude-code の CHANGELOG.md の直近3コミットで実際に起きた事象:
 *   コミット1 (9c63e98): v2.1.64 追加(38項目)
 *   コミット2 (a833523): v2.1.66 追加、v2.1.64 がまるごと消えた
 *   コミット3 (0b3f7cb): v2.1.68 追加、v2.1.64 は消えたまま
 *
 * この実データを使って extractItems / items_changed / version_removed の
 * 検知が正しく動作することを検証する。
 */
import { describe, expect, test } from 'bun:test';
import { extractItems } from '../parse-changelog';

// コミット1 (9c63e98) 時点の v2.1.64 の内容(実データ)
const V2_1_64_COMMIT1 = `## 2.1.64

- Added persistent session support to \`claude server\`: connections with a \`session_key\` survive WebSocket disconnects and can be resumed across server restarts. New flags: \`--workspace\`, \`--idle-timeout\`, \`--max-sessions\`.
- Added \`claude remote-control server\` for hosting multiple concurrent sessions with worktree or same-dir isolation
- Added optional name argument to \`/remote-control\` and \`claude remote-control\` (\`/remote-control My Project\` or \`--name "My Project"\`) to set a custom session title visible in claude.ai/code
- Added Voice STT support for 10 new languages (20 total) — Russian, Polish, Turkish, Dutch, Ukrainian, Greek, Czech, Danish, Swedish, Norwegian
- Added effort level display (e.g., "with low effort") to the logo and spinner, making it easier to see which effort setting is active
- Added agent name display in terminal title when using \`claude --agent\`
- Fixed symlink bypass where writing new files through a symlinked parent directory could escape the working directory in \`acceptEdits\` mode
- Fixed multi-GB memory spike when committing with large untracked binary files in the working tree
- Fixed terminal flicker caused by animated elements at the scrollback boundary
`;

function computeDiff(localContent: string, remoteContent: string) {
  const localItems = extractItems(localContent);
  const remoteItems = extractItems(remoteContent);
  const localSet = new Set(localItems);
  const remoteSet = new Set(remoteItems);

  return {
    added: remoteItems.filter((item) => !localSet.has(item)),
    removed: localItems.filter((item) => !remoteSet.has(item)),
  };
}

describe('実データ検証: v2.1.64 の変遷', () => {
  test('コミット1 の v2.1.64 から項目を正しく抽出できる', () => {
    const items = extractItems(V2_1_64_COMMIT1);
    // 上記テストデータには9項目ある(実際は38項目だが代表的な9項目で検証)
    expect(items).toHaveLength(9);
    expect(items[0]).toStartWith('- Added persistent session support');
    expect(items[8]).toStartWith('- Fixed terminal flicker');
  });
});

describe('実データ検証: items_changed のシミュレーション', () => {
  test('v2.1.64 の項目が大部分削除された場合を items_changed として検知する', () => {
    // もし v2.1.64 がバージョンごと消えるのではなく、項目だけ減った場合のシミュレーション
    const localContent = V2_1_64_COMMIT1;
    const remoteContent = `## 2.1.64

- Added persistent session support to \`claude server\`: connections with a \`session_key\` survive WebSocket disconnects and can be resumed across server restarts. New flags: \`--workspace\`, \`--idle-timeout\`, \`--max-sessions\`.
- Fixed terminal flicker caused by animated elements at the scrollback boundary
`;

    const localItems = extractItems(localContent);
    const remoteItems = extractItems(remoteContent);
    const localSet = new Set(localItems);
    const remoteSet = new Set(remoteItems);
    const added = remoteItems.filter((item) => !localSet.has(item));
    const removed = localItems.filter((item) => !remoteSet.has(item));

    // 7項目が削除された
    expect(removed).toHaveLength(7);
    // 追加はなし
    expect(added).toEqual([]);
    // 残った2項目は差分に含まれない
    expect(removed).not.toContainEqual(
      expect.stringContaining('persistent session support'),
    );
    expect(removed).not.toContainEqual(
      expect.stringContaining('terminal flicker'),
    );
  });

  test('項目の順序だけが変わった場合は差分なしになる', () => {
    const remoteContent = `## 2.1.64

- Fixed terminal flicker caused by animated elements at the scrollback boundary
- Added agent name display in terminal title when using \`claude --agent\`
- Added effort level display (e.g., "with low effort") to the logo and spinner, making it easier to see which effort setting is active
- Added Voice STT support for 10 new languages (20 total) — Russian, Polish, Turkish, Dutch, Ukrainian, Greek, Czech, Danish, Swedish, Norwegian
- Added optional name argument to \`/remote-control\` and \`claude remote-control\` (\`/remote-control My Project\` or \`--name "My Project"\`) to set a custom session title visible in claude.ai/code
- Added \`claude remote-control server\` for hosting multiple concurrent sessions with worktree or same-dir isolation
- Added persistent session support to \`claude server\`: connections with a \`session_key\` survive WebSocket disconnects and can be resumed across server restarts. New flags: \`--workspace\`, \`--idle-timeout\`, \`--max-sessions\`.
- Fixed symlink bypass where writing new files through a symlinked parent directory could escape the working directory in \`acceptEdits\` mode
- Fixed multi-GB memory spike when committing with large untracked binary files in the working tree
`;

    const { added, removed } = computeDiff(V2_1_64_COMMIT1, remoteContent);

    expect(added).toEqual([]);
    expect(removed).toEqual([]);
  });

  test('新規項目と削除項目が同時にある場合は両方を検知する', () => {
    const remoteContent = `## 2.1.64

- Added persistent session support to \`claude server\`: connections with a \`session_key\` survive WebSocket disconnects and can be resumed across server restarts. New flags: \`--workspace\`, \`--idle-timeout\`, \`--max-sessions\`.
- Added \`claude remote-control server\` for hosting multiple concurrent sessions with worktree or same-dir isolation
- Added agent name display in terminal title when using \`claude --agent\`
- Fixed symlink bypass where writing new files through a symlinked parent directory could escape the working directory in \`acceptEdits\` mode
- Fixed terminal flicker caused by animated elements at the scrollback boundary
- Added remote MCP debugging support for session inspection
`;

    const { added, removed } = computeDiff(V2_1_64_COMMIT1, remoteContent);

    expect(added).toEqual([
      '- Added remote MCP debugging support for session inspection',
    ]);
    expect(removed).toEqual([
      '- Added optional name argument to `/remote-control` and `claude remote-control` (`/remote-control My Project` or `--name "My Project"`) to set a custom session title visible in claude.ai/code',
      '- Added Voice STT support for 10 new languages (20 total) — Russian, Polish, Turkish, Dutch, Ukrainian, Greek, Czech, Danish, Swedish, Norwegian',
      '- Added effort level display (e.g., "with low effort") to the logo and spinner, making it easier to see which effort setting is active',
      '- Fixed multi-GB memory spike when committing with large untracked binary files in the working tree',
    ]);
  });
});
