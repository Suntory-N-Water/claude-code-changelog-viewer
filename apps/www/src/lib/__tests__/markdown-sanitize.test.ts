import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import { remarkAlert } from 'remark-github-blockquote-alert';
import { beforeAll, describe, expect, test } from 'vitest';
import { markdownSanitizeSchema } from '../markdown-sanitize';

let render: (markdown: string) => Promise<string>;

beforeAll(async () => {
  const processor = await createMarkdownProcessor({
    remarkPlugins: [remarkAlert],
    rehypePlugins: [rehypeRaw, [rehypeSanitize, markdownSanitizeSchema]],
  });
  render = async (markdown) => (await processor.render(markdown)).code;
});

describe('markdownSanitizeSchema', () => {
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

  test('コラム記事の画像アップロードが出力する img の属性を残す', async () => {
    const html = await render(
      '<img alt="図" src="https://assets.claude-code-log.com/a.png" width="800" height="400">\n',
    );

    expect(html).toContain('alt="図"');
    expect(html).toContain('src="https://assets.claude-code-log.com/a.png"');
    expect(html).toContain('width="800"');
    expect(html).toContain('height="400"');
  });

  test('GitHub 風アラートのクラスとアイコンを残す', async () => {
    const html = await render('> [!NOTE]\n> 本文\n');

    expect(html).toContain('class="markdown-alert markdown-alert-note"');
    expect(html).toContain('class="markdown-alert-title"');
    expect(html).toContain('<svg');
    expect(html).toContain('viewBox="0 0 16 16"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toMatch(/<path d="[^"]+"/);
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

  test('_blank 以外の target と noopener 以外の rel を除去する', async () => {
    const html = await render(
      '<a href="https://example.com/" target="_self" rel="opener">link</a>\n',
    );

    expect(html).not.toContain('target=');
    expect(html).not.toContain('opener"');
  });

  test('window のプロパティを作る name に user-content- を前置する', async () => {
    const html = await render('<img name="location" src="https://x/y.png">\n');

    expect(html).toContain('name="user-content-location"');
  });

  test('脚注のリンク先と id が一致する', async () => {
    const html = await render('本文[^1]\n\n[^1]: 注釈\n');

    expect(html).toContain('href="#user-content-fn-1"');
    expect(html).toContain('id="user-content-fn-1"');
  });
});
