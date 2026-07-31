import { globSync, readFileSync } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { SettingSource } from '../../domain/settings-reference/setting-key';
import { createSettingKey } from '../../domain/settings-reference/setting-key';
import type { RawSettingsEntries } from '../../usecase/generate-settings-reference';
import {
  createSettingsEntry,
  type SettingsEntry,
} from '../../domain/settings-reference/setting-entry';

type SchemaEnvProperty = {
  description?: string;
  type?: string;
  default?: unknown;
  enum?: unknown[];
};

type SchemaProperty = {
  description?: string;
  type?: string;
  default?: unknown;
  enum?: unknown[];
  properties?: Record<string, SchemaProperty>;
  items?: SchemaProperty;
};

type SettingsJsonSchema = {
  properties?: Record<string, SchemaProperty>;
};

type CollectLeafCtx = {
  parentDescriptions: string[];
  source: SettingSource;
  schemaInfoMap: Map<string, { schemaDefault?: string; schemaEnum?: string[] }>;
};

function extractSchemaInfo(obj: {
  default?: unknown;
  enum?: unknown[];
}): { schemaDefault?: string; schemaEnum?: string[] } | undefined {
  const schemaDefault =
    obj.default !== undefined ? JSON.stringify(obj.default) : undefined;
  const schemaEnum =
    obj.enum !== undefined ? obj.enum.map((v) => String(v)) : undefined;
  if (schemaDefault === undefined && schemaEnum === undefined) {
    return;
  }
  const info: { schemaDefault?: string; schemaEnum?: string[] } = {};
  if (schemaDefault !== undefined) {
    info.schemaDefault = schemaDefault;
  }
  if (schemaEnum !== undefined) {
    info.schemaEnum = schemaEnum;
  }
  return info;
}

/**
 * スキーマノードを再帰的に走査してリーフノードを収集する
 * リーフ = properties を持たないノード
 */
function collectLeafEntries(
  obj: SchemaProperty,
  keyPath: string,
  ctx: CollectLeafCtx,
): SettingsEntry[] {
  const results: SettingsEntry[] = [];

  if (!obj.properties) {
    results.push(
      createLoadedSettingsEntry({
        key: keyPath,
        source: ctx.source,
        descriptionEn: obj.description ?? '',
        parentDescriptions: ctx.parentDescriptions,
      }),
    );
    const info = extractSchemaInfo(obj);
    if (info !== undefined) {
      ctx.schemaInfoMap.set(keyPath, info);
    }
    return results;
  }

  const currentDescs =
    obj.description !== undefined
      ? [...ctx.parentDescriptions, obj.description]
      : ctx.parentDescriptions;

  for (const [childKey, childValue] of Object.entries(obj.properties)) {
    const childPath = keyPath ? `${keyPath}.${childKey}` : childKey;
    results.push(
      ...collectLeafEntries(childValue, childPath, {
        parentDescriptions: currentDescs,
        source: ctx.source,
        schemaInfoMap: ctx.schemaInfoMap,
      }),
    );
  }

  return results;
}

/**
 * settings.json スキーマからリーフ設定エントリを抽出
 * env セクションは別処理、それ以外のプロパティを再帰的に収集
 */
export async function parseSettingsSchema(schemaPath: string): Promise<{
  settings: SettingsEntry[];
  envFromSchema: SettingsEntry[];
  schemaInfoMap: Map<string, { schemaDefault?: string; schemaEnum?: string[] }>;
}> {
  const raw = await fs.readFile(schemaPath, 'utf-8');
  const schema = JSON.parse(raw) as SettingsJsonSchema;

  const settings: SettingsEntry[] = [];
  const envFromSchema: SettingsEntry[] = [];
  const schemaInfoMap = new Map<
    string,
    { schemaDefault?: string; schemaEnum?: string[] }
  >();
  const props = schema.properties ?? {};

  for (const [key, value] of Object.entries(props)) {
    if (key === '$schema') {
      continue;
    }

    if (key === 'env') {
      const envProps = value.properties ?? {};
      for (const [envKey, envValue] of Object.entries(envProps)) {
        const envProp = envValue as SchemaEnvProperty;
        envFromSchema.push(
          createLoadedSettingsEntry({
            key: envKey,
            source: 'env',
            descriptionEn: envProp.description ?? '',
            parentDescriptions: [],
          }),
        );
        const info = extractSchemaInfo(envProp);
        if (info !== undefined) {
          schemaInfoMap.set(envKey, info);
        }
      }
      continue;
    }

    const leaves = collectLeafEntries(value, key, {
      parentDescriptions: [],
      source: 'settings',
      schemaInfoMap,
    });
    settings.push(...leaves);
  }

  return { settings, envFromSchema, schemaInfoMap };
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
  entries: SettingsEntry[];
  rawDescriptions: Map<string, string>;
};

function parseEnvTableRows(
  markdown: string,
  opts: { environmentTableOnly?: boolean } = {},
): EnvTableParseResult {
  const entries: SettingsEntry[] = [];
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
    entries.push(
      createLoadedSettingsEntry({
        key: match[1],
        source: 'env',
        descriptionEn: description,
        parentDescriptions: [],
      }),
    );

    if (
      /(?:also accepted|older name|legacy name|alias)/i.test(descriptionRaw)
    ) {
      for (const aliasMatch of descriptionRaw.matchAll(
        /`([A-Z_][A-Z0-9_]*)`/g,
      )) {
        const key = aliasMatch[1];
        if (key && key !== match[1]) {
          rawDescriptions.set(key, descriptionRaw);
          entries.push(
            createLoadedSettingsEntry({
              key,
              source: 'env',
              descriptionEn: description,
              parentDescriptions: [],
            }),
          );
        }
      }
    }
  }

  return { entries, rawDescriptions };
}

/**
 * env-vars.md の Markdown テーブルから環境変数エントリを抽出
 */
export async function parseEnvVarsMd(
  envVarsMdPath: string,
  docsEnDir?: string,
): Promise<SettingsEntry[]> {
  const raw = await fs.readFile(envVarsMdPath, 'utf-8');
  const { entries, rawDescriptions } = parseEnvTableRows(raw);

  if (docsEnDir === undefined) {
    return entries;
  }

  const resolvedEntries: SettingsEntry[] = [];

  for (const entry of entries) {
    const rawDescription = rawDescriptions.get(entry.key);
    if (rawDescription === undefined) {
      resolvedEntries.push(entry);
      continue;
    }

    const pureSeeMatch = rawDescription
      .trim()
      .match(/^See \[.+\]\((\/en\/.+)\)$/);
    if (pureSeeMatch === null) {
      resolvedEntries.push(entry);
      continue;
    }

    const linkTarget = pureSeeMatch[1];
    if (linkTarget === undefined) {
      resolvedEntries.push(entry);
      continue;
    }

    const [relativeDocPath, anchorFragment = ''] = linkTarget
      .replace(/^\/en\//, '')
      .split('#');
    if (relativeDocPath === undefined) {
      resolvedEntries.push(entry);
      continue;
    }

    const docPath = path.join(
      docsEnDir,
      `${relativeDocPath.replace(/\.md$/, '')}.md`,
    );
    let content: string;
    try {
      content = await fs.readFile(docPath, 'utf-8');
    } catch {
      resolvedEntries.push(entry);
      continue;
    }

    const section = anchorFragment
      ? findSectionByAnchor(content, anchorFragment)
      : (findSectionByAnchor(content, 'environment-variables') ?? content);
    if (section === null) {
      resolvedEntries.push(entry);
      continue;
    }

    const directDescription = resolveDescriptionFromSection(
      String(entry.key),
      section,
    );
    if (directDescription !== null) {
      resolvedEntries.push({
        ...entry,
        descriptionEn: directDescription,
      });
      continue;
    }

    const fallbackMatch = String(entry.key).match(
      /^ANTHROPIC_DEFAULT_([A-Z]+)_MODEL(?:_(NAME|DESCRIPTION|SUPPORTED_CAPABILITIES))?$/,
    );
    if (fallbackMatch !== null) {
      const tierName = fallbackMatch[1];
      const suffix = fallbackMatch[2] ?? '';
      if (tierName === undefined) {
        resolvedEntries.push(entry);
        continue;
      }

      const displayTierName = tierName[0] + tierName.slice(1).toLowerCase();
      const fallbackKey = `ANTHROPIC_DEFAULT_OPUS_MODEL${suffix ? `_${suffix}` : ''}`;
      const fallbackDescription = resolveDescriptionFromSection(
        fallbackKey,
        section,
      );
      if (fallbackDescription !== null) {
        resolvedEntries.push({
          ...entry,
          descriptionEn: fallbackDescription.replace(/Opus/g, displayTierName),
        });
        continue;
      }
    }

    if (
      String(entry.key) ===
      'ANTHROPIC_CUSTOM_MODEL_OPTION_SUPPORTED_CAPABILITIES'
    ) {
      const fallbackDescription = resolveDescriptionFromSection(
        'ANTHROPIC_DEFAULT_OPUS_MODEL_SUPPORTED_CAPABILITIES',
        section,
      );
      if (fallbackDescription !== null) {
        resolvedEntries.push({
          ...entry,
          descriptionEn: fallbackDescription.replace(
            /pinned Opus model/g,
            'custom model option',
          ),
        });
        continue;
      }
    }

    resolvedEntries.push(entry);
  }

  return resolvedEntries;
}

export async function parsePublicEnvEntriesFromDocs(
  docsEnDir: string,
): Promise<SettingsEntry[]> {
  const files = globSync('**/*.md', { cwd: docsEnDir })
    .map(String)
    .filter((file) => file !== 'changelog.md' && file !== 'env-vars.md')
    .map((file) => path.join(docsEnDir, file));

  const entries: SettingsEntry[] = [];

  for (const file of files) {
    const raw = await fs.readFile(file, 'utf-8');
    entries.push(
      ...parseEnvTableRows(raw, { environmentTableOnly: true }).entries,
    );
    entries.push(...extractPublicEnvMentions(raw));
  }

  return entries;
}

function extractPublicEnvMentions(markdown: string): SettingsEntry[] {
  const entries: SettingsEntry[] = [];
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
        createLoadedSettingsEntry({
          key,
          source: 'env',
          descriptionEn: findNearbyDescription(lines, index, key),
          parentDescriptions: [],
        }),
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

export function findUnmergedPublicEnvMentions(
  mergedKeys: Set<string>,
  docsEnDir: string,
): string[] {
  const publicKeys = new Set<string>();
  const files = globSync('**/*.md', { cwd: docsEnDir })
    .map(String)
    .filter((file) => file !== 'changelog.md' && file !== 'env-vars.md')
    .map((file) => path.join(docsEnDir, file));

  for (const file of files) {
    const raw = readFileSync(file, 'utf-8');
    for (const match of raw.matchAll(/\b[A-Z_][A-Z0-9_]*\b/g)) {
      const key = match[0];
      if (
        !mergedKeys.has(createSettingKey(key)) &&
        isLikelyPublicEnvName(key)
      ) {
        publicKeys.add(key);
      }
    }
  }

  return [...publicKeys].sort();
}

export async function loadSettingsEntries(input: {
  schemaPath: string;
  envVarsMdPath: string;
  docsEnDir: string;
}): Promise<RawSettingsEntries> {
  const {
    settings: schemaSettings,
    envFromSchema: schemaEnvEntries,
    schemaInfoMap,
  } = await parseSettingsSchema(input.schemaPath);
  const mdEnvEntries = await parseEnvVarsMd(
    input.envVarsMdPath,
    input.docsEnDir,
  );
  const docsEnvEntries = await parsePublicEnvEntriesFromDocs(input.docsEnDir);

  return {
    schemaSettings,
    mdEnvEntries,
    schemaEnvEntries,
    docsEnvEntries,
    schemaInfoMap,
  };
}

function createLoadedSettingsEntry(input: {
  key: string;
  source: SettingSource;
  descriptionEn: string;
  parentDescriptions: string[];
}): SettingsEntry {
  return createSettingsEntry({
    key: createSettingKey(input.key),
    source: input.source,
    descriptionEn: input.descriptionEn,
    parentDescriptions: input.parentDescriptions,
  });
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
