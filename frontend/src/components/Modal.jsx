import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { gsap, lockScroll, prefersReducedMotion, useGSAP } from '../lib/motion';
import Icon from './Icon';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accessible dialog shell: portal, backdrop, focus trap, Escape to close, scroll lock
 * and an entrance animation. `busy` blocks closing while a request is in flight.
 */
export function Modal({ labelledBy, onClose, busy = false, children, className = '' }) {
  const overlayRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => lockScroll(), []);

  useEffect(() => {
    const previous = document.activeElement;
    const panel = panelRef.current;
    const initial = panel?.querySelector('[data-autofocus]') || panel?.querySelector(FOCUSABLE);
    initial?.focus({ preventScroll: true });
    return () => {
      if (previous instanceof HTMLElement) previous.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === 'Escape' && !busy) {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const items = [...panelRef.current.querySelectorAll(FOCUSABLE)];
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [busy, onClose]);

  useGSAP(() => {
    if (prefersReducedMotion()) return;
    gsap.fromTo(overlayRef.current, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.22, ease: 'power1.out' });
    gsap.fromTo(
      panelRef.current,
      { y: 28, scale: 0.96, autoAlpha: 0 },
      { y: 0, scale: 1, autoAlpha: 1, duration: 0.5, ease: 'expo.out' },
    );
  }, []);

  return createPortal(
    <div
      ref={overlayRef}
      className="overlay"
      data-lenis-prevent
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <section
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={`dialog ${className}`}
      >
        {children}
      </section>
    </div>,
    document.body,
  );
}

const ConfirmContext = createContext(null);

/**
 * Promise-based replacement for window.confirm:
 *   if (!await confirm({ title, body, confirmLabel, tone: 'danger' })) return;
 */
export function ConfirmProvider({ children }) {
  const [request, setRequest] = useState(null);
  const resolver = useRef(null);

  const confirm = useCallback((options) => new Promise((resolve) => {
    resolver.current?.(false);
    resolver.current = resolve;
    setRequest(typeof options === 'string' ? { title: options } : options);
  }), []);

  const settle = useCallback((value) => {
    resolver.current?.(value);
    resolver.current = null;
    setRequest(null);
  }, []);

  const cancel = useCallback(() => settle(false), [settle]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {request && (
        <Modal labelledBy="confirm-title" onClose={cancel}>
          <div className="p-6 sm:p-7">
            <span className={`mb-4 grid h-12 w-12 place-items-center rounded-xl border-[1.5px] ${request.tone === 'danger' ? 'border-danger/50 bg-danger/10 text-danger' : 'border-ink bg-accent text-accent-ink'}`}>
              <Icon name={request.tone === 'danger' ? 'alert' : 'help'} size={24} />
            </span>
            <h2 id="confirm-title" className="h-card !text-[1.6rem]">{request.title}</h2>
            {request.body && <p className="mt-3 text-[0.9375rem] leading-relaxed text-muted">{request.body}</p>}
            <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button type="button" className="btn btn-ghost" onClick={cancel} data-autofocus>
                {request.cancelLabel || 'Anuluj'}
              </button>
              <button
                type="button"
                className={`btn ${request.tone === 'danger' ? 'btn-danger-solid' : 'btn-primary'}`}
                onClick={() => settle(true)}
              >
                {request.confirmLabel || 'Potwierdź'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </ConfirmContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useConfirm() {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error('useConfirm must be used inside <ConfirmProvider>');
  return confirm;
}
