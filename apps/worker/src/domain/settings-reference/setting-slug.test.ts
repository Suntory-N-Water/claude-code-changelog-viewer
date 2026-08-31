import { describe, expect, it } from 'vitest';
import { createSettingSlugFromKey, resolveSettingSlugs } from './setting-slug';

describe('設定リファレンスの slug', () => {
  it('settings のネストした camelCase キーを kebab-case に変換すること', () => {
    const result = createSettingSlugFromKey('autoMode.soft_deny', 'settings');

    expect(result).toBe('auto-mode-soft-deny');
  });

  it('環境変数の大文字とアンダースコアを小文字のハイフンに変換すること', () => {
    const result = createSettingSlugFromKey('CLAUDE_CODE_USE_BEDROCK', 'env');

    expect(result).toBe('claude-code-use-bedrock');
  });
});

describe('設定リファレンスの slug の衝突解消', () => {
  it('衝突がないとき、キーから作った slug をそのまま返すこと', () => {
    const result = resolveSettingSlugs([
      { key: 'permissions', source: 'settings' },
      { key: 'permissions.allow', source: 'settings' },
      { key: 'CLAUDE_CODE_USE_BEDROCK', source: 'env' },
    ]);

    expect(result).toEqual(
      new Map([
        ['permissions', 'permissions'],
        ['permissions.allow', 'permissions-allow'],
        ['CLAUDE_CODE_USE_BEDROCK', 'claude-code-use-bedrock'],
      ]),
    );
  });

  it('区切り文字の違いだけで衝突するとき、ドットを持つキーの slug を分けること', () => {
    const result = resolveSettingSlugs([
      { key: 'voiceEnabled', source: 'settings' },
      { key: 'voice.enabled', source: 'settings' },
    ]);

    expect(result).toEqual(
      new Map([
        ['voiceEnabled', 'voice-enabled'],
        ['voice.enabled', 'voice--enabled'],
      ]),
    );
  });

  it('ドットの位置だけが違うキーが衝突するとき、ドットの位置が slug に残ること', () => {
    const result = resolveSettingSlugs([
      { key: 'voice.enabledNow', source: 'settings' },
      { key: 'voice.enabled.now', source: 'settings' },
    ]);

    expect(result).toEqual(
      new Map([
        ['voice.enabledNow', 'voice--enabled-now'],
        ['voice.enabled.now', 'voice--enabled--now'],
      ]),
    );
  });

  it('ドットを分けても衝突が残るとき、後から現れたキーに連番を付けること', () => {
    const result = resolveSettingSlugs([
      { key: 'voice.enabled', source: 'settings' },
      { key: 'voiceEnabled', source: 'settings' },
      { key: 'VOICE_ENABLED', source: 'env' },
    ]);

    expect(result).toEqual(
      new Map([
        ['voice.enabled', 'voice--enabled'],
        ['voiceEnabled', 'voice-enabled'],
        ['VOICE_ENABLED', 'voice-enabled-2'],
      ]),
    );
  });
});
