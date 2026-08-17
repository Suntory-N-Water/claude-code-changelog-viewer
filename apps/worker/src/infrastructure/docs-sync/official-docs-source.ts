import {
  cleanMarkdown,
  getLogger,
  toError,
} from '@claude-code-changelog-viewer/common';
import type {
  DocumentInfo,
  OfficialDocsSource,
  SettingSchemaSnapshot,
  StoredPage,
} from '../../usecases/sync-docs';
import {
  flattenSettingSchema,
  isSettingSchema,
  mergeDocumentLists,
  parseDocsMap,
  parseLlmsTxt,
} from './content';
import { sha256Hex } from '../crypto/sha256-hex';

const DOCS_MAP_URL = 'https://code.claude.com/docs/en/claude_code_docs_map.md';
const LLMS_URL = 'https://code.claude.com/docs/llms.txt';
const SCHEMA_URL = 'https://www.schemastore.org/claude-code-settings.json';
const USER_AGENT = 'changelog-viewer-worker-docs-sync';

const logger = getLogger({
  name: 'docs-search-sync',
  level: 'INFO',
  format: 'json',
});

/** 公式ドキュメントと SchemaStore を HTTP から取得する adapter。 */
export function createOfficialDocsSource(): OfficialDocsSource {
  return {
    async fetchDocumentList(): Promise<DocumentInfo[]> {
      const [docsMapContent, llmsContent] = await Promise.all([
        fetchText(DOCS_MAP_URL, 'text/markdown, text/plain, */*'),
        fetchText(LLMS_URL, 'text/markdown, text/plain, */*'),
      ]);

      return mergeDocumentLists(
        parseDocsMap(docsMapContent),
        parseLlmsTxt(llmsContent),
      );
    },

    async fetchPage(document): Promise<StoredPage> {
      try {
        const markdown = await fetchText(
          document.url,
          'text/markdown, text/plain, */*',
        );
        const content =
          `---\ntitle: ${document.title}\nsource: ${document.url}\n---\n\n` +
          (await cleanMarkdown(markdown));

        return {
          ...document,
          content,
          contentHash: await sha256Hex(content),
        };
      } catch (error) {
        const normalizedError = toError(error);
        logger.warn('ドキュメントの取得をスキップしました', {
          path: document.path,
          'exception.message': normalizedError.message,
        });
        throw normalizedError;
      }
    },

    async fetchSettingSchema(): Promise<SettingSchemaSnapshot> {
      const rawSchema = await fetchText(SCHEMA_URL, 'application/json, */*');
      const contentHash = await sha256Hex(rawSchema);

      let schema: unknown;
      try {
        schema = JSON.parse(rawSchema);
      } catch (error) {
        throw new Error(
          `設定スキーマの JSON パースに失敗しました: ${toError(error).message}`,
        );
      }

      if (!isSettingSchema(schema)) {
        throw new Error('設定スキーマの形式が不正です');
      }

      return {
        contentHash,
        entries: flattenSettingSchema(schema),
      };
    },
  };
}

async function fetchText(url: string, accept: string): Promise<string> {
  const maxRetries = 3;
  const retryDelayMs = 1000;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: accept,
          'User-Agent': USER_AGENT,
        },
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.text();
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }

      logger.warn('HTTP 取得を再試行します', {
        url,
        attempt: attempt + 1,
        maxRetries,
      });
      await new Promise((resolve) =>
        setTimeout(resolve, retryDelayMs * 2 ** attempt),
      );
    }
  }

  throw new Error(`HTTP 取得のリトライに失敗しました: ${url}`);
}
