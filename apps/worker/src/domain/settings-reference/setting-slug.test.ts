import { describe, expect, it } from 'vitest';
import { createSettingSlugFromKey } from './setting-slug';

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
