import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SchemaFetcher } from '../lib/schema-fetcher';

const fetchedSchema = JSON.stringify({
  properties: {
    exampleSetting: { type: 'string' },
  },
});

describe('settings schema の前回生成物読み込み', () => {
  let rootDir: string;

  beforeEach(async () => {
    rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'schema-fetcher-'));
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(fetchedSchema, { status: 200 }),
    );
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(rootDir, { recursive: true, force: true });
  });

  it('前回の JSON が未存在の時、警告せず初回生成できること', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const sut = new SchemaFetcher(rootDir);

    await sut.fetchSchema();

    expect(warning).not.toHaveBeenCalled();
    expect(
      await fs.readFile(
        path.join(rootDir, 'schema', 'claude-code-settings.json'),
        'utf-8',
      ),
    ).toBe(fetchedSchema);
  });

  it('前回の JSON が破損している時、ファイル名付きで警告して生成を継続すること', async () => {
    const schemaPath = path.join(
      rootDir,
      'schema',
      'claude-code-settings.json',
    );
    const metadataPath = path.join(
      rootDir,
      'metadata',
      'last_schema_update.json',
    );
    await fs.mkdir(path.dirname(schemaPath), { recursive: true });
    await fs.mkdir(path.dirname(metadataPath), { recursive: true });
    await fs.writeFile(schemaPath, '{broken');
    await fs.writeFile(metadataPath, '{broken');
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const sut = new SchemaFetcher(rootDir);

    await sut.fetchSchema();

    expect(warning).toHaveBeenCalledTimes(2);
    expect(warning.mock.calls.map(([message]) => message).join('\n')).toContain(
      schemaPath,
    );
    expect(warning.mock.calls.map(([message]) => message).join('\n')).toContain(
      metadataPath,
    );
  });
});
