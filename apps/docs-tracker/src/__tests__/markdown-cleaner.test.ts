import { describe, expect, test } from 'vitest';
import { cleanMarkdown } from '../lib/markdown-cleaner';

describe('cleanMarkdown', () => {
  test('通常の Markdown はそのまま保持される', async () => {
    const input = `# Heading

Some paragraph text.

- list item 1
- list item 2

\`\`\`bash
echo "hello"
\`\`\`
`;
    const result = await cleanMarkdown(input);
    expect(result.trim()).toBe(input.trim());
  });

  test('Documentation Index blockquote が除去される', async () => {
    const input = `> ## Documentation Index
> Fetch the complete documentation index at: https://code.claude.com/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# Heading

Some content.
`;
    const result = await cleanMarkdown(input);
    expect(result).not.toContain('Documentation Index');
    expect(result).toContain('# Heading');
    expect(result).toContain('Some content.');
  });

  test('コードフェンスの theme={null} が除去される', async () => {
    const input = `\`\`\`bash  theme={null}
echo "hello"
\`\`\`
`;
    const result = await cleanMarkdown(input);
    expect(result).not.toContain('theme={null}');
    expect(result).toContain('```bash');
    expect(result).toContain('echo "hello"');
  });

  test('export const ブロックが除去される', async () => {
    const input = `# Title

export const MyComponent = () => {
  return <div>hello</div>;
};

Some content after.
`;
    const result = await cleanMarkdown(input);
    expect(result).not.toContain('export const');
    expect(result).not.toContain('MyComponent');
    expect(result).toContain('# Title');
    expect(result).toContain('Some content after.');
  });

  test('コードフェンス内の export は除去されない', async () => {
    const input = `\`\`\`bash
export ANTHROPIC_API_KEY=sk-xxx
\`\`\`
`;
    const result = await cleanMarkdown(input);
    expect(result).toContain('export ANTHROPIC_API_KEY=sk-xxx');
  });

  test('MDX コンポーネントが unwrap されて中身が残る', async () => {
    const input = `<Tip>
  For a quickstart guide, see [hooks guide](/en/hooks-guide).
</Tip>
`;
    const result = await cleanMarkdown(input);
    expect(result).not.toContain('<Tip>');
    expect(result).not.toContain('</Tip>');
    expect(result).toContain('hooks guide');
  });

  test('ネストした MDX コンポーネントが再帰的に unwrap される', async () => {
    const input = `<Steps>
  <Step title="Install">
    Run the install command.
  </Step>
  <Step title="Configure">
    Edit the config file.
  </Step>
</Steps>
`;
    const result = await cleanMarkdown(input);
    expect(result).not.toContain('<Steps>');
    expect(result).not.toContain('<Step');
    expect(result).toContain('Run the install command.');
    expect(result).toContain('Edit the config file.');
  });

  test('自己閉じ JSX 要素が削除される', async () => {
    const input = `# Title

<MCPServersTable platform="claudeCode" />

Some content.
`;
    const result = await cleanMarkdown(input);
    expect(result).not.toContain('MCPServersTable');
    expect(result).toContain('# Title');
    expect(result).toContain('Some content.');
  });

  test('img タグが完全に削除される', async () => {
    const input = `# Title

<img src="https://example.com/image.png" alt="diagram" srcset="https://example.com/image.png?w=280 280w, https://example.com/image.png?w=560 560w" data-og-width="520" width="520" />

Some content.
`;
    const result = await cleanMarkdown(input);
    expect(result).not.toContain('<img');
    expect(result).not.toContain('srcset');
    expect(result).not.toContain('example.com/image');
    expect(result).toContain('# Title');
    expect(result).toContain('Some content.');
  });

  test('style タグが削除される', async () => {
    const input = `<style jsx>{\`
  .container { margin: 0; }
\`}</style>

Some content.
`;
    const result = await cleanMarkdown(input);
    expect(result).not.toContain('<style');
    expect(result).not.toContain('.container');
    expect(result).toContain('Some content.');
  });

  test('3行以上の連続空行が2行に正規化される', async () => {
    const input = `# Title



Some content.
`;
    const result = await cleanMarkdown(input);
    expect(result).not.toMatch(/\n{4,}/);
    expect(result).toContain('# Title');
    expect(result).toContain('Some content.');
  });
});
