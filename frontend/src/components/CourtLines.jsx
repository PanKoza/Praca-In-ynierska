import { useRef } from 'react';
import { gsap, prefersReducedMotion, useGSAP } from '../lib/motion';

/**
 * Top-down pitch markings that draw themselves like chalk lines (GSAP DrawSVG)
 * and drift slightly while the page scrolls. Purely decorative.
 */
export default function CourtLines({ className = '', parallax = true }) {
  const ref = useRef(null);

  useGSAP(() => {
    if (prefersReducedMotion()) return;
    gsap.fromTo(
      '.court-line',
      { drawSVG: '0%' },
      { drawSVG: '100%', duration: 1.8, ease: 'power2.inOut', stagger: 0.09, delay: 0.25 },
    );
    gsap.fromTo('.court-spot', { scale: 0, transformOrigin: '50% 50%' }, { scale: 1, duration: 0.6, ease: 'back.out(2.4)', delay: 1.5 });
    if (parallax) {
      gsap.to(ref.current, {
        yPercent: 12,
        ease: 'none',
        scrollTrigger: { trigger: ref.current.parentElement, start: 'top top', end: 'bottom top', scrub: 0.6 },
      });
    }
  }, { scope: ref });

  return (
    <svg ref={ref} viewBox="0 0 1000 640" className={className} preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <rect className="court-line" x="20" y="20" width="960" height="600" rx="2" />
      <path className="court-line" d="M500 20V620" />
      <circle className="court-line" cx="500" cy="320" r="96" />
      <rect className="court-line" x="20" y="150" width="170" height="340" />
      <rect className="court-line" x="20" y="235" width="62" height="170" />
      <path className="court-line" d="M190 258a96 96 0 0 1 0 124" />
      <rect className="court-line" x="810" y="150" width="170" height="340" />
      <rect className="court-line" x="918" y="235" width="62" height="170" />
      <path className="court-line" d="M810 258a96 96 0 0 0 0 124" />
      <path className="court-line" d="M20 44a24 24 0 0 0 24-24M956 20a24 24 0 0 0 24 24M980 596a24 24 0 0 0-24 24M44 620a24 24 0 0 0-24-24" />
      <circle className="court-spot" cx="500" cy="320" r="7" fill="var(--accent)" stroke="var(--accent-edge)" strokeWidth="1.5" />
    </svg>
  );
}
