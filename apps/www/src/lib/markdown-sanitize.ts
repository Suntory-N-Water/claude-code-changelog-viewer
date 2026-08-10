import { type Options, defaultSchema } from 'rehype-sanitize';

const defaultAttributes = defaultSchema.attributes ?? {};

/**
 * 記事本文の Markdown → HTML 変換で使う許可リスト。
 * 本文には LLM が生成した文章と GitHub の CHANGELOG.md 原文がそのまま入るため、
 * 許可した要素・属性以外は出力前に落とす。
 */
export const markdownSanitizeSchema: Options = {
  ...defaultSchema,
  // defaultSchema は id / aria-describedby / aria-labelledby / name に user-content- を前置する。
  // このうち id は remark-rehype が脚注へ既に付けており、二重に付くと
  // href="#user-content-fn-1" と食い違って脚注リンクが切れる。
  // id を外すと aria-* だけが前置されて参照先とずれるため、両方とも前置対象から外す。
  // name は window のプロパティを作るため前置を残す。
  clobber: ['name'],
  // svg / path は defaultSchema に無く、追加しないと remark-github-blockquote-alert のアイコンが消える
  tagNames: [...(defaultSchema.tagNames ?? []), 'svg', 'path'],
  attributes: {
    ...defaultAttributes,
    // defaultSchema の a には値を data-footnote-backref に限定した className 定義があり、
    // 残したまま 'className' を足すと remark-link-card-plus の class が空文字になる
    a: [
      ...(defaultAttributes['a'] ?? []).filter(
        (attribute) =>
          !(Array.isArray(attribute) && attribute[0] === 'className'),
      ),
      'className',
      // remark-link-card-plus が出力する target="_blank" rel="noreferrer noopener" だけを通す。
      // _parent / _top や rel="opener" を書いても落ちる。
      // target="_blank" に rel が無い場合は現行ブラウザが noopener を暗黙に付ける。
      ['target', '_blank'],
      ['rel', 'noopener', 'noreferrer', 'nofollow'],
    ],
    div: [...(defaultAttributes['div'] ?? []), 'className'],
    p: [...(defaultAttributes['p'] ?? []), 'className'],
    span: [...(defaultAttributes['span'] ?? []), 'className'],
    img: [...(defaultAttributes['img'] ?? []), 'className'],
    svg: ['className', 'viewBox', 'ariaHidden'],
    path: ['d'],
  },
};
