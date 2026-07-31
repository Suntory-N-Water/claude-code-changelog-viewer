import type { SaveWeeklySelectionItem, WeeklySelectionState } from './types';

const UPLOAD_URL = '/api/uploads';
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const DRAG_OVER_CLASSES = [
  'border-[hsl(var(--cc-main-orange))]',
  'bg-[hsl(var(--cc-main-orange)/0.06)]',
];

export function setupImageUpload(input: {
  section: HTMLElement;
  itemId: string;
  week: string;
  template: HTMLTemplateElement;
  state: WeeklySelectionState;
  save: SaveWeeklySelectionItem;
}) {
  const slot = input.template.content.firstElementChild?.cloneNode(
    true,
  ) as HTMLElement;
  const dropzone = slot.querySelector<HTMLButtonElement>('[data-dropzone]');
  const fileInput = slot.querySelector<HTMLInputElement>('[data-file]');
  const preview = slot.querySelector<HTMLElement>('[data-preview]');
  const thumbnail = slot.querySelector<HTMLImageElement>('[data-thumbnail]');
  const status = slot.querySelector<HTMLElement>('[data-status]');
  const error = slot.querySelector<HTMLElement>('[data-error]');
  const replaceButton = slot.querySelector<HTMLButtonElement>('[data-replace]');
  const deleteButton = slot.querySelector<HTMLButtonElement>('[data-delete]');
  if (
    !dropzone ||
    !fileInput ||
    !preview ||
    !thumbnail ||
    !status ||
    !error ||
    !replaceButton ||
    !deleteButton
  ) {
    throw new Error('画像アップロード UI の初期化に失敗しました');
  }
  const formControls = [
    ...slot.querySelectorAll<HTMLInputElement | HTMLButtonElement>(
      'input, button',
    ),
  ];

  const render = (url?: string) => {
    dropzone.hidden = Boolean(url);
    preview.hidden = !url;
    if (url) {
      thumbnail.src = url;
    } else {
      thumbnail.removeAttribute('src');
    }
  };

  const clear = () => {
    render();
    error.hidden = true;
  };

  let uploading = false;
  const upload = async (file: File) => {
    if (uploading) {
      return;
    }
    error.hidden = true;
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      error.textContent = 'PNG・JPEG・WebP のみアップロードできます';
      error.hidden = false;
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      error.textContent = '画像は 5MB 以下にしてください';
      error.hidden = false;
      return;
    }

    uploading = true;
    status.hidden = false;
    dropzone.setAttribute('aria-busy', 'true');
    for (const control of formControls) {
      control.disabled = true;
    }

    const body = new FormData();
    body.append('week', input.week);
    body.append('itemId', input.itemId);
    body.append('file', file);
    try {
      const response = await fetch(UPLOAD_URL, { method: 'POST', body });
      const result = (await response.json().catch(() => ({}))) as {
        url?: unknown;
        error?: string;
      };
      if (!response.ok || typeof result.url !== 'string') {
        throw new Error(result.error ?? 'アップロードに失敗しました');
      }
      render(result.url);
      input.save({ imageUrl: result.url });
    } catch (cause) {
      error.textContent =
        cause instanceof Error ? cause.message : 'アップロードに失敗しました';
      error.hidden = false;
    } finally {
      uploading = false;
      status.hidden = true;
      dropzone.removeAttribute('aria-busy');
      for (const control of formControls) {
        control.disabled = false;
      }
    }
  };

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (file) {
      void upload(file);
    }
  });
  for (const button of [dropzone, replaceButton]) {
    button.addEventListener('click', () => fileInput.click());
  }

  slot.addEventListener('dragover', (event) => {
    event.preventDefault();
    slot.classList.add(...DRAG_OVER_CLASSES);
  });
  slot.addEventListener('dragleave', (event) => {
    if (slot.contains(event.relatedTarget as Node | null)) {
      return;
    }
    slot.classList.remove(...DRAG_OVER_CLASSES);
  });
  slot.addEventListener('drop', (event) => {
    event.preventDefault();
    slot.classList.remove(...DRAG_OVER_CLASSES);
    const file = event.dataTransfer?.files[0];
    if (file) {
      void upload(file);
    }
  });

  input.section.addEventListener('paste', (event) => {
    if (slot.hidden) {
      return;
    }
    const file = [...(event.clipboardData?.items ?? [])]
      .find((item) => item.kind === 'file')
      ?.getAsFile();
    if (file) {
      event.preventDefault();
      void upload(file);
    }
  });

  deleteButton.addEventListener('click', () => {
    clear();
    input.save({ imageUrl: undefined });
  });

  render(input.state[input.itemId]?.imageUrl);
  input.section.append(slot);
  return { element: slot, clear };
}
