import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { gsap, prefersReducedMotion, scrollToTarget, useGSAP } from '../lib/motion';
import Icon from './Icon';

const TourContext = createContext(null);
const STORAGE_PREFIX = 'tourniDesk.tour.';
const GAP = 14;
const PAD = 8;

function hasSeen(id) {
  try {
    return localStorage.getItem(STORAGE_PREFIX + id) === 'done';
  } catch {
    return true;
  }
}

function markSeen(id) {
  try {
    localStorage.setItem(STORAGE_PREFIX + id, 'done');
  } catch {
    /* private mode — the tour simply shows again next time */
  }
}

function findTarget(step) {
  if (!step?.target) return null;
  const element = document.querySelector(step.target);
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 ? element : null;
}

/**
 * Guided tour: every page can register a list of steps pointing at `[data-tour]`
 * elements. The provider renders the spotlight and the explanation card.
 */
export function TourProvider({ children }) {
  const [available, setAvailable] = useState(null);
  const [run, setRun] = useState(null);

  const register = useCallback((tour) => {
    setAvailable(tour);
    return () => {
      setAvailable((current) => (current?.id === tour.id ? null : current));
      setRun((current) => (current?.id === tour.id ? null : current));
    };
  }, []);

  const start = useCallback((tour) => {
    const steps = tour.steps.filter(findTarget);
    if (steps.length) setRun({ id: tour.id, steps, index: 0 });
  }, []);

  const close = useCallback(() => {
    setRun((current) => {
      if (current) markSeen(current.id);
      return null;
    });
  }, []);

  const go = useCallback((delta) => {
    setRun((current) => {
      if (!current) return current;
      const index = current.index + delta;
      if (index < 0) return current;
      if (index >= current.steps.length) {
        markSeen(current.id);
        return null;
      }
      return { ...current, index };
    });
  }, []);

  const value = useMemo(() => ({
    available,
    running: Boolean(run),
    register,
    start,
    startAvailable: () => { if (available) start(available); },
  }), [available, register, run, start]);

  return (
    <TourContext.Provider value={value}>
      {children}
      {run && createPortal(<TourOverlay run={run} onGo={go} onClose={close} />, document.body)}
    </TourContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTourControls() {
  const context = useContext(TourContext);
  if (!context) throw new Error('useTourControls must be used inside <TourProvider>');
  return context;
}

/**
 * Registers the tour of the current page. With `auto`, it starts by itself the first
 * time the user sees the page (once `ready` — e.g. after data has loaded).
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useTour(id, steps, { auto = false, ready = true } = {}) {
  const { register, start } = useTourControls();

  useEffect(() => {
    if (!ready) return undefined;
    const tour = { id, steps };
    const unregister = register(tour);
    let timeout = 0;
    if (auto && !hasSeen(id)) {
      timeout = window.setTimeout(() => start(tour), 900);
    }
    return () => {
      window.clearTimeout(timeout);
      unregister();
    };
  }, [auto, id, ready, register, start, steps]);
}

function TourOverlay({ run, onGo, onClose }) {
  const holeRef = useRef(null);
  const cardRef = useRef(null);
  const nextRef = useRef(null);
  const step = run.steps[run.index];
  const last = run.index === run.steps.length - 1;

  /* Bring the highlighted element into view whenever the step changes. */
  useEffect(() => {
    const element = findTarget(step);
    if (!element) return;
    const rect = element.getBoundingClientRect();
    const roomy = rect.top > 96 && rect.bottom < window.innerHeight - 260;
    if (!roomy) {
      const top = rect.top + window.scrollY - Math.max(96, (window.innerHeight - rect.height) / 2 - 80);
      scrollToTarget(Math.max(0, top), { offset: 0 });
    }
    nextRef.current?.focus({ preventScroll: true });
  }, [step]);

  /* Follow the target every frame: it keeps the spotlight glued to the element
     while the page scrolls and glides smoothly from one step to the next. */
  useEffect(() => {
    const hole = holeRef.current;
    const card = cardRef.current;
    if (!hole || !card) return undefined;
    const ease = prefersReducedMotion() ? 1 : 0.2;
    const box = { x: 0, y: 0, w: 0, h: 0, cx: 0, cy: 0, ready: false };
    let frame = 0;

    const tick = () => {
      frame = requestAnimationFrame(tick);
      const element = findTarget(step);
      if (!element) return;
      const rect = element.getBoundingClientRect();
      const target = {
        x: rect.left - PAD,
        y: rect.top - PAD,
        w: rect.width + PAD * 2,
        h: rect.height + PAD * 2,
      };

      const cardWidth = card.offsetWidth;
      const cardHeight = card.offsetHeight;
      const below = target.y + target.h + GAP;
      const above = target.y - GAP - cardHeight;
      let cy;
      if (below + cardHeight <= window.innerHeight - 12) cy = below;
      else if (above >= 12) cy = above;
      else cy = window.innerHeight - cardHeight - 12;
      const cx = Math.min(Math.max(12, target.x), window.innerWidth - cardWidth - 12);

      if (!box.ready) {
        Object.assign(box, target, { cx, cy, ready: true });
      } else {
        box.x += (target.x - box.x) * ease;
        box.y += (target.y - box.y) * ease;
        box.w += (target.w - box.w) * ease;
        box.h += (target.h - box.h) * ease;
        box.cx += (cx - box.cx) * ease;
        box.cy += (cy - box.cy) * ease;
      }

      hole.style.transform = `translate3d(${box.x.toFixed(1)}px, ${box.y.toFixed(1)}px, 0)`;
      hole.style.width = `${box.w.toFixed(1)}px`;
      hole.style.height = `${box.h.toFixed(1)}px`;
      card.style.transform = `translate3d(${box.cx.toFixed(1)}px, ${box.cy.toFixed(1)}px, 0)`;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [step]);

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === 'Escape') onClose();
      else if (event.key === 'ArrowRight') onGo(1);
      else if (event.key === 'ArrowLeft') onGo(-1);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, onGo]);

  useGSAP(() => {
    if (prefersReducedMotion()) return;
    gsap.fromTo([holeRef.current, cardRef.current], { opacity: 0 }, { opacity: 1, duration: 0.35, ease: 'power1.out' });
  }, []);

  useGSAP(() => {
    if (prefersReducedMotion()) return;
    gsap.fromTo('.tour-copy > *', { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.4, stagger: 0.05, ease: 'power3.out' });
  }, { dependencies: [run.index], scope: cardRef });

  return (
    <>
      <div className="fixed inset-0 z-[109]" aria-hidden="true" onClick={() => onGo(1)} />
      <div ref={holeRef} className="tour-hole left-0 top-0" aria-hidden="true" />
      <div ref={cardRef} className="tour-card left-0 top-0" role="dialog" aria-label="Przewodnik po stronie" aria-live="polite">
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="mono text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted">
            Krok {run.index + 1} z {run.steps.length}
          </span>
          <button type="button" onClick={onClose} className="-mr-1 grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-sunk hover:text-ink" aria-label="Zamknij przewodnik">
            <Icon name="x" size={18} />
          </button>
        </div>
        <div className="tour-copy">
          <h2 className="h-card">{step.title}</h2>
          <p className="mt-2 text-[0.9375rem] leading-relaxed text-body">{step.body}</p>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="tour-dots" aria-hidden="true">
            {run.steps.map((item, index) => <span key={item.target} data-on={index === run.index} />)}
          </div>
          <div className="flex gap-2">
            {run.index > 0 && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => onGo(-1)}>Wstecz</button>
            )}
            <button ref={nextRef} type="button" className="btn btn-primary btn-sm" onClick={() => onGo(1)}>
              {last ? 'Gotowe' : 'Dalej'}
              <Icon name={last ? 'check' : 'arrow-right'} size={16} className="btn-arrow" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
