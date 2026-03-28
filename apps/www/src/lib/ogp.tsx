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

// フォントデータをPromiseでキャッシュ(並行呼び出し時のレースコンディション防止)
let fontPromise: Promise<ArrayBuffer> | null = null;

/**
 * Google Fontsからフォントデータを取得(失敗時はキャッシュをリセットしてリトライ可能に)
 */
function loadFont(): Promise<ArrayBuffer> {
  if (!fontPromise) {
    fontPromise = (async () => {
      const response = await fetch(
        'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@600&display=swap',
      );
      const css = await response.text();

      const fontUrlMatch = css.match(/src: url\(([^)]+)\)/);
      if (!fontUrlMatch) {
        throw new Error('フォントURLが見つかりませんでした');
      }

      const fontResponse = await fetch(fontUrlMatch[1]);
      return fontResponse.arrayBuffer();
    })().catch((err) => {
      fontPromise = null;
      throw err;
    });
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

type InfoPageOgpProps = {
  siteTitle: string;
  headline: string;
  subtitle: string;
  headlineFontSize?: number;
};

/**
 * 情報ページ共通OGP画像コンポーネント(バージョンページ/機能エリアページ兼用)
 */
function InfoPageOgp({
  siteTitle,
  headline,
  subtitle,
  headlineFontSize = 96,
}: InfoPageOgpProps): ReactElement {
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
              fontSize: headlineFontSize,
              fontWeight: 600,
              color: colors.mainBlack,
            }}
          >
            {headline}
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
          {subtitle}
        </div>
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

/** satori + resvg の共通レンダリング処理 */
async function renderOgpImage(
  element: ReactElement,
  options?: { width?: number; height?: number },
): Promise<Uint8Array> {
  const width = options?.width ?? 1200;
  const height = options?.height ?? 630;
  const fontData = await loadFont();

  const svg = await satori(element, {
    width,
    height,
    fonts: [
      { name: 'Noto Sans JP', data: fontData, weight: 600, style: 'normal' },
    ],
  });

  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: width } });
  return resvg.render().asPng();
}

/**
 * トップページ用OGP画像を生成
 */
export function generateTopPageOgp(
  title: string,
  description: string,
): Promise<Uint8Array> {
  return renderOgpImage(<TopPageOgp title={title} description={description} />);
}

/**
 * バージョンページ用OGP画像を生成
 */
export function generateVersionPageOgp(
  siteTitle: string,
  version: string,
  itemCount: number,
): Promise<Uint8Array> {
  return renderOgpImage(
    <InfoPageOgp
      siteTitle={siteTitle}
      headline={version}
      subtitle={`変更項目: ${itemCount}件`}
    />,
  );
}

/**
 * 機能エリアページ用OGP画像を生成
 */
export function generateFeatureAreaOgp(
  siteTitle: string,
  areaLabel: string,
  itemCount: number,
  versionCount: number,
): Promise<Uint8Array> {
  return renderOgpImage(
    <InfoPageOgp
      siteTitle={siteTitle}
      headline={areaLabel}
      subtitle={`${itemCount}件の変更 / ${versionCount}バージョン`}
      headlineFontSize={80}
    />,
  );
}
