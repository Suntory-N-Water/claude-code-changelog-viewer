const successClass =
  'mt-5 flex items-start gap-3 p-4 rounded-lg bg-[hsl(var(--cc-main-orange)/0.06)] border border-[hsl(var(--cc-main-orange)/0.2)] text-sm text-[hsl(var(--cc-main-black)/0.8)]';
const errorClass =
  'mt-5 flex items-start gap-3 p-4 rounded-lg bg-[hsl(var(--cc-main-black)/0.03)] border border-[hsl(var(--cc-gray))] text-sm text-[hsl(var(--cc-main-black)/0.7)]';

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
  const input = document.getElementById(
    webhookInputId,
  ) as HTMLInputElement | null;
  const urlError = document.getElementById(webhookErrorId);
  const submitBtn = document.getElementById(
    submitButtonId,
  ) as HTMLButtonElement | null;
  const submitText = document.getElementById(submitTextId);
  const spinner = document.getElementById(submitSpinnerId);
  const resultMessage = document.getElementById(resultMessageId);

  if (
    !form ||
    !input ||
    !urlError ||
    !submitBtn ||
    !submitText ||
    !spinner ||
    !resultMessage
  ) {
    return;
  }

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
    submitText.textContent = '送信中...';
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
        resultMessage.textContent =
          '登録が完了しました。テスト通知を送信しました。';
      } else if (response.status === 409) {
        resultMessage.className = errorClass;
        resultMessage.textContent = '既に登録済みです。';
      } else {
        resultMessage.className = errorClass;
        resultMessage.textContent =
          data.error ?? '登録に失敗しました。もう一度お試しください。';
      }
    } catch {
      resultMessage.className = errorClass;
      resultMessage.textContent =
        'ネットワークエラーが発生しました。もう一度お試しください。';
    } finally {
      resultMessage.classList.remove('hidden');
      submitText.textContent = '登録する';
      spinner.classList.add('hidden');
      submitBtn.disabled = true;
      // トークンは一度使うと無効になるのでリセット
      if (window.turnstile) {
        window.turnstile.reset();
      }
    }
  });
}
