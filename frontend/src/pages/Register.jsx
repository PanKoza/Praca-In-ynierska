import { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const autoJoinTournamentId = location.state?.autoJoinTournamentId;
  const returnTo = location.state?.from || '/tournaments';

  const [form, setForm] = useState(() => ({
    name: '',
    username: '',
    email: '',
    password: '',
    role: autoJoinTournamentId
      ? 'PLAYER'
      : ['PLAYER', 'ORGANIZER', 'REFEREE'].includes(searchParams.get('role')) ? searchParams.get('role') : 'PLAYER',
  }));
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (form.password.length < 6) {
      setError('Hasło musi mieć co najmniej 6 znaków.');
      return;
    }
    setLoading(true);
    try {
      await register(form.name, form.username, form.email, form.password, form.role);
      navigate(autoJoinTournamentId ? returnTo : form.role === 'ORGANIZER' ? '/tournaments/create' : '/tournaments', {
        replace: true,
        state: autoJoinTournamentId ? { autoJoinTournamentId } : undefined,
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Błąd rejestracji. Spróbuj ponownie.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page min-h-[calc(100vh-4rem)] bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8">
          <h1 className="text-2xl font-bold text-white mb-1">Utwórz konto</h1>
          <p className="text-slate-400 text-sm mb-6">
            Masz już konto?{' '}
            <Link to="/login" state={location.state} className="text-indigo-400 hover:text-indigo-300">
              Zaloguj się
            </Link>
          </p>

          {error && (
            <div className="bg-red-900/40 border border-red-700 text-red-300 text-sm rounded-lg px-4 py-3 mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Imię i nazwisko</label>
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                required
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Jan Kowalski"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Nazwa użytkownika</label>
              <input
                type="text"
                name="username"
                value={form.username}
                onChange={handleChange}
                required
                minLength={3}
                maxLength={24}
                pattern="[A-Za-z0-9_]{3,24}"
                autoComplete="username"
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="np. jan_kowalski"
              />
              <p className="mt-1 text-xs text-slate-500">3–24 znaki: litery, cyfry i podkreślenia. Organizatorzy użyją tej nazwy do przydzielenia Ci meczu.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Email</label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                required
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="jan@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Hasło</label>
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                required
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="min. 6 znaków"
              />
            </div>
            {autoJoinTournamentId ? (
              <p className="text-sm text-slate-400">Tworzone konto będzie kontem zawodnika, aby zapisać Cię na wydarzenie.</p>
            ) : (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Rola</label>
                <select
                  name="role"
                  value={form.role}
                  onChange={handleChange}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="PLAYER">Zawodnik</option>
                  <option value="ORGANIZER">Organizator</option>
                  <option value="REFEREE">Sędzia</option>
                </select>
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors"
            >
              {loading ? 'Rejestracja...' : 'Zarejestruj się'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
