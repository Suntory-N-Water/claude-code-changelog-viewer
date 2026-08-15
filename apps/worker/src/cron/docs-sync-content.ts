const DOCUMENT_PATH_PATTERN = /\/docs\/en\/(.+\.md)/;
const DOCUMENT_LINK_PATTERN = /\[([^\]]+)\]\((https:\/\/[^)]+\.md)\)/g;
const LLMS_URL_PATTERN =
  /https:\/\/code\.claude\.com\/docs\/en\/([^\s)]+\.md)/g;
const FENCE_PATTERN = /^\s*```/;
const HEADING_PATTERN = /^(#{1,6})\s+(.*)$/;
const EXCLUDED_DOCUMENT_NAME = 'changelog.md';

const SECONDARY_SPLIT_THRESHOLD = 2000;

export type DocumentInfo = {
  title: string;
  url: string;
  path: string;
};

export type PageChunk = {
  heading: string;
  text: string;
  startLine: number;
};

export type SettingSchemaEntry = {
  key: string;
  source: 'settings' | 'env';
  description: string;
  parentDescriptions: string;
  valueType: string;
  defaultValue: string | null;
  enumValues: string | null;
};

type MarkdownLine = {
  lineNumber: number;
  text: string;
};

type JsonObject = Record<string, unknown>;

type CollectLeafContext = {
  keyPath: string;
  source: 'settings' | 'env';
  parentDescriptions: string[];
  entries: SettingSchemaEntry[];
};

type SettingSchemaEntryInput = {
  key: string;
  source: 'settings' | 'env';
  value: unknown;
  parentDescriptions: string[];
};

export function documentPathFromUrl(url: string): string {
  const captured = url.match(DOCUMENT_PATH_PATTERN)?.[1];
  if (captured !== undefined) {
    return captured.split(/[?#]/)[0] ?? captured;
  }

  const lastPart = url.split('/').at(-1) ?? '';
  const filename = lastPart.split(/[?#]/)[0] ?? '';
  return filename.endsWith('.md') ? filename : `${filename}.md`;
}

export function parseDocsMap(content: string): DocumentInfo[] {
  const documents: DocumentInfo[] = [];

  for (const line of content.split('\n')) {
    DOCUMENT_LINK_PATTERN.lastIndex = 0;
    let match = DOCUMENT_LINK_PATTERN.exec(line);
    while (match !== null) {
      const title = match[1];
      const url = match[2];
      if (title !== undefined && url !== undefined) {
        documents.push({
          title: title.trim(),
          url,
          path: documentPathFromUrl(url),
        });
      }
      match = DOCUMENT_LINK_PATTERN.exec(line);
    }
  }

  return documents;
}

export function parseLlmsTxt(content: string): DocumentInfo[] {
  const documents: DocumentInfo[] = [];
  LLMS_URL_PATTERN.lastIndex = 0;
  let match = LLMS_URL_PATTERN.exec(content);

  while (match !== null) {
    const url = match[0];
    const pathPart = match[1];
    if (url !== undefined && pathPart !== undefined) {
      const title = pathPart.replace(/\.md$/, '').split('/').at(-1) ?? pathPart;
      documents.push({
        title,
        url,
        path: documentPathFromUrl(url),
      });
    }
    match = LLMS_URL_PATTERN.exec(content);
  }

  return documents;
}

export function mergeDocumentLists(
  docsMapDocuments: DocumentInfo[],
  llmsDocuments: DocumentInfo[],
): DocumentInfo[] {
  const urlMap = new Map<string, DocumentInfo>();
  const filenameMap = new Map<string, string>();

  for (const document of llmsDocuments) {
    const key = document.url.toLowerCase();
    const filename = document.path.split('/').at(-1) ?? '';
    urlMap.set(key, document);
    filenameMap.set(filename.toLowerCase(), key);
  }

  for (const document of docsMapDocuments) {
    const key = document.url.toLowerCase();
    const filename = document.path.split('/').at(-1) ?? '';
    const filenameKey = filename.toLowerCase();

    if (urlMap.has(key)) {
      const existing = urlMap.get(key);
      if (existing !== undefined && document.title !== existing.title) {
        urlMap.set(key, { ...existing, title: document.title });
      }
      continue;
    }

    const existingUrl = filenameMap.get(filenameKey);
    if (existingUrl !== undefined) {
      const existing = urlMap.get(existingUrl);
      if (existing !== undefined && document.title !== existing.title) {
        urlMap.set(existingUrl, { ...existing, title: document.title });
      }
      continue;
    }

    urlMap.set(key, document);
    filenameMap.set(filenameKey, key);
  }

  return [...urlMap.values()].filter(
    (document) => document.path.split('/').at(-1) !== EXCLUDED_DOCUMENT_NAME,
  );
}

export function chunkMarkdown(content: string): PageChunk[] {
  const lines = content.split(/\r?\n/);
  if (lines.at(-1) === '') {
    lines.pop();
  }

  const chunks: PageChunk[] = [];
  let heading = '';
  let buffer: MarkdownLine[] = [];
  let inFence = false;

  for (const [index, line] of lines.entries()) {
    const lineNumber = index + 1;
    if (FENCE_PATTERN.test(line)) {
      inFence = !inFence;
      buffer.push({ lineNumber, text: line });
      continue;
    }

    const headingMatch = inFence ? null : line.match(HEADING_PATTERN);
    if (headingMatch !== null) {
      chunks.push(
        ...splitBuffer(buffer, SECONDARY_SPLIT_THRESHOLD).map((split) => ({
          heading,
          text: split.text,
          startLine: split.startLine,
        })),
      );
      heading = headingMatch[2]?.trim() ?? '';
      buffer = [{ lineNumber, text: line }];
      continue;
    }

    buffer.push({ lineNumber, text: line });
  }

  chunks.push(
    ...splitBuffer(buffer, SECONDARY_SPLIT_THRESHOLD).map((split) => ({
      heading,
      text: split.text,
      startLine: split.startLine,
    })),
  );
  return chunks;
}

function splitBuffer(
  buffer: MarkdownLine[],
  threshold: number,
): Array<{ startLine: number; text: string }> {
  const fullText = buffer
    .map((line) => line.text)
    .join('\n')
    .trim();
  if (fullText === '') {
    return [];
  }

  const firstLine = buffer[0];
  if (firstLine === undefined) {
    return [];
  }

  if (fullText.length <= threshold) {
    return [{ startLine: firstLine.lineNumber, text: fullText }];
  }

  const segments: Array<{ startLine: number; text: string }> = [];
  let current: MarkdownLine[] = [];
  let currentSize = 0;
  let inFence = false;

  const emit = () => {
    if (current.length === 0) {
      return;
    }
    const text = current
      .map((line) => line.text)
      .join('\n')
      .trim();
    const currentFirstLine = current[0];
    if (text !== '' && currentFirstLine !== undefined) {
      segments.push({ startLine: currentFirstLine.lineNumber, text });
    }
    current = [];
    currentSize = 0;
  };

  for (const line of buffer) {
    if (FENCE_PATTERN.test(line.text)) {
      inFence = !inFence;
      current.push(line);
      currentSize += line.text.length + 1;
      continue;
    }

    if (!inFence && line.text.trim() === '' && currentSize >= threshold) {
      emit();
      continue;
    }

    current.push(line);
    currentSize += line.text.length + 1;
  }

  emit();
  return segments.length > 0
    ? segments
    : [{ startLine: firstLine.lineNumber, text: fullText }];
}

export function flattenSettingSchema(schema: unknown): SettingSchemaEntry[] {
  if (!isJsonObject(schema)) {
    return [];
  }

  const properties = isJsonObject(schema['properties'])
    ? schema['properties']
    : {};
  const entries: SettingSchemaEntry[] = [];

  for (const [key, value] of Object.entries(properties)) {
    if (key === '$schema') {
      continue;
    }

    if (key === 'env') {
      const envProperties = isJsonObject(value)
        ? isJsonObject(value['properties'])
          ? value['properties']
          : {}
        : {};
      for (const [envKey, envValue] of Object.entries(envProperties)) {
        entries.push(
          createSettingSchemaEntry({
            key: envKey,
            source: 'env',
            value: envValue,
            parentDescriptions: [],
          }),
        );
      }
      continue;
    }

    collectLeafEntries(value, {
      keyPath: key,
      source: 'settings',
      parentDescriptions: [],
      entries,
    });
  }

  return entries;
}

export function isSettingSchema(
  value: unknown,
): value is JsonObject & { properties: JsonObject } {
  return isJsonObject(value) && isJsonObject(value['properties']);
}

function collectLeafEntries(value: unknown, context: CollectLeafContext): void {
  const { keyPath, source, parentDescriptions, entries } = context;
  const node = isJsonObject(value) ? value : {};
  const properties = isJsonObject(node['properties'])
    ? node['properties']
    : null;
  if (properties === null) {
    entries.push(
      createSettingSchemaEntry({
        key: keyPath,
        source,
        value: node,
        parentDescriptions,
      }),
    );
    return;
  }

  const currentParentDescriptions =
    typeof node['description'] === 'string'
      ? [...parentDescriptions, node['description']]
      : parentDescriptions;

  for (const [childKey, childValue] of Object.entries(properties)) {
    collectLeafEntries(childValue, {
      keyPath: keyPath ? `${keyPath}.${childKey}` : childKey,
      source,
      parentDescriptions: currentParentDescriptions,
      entries,
    });
  }
}

function createSettingSchemaEntry({
  key,
  source,
  value,
  parentDescriptions,
}: SettingSchemaEntryInput): SettingSchemaEntry {
  const node = isJsonObject(value) ? value : {};
  const type = node['type'];
  const valueType =
    typeof type === 'string'
      ? type
      : Array.isArray(type)
        ? JSON.stringify(type)
        : '';
  const defaultValue = Object.hasOwn(node, 'default')
    ? (JSON.stringify(node['default']) ?? null)
    : null;
  const enumValues = Array.isArray(node['enum'])
    ? JSON.stringify(node['enum'].map((item) => String(item)))
    : null;

  return {
    key,
    source,
    description:
      typeof node['description'] === 'string' ? node['description'] : '',
    parentDescriptions: JSON.stringify(parentDescriptions),
    valueType,
    defaultValue,
    enumValues,
  };
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
