import { execFile } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import {
  buildChangelogSearchTerms,
  getLogger,
  PREFIX_ORDER,
} from '@claude-code-changelog-viewer/common';

const execFileAsync = promisify(execFile);
const logger = getLogger({ name: 'worker-seed-generator' });
const workerDirectory = fileURLToPath(new URL('..', import.meta.url));
const seedPath = fileURLToPath(new URL('../seed/seed.sql', import.meta.url));
type Row = Record<string, unknown>;

const tableNames = {
  versions: 'changelog_versions',
  items: 'changelog_items',
  featureAreas: 'changelog_item_feature_areas',
  relatedDocs: 'changelog_item_related_docs',
  diffEvents: 'changelog_diff_events',
  diffEventItems: 'changelog_diff_event_items',
  settings: 'settings_reference',
  officialDocs: 'settings_official_docs',
} as const;

function rowText(row: Row, column: string): string {
  const value = row[column];
  if (value === null || value === undefined) {
    throw new Error(`D1 の ${column} が NULL です`);
  }
  return String(value);
}

function rowValue(row: Row, column: string): unknown {
  return row[column];
}

function hasValue(row: Row, column: string): boolean {
  return rowValue(row, column) !== null && rowValue(row, column) !== undefined;
}

function normalizeVersion(version: string): string {
  return version.replace(/^v/, '');
}

function semverCompareDesc(a: string, b: string): number {
  const partsA = normalizeVersion(a).split('.').map(Number);
  const partsB = normalizeVersion(b).split('.').map(Number);
  for (
    let index = 0;
    index < Math.max(partsA.length, partsB.length);
    index += 1
  ) {
    const difference = (partsB[index] ?? 0) - (partsA[index] ?? 0);
    if (difference !== 0) {
      return difference;
    }
  }
  return 0;
}

function itemKey(row: Row): string {
  return `${rowText(row, 'version')}\u0000${rowText(row, 'item_id')}`;
}

function eventKey(row: Row): string {
  return `${rowText(row, 'version')}\u0000${rowText(row, 'detected_at')}`;
}

function settingHasOfficialDocs(
  setting: Row,
  officialDocKeys: Set<string>,
): boolean {
  return officialDocKeys.has(rowText(setting, 'key'));
}

function settingMatchesItem(setting: Row, item: Row): boolean {
  const content =
    rowText(item, 'content') +
    ' ' +
    (hasValue(item, 'content_ja') ? String(rowValue(item, 'content_ja')) : '');
  return buildChangelogSearchTerms(rowText(setting, 'key')).some((term) =>
    content.includes(term),
  );
}

async function selectTable(tableName: string): Promise<Row[]> {
  const result = await execFileAsync(
    'pnpm',
    [
      'exec',
      'wrangler',
      'd1',
      'execute',
      'notification-db',
      '--remote',
      '--command',
      `SELECT * FROM ${tableName}`,
      '--json',
    ],
    {
      cwd: workerDirectory,
      maxBuffer: 32 * 1024 * 1024,
    },
  );

  const output = String(result.stdout).trim();
  const jsonStart = output.indexOf('[');
  if (jsonStart === -1) {
    throw new Error(`wrangler の JSON 出力を解釈できません: ${tableName}`);
  }
  const parsed: unknown = JSON.parse(output.slice(jsonStart));
  const first = Array.isArray(parsed) ? parsed[0] : parsed;
  if (
    typeof first !== 'object' ||
    first === null ||
    !('results' in first) ||
    !Array.isArray(first.results) ||
    !first.results.every(
      (row: unknown) => typeof row === 'object' && row !== null,
    )
  ) {
    throw new Error(`D1 の結果を解釈できません: ${tableName}`);
  }
  return first.results as Row[];
}

function sqlValue(value: unknown): string {
  if (value === null || value === undefined) {
    return 'NULL';
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error(`SQL に出力できない数値です: ${value}`);
    }
    return String(value);
  }
  if (typeof value === 'boolean') {
    return value ? '1' : '0';
  }
  if (typeof value !== 'string') {
    throw new Error(`SQL に出力できない値です: ${String(value)}`);
  }
  return `'${value.replaceAll("'", "''")}'`;
}

function buildInsert(tableName: string, rows: Row[]): string {
  const first = rows[0];
  if (first === undefined) {
    return '';
  }
  const columns = Object.keys(first);
  const values = rows
    .map(
      (row) =>
        `  (${columns.map((column) => sqlValue(row[column])).join(', ')})`,
    )
    .join(',\n');
  return (
    'INSERT INTO ' +
    tableName +
    ' (' +
    columns.join(', ') +
    ') VALUES\n' +
    values +
    ';'
  );
}

async function generateSeed(): Promise<void> {
  logger.info('本番 D1 からローカル用シードの候補を取得しています');
  const [
    versionRows,
    itemRows,
    featureAreaRows,
    relatedDocRows,
    diffEventRows,
    diffEventItemRows,
    settingRows,
    officialDocRows,
  ] = await Promise.all([
    selectTable(tableNames.versions),
    selectTable(tableNames.items),
    selectTable(tableNames.featureAreas),
    selectTable(tableNames.relatedDocs),
    selectTable(tableNames.diffEvents),
    selectTable(tableNames.diffEventItems),
    selectTable(tableNames.settings),
    selectTable(tableNames.officialDocs),
  ]);

  const sortedVersions = [...versionRows].sort((a, b) =>
    semverCompareDesc(rowText(a, 'version'), rowText(b, 'version')),
  );
  if (sortedVersions.length < 3) {
    throw new Error('シードに必要なバージョンが3件未満です');
  }

  const sortedItems = [...itemRows].sort((a, b) =>
    semverCompareDesc(rowText(a, 'version'), rowText(b, 'version')),
  );
  const featureAreasByItem = new Map<string, Set<string>>();
  for (const row of featureAreaRows) {
    const key = itemKey(row);
    const areas = featureAreasByItem.get(key) ?? new Set<string>();
    areas.add(rowText(row, 'feature_area'));
    featureAreasByItem.set(key, areas);
  }
  const relatedDocKeys = new Set(relatedDocRows.map(itemKey));
  const selectedItemKeys = new Set<string>();
  const addItem = (row: Row | undefined, reason: string): void => {
    if (row === undefined) {
      throw new Error(
        `シード条件を満たす changelog item がありません: ${reason}`,
      );
    }
    selectedItemKeys.add(itemKey(row));
  };
  const firstItem = (
    predicate: (row: Row) => boolean,
    reason: string,
  ): void => {
    addItem(sortedItems.find(predicate), reason);
  };

  const availablePrefixes = PREFIX_ORDER.filter((prefix) =>
    sortedItems.some((row) => rowText(row, 'prefix') === prefix),
  );
  if (availablePrefixes.length < 5) {
    throw new Error('PREFIX_ORDER に含まれる prefix が5種類未満です');
  }
  for (const prefix of availablePrefixes.slice(0, 5)) {
    firstItem((row) => rowText(row, 'prefix') === prefix, `prefix=${prefix}`);
  }
  firstItem((row) => hasValue(row, 'content_ja'), 'content_ja あり');
  firstItem((row) => !hasValue(row, 'content_ja'), 'content_ja なし');
  firstItem(
    (row) =>
      ['inference_before', 'inference_after', 'inference_benefit'].every(
        (column) => hasValue(row, column),
      ),
    'inference あり',
  );
  firstItem(
    (row) =>
      !['inference_before', 'inference_after', 'inference_benefit'].every(
        (column) => hasValue(row, column),
      ),
    'inference なし',
  );
  firstItem((row) => relatedDocKeys.has(itemKey(row)), 'related_docs あり');
  firstItem((row) => !relatedDocKeys.has(itemKey(row)), 'related_docs なし');
  firstItem(
    (row) => (featureAreasByItem.get(itemKey(row))?.size ?? 0) > 0,
    'feature_areas あり',
  );
  firstItem(
    (row) => (featureAreasByItem.get(itemKey(row))?.size ?? 0) === 0,
    'feature_areas なし',
  );

  const availableAreas = [
    ...new Set(featureAreaRows.map((row) => rowText(row, 'feature_area'))),
  ].sort();
  if (availableAreas.length < 3) {
    throw new Error('feature_areas が3種類未満です');
  }
  const itemKeysByArea = new Map<string, Set<string>>();
  for (const row of featureAreaRows) {
    const keys =
      itemKeysByArea.get(rowText(row, 'feature_area')) ?? new Set<string>();
    keys.add(itemKey(row));
    itemKeysByArea.set(rowText(row, 'feature_area'), keys);
  }
  const pageArea = availableAreas.find(
    (area) => (itemKeysByArea.get(area)?.size ?? 0) >= 3,
  );
  if (pageArea === undefined) {
    throw new Error(
      'feature_area ページの生成に必要な item が3件以上ありません',
    );
  }
  for (const key of [...(itemKeysByArea.get(pageArea) ?? [])].slice(0, 3)) {
    addItem(
      sortedItems.find((row) => itemKey(row) === key),
      `feature_area ページ=${pageArea}`,
    );
  }
  for (const area of availableAreas.slice(0, 3)) {
    firstItem(
      (row) => featureAreasByItem.get(itemKey(row))?.has(area) ?? false,
      `feature_area=${area}`,
    );
  }

  const selectedVersionNumbers = new Set(
    sortedVersions
      .slice(0, 3)
      .map((row) => normalizeVersion(rowText(row, 'version'))),
  );
  for (const key of selectedItemKeys) {
    selectedVersionNumbers.add(normalizeVersion(key.split('\u0000')[0] ?? ''));
  }
  const addVersionWith = (
    predicate: (row: Row) => boolean,
    reason: string,
  ): void => {
    const row = sortedVersions.find(predicate);
    if (row === undefined) {
      throw new Error(`シード条件を満たす version がありません: ${reason}`);
    }
    selectedVersionNumbers.add(normalizeVersion(rowText(row, 'version')));
  };
  addVersionWith((row) => hasValue(row, 'summary'), 'summary あり');
  addVersionWith((row) => !hasValue(row, 'summary'), 'summary なし');

  const officialDocKeys = new Set(
    officialDocRows.map((row) => rowText(row, 'setting_key')),
  );
  const selectedSettingKeys = new Set<string>();
  const addSetting = (row: Row | undefined, reason: string): void => {
    if (row === undefined) {
      throw new Error(`シード条件を満たす setting がありません: ${reason}`);
    }
    selectedSettingKeys.add(rowText(row, 'key'));
  };
  const firstSetting = (
    predicate: (row: Row) => boolean,
    reason: string,
  ): void => {
    addSetting(settingRows.find(predicate), reason);
  };
  const relatedSetting = settingRows.find((setting) =>
    sortedItems.some((item) => settingMatchesItem(setting, item)),
  );
  if (relatedSetting === undefined) {
    throw new Error('changelog と関連付けられる setting がありません');
  }
  addSetting(relatedSetting, 'changelog との関連表示');
  const relatedItem = sortedItems.find((item) =>
    settingMatchesItem(relatedSetting, item),
  );
  addItem(relatedItem, '設定キーに一致する changelog item');
  if (relatedItem === undefined) {
    throw new Error('設定キーに一致する changelog item がありません');
  }
  selectedVersionNumbers.add(normalizeVersion(rowText(relatedItem, 'version')));
  firstSetting(
    (row) => rowText(row, 'source') === 'settings',
    'source=settings',
  );
  firstSetting((row) => rowText(row, 'source') === 'env', 'source=env');
  firstSetting((row) => hasValue(row, 'leaf_name'), 'leaf_name あり');
  firstSetting((row) => !hasValue(row, 'leaf_name'), 'leaf_name なし');
  firstSetting((row) => hasValue(row, 'use_case_ja'), 'use_case_ja あり');
  firstSetting((row) => !hasValue(row, 'use_case_ja'), 'use_case_ja なし');
  firstSetting(
    (row) => settingHasOfficialDocs(row, officialDocKeys),
    'official_doc_urls あり',
  );
  firstSetting(
    (row) => !settingHasOfficialDocs(row, officialDocKeys),
    'official_doc_urls なし',
  );
  firstSetting(
    (row) => /\[[^\]]+\]\([^)]+\)/.test(rowText(row, 'description_en')),
    'description_en の Markdown リンク',
  );
  for (const row of settingRows) {
    if (selectedSettingKeys.size >= 10) {
      break;
    }
    selectedSettingKeys.add(rowText(row, 'key'));
  }

  const selectedChangedEvent = diffEventRows.find(
    (row) =>
      rowText(row, 'type') === 'items_changed' &&
      sortedVersions.some(
        (version) =>
          normalizeVersion(rowText(version, 'version')) ===
          normalizeVersion(rowText(row, 'version')),
      ),
  );
  const changedEvent =
    selectedChangedEvent ??
    diffEventRows.find((row) => rowText(row, 'type') === 'items_changed');
  const hasChangelogVersion = (event: Row): boolean =>
    sortedVersions.some(
      (version) =>
        normalizeVersion(rowText(version, 'version')) ===
        normalizeVersion(rowText(event, 'version')),
    );
  const removedEvent =
    diffEventRows.find(
      (row) =>
        rowText(row, 'type') === 'version_removed' && hasChangelogVersion(row),
    ) ??
    diffEventRows.find((row) => rowText(row, 'type') === 'version_removed');
  if (
    changedEvent === undefined ||
    removedEvent === undefined ||
    (!hasChangelogVersion(changedEvent) && !hasChangelogVersion(removedEvent))
  ) {
    throw new Error(
      'items_changed と version_removed の両方、および changelog と関連するイベントが必要です',
    );
  }
  for (const event of [changedEvent, removedEvent]) {
    if (hasChangelogVersion(event)) {
      selectedVersionNumbers.add(normalizeVersion(rowText(event, 'version')));
    }
  }
  const selectedEventKeys = new Set([
    eventKey(changedEvent),
    eventKey(removedEvent),
  ]);

  const itemsByVersion = new Map<string, Row[]>();
  for (const row of sortedItems) {
    const version = normalizeVersion(rowText(row, 'version'));
    const items = itemsByVersion.get(version) ?? [];
    items.push(row);
    itemsByVersion.set(version, items);
  }
  for (const version of selectedVersionNumbers) {
    const items = itemsByVersion.get(version) ?? [];
    if (
      items.length > 0 &&
      !items.some((row) => selectedItemKeys.has(itemKey(row)))
    ) {
      addItem(items[0], `version=${version} の表示用 item`);
    }
  }

  const selectedVersionRows = sortedVersions.filter((row) =>
    selectedVersionNumbers.has(normalizeVersion(rowText(row, 'version'))),
  );
  const selectedItemRows = itemRows.filter((row) =>
    selectedItemKeys.has(itemKey(row)),
  );
  const selectedItemKeySet = new Set(selectedItemRows.map(itemKey));
  const selectedFeatureAreaRows = featureAreaRows.filter((row) =>
    selectedItemKeySet.has(itemKey(row)),
  );
  const selectedRelatedDocRows = relatedDocRows.filter((row) =>
    selectedItemKeySet.has(itemKey(row)),
  );
  const selectedSettingRows = settingRows.filter((row) =>
    selectedSettingKeys.has(rowText(row, 'key')),
  );
  const selectedOfficialDocRows = officialDocRows.filter((row) =>
    selectedSettingKeys.has(rowText(row, 'setting_key')),
  );
  const selectedDiffEventRows = diffEventRows.filter((row) =>
    selectedEventKeys.has(eventKey(row)),
  );
  const selectedDiffEventItemRows = diffEventItemRows.filter((row) =>
    selectedEventKeys.has(eventKey(row)),
  );

  const sql = [
    '-- ローカル画面確認用。generate-seed.ts で本番 D1 から再生成する。',
    '',
    'DELETE FROM settings_official_docs;',
    'DELETE FROM settings_reference;',
    'DELETE FROM changelog_item_related_docs;',
    'DELETE FROM changelog_item_feature_areas;',
    'DELETE FROM changelog_items;',
    'DELETE FROM changelog_versions;',
    'DELETE FROM changelog_diff_event_items;',
    'DELETE FROM changelog_diff_events;',
    '',
    buildInsert(tableNames.versions, selectedVersionRows),
    buildInsert(tableNames.items, selectedItemRows),
    buildInsert(tableNames.featureAreas, selectedFeatureAreaRows),
    buildInsert(tableNames.relatedDocs, selectedRelatedDocRows),
    buildInsert(tableNames.diffEvents, selectedDiffEventRows),
    buildInsert(tableNames.diffEventItems, selectedDiffEventItemRows),
    buildInsert(tableNames.settings, selectedSettingRows),
    buildInsert(tableNames.officialDocs, selectedOfficialDocRows),
  ]
    .filter((statement) => statement.length > 0)
    .join('\n\n');
  await writeFile(seedPath, `${sql}\n`, 'utf8');
  logger.info(`シードを出力しました: ${seedPath}`);
  logger.info(
    `versions=${selectedVersionRows.length}, items=${selectedItemRows.length}, settings=${selectedSettingRows.length}, diff_events=${selectedDiffEventRows.length}`,
  );
}

try {
  await generateSeed();
} catch (error) {
  logger.error(
    'シード生成に失敗しました',
    error instanceof Error ? error : new Error(String(error)),
  );
  process.exitCode = 1;
}
