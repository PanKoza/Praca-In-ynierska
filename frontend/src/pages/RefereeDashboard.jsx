import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { formatDateTime } from '../lib/labels';
import Icon from '../components/Icon';
import Reveal from '../components/Reveal';
import { useTour } from '../components/Tour';
import { Arrow, EmptyState, Loader, Notice, PageHeader, StatTile, StatusChip } from '../components/ui';

const FILTERS = [
  { id: 'ALL', label: 'Wszystkie' },
  { id: 'SCHEDULED', label: 'Nadchodzące' },
  { id: 'IN_PROGRESS', label: 'Na żywo' },
  { id: 'FINISHED', label: 'Zakończone' },
];

const TOUR = [
  { target: '[data-tour="ref-stats"]', title: 'Twoje mecze w liczbach', body: 'Ile spotkań przed Tobą, ile trwa i ile już zamkniętych.' },
  { target: '[data-tour="ref-list"]', title: 'Otwórz panel meczu', body: 'Każda karta to jedno przydzielone spotkanie. Przycisk „Otwórz panel meczu” prowadzi do ekranu z wynikiem, zegarem i kartkami.' },
];

function MatchCard({ match }) {
  const finished = match.status === 'FINISHED';
  const live = match.status === 'IN_PROGRESS';
  const firstName = match.player1?.name || 'Oczekuje na awans';
  const secondName = match.player2?.name || 'Oczekuje na awans';

  return (
    <article className={`card overflow-hidden ${live ? '!border-live/50' : ''}`}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3.5 sm:px-5">
        <div className="min-w-0">
          <p className="truncate font-semibold text-ink">{match.tournament?.title || 'Wydarzenie'}</p>
          <p className="mono mt-1 text-xs text-muted">
            {formatDateTime(match.scheduledAt || match.tournament?.date, { year: undefined })} · Runda {match.round}
            {match.groupKey ? ` · ${match.groupKey}` : ''}
            {match.court ? ` · ${match.court}` : ''}
          </p>
        </div>
        <StatusChip status={match.status} kind="match" />
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-5 sm:px-5">
        <p className="min-w-0 break-words font-display text-xl font-bold uppercase leading-tight text-ink sm:text-2xl">{firstName}</p>
        <p className="num min-w-[4.5rem] text-center text-4xl">
          {finished || live
            ? `${match.score1 ?? 0}:${match.score2 ?? 0}`
            : <span className="text-2xl text-muted">VS</span>}
        </p>
        <p className="min-w-0 break-words text-right font-display text-xl font-bold uppercase leading-tight text-ink sm:text-2xl">{secondName}</p>
        {(match.extraTimeScore1 || match.extraTimeScore2 || match.penaltyScore1 !== null || match.penaltyScore2 !== null) && (
          <p className="mono col-span-3 text-center text-xs text-muted">
            {match.extraTimeScore1 || match.extraTimeScore2
              ? `Dogrywka ${match.extraTimeScore1 || 0} : ${match.extraTimeScore2 || 0}`
              : ''}
            {match.penaltyScore1 !== null && match.penaltyScore2 !== null
              ? ` · Karne ${match.penaltyScore1} : ${match.penaltyScore2}`
              : ''}
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 sm:px-5">
        {match.winnerId
          ? <p className="flex items-center gap-2 text-sm font-semibold text-ink"><Icon name="trophy" size={16} />Zwycięzca: {match.winnerId === match.player1Id ? firstName : secondName}</p>
          : <p className="text-sm text-muted">{live ? 'Mecz trwa — wróć do panelu.' : 'Twoje przypisane spotkanie'}</p>}
        <Link to={`/referee/${match.id}`} className={`btn btn-sm ${finished ? 'btn-ghost' : 'btn-primary'}`}>
          {finished ? 'Podgląd meczu' : 'Otwórz panel meczu'} <Arrow size={16} />
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

  useTour('referee', TOUR, { auto: true, ready: !loading && matches.length > 0 });

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
    <main className="page">
      <div className="shell">
        <PageHeader
          eyebrow="Panel sędziego"
          title="Twoje mecze"
          actions={(
            <button type="button" onClick={() => { void loadMatches(true); }} disabled={refreshing} className="btn btn-ghost btn-sm">
              <Icon name="refresh" size={16} className={refreshing ? 'spin' : ''} />
              {refreshing ? 'Odświeżanie…' : 'Odśwież mecze'}
            </button>
          )}
        >
          {user?.name}{user?.username ? <> · <span className="mono text-ink">@{user.username}</span></> : ''}. Tutaj znajdziesz spotkania przydzielone do Twojego konta.
        </PageHeader>

        {error && (
          <Notice
            tone="danger"
            className="mb-6"
            action={<button type="button" onClick={() => { void loadMatches(true); }} className="btn btn-ghost btn-sm shrink-0">Spróbuj ponownie</button>}
          >
            {error}
          </Notice>
        )}

        {loading ? (
          <Loader label="Ładowanie przypisanych meczów…" />
        ) : matches.length === 0 ? (
          <Reveal>
            <EmptyState icon="whistle" title="Nie masz jeszcze przypisanych meczów">
              Podaj organizatorowi swoją nazwę użytkownika{user?.username ? <> — <strong className="mono text-ink">@{user.username}</strong></> : ''}. Gdy przydzieli Cię do meczu, spotkanie pojawi się tutaj.
            </EmptyState>
            <ol className="steps mt-6 md:grid-cols-3">
              {[
                ['Przekaż nazwę użytkownika', 'Organizator wpisuje ją przy meczu w swoim panelu.'],
                ['Otwórz przydzielony mecz', 'Zobaczysz go na tej liście razem z terminem i boiskiem.'],
                ['Prowadź wynik na żywo', 'Start, punkty, kartki i zakończenie — wszystko dużymi przyciskami.'],
              ].map(([title, body], index) => (
                <li key={title} className="step" data-state={index === 0 ? 'current' : 'todo'}>
                  <span className="step-index">{index + 1}</span>
                  <span>
                    <span className="block font-semibold text-ink">{title}</span>
                    <span className="mt-0.5 block text-sm text-muted">{body}</span>
                  </span>
                </li>
              ))}
            </ol>
          </Reveal>
        ) : (
          <>
            <Reveal as="section" stagger={0.07} className="mb-8 grid grid-cols-3 gap-3" aria-label="Podsumowanie meczów" data-tour="ref-stats">
              <StatTile label="Nadchodzące" value={upcomingCount} icon="calendar" />
              <StatTile label="Na żywo" value={liveCount} icon="bolt" tone={liveCount ? 'live' : undefined} />
              <StatTile label="Zakończone" value={completedCount} icon="check" />
            </Reveal>

            <div role="group" aria-label="Filtruj mecze" className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
              {FILTERS.map((item) => {
                const count = item.id === 'ALL'
                  ? matches.length
                  : matches.filter((match) => match.status === item.id).length;
                return (
                  <button key={item.id} type="button" aria-pressed={filter === item.id} onClick={() => setFilter(item.id)} className="pill">
                    {item.label} <span className="pill-count">{count}</span>
                  </button>
                );
              })}
            </div>

            <div data-tour="ref-list">
              {filteredMatches.length ? (
                <Reveal key={filter} stagger={0.06} className="grid gap-4 lg:grid-cols-2">
                  {filteredMatches.map((match) => <MatchCard key={match.id} match={match} />)}
                </Reveal>
              ) : (
                <p className="well p-6 text-center text-sm text-muted">Brak meczów w tej kategorii. Wybierz inną, aby zobaczyć pozostałe spotkania.</p>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
