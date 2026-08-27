import { asc } from 'drizzle-orm';
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
import { fetchAndClassifyChangelog } from './changelog-inference-workflow';

// D1 と remote で同じ項目を返し、項目差分による items_changed が混ざらないようにする
const ITEMS: Record<string, { id: string; content: string }> = {
  'v2.1.234': { id: 'v2.1.234-0', content: 'kept item' },
  'v2.1.231': { id: 'v2.1.231-0', content: 'removed item' },
};

describe('version_removed の重複記録', () => {
  let db: DrizzleD1Database;

  beforeEach(async () => {
    db = drizzle(new FakeD1Database() as unknown as D1Database);
    await ingestVersions(['v2.1.234', 'v2.1.231']);
  });

  function itemOf(version: string) {
    const item = ITEMS[version];
    if (item === undefined) {
      throw new Error(`ITEMS に未定義のバージョンです: ${version}`);
    }
    return item;
  }

  // changelog_versions は v なし、changelog_diff_events は v 付きで保存される
  async function ingestVersions(versions: string[]) {
    for (const version of versions) {
      const item = itemOf(version);
      await db
        .insert(changelogVersions)
        .values({ version: version.replace(/^v/, ''), summary: null });
      await db.insert(changelogItems).values({
        version: version.replace(/^v/, ''),
        itemId: item.id,
        content: item.content,
        contentJa: null,
        prefix: 'Changed',
        inferenceBefore: null,
        inferenceAfter: null,
        inferenceBenefit: null,
        searchText: item.content,
      });
    }
  }

  async function processChangelog(
    remoteVersions: string[],
    detectedAt: string,
  ) {
    const classification = await fetchAndClassifyChangelog({
      source: {
        fetchMarkdown: async () => '（parser をフェイクにするため未使用）',
      },
      parser: {
        parse: async () =>
          remoteVersions.map((version) => ({
            version,
            items: [{ ...itemOf(version), prefix: 'Changed' }],
          })),
      },
      existingChangelogReader: createExistingChangelogReader(db),
      params: { detectedHash: 'a'.repeat(64), detectedAt },
    });
    await createChangelogDiffRepository(db).saveAll(classification.diffEvents);
  }

  async function readDiffEvents() {
    return db
      .select({
        version: changelogDiffEvents.version,
        detectedAt: changelogDiffEvents.detectedAt,
        type: changelogDiffEvents.type,
      })
      .from(changelogDiffEvents)
      .orderBy(
        asc(changelogDiffEvents.version),
        asc(changelogDiffEvents.detectedAt),
      );
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

  it('items_changed だけが記録済みのバージョンが消えた時、削除を記録すること', async () => {
    await db.insert(changelogDiffEvents).values({
      version: 'v2.1.234',
      detectedAt: '2026-08-15T00:00:00.000Z',
      type: 'items_changed',
    });

    await processChangelog(['v2.1.231'], '2026-08-16T00:00:00.000Z');

    expect(await readDiffEvents()).toEqual([
      {
        version: 'v2.1.234',
        detectedAt: '2026-08-15T00:00:00.000Z',
        type: 'items_changed',
      },
      {
        version: 'v2.1.234',
        detectedAt: '2026-08-16T00:00:00.000Z',
        type: 'version_removed',
      },
    ]);
  });

  // 追跡するには削除検出時に changelog_versions の行を消す必要があり、
  // サイトの表示からバージョンが消える副作用を伴うため、記録しない挙動を仕様として固定する
  it('削除済みのバージョンが再追加されてから再び消えた時、2度目は記録しないこと', async () => {
    await processChangelog(['v2.1.234'], '2026-08-16T00:00:00.000Z');

    // 削除を検出しても D1 の行は残るため、remote に戻るだけで再追加になる
    await processChangelog(
      ['v2.1.234', 'v2.1.231'],
      '2026-08-17T00:00:00.000Z',
    );

    await processChangelog(['v2.1.234'], '2026-08-18T00:00:00.000Z');

    expect(await readDiffEvents()).toEqual([
      {
        version: 'v2.1.231',
        detectedAt: '2026-08-16T00:00:00.000Z',
        type: 'version_removed',
      },
    ]);
  });
});
