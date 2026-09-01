import { describe, expect, it } from 'vitest';
import {
  chunkMarkdown,
  flattenSettingSchema,
  mergeDocumentLists,
  parseEnvVarsMd,
  parsePublicEnvEntriesFromDocs,
  parseSettingsReferenceMd,
} from './content';
import type { SettingSchemaEntry } from './content';

describe('ドキュメント同期用のコンテンツ処理', () => {
  it('コードフェンス内の見出しをチャンク境界にしないこと', () => {
    const chunks = chunkMarkdown(
      '# Overview\n\n```bash\n# command option\n```\n\n## Details\n\n本文',
    );

    expect(chunks.map((chunk) => chunk.heading)).toEqual([
      'Overview',
      'Details',
    ]);
    expect(chunks[0]?.text).toContain('# command option');
  });

  it('見出し配下の長い本文を段落境界で分割すること', () => {
    const paragraph = '本文 '.repeat(500).trim();
    const content = `## Section\n\n${[paragraph, paragraph, paragraph].join('\n\n')}`;

    const chunks = chunkMarkdown(content);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.heading === 'Section')).toBe(true);
    expect(chunks[0]?.startLine).toBe(1);
    expect(chunks[1]?.startLine).toBeGreaterThan(1);
  });

  it('設定スキーマをオブジェクト自身と配下の設定項目・環境変数に展開すること', () => {
    const entries = flattenSettingSchema({
      properties: {
        $schema: { type: 'string' },
        permissions: {
          type: 'object',
          description: 'Permission settings',
          properties: {
            allow: {
              type: 'array',
              description: 'Allowed tools',
              default: [],
              enum: ['Read', 'Write'],
            },
          },
        },
        env: {
          type: 'object',
          description: 'Environment variables',
          properties: {
            CLAUDE_CODE_TEST: {
              type: 'string',
              description: 'Test environment variable',
            },
          },
        },
      },
    });

    expect(entries).toEqual([
      {
        key: 'permissions',
        source: 'settings',
        description: 'Permission settings',
        parentDescriptions: '[]',
        valueType: 'object',
        defaultValue: null,
        enumValues: null,
        scope: null,
        example: null,
      },
      {
        key: 'permissions.allow',
        source: 'settings',
        description: 'Allowed tools',
        parentDescriptions: JSON.stringify(['Permission settings']),
        valueType: 'array',
        defaultValue: '[]',
        enumValues: JSON.stringify(['Read', 'Write']),
        scope: null,
        example: null,
      },
      {
        key: 'env',
        source: 'settings',
        description: 'Environment variables',
        parentDescriptions: '[]',
        valueType: 'object',
        defaultValue: null,
        enumValues: null,
        scope: null,
        example: null,
      },
      {
        key: 'CLAUDE_CODE_TEST',
        source: 'env',
        description: 'Test environment variable',
        parentDescriptions: '[]',
        valueType: 'string',
        defaultValue: null,
        enumValues: null,
        scope: null,
        example: null,
      },
    ]);
  });

  it('オブジェクトが入れ子のとき、途中のオブジェクトもエントリにすること', () => {
    const entries = flattenSettingSchema({
      properties: {
        sandbox: {
          type: 'object',
          description: 'Sandbox settings',
          properties: {
            network: {
              type: 'object',
              description: 'Network isolation',
              properties: {
                tlsTerminate: {
                  type: 'object',
                  description: 'TLS termination',
                  properties: {
                    enabled: { type: 'boolean', description: 'Enable' },
                  },
                },
              },
            },
          },
        },
      },
    });

    expect(entries.map((entry) => entry.key)).toEqual([
      'sandbox',
      'sandbox.network',
      'sandbox.network.tlsTerminate',
      'sandbox.network.tlsTerminate.enabled',
    ]);
    expect(entries.at(-1)?.parentDescriptions).toBe(
      JSON.stringify([
        'Sandbox settings',
        'Network isolation',
        'TLS termination',
      ]),
    );
  });

  it.each([
    ['要素が文字列', { type: 'string' }, 'string[]'],
    ['要素が配列', { type: 'array', items: { type: 'number' } }, 'number[][]'],
    ['要素の型が複数', { type: ['string', 'number'] }, 'array'],
    ['要素の指定がない', undefined, 'array'],
  ])(
    '配列の設定項目で %s のとき、書ける値が分かる型を返すこと',
    (_label, items, expected) => {
      const entries = flattenSettingSchema({
        properties: {
          allow: { type: 'array', ...(items === undefined ? {} : { items }) },
        },
      });

      expect(entries[0]?.valueType).toBe(expected);
    },
  );

  it('env-vars.md の環境変数テーブルを抽出すること', () => {
    const entries = parseEnvVarsMd(`
| Environment variable | Description |
| - | - |
| \`CLAUDE_CODE_TABLE_TEST\` | Table description |
`);

    expect(entries).toMatchObject([
      {
        key: 'CLAUDE_CODE_TABLE_TEST',
        source: 'env',
        description: 'Table description',
      },
    ]);
  });

  it('env-vars.md の純粋な See 参照をページ本文から解決すること', () => {
    const entries = parseEnvVarsMd(
      `
| Environment variable | Description |
| - | - |
| \`CLAUDE_CODE_SEE_TEST\` | See [Configuration](/en/configuration#environment-variables) |
`,
      new Map([
        [
          'configuration.md',
          `# Configuration

## Environment variables

| Environment variable | Description |
| - | - |
| \`CLAUDE_CODE_SEE_TEST\` | Resolved description |
`,
        ],
      ]),
    );

    expect(entries[0]?.description).toBe('Resolved description');
  });

  it('docs 本文中の公開環境変数の言及を抽出すること', () => {
    const entries = parsePublicEnvEntriesFromDocs(
      new Map([
        [
          'guide.md',
          'Claude Code reads `CLAUDE_CODE_MENTION_TEST` from the environment.',
        ],
        ['env-vars.md', 'Claude Code reads `CLAUDE_CODE_EXCLUDED`'],
      ]),
    );

    expect(entries).toMatchObject([
      {
        key: 'CLAUDE_CODE_MENTION_TEST',
        source: 'env',
        description: expect.stringContaining('CLAUDE_CODE_MENTION_TEST'),
      },
    ]);
    expect(entries.some((entry) => entry.key === 'CLAUDE_CODE_EXCLUDED')).toBe(
      false,
    );
  });

  it('llms.txt のパスを優先し、changelog.md を除外すること', () => {
    const documents = mergeDocumentLists(
      [
        {
          title: 'Guide from map',
          url: 'https://code.claude.com/docs/en/guide.md',
          path: 'guide.md',
        },
        {
          title: 'Changelog',
          url: 'https://code.claude.com/docs/en/changelog.md',
          path: 'changelog.md',
        },
      ],
      [
        {
          title: 'guide',
          url: 'https://code.claude.com/docs/en/reference/guide.md',
          path: 'reference/guide.md',
        },
      ],
    );

    expect(documents).toEqual([
      {
        title: 'Guide from map',
        url: 'https://code.claude.com/docs/en/reference/guide.md',
        path: 'reference/guide.md',
      },
    ]);
  });
});

describe('公式の設定リファレンスの解析', () => {
  const section = (
    key: string,
    overrides: Partial<SettingSchemaEntry> = {},
  ): SettingSchemaEntry => ({
    key,
    source: 'settings',
    description: '',
    parentDescriptions: '[]',
    valueType: '',
    defaultValue: null,
    enumValues: null,
    scope: null,
    example: null,
    ...overrides,
  });

  it('セクションから、キー・説明・型・既定値・選択肢・記述場所・記述例を取り出すこと', () => {
    const markdown = [
      '# Claude Code settings reference',
      '',
      '### `autoUpdatesChannel`',
      '',
      'Choose which release channel auto-updates follow.',
      '',
      'A second paragraph that repeats the guidance.',
      '',
      '- **Scope**: [`Any file`](#scopes). Set it in managed settings to enforce one channel.',
      '- **Type**: string, one of:',
      '  - `"latest"`: every release',
      '  - `"stable"`: releases that have been out for a week',
      '- **Default**: `"latest"`',
      '',
      '```json settings.json theme={null}',
      '{',
      '  "autoUpdatesChannel": "stable"',
      '}',
      '```',
      '',
      'Claude Code writes `"stable"` to your user settings.',
    ].join('\n');

    expect(parseSettingsReferenceMd(markdown)).toEqual([
      section('autoUpdatesChannel', {
        description: 'Choose which release channel auto-updates follow.',
        valueType: 'string',
        defaultValue: '"latest"',
        enumValues: '["latest","stable"]',
        scope: 'Any file',
        example: '{\n  "autoUpdatesChannel": "stable"\n}',
      }),
    ]);
  });

  it('ドット付きのキーと、複数のセクションを扱うこと', () => {
    const markdown = [
      '### `permissions.allow`',
      '',
      '- **Scope**: [`User or managed`](#scopes).',
      '',
      '```json settings.json theme={null}',
      '{ "permissions": { "allow": ["Read"] } }',
      '```',
      '',
      '## See also',
      '',
      '* [Configure permissions](/docs/en/permissions)',
    ].join('\n');

    expect(parseSettingsReferenceMd(markdown)).toEqual([
      section('permissions.allow', {
        scope: 'User or managed',
        example: '{ "permissions": { "allow": ["Read"] } }',
      }),
    ]);
  });

  it('JSON ブロックを複数持つセクションのとき、最初のものを記述例にすること', () => {
    const markdown = [
      '### `model`',
      '',
      '- **Scope**: [`Any file`](#scopes).',
      '',
      '```json settings.json theme={null}',
      '{ "model": "opus" }',
      '```',
      '',
      'An organization can enforce it:',
      '',
      '```json managed-settings.json theme={null}',
      '{ "model": "sonnet" }',
      '```',
    ].join('\n');

    expect(parseSettingsReferenceMd(markdown)[0]?.example).toBe(
      '{ "model": "opus" }',
    );
  });

  it('JSON ブロックを持たないセクションのとき、記述例を持たない結果を返すこと', () => {
    const markdown = [
      '### `teammateDefaultModel`',
      '',
      '- **Scope**: [`Global config`](#scopes). On v2.1.233 and earlier.',
      '',
      '```bash theme={null}',
      'claude config set model opus',
      '```',
    ].join('\n');

    expect(parseSettingsReferenceMd(markdown)).toEqual([
      section('teammateDefaultModel', { scope: 'Global config' }),
    ]);
  });

  it('Scope 行を持たないセクションのとき、記述場所を持たない結果を返すこと', () => {
    const markdown = [
      '### `unknownKey`',
      '',
      '- **Type**: string',
      '',
      '```json settings.json theme={null}',
      '{ "unknownKey": "value" }',
      '```',
    ].join('\n');

    expect(parseSettingsReferenceMd(markdown)).toEqual([
      section('unknownKey', {
        valueType: 'string',
        example: '{ "unknownKey": "value" }',
      }),
    ]);
  });

  it('公式の原文が `*` の箇条書きのとき、記述場所を取り出すこと', () => {
    const markdown = [
      '### `model`',
      '',
      '* **Scope**: [`Managed`](#scopes).',
    ].join('\n');

    expect(parseSettingsReferenceMd(markdown)[0]?.scope).toBe('Managed');
  });

  it('Scope が想定と違う書式のとき、その項目だけを持たない結果を返すこと', () => {
    const markdown = ['### `oddKey`', '', '- **Scope**: unknown'].join('\n');

    expect(parseSettingsReferenceMd(markdown)).toEqual([section('oddKey')]);
  });

  it.each([
    ['Boolean', 'boolean'],
    ['Boolean; only the JSON Boolean `true` takes effect', 'boolean'],
    ['string, a shell command line', 'string'],
    ['the string `"disable"`', 'string'],
    [
      'number of tokens, from `100000` to `1000000`. Claude Code caps it',
      'number',
    ],
    ['integer, milliseconds, minimum `1000`', 'integer'],
    ['object with the sub-keys below', 'object'],
    ['array of path strings, using the sandbox path prefixes', 'string[]'],
    [
      'array of objects, each with `marketplace` and `plugin` strings',
      'object[]',
    ],
    ['array of model aliases or IDs', 'array'],
  ])(
    '型が %s と書かれているとき、%s として読み取ること',
    (written, expected) => {
      const markdown = ['### `someKey`', '', `- **Type**: ${written}`].join(
        '\n',
      );

      expect(parseSettingsReferenceMd(markdown)[0]?.valueType).toBe(expected);
    },
  );

  it('型が対応表にない言い回しのとき、型を持たない結果を返すこと', () => {
    const markdown = [
      '### `strictPluginOnlyCustomization`',
      '',
      '- **Type**: `true` to lock all four kinds, or an array naming the kinds',
    ].join('\n');

    expect(parseSettingsReferenceMd(markdown)[0]?.valueType).toBe('');
  });

  it.each([
    ['`false`', 'false'],
    ['`true`', 'true'],
    ['`"first-wins"`', '"first-wins"'],
    ['`500000`', '500000'],
  ])(
    '既定値が %s と書かれているとき、設定ファイルに書く値として読み取ること',
    (written, expected) => {
      const markdown = ['### `someKey`', '', `- **Default**: ${written}`].join(
        '\n',
      );

      expect(parseSettingsReferenceMd(markdown)[0]?.defaultValue).toBe(
        expected,
      );
    },
  );

  it.each([
    ['unset'],
    ['unset, so Claude Code picks a window tuned for your model'],
    ['not locked'],
    ['`"bash"`, or `"powershell"` on Windows when Bash is unavailable'],
  ])(
    '既定値が %s と散文で書かれているとき、既定値を持たない結果を返すこと',
    (written) => {
      const markdown = ['### `someKey`', '', `- **Default**: ${written}`].join(
        '\n',
      );

      expect(parseSettingsReferenceMd(markdown)[0]?.defaultValue).toBeNull();
    },
  );

  it('選択肢が同じ行に並ぶとき、選択肢として読み取ること', () => {
    const markdown = [
      '### `feedbackDrafts`',
      '',
      '- **Type**: string, one of `"notify"`, `"quiet"`, or `"off"`',
    ].join('\n');

    expect(parseSettingsReferenceMd(markdown)[0]?.enumValues).toBe(
      '["notify","quiet","off"]',
    );
  });

  it('子のキーごとの選択肢を並べたオブジェクトのとき、選択肢を持たない結果を返すこと', () => {
    const markdown = [
      '### `sandbox.credentials.sigv4`',
      '',
      '- **Type**: object with `streaming` and `presigned`, each one of:',
      '  - `"deny"`: the proxy fails the request',
      '  - `"passthrough"`: the proxy forwards the request',
    ].join('\n');

    expect(parseSettingsReferenceMd(markdown)[0]?.enumValues).toBeNull();
  });

  it('選択肢を言葉で説明しているとき、選択肢を持たない結果を返すこと', () => {
    const markdown = [
      '### `advisorModel`',
      '',
      '- **Type**: string, one of the aliases `"fable"`, `"opus"`, or `"sonnet"`, or a full model ID such as `"claude-opus-5"`',
    ].join('\n');

    expect(parseSettingsReferenceMd(markdown)[0]?.enumValues).toBeNull();
  });

  it('設定キーの見出しを持たない本文のとき、空の並びを返すこと', () => {
    const markdown = [
      '## Scopes',
      '',
      'Claude Code reads settings from several files.',
      '',
      '- **Scope**: [`Any file`](#scopes)',
    ].join('\n');

    expect(parseSettingsReferenceMd(markdown)).toEqual([]);
  });
});
