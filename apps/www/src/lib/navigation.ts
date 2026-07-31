import type { IconName } from './icons';

/**
 * サイトの導線を一箇所にまとめる。
 * ヘッダー・モバイルメニュー・フッターはすべてここを描画するだけにして、
 * セクションを増やしたときの更新漏れをなくす。
 */

export type NavItem = {
  href: string;
  label: string;
  /** モバイルメニューで label の下に添える補足 */
  description: string;
  icon: IconName;
};

/** ヘッダーとモバイルメニューに並べる主要セクション */
export const NAV_ITEMS: readonly NavItem[] = [
  {
    href: '/posts/weekly',
    label: '週次まとめ',
    description: '1 週間分のアップデートから注目の変更を解説',
    icon: 'newspaper',
  },
  {
    href: '/posts/column',
    label: 'コラム',
    description: '使い方や運用で得た知見を記事にまとめる',
    icon: 'pencil-square',
  },
  {
    href: '/docs',
    label: 'Docs 更新履歴',
    description: '公式ドキュメントの差分を AI が日本語で要約',
    icon: 'document-file',
  },
  {
    href: '/reference/settings',
    label: '設定リファレンス',
    description: '設定項目と環境変数を横断で検索',
    icon: 'clipboard-doc',
  },
];

type FooterLink = {
  href: string;
  label: string;
  icon: IconName;
  external?: boolean;
};

type FooterSection = {
  title: string;
  links: readonly FooterLink[];
};

/** フッターの列。コンテンツ / サイト情報 / 外部リソースで分ける */
export const FOOTER_SECTIONS: readonly FooterSection[] = [
  {
    title: 'コンテンツ',
    links: [
      { href: '/', label: 'バージョンの変更履歴', icon: 'list' },
      { href: '/features', label: '機能エリア別の変更履歴', icon: 'grid' },
      ...NAV_ITEMS.map(({ href, label, icon }) => ({ href, label, icon })),
    ],
  },
  {
    title: 'サイト情報',
    links: [
      { href: '/notify', label: '更新通知を受け取る', icon: 'bell' },
      { href: '/about', label: 'このサイトについて', icon: 'info-circle' },
      { href: '/contact', label: 'お問い合わせ', icon: 'mail' },
      { href: '/privacy', label: 'プライバシーポリシー', icon: 'shield-check' },
      { href: '/rss.xml', label: 'RSS フィード', icon: 'rss' },
    ],
  },
  {
    title: '公式リソース',
    links: [
      {
        href: 'https://github.com/anthropics/claude-code',
        label: 'Claude Code GitHub',
        icon: 'github',
        external: true,
      },
      {
        href: 'https://code.claude.com/docs',
        label: '公式ドキュメント',
        icon: 'document',
        external: true,
      },
    ],
  },
];
