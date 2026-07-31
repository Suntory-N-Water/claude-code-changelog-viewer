import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  getLogger,
  toError,
  type AppLogger,
} from '@claude-code-changelog-viewer/common';
import { z } from 'zod';
import { fetchWithRetry } from './fetch-with-retry';
import { atomicWriteFile } from './atomic-write';

const SCHEMA_URL = 'https://www.schemastore.org/claude-code-settings.json';
const SCHEMA_FILENAME = 'claude-code-settings.json';
const METADATA_FILENAME = 'last_schema_update.json';

const jsonObjectSchema = z.record(z.string(), z.unknown());

const schemaMetadataSchema = z.object({
  lastUpdated: z.string(),
  propertyCount: z.number(),
  previousPropertyCount: z.number().optional(),
  addedProperties: z.array(z.string()).optional(),
  removedProperties: z.array(z.string()).optional(),
  schemaUrl: z.string(),
});

type SchemaMetadata = z.infer<typeof schemaMetadataSchema>;
type JsonObject = z.infer<typeof jsonObjectSchema>;

export class SchemaFetcher {
  private readonly schemaDir: string;
  private readonly metadataDir: string;
  private readonly log: AppLogger;

  constructor(rootDir: string = '.') {
    this.schemaDir = path.join(rootDir, 'schema');
    this.metadataDir = path.join(rootDir, 'metadata');
    this.log = getLogger({ name: 'docs-tracker' }).child({
      component: 'SchemaFetcher',
    });
  }

  async init(): Promise<void> {
    await fs.mkdir(this.schemaDir, { recursive: true });
    await fs.mkdir(this.metadataDir, { recursive: true });
    this.log.msg('APLG0004', { params: ['スキーマディレクトリ'] });
  }

  private extractTopLevelProperties(schema: JsonObject): string[] {
    const properties = jsonObjectSchema.safeParse(schema['properties']);
    if (properties.success) {
      return Object.keys(properties.data).sort();
    }
    return [];
  }

  private async loadPreviousMetadata(): Promise<SchemaMetadata | null> {
    const metadataPath = path.join(this.metadataDir, METADATA_FILENAME);
    try {
      const content = await fs.readFile(metadataPath, 'utf-8');
      return schemaMetadataSchema.parse(JSON.parse(content));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      this.log.warn('前回の schema metadata を読み込めませんでした', {
        'file.path': metadataPath,
        'exception.message': toError(error).message,
      });
      return null;
    }
  }

  private async loadPreviousSchema(): Promise<JsonObject | null> {
    const schemaPath = path.join(this.schemaDir, SCHEMA_FILENAME);
    try {
      const content = await fs.readFile(schemaPath, 'utf-8');
      return jsonObjectSchema.parse(JSON.parse(content));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      this.log.warn('前回の schema JSON を読み込めませんでした', {
        'file.path': schemaPath,
        'exception.message': toError(error).message,
      });
      return null;
    }
  }

  async fetchSchema(): Promise<void> {
    this.log.msg('APLG0003', { params: ['settings.json スキーマ'] });

    await this.init();

    const previousSchema = await this.loadPreviousSchema();
    const previousMetadata = await this.loadPreviousMetadata();

    const response = await fetchWithRetry({
      accept: 'application/json, */*',
      url: SCHEMA_URL,
    });
    const rawJson = await response.text();

    let schema: JsonObject;
    try {
      schema = jsonObjectSchema.parse(JSON.parse(rawJson));
    } catch (error) {
      throw new Error(
        `スキーマの JSON パースに失敗: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    const schemaPath = path.join(this.schemaDir, SCHEMA_FILENAME);
    await atomicWriteFile(schemaPath, rawJson);
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
    await atomicWriteFile(metadataPath, JSON.stringify(metadata, null, 2));

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
