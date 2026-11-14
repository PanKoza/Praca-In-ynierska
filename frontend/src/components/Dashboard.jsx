import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { gsap, prefersReducedMotion, useGSAP } from '../lib/motion';
import { sportIcon, sportLabel } from '../lib/labels';
import Icon from './Icon';

/* Rounded dashboard panel with an optional icon / title / action header. */
export function Panel({ as: Tag = 'section', icon, title, subtitle, action, children, className = '', ...rest }) {
  return (
    <Tag className={`panel ${className}`} {...rest}>
      {title && (
        <header className="panel-head">
          {icon && <span className="panel-icon"><Icon name={icon} size={18} /></span>}
          <div className="min-w-0 flex-1">
            <h2 className="panel-title">{title}</h2>
            {subtitle && <p className="panel-sub">{subtitle}</p>}
          </div>
          {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
        </header>
      )}
      {children}
    </Tag>
  );
}

/* Footer strip of small figures pinned to the bottom of a panel. */
export function PanelStats({ items }) {
  return (
    <dl className="panel-stats">
      {items.map(([term, value, tone]) => (
        <div key={term}>
          <dt className="truncate text-xs font-semibold text-muted">{term}</dt>
          <dd className={`num mt-1 truncate text-2xl ${tone === 'live' ? '!text-live' : ''}`}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/* Faint pitch markings printed on every pass. */
function PassLines() {
  return (
    <svg className="pass-lines" viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.4">
        <rect x="12" y="12" width="296" height="176" rx="6" />
        <line x1="160" y1="12" x2="160" y2="188" />
        <circle cx="160" cy="100" r="30" />
        <rect x="12" y="58" width="40" height="84" />
        <rect x="268" y="58" width="40" height="84" />
      </g>
    </svg>
  );
}

/** Spaced "card number" style date: 14 · 06 · 2026 */
function passDate(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '·· · ·· · ····';
  const pad = (number) => String(number).padStart(2, '0');
  return `${pad(date.getDate())} · ${pad(date.getMonth() + 1)} · ${date.getFullYear()}`;
}

const PASS_TONES = ['ink', 'accent', 'paper'];

/* An event rendered like a card in a wallet. `index` picks the colourway so neighbours differ. */
export function EventPass({ to, state, index = 0, sport, title, tag, live = false, date, facts = [], label }) {
  const code = passDate(date);
  return (
    <Link to={to} state={state} className="pass" data-tone={PASS_TONES[index % PASS_TONES.length]} aria-label={label}>
      <PassLines />
      <div className="pass-top">
        <span className="pass-brand">
          <Icon name={sportIcon(sport)} size={16} />
          {sportLabel(sport)}
        </span>
        {tag && (
          <span className="pass-tag">
            {live && <span className="live-dot" aria-hidden="true" />}
            {tag}
          </span>
        )}
      </div>
      <p className="pass-title">{title}</p>
      {code && <p className="pass-code">{code}</p>}
      <dl className="pass-foot">
        {facts.map(([term, value]) => (
          <div key={term} className="min-w-0">
            <dt>{term}</dt>
            <dd>{value}</dd>
          </div>
        ))}
        <span className="ml-auto shrink-0 opacity-80"><Icon name="arrow-up-right" size={20} /></span>
      </dl>
    </Link>
  );
}

export function PassAdd({ to, children }) {
  return (
    <Link to={to} className="pass pass-add">
      <span className="pass-add-icon"><Icon name="plus" size={22} /></span>
      <span>{children}</span>
    </Link>
  );
}

/* Horizontal rail of passes that deal in like cards when first seen. */
export function PassRail({ children, label }) {
  const ref = useRef(null);

  useGSAP(() => {
    const rail = ref.current;
    if (!rail || prefersReducedMotion()) return undefined;
    const cards = Array.from(rail.children);
    if (!cards.length) return undefined;
    gsap.set(cards, { autoAlpha: 0, x: 90, rotate: 5 });
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      gsap.to(cards, {
        autoAlpha: 1,
        x: 0,
        rotate: 0,
        duration: 0.9,
        stagger: 0.09,
        ease: 'expo.out',
        clearProps: 'transform,opacity,visibility',
      });
    }, { threshold: 0.15 });
    observer.observe(rail);
    return () => observer.disconnect();
  }, { scope: ref });

  return <div ref={ref} className="pass-rail" role="list" aria-label={label}>{children}</div>;
}

/* Segmented bar, e.g. scheduled / live / finished matches. Segments grow in on first view. */
export function StackBar({ segments, label }) {
  const ref = useRef(null);
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);

  useGSAP(() => {
    const bars = ref.current ? Array.from(ref.current.children) : [];
    if (!bars.length || prefersReducedMotion()) return undefined;
    gsap.set(bars, { scaleX: 0 });
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      gsap.to(bars, { scaleX: 1, duration: 0.9, stagger: 0.12, ease: 'expo.out', delay: 0.2, clearProps: 'transform' });
    }, { threshold: 0.2 });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, { scope: ref, dependencies: [total] });

  return (
    <div>
      <div ref={ref} className="stack-bar" role="img" aria-label={label}>
        {total > 0 && segments.filter((segment) => segment.value > 0).map((segment) => (
          <span key={segment.label} style={{ flexGrow: segment.value, background: segment.color }} />
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[0.8125rem] text-muted">
        {segments.map((segment) => (
          <li key={segment.label} className="flex items-center gap-1.5">
            <span className="legend-dot" style={{ background: segment.color }} aria-hidden="true" />
            {segment.label} <span className="font-semibold text-ink">{segment.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
