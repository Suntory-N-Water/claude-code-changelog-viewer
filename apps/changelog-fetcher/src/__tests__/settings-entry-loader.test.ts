import { rmSync } from 'node:fs';
import * as fsPromises from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, onTestFinished, test } from 'vitest';
import { parseEnvVarsMd } from '../infrastructure/settings-reference/settings-entry-loader';

const MODEL_CONFIG_FIXTURE = `# Model configuration

## Environment variables

| Environment variable | Description |
| - | - |
| \`ANTHROPIC_DEFAULT_FABLE_MODEL\` | Fable env description |
| \`CLAUDE_CODE_SUBAGENT_MODEL\` | Subagent env description |

## Customize pinned model display and capabilities

| Environment variable | Description |
| - | - |
| \`ANTHROPIC_DEFAULT_OPUS_MODEL_NAME\` | Display name for the pinned Opus model in the /model picker. Defaults to the model ID when not set |
| \`ANTHROPIC_DEFAULT_OPUS_MODEL_DESCRIPTION\` | Display description for the pinned Opus model in the /model picker. Defaults to Custom Opus model when not set |
| \`ANTHROPIC_DEFAULT_OPUS_MODEL_SUPPORTED_CAPABILITIES\` | Comma-separated list of capabilities the pinned Opus model supports |

The same _NAME, _DESCRIPTION, and _SUPPORTED_CAPABILITIES suffixes are available for ANTHROPIC_DEFAULT_SONNET_MODEL, ANTHROPIC_DEFAULT_HAIKU_MODEL, ANTHROPIC_DEFAULT_FABLE_MODEL, and ANTHROPIC_CUSTOM_MODEL_OPTION.`;

const MODEL_CONFIG_WITHOUT_TARGET_FIXTURE = `# Model configuration

## Another section

| Environment variable | Description |
| - | - |
| \`ANTHROPIC_DEFAULT_FABLE_MODEL\` | Different description |
`;

const ENV_VARS_PURE_SEE_FIXTURE = `# Environment variables

| Environment variable | Description |
| - | - |
| \`ANTHROPIC_DEFAULT_FABLE_MODEL\` | See [Model configuration](/en/model-config#environment-variables) |
| \`CLAUDE_CODE_SUBAGENT_MODEL\` | See [Model configuration](/en/model-config) |
| \`ANTHROPIC_DEFAULT_FABLE_MODEL_NAME\` | See [Model configuration](/en/model-config#customize-pinned-model-display-and-capabilities) |
| \`ANTHROPIC_DEFAULT_SONNET_MODEL_DESCRIPTION\` | See [Model configuration](/en/model-config#customize-pinned-model-display-and-capabilities) |
| \`ANTHROPIC_DEFAULT_HAIKU_MODEL_SUPPORTED_CAPABILITIES\` | See [Model configuration](/en/model-config#customize-pinned-model-display-and-capabilities) |
| \`ANTHROPIC_CUSTOM_MODEL_OPTION_SUPPORTED_CAPABILITIES\` | See [Model configuration](/en/model-config#customize-pinned-model-display-and-capabilities) |
`;

const ENV_VARS_INLINE_FIXTURE = `# Environment variables

| Environment variable | Description |
| - | - |
| \`ANTHROPIC_DEFAULT_FABLE_MODEL_NAME\` | Use this model. See [Model configuration](/en/model-config#customize-pinned-model-display-and-capabilities) |
`;

async function loadEntries(
  files: Record<string, string>,
): Promise<Awaited<ReturnType<typeof parseEnvVarsMd>>> {
  const rootDir = await fsPromises.mkdtemp(
    path.join(os.tmpdir(), 'settings-entry-loader-'),
  );
  onTestFinished(() => {
    rmSync(rootDir, { recursive: true, force: true });
  });

  for (const [relativePath, content] of Object.entries(files)) {
    const absolutePath = path.join(rootDir, relativePath);
    await fsPromises.mkdir(path.dirname(absolutePath), { recursive: true });
    await fsPromises.writeFile(absolutePath, content);
  }

  return parseEnvVarsMd(path.join(rootDir, 'env-vars.md'), rootDir);
}

function descriptionsByKey(
  entries: Awaited<ReturnType<typeof parseEnvVarsMd>>,
) {
  return new Map(
    entries.map((entry) => [String(entry.key), entry.descriptionEn]),
  );
}

describe('parseEnvVarsMd', () => {
  test('純粋な See 参照はアンカーあり・なしどちらも解決する', async () => {
    const entries = await loadEntries({
      'env-vars.md': ENV_VARS_PURE_SEE_FIXTURE,
      'model-config.md': MODEL_CONFIG_FIXTURE,
    });
    const descriptions = descriptionsByKey(entries);

    expect(descriptions.get('ANTHROPIC_DEFAULT_FABLE_MODEL')).toBe(
      'Fable env description',
    );
    expect(descriptions.get('CLAUDE_CODE_SUBAGENT_MODEL')).toBe(
      'Subagent env description',
    );
  });

  test('インライン See 参照はそのまま残る', async () => {
    const entries = await loadEntries({
      'env-vars.md': ENV_VARS_INLINE_FIXTURE,
      'model-config.md': MODEL_CONFIG_FIXTURE,
    });

    const description = entries.find(
      (entry) => String(entry.key) === 'ANTHROPIC_DEFAULT_FABLE_MODEL_NAME',
    )?.descriptionEn;

    expect(description).toBe('Use this model. See Model configuration');
  });

  test('Tier 代替ルックアップで Opus の説明を各 Tier に置き換える', async () => {
    const entries = await loadEntries({
      'env-vars.md': ENV_VARS_PURE_SEE_FIXTURE,
      'model-config.md': MODEL_CONFIG_FIXTURE,
    });
    const descriptions = descriptionsByKey(entries);

    expect(descriptions.get('ANTHROPIC_DEFAULT_FABLE_MODEL_NAME')).toBe(
      'Display name for the pinned Fable model in the /model picker. Defaults to the model ID when not set',
    );
    expect(descriptions.get('ANTHROPIC_DEFAULT_SONNET_MODEL_DESCRIPTION')).toBe(
      'Display description for the pinned Sonnet model in the /model picker. Defaults to Custom Sonnet model when not set',
    );
    expect(
      descriptions.get('ANTHROPIC_DEFAULT_HAIKU_MODEL_SUPPORTED_CAPABILITIES'),
    ).toBe(
      'Comma-separated list of capabilities the pinned Haiku model supports',
    );
    expect(
      descriptions.get('ANTHROPIC_CUSTOM_MODEL_OPTION_SUPPORTED_CAPABILITIES'),
    ).toBe(
      'Comma-separated list of capabilities the custom model option supports',
    );
  });

  test('リンク先ファイルが存在しない場合は元の説明を維持する', async () => {
    const entries = await loadEntries({
      'env-vars.md': ENV_VARS_PURE_SEE_FIXTURE,
    });

    const description = entries.find(
      (entry) => String(entry.key) === 'ANTHROPIC_DEFAULT_FABLE_MODEL',
    )?.descriptionEn;

    expect(description).toBe('See Model configuration');
  });

  test('アンカーが見つからない場合は元の説明を維持する', async () => {
    const entries = await loadEntries({
      'env-vars.md': `# Environment variables

| Environment variable | Description |
| - | - |
| \`ANTHROPIC_DEFAULT_FABLE_MODEL\` | See [Model configuration](/en/model-config#environment-variables) |
`,
      'model-config.md': MODEL_CONFIG_WITHOUT_TARGET_FIXTURE,
    });

    const description = entries.find(
      (entry) => String(entry.key) === 'ANTHROPIC_DEFAULT_FABLE_MODEL',
    )?.descriptionEn;

    expect(description).toBe('See Model configuration');
  });
});
