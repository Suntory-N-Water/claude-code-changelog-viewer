import { getLogger } from '@claude-code-changelog-viewer/common';
import type { BuiltinSurfaceSourcePort } from '../../application/fetch-builtin-surface';
import { extractBuiltinSurfaceSection } from '../docs/builtin-surface-markdown-parser';

const log = getLogger({ name: 'fetch-builtin-data' });

const MARCKRENN_URL =
  'https://raw.githubusercontent.com/marckrenn/claude-code-changelog/main/meta/cli-surface.md';
const PIEBALD_API_URL =
  'https://api.github.com/repos/Piebald-AI/claude-code-system-prompts/contents/system-prompts';

type GithubFile = { name: string; type: string };

export class GithubBuiltinSurfaceClient implements BuiltinSurfaceSourcePort {
  async fetchCliSurface() {
    log.info('marckrenn/claude-code-changelog から cli-surface.md を取得中...');
    const response = await fetch(MARCKRENN_URL);
    if (!response.ok) {
      throw new Error(
        `marckrenn fetch 失敗: ${response.status} ${response.statusText}`,
      );
    }

    const markdown = await response.text();
    const tools = extractBuiltinSurfaceSection(markdown, 'Tools');
    const commands = extractBuiltinSurfaceSection(markdown, 'Commands');
    const skills = extractBuiltinSurfaceSection(markdown, 'Skills');
    const envs = extractBuiltinSurfaceSection(markdown, 'Env Vars');

    log.info(
      `取得完了: tools=${tools.length}, commands=${commands.length}, skills=${skills.length}, envs=${envs.length}`,
    );

    return { tools, commands, skills, envs };
  }

  async fetchAgents() {
    log.info(
      'Piebald-AI/claude-code-system-prompts からファイル一覧を取得中...',
    );
    const response = await fetch(PIEBALD_API_URL, {
      headers: { 'User-Agent': 'claude-code-changelog-viewer' },
    });
    if (!response.ok) {
      throw new Error(
        `Piebald-AI fetch 失敗: ${response.status} ${response.statusText}`,
      );
    }

    const files = (await response.json()) as GithubFile[];
    const agents = files
      .filter(
        (file) =>
          file.type === 'file' &&
          file.name.startsWith('agent-prompt-') &&
          file.name.endsWith('.md'),
      )
      .map((file) =>
        file.name.replace(/^agent-prompt-/, '').replace(/\.md$/, ''),
      );

    log.info(`取得完了: agents=${agents.length}`);
    return agents;
  }
}
