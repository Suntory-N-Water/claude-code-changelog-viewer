import { renderTurnstileFor } from './turnstile';

/** Discord / Slack タブの切り替えロジックをセットアップする */
export function setupTabs() {
  const tabDiscord = document.getElementById('tab-discord');
  const tabSlack = document.getElementById('tab-slack');
  const panelDiscord = document.getElementById('panel-discord');
  const panelSlack = document.getElementById('panel-slack');

  if (!tabDiscord || !tabSlack || !panelDiscord || !panelSlack) {
    return;
  }

  // null チェック済みのため非 null アサーションで型を確定させる
  const tabDiscordEl = tabDiscord!;
  const tabSlackEl = tabSlack!;
  const panelDiscordEl = panelDiscord!;
  const panelSlackEl = panelSlack!;

  const activeTabClass =
    'border-[hsl(var(--cc-main-orange))] text-[hsl(var(--cc-main-orange))]';
  const inactiveTabClass =
    'border-transparent text-[hsl(var(--cc-main-black)/0.5)] hover:text-[hsl(var(--cc-main-black)/0.8)]';

  function switchTab(tab: 'discord' | 'slack') {
    const isDiscord = tab === 'discord';

    panelDiscordEl.classList.toggle('hidden', !isDiscord);
    panelSlackEl.classList.toggle('hidden', isDiscord);

    tabDiscordEl.setAttribute('aria-selected', String(isDiscord));
    tabSlackEl.setAttribute('aria-selected', String(!isDiscord));

    tabDiscordEl.className = tabDiscordEl.className
      .replace(isDiscord ? inactiveTabClass : activeTabClass, '')
      .trim();
    tabDiscordEl.classList.add(
      ...(isDiscord ? activeTabClass : inactiveTabClass).split(' '),
    );

    tabSlackEl.className = tabSlackEl.className
      .replace(!isDiscord ? inactiveTabClass : activeTabClass, '')
      .trim();
    tabSlackEl.classList.add(
      ...(!isDiscord ? activeTabClass : inactiveTabClass).split(' '),
    );

    // タブ切り替え時に Turnstile を遅延レンダリング
    if (window.turnstile) {
      renderTurnstileFor('discord-turnstile', 'discord');
      if (!isDiscord) {
        renderTurnstileFor('slack-turnstile', 'slack');
      }
    }
  }

  tabDiscord.addEventListener('click', () => switchTab('discord'));
  tabSlack.addEventListener('click', () => switchTab('slack'));
}
