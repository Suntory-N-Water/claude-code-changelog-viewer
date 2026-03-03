export function getOfficialDocUrl(filePath: string): string {
  const match = filePath.match(/docs\/(en|ja)\/(.+)$/);
  if (!match) {
    return '';
  }
  const lang = match[1];
  const docPath = match[2];
  if (!lang || !docPath) {
    return '';
  }
  // .md拡張子を削除
  const pathWithoutExt = docPath.replace(/\.md$/, '');
  return `https://code.claude.com/docs/${lang}/${pathWithoutExt}`;
}
