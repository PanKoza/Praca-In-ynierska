/* One stroke-based icon set drawn on a 24px grid — replaces emoji and Unicode glyphs. */
const PATHS = {
  'arrow-right': <path d="M4 12h16m-6-6 6 6-6 6" />,
  'arrow-left': <path d="M20 12H4m6-6-6 6 6 6" />,
  'arrow-up-right': <path d="M7 17 17 7M8 7h9v9" />,
  'chevron-down': <path d="m6 9 6 6 6-6" />,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  x: <path d="m6 6 12 12M18 6 6 18" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  calendar: <><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 10h17M8 3v4m8-4v4" /></>,
  pin: <><path d="M12 21s-6.5-5.7-6.5-11a6.5 6.5 0 0 1 13 0c0 5.3-6.5 11-6.5 11Z" /><circle cx="12" cy="10" r="2.3" /></>,
  users: <><circle cx="9" cy="8.5" r="3.2" /><path d="M2.8 19.5c.5-3.3 3-5.2 6.2-5.2s5.7 1.9 6.2 5.2M15.5 5.6a3.2 3.2 0 0 1 0 5.8m2.3 3.4c1.8.7 3 2.3 3.4 4.7" /></>,
  user: <><circle cx="12" cy="8.5" r="3.5" /><path d="M5 20c.6-3.7 3.4-5.8 7-5.8s6.4 2.1 7 5.8" /></>,
  trophy: <><path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" /><path d="M8 6H4.5c0 3 1.5 4.5 3.8 4.8M16 6h3.5c0 3-1.5 4.5-3.8 4.8M12 13v4m-3.5 3h7M10 17h4" /></>,
  whistle: <><circle cx="9" cy="14" r="5" /><path d="M13.2 11.3 21 8V5.5h-9L9 9M9 12.5v3" /></>,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  refresh: <path d="M19.5 12a7.5 7.5 0 1 1-2.3-5.4M19.5 4.5v4.2h-4.2" />,
  sun: <><circle cx="12" cy="12" r="3.8" /><path d="M12 2.5v2.3m0 14.4v2.3M2.5 12h2.3m14.4 0h2.3M5.3 5.3l1.6 1.6m10.2 10.2 1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" /></>,
  moon: <path d="M20 14.2A8 8 0 0 1 9.8 4a8 8 0 1 0 10.2 10.2Z" />,
  help: <><circle cx="12" cy="12" r="8.5" /><path d="M9.6 9.5a2.5 2.5 0 1 1 3.6 2.2c-.8.4-1.2 1-1.2 1.9M12 16.7v.1" /></>,
  play: <path d="M8 5.5v13l10.5-6.5L8 5.5Z" />,
  pause: <path d="M8.5 5.5v13m7-13v13" />,
  undo: <path d="M8 6 4 10l4 4M4 10h10.5a5 5 0 0 1 0 10H11" />,
  redo: <path d="m16 6 4 4-4 4m4-4H9.5a5 5 0 0 0 0 10H13" />,
  trash: <path d="M4.5 7h15M9.5 7V4.5h5V7m-8 0 .8 12.5h9.4L17.5 7M10 11v5m4-5v5" />,
  edit: <path d="M4 20h4L19 9l-4-4L4 16v4Zm9.5-13.5 4 4" />,
  sliders: <><path d="M4 7h9m5 0h2M4 17h3m5 0h8" /><circle cx="15.5" cy="7" r="2.3" /><circle cx="9.5" cy="17" r="2.3" /></>,
  bolt: <path d="M13 3 5 13.5h6L10 21l8.5-11h-6L13 3Z" />,
  flag: <path d="M5.5 21V4m0 1h11l-2.5 4 2.5 4h-11" />,
  list: <path d="M9 7h11M9 12h11M9 17h11M4.5 7h.1m-.1 5h.1m-.1 5h.1" />,
  grid: <><rect x="4" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" /></>,
  bracket: <path d="M4 5h5v5.5h6M4 19h5v-5.5h6M15 8v8h5" />,
  copy: <><rect x="8.5" y="8.5" width="11" height="11" rx="2" /><path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5" /></>,
  link: <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />,
  eye: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="2.8" /></>,
  logout: <path d="M14 4.5h4.5v15H14M10 8l-4 4 4 4m-4-4h10" />,
  info: <><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5.5M12 7.7v.1" /></>,
  alert: <><path d="M12 4 2.8 19.5h18.4L12 4Z" /><path d="M12 10v4.5M12 17v.1" /></>,
  wifi: <path d="M3 9.5a13 13 0 0 1 18 0M6.5 13a8 8 0 0 1 11 0M9.8 16.3a3.5 3.5 0 0 1 4.4 0M12 19.5v.1" />,
  'wifi-off': <path d="m4 4 16 16M3 9.5a13 13 0 0 1 4.5-2.8m4-.9a13 13 0 0 1 9.5 3.7M6.5 13a8 8 0 0 1 3.8-2.1m4.6.5a8 8 0 0 1 2.6 1.6M9.8 16.3a3.5 3.5 0 0 1 4.4 0M12 19.5v.1" />,
  card: <rect x="7" y="3.5" width="10" height="17" rx="2" />,
  spark: <path d="M12 3v5m0 8v5M3 12h5m8 0h5M6 6l3 3m6 6 3 3M6 18l3-3m6-6 3-3" />,
  target: <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="0.8" /></>,
  save: <><path d="M5 4.5h11l3.5 3.5v11.5H4.5V5a.5.5 0 0 1 .5-.5Z" /><path d="M8 4.5v5h7v-5M8 19.5v-6h8v6" /></>,

  /* Sports */
  soccer: <><circle cx="12" cy="12" r="8.5" /><path d="m12 8 3.8 2.8-1.5 4.4H9.7l-1.5-4.4L12 8Zm0-4.5V8m3.8 2.8 4.4-1.3m-5.9 5.7 2.6 3.8M9.7 15.2l-2.6 3.8M8.2 10.8 3.8 9.5" /></>,
  volleyball: <><circle cx="12" cy="12" r="8.5" /><path d="M12 12c0-3.5 1.5-6.5 4.5-8M12 12c3 1.8 6.3 1.7 8.5-.5M12 12c-3 1.8-4.7 4.6-4.2 7.8M5 7.5c3-.5 6.5 1 8.5 3.5M19 16.5c-2 2-5.5 2.5-8.5 1.5M7 4.7c1.2 2.8 1 6.3-.8 9" /></>,
  basketball: <><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5v17M5.8 6.2c2.3 1.8 3.4 3.6 3.4 5.8s-1.1 4-3.4 5.8M18.2 6.2c-2.3 1.8-3.4 3.6-3.4 5.8s1.1 4 3.4 5.8" /></>,
  tennis: <><circle cx="12" cy="12" r="8.5" /><path d="M5.8 6.2c2.6 1.6 4 3.5 4 5.8s-1.4 4.2-4 5.8M18.2 6.2c-2.6 1.6-4 3.5-4 5.8s1.4 4.2 4 5.8" /></>,
  esports: <><path d="M7 8h10a4.5 4.5 0 0 1 4.5 4.5v1A3.5 3.5 0 0 1 18 17c-1.5 0-2.2-.8-3-2H9c-.8 1.2-1.5 2-3 2a3.5 3.5 0 0 1-3.5-3.5v-1A4.5 4.5 0 0 1 7 8Z" /><path d="M7.5 11v3M6 12.5h3M15.5 11.5v.1m2.5 2v.1" /></>,
};

export default function Icon({ name, size = 20, strokeWidth = 1.75, className = '', title, ...rest }) {
  const path = PATHS[name];
  if (!path) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
      {...rest}
    >
      {path}
    </svg>
  );
}
