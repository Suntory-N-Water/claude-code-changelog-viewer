import { JSDOM } from 'jsdom';

export function cleanTranscript(raw: string): string {
  let text = raw.normalize('NFKC');
  text = text.replace(/\[.+?\]/g, '');
  text = text.replace(/([^\x20-\x7E])\s+([^\x20-\x7E])/g, '$1$2');
  text = text.replace(/ {2,}/g, ' ');
  return text.trim();
}

export function extractTranscriptFromHtml(html: string): string | null {
  const dom = new JSDOM(html);
  return extractTranscriptFromDocument(dom.window.document);
}

export function extractTranscriptFromDocument(
  document: Document,
): string | null {
  const items = Array.from(
    document.querySelectorAll('.desktop-transcript-container .transcript-item'),
  );
  if (items.length === 0) {
    return null;
  }

  const text = cleanTranscript(
    items
      .map((item) =>
        item.querySelector('div:nth-child(2)')?.textContent?.trim(),
      )
      .filter((segment): segment is string => Boolean(segment))
      .join(' '),
  );

  return text.length > 0 ? text : null;
}
