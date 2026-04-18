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
    onEmailTurnstileSuccess?: () => void;
    onEmailTurnstileExpired?: () => void;
  }
}

type TurnstileWidgetIds = {
  discord: string | null;
  slack: string | null;
  email: string | null;
};

const turnstileWidgets: TurnstileWidgetIds = {
  discord: null,
  slack: null,
  email: null,
};

const callbackMap: Record<
  keyof TurnstileWidgetIds,
  { success: keyof Window; expired: keyof Window }
> = {
  discord: {
    success: 'onDiscordTurnstileSuccess',
    expired: 'onDiscordTurnstileExpired',
  },
  slack: {
    success: 'onSlackTurnstileSuccess',
    expired: 'onSlackTurnstileExpired',
  },
  email: {
    success: 'onEmailTurnstileSuccess',
    expired: 'onEmailTurnstileExpired',
  },
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
  const { success, expired } = callbackMap[key];
  turnstileWidgets[key] = window.turnstile.render(container, {
    sitekey: container.getAttribute('data-sitekey'),
    callback: window[success],
    'expired-callback': window[expired],
  });
}
