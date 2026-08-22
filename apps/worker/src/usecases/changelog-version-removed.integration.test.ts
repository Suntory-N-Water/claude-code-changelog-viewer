import { drizzle, type DrizzleD1Database } from 'drizzle-orm/d1';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  changelogDiffEvents,
  changelogItems,
  changelogVersions,
} from '../db/schema';
import { createChangelogDiffRepository } from '../infrastructure/drizzle/changelog-diff-repository';
import { createExistingChangelogReader } from '../infrastructure/drizzle/existing-changelog-reader';
import { FakeD1Database } from '../test-support/fake-d1';
import {
  fetchAndClassifyChangelog,
  saveChangelogDiffs,
} from './changelog-inference-workflow';

const REMOTE_MARKDOWN = '（parser をフェイクにするため中身は使わない）';

describe('version_removed の重複記録', () => {
  let fakeD1: FakeD1Database;
  let db: DrizzleD1Database;

  beforeEach(async () => {
    fakeD1 = new FakeD1Database();
    db = drizzle(fakeD1 as unknown as D1Database);
    await db.insert(changelogVersions).values([
      { version: '2.1.234', summary: null },
      { version: '2.1.231', summary: null },
    ]);
    await db.insert(changelogItems).values([
      {
        version: '2.1.234',
        itemId: 'v2.1.234-0',
        content: 'same item',
        contentJa: null,
        prefix: 'Changed',
        inferenceBefore: null,
        inferenceAfter: null,
        inferenceBenefit: null,
        searchText: 'same item',
      },
      {
        version: '2.1.231',
        itemId: 'removed-0',
        content: 'removed item',
        contentJa: null,
        prefix: 'Changed',
        inferenceBefore: null,
        inferenceAfter: null,
        inferenceBenefit: null,
        searchText: 'removed item',
      },
    ]);
  });

  async function processChangelog(
    remoteVersions: string[],
    detectedAt: string,
  ) {
    const classification = await fetchAndClassifyChangelog({
      source: { fetchMarkdown: async () => REMOTE_MARKDOWN },
      parser: {
        parse: async () =>
          remoteVersions.map((version) => ({
            version,
            items: [
              {
                id: `${version}-0`,
                content: version === 'v2.1.234' ? 'same item' : 'gone item',
                prefix: 'Changed',
              },
            ],
          })),
      },
      existingChangelogReader: createExistingChangelogReader(db),
      params: { detectedHash: 'a'.repeat(64), detectedAt },
    });
    await saveChangelogDiffs(
      createChangelogDiffRepository(db),
      classification.diffEvents,
    );
    return classification;
  }

  async function readDiffEvents() {
    return db
      .select({
        version: changelogDiffEvents.version,
        detectedAt: changelogDiffEvents.detectedAt,
        type: changelogDiffEvents.type,
      })
      .from(changelogDiffEvents);
  }

  it('同じ CHANGELOG を続けて2回処理しても行が増えないこと', async () => {
    await processChangelog(['v2.1.234'], '2026-08-16T00:00:00.000Z');
    await processChangelog(['v2.1.234'], '2026-08-17T00:00:00.000Z');

    expect(await readDiffEvents()).toEqual([
      {
        version: 'v2.1.231',
        detectedAt: '2026-08-16T00:00:00.000Z',
        type: 'version_removed',
      },
    ]);
  });

  it('新しく別のバージョンが消えた時は1件記録すること', async () => {
    await processChangelog(['v2.1.234'], '2026-08-16T00:00:00.000Z');
    await processChangelog([], '2026-08-17T00:00:00.000Z');

    expect(await readDiffEvents()).toEqual([
      {
        version: 'v2.1.231',
        detectedAt: '2026-08-16T00:00:00.000Z',
        type: 'version_removed',
      },
      {
        version: 'v2.1.234',
        detectedAt: '2026-08-17T00:00:00.000Z',
        type: 'version_removed',
      },
    ]);
  });
});
