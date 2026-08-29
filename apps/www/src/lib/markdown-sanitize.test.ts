import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import { remarkAlert } from 'remark-github-blockquote-alert';
import { describe, expect, test } from 'vitest';
import { markdownRehypePlugins } from './markdown-sanitize';

const processor = await createMarkdownProcessor({
  remarkPlugins: [remarkAlert],
  rehypePlugins: [...markdownRehypePlugins],
});

const render = async (markdown: string) =>
  (await processor.render(markdown)).code;

describe('記事本文のサニタイズ', () => {
  test('script 要素を除去する', async () => {
    const html = await render('<script>alert(1)</script>\n');

    expect(html).not.toContain('<script');
    expect(html).not.toContain('alert(1)');
  });

  test('img の onerror を除去し、img 自体は残す', async () => {
    const html = await render('<img src="x" onerror="alert(1)">\n');

    expect(html).toContain('<img');
    expect(html).toContain('src="x"');
    expect(html).not.toContain('onerror');
  });

  test('javascript: スキームのリンクを除去する', async () => {
    const html = await render('[click](javascript:alert(1))\n');

    expect(html).not.toContain('javascript:');
  });

  test('target は _blank 以外を除去する', async () => {
    const html = await render(
      '<a href="https://example.com/" target="_self">link</a>\n',
    );

    expect(html).not.toContain('target=');
  });

  test('rel は noopener / noreferrer / nofollow 以外の値を除去する', async () => {
    const html = await render(
      '<a href="https://example.com/" rel="opener nofollow">link</a>\n',
    );

    expect(html).toContain('rel="nofollow"');
  });

  test('window のプロパティを作る name に user-content- を前置する', async () => {
    const html = await render('<img name="location" src="https://x/y.png">\n');

    expect(html).toContain('name="user-content-location"');
  });

  test('コラム記事の画像アップロードが出力する img の属性を残す', async () => {
    const html = await render(
      '<img alt="図" src="https://assets.claude-code-log.com/a.png" width="800" height="400">\n',
    );

    expect(html).toContain('alt="図"');
    expect(html).toContain('src="https://assets.claude-code-log.com/a.png"');
    expect(html).toContain('width="800"');
    expect(html).toContain('height="400"');
  });

  // アイコンの形状はプラグイン側の都合で変わるため、属性が残ることだけを見る
  test('GitHub 風アラートのクラスとアイコンを残す', async () => {
    const html = await render('> [!NOTE]\n> 本文\n');

    expect(html).toMatch(/<div class="[^"]*markdown-alert/);
    expect(html).toMatch(/<p class="[^"]*markdown-alert-title/);
    expect(html).toMatch(/<svg[^>]*\sviewBox="/);
    expect(html).toMatch(/<svg[^>]*\saria-hidden="/);
    expect(html).toMatch(/<path[^>]*\sd="/);
  });

  // remark-link-card-plus はリンク先の OG 情報を取りに行くため、生成後の HTML を直接与える
  test('リンクカードの要素とクラスを残す', async () => {
    const html = await render(
      [
        '<div class="remark-link-card-plus__container">',
        '<a href="https://example.com/" target="_blank" rel="noreferrer noopener" class="remark-link-card-plus__card">',
        '<div class="remark-link-card-plus__meta">',
        '<img src="https://example.com/favicon.ico" class="remark-link-card-plus__favicon" width="14" height="14" alt="">',
        '<span class="remark-link-card-plus__url">example.com</span>',
        '</div>',
        '</a>',
        '</div>',
        '',
      ].join('\n'),
    );

    expect(html).toContain('class="remark-link-card-plus__container"');
    expect(html).toContain('class="remark-link-card-plus__card"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noreferrer noopener"');
    expect(html).toContain('class="remark-link-card-plus__favicon"');
    expect(html).toContain('class="remark-link-card-plus__url"');
  });

  test('脚注のリンク先が同じ文書内の id を指す', async () => {
    const html = await render('本文[^1]\n\n[^1]: 注釈\n');

    const fragment = html.match(/href="#([^"]+)"/)?.[1];

    expect(fragment).toBeDefined();
    expect(html).toContain(`id="${fragment}"`);
  });
});
