import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TZDate } from '@date-fns/tz';
import { z } from 'astro:content';
import { format } from 'date-fns';

const diffEventSchema = z.object({
  detected_at: z.string().datetime(),
  version: z.string(),
  type: z.enum(['items_changed', 'version_removed']),
  items_added: z.array(z.string()),
  items_removed: z.array(z.string()),
});

const diffFileSchema = z.object({
  events: z.array(diffEventSchema),
});

export type DiffEvent = z.infer<typeof diffEventSchema>;

/** ISO文字列をJSTの「yyyy/MM/dd HH:mm」形式にフォーマット */
export function formatDiffDateTime(iso: string): string {
  const jst = new TZDate(iso, 'Asia/Tokyo');
  return format(jst, 'yyyy年M月d日 H時m分');
}

const DIFF_PATH = resolve(
  import.meta.dirname,
  '../content/diff/changelog_diff.json',
);

/**
 * diff/changelog_diff.json を読み込み、バージョンをキーにした Map を返す。
 * ファイルが存在しない場合は空の Map を返す。
 */
export function loadChangelogDiff(): Map<string, DiffEvent[]> {
  if (!existsSync(DIFF_PATH)) {
    return new Map();
  }

  const parsed = diffFileSchema.parse(
    JSON.parse(readFileSync(DIFF_PATH, 'utf-8')),
  );

  const map = new Map<string, DiffEvent[]>();
  for (const event of parsed.events) {
    const existing = map.get(event.version);
    if (existing) {
      existing.push(event);
    } else {
      map.set(event.version, [event]);
    }
  }

  return map;
}
