export function extractBuiltinSurfaceSection(
  markdown: string,
  sectionName: string,
): string[] {
  const results: string[] = [];
  let inSection = false;
  let inSubSection = false;

  for (const line of markdown.split('\n')) {
    if (line.startsWith('## ')) {
      inSection = line === `## ${sectionName}`;
      inSubSection = false;
      continue;
    }

    if (!inSection) {
      continue;
    }

    if (line.startsWith('### ')) {
      inSubSection = sectionName === 'Commands' && line === '### Names';
      continue;
    }

    if (sectionName === 'Commands' && !inSubSection) {
      continue;
    }

    const match = line.match(/^- `([^`]+)`/);
    if (match?.[1]) {
      results.push(match[1]);
    }
  }

  return results;
}
