import type { AppLogger } from '@claude-code-changelog-viewer/common';
import type { WeeklyPostGeneratorPort } from '../../usecase/weekly-post-generation';
import { GeminiClient } from './gemini-client';
import { buildWeeklyPostPrompt } from './prompts/weekly-post-prompt';

export class GeminiWeeklyPostGenerator implements WeeklyPostGeneratorPort {
  private client: GeminiClient;

  constructor(apiKey: string, logger: AppLogger) {
    this.client = new GeminiClient(apiKey, logger);
  }

  async generate(
    input: Parameters<WeeklyPostGeneratorPort['generate']>[0],
  ): ReturnType<WeeklyPostGeneratorPort['generate']> {
    const text = await this.client.generateText(
      buildWeeklyPostPrompt({
        isoWeek: input.isoWeek,
        versions: input.versions,
        highImpactItems: input.highImpactItems,
      }),
    );
    const lines = text.split('\n');
    const titleLine = lines.find((line) => line.trim().startsWith('# '));
    const title = titleLine?.replace(/^#\s+/, '').trim() || input.isoWeek;
    const body = lines
      .filter((line, index) => !(index === 0 && line.trim().startsWith('# ')))
      .join('\n')
      .trim();

    return { title, body };
  }
}
