import type { ChangelogEntry } from '../../domain/changelog/changelog-entry';
import {
  createKeywordSet,
  type KeywordSet,
} from '../../domain/analysis/keyword-set';

const EXCLUDED_WORDS = new Set([
  'Added',
  'Fixed',
  'Changed',
  'Improved',
  'Updated',
  'Removed',
  'Enabled',
  'bug',
  'issue',
  'error',
  'feature',
  'performance',
  'overall',
  'system',
  'the',
  'and',
  'or',
  'with',
  'for',
  'to',
  'in',
  'on',
  'when',
  'by',
]);

export function extractKeywords(entry: ChangelogEntry): KeywordSet {
  const { content } = entry;
  const original = [
    ...extractBacktickKeywords(content),
    ...extractTechnicalTerms(content),
  ];
  const normalized = original
    .flatMap(normalizeKeyword)
    .filter((word) => !EXCLUDED_WORDS.has(word));

  return createKeywordSet({ original, normalized });
}

function extractBacktickKeywords(content: string): string[] {
  return [...content.matchAll(/`([^`]+)`/g)]
    .map((match) => match[1])
    .filter((keyword): keyword is string => keyword != null);
}

function extractTechnicalTerms(content: string): string[] {
  const withoutBackticks = content.replace(/`[^`]+`/g, '');
  const withoutTags = withoutBackticks.replace(/\[[^\]]+\]/g, '');

  return [...withoutTags.matchAll(/\b([A-Z]{2,})\b/g)]
    .map((match) => match[1])
    .filter(
      (term): term is string => term != null && !EXCLUDED_WORDS.has(term),
    );
}

function normalizeKeyword(keyword: string): string[] {
  return keyword
    .replace(/[^a-zA-Z0-9]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}
