import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getLogger, toError } from '@claude-code-changelog-viewer/common';
import { InferredAnalysisSchema } from '@claude-code-changelog-viewer/types';
import { createIsoWeek, type IsoWeek } from './domain/weekly-post/iso-week';
import { GeminiWeeklyPostGenerator } from './infrastructure/ai/gemini-weekly-post-generator';
import { buildWeeklyPostPrompt } from './infrastructure/ai/prompts/weekly-post-prompt';
import { WeeklyPostStore } from './infrastructure/filesystem/weekly-post-store';
import { GitHubReleaseDateClient } from './infrastructure/github/release-date-client';
import {
  generateWeeklyPost,
  type WeeklyPostGeneratorPort,
} from './usecase/weekly-post-generation';

const log = getLogger({ name: 'weekly-post-generator' });

type CliArgs = {
  isoWeek: IsoWeek;
  dryRun: boolean;
};

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const isoWeekValue = args.find((arg) => !arg.startsWith('--'));
  if (!isoWeekValue) {
    log.error(
      'Usage: tsx src/generate-weekly-post.ts <yyyy-mm-dd|yyyy-wWW> [--dry-run]',
    );
    process.exit(1);
  }

  return {
    isoWeek: createIsoWeek(isoWeekValue),
    dryRun: args.includes('--dry-run'),
  };
}

async function main(): Promise<void> {
  const { isoWeek, dryRun } = parseArgs();
  const appDir = process.cwd();

  const neverCallGenerator: WeeklyPostGeneratorPort = {
    async generate(input) {
      throw new Error(
        `dry-run で generator port が呼ばれました: ${input.isoWeek}`,
      );
    },
  };

  const result = await generateWeeklyPost({
    isoWeek,
    dryRun,
    releaseInfo: new GitHubReleaseDateClient(),
    inferredFile: {
      async load(version) {
        const filePath = join(appDir, 'inferred', `inferred_${version}.json`);
        if (!existsSync(filePath)) {
          return null;
        }
        const raw = await readFile(filePath, 'utf-8');
        return InferredAnalysisSchema.parse(JSON.parse(raw));
      },
    },
    generator: dryRun
      ? neverCallGenerator
      : new GeminiWeeklyPostGenerator(
          process.env['GEMINI_API_KEY'] || '',
          log.child({ component: 'gemini' }),
        ),
    store: new WeeklyPostStore(join(appDir, 'posts', 'weekly')),
  });

  if (dryRun && !result.skipped) {
    const prompt = buildWeeklyPostPrompt({
      isoWeek,
      versions: result.versions,
      highImpactItems: result.highImpactItems,
    });
    const dryRunDir = join(appDir, 'dry-run', isoWeek);
    const promptPath = join(dryRunDir, 'prompt.md');
    await mkdir(dryRunDir, { recursive: true });
    await writeFile(promptPath, prompt, 'utf-8');
    log.info(`プロンプトを出力: ${promptPath}`);
  }
}

main().catch((error) => {
  log.msg('APLG0018', { error: toError(error) });
  process.exit(1);
});
