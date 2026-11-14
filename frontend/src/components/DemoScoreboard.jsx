import { useEffect, useRef, useState } from 'react';
import { gsap, prefersReducedMotion, useGSAP } from '../lib/motion';
import Icon from './Icon';
import Counter from './reactbits/Counter';
import { LiveChip } from './ui';

const TEAMS = ['Gospodarze', 'Goście'];

function clockLabel(seconds) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`;
}

/**
 * A self-running sample of the live score view shown on the landing page.
 * It is clearly labelled as an example — no real match data is involved.
 */
export default function DemoScoreboard({ className = '' }) {
  const ref = useRef(null);
  const visible = useRef(true);
  const [state, setState] = useState({ score: [2, 1], seconds: 34 * 60 + 12, last: null });

  useEffect(() => {
    if (prefersReducedMotion()) return undefined;
    const observer = new IntersectionObserver(([entry]) => { visible.current = entry.isIntersecting; });
    observer.observe(ref.current);

    const clock = window.setInterval(() => {
      if (!visible.current) return;
      setState((current) => ({ ...current, seconds: current.seconds + 1 }));
    }, 1000);

    const goals = window.setInterval(() => {
      if (!visible.current) return;
      setState((current) => {
        if (current.score[0] + current.score[1] >= 9) {
          return { score: [0, 0], seconds: 0, last: null };
        }
        const side = Math.random() > 0.5 ? 0 : 1;
        const score = [...current.score];
        score[side] += 1;
        return { ...current, score, last: side };
      });
    }, 3400);

    return () => {
      observer.disconnect();
      window.clearInterval(clock);
      window.clearInterval(goals);
    };
  }, []);

  useGSAP(() => {
    if (state.last === null || prefersReducedMotion()) return;
    gsap.fromTo('.demo-event', { autoAlpha: 0, x: -14 }, { autoAlpha: 1, x: 0, duration: 0.5, ease: 'expo.out' });
    gsap.fromTo(`.demo-side-${state.last}`, { '--pulse': 1 }, { '--pulse': 0, duration: 0.9, ease: 'power2.out' });
  }, { dependencies: [state.score[0], state.score[1]], scope: ref });

  return (
    <div ref={ref} className={`scoreboard ${className}`} role="img" aria-label="Przykładowy podgląd wyniku meczu na żywo">
      <div className="scoreboard-head" aria-hidden="true">
        <div className="flex items-center gap-2">
          <LiveChip />
          <span className="chip">Przykład</span>
        </div>
        <span className="clock !text-base">{clockLabel(state.seconds)}</span>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3 px-5 pb-5 pt-6 sm:px-7" aria-hidden="true">
        {TEAMS.map((team, side) => (
          <div
            key={team}
            className={`demo-side-${side} min-w-0 rounded-xl px-2 py-2 text-center ${side === 1 ? 'col-start-3' : ''}`}
            style={{ background: 'color-mix(in srgb, var(--accent) calc(var(--pulse, 0) * 55%), transparent)' }}
          >
            <p className="mono truncate text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted">{team}</p>
            <div className="score-digits mt-2">
              <Counter value={state.score[side]} fontSize="clamp(4.5rem, 9vw, 7.5rem)" fontWeight={800} duration={0.6} fade={0.12} />
            </div>
          </div>
        ))}
        <span className="score-digits col-start-2 row-start-1 pb-4 text-5xl text-muted">:</span>
      </div>
      <div className="flex min-h-[46px] items-center gap-2 border-t border-line px-5 py-3 text-sm sm:px-7" aria-hidden="true">
        {state.last === null ? (
          <span className="text-muted">Wynik aktualizuje się sam — bez odświeżania strony.</span>
        ) : (
          <span className="demo-event inline-flex items-center gap-2 font-semibold text-ink">
            <Icon name="bolt" size={16} />
            Punkt — {TEAMS[state.last]}
          </span>
        )}
      </div>
    </div>
  );
}
