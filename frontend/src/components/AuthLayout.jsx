import { useRef } from 'react';
import { gsap, prefersReducedMotion, useGSAP } from '../lib/motion';
import CourtLines from './CourtLines';
import Icon from './Icon';
import { Title } from './ui';

/* Two-column frame for login and registration: the form on the left, a pitch-side poster on the right. */
export default function AuthLayout({ eyebrow, title, lead, children, posterTitle, posterPoints }) {
  const ref = useRef(null);

  useGSAP(() => {
    if (prefersReducedMotion()) return;
    gsap.fromTo('.auth-rise', { autoAlpha: 0, y: 22 }, { autoAlpha: 1, y: 0, duration: 0.7, ease: 'expo.out', stagger: 0.06, delay: 0.15 });
    gsap.fromTo('.auth-point', { autoAlpha: 0, x: 24 }, { autoAlpha: 1, x: 0, duration: 0.7, ease: 'expo.out', stagger: 0.1, delay: 0.5 });
  }, { scope: ref });

  return (
    <main ref={ref} className="grid min-h-[calc(100vh-var(--nav-h))] lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
      <div className="flex items-center justify-center px-4 py-10 sm:px-8 sm:py-14">
        <div className="w-full max-w-[27rem]">
          <p className="eyebrow auth-rise mb-4">{eyebrow}</p>
          <Title className="h-page !text-[clamp(2.6rem,6vw,3.75rem)]">{title}</Title>
          <div className="auth-rise mt-3 text-[0.9375rem] text-muted">{lead}</div>
          <div className="mt-8">{children}</div>
        </div>
      </div>

      <aside className="relative hidden overflow-hidden border-l border-line bg-surface lg:block" aria-hidden="true">
        <div className="absolute inset-0 opacity-[0.16]">
          <CourtLines className="h-full w-full" parallax={false} />
        </div>
        <div className="relative flex h-full flex-col justify-end p-12 xl:p-16">
          <p className="display text-[clamp(3rem,5vw,5rem)]">{posterTitle}</p>
          <ul className="mt-8 grid gap-3">
            {posterPoints.map((point) => (
              <li key={point} className="auth-point flex items-center gap-3 text-[0.9375rem] font-semibold text-ink">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border-[1.5px] border-ink bg-accent text-accent-ink"><Icon name="check" size={15} strokeWidth={2.5} /></span>
                {point}
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </main>
  );
}
