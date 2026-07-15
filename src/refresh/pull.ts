import { el } from '../render/dom.js';

/**
 * S6 custom pull-to-refresh. Native pull-to-refresh is unreliable in standalone
 * PWAs, so we implement our own: a downward drag that starts while the page is
 * scrolled to the top pulls a spinner into view and, past a threshold, fires
 * `onRefresh`. Pointer Events cover touch and pen (a mouse is ignored so it
 * can't hijack clicks).
 *
 * The indicator is mounted on <body> (not inside the feed container, which is
 * cleared on every render); gesture listeners live on the container element,
 * which persists across renders. Returns a disposer.
 */
export function installPullToRefresh(
  container: HTMLElement,
  onRefresh: () => void | Promise<void>,
  opts: { threshold?: number; scrollTop?: () => number } = {},
): () => void {
  const threshold = opts.threshold ?? 70;
  const scrollTop = opts.scrollTop ?? ((): number => window.scrollY);

  const indicator = el('div', { class: 'pull', 'data-pull-indicator': 'true', 'aria-hidden': 'true' }, [
    el('span', { class: 'pull__spinner' }),
  ]);
  document.body.append(indicator);

  let startY: number | null = null;
  let pulled = 0;
  let busy = false;

  const setPull = (px: number): void => {
    pulled = px;
    indicator.style.setProperty('--pull', `${px}px`);
    indicator.classList.toggle('pull--armed', px >= threshold);
  };

  const reset = (): void => {
    startY = null;
    setPull(0);
    indicator.classList.remove('pull--active');
  };

  const onDown = (e: PointerEvent): void => {
    if (busy || scrollTop() > 0 || e.pointerType === 'mouse') return;
    startY = e.clientY;
    indicator.classList.add('pull--active');
  };

  const onMove = (e: PointerEvent): void => {
    if (startY === null) return;
    const dy = e.clientY - startY;
    if (dy <= 0) {
      setPull(0);
      return;
    }
    // Resistance: the indicator lags the finger so the pull feels physical.
    setPull(Math.min(dy * 0.5, threshold * 1.6));
  };

  const onUp = (): void => {
    if (startY === null) return;
    const trigger = pulled >= threshold;
    if (trigger && !busy) {
      busy = true;
      startY = null;
      indicator.classList.add('pull--loading');
      indicator.classList.add('pull--armed');
      void Promise.resolve(onRefresh()).finally(() => {
        busy = false;
        indicator.classList.remove('pull--loading');
        reset();
      });
    } else {
      reset();
    }
  };

  container.addEventListener('pointerdown', onDown, { passive: true });
  container.addEventListener('pointermove', onMove, { passive: true });
  container.addEventListener('pointerup', onUp);
  container.addEventListener('pointercancel', reset);

  return () => {
    container.removeEventListener('pointerdown', onDown);
    container.removeEventListener('pointermove', onMove);
    container.removeEventListener('pointerup', onUp);
    container.removeEventListener('pointercancel', reset);
    indicator.remove();
  };
}
