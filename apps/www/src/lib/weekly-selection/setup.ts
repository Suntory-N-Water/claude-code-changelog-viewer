import { setupImageUpload } from './image-upload';
import { setupLinkRows } from './link-rows';
import type { WeeklySelectionState } from './types';

export function setupWeeklySelection() {
  const root = document.querySelector<HTMLElement>('#weekly-selection');
  if (!root) {
    return;
  }

  const { week, periodStart, periodEnd, totalItems } = root.dataset;
  const imageTemplate = document.querySelector<HTMLTemplateElement>(
    '#weekly-image-template',
  );
  const linkRowTemplate = document.querySelector<HTMLTemplateElement>(
    '#weekly-link-row-template',
  );
  const copyButton = root.querySelector<HTMLButtonElement>('#copy-button');
  const clearButton = root.querySelector<HTMLButtonElement>('#clear-button');
  if (
    !week ||
    !periodStart ||
    !periodEnd ||
    !totalItems ||
    !imageTemplate ||
    !linkRowTemplate ||
    !copyButton ||
    !clearButton
  ) {
    throw new Error('週次選定 UI の初期化に失敗しました');
  }

  const storageKey = `weekly-admin-selection:${week}`;
  const sections = [...root.querySelectorAll<HTMLElement>('.weekly-item')];
  const imageSlots = new Map<string, ReturnType<typeof setupImageUpload>>();
  let state: WeeklySelectionState = {};
  try {
    state = JSON.parse(
      localStorage.getItem(storageKey) ?? '{}',
    ) as WeeklySelectionState;
  } catch {
    state = {};
  }

  const controls = sections.map((section) => {
    const checkbox = section.querySelector<HTMLInputElement>(
      'input[type="checkbox"]',
    );
    const comment = section.querySelector<HTMLElement>('[data-comment]');
    const textarea = comment?.querySelector<HTMLTextAreaElement>('textarea');
    const links = section.querySelector<HTMLElement>('[data-links]');
    const itemId = checkbox?.dataset.itemId;
    if (!checkbox || !comment || !textarea || !links || !itemId) {
      throw new Error('週次選定項目の初期化に失敗しました');
    }
    const saved = state[itemId];

    const save = (patch = {}) => {
      const next = {
        checked: checkbox.checked,
        comment: textarea.value,
        imageUrl: state[itemId]?.imageUrl,
        links: state[itemId]?.links,
        ...patch,
      };
      if (next.checked || next.comment || next.imageUrl || next.links?.length) {
        state[itemId] = next;
      } else {
        delete state[itemId];
      }
      localStorage.setItem(storageKey, JSON.stringify(state));
    };

    const linkRows = setupLinkRows({
      container: links,
      itemId,
      template: linkRowTemplate,
      state,
      save,
    });

    const syncItem = () => {
      comment.hidden = !checkbox.checked;
      textarea.disabled = !checkbox.checked;
      links.hidden = !checkbox.checked;
      if (checkbox.checked && !imageSlots.has(itemId)) {
        imageSlots.set(
          itemId,
          setupImageUpload({
            section,
            itemId,
            week,
            template: imageTemplate,
            state,
            save,
          }),
        );
      }
      const imageSlot = imageSlots.get(itemId);
      if (imageSlot) {
        imageSlot.element.hidden = !checkbox.checked;
      }
    };

    if (saved) {
      checkbox.checked = saved.checked;
      textarea.value = saved.comment;
    }
    syncItem();
    checkbox.addEventListener('change', () => {
      syncItem();
      save();
    });
    textarea.addEventListener('input', () => save());

    return {
      checkbox,
      textarea,
      reset: () => {
        checkbox.checked = false;
        textarea.value = '';
        linkRows.reset();
        syncItem();
        imageSlots.get(itemId)?.clear();
      },
    };
  });

  clearButton.addEventListener('click', () => {
    if (!confirm(`${week} に入力した選定内容を削除します。よろしいですか？`)) {
      return;
    }
    for (const control of controls) {
      control.reset();
    }
    state = {};
    localStorage.removeItem(storageKey);
  });

  copyButton.addEventListener('click', async () => {
    const items = controls
      .filter(({ checkbox }) => checkbox.checked)
      .map(({ checkbox, textarea }) => {
        const itemId = checkbox.dataset.itemId ?? '';
        const savedItem = state[itemId];
        return {
          id: itemId,
          version: checkbox.dataset.version,
          comment: textarea.value,
          ...(savedItem?.imageUrl ? { image_url: savedItem.imageUrl } : {}),
          ...(savedItem?.links?.length ? { links: savedItem.links } : {}),
        };
      });
    const content = JSON.stringify(
      {
        week,
        period_start: periodStart,
        period_end: periodEnd,
        total_items: Number(totalItems),
        items,
      },
      null,
      2,
    );

    try {
      await navigator.clipboard.writeText(content);
      const label = copyButton.textContent;
      copyButton.textContent = 'コピーしました';
      setTimeout(() => {
        copyButton.textContent = label;
      }, 2000);
    } catch {
      const fallback = document.createElement('textarea');
      fallback.value = content;
      fallback.style.position = 'fixed';
      fallback.style.opacity = '0';
      document.body.appendChild(fallback);
      fallback.select();
      document.execCommand('copy');
      fallback.remove();
    }
  });
}
