import { chromium } from 'playwright';

/**
 * Google翻訳を使用して英語テキストを日本語に翻訳
 */
export async function translateToJapanese(text: string): Promise<string> {
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage();
    await page.goto('https://translate.google.com/?sl=en&tl=ja&op=translate');

    // テキストエリアに入力
    await page.fill('textarea[jsname="BJE2fc"]', text);

    // 翻訳API完了を待機
    await page.waitForResponse((r) =>
      r.url().includes('_/TranslateWebserverUi'),
    );
    await page.waitForResponse((r) => r.url().includes('/log?format=json'));
    await page.waitForTimeout(1 * 1000);

    // 翻訳結果を取得
    const translated = await page.locator('span[jsname="jqKxS"]').innerText();

    console.log(
      `[翻訳完了] ${text.substring(0, 50)}... → ${translated.substring(0, 50)}...`,
    );

    return translated;
  } finally {
    await browser.close();
  }
}
