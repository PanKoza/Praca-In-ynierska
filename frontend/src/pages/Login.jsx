import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthLayout from '../components/AuthLayout';
import { Arrow, Notice } from '../components/ui';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/tournaments';

  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate(from, {
        replace: true,
        state: location.state?.autoJoinTournamentId
          ? { autoJoinTournamentId: location.state.autoJoinTournamentId }
          : undefined,
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Błąd logowania. Spróbuj ponownie.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      eyebrow="Logowanie"
      title="Wracasz do gry"
      lead={(
        <>
          Nie masz konta?{' '}
          <Link to="/register" state={location.state} className="link">Załóż je w minutę</Link>
        </>
      )}
      posterTitle={<>Twoje mecze<br />czekają.</>}
      posterPoints={['Najbliższy mecz zawsze na górze panelu', 'Wyniki aktualizowane na żywo', 'Wszystkie zapisy w jednym miejscu']}
    >
      {location.state?.autoJoinTournamentId && (
        <Notice className="mb-5">Po zalogowaniu od razu zapiszemy Cię na wybrane wydarzenie.</Notice>
      )}
      {error && <Notice tone="danger" className="mb-5">{error}</Notice>}

      <form onSubmit={handleSubmit} className="grid gap-5">
        <div className="auth-rise">
          <label className="label" htmlFor="login-email">Adres e-mail</label>
          <input
            id="login-email"
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            required
            autoComplete="email"
            autoFocus
            className="input"
            placeholder="jan@example.com"
          />
        </div>
        <div className="auth-rise">
          <label className="label" htmlFor="login-password">Hasło</label>
          <input
            id="login-password"
            type="password"
            name="password"
            value={form.password}
            onChange={handleChange}
            required
            autoComplete="current-password"
            className="input"
            placeholder="••••••••"
          />
        </div>
        <button type="submit" disabled={loading} className="btn btn-primary btn-lg btn-block auth-rise">
          {loading ? 'Logowanie…' : 'Zaloguj się'} {!loading && <Arrow />}
        </button>
      </form>
    </AuthLayout>
  );
}
