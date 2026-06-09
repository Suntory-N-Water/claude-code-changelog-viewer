import { globSync, mkdirSync, readFileSync } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { SettingReferenceOutput } from '../../application/settings-translation';

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

type WriteSettingReferenceFilesOptions = {
  outputDir: string;
  references: SettingReferenceOutput[];
};

export async function writeSettingReferenceFiles(
  opts: WriteSettingReferenceFilesOptions,
): Promise<number> {
  const { outputDir, references } = opts;
  let writtenCount = 0;

  await Promise.all(
    references.map(async (reference) => {
      const outputPath = path.join(
        outputDir,
        `settings_${reference.slug}.json`,
      );
      await fs.writeFile(
        outputPath,
        JSON.stringify(toSettingReferenceJson(reference), null, 2),
      );
      writtenCount += 1;
    }),
  );

  return writtenCount;
}

function toSettingReferenceJson(reference: SettingReferenceOutput): {
  key: string;
  leaf_name: string;
  slug: string;
  source: string;
  description_en: string;
  description_ja: string;
  use_case_ja?: string;
  parent_descriptions: string[];
  doc_snippets: string[];
  related_changelog: {
    version: string;
    content: string;
    content_ja?: string;
    inference?: {
      before: string;
      after: string;
      benefit: string;
    };
  }[];
} {
  return {
    key: reference.key,
    leaf_name: reference.leafName,
    slug: reference.slug,
    source: reference.source,
    description_en: reference.descriptionEn,
    description_ja: reference.descriptionJa,
    ...(reference.useCaseJa !== undefined
      ? { use_case_ja: reference.useCaseJa }
      : {}),
    parent_descriptions: reference.parentDescriptions,
    doc_snippets: reference.docSnippets,
    related_changelog: reference.relatedChangelog.map((changelog) => ({
      version: changelog.version,
      content: changelog.content,
      ...(changelog.contentJa !== undefined
        ? { content_ja: changelog.contentJa }
        : {}),
      ...(changelog.inference !== undefined
        ? { inference: changelog.inference }
        : {}),
    })),
  };
}
