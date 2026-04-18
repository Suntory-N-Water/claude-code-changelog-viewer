import { renderTurnstileFor } from './turnstile';

type Tab = 'discord' | 'slack' | 'email';

/** Discord / Slack / Email タブの切り替えロジックをセットアップする */
export function setupTabs() {
  const tabDiscord = document.getElementById('tab-discord');
  const tabSlack = document.getElementById('tab-slack');
  const tabEmail = document.getElementById('tab-email');
  const panelDiscord = document.getElementById('panel-discord');
  const panelSlack = document.getElementById('panel-slack');
  const panelEmail = document.getElementById('panel-email');

  if (
    !tabDiscord ||
    !tabSlack ||
    !tabEmail ||
    !panelDiscord ||
    !panelSlack ||
    !panelEmail
  ) {
    return;
  }

  const activeTabClass =
    'border-[hsl(var(--cc-main-orange))] text-[hsl(var(--cc-main-orange))]';
  const inactiveTabClass =
    'border-transparent text-[hsl(var(--cc-main-black)/0.5)] hover:text-[hsl(var(--cc-main-black)/0.8)]';

  const tabs: Record<Tab, { tab: HTMLElement; panel: HTMLElement }> = {
    discord: { tab: tabDiscord, panel: panelDiscord },
    slack: { tab: tabSlack, panel: panelSlack },
    email: { tab: tabEmail, panel: panelEmail },
  };

  function switchTab(active: Tab) {
    for (const [key, { tab, panel }] of Object.entries(tabs) as [
      Tab,
      { tab: HTMLElement; panel: HTMLElement },
    ][]) {
      const isActive = key === active;
      panel.classList.toggle('hidden', !isActive);
      tab.setAttribute('aria-selected', String(isActive));
      tab.className = tab.className
        .replace(isActive ? inactiveTabClass : activeTabClass, '')
        .trim();
      tab.classList.add(
        ...(isActive ? activeTabClass : inactiveTabClass).split(' '),
      );
    }

    // タブ切り替え時に Turnstile を遅延レンダリング
    if (window.turnstile) {
      renderTurnstileFor('discord-turnstile', 'discord');
      if (active === 'slack') {
        renderTurnstileFor('slack-turnstile', 'slack');
      }
      if (active === 'email') {
        renderTurnstileFor('email-turnstile', 'email');
      }
    }
  }

  tabDiscord.addEventListener('click', () => switchTab('discord'));
  tabSlack.addEventListener('click', () => switchTab('slack'));
  tabEmail.addEventListener('click', () => switchTab('email'));
}
