import type { SaveWeeklySelectionItem, WeeklySelectionState } from './types';

export function setupLinkRows(input: {
  container: HTMLElement;
  itemId: string;
  template: HTMLTemplateElement;
  state: WeeklySelectionState;
  save: SaveWeeklySelectionItem;
}) {
  const rows = input.container.querySelector<HTMLElement>('[data-link-rows]');
  const addButton =
    input.container.querySelector<HTMLButtonElement>('[data-link-add]');
  if (!rows || !addButton) {
    throw new Error('関連リンク UI の初期化に失敗しました');
  }

  const collect = () =>
    [...rows.querySelectorAll<HTMLInputElement>('[data-link]')]
      .map((linkInput) => linkInput.value.trim())
      .filter(Boolean);

  const addRow = (value?: string) => {
    const row = input.template.content.firstElementChild?.cloneNode(
      true,
    ) as HTMLElement;
    const linkInput = row.querySelector<HTMLInputElement>('[data-link]');
    const error = row.querySelector<HTMLElement>('[data-link-error]');
    const removeButton =
      row.querySelector<HTMLButtonElement>('[data-link-remove]');
    if (!linkInput || !error || !removeButton) {
      throw new Error('関連リンク行の初期化に失敗しました');
    }
    linkInput.value = value ?? '';
    linkInput.addEventListener('input', () => input.save({ links: collect() }));
    linkInput.addEventListener('blur', () => {
      const url = linkInput.value.trim();
      let valid = true;
      if (url) {
        try {
          valid = ['http:', 'https:'].includes(new URL(url).protocol);
        } catch {
          valid = false;
        }
      }
      error.textContent = valid
        ? ''
        : 'http:// または https:// から始まる URL を入力してください';
      error.hidden = valid;
    });
    removeButton.addEventListener('click', () => {
      if (rows.children.length > 1) {
        row.remove();
      } else {
        linkInput.value = '';
        error.hidden = true;
      }
      input.save({ links: collect() });
    });
    rows.append(row);
    return linkInput;
  };

  addButton.addEventListener('click', () => addRow().focus());

  const reset = (links?: string[]) => {
    rows.replaceChildren();
    for (const url of links?.length ? links : ['']) {
      addRow(url);
    }
  };

  reset(input.state[input.itemId]?.links);
  return { reset };
}
