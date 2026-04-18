declare global {
  // biome-ignore lint/style/useConsistentTypeDefinitions: declare global には interface が必要
  interface Window {
    turnstile?: {
      reset: (widgetId?: string) => void;
      render: (
        container: string | HTMLElement,
        options: Record<string, unknown>,
      ) => string;
    };
    onDiscordTurnstileSuccess?: () => void;
    onDiscordTurnstileExpired?: () => void;
    onSlackTurnstileSuccess?: () => void;
    onSlackTurnstileExpired?: () => void;
  }
}

type TurnstileWidgetIds = { discord: string | null; slack: string | null };

const turnstileWidgets: TurnstileWidgetIds = {
  discord: null,
  slack: null,
};

/**
 * 指定コンテナに Turnstile ウィジェットをレンダリングする。
 * すでにレンダリング済み、またはコンテナ / turnstile API が未準備の場合はスキップ。
 */
export function renderTurnstileFor(
  containerId: string,
  key: keyof TurnstileWidgetIds,
) {
  const container = document.getElementById(containerId);
  if (!container || !window.turnstile || turnstileWidgets[key]) {
    return;
  }
  turnstileWidgets[key] = window.turnstile.render(container, {
    sitekey: container.getAttribute('data-sitekey'),
    callback:
      key === 'discord'
        ? window.onDiscordTurnstileSuccess
        : window.onSlackTurnstileSuccess,
    'expired-callback':
      key === 'discord'
        ? window.onDiscordTurnstileExpired
        : window.onSlackTurnstileExpired,
  });
}
