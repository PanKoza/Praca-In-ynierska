import { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthLayout from '../components/AuthLayout';
import Icon from '../components/Icon';
import { Arrow, Notice } from '../components/ui';

const ROLES = [
  { value: 'PLAYER', icon: 'user', label: 'Zawodnik', description: 'Zapisuję się na turnieje i śledzę swoje mecze.', next: 'Po rejestracji pokażemy Ci listę wydarzeń.' },
  { value: 'ORGANIZER', icon: 'bracket', label: 'Organizator', description: 'Tworzę wydarzenia, harmonogram i przydzielam sędziów.', next: 'Po rejestracji otworzymy kreator wydarzenia.' },
  { value: 'REFEREE', icon: 'whistle', label: 'Sędzia', description: 'Prowadzę wynik meczu na żywo z telefonu.', next: 'Po rejestracji podaj organizatorowi swoją nazwę użytkownika.' },
];

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
      navigate(autoJoinTournamentId ? returnTo : form.role === 'ORGANIZER' ? '/tournaments/create' : form.role === 'REFEREE' ? '/referee' : '/tournaments', {
        replace: true,
        state: autoJoinTournamentId ? { autoJoinTournamentId } : undefined,
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Błąd rejestracji. Spróbuj ponownie.');
    } finally {
      setLoading(false);
    }
  }

  const activeRole = ROLES.find((role) => role.value === form.role);
  const passwordOk = form.password.length >= 6;

  return (
    <AuthLayout
      eyebrow="Rejestracja"
      title="Dołącz do gry"
      lead={(
        <>
          Masz już konto?{' '}
          <Link to="/login" state={location.state} className="link">Zaloguj się</Link>
        </>
      )}
      posterTitle={<>Jedno konto.<br />Cały turniej.</>}
      posterPoints={['Rejestracja zajmuje mniej niż minutę', 'Rolę wybierasz jednym kliknięciem', 'Od razu prowadzimy Cię do następnego kroku']}
    >
      {error && <Notice tone="danger" className="mb-5">{error}</Notice>}

      <form onSubmit={handleSubmit} className="grid gap-5">
        {autoJoinTournamentId ? (
          <Notice className="auth-rise">Zakładasz konto zawodnika — zaraz po rejestracji zapiszemy Cię na wybrane wydarzenie.</Notice>
        ) : (
          <fieldset className="auth-rise">
            <legend className="label">1. Kim jesteś?</legend>
            <div className="grid gap-2.5">
              {ROLES.map((role) => (
                <label key={role.value} className="choice">
                  <input className="sr-only" type="radio" name="role" value={role.value} checked={form.role === role.value} onChange={handleChange} />
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] border border-line-2 bg-bg text-ink"><Icon name={role.icon} size={20} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-xl font-bold uppercase leading-none tracking-[0.02em] text-ink">{role.label}</span>
                    <span className="mt-1 block text-[0.8125rem] leading-snug text-muted">{role.description}</span>
                  </span>
                  <span className="choice-mark"><Icon name="check" size={14} strokeWidth={3} /></span>
                </label>
              ))}
            </div>
            <p className="hint" aria-live="polite">{activeRole?.next}</p>
          </fieldset>
        )}

        <fieldset className="grid gap-5">
          <legend className="label auth-rise">{autoJoinTournamentId ? 'Twoje dane' : '2. Twoje dane'}</legend>
          <div className="auth-rise">
            <label className="label" htmlFor="register-name">Imię i nazwisko</label>
            <input id="register-name" type="text" name="name" value={form.name} onChange={handleChange} required autoComplete="name" className="input" placeholder="Jan Kowalski" />
          </div>
          <div className="auth-rise">
            <label className="label" htmlFor="register-username">Nazwa użytkownika</label>
            <input
              id="register-username"
              type="text"
              name="username"
              value={form.username}
              onChange={handleChange}
              required
              minLength={3}
              maxLength={24}
              pattern="[A-Za-z0-9_]{3,24}"
              autoComplete="username"
              aria-describedby="register-username-hint"
              className="input"
              placeholder="np. jan_kowalski"
            />
            <p id="register-username-hint" className="hint">3–24 znaki: litery, cyfry i podkreślenia. Organizatorzy użyją tej nazwy do przydzielenia Ci meczu.</p>
          </div>
          <div className="auth-rise">
            <label className="label" htmlFor="register-email">Adres e-mail</label>
            <input id="register-email" type="email" name="email" value={form.email} onChange={handleChange} required autoComplete="email" className="input" placeholder="jan@example.com" />
          </div>
          <div className="auth-rise">
            <label className="label" htmlFor="register-password">Hasło</label>
            <input
              id="register-password"
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              required
              autoComplete="new-password"
              aria-describedby="register-password-hint"
              className="input"
              placeholder="min. 6 znaków"
            />
            <p id="register-password-hint" className={`hint flex items-center gap-1.5 ${passwordOk ? '!text-ok' : ''}`}>
              <Icon name={passwordOk ? 'check' : 'info'} size={14} />
              {passwordOk ? 'Hasło ma odpowiednią długość.' : 'Co najmniej 6 znaków.'}
            </p>
          </div>
        </fieldset>

        <button type="submit" disabled={loading} className="btn btn-primary btn-lg btn-block auth-rise">
          {loading ? 'Rejestracja…' : 'Załóż konto'} {!loading && <Arrow />}
        </button>
      </form>
    </AuthLayout>
  );
}
