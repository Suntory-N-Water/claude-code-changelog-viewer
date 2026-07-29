import { getCollection } from 'astro:content';
import { Resvg } from '@resvg/resvg-js';
import type { APIContext } from 'astro';
import { format, parseISO } from 'date-fns';
import satori from 'satori';
import { SITE_TITLE } from '../../../../lib/constants';

const WIDTH = 1200;
const HEIGHT = 630;

const COLORS = {
  mainOrange: '#DB8163',
  orangeHover: '#D97757',
  mainWhite: '#FAF9F5',
  mainBlack: '#141413',
};

// Google Fonts はブラウザの User-Agent を送ると WOFF2 を返すが satori は WOFF2 を読めない。
// User-Agent を付けずに取得すると TTF が返る。
// text= で必要な文字だけに絞ると @font-face が1個になり、下の正規表現で URL を取り出せる。
async function loadNotoSansJp(text: string): Promise<ArrayBuffer> {
  const cssUrl = `https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@600&text=${encodeURIComponent(text)}`;
  const cssResponse = await fetch(cssUrl);
  if (!cssResponse.ok) {
    throw new Error(
      `Google Fonts の CSS 取得に失敗しました: ${cssResponse.status} ${cssUrl}`,
    );
  }
  const fontUrl = (await cssResponse.text()).match(/src: url\(([^)]+)\)/)?.[1];
  if (!fontUrl) {
    throw new Error(
      'Google Fonts の CSS からフォント URL を取り出せませんでした',
    );
  }
  const fontResponse = await fetch(fontUrl);
  if (!fontResponse.ok) {
    throw new Error(`フォントの取得に失敗しました: ${fontResponse.status}`);
  }
  return fontResponse.arrayBuffer();
}

export async function getStaticPaths() {
  const posts = await getCollection('column');

  return posts.map((entry) => ({
    params: { slug: entry.data.slug },
    props: { entry },
  }));
}

export async function GET({ props }: APIContext) {
  const { title, date } = props.entry.data;
  const dateLabel = format(parseISO(date), 'yyyy年M月d日');

  const fontData = await loadNotoSansJp(`${SITE_TITLE}${title}${dateLabel}`);

  // 長いタイトルでもカードに収まるよう、文字数で段階的に縮める
  const titleFontSize = title.length > 40 ? 44 : title.length > 24 ? 52 : 60;

  const svg = await satori(
    {
      type: 'div',
      props: {
        style: {
          display: 'flex',
          width: '100%',
          height: '100%',
          padding: 32,
          background: `linear-gradient(135deg, ${COLORS.mainOrange} 0%, ${COLORS.orangeHover} 100%)`,
        },
        children: {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              width: '100%',
              height: '100%',
              padding: 56,
              borderRadius: 24,
              backgroundColor: COLORS.mainWhite,
            },
            children: [
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: 32,
                    color: COLORS.mainBlack,
                    opacity: 0.6,
                  },
                  children: SITE_TITLE,
                },
              },
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: titleFontSize,
                    lineHeight: 1.35,
                    color: COLORS.mainBlack,
                  },
                  children: title,
                },
              },
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: 28,
                    color: COLORS.mainBlack,
                    opacity: 0.55,
                  },
                  children: dateLabel,
                },
              },
            ],
          },
        },
      },
    },
    {
      width: WIDTH,
      height: HEIGHT,
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

  // satori が字形をパスとして埋め込むため、resvg 側でシステムフォントを読む必要はない
  const png = new Resvg(svg, {
    fitTo: { mode: 'width', value: WIDTH },
    font: { loadSystemFonts: false },
  })
    .render()
    .asPng();

  return new Response(new Uint8Array(png), {
    headers: { 'Content-Type': 'image/png' },
  });
}
