import * as path from 'node:path';

export const PROJECT_ROOT = path.join(process.cwd(), '..', '..');

export function toRelativePath(absolutePath: string): string {
  return path.relative(PROJECT_ROOT, absolutePath);
}

export function toAbsolutePath(relativePath: string): string {
  return path.join(PROJECT_ROOT, relativePath);
}
