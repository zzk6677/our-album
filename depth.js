'use strict';

{
  const motion = matchMedia('(any-hover: hover) and (any-pointer: fine) and (prefers-reduced-motion: no-preference)');
  let active = null;
  let frame = 0;
  let pointerX = 0;
  let pointerY = 0;

  function reset() {
    cancelAnimationFrame(frame);
    frame = 0;
    if (!active) return;
    active.classList.remove('is-tracking');
    active.style.removeProperty('--pointer-x');
    active.style.removeProperty('--pointer-y');
    active = null;
  }

  function paint() {
    frame = 0;
    const bounds = active.getBoundingClientRect();
    if (!bounds.width || !bounds.height) {
      reset();
      return;
    }
    const x = Math.max(-1, Math.min(1, (pointerX - bounds.left) / bounds.width * 2 - 1));
    const y = Math.max(-1, Math.min(1, (pointerY - bounds.top) / bounds.height * 2 - 1));
    active.style.setProperty('--pointer-x', x.toFixed(3));
    active.style.setProperty('--pointer-y', y.toFixed(3));
    active.classList.add('is-tracking');
  }

  document.addEventListener('pointermove', event => {
    if (!motion.matches || event.pointerType !== 'mouse') return;
    const target = event.target.closest('[data-depth]');
    if (target !== active) {
      reset();
      active = target;
    }
    if (!active) return;
    pointerX = event.clientX;
    pointerY = event.clientY;
    if (!frame) frame = requestAnimationFrame(paint);
  }, { passive: true });

  document.addEventListener('pointerout', event => {
    if (active?.contains(event.target) && !active.contains(event.relatedTarget)) reset();
  });
  document.addEventListener('pointercancel', reset);
  document.addEventListener('scroll', reset, { passive: true });
  document.addEventListener('focusin', event => {
    if (event.target.closest('dialog')) reset();
  });
  window.addEventListener('blur', reset);
  motion.addEventListener('change', reset);
}
