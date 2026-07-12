import { getLogger } from '@claude-code-changelog-viewer/common';
import type {
  InferenceResult,
  InferredAnalysis,
} from '@claude-code-changelog-viewer/types';
import {
  type IsoWeek,
  includesInWeekRange,
  toWeekDateRange,
} from '../domain/weekly-post/iso-week';

const log = getLogger({ name: 'weekly-post-generator' });

export type HighImpactItem = {
  version: string;
  id: string;
  content: string;
  contentJa?: string;
  prefix: string;
  inference?: InferenceResult;
};

export type WeeklyPostGeneratorPort = {
  generate: (input: {
    isoWeek: IsoWeek;
    versions: string[];
    highImpactItems: HighImpactItem[];
  }) => Promise<{ title: string; body: string }>;
};

export type ReleaseInfoPort = {
  fetchReleaseDates: () => Promise<Map<string, string>>;
};

export type InferredFilePort = {
  load: (version: string) => Promise<InferredAnalysis | null>;
};

export type WeeklyPostStorePort = {
  save: (
    isoWeek: IsoWeek,
    input: { title: string; body: string; versions: string[] },
  ) => Promise<void>;
};

export type GenerateWeeklyPostResult = {
  skipped: boolean;
  versions: string[];
  highImpactItems: HighImpactItem[];
};

export async function generateWeeklyPost(input: {
  isoWeek: IsoWeek;
  dryRun: boolean;
  releaseInfo: ReleaseInfoPort;
  inferredFile: InferredFilePort;
  generator: WeeklyPostGeneratorPort;
  store: WeeklyPostStorePort;
}): Promise<GenerateWeeklyPostResult> {
  const range = toWeekDateRange(input.isoWeek);
  const releaseDates = await input.releaseInfo.fetchReleaseDates();
  const versions = [...releaseDates.entries()]
    .filter(([, publishedAt]) =>
      includesInWeekRange(range, new Date(publishedAt)),
    )
    .sort(([, a], [, b]) => a.localeCompare(b))
    .map(([version]) => version);

  if (versions.length === 0) {
    log.info('対象週のリリースがないため週次記事生成をスキップ', {
      isoWeek: input.isoWeek,
    });
    return { skipped: true, versions, highImpactItems: [] };
  }

  const highImpactItems: HighImpactItem[] = [];
  for (const version of versions) {
    const inferred = await input.inferredFile.load(version);
    if (!inferred) {
      log.warn(`inferred JSON が存在しないためスキップ: ${version}`);
      continue;
    }

    for (const item of inferred.items) {
      if (item.impact?.level !== 'high') {
        continue;
      }

      highImpactItems.push({
        version,
        id: item.id,
        content: item.content,
        ...(item.content_ja !== undefined
          ? { contentJa: item.content_ja }
          : {}),
        prefix: item.prefix,
        ...(item.inference !== undefined ? { inference: item.inference } : {}),
      });
    }
  }

  if (input.dryRun) {
    return { skipped: false, versions, highImpactItems };
  }

  const generated = await input.generator.generate({
    isoWeek: input.isoWeek,
    versions,
    highImpactItems,
  });

  await input.store.save(input.isoWeek, { ...generated, versions });
  return { skipped: false, versions, highImpactItems };
}
