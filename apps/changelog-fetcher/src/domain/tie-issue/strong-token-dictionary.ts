// Strong-token 辞書と、CHANGELOG 項目 vs issue 本文の一致トークン数を数える機能。

const MIN_TOKEN_LENGTH = 4;

// UPPER_SNAKE 完全一致。UPPER_SNAKE token は識別子境界 (英数字と _) で拾う。
const ENV_PATTERN_SOURCE = '([A-Z][A-Z0-9_]{3,})';
// tools/agents/skills の identifier: CamelCase (`ScheduleWakeup`) or kebab-case (`agent-hook`).
const CAMEL_CASE_PATTERN_SOURCE = '([A-Z][a-zA-Z0-9]{3,})';
const KEBAB_CASE_PATTERN_SOURCE = '([a-z][a-z0-9]*(?:-[a-z0-9]+)+)';

export type StrongTokenDictionaryInput = {
  envs: string[];
  commands: string[];
  tools: string[];
  agents: string[];
  skills: string[];
  settingsKeys: string[]; // 例: "voice.enabled", "voiceEnabled"
  settingsSlugs: string[]; // 例: "voice-enabled"
  settingsLeafNames: string[]; // 例: "enabled"
  manualTokens: string[];
  envDenylist: string[];
  toolDenylist: string[];
};

export type StrongTokenDictionary = {
  envs: Set<string>;
  commands: Set<string>;
  identifiers: Set<string>; // tools / agents / skills
  settingsTokens: Set<string>; // key / slug / camelCase leaf
  manualTokens: Set<string>;
};

export function buildStrongTokenDictionary(
  input: StrongTokenDictionaryInput,
): StrongTokenDictionary {
  const envDenylist = new Set(input.envDenylist);
  const envs = new Set(
    input.envs.filter(
      (name) => name.length >= MIN_TOKEN_LENGTH && !envDenylist.has(name),
    ),
  );

  // commands は `/`-prefix を付けて辞書化する（後段のマッチで両側 `/`-prefix を強制するため）
  const commands = new Set(
    input.commands
      .filter((name) => name.length >= MIN_TOKEN_LENGTH)
      .map((name) => `/${name}`),
  );

  const toolDenylist = new Set(input.toolDenylist);
  const identifiers = new Set<string>();
  for (const name of input.tools) {
    if (name.length >= MIN_TOKEN_LENGTH && !toolDenylist.has(name)) {
      identifiers.add(name);
    }
  }
  for (const name of [...input.agents, ...input.skills]) {
    // kebab-case は "-" を含んでいれば長さ 4+ でなくても識別子として意味を持つが、
    // ノイズ防止のため MIN_TOKEN_LENGTH は同じく適用する
    if (name.length >= MIN_TOKEN_LENGTH) {
      identifiers.add(name);
    }
  }

  const settingsTokens = new Set<string>();
  for (const key of input.settingsKeys) {
    if (key.length >= MIN_TOKEN_LENGTH) {
      settingsTokens.add(key);
    }
  }
  for (const slug of input.settingsSlugs) {
    if (slug.length >= MIN_TOKEN_LENGTH) {
      settingsTokens.add(slug);
    }
  }
  for (const leaf of input.settingsLeafNames) {
    if (leaf.length >= MIN_TOKEN_LENGTH) {
      settingsTokens.add(leaf);
    }
  }

  const manualTokens = new Set(
    input.manualTokens.filter((t) => t.length >= MIN_TOKEN_LENGTH),
  );

  return { envs, commands, identifiers, settingsTokens, manualTokens };
}

// 与えたテキスト中に含まれる辞書 token の集合を返す。
// - envs: UPPER_SNAKE を identifier 境界で拾う
// - commands: `/name` の形で照合（辞書側も `/`-prefix 済み）
// - identifiers: CamelCase or kebab-case の identifier 境界
// - settingsTokens: `.` を含む key はドット付きで検索、それ以外は identifier 境界
export function extractTokensPresent(
  text: string,
  dict: StrongTokenDictionary,
): Set<string> {
  const found = new Set<string>();

  const envMatches = text.matchAll(
    new RegExp(`\\b${ENV_PATTERN_SOURCE}\\b`, 'g'),
  );
  for (const m of envMatches) {
    const token = m[1];
    if (token && dict.envs.has(token)) {
      found.add(token);
    }
  }

  // commands は `/name` の形。`/` は identifier 境界扱いされないので、
  // `/` の直後に kebab-case 名が続くパターンで拾う。
  const cmdMatches = text.matchAll(/\/([a-z][a-z0-9]*(?:-[a-z0-9]+)*)/g);
  for (const m of cmdMatches) {
    const cmd = `/${m[1] ?? ''}`;
    if (dict.commands.has(cmd)) {
      found.add(cmd);
    }
  }

  const camelMatches = text.matchAll(
    new RegExp(`\\b${CAMEL_CASE_PATTERN_SOURCE}\\b`, 'g'),
  );
  for (const m of camelMatches) {
    const token = m[1];
    if (token && dict.identifiers.has(token)) {
      found.add(token);
    }
  }

  const kebabMatches = text.matchAll(
    new RegExp(`(?<![\\w-])${KEBAB_CASE_PATTERN_SOURCE}(?![\\w-])`, 'g'),
  );
  for (const m of kebabMatches) {
    const token = m[1];
    if (token && dict.identifiers.has(token)) {
      found.add(token);
    }
  }

  // settingsTokens: `voice.enabled` のようなドット付きは substring 検索、
  // 単一 identifier は境界で検索。
  for (const token of dict.settingsTokens) {
    if (token.includes('.')) {
      if (text.includes(token)) {
        found.add(token);
      }
      continue;
    }
    if (token.includes('-')) {
      const kebabRe = new RegExp(
        `(?<![\\w-])${escapeRegex(token)}(?![\\w-])`,
        'g',
      );
      if (kebabRe.test(text)) {
        found.add(token);
      }
      continue;
    }
    const wordRe = new RegExp(`\\b${escapeRegex(token)}\\b`, 'g');
    if (wordRe.test(text)) {
      found.add(token);
    }
  }

  for (const token of dict.manualTokens) {
    if (text.includes(token)) {
      found.add(token);
    }
  }

  return found;
}

// CHANGELOG 側と issue 側の両方に現れる token の個数を返す。
// これが strong_token スコアの生値になる。
export function countSharedStrongTokens(
  changelogText: string,
  issueText: string,
  dict: StrongTokenDictionary,
): number {
  const inChangelog = extractTokensPresent(changelogText, dict);
  if (inChangelog.size === 0) {
    return 0;
  }
  const inIssue = extractTokensPresent(issueText, dict);
  let shared = 0;
  for (const token of inChangelog) {
    if (inIssue.has(token)) {
      shared += 1;
    }
  }
  return shared;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
