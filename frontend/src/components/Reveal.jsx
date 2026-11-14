import { useRef } from 'react';
import { gsap, prefersReducedMotion, useGSAP } from '../lib/motion';

/**
 * Fades and lifts its content into place the first time it enters the viewport.
 * Visibility is detected with IntersectionObserver, so content that loads late
 * (API data, tab switches) can never get stuck hidden behind a stale trigger.
 *
 * `stagger` animates the direct children one after another instead of the wrapper.
 */
export default function Reveal({
  as: Tag = 'div',
  children,
  delay = 0,
  y = 26,
  stagger = 0,
  duration = 0.8,
  className,
  ...rest
}) {
  const ref = useRef(null);

  useGSAP(() => {
    const element = ref.current;
    if (!element || prefersReducedMotion()) return undefined;
    const targets = stagger ? Array.from(element.children) : [element];
    if (!targets.length) return undefined;

    gsap.set(targets, { autoAlpha: 0, y });
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      gsap.to(targets, {
        autoAlpha: 1,
        y: 0,
        duration,
        delay,
        stagger,
        ease: 'power3.out',
        clearProps: 'transform,opacity,visibility',
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.04 });
    observer.observe(element);
    return () => observer.disconnect();
  }, { scope: ref });

  return <Tag ref={ref} className={className} {...rest}>{children}</Tag>;
}
