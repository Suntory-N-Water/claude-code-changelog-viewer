import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  type IsoWeek,
  toWeekDateRange,
  toWeekPostPeriod,
} from '../../domain/weekly-post/iso-week';
import type { WeeklyPostStorePort } from '../../usecase/weekly-post-generation';

export class WeeklyPostStore implements WeeklyPostStorePort {
  constructor(private outputDir: string) {}

  async save(
    isoWeek: IsoWeek,
    input: { title: string; body: string; versions: string[] },
  ): Promise<void> {
    const period = toWeekPostPeriod(toWeekDateRange(isoWeek));
    const content = [
      '---',
      `title: ${JSON.stringify(input.title)}`,
      `date: ${JSON.stringify(period.end)}`,
      `period_start: ${JSON.stringify(period.start)}`,
      `period_end: ${JSON.stringify(period.end)}`,
      'versions:',
      ...input.versions.map((version) => `  - ${version.replace(/^v/, '')}`),
      '---',
      '',
      input.body,
      '',
    ].join('\n');

    await mkdir(this.outputDir, { recursive: true });
    await writeFile(join(this.outputDir, `${isoWeek}.md`), content, 'utf-8');
  }
}
