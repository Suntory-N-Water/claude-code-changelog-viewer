import { useEffect, useState } from 'react';

export function ScrollToTop() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const toggleVisibility = () => {
      if (window.scrollY > 300) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener('scroll', toggleVisibility);

    // 初期状態をチェック
    toggleVisibility();

    return () => {
      window.removeEventListener('scroll', toggleVisibility);
    };
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  return (
    <button
      onClick={scrollToTop}
      className={`fixed bottom-8 right-8 w-12 h-12 bg-[hsl(var(--cc-main-orange))] text-white rounded-full shadow-lg hover:bg-[hsl(var(--cc-orange-hover))] transition-all duration-300 z-50 flex items-center justify-center group ${
        isVisible
          ? 'opacity-100 pointer-events-auto'
          : 'opacity-0 pointer-events-none'
      }`}
      aria-label='ページトップへ戻る'
      type='button'
    >
      <svg
        className='w-6 h-6 group-hover:-translate-y-0.5 transition-transform'
        fill='none'
        viewBox='0 0 24 24'
        stroke='currentColor'
        strokeWidth='2.5'
        aria-hidden='true'
      >
        <path strokeLinecap='round' strokeLinejoin='round' d='M5 15l7-7 7 7' />
      </svg>
    </button>
  );
}
