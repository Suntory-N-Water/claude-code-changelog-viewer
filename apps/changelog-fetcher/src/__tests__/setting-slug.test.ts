import { describe, expect, test } from 'vitest';
import { createSettingKey } from '../domain/settings-reference/setting-key';
import { createSettingSlugFromKey } from '../domain/settings-reference/setting-slug';

describe('createSettingSlugFromKey', () => {
  test('設定キーの末尾にアンダースコアを含む場合、kebab-case の slug を返す', () => {
    const slug = createSettingSlugFromKey(
      createSettingKey('autoMode.soft_deny'),
      'settings',
    );

    expect(slug).toBe('auto-mode-soft-deny');
  });
});
