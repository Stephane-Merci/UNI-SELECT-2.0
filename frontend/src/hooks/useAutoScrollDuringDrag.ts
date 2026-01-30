import { useCallback, useRef } from 'react';

const EDGE_THRESHOLD = 80;
const SCROLL_SPEED = 12;

function isScrollable(el: Element): boolean {
  if (el === document.documentElement || el === document.body) return true;
  const style = window.getComputedStyle(el);
  const overflowY = style.overflowY;
  const overflowX = style.overflowX;
  const overflow = style.overflow;
  const canScrollY = overflow === 'auto' || overflow === 'scroll' || overflowY === 'auto' || overflowY === 'scroll';
  const canScrollX = overflow === 'auto' || overflow === 'scroll' || overflowX === 'auto' || overflowX === 'scroll';
  const scrollableY = canScrollY && (el as HTMLElement).scrollHeight > (el as HTMLElement).clientHeight;
  const scrollableX = canScrollX && (el as HTMLElement).scrollWidth > (el as HTMLElement).clientWidth;
  return scrollableY || scrollableX;
}

/** Collect scrollable ancestors of the element at (x,y), plus any scrollable in the doc that contains (x,y) */
function collectScrollableAt(clientX: number, clientY: number): HTMLElement[] {
  const seen = new Set<HTMLElement>();
  const add = (el: HTMLElement) => {
    if (!seen.has(el)) {
      seen.add(el);
    }
  };

  const under = document.elementFromPoint(clientX, clientY);
  let el: Element | null = under;
  while (el) {
    if (el === document.documentElement) {
      add(document.documentElement);
      break;
    }
    if (el instanceof HTMLElement && isScrollable(el)) add(el);
    el = el.parentElement;
  }

  const scrollables = document.body.querySelectorAll('*');
  for (let i = 0; i < scrollables.length; i++) {
    const node = scrollables[i];
    if (!(node instanceof HTMLElement)) continue;
    if (seen.has(node)) continue;
    if (!isScrollable(node)) continue;
    const rect = node.getBoundingClientRect();
    if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) add(node);
  }

  return Array.from(seen);
}

function scrollTowardPointer(el: HTMLElement, clientX: number, clientY: number): void {
  const isDoc = el === document.documentElement;
  const rect = isDoc
    ? { top: 0, left: 0, bottom: window.innerHeight, right: window.innerWidth }
    : el.getBoundingClientRect();
  const scrollTop = isDoc ? document.documentElement.scrollTop : el.scrollTop;
  const scrollLeft = isDoc ? document.documentElement.scrollLeft : el.scrollLeft;
  const maxScrollTop = isDoc
    ? document.documentElement.scrollHeight - window.innerHeight
    : el.scrollHeight - el.clientHeight;
  const maxScrollLeft = isDoc
    ? document.documentElement.scrollWidth - window.innerWidth
    : el.scrollWidth - el.clientWidth;

  let dy = 0;
  let dx = 0;

  if (maxScrollTop > 0) {
    if (clientY - rect.top < EDGE_THRESHOLD && scrollTop > 0) dy = -SCROLL_SPEED;
    else if (rect.bottom - clientY < EDGE_THRESHOLD && scrollTop < maxScrollTop) dy = SCROLL_SPEED;
  }
  if (maxScrollLeft > 0) {
    if (clientX - rect.left < EDGE_THRESHOLD && scrollLeft > 0) dx = -SCROLL_SPEED;
    else if (rect.right - clientX < EDGE_THRESHOLD && scrollLeft < maxScrollLeft) dx = SCROLL_SPEED;
  }

  if (dy !== 0 || dx !== 0) {
    if (isDoc) {
      window.scrollBy({ top: dy, left: dx, behavior: 'auto' });
    } else {
      el.scrollTop += dy;
      el.scrollLeft += dx;
    }
  }
}

/**
 * Hook to enable auto-scroll when dragging near the edges of scrollable containers.
 * Wrap your DndContext onDragStart/onDragEnd/onDragCancel with the returned handlers.
 */
export function useAutoScrollDuringDrag() {
  const rafRef = useRef<number | null>(null);
  const listenerRef = useRef<((e: PointerEvent) => void) | null>(null);

  const stopScrolling = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    const listener = listenerRef.current;
    if (listener) {
      document.removeEventListener('pointermove', listener, { capture: true });
      document.removeEventListener('pointerup', stopScrolling, { capture: true });
      document.removeEventListener('pointercancel', stopScrolling, { capture: true });
      listenerRef.current = null;
    }
  }, []);

  const startScrolling = useCallback(() => {
    const onPointerMove = (e: PointerEvent) => {
      if (rafRef.current != null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const scrollables = collectScrollableAt(e.clientX, e.clientY);
        for (const scrollable of scrollables) {
          scrollTowardPointer(scrollable, e.clientX, e.clientY);
        }
      });
    };
    listenerRef.current = onPointerMove;
    document.addEventListener('pointermove', onPointerMove, { capture: true });
    document.addEventListener('pointerup', stopScrolling, { capture: true });
    document.addEventListener('pointercancel', stopScrolling, { capture: true });
  }, [stopScrolling]);

  const wrapDragStart = useCallback(
    <E>(handler?: (e: E) => void) =>
      (e: E) => {
        handler?.(e);
        startScrolling();
      },
    [startScrolling]
  );

  const wrapDragEnd = useCallback(
    <E>(handler?: (e: E) => void) =>
      (e: E) => {
        stopScrolling();
        handler?.(e);
      },
    [stopScrolling]
  );

  const wrapDragCancel = useCallback(
    (handler?: () => void) =>
      () => {
        stopScrolling();
        handler?.();
      },
    [stopScrolling]
  );

  return { wrapDragStart, wrapDragEnd, wrapDragCancel };
}
