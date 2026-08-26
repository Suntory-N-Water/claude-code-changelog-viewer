import * as path from 'node:path';

export const PROJECT_ROOT = path.join(process.cwd(), '..', '..');

export function toRelativePath(absolutePath: string): string {
  return path.relative(PROJECT_ROOT, absolutePath);
}
