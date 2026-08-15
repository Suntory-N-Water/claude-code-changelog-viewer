import { describe, expect, it } from 'vitest';
import type { NotificationAnalysis } from '@claude-code-changelog-viewer/types';
import { createChangelogMessage } from './discord';
import { createSlackChangelogMessage } from './slack';

// NotificationAnalysis のサブセットだけで各 notifier が出力を生成できることを保証する。
// dispatch ペイロード同梱経路では related_docs / inference / importance_score は送られないため、
// notifier がそれらを参照していないことを型レベルとランタイム両面で確認する。
const subsetAnalysis: NotificationAnalysis = {
  version: 'v1.2.3',
  summary: 'テストサマリー',
  items: [
    {
      content: 'Added feature A',
      content_ja: '機能 A を追加',
      prefix: 'Added',
    },
    { content: 'Fixed bug B', content_ja: '不具合 B を修正', prefix: 'Fixed' },
  ],
};

const options = {
  unsubscribeUrl: 'https://example.com/unsub',
  siteUrl: 'https://example.com',
};

describe('NotificationAnalysis サブセットでの notifier 出力', () => {
  it('Discord メッセージを生成できる', () => {
    const payload = createChangelogMessage(
      subsetAnalysis,
      subsetAnalysis.version,
      options,
    );
    expect(payload.content ?? '').toContain('v1.2.3');
    expect(payload.content ?? '').toContain('機能 A を追加');
  });

  it('Slack メッセージを生成できる', () => {
    const payload = createSlackChangelogMessage(
      subsetAnalysis,
      subsetAnalysis.version,
      options,
    );
    expect(payload.text).toBeTruthy();
    expect(JSON.stringify(payload)).toContain('機能 A を追加');
  });

  it('summary と content_ja が null/欠落でも生成できる', () => {
    const sparse: NotificationAnalysis = {
      version: 'v0.0.1',
      summary: null,
      items: [{ content: 'raw content', content_ja: null, prefix: 'Added' }],
    };
    expect(() =>
      createChangelogMessage(sparse, sparse.version, options),
    ).not.toThrow();
    expect(() =>
      createSlackChangelogMessage(sparse, sparse.version, options),
    ).not.toThrow();
  });
});
