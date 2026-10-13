import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

const MATCH_FILTERS = [
  { id: 'ALL', label: 'Wszystkie mecze' },
  { id: 'SCHEDULED', label: 'Nadchodzące' },
  { id: 'IN_PROGRESS', label: 'Na żywo' },
  { id: 'FINISHED', label: 'Zakończone' },
];

const MATCH_STATUS = {
  SCHEDULED: 'Zaplanowany',
  IN_PROGRESS: 'Na żywo',
  FINISHED: 'Zakończony',
};

const TOURNAMENT_STATUS = {
  DRAFT: 'Szkic',
  OPEN: 'Zapisy otwarte',
  PUBLISHED: 'Opublikowany',
  IN_PROGRESS: 'W trakcie',
  FINISHED: 'Zakończony',
  CANCELLED: 'Anulowany',
};

const MATCH_STATUS_STYLE = {
  SCHEDULED: 'border-blue-300/15 bg-blue-300/10 text-blue-200',
  IN_PROGRESS: 'border-emerald-300/15 bg-emerald-300/10 text-emerald-200',
  FINISHED: 'border-violet-300/15 bg-violet-300/10 text-violet-200',
};

const SPORT_LABELS = {
  BEACH_VOLLEYBALL: 'Siatkówka plażowa',
  FOOTBALL_6V6: 'Piłka nożna 6v6',
  SOCCER: 'Piłka nożna',
  BASKETBALL: 'Koszykówka',
  VOLLEYBALL: 'Siatkówka',
  TENNIS: 'Tenis',
  ESPORTS: 'E-sport',
  CUSTOM: 'Własna dyscyplina',
  OTHER: 'Inna dyscyplina',
};

function dateLabel(value, options = {}) {
  if (!value) return 'Termin nieustalony';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Termin nieustalony'
    : date.toLocaleString('pl-PL', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      ...options,
    });
}

function MetricCard({ label, value, detail, accent }) {
  return (
    <article className={`relative overflow-hidden rounded-2xl border ${accent} bg-[#111827]/85 p-4 sm:p-5`}>
      <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-current opacity-[0.06] blur-2xl" aria-hidden="true" />
      <p className="text-xs font-semibold text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-black tabular-nums text-white">{value}</p>
      <p className="mt-1 text-[11px] text-slate-500">{detail}</p>
    </article>
  );
}

function MatchCard({ match, userId }) {
  const mySide = match.player1Id === userId ? 1 : 2;
  const opponent = mySide === 1 ? match.player2 : match.player1;
  const myScore = mySide === 1 ? match.score1 : match.score2;
  const opponentScore = mySide === 1 ? match.score2 : match.score1;

  return (
    <article className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111827]/80 transition hover:border-[#0F62FE]/35">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
        <div className="min-w-0">
          <Link to={`/tournaments/${match.tournament.id}`} className="truncate text-sm font-bold text-white hover:text-[#81C7FF]">
            {match.tournament.title}
          </Link>
          <p className="mt-1 text-xs text-slate-500">
            {dateLabel(match.scheduledAt || match.tournament.date)} · Runda {match.round}
            {match.groupKey ? ` · ${match.groupKey}` : ''}
            {match.court ? ` · ${match.court}` : ''}
          </p>
        </div>
        <span className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[10px] font-bold ${MATCH_STATUS_STYLE[match.status] || MATCH_STATUS_STYLE.SCHEDULED}`}>
          {match.status === 'IN_PROGRESS' && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" aria-hidden="true" />}
          {MATCH_STATUS[match.status] || match.status}
        </span>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-5 sm:px-5">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#81C7FF]">Ty</p>
          <p className="mt-1 truncate text-sm font-bold text-white sm:text-base">{mySide === 1 ? match.player1?.name : match.player2?.name}</p>
        </div>
        <p className="min-w-16 text-center font-mono text-lg font-black text-white">
          {match.status === 'SCHEDULED' ? 'VS' : `${myScore ?? 0} : ${opponentScore ?? 0}`}
        </p>
        <div className="min-w-0 text-right">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Przeciwnik</p>
          <p className="mt-1 truncate text-sm font-bold text-slate-200 sm:text-base">{opponent?.name || 'Oczekiwanie na awans'}</p>
        </div>
      </div>
      {match.winnerId && (
        <p className="border-t border-white/[0.06] px-4 py-2 text-xs font-semibold text-emerald-200">
          {match.winnerId === userId ? 'Wygrana' : 'Zwycięzca'}: {match.winnerId === match.player1Id ? match.player1?.name : match.player2?.name}
        </p>
      )}
      <div className="flex justify-end border-t border-white/[0.06] bg-black/10 px-4 py-3">
        <Link
          to={`/tournaments/${match.tournament.id}/matches/${match.id}/live`}
          className="inline-flex min-h-10 items-center rounded-lg bg-gradient-to-r from-[#0F62FE] to-[#8A3FFC] px-4 text-xs font-bold text-white transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          Śledź mecz →
        </Link>
      </div>
    </article>
  );
}

function TournamentCard({ tournament, matches }) {
  const liveCount = matches.filter((match) => match.status === 'IN_PROGRESS').length;
  const nextMatch = matches.find((match) => match.status === 'SCHEDULED');

  return (
    <article className="group rounded-2xl border border-white/[0.08] bg-[#111827]/80 p-4 transition duration-200 hover:-translate-y-0.5 hover:border-[#8A3FFC]/35 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#81C7FF]">{SPORT_LABELS[tournament.sportType] || tournament.sportType}</p>
          <h3 className="mt-2 truncate text-lg font-bold text-white">{tournament.title}</h3>
        </div>
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold text-slate-300">
          {TOURNAMENT_STATUS[tournament.status] || tournament.status}
        </span>
      </div>
      <p className="mt-3 flex items-center gap-2 text-xs text-slate-400">
        <span aria-hidden="true">◷</span>{dateLabel(tournament.date)}
      </p>
      {tournament.location && <p className="mt-1.5 truncate text-xs text-slate-500">⌖ {tournament.location}</p>}
      <div className="mt-4 flex flex-wrap gap-2 text-[11px]">
        <span className="rounded-lg bg-white/[0.04] px-2.5 py-1.5 text-slate-300">
          {tournament._count.participants}/{tournament.maxParticipants} uczestników
        </span>
        <span className={`rounded-lg px-2.5 py-1.5 ${liveCount ? 'bg-emerald-300/10 text-emerald-200' : 'bg-white/[0.04] text-slate-400'}`}>
          {liveCount ? `${liveCount} ${liveCount === 1 ? 'mecz na żywo' : 'mecze na żywo'}` : `${matches.length} ${matches.length === 1 ? 'mecz' : 'meczów'}`}
        </span>
      </div>
      {nextMatch && (
        <p className="mt-3 truncate text-xs text-slate-400">
          Następny mecz · Runda {nextMatch.round}{nextMatch.groupKey ? ` · ${nextMatch.groupKey}` : ''}
        </p>
      )}
      <Link
        to={`/tournaments/${tournament.id}`}
        className="mt-5 inline-flex min-h-10 w-full items-center justify-center rounded-xl border border-white/10 px-4 text-xs font-bold text-slate-200 transition group-hover:border-[#8A3FFC]/30 group-hover:bg-white/[0.03] hover:text-white"
      >
        Otwórz wydarzenie →
      </Link>
    </article>
  );
}

export default function PlayerDashboard() {
  const { user } = useAuth();
  const [tournaments, setTournaments] = useState([]);
  const [matches, setMatches] = useState([]);
  const [filter, setFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);

  const loadDashboard = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    try {
      const { data } = await api.get('/tournaments/player/dashboard');
      setTournaments(data.tournaments);
      setMatches(data.matches);
      setError('');
    } catch (loadError) {
      setError(loadError.response?.data?.message || 'Nie udało się pobrać Twoich wydarzeń.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => { void loadDashboard(); }, 0);
    return () => window.clearTimeout(timeout);
  }, [loadDashboard]);

  const tournamentIds = useMemo(() => tournaments.map(({ id }) => id).join(','), [tournaments]);
  useEffect(() => {
    if (!tournamentIds) {
      const timeout = window.setTimeout(() => setConnected(false), 0);
      return () => window.clearTimeout(timeout);
    }

    const sources = tournamentIds.split(',').map((id) => {
      const source = new EventSource(`${api.defaults.baseURL}/tournaments/${id}/live-events`);
      source.addEventListener('connected', () => setConnected(true));
      source.addEventListener('match-updated', () => { void loadDashboard(); });
      source.onerror = () => setConnected(false);
      return source;
    });

    return () => sources.forEach((source) => source.close());
  }, [loadDashboard, tournamentIds]);

  const filteredMatches = useMemo(
    () => (filter === 'ALL' ? matches : matches.filter((match) => match.status === filter)),
    [filter, matches],
  );
  const liveCount = matches.filter((match) => match.status === 'IN_PROGRESS').length;
  const upcomingCount = matches.filter((match) => match.status === 'SCHEDULED').length;
  const finishedCount = matches.filter((match) => match.status === 'FINISHED').length;
  const nextMatch = [...matches]
    .filter((match) => ['SCHEDULED', 'IN_PROGRESS'].includes(match.status))
    .sort((first, second) => {
      const firstIsLive = first.status === 'IN_PROGRESS';
      const secondIsLive = second.status === 'IN_PROGRESS';
      if (firstIsLive !== secondIsLive) return firstIsLive ? -1 : 1;
      return new Date(first.scheduledAt || first.tournament.date) - new Date(second.scheduledAt || second.tournament.date);
    })[0];
  const matchesByTournament = useMemo(() => {
    const grouped = new Map();
    matches.forEach((match) => {
      if (!grouped.has(match.tournamentId)) grouped.set(match.tournamentId, []);
      grouped.get(match.tournamentId).push(match);
    });
    return grouped;
  }, [matches]);

  return (
    <main className="player-dashboard min-h-[calc(100vh-5rem)] bg-[#090D16] px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="relative mb-6 overflow-hidden rounded-3xl border border-[#0F62FE]/20 bg-gradient-to-br from-[#0F62FE]/15 via-[#111827] to-[#8A3FFC]/15 p-6 sm:p-8">
          <div className="pointer-events-none absolute -right-12 -top-16 h-56 w-56 rounded-full bg-[#8A3FFC]/15 blur-3xl" aria-hidden="true" />
          <div className="relative flex flex-wrap items-end justify-between gap-5">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#81C7FF]">Panel zawodnika</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Co przed Tobą?</h1>
              <p className="mt-2 max-w-xl text-sm text-slate-400">
                Cześć{user?.name ? `, ${user.name}` : ''}! Tutaj znajdziesz swoje zapisy, najbliższy mecz i aktualne wyniki.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {tournaments.length > 0 && (
                <span className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-[10px] font-bold ${connected ? 'bg-emerald-300/10 text-emerald-200' : 'bg-white/[0.05] text-slate-400'}`}>
                  <span className={`h-2 w-2 rounded-full ${connected ? 'animate-pulse bg-emerald-300' : 'bg-slate-500'}`} aria-hidden="true" />
                  {connected ? 'Wyniki aktualizowane na żywo' : 'Łączenie z wynikami'}
                </span>
              )}
              <button
                type="button"
                onClick={() => { void loadDashboard(true); }}
                disabled={refreshing}
                className="min-h-11 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-xs font-bold text-white transition hover:bg-white/[0.08] disabled:opacity-50"
              >
                {refreshing ? 'Odświeżanie…' : '↻ Odśwież'}
              </button>
            </div>
          </div>
        </header>

        {error && (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-300/20 bg-rose-300/[0.06] px-4 py-3 text-sm text-rose-100" role="alert">
            <span>{error}</span>
            <button type="button" onClick={() => { void loadDashboard(true); }} className="font-bold underline underline-offset-4">Spróbuj ponownie</button>
          </div>
        )}

        {loading ? (
          <div className="grid min-h-72 place-items-center text-sm text-slate-400" role="status">Ładowanie Twojego panelu…</div>
        ) : (
          <>
            {nextMatch && (
              <section className="player-next-match mb-8" aria-labelledby="next-match-heading">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#81C7FF]">
                    {nextMatch.status === 'IN_PROGRESS' ? 'Mecz trwa' : 'Najbliższy mecz'}
                  </p>
                  <h2 id="next-match-heading" className="mt-2 text-2xl font-bold tracking-tight text-white">
                    {nextMatch.tournament.title}
                  </h2>
                  <p className="mt-2 text-sm text-slate-300">
                    {dateLabel(nextMatch.scheduledAt || nextMatch.tournament.date)}
                    {nextMatch.tournament.location ? ` · ${nextMatch.tournament.location}` : ''}
                    {nextMatch.court ? ` · ${nextMatch.court}` : ''}
                  </p>
                  <p className="mt-2 text-sm text-slate-400">
                    Przeciwnik: {nextMatch.player1Id === user.id
                      ? nextMatch.player2?.name || 'Oczekiwanie na awans'
                      : nextMatch.player1?.name || 'Oczekiwanie na awans'}
                  </p>
                </div>
                <Link to={`/tournaments/${nextMatch.tournament.id}`} className="primary-action">
                  Zobacz drabinkę <span aria-hidden="true">→</span>
                </Link>
              </section>
            )}
            <section className="mb-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Podsumowanie">
              <MetricCard label="Moje wydarzenia" value={tournaments.length} detail="Wszystkie Twoje zgłoszenia" accent="border-blue-300/15 text-blue-300" />
              <MetricCard label="Nadchodzące mecze" value={upcomingCount} detail="Mecze z harmonogramu" accent="border-cyan-300/15 text-cyan-300" />
              <MetricCard label="Mecze na żywo" value={liveCount} detail="Trwające teraz spotkania" accent="border-emerald-300/15 text-emerald-300" />
              <MetricCard label="Zakończone mecze" value={finishedCount} detail="Sprawdź dotychczasowe wyniki" accent="border-violet-300/15 text-violet-300" />
            </section>

            <section className="mb-9">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Twoje zgłoszenia</p>
                  <h2 className="mt-1 text-xl font-bold">Wydarzenia <span className="text-slate-500">({tournaments.length})</span></h2>
                </div>
                <Link to="/tournaments" className="text-xs font-semibold text-[#81C7FF] transition hover:text-white">Znajdź wydarzenie →</Link>
              </div>
              {tournaments.length ? (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {tournaments.map((tournament) => (
                    <TournamentCard key={tournament.id} tournament={tournament} matches={matchesByTournament.get(tournament.id) || []} />
                  ))}
                </div>
              ) : (
                <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-12 text-center">
                  <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-[#0F62FE]/20 to-[#8A3FFC]/20 text-2xl" aria-hidden="true">✦</div>
                  <h3 className="mt-4 text-lg font-bold">Nie masz jeszcze zgłoszeń</h3>
                  <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">Przejrzyj dostępne wydarzenia i dołącz do turnieju, aby śledzić tutaj swoje mecze.</p>
                  <Link to="/tournaments" className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-gradient-to-r from-[#0F62FE] to-[#8A3FFC] px-5 text-sm font-bold text-white transition hover:brightness-110">
                    Przeglądaj wydarzenia
                  </Link>
                </div>
              )}
            </section>

            <section>
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Twój terminarz</p>
                  <h2 className="mt-1 text-xl font-bold">Mecze <span className="text-slate-500">({matches.length})</span></h2>
                </div>
              </div>
              <nav aria-label="Filtruj mecze" className="mb-4 flex gap-2 overflow-x-auto pb-1">
                {MATCH_FILTERS.map((item) => {
                  const count = item.id === 'ALL' ? matches.length : matches.filter((match) => match.status === item.id).length;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={filter === item.id}
                      onClick={() => setFilter(item.id)}
                      className={`min-h-10 shrink-0 rounded-xl border px-3 text-xs font-semibold transition ${filter === item.id ? 'border-[#0F62FE]/50 bg-[#0F62FE]/15 text-white' : 'border-white/[0.07] bg-[#111827]/60 text-slate-400 hover:bg-white/[0.05] hover:text-white'}`}
                    >
                      {item.label} <span className="ml-1 opacity-70">{count}</span>
                    </button>
                  );
                })}
              </nav>
              {filteredMatches.length ? (
                <div className="grid gap-3 lg:grid-cols-2">
                  {filteredMatches.map((match) => <MatchCard key={match.id} match={match} userId={user.id} />)}
                </div>
              ) : matches.length ? (
                <div className="rounded-2xl border border-dashed border-white/10 p-9 text-center text-sm text-slate-400">
                  Brak meczów w wybranej kategorii.
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 p-9 text-center">
                  <p className="font-semibold text-slate-300">Harmonogram nie jest jeszcze dostępny</p>
                  <p className="mt-2 text-sm text-slate-500">Gdy organizator przypisze Cię do meczu, spotkanie i wynik pojawią się tutaj.</p>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
