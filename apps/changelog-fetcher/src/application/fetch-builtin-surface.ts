import { getLogger } from '@claude-code-changelog-viewer/common';
import {
  createBuiltinSurfaceCatalog,
  type BuiltinSurfaceCatalog,
} from '../domain/builtin-surface/builtin-surface-catalog';

const log = getLogger({ name: 'fetch-builtin-data' });

export type BuiltinSurfaceSourcePort = {
  fetchCliSurface: () => Promise<{
    tools: string[];
    commands: string[];
    skills: string[];
    envs: string[];
  }>;
  fetchAgents: () => Promise<string[]>;
};

export type BuiltinSurfaceStorePort = {
  saveCatalogs: (catalogs: BuiltinSurfaceCatalog[]) => Promise<void>;
};

export async function fetchBuiltinSurface(input: {
  source: BuiltinSurfaceSourcePort;
  store: BuiltinSurfaceStorePort;
}): Promise<void> {
  const [{ tools, commands, skills, envs }, agents] = await Promise.all([
    input.source.fetchCliSurface(),
    input.source.fetchAgents(),
  ]);

  const catalogs = [
    createBuiltinSurfaceCatalog({ kind: 'tools', names: tools }),
    createBuiltinSurfaceCatalog({ kind: 'commands', names: commands }),
    createBuiltinSurfaceCatalog({ kind: 'skills', names: skills }),
    createBuiltinSurfaceCatalog({ kind: 'envs', names: envs }),
    createBuiltinSurfaceCatalog({ kind: 'agents', names: agents }),
  ];

  await input.store.saveCatalogs(catalogs);
  log.info('全ファイルの書き込みが完了しました');
}
