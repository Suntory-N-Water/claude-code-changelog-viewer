export type BuiltinSurfaceKind =
  | 'tools'
  | 'commands'
  | 'skills'
  | 'envs'
  | 'agents';

export type BuiltinSurfaceCatalog = {
  kind: BuiltinSurfaceKind;
  names: string[];
};

/**
 * 組み込み tool / command / skill / env / agent の一覧を重複なしで生成する。
 */
export function createBuiltinSurfaceCatalog(input: {
  kind: BuiltinSurfaceKind;
  names: string[];
}): BuiltinSurfaceCatalog {
  return {
    kind: input.kind,
    names: [...new Set(input.names.map((name) => name.trim()))].filter(
      (name) => name.length > 0,
    ),
  };
}
