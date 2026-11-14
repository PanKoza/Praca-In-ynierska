import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { FORMAT_LABELS, SPORT_LABELS, TOURNAMENT_STATUS_LABELS, capacity, formatDate, formatTime, plural, sportIcon } from '../lib/labels';
import Icon from '../components/Icon';
import { useConfirm } from '../components/Modal';
import Reveal from '../components/Reveal';
import { useTour } from '../components/Tour';
import { EventPass, Panel, PanelStats, PassAdd, PassRail, StackBar } from '../components/Dashboard';
import CountUp from '../components/reactbits/CountUp';
import { Arrow, Avatar, EmptyState, Meter, Notice, PageHeader, SportBadge, StatusChip, TabPanel, Tabs } from '../components/ui';

const STATUS_LABELS = TOURNAMENT_STATUS_LABELS;

const DEFAULT_STATS = {
  tournaments: 0,
  participants: 0,
  matches: 0,
  liveMatches: 0,
  completedMatches: 0,
  statuses: {},
};

const TOUR = [
  { target: '[data-tour="org-new"]', title: 'Tu zaczyna się każde wydarzenie', body: 'Kreator w czterech krokach zapyta o termin, format i zasady. Szkic zapisuje się sam, więc możesz przerwać w dowolnym momencie.' },
  { target: '[data-tour="org-next"]', title: 'Podpowiadamy następny krok', body: 'Ten baner zawsze mówi, co warto zrobić teraz — np. wygenerować harmonogram albo zajrzeć do meczów na żywo.' },
  { target: '[data-tour="org-tabs"]', title: 'Cztery widoki panelu', body: 'Przegląd, lista wydarzeń, mecze na żywo i zgłoszenia uczestników. Przełączasz je jednym kliknięciem.' },
  { target: '[data-tour="org-stats"]', title: 'Stan na teraz', body: 'Liczba zgłoszeń i postęp meczów ze wszystkich Twoich wydarzeń. Odświeżają się automatycznie co minutę.' },
  { target: '[data-tour="org-passes"]', title: 'Twoje wydarzenia jak karty w portfelu', body: 'Każda karta to jedno wydarzenie. Przewiń je w bok i kliknij, aby przejść do zarządzania.' },
];

function dateLabel(value, options = { day: 'numeric', month: 'short', year: 'numeric' }) {
  return formatDate(value, options, 'Data nieustalona');
}

function statusOptions(status) {
  if (status === 'DRAFT') return [];
  if (status === 'OPEN' || status === 'PUBLISHED') {
    return ['OPEN', 'PUBLISHED', 'IN_PROGRESS', 'CANCELLED'];
  }
  if (status === 'IN_PROGRESS') return ['IN_PROGRESS', 'FINISHED', 'CANCELLED'];
  return [status];
}

/* Works out the single most useful thing the organizer can do right now. */
function nextStep(tournaments, liveMatches) {
  const active = tournaments.filter((tournament) => !['FINISHED', 'CANCELLED'].includes(tournament.status));
  if (liveMatches.length) {
    return {
      icon: 'bolt',
      title: `${liveMatches.length} ${plural(liveMatches.length, 'mecz trwa', 'mecze trwają', 'meczów trwa')} właśnie teraz`,
      body: 'Zajrzyj do meczów na żywo, aby śledzić wyniki wprowadzane przez sędziów.',
      tab: 'live',
      label: 'Pokaż mecze na żywo',
    };
  }
  const needsSchedule = active.find((tournament) => tournament.participants.length >= 2 && tournament.matches.length === 0);
  if (needsSchedule) {
    return {
      icon: 'bracket',
      title: `Wygeneruj harmonogram: ${needsSchedule.title}`,
      body: `Masz już ${needsSchedule.participants.length} zgłoszeń. Jedno kliknięcie utworzy wszystkie mecze.`,
      to: `/organizer/events/${needsSchedule.id}`,
      state: { tab: 'matches' },
      label: 'Przejdź do harmonogramu',
    };
  }
  const needsReferee = active.find((tournament) => tournament.matches.some((match) => match.status === 'SCHEDULED' && !match.assignedRefereeId && !match.refereeTokenHash && match.player1Id && match.player2Id));
  if (needsReferee) {
    return {
      icon: 'whistle',
      title: `Przydziel sędziów: ${needsReferee.title}`,
      body: 'Część zaplanowanych meczów nie ma jeszcze sędziego. Wystarczy wpisać jego nazwę użytkownika.',
      to: `/organizer/events/${needsReferee.id}`,
      state: { tab: 'matches' },
      label: 'Przydziel sędziów',
    };
  }
  const waiting = active.find((tournament) => tournament.participants.length < 2);
  if (waiting) {
    return {
      icon: 'users',
      title: `Zbierz zgłoszenia: ${waiting.title}`,
      body: 'Do utworzenia harmonogramu potrzebujesz co najmniej dwóch uczestników. Udostępnij im stronę wydarzenia.',
      to: `/tournaments/${waiting.id}`,
      label: 'Otwórz stronę wydarzenia',
    };
  }
  return null;
}

function TournamentCard({ tournament, onStatusChange, onDelete, saving, deleting }) {
  const [nextStatus, setNextStatus] = useState(tournament.status);
  const seats = capacity(tournament.participants.length, tournament.maxParticipants);
  const options = statusOptions(tournament.status);
  const live = tournament.matches.filter((match) => match.status === 'IN_PROGRESS').length;
  const finished = tournament.matches.filter((match) => match.status === 'FINISHED').length;

  return (
    <article className="panel overflow-hidden">
      <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[1fr_auto] lg:items-start">
        <div className="flex min-w-0 gap-4">
          <SportBadge sport={tournament.sportType} className="!h-14 !w-14" size={26} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <h3 className="h-card break-words">{tournament.title}</h3>
              <StatusChip status={tournament.status} />
            </div>
            <p className="mt-2 text-sm text-muted">
              {SPORT_LABELS[tournament.sportType] || tournament.sportType}
              {tournament.format && ` · ${FORMAT_LABELS[tournament.format] || tournament.format}`}
              {tournament.location && ` · ${tournament.location}`}
            </p>
            <p className="mono mt-2 text-xs text-muted">
              {dateLabel(tournament.date)}{tournament.endDate && ` — ${dateLabel(tournament.endDate)}`}
              {tournament.organizer?.name && ` · Organizator: ${tournament.organizer.name}`}
            </p>
          </div>
        </div>
        <Link to={`/organizer/events/${tournament.id}`} className="btn btn-solid rounded-full">
          Zarządzaj <Arrow />
        </Link>
      </div>

      <div className="grid gap-5 border-t border-line px-5 py-5 sm:grid-cols-[1fr_auto] sm:items-center sm:px-6">
        <div>
          <div className="mb-2 flex items-baseline justify-between gap-3 text-sm">
            <span className="font-semibold text-ink">Zgłoszenia</span>
            <span className="mono text-muted"><span className="font-semibold text-ink">{seats.taken}</span> / {seats.limit}</span>
          </div>
          <Meter value={seats.percent} label={`Zajęte ${seats.percent}% miejsc`} />
          <p className="mt-2 text-xs text-muted">{seats.free} {plural(seats.free, 'wolne miejsce', 'wolne miejsca', 'wolnych miejsc')}</p>
        </div>
        <dl className="flex gap-6">
          <div><dd className="num text-3xl">{tournament.matches.length}</dd><dt className="mt-1 text-xs text-muted">mecze</dt></div>
          <div><dd className={`num text-3xl ${live ? '!text-live' : ''}`}>{live}</dd><dt className="mt-1 text-xs text-muted">na żywo</dt></div>
          <div><dd className="num text-3xl">{finished}</dd><dt className="mt-1 text-xs text-muted">zakończone</dt></div>
        </dl>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-bg px-5 py-3 sm:px-6">
        {options.length > 1 ? (
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-sm font-semibold text-ink" htmlFor={`status-${tournament.id}`}>Status:</label>
            <select id={`status-${tournament.id}`} value={nextStatus} onChange={(event) => setNextStatus(event.target.value)} className="input input-sm !w-auto">
              {options.map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}
            </select>
            {nextStatus !== tournament.status && (
              <button type="button" disabled={saving} onClick={() => onStatusChange(tournament.id, nextStatus)} className="btn btn-primary btn-sm">
                {saving ? 'Zapis…' : 'Zapisz status'}
              </button>
            )}
          </div>
        ) : <span className="text-sm text-muted">Status: {STATUS_LABELS[tournament.status] || tournament.status}</span>}
        <button
          type="button"
          disabled={saving || deleting}
          onClick={() => onDelete(tournament)}
          className="btn btn-danger btn-sm"
          aria-label={`Usuń wydarzenie ${tournament.title}`}
        >
          <Icon name="trash" size={16} />
          {deleting ? 'Usuwanie…' : 'Usuń'}
        </button>
      </div>
    </article>
  );
}

/* One match as a list row: state tile, pairing, score and a single action. */
function MatchRow({ match }) {
  const live = match.status === 'IN_PROGRESS';
  const finished = match.status === 'FINISHED';
  const showScore = live || finished;
  return (
    <div className="row">
      <span className="row-tile" data-tone={live ? 'live' : undefined}>
        <Icon name={live ? 'bolt' : finished ? 'check' : 'clock'} size={19} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="row-title">
          {match.player1?.name || 'Oczekuje'} <span className="font-normal text-muted">vs</span> {match.player2?.name || 'Oczekuje'}
        </p>
        <p className="row-meta">
          <Link to={`/organizer/events/${match.tournament.id}`} state={{ tab: 'matches' }} className="hover:text-ink hover:underline">{match.tournament.title}</Link>
          {' · '}Runda {match.round}{match.court ? ` · ${match.court}` : ''}
        </p>
      </div>
      <div className="row-end hidden sm:block">
        {showScore
          ? <p className={`num text-2xl ${live ? '!text-live' : ''}`}>{match.score1 ?? 0}:{match.score2 ?? 0}</p>
          : <p className="text-sm font-semibold text-ink">{match.scheduledAt ? formatTime(match.scheduledAt) : '—'}</p>}
        <p className="text-xs text-muted">
          {live ? 'trwa' : finished ? 'koniec' : match.scheduledAt ? dateLabel(match.scheduledAt, { day: 'numeric', month: 'short' }) : 'bez terminu'}
        </p>
      </div>
      <Link
        to={`/tournaments/${match.tournament.id}/matches/${match.id}/live`}
        className="row-btn"
        data-tone={live ? 'live' : 'ghost'}
        aria-label={`${live ? 'Oglądaj na żywo' : 'Śledź wynik'}: ${match.player1?.name || 'uczestnik'} vs ${match.player2?.name || 'uczestnik'}`}
      >
        {live ? 'Oglądaj' : 'Śledź'}
      </Link>
    </div>
  );
}

export default function OrganizerDashboard() {
  const { user } = useAuth();
  const confirm = useConfirm();
  const [activeTab, setActiveTab] = useState('overview');
  const [dashboard, setDashboard] = useState({ stats: DEFAULT_STATS, tournaments: [], latestMatches: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [savingTournamentId, setSavingTournamentId] = useState('');
  const [deletingTournamentId, setDeletingTournamentId] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  useTour('organizer', TOUR, { auto: true, ready: !loading });

  const loadDashboard = useCallback(async ({ background = false } = {}) => {
    if (background) setRefreshing(true);
    else setLoading(true);
    try {
      const response = await api.get('/tournaments/organizer/dashboard');
      setDashboard({
        stats: { ...DEFAULT_STATS, ...response.data.stats },
        tournaments: response.data.tournaments || [],
        latestMatches: response.data.latestMatches || [],
      });
      setError('');
    } catch (loadError) {
      setError(loadError.response?.data?.message || 'Nie udało się pobrać danych panelu. Sprawdź połączenie i spróbuj ponownie.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => { void loadDashboard(); }, 0);
    const interval = window.setInterval(() => { void loadDashboard({ background: true }); }, 60000);
    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
    };
  }, [loadDashboard]);

  const filteredTournaments = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('pl');
    return dashboard.tournaments.filter((tournament) => {
      const matchesStatus = statusFilter === 'ALL' || tournament.status === statusFilter;
      const searchable = [tournament.title, tournament.location, SPORT_LABELS[tournament.sportType], tournament.organizer?.name]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('pl');
      return matchesStatus && (!normalizedQuery || searchable.includes(normalizedQuery));
    });
  }, [dashboard.tournaments, query, statusFilter]);

  async function changeTournamentStatus(tournamentId, status) {
    setSavingTournamentId(tournamentId);
    setNotice('');
    try {
      await api.patch(`/tournaments/${tournamentId}`, { status });
      setNotice(`Status wydarzenia zmieniono na „${STATUS_LABELS[status]}”.`);
      await loadDashboard({ background: true });
    } catch (saveError) {
      setNotice(saveError.response?.data?.message || 'Nie udało się zapisać nowego statusu.');
    } finally {
      setSavingTournamentId('');
    }
  }

  async function deleteTournament(tournament) {
    const confirmed = await confirm({
      title: `Usunąć „${tournament.title}”?`,
      body: 'Usunięte zostaną również zgłoszenia, mecze i historia wyników. Tej operacji nie można cofnąć.',
      confirmLabel: 'Usuń wydarzenie',
      tone: 'danger',
    });
    if (!confirmed) return;

    setDeletingTournamentId(tournament.id);
    setNotice('');
    try {
      await api.delete(`/tournaments/${tournament.id}`);
      setDashboard((current) => ({
        ...current,
        tournaments: current.tournaments.filter((item) => item.id !== tournament.id),
        latestMatches: current.latestMatches.filter((match) => match.tournament.id !== tournament.id),
      }));
      setNotice(`Wydarzenie „${tournament.title}” zostało usunięte.`);
      await loadDashboard({ background: true });
    } catch (deleteError) {
      setNotice(deleteError.response?.data?.message || 'Nie udało się usunąć wydarzenia. Spróbuj ponownie.');
    } finally {
      setDeletingTournamentId('');
    }
  }

  const liveMatches = dashboard.tournaments.flatMap((tournament) => tournament.matches
    .filter((match) => match.status === 'IN_PROGRESS')
    .map((match) => ({ ...match, tournament: { id: tournament.id, title: tournament.title, date: tournament.date } })));
  const activeTournaments = [...dashboard.tournaments]
    .filter((tournament) => !['FINISHED', 'CANCELLED'].includes(tournament.status))
    .sort((first, second) => new Date(first.date) - new Date(second.date));
  const passTournaments = [
    ...activeTournaments,
    ...dashboard.tournaments.filter((tournament) => ['FINISHED', 'CANCELLED'].includes(tournament.status)),
  ].slice(0, 8);
  const registrationOpenCount = (dashboard.stats.statuses.OPEN || 0) + (dashboard.stats.statuses.PUBLISHED || 0);
  const freeSeats = activeTournaments.reduce((sum, tournament) => sum + capacity(tournament.participants.length, tournament.maxParticipants).free, 0);
  const scheduledCount = Math.max(0, dashboard.stats.matches - dashboard.stats.liveMatches - dashboard.stats.completedMatches);
  const hasEvents = dashboard.tournaments.length > 0;
  const step = nextStep(dashboard.tournaments, liveMatches);
  const tabs = [
    { id: 'overview', label: 'Przegląd', icon: 'grid' },
    { id: 'events', label: 'Wydarzenia', icon: 'trophy', badge: dashboard.tournaments.length || null },
    { id: 'live', label: 'Mecze na żywo', icon: 'bolt', badge: liveMatches.length || null, badgeTone: 'live' },
    { id: 'participants', label: 'Uczestnicy', icon: 'users' },
  ];

  return (
    <main className="page">
      <div className="shell">
        <PageHeader
          eyebrow="Panel organizatora"
          title={`Dzień dobry, ${user?.name?.split(' ')[0] || 'Organizatorze'}`}
          actions={(
            <>
              <button type="button" onClick={() => loadDashboard({ background: true })} disabled={refreshing} className="icon-btn rounded-full" aria-label={refreshing ? 'Odświeżanie danych' : 'Odśwież dane'} title="Odśwież dane">
                <Icon name="refresh" size={18} className={refreshing ? 'spin' : ''} />
              </button>
              <Link to="/tournaments/create" className="btn btn-solid rounded-full" data-tour="org-new">
                <Icon name="plus" size={18} /> Nowe wydarzenie
              </Link>
            </>
          )}
        >
          Wydarzenia, zgłoszenia i wyniki — uporządkowane w jednym miejscu.{' '}
          <span className="whitespace-nowrap text-ink">{new Date().toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
        </PageHeader>

        {error && (
          <Notice
            tone="danger"
            className="mb-6"
            action={<button type="button" onClick={() => loadDashboard()} className="btn btn-ghost btn-sm shrink-0">Spróbuj ponownie</button>}
          >
            {error}
          </Notice>
        )}
        {notice && <Notice key={notice} className="mb-6" onClose={() => setNotice('')}>{notice}</Notice>}

        {loading ? (
          <div className="bento lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]" aria-label="Ładowanie danych panelu" role="status">
            {[0, 1, 2, 3].map((item) => <div key={item} className="skeleton h-72 !rounded-[24px]" />)}
          </div>
        ) : !hasEvents && !error ? (
          <Reveal>
            <EmptyState
              icon="bracket"
              title="Czas na pierwszy turniej"
              action={<Link to="/tournaments/create" className="btn btn-primary btn-lg" data-tour="org-next">Stwórz wydarzenie <Arrow /></Link>}
            >
              Kreator zada kilka prostych pytań i poprowadzi Cię do publikacji. Potem ten panel pokaże zgłoszenia, harmonogram i wyniki.
            </EmptyState>
            <ol className="steps mt-6 md:grid-cols-4">
              {[
                ['Stwórz wydarzenie', 'Termin, format i zasady w 4 krokach.'],
                ['Zbierz zgłoszenia', 'Zawodnicy zapisują się sami.'],
                ['Wygeneruj harmonogram', 'Mecze powstają jednym kliknięciem.'],
                ['Śledź wyniki', 'Sędziowie wprowadzają je na żywo.'],
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
            {step && (
              <Reveal className="next-banner mb-6 flex flex-col gap-4 border-[1.5px] border-ink bg-accent p-5 text-accent-ink sm:flex-row sm:items-center sm:p-6" data-tour="org-next">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-accent-ink text-accent"><Icon name={step.icon} size={24} /></span>
                <div className="min-w-0 flex-1">
                  <p className="mono text-[0.6875rem] font-semibold uppercase tracking-[0.14em] opacity-70">Co dalej?</p>
                  <h2 className="mt-1 break-words font-display text-2xl font-bold uppercase leading-tight">{step.title}</h2>
                  <p className="mt-1 text-[0.9375rem] leading-snug opacity-80">{step.body}</p>
                </div>
                {step.to ? (
                  <Link to={step.to} state={step.state} className="btn shrink-0 rounded-full border-accent-ink bg-accent-ink text-accent hover:bg-transparent hover:text-accent-ink">{step.label} <Arrow /></Link>
                ) : (
                  <button type="button" onClick={() => setActiveTab(step.tab)} className="btn shrink-0 rounded-full border-accent-ink bg-accent-ink text-accent hover:bg-transparent hover:text-accent-ink">{step.label} <Arrow /></button>
                )}
              </Reveal>
            )}

            <Tabs tabs={tabs} value={activeTab} onChange={setActiveTab} label="Sekcje panelu organizatora" className="tabs-seg mb-6" data-tour="org-tabs" />

            <TabPanel id={activeTab}>
              {activeTab === 'overview' && (
                <div className="bento">
                  <Reveal stagger={0.1} className="bento lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
                    <Panel
                      icon="users"
                      title="Zgłoszeni uczestnicy"
                      subtitle="Suma ze wszystkich Twoich wydarzeń"
                      action={<span className="soft-chip"><Icon name="trophy" size={14} />{dashboard.stats.tournaments} {plural(dashboard.stats.tournaments, 'wydarzenie', 'wydarzenia', 'wydarzeń')}</span>}
                      data-tour="org-stats"
                    >
                      <div className="panel-body flex flex-1 flex-col">
                        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-5">
                          <div>
                            <p className="panel-figure"><CountUp to={dashboard.stats.participants} duration={1.2} /></p>
                            <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted">
                              <span className="chip" data-tone="accent">{registrationOpenCount} z zapisami</span>
                              {freeSeats} {plural(freeSeats, 'wolne miejsce', 'wolne miejsca', 'wolnych miejsc')}
                            </p>
                          </div>
                          <div className="w-full sm:w-60">
                            <p className="mb-2.5 flex items-baseline justify-between text-xs font-semibold text-muted">
                              <span>Mecze</span>
                              <span className="mono text-ink">{dashboard.stats.matches}</span>
                            </p>
                            <StackBar
                              label={`${dashboard.stats.completedMatches} zakończonych, ${dashboard.stats.liveMatches} na żywo, ${scheduledCount} zaplanowanych`}
                              segments={[
                                { label: 'Zakończone', value: dashboard.stats.completedMatches, color: 'var(--mark)' },
                                { label: 'Na żywo', value: dashboard.stats.liveMatches, color: 'var(--live)' },
                                { label: 'Zaplanowane', value: scheduledCount, color: 'var(--line-2)' },
                              ]}
                            />
                          </div>
                        </div>
                        <div className="panel-actions mt-auto pt-7">
                          <Link to="/tournaments/create" className="btn btn-solid"><Icon name="plus" size={17} /> Nowe wydarzenie</Link>
                          <button type="button" onClick={() => setActiveTab('live')} className="btn btn-ghost">
                            <Icon name="bolt" size={17} /> Na żywo
                            {liveMatches.length > 0 && <span className="chip !h-[22px] !px-2" data-tone="live">{liveMatches.length}</span>}
                          </button>
                          <button type="button" onClick={() => setActiveTab('participants')} className="btn btn-ghost"><Icon name="users" size={17} /> Zgłoszenia</button>
                        </div>
                      </div>
                    </Panel>

                    <Panel
                      icon="trophy"
                      title="Moje wydarzenia"
                      subtitle="Przewiń i kliknij kartę, aby zarządzać"
                      action={<button type="button" onClick={() => setActiveTab('events')} className="soft-chip">Wszystkie <Icon name="arrow-right" size={14} /></button>}
                      data-tour="org-passes"
                    >
                      <div className="pt-4">
                        <PassRail label="Twoje wydarzenia">
                          {passTournaments.map((tournament, index) => {
                            const live = tournament.matches.some((match) => match.status === 'IN_PROGRESS');
                            return (
                              <div key={tournament.id} role="listitem" className="flex">
                                <EventPass
                                  to={`/organizer/events/${tournament.id}`}
                                  label={`Zarządzaj wydarzeniem ${tournament.title}`}
                                  index={index}
                                  sport={tournament.sportType}
                                  title={tournament.title}
                                  live={live}
                                  tag={live ? 'Na żywo' : STATUS_LABELS[tournament.status] || tournament.status}
                                  date={tournament.date}
                                  facts={[
                                    ['Zgłoszenia', `${tournament.participants.length}/${tournament.maxParticipants}`],
                                    ['Miejsce', tournament.location || 'Do ustalenia'],
                                  ]}
                                />
                              </div>
                            );
                          })}
                          <div role="listitem" className="flex">
                            <PassAdd to="/tournaments/create">Nowe wydarzenie</PassAdd>
                          </div>
                        </PassRail>
                      </div>
                      <PanelStats
                        items={[
                          ['Aktywne', activeTournaments.length],
                          ['Na żywo', liveMatches.length, liveMatches.length ? 'live' : undefined],
                          ['Najbliższy termin', activeTournaments[0] ? dateLabel(activeTournaments[0].date, { day: 'numeric', month: 'short' }) : '—'],
                        ]}
                      />
                    </Panel>
                  </Reveal>

                  <Reveal stagger={0.1} className="bento lg:grid-cols-2">
                    <Panel
                      icon="list"
                      title="Zapisy na wydarzenia"
                      subtitle="Zajętość miejsc w aktywnych wydarzeniach"
                      action={(
                        <button type="button" onClick={() => loadDashboard({ background: true })} disabled={refreshing} className="soft-chip">
                          <Icon name="refresh" size={14} className={refreshing ? 'spin' : ''} /> Odśwież
                        </button>
                      )}
                    >
                      <div className="panel-body">
                        {activeTournaments.length ? (
                          <div className="rows">
                            {activeTournaments.slice(0, 5).map((tournament) => {
                              const seats = capacity(tournament.participants.length, tournament.maxParticipants);
                              return (
                                <Link key={tournament.id} to={`/organizer/events/${tournament.id}`} state={{ tab: 'participants' }} className="row">
                                  <span className="row-tile"><Icon name={sportIcon(tournament.sportType)} size={20} /></span>
                                  <div className="min-w-0 flex-1">
                                    <p className="row-title">{tournament.title}</p>
                                    <p className="row-meta">{dateLabel(tournament.date, { day: 'numeric', month: 'short' })} · {STATUS_LABELS[tournament.status]}</p>
                                  </div>
                                  <Meter value={seats.percent} label={`Zajęte ${seats.percent}% miejsc`} className="hidden w-24 sm:block md:w-32" />
                                  <div className="row-end w-14">
                                    <p className="num text-xl">{seats.taken}<span className="text-sm text-muted">/{seats.limit}</span></p>
                                  </div>
                                </Link>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="well p-5 text-sm text-muted">Nie masz aktywnych wydarzeń. Utwórz nowe, aby pojawiło się tutaj.</p>
                        )}
                      </div>
                    </Panel>

                    <Panel
                      icon="whistle"
                      title="Mecze i wyniki"
                      subtitle="Ostatnia aktywność sędziów"
                      action={<button type="button" onClick={() => setActiveTab('live')} className="soft-chip">Na żywo <Icon name="arrow-right" size={14} /></button>}
                    >
                      <div className="panel-body">
                        {dashboard.latestMatches.length
                          ? <div className="rows">{dashboard.latestMatches.slice(0, 5).map((match) => <MatchRow key={match.id} match={match} />)}</div>
                          : <p className="well p-5 text-sm text-muted">Po utworzeniu meczów pojawią się tutaj ich bieżące wyniki.</p>}
                      </div>
                    </Panel>
                  </Reveal>
                </div>
              )}

              {activeTab === 'events' && (
                <section>
                  <div className="panel mb-4 p-3 sm:p-4">
                  <div className="grid gap-3 sm:grid-cols-[1fr_230px_auto] sm:items-center">
                    <div>
                      <label className="sr-only" htmlFor="event-search">Szukaj wydarzenia</label>
                      <input id="event-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Szukaj po nazwie, miejscu…" className="input" />
                    </div>
                    <div>
                      <label className="sr-only" htmlFor="event-status">Filtruj po statusie</label>
                      <select id="event-status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="input">
                        <option value="ALL">Wszystkie statusy</option>
                        {Object.entries(STATUS_LABELS).map(([status, label]) => <option key={status} value={status}>{label}</option>)}
                      </select>
                    </div>
                    <p className="px-1 text-sm text-muted" aria-live="polite">
                      <span className="font-semibold text-ink">{filteredTournaments.length}</span> {plural(filteredTournaments.length, 'wydarzenie', 'wydarzenia', 'wydarzeń')}
                    </p>
                  </div>
                  </div>
                  {filteredTournaments.length ? (
                    <div className="grid gap-4">
                      {filteredTournaments.map((tournament) => (
                        <TournamentCard
                          key={`${tournament.id}-${tournament.status}`}
                          tournament={tournament}
                          saving={savingTournamentId === tournament.id}
                          deleting={deletingTournamentId === tournament.id}
                          onStatusChange={changeTournamentStatus}
                          onDelete={deleteTournament}
                        />
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      icon="search"
                      title={hasEvents ? 'Brak wyników dla tych filtrów' : 'Nie masz jeszcze wydarzeń'}
                      action={hasEvents
                        ? <button type="button" className="btn btn-solid" onClick={() => { setQuery(''); setStatusFilter('ALL'); }}>Wyczyść filtry</button>
                        : <Link to="/tournaments/create" className="btn btn-primary">Utwórz wydarzenie <Arrow /></Link>}
                    >
                      {hasEvents ? 'Zmień frazę wyszukiwania albo wybierz inny status.' : 'Stwórz pierwsze wydarzenie — panel automatycznie pokaże jego uczestników i mecze.'}
                    </EmptyState>
                  )}
                </section>
              )}

              {activeTab === 'live' && (
                <section>
                  {liveMatches.length
                    ? (
                      <Panel icon="bolt" title={`Mecze na żywo · ${liveMatches.length}`} subtitle="Wyniki wprowadzane przez sędziów w tej chwili">
                        <div className="panel-body"><div className="rows">{liveMatches.map((match) => <MatchRow key={match.id} match={match} />)}</div></div>
                      </Panel>
                    )
                    : (
                      <EmptyState
                        icon="whistle"
                        title="Na razie cisza na boisku"
                        action={<button type="button" onClick={() => setActiveTab('events')} className="btn btn-ghost">Zobacz wydarzenia</button>}
                      >
                        Gdy sędzia rozpocznie mecz, jego wynik i status pojawią się tutaj na żywo.
                      </EmptyState>
                    )}
                </section>
              )}

              {activeTab === 'participants' && (
                <section>
                  <p className="mb-4 text-sm text-muted">
                    <span className="font-semibold text-ink">{dashboard.stats.participants}</span> {plural(dashboard.stats.participants, 'zgłoszenie', 'zgłoszenia', 'zgłoszeń')} · dane odświeżają się co minutę
                  </p>
                  {dashboard.tournaments.some((tournament) => tournament.participants.length) ? (
                    <div className="grid gap-4">
                      {dashboard.tournaments.filter((tournament) => tournament.participants.length).map((tournament) => (
                        <article key={tournament.id} className="panel overflow-hidden">
                          <div className="flex flex-col gap-3 border-b border-line p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                            <div className="flex min-w-0 items-center gap-3">
                              <SportBadge sport={tournament.sportType} />
                              <div className="min-w-0">
                                <h3 className="panel-title truncate">{tournament.title}</h3>
                                <p className="panel-sub">{tournament.participants.length} z {tournament.maxParticipants} zgłoszeń</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <StatusChip status={tournament.status} />
                              <Link to={`/organizer/events/${tournament.id}`} state={{ tab: 'participants' }} className="btn btn-ghost btn-sm rounded-full">Zarządzaj <Arrow size={16} /></Link>
                            </div>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="table min-w-[520px]">
                              <thead><tr><th scope="col">Uczestnik</th><th scope="col">Kontakt</th><th scope="col">Zgłoszono</th></tr></thead>
                              <tbody>
                                {tournament.participants.map((participant) => (
                                  <tr key={participant.id}>
                                    <td>
                                      <div className="flex items-center gap-3">
                                        <Avatar name={participant.user.name} className="!h-8 !w-8" />
                                        <span className="font-semibold text-ink">{participant.user.name}</span>
                                      </div>
                                    </td>
                                    <td className="text-muted">{participant.user.email}</td>
                                    <td className="mono text-sm text-muted">{dateLabel(participant.joinedAt)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      icon="users"
                      title="Brak zgłoszeń"
                      action={<button type="button" onClick={() => setActiveTab('events')} className="btn btn-ghost">Przejdź do wydarzeń</button>}
                    >
                      Zapisy uczestników pojawią się tutaj, gdy dołączą do Twoich wydarzeń.
                    </EmptyState>
                  )}
                </section>
              )}
            </TabPanel>
          </>
        )}
      </div>
    </main>
  );
}
