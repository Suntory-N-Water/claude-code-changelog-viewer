export type BuiltinSurfaceKind =
  | 'tools'
  | 'commands'
  | 'skills'
  | 'envs'
  | 'agents';

export type BuiltinSurfaceCatalog = {
  readonly kind: BuiltinSurfaceKind;
  readonly names: readonly string[];
};

/**
 * 組み込み tool / command / skill / env / agent の一覧を重複なしで生成する。
 */
export function createBuiltinSurfaceCatalog(input: {
  readonly kind: BuiltinSurfaceKind;
  readonly names: readonly string[];
}): BuiltinSurfaceCatalog {
  return {
    kind: input.kind,
    names: [...new Set(input.names.map((name) => name.trim()))].filter(
      (name) => name.length > 0,
    ),
  };
}

/**
 * cli-surface.md の指定セクションからバッククォート付きリスト項目を抽出する。
 */
export function extractMarkdownListItems(
  markdown: string,
  sectionName: string,
): string[] {
  const results: string[] = [];
  let inSection = false;
  let inSubSection = false;

  for (const line of markdown.split('\n')) {
    if (line.startsWith('## ')) {
      inSection = line === `## ${sectionName}`;
      inSubSection = false;
      continue;
    }

    if (!inSection) {
      continue;
    }

    if (line.startsWith('### ')) {
      inSubSection = sectionName === 'Commands' && line === '### Names';
      continue;
    }

    if (sectionName === 'Commands' && !inSubSection) {
      continue;
    }

    const match = line.match(/^- `([^`]+)`/);
    if (match?.[1]) {
      results.push(match[1]);
    }
  }

  return results;
}
