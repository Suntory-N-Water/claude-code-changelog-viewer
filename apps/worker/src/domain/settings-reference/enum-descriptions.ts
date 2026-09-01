export type EnumDescriptionTranslation = {
  value: string;
  descriptionJa: string;
};

/**
 * AI が返した選択肢ごとの日本語説明を、保存する JSON にする。
 *
 * 公式の英文にある値だけを残す。英文にない値は AI が作り出したものであり、
 * 設定ファイルに書けない値を読者に見せないため捨てる。
 */
export function buildEnumDescriptionsJa(
  source: Readonly<Record<string, string>> | undefined,
  translations: readonly EnumDescriptionTranslation[],
): string | null {
  if (source === undefined) {
    return null;
  }

  const translationByValue = new Map(
    translations.map((translation) => [
      translation.value,
      translation.descriptionJa.trim(),
    ]),
  );
  const pairs = Object.keys(source).flatMap((value) => {
    const descriptionJa = translationByValue.get(value);
    return descriptionJa === undefined || descriptionJa === ''
      ? []
      : [[value, descriptionJa] as const];
  });

  return pairs.length === 0 ? null : JSON.stringify(Object.fromEntries(pairs));
}

/** 保存された選択肢ごとの説明を、値と説明の対応へ戻す。 */
export function parseEnumDescriptions(
  stored: string | null,
): Record<string, string> | undefined {
  if (stored === null) {
    return;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stored);
  } catch {
    return;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return;
  }

  const entries = Object.entries(parsed).flatMap(([value, description]) =>
    typeof description === 'string' ? [[value, description] as const] : [],
  );
  return entries.length === 0 ? undefined : Object.fromEntries(entries);
}
