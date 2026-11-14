import { useRef } from 'react';
import { gsap, prefersReducedMotion, useGSAP } from '../lib/motion';
import { plural } from '../lib/labels';

const BOX = { width: 132, height: 38 };
const COLUMNS = [4, 196, 388];
const FIRST = [8, 62, 132, 186];
const SECOND = [35, 159];
const FINAL = 97;

/**
 * Sketch of a single-elimination bracket for the chosen number of participants.
 * Every time the number changes, the wires are redrawn with GSAP DrawSVG.
 */
export default function BracketPreview({ participants }) {
  const ref = useRef(null);
  const rounds = Math.max(1, Math.ceil(Math.log2(participants)));
  const firstRoundMatches = 2 ** (rounds - 1);
  const hiddenMatches = Math.max(0, firstRoundMatches - 4);
  const skippedRounds = Math.max(0, rounds - 3);

  useGSAP(() => {
    if (prefersReducedMotion()) return;
    const timeline = gsap.timeline({ defaults: { ease: 'power3.out' } });
    timeline
      .fromTo('.bracket-box', { autoAlpha: 0, x: -10 }, { autoAlpha: 1, x: 0, duration: 0.45, stagger: 0.04 })
      .fromTo('.bracket-wire', { drawSVG: '0%' }, { drawSVG: '100%', duration: 0.6, stagger: 0.07, ease: 'power2.inOut' }, 0.1)
      .fromTo('.bracket-wire-dashed', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5 }, 0.45)
      .fromTo('.bracket-final-box', { scale: 0.7, transformOrigin: '50% 50%', autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.55, ease: 'back.out(2.2)' }, 0.55);
  }, { dependencies: [participants], scope: ref, revertOnUpdate: true });

  const midY = (y) => y + BOX.height / 2;

  return (
    <div ref={ref}>
      <svg viewBox="0 0 524 232" className="w-full" role="img" aria-label={`Podgląd drabinki: ${participants} uczestników, ${rounds} ${plural(rounds, 'runda', 'rundy', 'rund')}`}>
        {FIRST.map((y, index) => (
          <g key={`first-${index}`} className="bracket-box">
            <rect className="bracket-slot" x={COLUMNS[0]} y={y} width={BOX.width} height={BOX.height} rx="7" />
            <text className="bracket-label" x={COLUMNS[0] + 12} y={y + 23}>Mecz {index + 1}</text>
          </g>
        ))}
        {[0, 1].map((pair) => (
          <path
            key={`wire-a-${pair}`}
            className="bracket-wire"
            d={`M${COLUMNS[0] + BOX.width} ${midY(FIRST[pair * 2])}H166V${midY(FIRST[pair * 2 + 1])}H${COLUMNS[0] + BOX.width}M166 ${midY(SECOND[pair])}H${COLUMNS[1]}`}
          />
        ))}
        {SECOND.map((y, index) => (
          <g key={`second-${index}`} className="bracket-box">
            <rect className="bracket-slot" x={COLUMNS[1]} y={y} width={BOX.width} height={BOX.height} rx="7" />
            <text className="bracket-label" x={COLUMNS[1] + 12} y={y + 23}>{rounds === 3 ? 'Półfinał' : 'Runda 2'}</text>
          </g>
        ))}
        <path
          className={skippedRounds ? 'bracket-wire-dashed' : 'bracket-wire'}
          d={`M${COLUMNS[1] + BOX.width} ${midY(SECOND[0])}H358V${midY(SECOND[1])}H${COLUMNS[1] + BOX.width}M358 ${midY(FINAL)}H${COLUMNS[2]}`}
        />
        <g className="bracket-final-box">
          <rect className="bracket-slot-final" x={COLUMNS[2]} y={FINAL} width={BOX.width} height={BOX.height} rx="7" />
          <text className="bracket-label-final" x={COLUMNS[2] + BOX.width / 2} y={FINAL + 25} textAnchor="middle">FINAŁ</text>
        </g>
      </svg>
      <p className="mt-3 text-[0.8125rem] leading-snug text-muted">
        {hiddenMatches > 0
          ? `Pokazujemy fragment: 4 z ${firstRoundMatches} meczów pierwszej rundy. `
          : ''}
        {skippedRounds > 0
          ? `Po drodze do finału: jeszcze ${skippedRounds} ${plural(skippedRounds, 'runda', 'rundy', 'rund')}.`
          : 'To pełna drabinka dla tej liczby uczestników.'}
      </p>
    </div>
  );
}
