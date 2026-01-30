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

// フォントデータをモジュールスコープでキャッシュ
let cachedFontData: ArrayBuffer | null = null;

/**
 * Google Fontsからフォントデータを取得
 */
async function loadFont(): Promise<ArrayBuffer> {
  if (cachedFontData) {
    return cachedFontData;
  }

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
  cachedFontData = await fontResponse.arrayBuffer();

  return cachedFontData;
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
          変更項目: {itemCount}件
        </div>
      </div>
    </div>
  );
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
