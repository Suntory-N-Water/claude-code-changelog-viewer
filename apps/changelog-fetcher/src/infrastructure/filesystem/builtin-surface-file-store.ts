import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getLogger } from '@claude-code-changelog-viewer/common';
import type { BuiltinSurfaceStorePort } from '../../application/fetch-builtin-surface';
import type { BuiltinSurfaceCatalog } from '../../domain/builtin-surface/builtin-surface-catalog';

const log = getLogger({ name: 'fetch-builtin-data' });

export class BuiltinSurfaceFileStore implements BuiltinSurfaceStorePort {
  private outputDir: string;

  constructor(outputDir: string) {
    this.outputDir = outputDir;
  }

  async saveCatalogs(catalogs: BuiltinSurfaceCatalog[]): Promise<void> {
    await mkdir(this.outputDir, { recursive: true });

    await Promise.all(
      catalogs.map(async (catalog) => {
        const filename = `${catalog.kind}.json`;
        await writeFile(
          join(this.outputDir, filename),
          `${JSON.stringify(catalog.names, null, 2)}\n`,
          'utf-8',
        );
        log.info(`書き込み完了: ${filename} (${catalog.names.length} 件)`);
      }),
    );
  }
}
