const successClass = 'mt-5 flex items-start gap-3 p-4 rounded-lg bg-paper-2 text-sm text-ink';
const errorClass = 'mt-5 flex items-start gap-3 p-4 rounded-lg bg-paper-2 text-sm text-error';

type FormConfig = {
  formId: string;
  webhookInputId: string;
  webhookErrorId: string;
  submitButtonId: string;
  submitTextId: string;
  submitSpinnerId: string;
  resultMessageId: string;
  inputFieldName: 'webhook_url' | 'email_address';
  validateUrl: (url: string) => boolean;
};

/** Webhook 登録フォームの入力検証・送信処理をセットアップする */
export function setupForm(config: FormConfig) {
  const {
    formId,
    webhookInputId,
    webhookErrorId,
    submitButtonId,
    submitTextId,
    submitSpinnerId,
    resultMessageId,
    inputFieldName,
    validateUrl,
  } = config;

  const form = document.getElementById(formId) as HTMLFormElement | null;
  const input = document.getElementById(webhookInputId) as HTMLInputElement | null;
  const urlError = document.getElementById(webhookErrorId);
  const submitBtn = document.getElementById(submitButtonId) as HTMLButtonElement | null;
  const submitText = document.getElementById(submitTextId);
  const spinner = document.getElementById(submitSpinnerId);
  const resultMessage = document.getElementById(resultMessageId);

  if (!form || !input || !urlError || !submitBtn || !submitText || !spinner || !resultMessage) {
    return;
  }

  const submitLabel = submitText.textContent ?? '';

  input.addEventListener('input', () => {
    const value = input.value.trim();
    if (value && !validateUrl(value)) {
      urlError.classList.remove('hidden');
    } else {
      urlError.classList.add('hidden');
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const inputValue = input.value.trim();
    if (!inputValue) {
      return;
    }

    if (!validateUrl(inputValue)) {
      urlError.classList.remove('hidden');
      return;
    }

    const turnstileResponse = form.querySelector(
      '[name="cf-turnstile-response"]',
    ) as HTMLInputElement | null;
    const turnstile_token = turnstileResponse?.value ?? '';
    const channel_type = form.dataset.channelType ?? 'DSC';

    submitBtn.disabled = true;
    submitText.textContent = '登録中…';
    spinner.classList.remove('hidden');
    resultMessage.classList.add('hidden');

    try {
      const baseUrl = form.dataset.workerUrl ?? '';
      const response = await fetch(`${baseUrl}/api/webhooks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          [inputFieldName]: inputValue,
          turnstile_token,
          // TODO: 週末サマリー通知を実装したら外部から受け取り仕組みにする。それまでは固定値。
          frequency: 'IMM',
          channel_type,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        resultMessage.className = successClass;
        resultMessage.textContent = '登録しました。テスト通知を送りました';
        window.gtag?.('event', 'notify_signup', {
          event_category: 'engagement',
          event_label: channel_type,
        });
      } else if (response.status === 409) {
        resultMessage.className = errorClass;
        resultMessage.textContent = '登録済みです';
      } else {
        resultMessage.className = errorClass;
        resultMessage.textContent = data.error ?? '登録できませんでした';
      }
    } catch {
      resultMessage.className = errorClass;
      resultMessage.textContent = '通信できませんでした';
    } finally {
      resultMessage.classList.remove('hidden');
      submitText.textContent = submitLabel;
      spinner.classList.add('hidden');
      submitBtn.disabled = true;
      // トークンは一度使うと無効になるのでリセット
      if (window.turnstile) {
        window.turnstile.reset();
      }
    }
  });
}
