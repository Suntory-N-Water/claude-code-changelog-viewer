import type { AppLogger } from '@claude-code-changelog-viewer/common';
import type { IssueCorpusEntry } from '@claude-code-changelog-viewer/types';
import type { AnalyzedChangelogEntry } from '../domain/analysis/analyzed-changelog-entry';
import type { ChangelogAnalysis } from '../domain/analysis/changelog-analysis';
import { createChangelogAnalysis } from '../domain/analysis/changelog-analysis';
import type { RelatedIssue } from '../domain/analysis/related-issue';
import { extractDirectIssueReferences } from '../domain/tie-issue/direct-reference';
import { type IssueEmbedding, topKCosine } from '../domain/tie-issue/cosine';
import {
  fuseAndPickTop,
  type CandidateForFusion,
} from '../domain/tie-issue/score-fusion';
import {
  countSharedStrongTokens,
  type StrongTokenDictionary,
} from '../domain/tie-issue/strong-token-dictionary';

const COSINE_TOP_K = 20;

export type IssueCorpusReader = {
  loadEntry(issueNumber: number): Promise<IssueCorpusEntry | null>;
  listStoredNumbers(): Promise<number[]>;
};

export type EmbedTextPort = {
  batchEmbedContents(texts: string[]): Promise<number[][]>;
};

export type TieIssuesInput = {
  analysis: ChangelogAnalysis;
  corpus: IssueCorpusReader;
  issueEmbeddings: IssueEmbedding[];
  embed: EmbedTextPort;
  dictionary: StrongTokenDictionary;
  logger: AppLogger;
};

export async function tieIssues(
  input: TieIssuesInput,
): Promise<ChangelogAnalysis> {
  const items = input.analysis.items;
  if (items.length === 0) {
    return input.analysis;
  }

  // CHANGELOG 項目を一括 embed（Gemini batch は最大 100 texts/req）
  const changelogEmbeddings = await embedItemContents(items, input.embed);

  const tiedItems: AnalyzedChangelogEntry[] = [];
  for (let i = 0; i < items.length; i += 1) {
    const entry = items[i];
    if (!entry) {
      continue;
    }
    const changelogEmbedding = changelogEmbeddings[i];
    const related = await tieOneEntry({
      entry,
      changelogEmbedding: changelogEmbedding ?? [],
      corpus: input.corpus,
      issueEmbeddings: input.issueEmbeddings,
      dictionary: input.dictionary,
    });
    tiedItems.push({ ...entry, relatedIssues: related });
  }

  input.logger.info(
    `tie-issue 完了: items=${items.length} tied=${tiedItems.filter((e) => e.relatedIssues.length > 0).length}`,
  );

  return createChangelogAnalysis({
    version: input.analysis.version,
    ...(input.analysis.summary !== undefined
      ? { summary: input.analysis.summary }
      : {}),
    items: tiedItems,
  });
}

async function embedItemContents(
  items: readonly AnalyzedChangelogEntry[],
  embed: EmbedTextPort,
): Promise<number[][]> {
  const texts = items.map((entry) => entry.content as string);
  const batches: number[][][] = [];
  const BATCH_SIZE = 100;
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const chunk = texts.slice(i, i + BATCH_SIZE);
    const vectors = await embed.batchEmbedContents(chunk);
    batches.push(vectors);
  }
  return batches.flat();
}

async function tieOneEntry(input: {
  entry: AnalyzedChangelogEntry;
  changelogEmbedding: number[];
  corpus: IssueCorpusReader;
  issueEmbeddings: IssueEmbedding[];
  dictionary: StrongTokenDictionary;
}): Promise<RelatedIssue[]> {
  const content = input.entry.content as string;

  const directNumbers = extractDirectIssueReferences(content);
  const cosineHits = topKCosine(
    input.changelogEmbedding,
    input.issueEmbeddings,
    COSINE_TOP_K,
  );

  const candidateNumbers = new Set<number>([
    ...directNumbers,
    ...cosineHits.map((h) => h.number),
  ]);

  const cosineByNumber = new Map(cosineHits.map((h) => [h.number, h.score]));
  const directSet = new Set(directNumbers);

  const candidates: CandidateForFusion[] = [];
  for (const number of candidateNumbers) {
    const entry = await input.corpus.loadEntry(number);
    if (!entry) {
      continue;
    }
    const issueText = buildIssueSearchText(entry);
    const strongToken = countSharedStrongTokens(
      content,
      issueText,
      input.dictionary,
    );
    candidates.push({
      entry,
      lanes: {
        hasNnn: directSet.has(number) ? 1 : 0,
        strongToken,
        cosine: cosineByNumber.get(number) ?? 0,
      },
    });
  }

  return fuseAndPickTop(candidates);
}

function buildIssueSearchText(entry: IssueCorpusEntry): string {
  const parts: string[] = [entry.title, entry.body];
  for (const comment of entry.top_comments) {
    parts.push(comment.body);
  }
  return parts.join('\n\n');
}
