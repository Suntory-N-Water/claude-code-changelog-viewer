import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { AppLogger } from '@claude-code-changelog-viewer/common';

const SCHEMA_URL = 'https://www.schemastore.org/claude-code-settings.json';
const SCHEMA_FILENAME = 'claude-code-settings.json';
const METADATA_FILENAME = 'last_schema_update.json';

type SchemaMetadata = {
  lastUpdated: string;
  propertyCount: number;
  previousPropertyCount?: number;
  addedProperties?: string[];
  removedProperties?: string[];
  schemaUrl: string;
};

export class SchemaFetcher {
  private readonly schemaDir: string;
  private readonly metadataDir: string;
  private readonly log: AppLogger;
  private readonly maxRetries = 3;
  private readonly retryDelay = 1000;

  constructor(rootDir: string = '.', logger: AppLogger) {
    this.schemaDir = path.join(rootDir, 'schema');
    this.metadataDir = path.join(rootDir, 'metadata');
    this.log = logger.child({ component: 'SchemaFetcher' });
  }

  async init(): Promise<void> {
    await fs.mkdir(this.schemaDir, { recursive: true });
    await fs.mkdir(this.metadataDir, { recursive: true });
    this.log.msg('APLG0004', { params: ['スキーマディレクトリ'] });
  }

  private async fetchWithRetry(url: string, retries = 0): Promise<Response> {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Claude-Code-Changelog-Viewer/1.0',
          Accept: 'application/json, */*',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response;
    } catch (error) {
      if (retries < this.maxRetries) {
        this.log.msg('APLG0014', {
          attrs: {
            'retry.attempt': retries + 1,
            'retry.max': this.maxRetries,
            'request.url': url,
          },
        });
        await new Promise((resolve) =>
          setTimeout(resolve, this.retryDelay * 2 ** retries),
        );
        return this.fetchWithRetry(url, retries + 1);
      }
      throw error;
    }
  }

  private extractTopLevelProperties(schema: Record<string, unknown>): string[] {
    const properties = schema['properties'];
    if (
      properties &&
      typeof properties === 'object' &&
      !Array.isArray(properties)
    ) {
      return Object.keys(properties as Record<string, unknown>).sort();
    }
    return [];
  }

  private async loadPreviousMetadata(): Promise<SchemaMetadata | null> {
    const metadataPath = path.join(this.metadataDir, METADATA_FILENAME);
    try {
      const content = await fs.readFile(metadataPath, 'utf-8');
      return JSON.parse(content) as SchemaMetadata;
    } catch {
      return null;
    }
  }

  private async loadPreviousSchema(): Promise<Record<string, unknown> | null> {
    const schemaPath = path.join(this.schemaDir, SCHEMA_FILENAME);
    try {
      const content = await fs.readFile(schemaPath, 'utf-8');
      return JSON.parse(content) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  async fetchSchema(): Promise<void> {
    this.log.msg('APLG0003', { params: ['settings.json スキーマ'] });

    await this.init();

    const previousSchema = await this.loadPreviousSchema();
    const previousMetadata = await this.loadPreviousMetadata();

    const response = await this.fetchWithRetry(SCHEMA_URL);
    const rawJson = await response.text();

    let schema: Record<string, unknown>;
    try {
      schema = JSON.parse(rawJson) as Record<string, unknown>;
    } catch (error) {
      throw new Error(
        `スキーマの JSON パースに失敗: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    const schemaPath = path.join(this.schemaDir, SCHEMA_FILENAME);
    await fs.writeFile(schemaPath, rawJson, 'utf-8');
    this.log.msg('APLG0007', { params: ['スキーマ'] });

    const currentProperties = this.extractTopLevelProperties(schema);
    const prevProperties = previousSchema
      ? this.extractTopLevelProperties(previousSchema)
      : [];
    const previousSet = new Set(prevProperties);
    const currentSet = new Set(currentProperties);

    const addedProperties = currentProperties.filter(
      (p) => !previousSet.has(p),
    );
    const removedProperties = prevProperties.filter((p) => !currentSet.has(p));

    if (addedProperties.length > 0) {
      this.log.msg('APLG0009', {
        attrs: {
          'schema.added': addedProperties.join(', '),
          'schema.addedCount': addedProperties.length,
        },
      });
    }

    if (removedProperties.length > 0) {
      this.log.msg('APLG0009', {
        attrs: {
          'schema.removed': removedProperties.join(', '),
          'schema.removedCount': removedProperties.length,
        },
      });
    }

    const now = `${new Date().toISOString().replace('T', ' ').substring(0, 19)} UTC`;
    const metadata: SchemaMetadata = {
      lastUpdated: now,
      propertyCount: currentProperties.length,
      ...(previousMetadata !== null && {
        previousPropertyCount: previousMetadata.propertyCount,
      }),
      addedProperties,
      removedProperties,
      schemaUrl: SCHEMA_URL,
    };

    const metadataPath = path.join(this.metadataDir, METADATA_FILENAME);
    await fs.writeFile(
      metadataPath,
      JSON.stringify(metadata, null, 2),
      'utf-8',
    );

    this.log.msg('APLG0002', {
      params: ['スキーマ取得'],
      attrs: {
        'schema.propertyCount': currentProperties.length,
        'schema.addedCount': addedProperties.length,
        'schema.removedCount': removedProperties.length,
      },
    });
  }
}
