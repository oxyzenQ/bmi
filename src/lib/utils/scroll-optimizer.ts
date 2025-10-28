/**
 * Scroll Performance Optimizer
 * Pauses heavy animations during scroll for better performance
 */

export function initScrollOptimizer() {
  if (typeof window === 'undefined') return;

  let scrollTimer: ReturnType<typeof setTimeout>;
  const body = document.body;

  const handleScroll = () => {
    // Add scrolling class to pause animations
    body.classList.add('is-scrolling');

    // Clear previous timer
    clearTimeout(scrollTimer);

    // Remove class after scrolling stops
    scrollTimer = setTimeout(() => {
      body.classList.remove('is-scrolling');
    }, 150);
  };

  // Use passive listener for better scroll performance
  window.addEventListener('scroll', handleScroll, { passive: true });

  // Cleanup function
  return () => {
    window.removeEventListener('scroll', handleScroll);
    clearTimeout(scrollTimer);
  };
}
