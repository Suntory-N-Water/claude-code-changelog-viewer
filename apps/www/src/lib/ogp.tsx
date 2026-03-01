import type { ChangelogItem } from '@claude-code-changelog-viewer/types';
import { Resvg } from '@resvg/resvg-js';
import type { ReactElement } from 'react';
import satori from 'satori';

// CC-Vault カラーテーマ
const colors = {
  mainOrange: '#DB8163',
  mainWhite: '#FAF9F5',
  mainBlack: '#141413',
  gray: '#E0DFDA',
  orangeHover: '#D97757',
};

const PREFIX_ORDER = [
  'Added',
  'Changed',
  'Updated',
  'Improved',
  'Fixed',
  'Removed',
];

const prefixBadgeStyles: Record<
  string,
  { bg: string; color: string; border?: string }
> = {
  Added: { bg: colors.mainOrange, color: colors.mainWhite },
  Fixed: { bg: colors.gray, color: colors.mainBlack },
  Updated: { bg: colors.mainBlack, color: colors.mainWhite },
  Changed: { bg: colors.mainBlack, color: colors.mainWhite },
  Improved: { bg: colors.mainBlack, color: colors.mainWhite },
  Removed: {
    bg: 'transparent',
    color: colors.mainBlack,
    border: `2px solid ${colors.mainBlack}`,
  },
};

const defaultBadgeStyle = {
  bg: colors.gray,
  color: colors.mainBlack,
  border: `1px solid ${colors.gray}`,
};

function stripMarkdownForImage(text: string): string {
  return text.replace(/^-\s+/, '').replace(/`([^`]+)`/g, '$1');
}

function groupByPrefix(
  items: ChangelogItem[],
): { prefix: string; items: ChangelogItem[] }[] {
  const groups = new Map<string, ChangelogItem[]>();
  for (const item of items) {
    const key = item.prefix;
    const existing = groups.get(key);
    if (existing) {
      existing.push(item);
    } else {
      groups.set(key, [item]);
    }
  }
  for (const group of groups.values()) {
    group.sort((a, b) => b.importance_score - a.importance_score);
  }
  const ordered: { prefix: string; items: ChangelogItem[] }[] = [];
  for (const prefix of PREFIX_ORDER) {
    const group = groups.get(prefix);
    if (group) {
      ordered.push({ prefix, items: group });
      groups.delete(prefix);
    }
  }
  for (const [prefix, groupItems] of groups) {
    ordered.push({ prefix, items: groupItems });
  }
  return ordered;
}

// フォントデータをPromiseでキャッシュ(並行呼び出し時のレースコンディション防止)
let fontPromise: Promise<ArrayBuffer> | null = null;

/**
 * Google Fontsからフォントデータを取得
 */
function loadFont(): Promise<ArrayBuffer> {
  if (!fontPromise) {
    fontPromise = (async () => {
      const response = await fetch(
        'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@600&display=swap',
      );
      const css = await response.text();

      // CSSからフォントURLを抽出
      const fontUrlMatch = css.match(/src: url\(([^)]+)\)/);
      if (!fontUrlMatch) {
        throw new Error('フォントURLが見つかりませんでした');
      }

      const fontResponse = await fetch(fontUrlMatch[1]);
      return fontResponse.arrayBuffer();
    })();
  }
  return fontPromise;
}

type TopPageOgpProps = {
  title: string;
  description: string;
};

/**
 * トップページ用OGP画像コンポーネント
 */
function TopPageOgp({ title, description }: TopPageOgpProps): ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        width: '100%',
        height: '100%',
        padding: 32,
        background: `linear-gradient(135deg, ${colors.mainOrange} 0%, ${colors.orangeHover} 100%)`,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          width: '100%',
          height: '100%',
          backgroundColor: colors.mainWhite,
          borderRadius: 24,
        }}
      >
        <div
          style={{
            fontSize: 64,
            fontWeight: 600,
            color: colors.mainBlack,
            textAlign: 'center',
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 32,
            fontWeight: 600,
            color: colors.mainBlack,
            opacity: 0.7,
            marginTop: 24,
            textAlign: 'center',
          }}
        >
          {description}
        </div>
      </div>
    </div>
  );
}

type VersionPageOgpProps = {
  siteTitle: string;
  version: string;
  itemCount: number;
};

/**
 * バージョンページ用OGP画像コンポーネント
 */
function VersionPageOgp({
  siteTitle,
  version,
  itemCount,
}: VersionPageOgpProps): ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        width: '100%',
        height: '100%',
        padding: 32,
        background: `linear-gradient(135deg, ${colors.mainOrange} 0%, ${colors.orangeHover} 100%)`,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          width: '100%',
          height: '100%',
          backgroundColor: colors.mainWhite,
          borderRadius: 24,
          padding: 48,
        }}
      >
        <div
          style={{
            fontSize: 36,
            fontWeight: 600,
            color: colors.mainBlack,
            opacity: 0.6,
          }}
        >
          {siteTitle}
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 1,
          }}
        >
          <div
            style={{
              fontSize: 96,
              fontWeight: 600,
              color: colors.mainBlack,
            }}
          >
            {version}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 32,
            fontWeight: 600,
            color: colors.mainBlack,
            opacity: 0.7,
          }}
        >
          {`変更項目: ${itemCount}件`}
        </div>
      </div>
    </div>
  );
}

type TwitterChangelogImageProps = {
  siteTitle: string;
  version: string;
  summary: string;
  items: ChangelogItem[];
  probeMode?: boolean;
};

/**
 * Twitter投稿用バージョン別一枚絵画像コンポーネント
 */
function TwitterChangelogImage({
  siteTitle,
  version,
  summary,
  items,
  probeMode,
}: TwitterChangelogImageProps): ReactElement {
  const groups = groupByPrefix(items);

  return (
    <div
      style={{
        display: 'flex',
        width: '100%',
        ...(probeMode ? {} : { height: '100%' }),
        padding: 32,
        background: `linear-gradient(135deg, ${colors.mainOrange} 0%, ${colors.orangeHover} 100%)`,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          ...(probeMode ? {} : { height: '100%' }),
          backgroundColor: colors.mainWhite,
          borderRadius: 24,
          padding: 48,
        }}
      >
        {/* ヘッダー */}
        <div
          style={{ display: 'flex', flexDirection: 'column', marginBottom: 32 }}
        >
          <div
            style={{
              fontSize: 24,
              fontWeight: 600,
              color: colors.mainBlack,
              opacity: 0.6,
            }}
          >
            {siteTitle}
          </div>
          <div
            style={{
              fontSize: 72,
              fontWeight: 600,
              color: colors.mainBlack,
              marginTop: 8,
            }}
          >
            {`v${version}`}
          </div>
          <div
            style={{
              fontSize: 24,
              fontWeight: 600,
              color: colors.mainBlack,
              opacity: 0.5,
              marginTop: 4,
            }}
          >
            {`変更項目: ${items.length}件`}
          </div>
        </div>

        {/* サマリー */}
        <div
          style={{
            display: 'flex',
            padding: 24,
            marginBottom: 32,
            backgroundColor: `${colors.mainOrange}10`,
            borderLeft: `4px solid ${colors.mainOrange}`,
            borderRadius: 8,
          }}
        >
          <div
            style={{
              fontSize: 20,
              fontWeight: 600,
              color: colors.mainBlack,
              lineHeight: 1.6,
            }}
          >
            {summary}
          </div>
        </div>

        {/* プレフィックスごとのセクション */}
        {groups.map((group) => {
          const style = prefixBadgeStyles[group.prefix] || defaultBadgeStyle;
          return (
            <div
              key={group.prefix}
              style={{
                display: 'flex',
                flexDirection: 'column',
                marginBottom: 28,
              }}
            >
              {/* セクション見出しバッジ */}
              <div style={{ display: 'flex', marginBottom: 16 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '8px 20px',
                    borderRadius: 9999,
                    fontSize: 20,
                    fontWeight: 600,
                    backgroundColor: style.bg,
                    color: style.color,
                    ...(style.border ? { border: style.border } : {}),
                  }}
                >
                  {group.prefix}
                </div>
              </div>

              {/* アイテムカード群 */}
              {group.items.map((item) => {
                const text = stripMarkdownForImage(
                  item.content_ja || item.content,
                );
                const benefit = item.inference?.benefit;
                return (
                  <div
                    key={item.content}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      padding: 20,
                      marginBottom: 12,
                      border: `1px solid ${colors.gray}`,
                      borderRadius: 12,
                      backgroundColor: '#FFFFFF',
                    }}
                  >
                    <div
                      style={{
                        fontSize: 20,
                        fontWeight: 600,
                        color: colors.mainBlack,
                        lineHeight: 1.5,
                      }}
                    >
                      {text}
                    </div>
                    {benefit && (
                      <div
                        style={{
                          display: 'flex',
                          marginTop: 12,
                          paddingLeft: 16,
                          borderLeft: `3px solid ${colors.mainOrange}`,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 16,
                            fontWeight: 600,
                            color: colors.mainBlack,
                            opacity: 0.7,
                            lineHeight: 1.5,
                          }}
                        >
                          {benefit}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * PNG バイナリから画像レスポンスを生成
 */
export function createPngResponse(png: Uint8Array): Response {
  return new Response(Buffer.from(png), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}

/**
 * トップページ用OGP画像を生成
 */
export async function generateTopPageOgp(
  title: string,
  description: string,
): Promise<Uint8Array> {
  const fontData = await loadFont();

  const svg = await satori(
    <TopPageOgp title={title} description={description} />,
    {
      width: 1200,
      height: 630,
      fonts: [
        {
          name: 'Noto Sans JP',
          data: fontData,
          weight: 600,
          style: 'normal',
        },
      ],
    },
  );

  const resvg = new Resvg(svg, {
    fitTo: {
      mode: 'width',
      value: 1200,
    },
  });
  const image = resvg.render();

  return image.asPng();
}

/**
 * バージョンページ用OGP画像を生成
 */
export async function generateVersionPageOgp(
  siteTitle: string,
  version: string,
  itemCount: number,
): Promise<Uint8Array> {
  const fontData = await loadFont();

  const svg = await satori(
    <VersionPageOgp
      siteTitle={siteTitle}
      version={version}
      itemCount={itemCount}
    />,
    {
      width: 1200,
      height: 630,
      fonts: [
        {
          name: 'Noto Sans JP',
          data: fontData,
          weight: 600,
          style: 'normal',
        },
      ],
    },
  );

  const resvg = new Resvg(svg, {
    fitTo: {
      mode: 'width',
      value: 1200,
    },
  });
  const image = resvg.render();

  return image.asPng();
}

/**
 * SVG内の要素座標からコンテンツの実際の高さを測定
 */
function measureSvgContentHeight(svg: string): number {
  let maxBottom = 0;
  // svg要素自体を除き、y属性を持つ全要素の底辺座標を走査
  const elementPattern = /<(?!svg\b)[a-z][^>]*\by="(\d+(?:\.\d+)?)"[^>]*>/g;
  for (
    let match = elementPattern.exec(svg);
    match !== null;
    match = elementPattern.exec(svg)
  ) {
    const element = match[0];
    const y = parseFloat(match[1]);
    const heightMatch = element.match(/\bheight="(\d+(?:\.\d+)?)"/);
    const h = heightMatch ? parseFloat(heightMatch[1]) : 0;
    const bottom = y + h;
    if (bottom > maxBottom) {
      maxBottom = bottom;
    }
  }
  return maxBottom;
}

/**
 * Twitter投稿用バージョン別一枚絵画像を生成
 * 2パスレンダリング: probeモードでコンテンツ高さを測定し、正確な高さで本描画
 */
export async function generateTwitterChangelogImage(
  siteTitle: string,
  version: string,
  summary: string,
  items: ChangelogItem[],
): Promise<Uint8Array> {
  const fontData = await loadFont();
  const IMAGE_WIDTH = 1200;
  const PROBE_HEIGHT = 20000;
  const fonts = [
    {
      name: 'Noto Sans JP',
      data: fontData,
      weight: 600 as const,
      style: 'normal' as const,
    },
  ];

  // 1パス目: probeモードでコンテンツの自然な高さを測定
  const probeSvg = await satori(
    <TwitterChangelogImage
      siteTitle={siteTitle}
      version={version}
      summary={summary}
      items={items}
      probeMode={true}
    />,
    { width: IMAGE_WIDTH, height: PROBE_HEIGHT, fonts },
  );

  const contentHeight = measureSvgContentHeight(probeSvg);
  const height = Math.max(contentHeight, 630);

  // 2パス目: 測定した高さで本描画
  const svg = await satori(
    <TwitterChangelogImage
      siteTitle={siteTitle}
      version={version}
      summary={summary}
      items={items}
    />,
    { width: IMAGE_WIDTH, height, fonts },
  );

  const resvg = new Resvg(svg, {
    fitTo: {
      mode: 'width',
      value: IMAGE_WIDTH,
    },
  });
  const image = resvg.render();

  return image.asPng();
}
