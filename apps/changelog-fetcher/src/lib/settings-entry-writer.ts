import { globSync, mkdirSync, readFileSync } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type {
  RawEntry,
  SettingEntryFile,
  SettingSource,
  TranslationMap,
} from './settings-entry-types';
import type { RelatedContext } from './settings-related-context';

/**
 * camelCase → kebab-case
 */
function camelToKebab(str: string): string {
  return str
    .replace(/([A-Z])/g, '-$1')
    .toLowerCase()
    .replace(/^-/, '');
}

/**
 * SCREAMING_SNAKE_CASE → kebab-case
 */
function screamingSnakeToKebab(str: string): string {
  return str.toLowerCase().replace(/_/g, '-');
}

function toSlug(key: string, source: SettingSource): string {
  if (source === 'env') {
    return screamingSnakeToKebab(key);
  }
  return key.split('.').map(camelToKebab).join('-');
}

export function loadExistingSettingKeys(outputDir: string): Set<string> {
  mkdirSync(outputDir, { recursive: true });
  return new Set(
    globSync('settings_*.json', { cwd: outputDir })
      .map(String)
      .map((f) => {
        const raw = readFileSync(path.join(outputDir, f), 'utf-8');
        return (JSON.parse(raw) as { key: string }).key;
      }),
  );
}

type WriteSettingEntryFilesOptions = {
  outputDir: string;
  entries: RawEntry[];
  translationMap: TranslationMap;
  ctx: RelatedContext;
};

export async function writeSettingEntryFiles(
  opts: WriteSettingEntryFilesOptions,
): Promise<number> {
  const { outputDir, entries, translationMap, ctx } = opts;
  let writtenCount = 0;

  await Promise.all(
    entries.map(async (entry, index) => {
      const translation = translationMap.get(index);
      if (!translation) {
        return;
      }

      const slug = toSlug(entry.key, entry.source);
      const relatedChangelog = ctx.changelogsMap.get(entry.key) ?? [];

      const ref: SettingEntryFile = {
        key: entry.key,
        leaf_name: entry.leaf_name,
        slug,
        source: entry.source,
        description_en: entry.description_en,
        description_ja: translation.description_ja,
        ...(translation.use_case_ja
          ? { use_case_ja: translation.use_case_ja }
          : {}),
        parent_descriptions: entry.parent_descriptions,
        doc_snippets: ctx.docSnippetsMap.get(entry.key) ?? [],
        related_changelog: relatedChangelog,
      };

      const outputPath = path.join(outputDir, `settings_${slug}.json`);
      await fs.writeFile(outputPath, JSON.stringify(ref, null, 2));
      writtenCount += 1;
    }),
  );

  return writtenCount;
}
