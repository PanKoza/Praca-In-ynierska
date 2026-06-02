import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ROLE_LABEL = { ADMIN: 'Admin', ORGANIZER: 'Organizator', PLAYER: 'Zawodnik' };

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/');
  }

  const linkClass = ({ isActive }) =>
    `text-sm font-medium transition-colors ${
      isActive ? 'text-indigo-400' : 'text-slate-300 hover:text-white'
    }`;

  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 font-bold text-white text-lg">
          <span className="text-2xl">🏆</span>
          <span>TourneyApp</span>
        </Link>

        {/* Nav links */}
        <nav className="hidden md:flex items-center gap-6">
          <NavLink to="/tournaments" className={linkClass}>
            Turnieje
          </NavLink>
          {user?.role === 'ORGANIZER' || user?.role === 'ADMIN' ? (
            <NavLink to="/tournaments/create" className={linkClass}>
              + Nowy turniej
            </NavLink>
          ) : null}
        </nav>

        {/* Auth area */}
        <div className="flex items-center gap-3">
          {user ? (
            <>
              <span className="hidden sm:block text-sm text-slate-400">
                {user.name}
                <span className="ml-1 text-xs bg-indigo-600 text-white px-1.5 py-0.5 rounded">
                  {ROLE_LABEL[user.role]}
                </span>
              </span>
              <button
                onClick={handleLogout}
                className="text-sm text-slate-300 hover:text-white transition-colors"
              >
                Wyloguj
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="text-sm text-slate-300 hover:text-white transition-colors"
              >
                Logowanie
              </Link>
              <Link
                to="/register"
                className="text-sm bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded-lg transition-colors"
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
