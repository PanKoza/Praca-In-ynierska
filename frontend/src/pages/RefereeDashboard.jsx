import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

const FILTERS = [
  { id: 'ALL', label: 'Wszystkie' },
  { id: 'SCHEDULED', label: 'Nadchodzące' },
  { id: 'IN_PROGRESS', label: 'Na żywo' },
  { id: 'FINISHED', label: 'Zakończone' },
];

const STATUS_LABELS = {
  SCHEDULED: 'Zaplanowany',
  IN_PROGRESS: 'W trakcie',
  FINISHED: 'Zakończony',
};

const STATUS_STYLES = {
  SCHEDULED: 'border-blue-300/15 bg-blue-300/10 text-blue-200',
  IN_PROGRESS: 'border-emerald-300/15 bg-emerald-300/10 text-emerald-200',
  FINISHED: 'border-violet-300/15 bg-violet-300/10 text-violet-200',
};

function formatDate(value) {
  if (!value) return 'Termin nieustalony';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Termin nieustalony'
    : date.toLocaleString('pl-PL', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
}

function MatchCard({ match }) {
  const finished = match.status === 'FINISHED';
  const firstName = match.player1?.name || 'Oczekuje na awans';
  const secondName = match.player2?.name || 'Oczekuje na awans';

  return (
    <article className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111827]/85 transition hover:border-[#8A3FFC]/35">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-white">{match.tournament?.title || 'Wydarzenie'}</p>
          <p className="mt-1 text-xs text-slate-500">
            {formatDate(match.scheduledAt || match.tournament?.date)} · Runda {match.round}
            {match.groupKey ? ` · ${match.groupKey}` : ''}
            {match.court ? ` · ${match.court}` : ''}
          </p>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${STATUS_STYLES[match.status] || STATUS_STYLES.SCHEDULED}`}>
          {STATUS_LABELS[match.status] || match.status}
        </span>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-5 sm:px-5">
        <p className="truncate text-sm font-bold text-white sm:text-base">{firstName}</p>
        <p className="min-w-16 text-center font-mono text-lg font-black text-white">
          {finished || match.status === 'IN_PROGRESS'
            ? `${match.score1 ?? 0} : ${match.score2 ?? 0}`
            : 'VS'}
        </p>
        <p className="truncate text-right text-sm font-bold text-white sm:text-base">{secondName}</p>
        {(match.extraTimeScore1 || match.extraTimeScore2 || match.penaltyScore1 !== null || match.penaltyScore2 !== null) && (
          <p className="col-span-3 text-center text-xs text-slate-400">
            {match.extraTimeScore1 || match.extraTimeScore2
              ? `Dogrywka ${match.extraTimeScore1 || 0} : ${match.extraTimeScore2 || 0}`
              : ''}
            {match.penaltyScore1 !== null && match.penaltyScore2 !== null
              ? ` · Karne ${match.penaltyScore1} : ${match.penaltyScore2}`
              : ''}
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] bg-black/10 px-4 py-3">
        {match.winnerId
          ? <p className="text-xs font-semibold text-emerald-200">Zwycięzca: {match.winnerId === match.player1Id ? firstName : secondName}</p>
          : <p className="text-xs text-slate-500">Twoje przypisane spotkanie</p>}
        <Link
          to={`/referee/${match.id}`}
          className="inline-flex min-h-10 items-center rounded-lg bg-gradient-to-r from-[#0F62FE] to-[#8A3FFC] px-4 text-xs font-bold text-white transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          {finished ? 'Podgląd meczu' : 'Otwórz panel meczu'} →
        </Link>
      </div>
    </article>
  );
}

export default function RefereeDashboard() {
  const { user } = useAuth();
  const [matches, setMatches] = useState([]);
  const [filter, setFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadMatches = useCallback(async (showLoading = false) => {
    if (showLoading) setRefreshing(true);
    try {
      const { data } = await api.get('/matches/assigned');
      setMatches(data.matches);
      setError('');
    } catch (loadError) {
      setError(loadError.response?.data?.message || 'Nie udało się pobrać przypisanych meczów.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => { void loadMatches(); }, 0);
    return () => window.clearTimeout(timeout);
  }, [loadMatches]);

  const filteredMatches = useMemo(
    () => filter === 'ALL' ? matches : matches.filter((match) => match.status === filter),
    [filter, matches],
  );
  const liveCount = matches.filter((match) => match.status === 'IN_PROGRESS').length;
  const upcomingCount = matches.filter((match) => match.status === 'SCHEDULED').length;
  const completedCount = matches.filter((match) => match.status === 'FINISHED').length;

  return (
    <main className="referee-dashboard min-h-[calc(100vh-5rem)] bg-[#090D16] px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="relative mb-6 overflow-hidden rounded-3xl border border-[#8A3FFC]/20 bg-gradient-to-br from-[#0F62FE]/15 via-[#111827] to-[#8A3FFC]/15 p-6 sm:p-8">
          <div className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-[#8A3FFC]/15 blur-3xl" aria-hidden="true" />
          <div className="relative flex flex-wrap items-end justify-between gap-5">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-200">Panel sędziego</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Twoje mecze</h1>
              <p className="mt-2 text-sm text-slate-400">
                {user?.name}{user?.username ? ` · @${user.username}` : ''}. Tutaj znajdziesz spotkania przydzielone do Twojego konta.
              </p>
            </div>
            <button
              type="button"
              onClick={() => { void loadMatches(true); }}
              disabled={refreshing}
              className="min-h-11 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-xs font-bold text-white transition hover:bg-white/[0.08] disabled:opacity-50"
            >
              {refreshing ? 'Odświeżanie…' : '↻ Odśwież mecze'}
            </button>
          </div>
        </header>

        <section className="mb-6 grid gap-3 sm:grid-cols-3" aria-label="Podsumowanie meczów">
          {[
            ['Nadchodzące', upcomingCount, 'border-blue-300/15'],
            ['Na żywo', liveCount, 'border-emerald-300/15'],
            ['Zakończone', completedCount, 'border-violet-300/15'],
          ].map(([label, value, border]) => (
            <div key={label} className={`rounded-2xl border ${border} bg-[#111827]/75 p-4`}>
              <p className="text-xs text-slate-400">{label}</p>
              <p className="mt-1 text-2xl font-black text-white">{value}</p>
            </div>
          ))}
        </section>

        <nav aria-label="Filtruj mecze" className="mb-5 flex gap-2 overflow-x-auto">
          {FILTERS.map((item) => {
            const count = item.id === 'ALL'
              ? matches.length
              : matches.filter((match) => match.status === item.id).length;
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={filter === item.id}
                onClick={() => setFilter(item.id)}
                className={`shrink-0 rounded-xl px-4 py-2.5 text-xs font-bold transition ${filter === item.id ? 'bg-[#8A3FFC]/20 text-violet-100 ring-1 ring-[#8A3FFC]/30' : 'bg-white/[0.04] text-slate-400 hover:bg-white/[0.08] hover:text-white'}`}
              >
                {item.label} <span className="ml-1 opacity-70">{count}</span>
              </button>
            );
          })}
        </nav>

        {error && (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-300/20 bg-rose-300/[0.06] p-4 text-sm text-rose-100" role="alert">
            <span>{error}</span>
            <button type="button" onClick={() => { void loadMatches(true); }} className="font-bold underline">Spróbuj ponownie</button>
          </div>
        )}

        {loading ? (
          <div className="rounded-2xl border border-white/[0.07] bg-[#111827]/75 p-10 text-center text-sm text-slate-400" role="status">
            Ładowanie przypisanych meczów…
          </div>
        ) : filteredMatches.length ? (
          <div className="space-y-3">
            {filteredMatches.map((match) => <MatchCard key={match.id} match={match} />)}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-white/10 bg-[#111827]/40 p-10 text-center">
            <p className="text-2xl" aria-hidden="true">◉</p>
            <h2 className="mt-3 font-bold text-white">{matches.length ? 'Brak meczów w tej kategorii' : 'Nie masz jeszcze przypisanych meczów'}</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">
              {matches.length
                ? 'Wybierz inną kategorię, aby zobaczyć pozostałe mecze.'
                : 'Gdy organizator przydzieli Cię do meczu przez nazwę użytkownika, pojawi się on tutaj.'}
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
