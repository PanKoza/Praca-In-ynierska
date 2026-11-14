import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { gsap, lockScroll, prefersReducedMotion, useGSAP } from '../lib/motion';
import { ROLE_HOME, ROLE_LABELS } from '../lib/labels';
import Icon from './Icon';
import { useTourControls } from './Tour';
import { Avatar } from './ui';

const PANEL_LABEL = {
  ADMIN: 'Panel organizatora',
  ORGANIZER: 'Panel organizatora',
  PLAYER: 'Panel zawodnika',
  REFEREE: 'Panel sędziego',
};

const LINKS = [
  { to: '/tournaments', label: 'Wydarzenia', match: (location) => location.pathname.startsWith('/tournaments') },
  { to: '/#how', label: 'Jak to działa', match: (location) => location.pathname === '/' && location.hash === '#how' },
  { to: '/#organize', label: 'Dla organizatorów', match: (location) => location.pathname === '/' && location.hash === '#organize' },
];

export function BrandMark({ size = 36 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" aria-hidden="true" focusable="false">
      <rect x="1" y="1" width="34" height="34" rx="9" fill="var(--accent)" stroke="var(--accent-edge)" strokeWidth="1.5" />
      <path d="M9 11h7v7h8M9 25h7v-7M24 13v10h4" fill="none" stroke="var(--accent-ink)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="font-display text-[1.55rem] font-extrabold uppercase leading-none tracking-[0.01em] text-ink">
      Tourni<span className="text-muted">Desk</span>
    </span>
  );
}

export default function Navbar({ theme, onToggleTheme }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { available: tour, startAvailable, running } = useTourControls();
  const headerRef = useRef(null);
  const menuRef = useRef(null);
  const mobileRef = useRef(null);
  /* Menus remember the navigation entry they were opened on, so any route change closes them. */
  const [menuKey, setMenuKey] = useState(null);
  const [mobileKey, setMobileKey] = useState(null);
  const menuOpen = menuKey === location.key;
  const mobileOpen = mobileKey === location.key;

  useEffect(() => {
    const header = headerRef.current;
    const onScroll = () => { header.dataset.scrolled = String(window.scrollY > 8); };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onPointerDown = (event) => {
      if (!menuRef.current?.contains(event.target)) setMenuKey(null);
    };
    const onKeyDown = (event) => { if (event.key === 'Escape') setMenuKey(null); };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!mobileOpen) return undefined;
    const unlock = lockScroll();
    const onKeyDown = (event) => { if (event.key === 'Escape') setMobileKey(null); };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      unlock();
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [mobileOpen]);

  useGSAP(() => {
    if (!menuOpen || prefersReducedMotion()) return;
    gsap.fromTo('.menu-pop', { autoAlpha: 0, y: -8, scale: 0.97 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.28, ease: 'expo.out', transformOrigin: 'top right' });
  }, { dependencies: [menuOpen], scope: menuRef });

  useGSAP(() => {
    if (!mobileOpen || prefersReducedMotion()) return;
    gsap.fromTo(mobileRef.current, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2 });
    gsap.fromTo('.mobile-rise', { autoAlpha: 0, y: 26 }, { autoAlpha: 1, y: 0, duration: 0.6, ease: 'expo.out', stagger: 0.055 });
  }, { dependencies: [mobileOpen], scope: mobileRef });

  function handleLogout() {
    logout();
    navigate('/');
  }

  const panelPath = user ? ROLE_HOME[user.role] : null;

  return (
    <>
      <header ref={headerRef} className="nav" data-scrolled="false">
        <div className="shell flex h-full items-center justify-between gap-4">
          <Link to="/" className="group flex items-center gap-2.5" aria-label="TourniDesk — strona główna">
            <span className="transition-transform duration-300 ease-out group-hover:-rotate-6 group-hover:scale-105"><BrandMark /></span>
            <Wordmark />
          </Link>

          <nav className="hidden items-center gap-7 md:flex" aria-label="Nawigacja główna">
            {LINKS.map((link) => (
              <Link key={link.to} to={link.to} className="nav-link" aria-current={link.match(location) ? 'page' : undefined}>
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {tour && !running && (
              <button type="button" onClick={startAvailable} className="btn btn-quiet btn-sm hidden sm:inline-flex" title="Pokaż, jak korzystać z tej strony">
                <Icon name="help" size={18} />
                Przewodnik
              </button>
            )}
            <button
              type="button"
              onClick={onToggleTheme}
              className="icon-btn"
              aria-label={theme === 'dark' ? 'Włącz jasny motyw' : 'Włącz ciemny motyw'}
              title={theme === 'dark' ? 'Jasny motyw' : 'Ciemny motyw'}
            >
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={19} />
            </button>

            {user ? (
              <>
                <Link to={panelPath} className="btn btn-primary btn-sm hidden sm:inline-flex" data-tour="nav-panel">
                  {PANEL_LABEL[user.role]}
                </Link>
                <div ref={menuRef} className="relative hidden md:block">
                  <button
                    type="button"
                    onClick={() => setMenuKey(menuOpen ? null : location.key)}
                    className="flex h-11 items-center gap-2 rounded-[10px] border-[1.5px] border-line pl-1 pr-2 transition hover:border-ink"
                    aria-haspopup="menu"
                    aria-expanded={menuOpen}
                    aria-label={`Konto: ${user.name}`}
                  >
                    <Avatar name={user.name} className="!h-8 !w-8 !rounded-[7px]" />
                    <Icon name="chevron-down" size={16} className={`text-muted transition-transform duration-300 ${menuOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {menuOpen && (
                    <div className="menu-pop" role="menu">
                      <div className="border-b border-line px-3 pb-3 pt-2">
                        <p className="truncate font-semibold text-ink">{user.name}</p>
                        <p className="mono mt-0.5 truncate text-xs text-muted">@{user.username} · {ROLE_LABELS[user.role]}</p>
                      </div>
                      <div className="pt-1.5">
                        <Link to={panelPath} className="menu-item" role="menuitem"><Icon name="grid" size={18} />{PANEL_LABEL[user.role]}</Link>
                        <Link to="/tournaments" className="menu-item" role="menuitem"><Icon name="search" size={18} />Przeglądaj wydarzenia</Link>
                        <button type="button" onClick={handleLogout} className="menu-item" role="menuitem"><Icon name="logout" size={18} />Wyloguj się</button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link to="/login" state={{ from: location }} className="btn btn-quiet btn-sm hidden sm:inline-flex">Zaloguj</Link>
                <Link to="/register" className="btn btn-primary btn-sm hidden sm:inline-flex">Załóż konto</Link>
              </>
            )}

            <button
              type="button"
              className="icon-btn md:hidden"
              onClick={() => setMobileKey(mobileOpen ? null : location.key)}
              aria-expanded={mobileOpen}
              aria-controls="mobile-menu"
              aria-label={mobileOpen ? 'Zamknij menu' : 'Otwórz menu'}
            >
              <Icon name={mobileOpen ? 'x' : 'menu'} size={21} />
            </button>
          </div>
        </div>
      </header>

      {mobileOpen && (
        <div ref={mobileRef} id="mobile-menu" className="mobile-menu md:hidden" data-lenis-prevent>
          <nav aria-label="Menu mobilne">
            {user && (
              <Link to={panelPath} className="mobile-link mobile-rise">
                {PANEL_LABEL[user.role]} <Icon name="arrow-right" size={26} />
              </Link>
            )}
            {LINKS.map((link) => (
              <Link key={link.to} to={link.to} className="mobile-link mobile-rise" onClick={() => setMobileKey(null)}>
                {link.label} <Icon name="arrow-right" size={26} />
              </Link>
            ))}
          </nav>
          <div className="mobile-rise mt-8 grid gap-3">
            {tour && (
              <button type="button" className="btn btn-ghost" onClick={() => { setMobileKey(null); startAvailable(); }}>
                <Icon name="help" size={18} /> Pokaż przewodnik po tej stronie
              </button>
            )}
            {user ? (
              <>
                <p className="mt-2 text-sm text-muted">
                  Zalogowano jako <strong className="text-ink">{user.name}</strong> · {ROLE_LABELS[user.role]}
                </p>
                <button type="button" className="btn btn-ghost" onClick={handleLogout}><Icon name="logout" size={18} /> Wyloguj się</button>
              </>
            ) : (
              <>
                <Link to="/register" className="btn btn-primary btn-lg">Załóż konto</Link>
                <Link to="/login" state={{ from: location }} className="btn btn-ghost">Mam już konto — zaloguj</Link>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
