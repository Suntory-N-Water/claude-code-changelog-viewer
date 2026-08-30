type GitHubRelease = {
  tag_name: string;
  published_at: string;
};

const GITHUB_RELEASES_API_URL =
  'https://api.github.com/repos/anthropics/claude-code/releases';
const GITHUB_RELEASES_ATOM_URL =
  'https://github.com/anthropics/claude-code/releases.atom';
const GITHUB_USER_AGENT = 'claude-code-changelog-viewer';

// GitHub Releases の公開日時キャッシュ(ビルド中に1回だけ fetch)
let releaseMap: Map<string, string> | null = null;
let releaseMapPromise: Promise<Map<string, string>> | null = null;

/** GitHub Releases の Atom フィードからバージョンごとの公開日時を抽出する */
function parseAtomReleaseMap(feed: string): Map<string, string> {
  const map = new Map<string, string>();
  const entryPattern =
    /<entry>[\s\S]*?<updated>([^<]+)<\/updated>[\s\S]*?<title>v([^<]+)<\/title>[\s\S]*?<\/entry>/gu;

  for (const match of feed.matchAll(entryPattern)) {
    const publishedAt = match[1];
    const version = match[2];
    if (publishedAt && version) {
      map.set(version, publishedAt);
    }
  }

  return map;
}

/** API 一覧取得に失敗したときに使う GitHub Releases Atom フィードを取得する */
async function getAtomReleaseMap(): Promise<Map<string, string>> {
  const res = await fetch(GITHUB_RELEASES_ATOM_URL, {
    headers: {
      Accept: 'application/atom+xml',
      'User-Agent': GITHUB_USER_AGENT,
    },
  });
  if (!res.ok) {
    throw new Error(`GitHub Atom feed: ${res.status}`);
  }

  return parseAtomReleaseMap(await res.text());
}

/** GitHub Releases のバージョンごとの公開日時を取得する */
async function fetchReleaseMap(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    // ページネーションで全リリースを取得(最大300件)
    for (let page = 1; page <= 3; page += 1) {
      const res = await fetch(
        `${GITHUB_RELEASES_API_URL}?per_page=100&page=${page}`,
        {
          headers: {
            Accept: 'application/vnd.github+json',
            'User-Agent': GITHUB_USER_AGENT,
          },
        },
      );
      if (!res.ok) {
        throw new Error(`GitHub API: ${res.status}`);
      }
      const releases = (await res.json()) as GitHubRelease[];
      if (releases.length === 0) {
        break;
      }
      for (const release of releases) {
        map.set(release.tag_name.replace(/^v/, ''), release.published_at);
      }
      if (releases.length < 100) {
        break;
      }
    }
  } catch (error) {
    console.warn('[release-map] GitHub API fetch failed:', error);
    try {
      // API はビルド環境ごとのレート制限を受けるため、公開フィードで最新分を補完する。
      const atomMap = await getAtomReleaseMap();
      for (const [version, publishedAt] of atomMap) {
        map.set(version, publishedAt);
      }
    } catch (atomError) {
      console.warn('[release-map] GitHub Atom feed fetch failed:', atomError);
    }
  }
  return map;
}

/** ビルド中の同時呼び出しでも、取得完了前の空Mapを返さない */
export async function getReleaseMap(): Promise<Map<string, string>> {
  if (releaseMap) {
    return releaseMap;
  }

  if (releaseMapPromise === null) {
    releaseMapPromise = fetchReleaseMap()
      .then((map) => {
        releaseMap = map;
        return map;
      })
      .finally(() => {
        releaseMapPromise = null;
      });
  }
  return releaseMapPromise;
}
