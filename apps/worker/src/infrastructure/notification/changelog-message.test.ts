import type { NotificationAnalysis } from '@claude-code-changelog-viewer/types';
import { describe, expect, it } from 'vitest';
import { createChangelogMessage } from './discord';
import { createSlackChangelogMessage } from './slack';

const options = {
  unsubscribeUrl: 'https://example.com/unsubscribe',
  siteUrl: 'https://example.com',
};

const mixedAnalysis: NotificationAnalysis = {
  version: 'v1.2.3',
  summary: 'テストサマリー',
  items: [
    { content: 'Fixed bug', content_ja: '不具合を修正', prefix: 'Fixed' },
    { content: 'Added feature', content_ja: '機能を追加', prefix: 'Added' },
    { content: 'Custom change', content_ja: '独自変更', prefix: 'Custom' },
  ],
};

describe('CHANGELOG 通知メッセージ', () => {
  it('Discord 通知に複数の変更種別があるとき、既定順で日本語訳が表示されること', () => {
    const payload = createChangelogMessage(
      mixedAnalysis,
      mixedAnalysis.version,
      options,
    );

    expect(payload.content).toContain('機能を追加');
    expect(payload.content).toContain('不具合を修正');
    expect(payload.content).toContain('独自変更');
    expect(payload.content.indexOf('## ✨ 追加')).toBeLessThan(
      payload.content.indexOf('## 🔧 修正'),
    );
    expect(payload.content.indexOf('## 🔧 修正')).toBeLessThan(
      payload.content.indexOf('## Custom'),
    );
  });

  it('Slack 通知に複数の変更種別があるとき、既定順で日本語訳が表示されること', () => {
    const payload = createSlackChangelogMessage(
      mixedAnalysis,
      mixedAnalysis.version,
      options,
    );
    const sections = payload.blocks
      .filter((block) => block.type === 'section')
      .map((block) => block.text.text)
      .join('\n');

    expect(sections).toContain('機能を追加');
    expect(sections).toContain('不具合を修正');
    expect(sections).toContain('独自変更');
    expect(sections.indexOf(':sparkles: 追加')).toBeLessThan(
      sections.indexOf(':wrench: 修正'),
    );
    expect(sections.indexOf(':wrench: 修正')).toBeLessThan(
      sections.indexOf('Custom'),
    );
  });

  it('日本語要約と翻訳がないとき、既定要約と英語原文が表示されること', () => {
    const sparseAnalysis: NotificationAnalysis = {
      version: 'v0.0.1',
      summary: null,
      items: [
        { content: 'Raw changelog content', content_ja: null, prefix: 'Added' },
      ],
    };

    const discord = createChangelogMessage(
      sparseAnalysis,
      sparseAnalysis.version,
      options,
    );
    const slack = createSlackChangelogMessage(
      sparseAnalysis,
      sparseAnalysis.version,
      options,
    );
    const slackText = JSON.stringify(slack);

    expect(discord.content).toContain(
      'Claude Codeの新しいバージョンがリリースされました。',
    );
    expect(discord.content).toContain('Raw changelog content');
    expect(slackText).toContain(
      'Claude Code の新しいバージョンがリリースされました。',
    );
    expect(slackText).toContain('Raw changelog content');
  });

  it('Slack の変更種別セクションが3000文字を超えるとき、末尾を省略して上限内に収まること', () => {
    const longAnalysis: NotificationAnalysis = {
      version: 'v1.2.3',
      summary: 'テストサマリー',
      items: [{ content: 'a'.repeat(4000), content_ja: null, prefix: 'Added' }],
    };

    const payload = createSlackChangelogMessage(
      longAnalysis,
      longAnalysis.version,
      options,
    );
    const itemSection = payload.blocks.find(
      (block) =>
        block.type === 'section' && block.text.text.includes(':sparkles: 追加'),
    );

    expect(itemSection?.type).toBe('section');
    if (itemSection?.type !== 'section') {
      throw new Error('変更種別セクションがありません');
    }
    expect(itemSection.text.text).toHaveLength(3000);
    expect(itemSection.text.text).toMatch(/\.\.\.$/);
  });
});
