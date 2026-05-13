import { backOut, cubicOut } from 'svelte/easing';

// Safe Premium Spring — spring-inspired page transitions.
// IN:  uses backOut easing for natural overshoot + settle (iOS/Apple feel).
//      Scale 0.98 → overshoots to ~1.01 → settles at 1.0. Satisfying "pop".
// OUT: uses cubicOut with reversed time (1-t) — proven glitch-free from 11a717f.
//      Ends at base CSS state (center, opacity 1) so WAAPI cancel produces
//      no visual flash before DOM removal.
//
// Anti-glitch rules (discovered through 7 fix iterations):
// 1. IN must start at opacity 0 — prevents OUT element bleeding through.
//    (0.4 start causes visible ghost of old page behind new page.)
// 2. OUT must end at opacity 1 at base position — prevents 1-frame flash
//    when Web Animations API cancels the animation before DOM removal.
//    (The 1-t reversal makes cubicOut(1-t) go from 1→0, so opacity ends at 1.)
// GPU-only: translate3d, scale, opacity. No rotation, no blur, no gimmicks.
export function pagerSpring(
    _node: Element,
    opts: {
      x: number;
      duration: number;
      phase: 'in' | 'out';
      strength: number;
    }
  ) {
    const x = opts.x;
    const duration = opts.duration;
    const phase = opts.phase;

    return {
      duration,
      css: (t: number) => {
        if (phase === 'in') {
          // IN: spring overshoot + settle via backOut easing.
          // Starts at opacity 0 (no bleed-through) → ends at 1.
          // Scale pop: 0.98 → ~1.01 → 1.0 (backOut overshoot built-in).
          const p = backOut(t);
          const dx = (1 - p) * x;
          const scale = 0.98 + 0.02 * p;
          const opacity = p; // 0 → 1 — invisible start, no ghost bleed-through
          return `transform: translate3d(${dx.toFixed(3)}px, 0, 0) scale(${scale.toFixed(4)}); opacity: ${opacity.toFixed(4)};`;
        } else {
          // OUT: reversed time (1-t) from glitch-free 11a717f baseline.
          // Animation ends at center + opacity 1 (= base CSS state).
          // When WAAPI cancels, element reverts to base CSS — no visual change.
          // IN element fully covers OUT by this point, so the OUT-to-center
          // movement is invisible to the user.
          const linear = 1 - t;
          const p = cubicOut(linear);
          const dx = p * x;
          const opacity = Math.max(0, 1 - p * 1.15); // ends at 1 (= base CSS)
          return `transform: translate3d(${dx.toFixed(3)}px, 0, 0); opacity: ${opacity.toFixed(4)}; pointer-events: none;`;
        }
      }
    };
  }
