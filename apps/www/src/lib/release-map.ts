// GitHub Releases の公開日時キャッシュ(ビルド中に1回だけ fetch)
let releaseMap: Map<string, string> | null = null;

/** GitHub Releases のバージョンごとの公開日時を取得する */
export async function getReleaseMap() {
  if (releaseMap) {
    return releaseMap;
  }
  releaseMap = new Map();
  try {
    // ページネーションで全リリースを取得(最大300件)
    for (let page = 1; page <= 3; page += 1) {
      const res = await fetch(
        `https://api.github.com/repos/anthropics/claude-code/releases?per_page=100&page=${page}`,
        { headers: { 'User-Agent': 'claude-code-changelog-viewer' } },
      );
      if (!res.ok) {
        throw new Error(`GitHub API: ${res.status}`);
      }
      /** @type {Array<{ tag_name: string; published_at: string }>} */
      const releases = await res.json();
      if (releases.length === 0) {
        break;
      }
      for (const release of releases) {
        releaseMap.set(
          release.tag_name.replace(/^v/, ''),
          release.published_at,
        );
      }
      if (releases.length < 100) {
        break;
      }
    }
  } catch (error) {
    console.warn('[release-map] GitHub API fetch failed:', error);
  }
  return releaseMap;
}
