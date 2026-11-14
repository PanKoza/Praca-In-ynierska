import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROLE_HOME } from '../lib/labels';
import { BrandMark } from './Navbar';

export default function Footer() {
  const { user } = useAuth();
  return (
    <footer className="border-t border-line bg-bg">
      <div className="shell py-12">
        <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <BrandMark size={40} />
              <p className="display text-[clamp(2.4rem,7vw,4.5rem)]">TourniDesk</p>
            </div>
            <p className="mt-3 max-w-sm text-sm text-muted">Turnieje, zapisy i wyniki na żywo — w jednym miejscu.</p>
          </div>
          <nav className="flex flex-wrap gap-x-7 gap-y-2 text-sm font-semibold" aria-label="Stopka">
            <Link to="/tournaments" className="nav-link">Wydarzenia</Link>
            <Link to="/#how" className="nav-link">Jak to działa</Link>
            <Link to="/#organize" className="nav-link">Dla organizatorów</Link>
            {user
              ? <Link to={ROLE_HOME[user.role]} className="nav-link">Mój panel</Link>
              : <Link to="/login" className="nav-link">Logowanie</Link>}
          </nav>
        </div>
      </div>
    </footer>
  );
}
