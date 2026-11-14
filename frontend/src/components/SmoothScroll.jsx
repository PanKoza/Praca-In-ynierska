import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import { gsap, prefersReducedMotion, ScrollTrigger, scrollToTarget, setLenis, useGSAP } from '../lib/motion';

/**
 * Wires Lenis smooth scrolling to the GSAP ticker, keeps ScrollTrigger measurements
 * fresh when the page grows, and plays the route change transition.
 */
export default function SmoothScroll({ viewRef }) {
  const location = useLocation();
  const barRef = useRef(null);
  const firstRender = useRef(true);

  useEffect(() => {
    if (prefersReducedMotion()) return undefined;
    const lenis = new Lenis({ lerp: 0.12, allowNestedScroll: true, stopInertiaOnNavigate: true });
    setLenis(lenis);
    lenis.on('scroll', ScrollTrigger.update);
    const tick = (time) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(tick);
      lenis.destroy();
      setLenis(null);
    };
  }, []);

  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return undefined;
    let timeout = 0;
    let lastHeight = document.body.scrollHeight;
    const observer = new ResizeObserver(() => {
      const height = document.body.scrollHeight;
      if (height === lastHeight) return;
      lastHeight = height;
      window.clearTimeout(timeout);
      timeout = window.setTimeout(() => ScrollTrigger.refresh(), 160);
    });
    observer.observe(document.body);
    return () => {
      window.clearTimeout(timeout);
      observer.disconnect();
    };
  }, []);

  useGSAP(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (!location.hash) scrollToTarget(0, { immediate: true, offset: 0 });
    if (prefersReducedMotion()) return;

    gsap.timeline()
      .fromTo(barRef.current, { scaleX: 0, autoAlpha: 1, transformOrigin: 'left center' }, { scaleX: 1, duration: 0.5, ease: 'power2.out' })
      .to(barRef.current, { autoAlpha: 0, duration: 0.3 });

    if (viewRef.current) {
      gsap.fromTo(
        viewRef.current,
        { autoAlpha: 0, y: 14 },
        { autoAlpha: 1, y: 0, duration: 0.55, ease: 'power3.out', clearProps: 'transform,opacity,visibility' },
      );
    }
  }, { dependencies: [location.pathname] });

  return <div ref={barRef} className="route-bar" aria-hidden="true" />;
}
