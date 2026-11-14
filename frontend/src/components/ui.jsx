import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { gsap, prefersReducedMotion, useGSAP } from '../lib/motion';
import { MATCH_STATUS, TOURNAMENT_STATUS, sportIcon, sportLabel } from '../lib/labels';
import Icon from './Icon';
import CountUp from './reactbits/CountUp';
import SplitText from './reactbits/SplitText';

export function StatusChip({ status, kind = 'tournament', className = '' }) {
  const config = (kind === 'match' ? MATCH_STATUS : TOURNAMENT_STATUS)[status] || { label: status, tone: 'neutral' };
  return (
    <span className={`chip ${className}`} data-tone={config.tone}>
      {config.tone === 'live' && <span className="live-dot" aria-hidden="true" />}
      {config.label}
    </span>
  );
}

export function LiveChip({ children = 'Na żywo', className = '' }) {
  return (
    <span className={`chip ${className}`} data-tone="live">
      <span className="live-dot" aria-hidden="true" />
      {children}
    </span>
  );
}

export function SportBadge({ sport, size = 22, className = '' }) {
  return (
    <span className={`sport-badge ${className}`} title={sportLabel(sport)}>
      <Icon name={sportIcon(sport)} size={size} />
    </span>
  );
}

export function SportLabel({ sport, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-2 text-sm font-semibold text-muted ${className}`}>
      <Icon name={sportIcon(sport)} size={17} />
      {sportLabel(sport)}
    </span>
  );
}

export function Avatar({ name, className = '' }) {
  return <span className={`avatar ${className}`} aria-hidden="true">{name?.trim().charAt(0) || '?'}</span>;
}

/* Capacity / progress bar that fills up when it scrolls into view. */
export function Meter({ value, label, className = '' }) {
  const ref = useRef(null);
  const percent = Math.max(0, Math.min(100, Number(value) || 0));

  useGSAP(() => {
    const bar = ref.current?.firstElementChild;
    if (!bar || prefersReducedMotion()) return undefined;
    gsap.set(bar, { scaleX: 0 });
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      gsap.to(bar, { scaleX: 1, duration: 1.1, ease: 'expo.out', delay: 0.15, clearProps: 'transform' });
    }, { threshold: 0.2 });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, { scope: ref });

  return (
    <div ref={ref} className={`meter ${className}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label={label}>
      <span style={{ width: `${percent}%`, transition: 'width 500ms cubic-bezier(0.16, 1, 0.3, 1)' }} />
    </div>
  );
}

export function Notice({ tone = 'neutral', children, onClose, action, className = '', role }) {
  const ref = useRef(null);
  const icon = { ok: 'check', danger: 'alert', warn: 'alert', neutral: 'info' }[tone] || 'info';

  useGSAP(() => {
    if (prefersReducedMotion()) return;
    gsap.fromTo(ref.current, { autoAlpha: 0, y: -8 }, { autoAlpha: 1, y: 0, duration: 0.4, ease: 'power3.out', clearProps: 'transform' });
  }, { scope: ref });

  return (
    <div
      ref={ref}
      className={`notice ${className}`}
      data-tone={tone}
      role={role || (tone === 'danger' ? 'alert' : 'status')}
      aria-live={tone === 'danger' ? 'assertive' : 'polite'}
    >
      <Icon name={icon} size={19} />
      <div className="min-w-0 flex-1">{children}</div>
      {action}
      {onClose && (
        <button type="button" onClick={onClose} className="-my-1 -mr-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-ink/5 hover:text-ink" aria-label="Zamknij komunikat">
          <Icon name="x" size={16} />
        </button>
      )}
    </div>
  );
}

export function EmptyState({ icon = 'spark', title, children, action, className = '' }) {
  return (
    <div className={`empty ${className}`}>
      <span className="empty-icon"><Icon name={icon} size={26} /></span>
      <h3 className="h-card">{title}</h3>
      {children && <p className="max-w-md text-[0.9375rem] leading-relaxed text-muted">{children}</p>}
      {action && <div className="mt-4 flex flex-wrap justify-center gap-3">{action}</div>}
    </div>
  );
}

/* Branded loading state: a tournament bracket that keeps drawing itself. */
export function Loader({ label = 'Ładowanie…', className = '' }) {
  const ref = useRef(null);

  useGSAP(() => {
    if (prefersReducedMotion()) return;
    gsap.fromTo(
      'path',
      { drawSVG: '0% 0%' },
      { drawSVG: '0% 100%', duration: 0.9, ease: 'power2.inOut', stagger: 0.12, repeat: -1, repeatDelay: 0.25, yoyo: true },
    );
  }, { scope: ref });

  return (
    <div ref={ref} className={`grid place-items-center gap-4 py-20 text-center ${className}`} role="status">
      <svg width="64" height="48" viewBox="0 0 64 48" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-ink" aria-hidden="true">
        <path d="M4 6h16v12h16" />
        <path d="M4 42h16V30h16" />
        <path d="M36 18v12h24" />
      </svg>
      <p className="mono text-xs font-semibold uppercase tracking-[0.14em] text-muted">{label}</p>
    </div>
  );
}

export function FullPageLoader({ label }) {
  return <main className="page grid place-items-center"><Loader label={label} /></main>;
}

/* Page title that splits into letters and snaps in — React Bits SplitText on GSAP. */
export function Title({ children, tag = 'h1', className = 'h-page', delay = 16 }) {
  return (
    <SplitText
      text={children}
      tag={tag}
      className={className}
      textAlign="left"
      splitType="words, chars"
      effect="skew"
      trigger="load"
      delay={delay}
      duration={0.9}
    />
  );
}

export function PageHeader({ eyebrow, title, children, actions, back, className = '' }) {
  return (
    <header className={`mb-8 sm:mb-10 ${className}`}>
      {back}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          {eyebrow && <p className="eyebrow mb-4">{eyebrow}</p>}
          <Title>{title}</Title>
          {children && <div className="lede mt-4 max-w-2xl">{children}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
      </div>
    </header>
  );
}

export function SectionHeading({ eyebrow, title, count, action, className = '' }) {
  return (
    <div className={`mb-5 flex flex-wrap items-end justify-between gap-3 ${className}`}>
      <div>
        {eyebrow && <p className="eyebrow eyebrow-plain mb-1.5">{eyebrow}</p>}
        <h2 className="h-section">
          {title}
          {count !== undefined && <span className="ml-2 text-muted">{count}</span>}
        </h2>
      </div>
      {action}
    </div>
  );
}

/* Big number tile. Numeric values count up when they scroll into view. */
export function StatTile({ label, value, suffix = '', detail, icon, tone, className = '' }) {
  const numeric = typeof value === 'number' && Number.isFinite(value);
  return (
    <article className={`card card-pad relative overflow-hidden ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-muted">{label}</p>
        {icon && <Icon name={icon} size={20} className={tone === 'live' ? 'text-live' : 'text-muted'} />}
      </div>
      <p className="num mt-4 text-[3.25rem]">
        {numeric ? <CountUp to={value} duration={1.1} suffix={suffix} /> : <>{value}{suffix}</>}
      </p>
      {detail && <p className="mt-2 text-[0.8125rem] leading-snug text-muted">{detail}</p>}
    </article>
  );
}

function placeIndicator(list, indicator, animate) {
  const active = list?.querySelector('[aria-selected="true"]');
  if (!active || !indicator) return;
  const vars = { x: active.offsetLeft, width: active.offsetWidth };
  if (animate && !prefersReducedMotion()) gsap.to(indicator, { ...vars, duration: 0.55, ease: 'expo.out', overwrite: true });
  else gsap.set(indicator, vars);
}

/* Tab bar with an indicator that slides under the active tab. */
export function Tabs({ tabs, value, onChange, label, className = '', ...rest }) {
  const ref = useRef(null);
  const indicatorRef = useRef(null);
  const placed = useRef(false);

  useGSAP(() => {
    placeIndicator(ref.current, indicatorRef.current, placed.current);
    placed.current = true;
  }, { dependencies: [value, tabs.length], scope: ref });

  useEffect(() => {
    const list = ref.current;
    if (typeof ResizeObserver === 'undefined' || !list) return undefined;
    const observer = new ResizeObserver(() => placeIndicator(list, indicatorRef.current, false));
    observer.observe(list);
    return () => observer.disconnect();
  }, []);

  function onKeyDown(event) {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const index = tabs.findIndex((tab) => tab.id === value);
    const next = tabs[(index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
    onChange(next.id);
    ref.current?.querySelector(`[data-tab="${next.id}"]`)?.focus();
  }

  return (
    <div ref={ref} role="tablist" aria-label={label} className={`tabs ${className}`} onKeyDown={onKeyDown} {...rest}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          data-tab={tab.id}
          aria-selected={value === tab.id}
          tabIndex={value === tab.id ? 0 : -1}
          onClick={() => onChange(tab.id)}
          className="tab"
        >
          {tab.icon && <Icon name={tab.icon} size={18} />}
          {tab.label}
          {tab.badge ? <span className="chip !h-[22px] !px-2" data-tone={tab.badgeTone || 'neutral'}>{tab.badge}</span> : null}
        </button>
      ))}
      <span ref={indicatorRef} className="tab-indicator" aria-hidden="true" />
    </div>
  );
}

/* Swaps tab panels with a short slide so the change of context is visible. */
export function TabPanel({ id, children, className = '' }) {
  const ref = useRef(null);

  useGSAP(() => {
    if (prefersReducedMotion()) return;
    gsap.fromTo(ref.current, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.45, ease: 'power3.out', clearProps: 'transform,opacity,visibility' });
  }, { dependencies: [id], scope: ref });

  return <div ref={ref} role="tabpanel" className={className}>{children}</div>;
}

export function BackLink({ to, children }) {
  return (
    <Link to={to} className="mb-6 inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-muted transition hover:text-ink">
      <Icon name="arrow-left" size={17} />
      {children}
    </Link>
  );
}

export function Arrow({ size = 18 }) {
  return <Icon name="arrow-right" size={size} className="btn-arrow" />;
}
