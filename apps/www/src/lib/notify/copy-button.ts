/** マニフェストのコピーボタンをセットアップする */
export function setupCopyButton() {
  const btn = document.getElementById('copy-manifest-btn');
  const copyIcon = document.getElementById('copy-icon');
  const checkIcon = document.getElementById('check-icon');
  const copyLabel = document.getElementById('copy-label');
  const code = document.querySelector('#panel-slack pre code');

  if (!btn || !copyIcon || !checkIcon || !copyLabel || !code) {
    return;
  }

  btn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(code.textContent ?? '');
      copyIcon.classList.add('hidden');
      checkIcon.classList.remove('hidden');
      copyLabel.textContent = 'コピーしました';
      setTimeout(() => {
        copyIcon.classList.remove('hidden');
        checkIcon.classList.add('hidden');
        copyLabel.textContent = 'コピー';
      }, 2000);
    } catch {
      // クリップボードAPIが使えない場合は何もしない
    }
  });
}
