/**
 * ビルド時 SEO バリデーション Astro インテグレーション
 * astro:build:done フックで dist の全 HTML を検査する。
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { AstroIntegration } from 'astro';

type Issue = {
  file: string;
  level: 'error' | 'warn';
  message: string;
};

function collectHtmlFiles(dir: string): string[] {
  const results: string[] = [];
  try {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        results.push(...collectHtmlFiles(full));
      } else if (entry.endsWith('.html')) {
        results.push(full);
      }
    }
  } catch {
    // アクセスできないディレクトリはスキップ
  }
  return results;
}

function validateHtml(filePath: string, content: string): Issue[] {
  const issues: Issue[] = [];
  const rel = filePath.split('/dist/')[1] ?? filePath;

  const h1Matches = content.match(/<h1[\s>]/gi) ?? [];
  if (h1Matches.length === 0) {
    issues.push({ file: rel, level: 'warn', message: 'H1 タグが存在しません' });
  } else if (h1Matches.length > 1) {
    issues.push({
      file: rel,
      level: 'warn',
      message: `H1 タグが ${h1Matches.length} 個あります(1 個推奨)`,
    });
  }

  const titleMatch = content.match(/<title[^>]*>(.*?)<\/title>/is);
  if (!titleMatch?.[1].trim()) {
    issues.push({
      file: rel,
      level: 'error',
      message: 'title タグが空または欠損しています',
    });
  }

  const descMatch = content.match(
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i,
  );
  if (!descMatch?.[1].trim()) {
    issues.push({
      file: rel,
      level: 'warn',
      message: 'meta description が空または欠損しています',
    });
  }

  const imgWithoutAlt = (
    content.match(/<img(?![^>]*\balt=)[^>]*>/gi) ?? []
  ).filter((img) => !img.includes('aria-hidden'));
  if (imgWithoutAlt.length > 0) {
    issues.push({
      file: rel,
      level: 'warn',
      message: `alt 属性なしの img 要素が ${imgWithoutAlt.length} 個あります`,
    });
  }

  if (!content.match(/<link[^>]+rel=["']canonical["'][^>]*>/i)) {
    issues.push({
      file: rel,
      level: 'warn',
      message: 'canonical link が欠損しています',
    });
  }

  return issues;
}

function checkDuplicateTitles(files: string[]): Issue[] {
  const titleMap = new Map<string, string[]>();

  for (const file of files) {
    const content = readFileSync(file, 'utf-8');
    const titleMatch = content.match(/<title[^>]*>(.*?)<\/title>/is);
    if (!titleMatch) {
      continue;
    }
    const title = titleMatch[1].trim();
    const rel = file.split('/dist/')[1] ?? file;
    if (!titleMap.has(title)) {
      titleMap.set(title, []);
    }
    titleMap.get(title)?.push(rel);
  }

  const issues: Issue[] = [];
  for (const [title, pages] of titleMap.entries()) {
    if (pages.length > 1) {
      issues.push({
        file: pages.join(', '),
        level: 'error',
        message: `重複 title: "${title.slice(0, 60)}${title.length > 60 ? '…' : ''}"`,
      });
    }
  }
  return issues;
}

export function seoValidate(
  options: { failOnError?: boolean } = {},
): AstroIntegration {
  const { failOnError = false } = options;

  return {
    name: 'seo-validate',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const distPath = dir.pathname;
        const htmlFiles = collectHtmlFiles(distPath);

        logger.info(`SEO 検証: ${htmlFiles.length} ファイルをチェック中...`);

        const allIssues: Issue[] = [];

        for (const file of htmlFiles) {
          const content = readFileSync(file, 'utf-8');
          allIssues.push(...validateHtml(file, content));
        }

        allIssues.push(...checkDuplicateTitles(htmlFiles));

        const errors = allIssues.filter((i) => i.level === 'error');
        const warns = allIssues.filter((i) => i.level === 'warn');

        for (const issue of warns) {
          logger.warn(`[SEO] ${issue.file}: ${issue.message}`);
        }
        for (const issue of errors) {
          logger.error(`[SEO] ${issue.file}: ${issue.message}`);
        }

        logger.info(
          `SEO 検証完了: ${errors.length} エラー, ${warns.length} 警告`,
        );

        if (failOnError && errors.length > 0) {
          throw new Error(
            `SEO バリデーションエラーが ${errors.length} 件あります`,
          );
        }
      },
    },
  };
}
