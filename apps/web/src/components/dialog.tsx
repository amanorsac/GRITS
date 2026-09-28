import { useEffect, useRef, type ReactNode, type RefObject } from 'react';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])';

/** Keeps focus inside an open dialog, closes on Escape, and hands focus back when it closes. */
export function useDialog(ref: RefObject<HTMLElement | null>, onClose: () => void, onKey?: (e: KeyboardEvent) => void) {
  const close = useRef(onClose);
  const key = useRef(onKey);
  close.current = onClose;
  key.current = onKey;
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const el = ref.current;
    const first = el?.querySelector<HTMLElement>('[data-autofocus]') ?? el?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? el)?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        close.current();
        return;
      }
      if (e.key === 'Tab' && el) {
        const items = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((n) => n.offsetParent !== null || n === document.activeElement);
        if (!items.length) {
          e.preventDefault();
          return;
        }
        const a = items[0]!;
        const z = items[items.length - 1]!;
        if (e.shiftKey && (document.activeElement === a || !el.contains(document.activeElement))) {
          e.preventDefault();
          z.focus();
        } else if (!e.shiftKey && (document.activeElement === z || !el.contains(document.activeElement))) {
          e.preventDefault();
          a.focus();
        }
        return;
      }
      key.current?.(e);
    }
    document.addEventListener('keydown', handler);
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = prevOverflow;
      opener?.focus?.();
    };
  }, [ref]);
}

/** A plain modal on the existing .modal-backdrop / .modal styles. */
export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useDialog(ref, onClose);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className={`modal${wide ? ' modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}>
        <div className="spread" style={{ marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: '1.4rem' }}>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
