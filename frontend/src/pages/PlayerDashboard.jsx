import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { TOURNAMENT_STATUS, formatDate, formatDateTime, formatTime, plural } from '../lib/labels';
import { scrollToTarget } from '../lib/motion';
import Icon from '../components/Icon';
import Reveal from '../components/Reveal';
import { useTour } from '../components/Tour';
import { EventPass, Panel, PanelStats, PassAdd, PassRail } from '../components/Dashboard';
import { Arrow, EmptyState, LiveChip, Meter, Notice, PageHeader } from '../components/ui';

const MATCH_FILTERS = [
  { id: 'ALL', label: 'Wszystkie' },
  { id: 'SCHEDULED', label: 'Nadchodzące' },
  { id: 'IN_PROGRESS', label: 'Na żywo' },
  { id: 'FINISHED', label: 'Zakończone' },
];

const TOUR = [
  { target: '[data-tour="player-next"]', title: 'Najważniejsze na górze', body: 'Tu zawsze widzisz swój najbliższy mecz: kiedy, gdzie i z kim grasz, oraz swój bilans. Gdy mecz trwa, obejrzysz go stąd na żywo.' },
  { target: '[data-tour="player-events"]', title: 'Twoje karnety', body: 'Każda karta to wydarzenie, na które jesteś zapisany. Przewiń je w bok i kliknij, aby zobaczyć drabinkę i tabelę.' },
  { target: '[data-tour="player-stats"]', title: 'Szybkie podsumowanie', body: 'Twoje mecze w liczbach — nadchodzące, trwające, zakończone i wygrane.' },
  { target: '[data-tour="player-matches"]', title: 'Terminarz meczów', body: 'Filtruj mecze jednym kliknięciem i przechodź do wyniku na żywo.' },
];

function sideOf(match, userId) {
  const mySide = match.player1Id === userId ? 1 : 2;
  return {
    me: mySide === 1 ? match.player1 : match.player2,
    opponent: mySide === 1 ? match.player2 : match.player1,
    myScore: mySide === 1 ? match.score1 : match.score2,
    opponentScore: mySide === 1 ? match.score2 : match.score1,
  };
}

/* One match from the player's point of view, as a list row. */
function MatchRow({ match, userId }) {
  const { opponent, myScore, opponentScore } = sideOf(match, userId);
  const live = match.status === 'IN_PROGRESS';
  const finished = match.status === 'FINISHED';
  const won = match.winnerId === userId;
  const when = match.scheduledAt || match.tournament.date;

  return (
    <div className="row">
      <span className="row-tile" data-tone={live ? 'live' : won ? 'accent' : undefined}>
        <Icon name={live ? 'bolt' : won ? 'trophy' : finished ? 'check' : 'clock'} size={19} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="row-title"><span className="font-normal text-muted">vs</span> {opponent?.name || 'Oczekiwanie na awans'}</p>
        <p className="row-meta">
          <Link to={`/tournaments/${match.tournament.id}`} className="hover:text-ink hover:underline">{match.tournament.title}</Link>
          {' · '}Runda {match.round}{match.groupKey ? ` · ${match.groupKey}` : ''}{match.court ? ` · ${match.court}` : ''}
        </p>
      </div>
      <div className="row-end hidden sm:block">
        {match.status === 'SCHEDULED'
          ? <p className="text-sm font-semibold text-ink">{formatTime(when)}</p>
          : <p className={`num text-2xl ${live ? '!text-live' : ''}`}>{myScore ?? 0}:{opponentScore ?? 0}</p>}
        <p className="text-xs text-muted">
          {live ? 'trwa' : finished ? (match.winnerId ? (won ? 'wygrana' : 'porażka') : 'koniec') : formatDate(when, { day: 'numeric', month: 'short' }, 'bez terminu')}
        </p>
      </div>
      <Link
        to={`/tournaments/${match.tournament.id}/matches/${match.id}/live`}
        className="row-btn"
        data-tone={live ? 'live' : 'ghost'}
        aria-label={`${live ? 'Oglądaj na żywo' : 'Śledź mecz'}: vs ${opponent?.name || 'przeciwnik'}`}
      >
        {live ? 'Oglądaj' : 'Śledź'}
      </Link>
    </div>
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

  useTour('player', TOUR, { auto: true, ready: !loading && tournaments.length > 0 });

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
  const wins = matches.filter((match) => match.status === 'FINISHED' && match.winnerId === user.id).length;
  const losses = matches.filter((match) => match.status === 'FINISHED' && match.winnerId && match.winnerId !== user.id).length;
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
  const nextIsLive = nextMatch?.status === 'IN_PROGRESS';
  const total = matches.length || 1;
  const summary = [
    { id: 'SCHEDULED', icon: 'calendar', label: 'Nadchodzące', meta: 'Mecze z harmonogramu', value: upcomingCount, percent: (upcomingCount / total) * 100 },
    { id: 'IN_PROGRESS', icon: 'bolt', tone: liveCount ? 'live' : undefined, label: 'Na żywo', meta: 'Trwające teraz', value: liveCount, percent: (liveCount / total) * 100 },
    { id: 'FINISHED', icon: 'check', label: 'Zakończone', meta: 'Dotychczasowe wyniki', value: finishedCount, percent: (finishedCount / total) * 100 },
    { id: 'WINS', icon: 'trophy', tone: 'accent', label: 'Wygrane', meta: finishedCount ? `${Math.round((wins / finishedCount) * 100)}% skuteczności` : 'Jeszcze bez wyników', value: wins, percent: finishedCount ? (wins / finishedCount) * 100 : 0 },
  ];

  function showMatches(nextFilter) {
    setFilter(nextFilter);
    scrollToTarget('#terminarz');
  }

  return (
    <main className="page">
      <div className="shell">
        <PageHeader
          eyebrow="Panel zawodnika"
          title="Co przed Tobą?"
          actions={(
            <>
              {tournaments.length > 0 && (
                <span className="soft-chip" title={connected ? 'Wyniki aktualizują się same' : 'Łączenie z wynikami na żywo'}>
                  <Icon name={connected ? 'wifi' : 'wifi-off'} size={14} className={connected ? 'text-ok' : 'text-muted'} />
                  {connected ? 'Na żywo' : 'Łączenie…'}
                </span>
              )}
              <button type="button" onClick={() => { void loadDashboard(true); }} disabled={refreshing} className="icon-btn rounded-full" aria-label={refreshing ? 'Odświeżanie' : 'Odśwież'} title="Odśwież">
                <Icon name="refresh" size={18} className={refreshing ? 'spin' : ''} />
              </button>
              <Link to="/tournaments" className="btn btn-solid rounded-full"><Icon name="search" size={17} /> Znajdź turniej</Link>
            </>
          )}
        >
          Cześć{user?.name ? `, ${user.name}` : ''}! Twoje zapisy, najbliższy mecz i wyniki — w jednym miejscu.
        </PageHeader>

        {error && (
          <Notice
            tone="danger"
            className="mb-6"
            action={<button type="button" onClick={() => { void loadDashboard(true); }} className="btn btn-ghost btn-sm shrink-0">Spróbuj ponownie</button>}
          >
            {error}
          </Notice>
        )}

        {loading ? (
          <div className="bento lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]" aria-label="Ładowanie Twojego panelu" role="status">
            {[0, 1, 2, 3].map((item) => <div key={item} className="skeleton h-72 !rounded-[24px]" />)}
          </div>
        ) : tournaments.length === 0 ? (
          <Reveal>
            <EmptyState
              icon="search"
              title="Zacznij od zapisu na wydarzenie"
              action={<Link to="/tournaments" className="btn btn-primary btn-lg">Przeglądaj wydarzenia <Arrow /></Link>}
            >
              Nie masz jeszcze żadnych zgłoszeń. Wybierz turniej, kliknij „Zapisz się”, a Twoje mecze i wyniki pojawią się tutaj automatycznie.
            </EmptyState>
          </Reveal>
        ) : (
          <div className="bento">
            <Reveal stagger={0.1} className="bento lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
              <Panel
                icon={nextIsLive ? 'bolt' : 'calendar'}
                title={nextMatch ? (nextIsLive ? 'Mecz trwa' : 'Najbliższy mecz') : 'Najbliższy mecz'}
                subtitle={nextMatch ? nextMatch.tournament.title : 'Harmonogram w przygotowaniu'}
                action={nextMatch && (nextIsLive ? <LiveChip /> : <span className="soft-chip">Runda {nextMatch.round}</span>)}
                className={nextIsLive ? '!border-live' : ''}
                data-tour="player-next"
              >
                <div className="panel-body flex flex-1 flex-col">
                  <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-5">
                    <div className="min-w-0 flex-1">
                      {nextMatch ? (
                        <>
                          <p className="text-sm font-semibold text-muted">Twój przeciwnik</p>
                          <h2 className="display mt-1 break-words text-[clamp(2.4rem,5.4vw,4rem)]">
                            {sideOf(nextMatch, user.id).opponent?.name || 'Oczekiwanie na awans'}
                          </h2>
                          <ul className="mt-4 grid gap-1.5 text-[0.9375rem] text-body">
                            <li className="flex items-center gap-2"><Icon name="calendar" size={17} className="shrink-0 text-muted" />{formatDateTime(nextMatch.scheduledAt || nextMatch.tournament.date)}</li>
                            {(nextMatch.tournament.location || nextMatch.court) && (
                              <li className="flex items-center gap-2">
                                <Icon name="pin" size={17} className="shrink-0 text-muted" />
                                {[nextMatch.tournament.location, nextMatch.court].filter(Boolean).join(' · ')}
                              </li>
                            )}
                          </ul>
                        </>
                      ) : (
                        <p className="max-w-md text-[0.9375rem] text-body">
                          Jesteś zapisany, ale harmonogram jeszcze nie powstał. Gdy organizator przypisze Cię do meczu, pojawi się on właśnie tutaj.
                        </p>
                      )}
                    </div>
                    <div className="rounded-2xl bg-sunk px-5 py-4 text-center">
                      <p className="text-xs font-semibold text-muted">Bilans</p>
                      <p className="num mt-1 text-5xl" aria-label={`${wins} ${plural(wins, 'wygrana', 'wygrane', 'wygranych')}, ${losses} ${plural(losses, 'porażka', 'porażki', 'porażek')}`}>
                        {wins}<span className="text-muted">–</span>{losses}
                      </p>
                      <p className="mono mt-1 text-[0.6875rem] uppercase tracking-[0.1em] text-muted">W – P</p>
                    </div>
                  </div>
                  <div className="panel-actions mt-auto pt-7">
                    {nextMatch && nextIsLive && (
                      <Link to={`/tournaments/${nextMatch.tournament.id}/matches/${nextMatch.id}/live`} className="btn btn-primary">
                        <Icon name="play" size={16} /> Oglądaj na żywo
                      </Link>
                    )}
                    {nextMatch ? (
                      <Link to={`/tournaments/${nextMatch.tournament.id}`} className={`btn ${nextIsLive ? 'btn-ghost' : 'btn-solid'}`}>
                        <Icon name="bracket" size={17} /> Zobacz drabinkę
                      </Link>
                    ) : (
                      <Link to="/tournaments" className="btn btn-solid"><Icon name="search" size={17} /> Przeglądaj wydarzenia</Link>
                    )}
                    <button type="button" onClick={() => showMatches('ALL')} className="btn btn-ghost"><Icon name="list" size={17} /> Terminarz</button>
                  </div>
                </div>
              </Panel>

              <Panel
                icon="trophy"
                title="Moje karnety"
                subtitle="Wydarzenia, na które jesteś zapisany"
                action={<Link to="/tournaments" className="soft-chip">Znajdź kolejne <Icon name="arrow-right" size={14} /></Link>}
                data-tour="player-events"
              >
                <div className="pt-4">
                  <PassRail label="Twoje wydarzenia">
                    {tournaments.map((tournament, index) => {
                      const tournamentMatches = matchesByTournament.get(tournament.id) || [];
                      const live = tournamentMatches.some((match) => match.status === 'IN_PROGRESS');
                      return (
                        <div key={tournament.id} role="listitem" className="flex">
                          <EventPass
                            to={`/tournaments/${tournament.id}`}
                            label={`Otwórz wydarzenie ${tournament.title}`}
                            index={index}
                            sport={tournament.sportType}
                            title={tournament.title}
                            live={live}
                            tag={live ? 'Na żywo' : TOURNAMENT_STATUS[tournament.status]?.label || tournament.status}
                            date={tournament.date}
                            facts={[
                              ['Moje mecze', tournamentMatches.length],
                              ['Miejsce', tournament.location || 'Do ustalenia'],
                            ]}
                          />
                        </div>
                      );
                    })}
                    <div role="listitem" className="flex">
                      <PassAdd to="/tournaments">Zapisz się na kolejne</PassAdd>
                    </div>
                  </PassRail>
                </div>
                <PanelStats
                  items={[
                    ['Wydarzenia', tournaments.length],
                    ['Nadchodzące mecze', upcomingCount],
                    ['Na żywo', liveCount, liveCount ? 'live' : undefined],
                  ]}
                />
              </Panel>
            </Reveal>

            <Reveal stagger={0.1} className="bento lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
              <Panel icon="grid" title="Podsumowanie" subtitle="Twoje mecze w liczbach" data-tour="player-stats">
                <div className="panel-body">
                  <div className="rows">
                    {summary.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => showMatches(item.id === 'WINS' ? 'FINISHED' : item.id)}
                        className="row"
                      >
                        <span className="row-tile" data-tone={item.tone}><Icon name={item.icon} size={19} /></span>
                        <span className="min-w-0 flex-1">
                          <span className="row-title block">{item.label}</span>
                          <span className="row-meta block">{item.meta}</span>
                        </span>
                        <Meter value={item.percent} label={`${item.label}: ${item.value}`} className="hidden w-20 sm:block md:w-28" />
                        <span className="num row-end w-10 text-2xl">{item.value}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </Panel>

              <Panel
                id="terminarz"
                icon="list"
                title="Terminarz"
                subtitle={`${matches.length} ${plural(matches.length, 'mecz', 'mecze', 'meczów')} we wszystkich wydarzeniach`}
                data-tour="player-matches"
              >
                <div className="panel-body">
                  <div role="group" aria-label="Filtruj mecze" className="-mx-1 mb-2 flex gap-2 overflow-x-auto px-1 pb-1">
                    {MATCH_FILTERS.map((item) => {
                      const count = item.id === 'ALL' ? matches.length : matches.filter((match) => match.status === item.id).length;
                      return (
                        <button key={item.id} type="button" aria-pressed={filter === item.id} onClick={() => setFilter(item.id)} className="pill">
                          {item.label} <span className="pill-count">{count}</span>
                        </button>
                      );
                    })}
                  </div>
                  {filteredMatches.length ? (
                    <Reveal key={filter} stagger={0.05} y={12} className="rows">
                      {filteredMatches.map((match) => <MatchRow key={match.id} match={match} userId={user.id} />)}
                    </Reveal>
                  ) : matches.length ? (
                    <p className="well mt-3 p-6 text-center text-sm text-muted">Brak meczów w wybranej kategorii.</p>
                  ) : (
                    <div className="well mt-3 p-6 text-center">
                      <p className="font-semibold text-ink">Harmonogram nie jest jeszcze dostępny</p>
                      <p className="mt-2 text-sm text-muted">Gdy organizator przypisze Cię do meczu, spotkanie i wynik pojawią się tutaj.</p>
                    </div>
                  )}
                </div>
              </Panel>
            </Reveal>
          </div>
        )}
      </div>
    </main>
  );
}
