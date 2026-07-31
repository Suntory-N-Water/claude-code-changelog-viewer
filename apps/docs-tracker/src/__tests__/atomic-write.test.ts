import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { atomicWriteFile } from '../lib/atomic-write';

describe('生成ファイルのアトミック書き込み', () => {
  let rootDir: string | undefined;

  afterEach(async () => {
    if (rootDir) {
      await fs.rm(rootDir, { recursive: true, force: true });
    }
  });

  it('既存ファイルを置き換えた時、一時ファイルを残さないこと', async () => {
    rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'atomic-write-'));
    const targetPath = path.join(rootDir, 'nested', 'output.json');
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, 'before');

    await atomicWriteFile(targetPath, 'after');

    expect(await fs.readFile(targetPath, 'utf-8')).toBe('after');
    expect(await fs.readdir(path.dirname(targetPath))).toEqual(['output.json']);
  });
});
