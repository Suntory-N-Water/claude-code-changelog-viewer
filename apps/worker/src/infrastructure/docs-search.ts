import { sql } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';

const MAX_FILES = 3;
const MAX_CHUNKS_PER_FILE = 3;
const MAX_SNIPPET_CHARS = 4000;

// 実データで確認された言い換えのみ。どちらか一方が含まれていればもう一方を補う
const SYNONYM_PAIRS: [string, string][] = [
  ['session', 'conversation'],
  ['harness', 'cli'],
  ['hook', 'hooks'],
  ['subagent', 'sub-agent'],
  ['mcp', 'model context protocol'],
  ['headless', 'non-interactive'],
  ['slash command', 'custom command'],
];

// spaCy (en) の STOP_WORDS から短縮形を除いたもの。旧 Python 版の MIN_FILE_SCORE は
// この一覧で除いたクエリを前提に決めた値なので、語を足し引きすると足切り値も測り直しになる
const STOP_WORDS = new Set(
  `a about above across after afterwards again against all almost alone along
already also although always am among amongst amount an and another any anyhow
anyone anything anyway anywhere are around as at back be became because become
becomes becoming been before beforehand behind being below beside besides between
beyond both bottom but by call can cannot ca could did do does doing done down due
during each eight either eleven else elsewhere empty enough even ever every everyone
everything everywhere except few fifteen fifty first five for former formerly forty
four from front full further get give go had has have he hence her here hereafter
hereby herein hereupon hers herself him himself his how however hundred i if in
indeed into is it its itself keep last latter latterly least less just made make
many may me meanwhile might mine more moreover most mostly move much must my myself
name namely neither never nevertheless next nine no nobody none noone nor not nothing
now nowhere of off often on once one only onto or other others otherwise our ours
ourselves out over own part per perhaps please put quite rather re really regarding
same say see seem seemed seeming seems serious several she should show side since six
sixty so some somehow someone something sometime sometimes somewhere still such take
ten than that the their them themselves then thence there thereafter thereby therefore
therein thereupon these they third this those though three through throughout thru
thus to together too top toward towards twelve twenty two under until up unless upon
us used using various very via was we well were what whatever when whence whenever
where whereafter whereas whereby wherein whereupon wherever whether which while
whither who whoever whole whom whose why will with within without would yet you your
yours yourself yourselves`.split(/\s+/),
);

// 行頭の分類語は全項目の大半に付き、どのドキュメントにも頻出するため、残すと関係の薄いファイルを引き寄せる
const LEADING_PREFIX_WORDS = new Set([
  'added',
  'changed',
  'fixed',
  'improved',
  'updated',
  'removed',
  'enabled',
  'deprecated',
]);

// FTS5 の bm25() を正負反転した値。旧 Python 版 (rank_bm25) の MIN_FILE_SCORE=25 とは尺度が違うため、
// docs-search/evaluation の正解データで測り直した。適合率と「関連なし」判定の正解率が
// 両方とも旧 Python 版以上になるのは 20 前後だけで、18 では適合率が、22 では判定が旧版を下回る。
// ファイルの当落とスニペットの当落の両方に使う
const MIN_CHANGELOG_SCORE = 20;

// combined (path, content, chunk_index, score) を受け取り、
// ファイルごと・ファイル間の上位を SQL 内で絞り込む共通部分。
// hit_count は足切り前の件数を数える (旧 Python 版の hit_count と同じ意味)
function buildRankingSql(minScore: number | null): string {
  const qualifies = minScore === null ? '1' : `-score >= ${minScore}`;
  return `
ranked AS (
  SELECT
    path,
    content,
    ${qualifies} AS qualifies,
    ROW_NUMBER() OVER (PARTITION BY path ORDER BY score, chunk_index) AS chunk_rank,
    COUNT(*) OVER (PARTITION BY path) AS hit_count,
    MIN(score) OVER (PARTITION BY path) AS page_score
  FROM combined
),
ranked_pages AS (
  SELECT
    path,
    ROW_NUMBER() OVER (ORDER BY page_score, path) AS page_rank
  FROM (SELECT DISTINCT path, page_score FROM ranked WHERE qualifies)
)
SELECT ranked.path, ranked.content, ranked.hit_count
FROM ranked
JOIN ranked_pages ON ranked_pages.path = ranked.path
WHERE ranked.qualifies
  AND ranked.chunk_rank <= ${MAX_CHUNKS_PER_FILE}
  AND ranked_pages.page_rank <= ${MAX_FILES}
ORDER BY ranked_pages.page_rank, ranked.chunk_rank`;
}

// バッククォート囲みが1件でも当たったら BM25 側を採用しない。
// 採否の判断を呼び出し側に置くと、設定リファレンス生成と CHANGELOG 推論で挙動がずれるため SQL に閉じ込める。
// バッククォートは unicode61 の索引に残らず MATCH で表現できないため、instr() で本文を走査する
// (D1 は LIKE パターンが 50 バイトまでで、末端名 607 件のうち 11 件が超えるため LIKE は使えない)。
// exact 側は当落だけを決め、順位は fuzzy の BM25 から借りる。
// exact 単独では全行が同点になり、上位3ファイルがパス名の昇順で決まってしまう
type ChunkRow = {
  path: string;
  content: string;
  hit_count: number;
};

export type RelatedDoc = {
  file: string;
  snippets: string[];
  hitCount: number;
};

export async function searchDocsForSettingKey(
  db: DrizzleD1Database,
  leafName: string,
): Promise<RelatedDoc[]> {
  const words = expandSynonyms(leafName);
  if (words.length === 0) {
    return [];
  }

  const result = await db.all<ChunkRow>(
    sql`
      WITH fuzzy AS (
        SELECT path, content, chunk_index, bm25(page_chunks_fts) AS score
        FROM page_chunks_fts
        WHERE page_chunks_fts MATCH ${buildMatchExpression(words)}
      ),
      exact AS (
        SELECT
          page_chunks_fts.path,
          page_chunks_fts.content,
          page_chunks_fts.chunk_index,
          COALESCE(fuzzy.score, 0.0) AS score
        FROM page_chunks_fts
        LEFT JOIN fuzzy
          ON fuzzy.path = page_chunks_fts.path
          AND fuzzy.chunk_index = page_chunks_fts.chunk_index
        WHERE instr(page_chunks_fts.content, ${`\`${leafName}\``}) > 0
      ),
      combined AS (
        SELECT * FROM exact
        UNION ALL
        SELECT * FROM fuzzy WHERE NOT EXISTS (SELECT 1 FROM exact)
      ),
      ${sql.raw(buildRankingSql(null))}
    `,
  );
  return groupByFile(result, words);
}

// CHANGELOG の箇条書き1行はバッククォート囲みの優先を通さない。
// 現行も CHANGELOG 推論は BM25 だけを使っており、その動作に揃える。
// bm25() の値は索引全体の件数で決まり、数件しかない索引では 20 に届かないため、
// 足切り以外を確かめるテストは minScore に 0 を渡す
export async function searchDocsForChangelogEntry(
  db: DrizzleD1Database,
  entry: string,
  minScore = MIN_CHANGELOG_SCORE,
): Promise<RelatedDoc[]> {
  const words = expandSynonyms(removeChangelogNoise(entry));
  if (words.length === 0) {
    return [];
  }

  const result = await db.all<ChunkRow>(
    sql`
      WITH combined AS (
        SELECT path, content, chunk_index, bm25(page_chunks_fts) AS score
        FROM page_chunks_fts
        WHERE page_chunks_fts MATCH ${buildMatchExpression(words)}
      ),
      ${sql.raw(buildRankingSql(minScore))}
    `,
  );
  return groupByFile(result, words);
}

// "the" は全チャンクの 9 割近くに含まれ、OR でつなぐとどの項目も全ドキュメントに当たってしまう。
// 記号で区切った語がすべてストップワードの語だけを落とし、`--append-system-prompt` のような
// 記号入りの語はそのまま残してフレーズ一致に使う
function removeChangelogNoise(entry: string): string {
  const words = entry.split(/\s+/).filter((word) => {
    const tokens = splitIntoWords(word);
    return tokens.length > 0 && !tokens.every((token) => STOP_WORDS.has(token));
  });
  // `[VSCode] Fixed ...` のように分類語の前に対象のタグが付く項目がある
  const prefixIndex = words.findIndex((word) => !/^\[.*\]$/.test(word));
  if (LEADING_PREFIX_WORDS.has(splitIntoWords(words[prefixIndex] ?? '').join(' '))) {
    words.splice(prefixIndex, 1);
  }
  return words.join(' ');
}

// 語形の原形化は tokenizer の porter が索引側とクエリ側の両方に効くのでここでは行わない
function expandSynonyms(text: string): string[] {
  const lowered = text.toLowerCase();
  const additions: string[] = [];
  for (const [a, b] of SYNONYM_PAIRS) {
    if (lowered.includes(a) && !lowered.includes(b)) {
      additions.push(b);
    }
    if (lowered.includes(b) && !lowered.includes(a)) {
      additions.push(a);
    }
  }

  return [text, ...additions]
    .join(' ')
    .split(/\s+/)
    .filter((word) => word !== '');
}

// FTS5 はダブルクォートで囲んだ文字列を AND / OR / NOT / NEAR の予約語判定から外し、
// 記号もそのまま tokenizer に渡すため、任意の入力を囲めば構文エラーにならない。
// 空白区切りのままだと暗黙の AND になり長い文章で0件になるため、OR を明示する
function buildMatchExpression(words: string[]): string {
  return (
    words
      // FTS5 の文字列内でダブルクォート自身を表すには 2 個重ねる
      .map((word) => `"${word.replaceAll('"', '""')}"`)
      .join(' OR ')
  );
}

// SQL 側が page_rank, chunk_rank 順に返すため、同じ path は必ず連続する。
// 直前の1件だけを見て畳み込めるのはこの並び順が前提
function groupByFile(rows: ChunkRow[], queryWords: string[]): RelatedDoc[] {
  const querySet = new Set(splitIntoWords(queryWords.join(' ')));
  const docs: RelatedDoc[] = [];

  for (const row of rows) {
    const snippet = selectParagraphs(row.content, querySet);
    const current = docs.at(-1);
    if (current?.file === row.path) {
      current.snippets.push(snippet);
      continue;
    }
    docs.push({
      file: row.path,
      snippets: [snippet],
      hitCount: row.hit_count,
    });
  }

  return docs;
}

// チャンクは分割が段落境界だけのため長さに上限がなく、本番では最大 116,749 字になる。
// 全文を渡すと後段の LLM への入力が肥大化するので、段落単位で落とす
function selectParagraphs(content: string, querySet: Set<string>): string {
  const paragraphs = content.split(/\n\s*\n/).filter((part) => part.trim() !== '');

  if (paragraphs.length <= 2) {
    return truncateAtLineBoundary(content, MAX_SNIPPET_CHARS);
  }

  // 見出しと導入段落は検索語を含まなくても文脈として要るので必ず残す
  let densest = -1;
  let highestDensity = 0;
  for (let index = 2; index < paragraphs.length; index += 1) {
    const density = splitIntoWords(paragraphs[index] ?? '').filter((word) =>
      querySet.has(word),
    ).length;
    if (density > highestDensity) {
      highestDensity = density;
      densest = index;
    }
  }

  const context = paragraphs.slice(0, 2).join('\n\n');
  if (densest === -1) {
    return truncateAtLineBoundary(context, MAX_SNIPPET_CHARS);
  }

  // 検索語を含む段落を先に予算取りし、長い導入段落があっても落とさない
  const relevant = truncateAtLineBoundary(paragraphs[densest] ?? '', MAX_SNIPPET_CHARS);
  const contextBudget = Math.max(0, MAX_SNIPPET_CHARS - relevant.length - 2);
  const truncatedContext = truncateAtLineBoundary(context, contextBudget);
  return [truncatedContext, relevant].filter((paragraph) => paragraph !== '').join('\n\n');
}

function truncateAtLineBoundary(content: string, maxChars: number): string {
  if (content.length <= maxChars) {
    return content;
  }

  const lines = content.split('\n');
  let length = 0;
  let endIndex = 0;
  for (const [index, line] of lines.entries()) {
    const nextLength = length + line.length + (index === 0 ? 0 : 1);
    if (nextLength > maxChars) {
      break;
    }
    length = nextLength;
    endIndex = index + 1;
  }

  return endIndex === 0 ? '' : lines.slice(0, endIndex).join('\n');
}

// 記号で切るので `key` や (key) のように装飾された語も本文と同じ形になる
function splitIntoWords(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word !== '');
}
