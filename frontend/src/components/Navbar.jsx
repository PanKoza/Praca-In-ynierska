import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ROLE_LABEL = { ADMIN: 'Admin', ORGANIZER: 'Organizator', PLAYER: 'Zawodnik', REFEREE: 'Sędzia' };

function BrandMark() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="TourniDesk logo" className="h-8 w-8">
      <path d="M4 22C4 15.3726 9.37258 10 16 10C21.0895 10 25.3555 12.8073 27.0953 17.0927C26.1421 12.9899 22.434 10 18 10C12.4772 10 8 14.4772 8 20V24H4V22Z" fill="url(#paint0_linear_10_2)" fillOpacity="0.95"/>
      <path d="M11.5 24.5C14.5 19.5 20 17 25.5 18.5L28 19.5V26.5H11.5V24.5Z" fill="url(#paint1_linear_10_2)" fillOpacity="0.9"/>
      <defs>
        <linearGradient id="paint0_linear_10_2" x1="4" y1="10" x2="27" y2="24" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0F62FE"/>
          <stop offset="1" stopColor="#8A3FFC"/>
        </linearGradient>
        <linearGradient id="paint1_linear_10_2" x1="11.5" y1="17" x2="28" y2="26.5" gradientUnits="userSpaceOnUse">
          <stop stopColor="#39B4FE"/>
          <stop offset="1" stopColor="#8A3FFC"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

export default function Navbar({ theme, setTheme }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  function handleLogout() {
    logout();
    navigate('/');
  }

  function toggleTheme() {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'));
  }

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--app-border)] bg-[var(--app-bg)]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-3 group">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-2xl shadow-[0_12px_35px_rgba(138,63,252,0.35)] transition-transform group-hover:scale-[1.02]"
            style={{ background: 'linear-gradient(135deg, #0F62FE 0%, #8A3FFC 100%)' }}
          >
            <BrandMark />
          </div>
          <div className="leading-none">
            <div className="flex items-center gap-1 text-xl font-black tracking-[-0.05em] text-[var(--app-text-strong)]">
              <span>Tourni</span>
              <span className="mono-text text-lg font-medium text-[var(--tourni-light-blue)]">Desk</span>
            </div>
          </div>
        </Link>

        {!user && (
          <Link to="/tournaments" className="text-xs font-semibold text-[var(--app-text-muted)] transition hover:text-[var(--app-text-strong)] md:hidden">
            Turnieje
          </Link>
        )}

        <nav className="hidden items-center gap-6 text-sm font-semibold md:flex" aria-label="Nawigacja główna">
          <Link to="/#events" className="text-[var(--app-text-muted)] transition hover:text-[var(--app-text-strong)]">Wydarzenia</Link>
          <Link to="/#organize" className="text-[var(--app-text-muted)] transition hover:text-[var(--app-text-strong)]">Dla organizatorów</Link>
          <Link to="/tournaments" className="text-[var(--app-text-muted)] transition hover:text-[var(--app-text-strong)]">
            Odkrywaj
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Przełącz motyw"
            onClick={toggleTheme}
            className="hidden h-10 w-10 items-center justify-center rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text-strong)] transition hover:border-[var(--tourni-violet)] sm:flex"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>

          {user ? (
            <>
              {(user.role === 'ORGANIZER' || user.role === 'ADMIN') && (
                <Link
                  to="/organizer"
                  className="inline-flex rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 py-2 text-xs font-medium text-[var(--app-text-strong)] transition hover:border-[var(--tourni-violet)] sm:px-3 sm:text-sm"
                >
                  Panel organizatora
                </Link>
              )}
              {user.role === 'PLAYER' && (
                <Link
                  to="/player"
                  className="inline-flex whitespace-nowrap rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 py-2 text-xs font-medium text-[var(--app-text-strong)] transition hover:border-[var(--tourni-violet)] sm:px-3 sm:text-sm"
                >
                  Panel zawodnika
                </Link>
              )}
              {user.role === 'REFEREE' && (
                <Link
                  to="/referee"
                  className="inline-flex whitespace-nowrap rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 py-2 text-xs font-medium text-[var(--app-text-strong)] transition hover:border-[var(--tourni-violet)] sm:px-3 sm:text-sm"
                >
                  Panel sędziego
                </Link>
              )}
              <span className="hidden text-sm text-[var(--app-text-muted)] sm:block">
                {user.name}
                <span className="ml-1 text-xs text-[var(--app-text-muted)]">@{user.username}</span>
                <span className="ml-2 rounded-full bg-[rgba(15,98,254,0.12)] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--tourni-blue)]">
                  {ROLE_LABEL[user.role]}
                </span>
              </span>
              <button
                onClick={handleLogout}
                className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-2 text-sm font-medium text-[var(--app-text-strong)] transition hover:border-[var(--tourni-violet)] hover:text-[var(--app-text-strong)]"
              >
                Wyloguj
              </button>
            </>
          ) : (
            <>
              <Link to="/login" state={{ from: location }} className="text-sm font-medium text-[var(--app-text-muted)] transition hover:text-[var(--app-text-strong)]">
                Logowanie
              </Link>
              <Link
                to="/register"
                className="hidden rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-[0_16px_40px_rgba(138,63,252,0.35)] transition hover:brightness-110 sm:inline-flex"
                style={{ background: 'linear-gradient(135deg, #0F62FE 0%, #8A3FFC 100%)' }}
              >
                Rejestracja
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
