/**
 * Scroll Performance Optimizer
 * Pauses heavy animations during scroll for better performance
 */

export function initScrollOptimizer() {
  if (typeof window === 'undefined') return;

  let scrollTimer: ReturnType<typeof setTimeout>;
  const body = document.body;
  let isScrolling = false;
  const scrollListenerOptions: AddEventListenerOptions = { passive: true, capture: true };

  const handleScroll = () => {
    if (!isScrolling) {
      isScrolling = true;
      body.classList.add('is-scrolling');
    }

    // Clear previous timer
    clearTimeout(scrollTimer);

    // Remove class after scrolling stops
    scrollTimer = setTimeout(() => {
      isScrolling = false;
      body.classList.remove('is-scrolling');
    }, 150);
  };

  // Use passive listener for better scroll performance
  document.addEventListener('scroll', handleScroll, scrollListenerOptions);

  // Cleanup function
  return () => {
    document.removeEventListener('scroll', handleScroll, scrollListenerOptions);
    clearTimeout(scrollTimer);
  };
}
