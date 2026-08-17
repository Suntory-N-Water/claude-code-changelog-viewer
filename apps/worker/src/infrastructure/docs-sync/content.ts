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

/** env-vars.md の Markdown テーブルから環境変数エントリを抽出する。 */
export function parseEnvVarsMd(
  markdown: string,
  pages: ReadonlyMap<string, string> = new Map(),
): SettingSchemaEntry[] {
  const { entries, rawDescriptions } = parseEnvTableRows(markdown);

  if (pages.size === 0) {
    return entries;
  }

  return entries.map((entry) => {
    const rawDescription = rawDescriptions.get(entry.key);
    if (rawDescription === undefined) {
      return entry;
    }

    const pureSeeMatch = rawDescription
      .trim()
      .match(/^See \[.+\]\((\/en\/.+)\)$/);
    if (pureSeeMatch === null) {
      return entry;
    }

    const linkTarget = pureSeeMatch[1];
    if (linkTarget === undefined) {
      return entry;
    }

    const [relativeDocPath, anchorFragment = ''] = linkTarget
      .replace(/^\/en\//, '')
      .split('#');
    if (relativeDocPath === undefined) {
      return entry;
    }

    const docPath = relativeDocPath.endsWith('.md')
      ? relativeDocPath
      : `${relativeDocPath}.md`;
    const content = pages.get(docPath);
    if (content === undefined) {
      return entry;
    }

    const section = anchorFragment
      ? findSectionByAnchor(content, anchorFragment)
      : (findSectionByAnchor(content, 'environment-variables') ?? content);
    if (section === null) {
      return entry;
    }

    const directDescription = resolveDescriptionFromSection(entry.key, section);
    if (directDescription !== null) {
      return { ...entry, description: directDescription };
    }

    const fallbackMatch = entry.key.match(
      /^ANTHROPIC_DEFAULT_([A-Z]+)_MODEL(?:_(NAME|DESCRIPTION|SUPPORTED_CAPABILITIES))?$/,
    );
    if (fallbackMatch !== null) {
      const tierName = fallbackMatch[1];
      const suffix = fallbackMatch[2] ?? '';
      if (tierName !== undefined) {
        const displayTierName = tierName[0] + tierName.slice(1).toLowerCase();
        const fallbackKey = `ANTHROPIC_DEFAULT_OPUS_MODEL${suffix ? `_${suffix}` : ''}`;
        const fallbackDescription = resolveDescriptionFromSection(
          fallbackKey,
          section,
        );
        if (fallbackDescription !== null) {
          return {
            ...entry,
            description: fallbackDescription.replace(/Opus/g, displayTierName),
          };
        }
      }
    }

    if (entry.key === 'ANTHROPIC_CUSTOM_MODEL_OPTION_SUPPORTED_CAPABILITIES') {
      const fallbackDescription = resolveDescriptionFromSection(
        'ANTHROPIC_DEFAULT_OPUS_MODEL_SUPPORTED_CAPABILITIES',
        section,
      );
      if (fallbackDescription !== null) {
        return {
          ...entry,
          description: fallbackDescription.replace(
            /pinned Opus model/g,
            'custom model option',
          ),
        };
      }
    }

    return entry;
  });
}

/** docs/en 本文にある公開環境変数の言及から環境変数エントリを抽出する。 */
export function parsePublicEnvEntriesFromDocs(
  pages: ReadonlyMap<string, string>,
): SettingSchemaEntry[] {
  const entries: SettingSchemaEntry[] = [];

  for (const [file, content] of pages) {
    const filename = file.split('/').at(-1);
    if (filename === 'changelog.md' || filename === 'env-vars.md') {
      continue;
    }

    entries.push(
      ...parseEnvTableRows(content, { environmentTableOnly: true }).entries,
    );
    entries.push(...extractPublicEnvMentions(content));
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

function isEnvName(value: string): boolean {
  return /^[A-Z_][A-Z0-9_]*$/.test(value);
}

function isLikelyPublicEnvName(value: string): boolean {
  if (!isEnvName(value) || value.length === 1) {
    return false;
  }

  return (
    /^(?:ANTHROPIC_|AWS_|BETA_|CLAUDE_|CLOUD_|DISABLE_|ENABLE_|GCLOUD_|GOOGLE_|OTEL_)/.test(
      value,
    ) || new Set(['TRACEPARENT', 'TRACESTATE']).has(value)
  );
}

function stripMarkdown(value: string): string {
  return value
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\\_/g, '_')
    .trim();
}

type EnvTableParseResult = {
  entries: SettingSchemaEntry[];
  rawDescriptions: Map<string, string>;
};

function parseEnvTableRows(
  markdown: string,
  opts: { environmentTableOnly?: boolean } = {},
): EnvTableParseResult {
  const entries: SettingSchemaEntry[] = [];
  const rawDescriptions = new Map<string, string>();
  let inEnvironmentTable = false;

  for (const line of markdown.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('|')) {
      const cells = trimmed
        .split('|')
        .slice(1, -1)
        .map((cell) => stripMarkdown(cell).toLowerCase());
      if (cells.some((cell) => /^environment variables?$/.test(cell))) {
        inEnvironmentTable = true;
        continue;
      }
    } else {
      inEnvironmentTable = false;
    }

    if (opts.environmentTableOnly && !inEnvironmentTable) {
      continue;
    }

    const match = trimmed.match(/^\|\s*`([A-Z_][A-Z0-9_]*)`\s*\|(.+)$/);
    if (!match?.[1] || !match[2]) {
      continue;
    }

    const descriptionRaw = match[2].split('|')[0]?.trim() ?? '';
    const description = stripMarkdown(descriptionRaw);
    rawDescriptions.set(match[1], descriptionRaw);
    entries.push(createEnvironmentSettingSchemaEntry(match[1], description));

    if (
      /(?:also accepted|older name|legacy name|alias)/i.test(descriptionRaw)
    ) {
      for (const aliasMatch of descriptionRaw.matchAll(
        /`([A-Z_][A-Z0-9_]*)`/g,
      )) {
        const key = aliasMatch[1];
        if (key && key !== match[1]) {
          rawDescriptions.set(key, descriptionRaw);
          entries.push(createEnvironmentSettingSchemaEntry(key, description));
        }
      }
    }
  }

  return { entries, rawDescriptions };
}

function createEnvironmentSettingSchemaEntry(
  key: string,
  description: string,
): SettingSchemaEntry {
  return {
    key,
    source: 'env',
    description,
    parentDescriptions: '[]',
    valueType: '',
    defaultValue: null,
    enumValues: null,
  };
}

function extractPublicEnvMentions(markdown: string): SettingSchemaEntry[] {
  const entries: SettingSchemaEntry[] = [];
  const lines = markdown.split('\n');

  for (const [index, line] of lines.entries()) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    const keys = extractPublicEnvKeysFromLine(trimmed);
    if (keys.length === 0) {
      continue;
    }

    for (const key of keys) {
      entries.push(
        createEnvironmentSettingSchemaEntry(
          key,
          findNearbyDescription(lines, index, key),
        ),
      );
    }
  }

  return entries;
}

function extractPublicEnvKeysFromLine(line: string): string[] {
  const keys = new Set<string>();
  const envPhrase =
    /Claude Code[^.]*\b(?:uses|reads|exports|injects|forwards|inherits)|\b(?:CLI|SDK)[^.]*\b(?:uses|reads|exports|injects|forwards|inherits)|\b(?:Claude Code|CLI|SDK)[^.]*\brequires/i;
  if (envPhrase.test(line)) {
    for (const match of line.matchAll(/`([A-Z_][A-Z0-9_]*)(?:=[^`]*)?`/g)) {
      const key = match[1];
      if (key && isLikelyPublicEnvName(key)) {
        keys.add(key);
      }
    }
  }

  return [...keys];
}

function findNearbyDescription(
  lines: string[],
  index: number,
  key: string,
): string {
  const candidates = [
    lines[index],
    lines[index - 1],
    lines[index - 2],
    lines[index + 1],
  ];

  for (const candidate of candidates) {
    const stripped = stripMarkdown(candidate ?? '');
    if (
      stripped &&
      !stripped.startsWith('```') &&
      (stripped.includes(key) ||
        /environment variable|Claude Code/i.test(stripped))
    ) {
      return stripped;
    }
  }

  return key;
}

function findSectionByAnchor(content: string, anchor: string): string | null {
  const targetAnchor = anchor.replace(/^#/, '').trim().toLowerCase();
  const lines = content.split('\n');
  let sectionStart = -1;
  let sectionLevel = 0;

  const toAnchor = (value: string): string =>
    value
      .trim()
      .toLowerCase()
      .replace(/[`]/g, '')
      .replace(/<[^>]+>/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index]?.match(/^(#{1,6})\s+(.+?)\s*$/);
    if (match == null) {
      continue;
    }

    const headingMarker = match[1];
    const headingText = match[2];
    if (headingMarker === undefined || headingText === undefined) {
      continue;
    }

    const level = headingMarker.length;
    if (sectionStart !== -1 && level <= sectionLevel) {
      return lines.slice(sectionStart, index).join('\n').trim();
    }

    if (toAnchor(headingText) === targetAnchor) {
      sectionStart = index + 1;
      sectionLevel = level;
    }
  }

  return sectionStart === -1
    ? null
    : lines.slice(sectionStart).join('\n').trim();
}

function resolveDescriptionFromSection(
  envKey: string,
  section: string,
): string | null {
  for (const line of section.split('\n')) {
    const trimmed = line.trim();
    const match = trimmed.match(/^\|\s*`([A-Z_][A-Z0-9_]*)`\s*\|(.+)$/);
    if (match?.[1] !== envKey || !match[2]) {
      continue;
    }

    const descriptionRaw = match[2].split('|')[0]?.trim() ?? '';
    return stripMarkdown(descriptionRaw);
  }

  return null;
}
