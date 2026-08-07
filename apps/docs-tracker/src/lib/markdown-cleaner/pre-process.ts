export function preProcess(raw: string): string {
  let result = removeDocumentationIndex(raw);
  result = removeCodeFenceTheme(result);
  result = removeExportedComponents(result);
  return result;
}

function removeCodeFenceTheme(input: string): string {
  return input.replace(/^(```\w*(?:\s+\w+)?)\s+theme=\{null\}/gm, '$1');
}

function removeDocumentationIndex(input: string): string {
  return input.replace(
    /^> ## Documentation Index\n> Fetch the complete documentation index at:.*\n> Use this file to discover all available pages before exploring further\.\n*/gm,
    '',
  );
}

function removeExportedComponents(input: string): string {
  // コードフェンス内の export を保護するため、フェンス外のみ処理
  const lines = input.split('\n');
  const result: string[] = [];
  let inCodeFence = false;
  let inExportBlock = false;

  for (const line of lines) {
    if (/^```/.test(line)) {
      inCodeFence = !inCodeFence;
    }

    if (inCodeFence) {
      result.push(line);
      continue;
    }

    if (!inExportBlock && /^export\s+const\s+/.test(line)) {
      inExportBlock = true;
      continue;
    }

    if (inExportBlock) {
      if (/^};?\s*$/.test(line)) {
        inExportBlock = false;
      }
      continue;
    }

    result.push(line);
  }

  return result.join('\n');
}
