import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

const TABS = [
  { id: 'overview', label: 'Przegląd', icon: '◈' },
  { id: 'events', label: 'Wydarzenia', icon: '▦' },
  { id: 'live', label: 'Mecze na żywo', icon: '◉' },
  { id: 'participants', label: 'Uczestnicy', icon: '◎' },
];

const STATUS_LABELS = {
  DRAFT: 'Wersja robocza',
  OPEN: 'Zapisy otwarte',
  PUBLISHED: 'Opublikowany',
  IN_PROGRESS: 'W trakcie',
  FINISHED: 'Zakończony',
  CANCELLED: 'Anulowany',
};

const STATUS_STYLES = {
  DRAFT: 'border-white/10 bg-white/[0.05] text-slate-300',
  OPEN: 'border-cyan-300/20 bg-cyan-300/10 text-cyan-200',
  PUBLISHED: 'border-blue-300/20 bg-blue-300/10 text-blue-200',
  IN_PROGRESS: 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200',
  FINISHED: 'border-violet-300/20 bg-violet-300/10 text-violet-200',
  CANCELLED: 'border-rose-300/20 bg-rose-300/10 text-rose-200',
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
  OTHER: 'Inne',
};

const SPORT_ICONS = {
  BEACH_VOLLEYBALL: '🏐',
  FOOTBALL_6V6: '⚽',
  SOCCER: '⚽',
  BASKETBALL: '🏀',
  VOLLEYBALL: '🏐',
  TENNIS: '🎾',
  ESPORTS: '🎮',
  CUSTOM: '🏆',
  OTHER: '🏆',
};

const FORMAT_LABELS = {
  SINGLE_ELIMINATION: 'Pojedyncza eliminacja',
  DOUBLE_ELIMINATION: 'Podwójna eliminacja',
  ROUND_ROBIN: 'Każdy z każdym',
  GROUP_STAGE: 'Grupy i play-offy',
};

const DEFAULT_STATS = {
  tournaments: 0,
  participants: 0,
  matches: 0,
  liveMatches: 0,
  completedMatches: 0,
  statuses: {},
};

function dateLabel(value, options = { day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!value) return 'Data nieustalona';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Data nieustalona' : date.toLocaleDateString('pl-PL', options);
}

function timeLabel(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
}

function statusOptions(status) {
  if (status === 'DRAFT') return [];
  if (status === 'OPEN' || status === 'PUBLISHED') {
    return ['OPEN', 'PUBLISHED', 'IN_PROGRESS', 'CANCELLED'];
  }
  if (status === 'IN_PROGRESS') return ['IN_PROGRESS', 'FINISHED', 'CANCELLED'];
  return [status];
}

function participantPercentage(tournament) {
  if (!tournament.maxParticipants) return 0;
  return Math.min(100, Math.round((tournament.participants.length / tournament.maxParticipants) * 100));
}

function StatCard({ label, value, detail, icon, accent, delay = 0 }) {
  return (
    <article className="organizer-stat organizer-reveal relative overflow-hidden rounded-3xl border border-white/[0.08] bg-[#111827]/85 p-5 sm:p-6" style={{ '--reveal-delay': `${delay}ms` }}>
      <div className={`absolute -right-8 -top-8 h-28 w-28 rounded-full blur-3xl ${accent}`} />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-400">{label}</p>
          <p className="mt-3 text-4xl font-black tracking-[-0.06em] text-white tabular-nums">{value}</p>
          <p className="mt-2 text-xs text-slate-500">{detail}</p>
        </div>
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-lg text-white">{icon}</span>
      </div>
    </article>
  );
}

function StatusPill({ status }) {
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-bold ${STATUS_STYLES[status] || STATUS_STYLES.DRAFT}`}>
      {status === 'IN_PROGRESS' && <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-50" /><span className="relative h-2 w-2 rounded-full bg-emerald-300" /></span>}
      {STATUS_LABELS[status] || status}
    </span>
  );
}

function EmptyState({ title, detail, action }) {
  return (
    <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-14 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-[#0F62FE]/20 to-[#8A3FFC]/20 text-2xl">✦</div>
      <h3 className="mt-4 text-lg font-bold text-white">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">{detail}</p>
      {action}
    </div>
  );
}

function TournamentCard({ tournament, onStatusChange, onDelete, saving, deleting }) {
  const [nextStatus, setNextStatus] = useState(tournament.status);
  const percentage = participantPercentage(tournament);
  const options = statusOptions(tournament.status);

  return (
    <article className="organizer-event-card organizer-reveal overflow-hidden rounded-3xl border border-white/[0.08] bg-[#111827]/85">
      <div className="h-1 bg-gradient-to-r from-[#0F62FE] via-[#39B4FE] to-[#8A3FFC]" />
      <div className="p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 gap-4">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-white/10 bg-gradient-to-br from-[#0F62FE]/15 to-[#8A3FFC]/20 text-2xl shadow-[0_8px_32px_rgba(15,98,254,0.1)]">
              {SPORT_ICONS[tournament.sportType] || '🏆'}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="truncate text-lg font-bold text-white sm:text-xl">{tournament.title}</h3>
                <StatusPill status={tournament.status} />
              </div>
              <p className="mt-1 text-sm text-slate-400">
                {SPORT_LABELS[tournament.sportType] || tournament.sportType}
                {tournament.format && ` · ${FORMAT_LABELS[tournament.format] || tournament.format}`}
                {tournament.location && ` · ${tournament.location}`}
              </p>
              <p className="mt-3 text-xs text-slate-500">
                {dateLabel(tournament.date)}{tournament.endDate && ` — ${dateLabel(tournament.endDate)}`}
                {tournament.organizer?.name && ` · Organizator: ${tournament.organizer.name}`}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <Link to={`/organizer/events/${tournament.id}`} className="rounded-xl border border-white/10 px-3 py-2.5 text-xs font-semibold text-slate-200 transition hover:border-[#39B4FE]/40 hover:bg-white/[0.04]">
              Zarządzaj <span aria-hidden="true">↗</span>
            </Link>
            <button
              type="button"
              disabled={saving || deleting}
              onClick={() => onDelete(tournament)}
              className="rounded-xl border border-rose-300/20 px-3 py-2.5 text-xs font-semibold text-rose-200 transition hover:border-rose-300/50 hover:bg-rose-300/10 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label={`Usuń wydarzenie ${tournament.title}`}
            >
              {deleting ? 'Usuwanie…' : 'Usuń'}
            </button>
            {options.length > 1 && (
              <div className="flex gap-2">
                <label className="sr-only" htmlFor={`status-${tournament.id}`}>Zmień status {tournament.title}</label>
                <select id={`status-${tournament.id}`} value={nextStatus} onChange={(event) => setNextStatus(event.target.value)} className="max-w-40 rounded-xl border border-white/10 bg-[#090D16] px-3 py-2.5 text-xs text-slate-200 focus:border-[#0F62FE] focus:outline-none">
                  {options.map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}
                </select>
                <button type="button" disabled={saving || nextStatus === tournament.status} onClick={() => onStatusChange(tournament.id, nextStatus)} className="rounded-xl bg-gradient-to-r from-[#0F62FE] to-[#8A3FFC] px-3 py-2.5 text-xs font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40">
                  {saving ? 'Zapis…' : 'Zapisz'}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 grid gap-5 border-t border-white/[0.06] pt-5 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300">Zgłoszenia</span>
              <span className="font-mono text-slate-400">{tournament.participants.length} <span className="text-slate-600">/</span> {tournament.maxParticipants}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
              <div className="organizer-progress h-full rounded-full bg-gradient-to-r from-[#0F62FE] via-[#39B4FE] to-[#8A3FFC]" style={{ width: `${percentage}%` }} />
            </div>
            <div className="mt-2 flex justify-between text-[10px] text-slate-500">
              <span>{percentage}% pojemności</span>
              <span>{Math.max(0, tournament.maxParticipants - tournament.participants.length)} wolnych miejsc</span>
            </div>
          </div>
          <div className="flex gap-5 text-xs">
            <div><p className="font-mono text-lg font-bold text-white">{tournament.matches.length}</p><p className="text-slate-500">mecze</p></div>
            <div><p className="font-mono text-lg font-bold text-emerald-200">{tournament.matches.filter((match) => match.status === 'IN_PROGRESS').length}</p><p className="text-slate-500">na żywo</p></div>
            <div><p className="font-mono text-lg font-bold text-violet-200">{tournament.matches.filter((match) => match.status === 'FINISHED').length}</p><p className="text-slate-500">zakończone</p></div>
          </div>
        </div>
      </div>
    </article>
  );
}

function MatchRow({ match }) {
  const live = match.status === 'IN_PROGRESS';
  return (
    <article className="organizer-match-row group flex flex-col gap-4 rounded-2xl border border-white/[0.07] bg-[#0C1220]/80 p-4 transition hover:border-[#0F62FE]/40 hover:bg-[#111827] sm:flex-row sm:items-center">
      <div className="flex items-center gap-3 sm:w-32">
        {live
          ? <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-300" /> Live</span>
          : <span className="text-xs text-slate-500">{dateLabel(match.updatedAt, { day: 'numeric', month: 'short' })} · {timeLabel(match.updatedAt)}</span>}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{match.tournament.title} · Runda {match.round}{match.court ? ` · ${match.court}` : ''}{match.scheduledAt ? ` · ${dateLabel(match.scheduledAt, { day: 'numeric', month: 'short' })} ${timeLabel(match.scheduledAt)}` : ''}</p>
        <div className="mt-2 flex items-center gap-2 text-sm font-bold text-white">
          <span className="min-w-0 truncate">{match.player1?.name || 'Oczekuje na uczestnika'}</span>
          <span className="font-mono text-slate-500">{match.status === 'FINISHED' ? `${match.score1 ?? 0} : ${match.score2 ?? 0}` : '—'}</span>
          <span className="min-w-0 truncate">{match.player2?.name || 'Oczekuje na uczestnika'}</span>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link to={`/tournaments/${match.tournament.id}/matches/${match.id}/live`} className="rounded-lg bg-[#0F62FE]/15 px-3 py-2 text-xs font-semibold text-blue-200 transition hover:bg-[#0F62FE]/25">
          Śledź wynik{live ? ' · LIVE' : ''} <span aria-hidden="true">↗</span>
        </Link>
        <Link to={`/organizer/events/${match.tournament.id}`} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-white/[0.05]">
          Zarządzaj wydarzeniem
        </Link>
      </div>
    </article>
  );
}

export default function OrganizerDashboard() {
  const { user } = useAuth();
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
    const confirmed = window.confirm(
      `Czy na pewno usunąć wydarzenie „${tournament.title}”? Usunięte zostaną również zgłoszenia, mecze i historia wyników. Tej operacji nie można cofnąć.`,
    );
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
  const upcomingTournaments = [...dashboard.tournaments]
    .filter((tournament) => !['FINISHED', 'CANCELLED'].includes(tournament.status))
    .sort((first, second) => new Date(first.date) - new Date(second.date))
    .slice(0, 3);
  const registrationOpenCount = (dashboard.stats.statuses.OPEN || 0) + (dashboard.stats.statuses.PUBLISHED || 0);
  const completion = dashboard.stats.matches
    ? Math.round((dashboard.stats.completedMatches / dashboard.stats.matches) * 100)
    : 0;

  return (
    <main className="organizer-dashboard min-h-[calc(100vh-5rem)] overflow-hidden bg-[#090D16] px-4 py-7 text-white sm:px-6 lg:px-8">
      <div className="organizer-aurora organizer-aurora-one" aria-hidden="true" />
      <div className="organizer-aurora organizer-aurora-two" aria-hidden="true" />
      <div className="relative mx-auto max-w-[1440px]">
        <header className="organizer-reveal mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#39B4FE]/20 bg-[#0F62FE]/[0.08] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#8BCBFF]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#39B4FE] shadow-[0_0_12px_#39B4FE]" />
              Panel organizatora
            </div>
            <h1 className="text-3xl font-black tracking-[-0.06em] text-white sm:text-4xl lg:text-5xl">
              Dzień dobry, <span className="brand-text">{user?.name?.split(' ')[0] || 'Organizator'}</span>
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400 sm:text-base">
              Wydarzenia, zgłoszenia i wyniki — uporządkowane w jednym miejscu. Wybierz sekcję albo utwórz wydarzenie.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-xs text-slate-400">
              {new Date().toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })}
            </span>
            <button type="button" onClick={() => loadDashboard({ background: true })} disabled={refreshing} className="rounded-xl border border-white/10 px-4 py-2.5 text-xs font-semibold text-slate-200 transition hover:border-[#39B4FE]/40 hover:bg-white/[0.04] disabled:opacity-50">
              <span className={refreshing ? 'mr-2 inline-block animate-spin' : 'mr-2 inline-block'} aria-hidden="true">⟳</span>
              {refreshing ? 'Odświeżanie' : 'Odśwież dane'}
            </button>
            <Link to="/tournaments/create" className="organizer-primary-button rounded-xl px-4 py-2.5 text-xs font-bold text-white">
              <span className="mr-1.5 text-base">＋</span> Nowe wydarzenie
            </Link>
          </div>
        </header>

        <nav aria-label="Sekcje panelu organizatora" className="organizer-reveal mb-6 flex gap-2 overflow-x-auto border-b border-white/[0.07] pb-3" style={{ '--reveal-delay': '60ms' }}>
          {TABS.map((tab) => (
            <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} aria-current={activeTab === tab.id ? 'page' : undefined} className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition ${activeTab === tab.id ? 'bg-white/[0.08] text-white shadow-[inset_0_-2px_0_#39B4FE]' : 'text-slate-500 hover:bg-white/[0.04] hover:text-slate-200'}`}>
              <span className={activeTab === tab.id ? 'text-[#39B4FE]' : ''}>{tab.icon}</span>
              {tab.label}
              {tab.id === 'live' && liveMatches.length > 0 && <span className="rounded-full bg-emerald-300/10 px-2 py-0.5 text-[10px] text-emerald-200">{liveMatches.length}</span>}
            </button>
          ))}
        </nav>

        {error && (
          <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-rose-300/20 bg-rose-300/[0.06] p-4 text-sm text-rose-100 sm:flex-row sm:items-center sm:justify-between" role="alert">
            <span>{error}</span>
            <button type="button" onClick={() => loadDashboard()} className="shrink-0 rounded-lg border border-rose-200/20 px-3 py-2 text-xs font-bold">Spróbuj ponownie</button>
          </div>
        )}
        {notice && <div className="mb-6 rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.06] p-4 text-sm text-emerald-100" role="status">{notice}</div>}

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" aria-label="Ładowanie danych panelu">
            {[0, 1, 2, 3].map((item) => <div key={item} className="h-36 animate-pulse rounded-3xl border border-white/[0.06] bg-white/[0.03]" />)}
          </div>
        ) : (
          <>
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Podsumowanie wydarzeń">
                  <StatCard label="Wydarzenia" value={dashboard.stats.tournaments} detail={`${registrationOpenCount} z aktywnymi zapisami`} icon="✦" accent="bg-blue-500/20" />
                  <StatCard label="Zgłoszeni uczestnicy" value={dashboard.stats.participants} detail="Suma zapisów ze wszystkich wydarzeń" icon="◎" accent="bg-violet-500/20" delay={60} />
                  <StatCard label="Mecze na żywo" value={dashboard.stats.liveMatches} detail={`${dashboard.stats.matches} meczów łącznie`} icon="◉" accent="bg-emerald-500/20" delay={120} />
                  <StatCard label="Ukończone mecze" value={`${completion}%`} detail={`${dashboard.stats.completedMatches} z ${dashboard.stats.matches} rozegranych`} icon="↗" accent="bg-cyan-500/20" delay={180} />
                </section>

                <section className="organizer-feature-card organizer-reveal relative overflow-hidden rounded-[28px] border border-white/[0.08] p-6 sm:p-8" style={{ '--reveal-delay': '120ms' }}>
                  <div className="organizer-feature-grid absolute inset-0 opacity-50" aria-hidden="true" />
                  <div className="organizer-feature-glow absolute -right-24 -top-36 h-96 w-96 rounded-full bg-[#0F62FE]/20 blur-[100px]" aria-hidden="true" />
                  <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
                    <div className="max-w-2xl">
                      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#81C7FF]">Centrum dowodzenia</p>
                      <h2 className="mt-3 text-2xl font-black tracking-[-0.04em] sm:text-3xl">Turniej pod kontrolą.<br /><span className="text-slate-400">Wyniki bez niespodzianek.</span></h2>
                      <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">
                        Dane odświeżają się automatycznie. Przejdź do wydarzenia, aby sprawdzić składy, drabinkę i aktualny wynik każdego spotkania.
                      </p>
                      <button type="button" onClick={() => setActiveTab('events')} className="mt-5 rounded-xl bg-white px-4 py-3 text-xs font-bold text-[#090D16] transition hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(255,255,255,0.15)]">
                        Otwórz wydarzenia <span className="ml-2">→</span>
                      </button>
                    </div>
                    <div className="organizer-orbit mx-auto grid h-44 w-44 place-items-center rounded-full border border-white/[0.09] sm:h-52 sm:w-52">
                      <div className="organizer-orbit-inner grid h-32 w-32 place-items-center rounded-full border border-[#39B4FE]/20 bg-[#090D16]/70 shadow-[0_0_70px_rgba(15,98,254,0.18)] sm:h-40 sm:w-40">
                        <div className="text-center"><span className="text-4xl">🏆</span><p className="mt-2 text-[9px] font-bold uppercase tracking-[0.2em] text-[#81C7FF]">TourniDesk</p></div>
                      </div>
                    </div>
                  </div>
                </section>

                <div className="grid gap-6 xl:grid-cols-[1.35fr_0.85fr]">
                  <section className="organizer-reveal rounded-3xl border border-white/[0.08] bg-[#111827]/75 p-5 sm:p-6" style={{ '--reveal-delay': '180ms' }}>
                    <div className="mb-5 flex items-end justify-between gap-3">
                      <div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Twoje wydarzenia</p><h2 className="mt-1 text-xl font-bold text-white">Najbliższe terminy</h2></div>
                      <button type="button" onClick={() => setActiveTab('events')} className="text-xs font-semibold text-[#81C7FF] hover:text-white">Wszystkie →</button>
                    </div>
                    {upcomingTournaments.length ? (
                      <div className="space-y-3">
                        {upcomingTournaments.map((tournament, index) => (
                          <Link key={tournament.id} to={`/organizer/events/${tournament.id}`} className="organizer-upcoming-row flex items-center gap-4 rounded-2xl border border-white/[0.06] bg-[#0C1220]/75 p-4 transition hover:border-[#0F62FE]/30" style={{ '--row-index': index }}>
                            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#0F62FE]/20 to-[#8A3FFC]/20 text-xl">{SPORT_ICONS[tournament.sportType] || '🏆'}</div>
                            <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-white">{tournament.title}</p><p className="mt-1 text-xs text-slate-500">{tournament.participants.length}/{tournament.maxParticipants} zgłoszeń · {tournament.matches.length} meczów</p></div>
                            <div className="text-right"><p className="text-xs font-bold text-slate-200">{dateLabel(tournament.date, { day: 'numeric', month: 'short' })}</p><p className="mt-1 text-[10px] text-slate-500">{timeLabel(tournament.date)}</p></div>
                          </Link>
                        ))}
                      </div>
                    ) : <EmptyState title="Czas na pierwszy turniej" detail="Utwórz wydarzenie, a wszystkie zgłoszenia i wyniki pojawią się tutaj." action={<Link to="/tournaments/create" className="mt-5 inline-flex rounded-xl bg-gradient-to-r from-[#0F62FE] to-[#8A3FFC] px-4 py-2.5 text-xs font-bold text-white">Stwórz wydarzenie</Link>} />}
                  </section>

                  <section className="organizer-reveal rounded-3xl border border-white/[0.08] bg-[#111827]/75 p-5 sm:p-6" style={{ '--reveal-delay': '240ms' }}>
                    <div className="mb-6"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Stan rozgrywek</p><h2 className="mt-1 text-xl font-bold text-white">Postęp meczów</h2></div>
                    <div className="flex items-end gap-2">
                      <span className="text-5xl font-black tracking-[-0.06em] text-white">{completion}<span className="text-2xl text-slate-500">%</span></span>
                      <span className="mb-2 text-xs text-slate-500">zakończonych meczów</span>
                    </div>
                    <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/[0.06]">
                      <div className="organizer-progress h-full rounded-full bg-gradient-to-r from-[#0F62FE] via-[#39B4FE] to-[#8A3FFC]" style={{ width: `${completion}%` }} />
                    </div>
                    <div className="mt-5 grid grid-cols-3 gap-2 border-t border-white/[0.06] pt-5 text-center">
                      <div><p className="font-mono text-xl font-bold text-white">{dashboard.stats.matches}</p><p className="mt-1 text-[10px] text-slate-500">wszystkie</p></div>
                      <div><p className="font-mono text-xl font-bold text-emerald-200">{dashboard.stats.liveMatches}</p><p className="mt-1 text-[10px] text-slate-500">na żywo</p></div>
                      <div><p className="font-mono text-xl font-bold text-violet-200">{dashboard.stats.completedMatches}</p><p className="mt-1 text-[10px] text-slate-500">zakończone</p></div>
                    </div>
                  </section>
                </div>

                <section className="organizer-reveal rounded-3xl border border-white/[0.08] bg-[#111827]/75 p-5 sm:p-6" style={{ '--reveal-delay': '300ms' }}>
                  <div className="mb-5 flex items-end justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Ostatnia aktywność</p><h2 className="mt-1 text-xl font-bold text-white">Wyniki i mecze</h2></div><button type="button" onClick={() => setActiveTab('live')} className="text-xs font-semibold text-[#81C7FF] hover:text-white">Mecze →</button></div>
                  {dashboard.latestMatches.length ? <div className="grid gap-3 md:grid-cols-2">{dashboard.latestMatches.slice(0, 4).map((match) => <MatchRow key={match.id} match={match} />)}</div> : <p className="rounded-2xl border border-white/[0.06] bg-[#0C1220]/75 p-5 text-sm text-slate-500">Po utworzeniu meczów pojawią się tutaj ich bieżące wyniki.</p>}
                </section>
              </div>
            )}

            {activeTab === 'events' && (
              <section className="space-y-5">
                <div className="organizer-reveal flex flex-col gap-4 rounded-3xl border border-white/[0.08] bg-[#111827]/75 p-5 sm:flex-row sm:items-end sm:justify-between">
                  <div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Zarządzanie</p><h2 className="mt-1 text-2xl font-black text-white">Wydarzenia <span className="text-slate-500">({filteredTournaments.length})</span></h2></div>
                  <div className="grid gap-2 sm:grid-cols-[minmax(180px,1fr)_190px]">
                    <label className="sr-only" htmlFor="event-search">Szukaj wydarzenia</label>
                    <input id="event-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Szukaj po nazwie, miejscu…" className="min-h-11 rounded-xl border border-white/10 bg-[#090D16] px-4 text-sm text-white placeholder:text-slate-600 focus:border-[#0F62FE] focus:outline-none" />
                    <label className="sr-only" htmlFor="event-status">Filtruj po statusie</label>
                    <select id="event-status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="min-h-11 rounded-xl border border-white/10 bg-[#090D16] px-3 text-sm text-slate-200 focus:border-[#0F62FE] focus:outline-none">
                      <option value="ALL">Wszystkie statusy</option>
                      {Object.entries(STATUS_LABELS).map(([status, label]) => <option key={status} value={status}>{label}</option>)}
                    </select>
                  </div>
                </div>
                {filteredTournaments.length ? <div className="grid gap-4">{filteredTournaments.map((tournament, index) => <div key={`${tournament.id}-${tournament.status}`} style={{ '--reveal-delay': `${Math.min(index * 45, 270)}ms` }}><TournamentCard tournament={tournament} saving={savingTournamentId === tournament.id} deleting={deletingTournamentId === tournament.id} onStatusChange={changeTournamentStatus} onDelete={deleteTournament} /></div>)}</div>
                  : <EmptyState title={dashboard.tournaments.length ? 'Brak wyników dla tych filtrów' : 'Nie masz jeszcze wydarzeń'} detail={dashboard.tournaments.length ? 'Zmień frazę wyszukiwania albo wybierz inny status.' : 'Stwórz pierwsze wydarzenie — panel automatycznie pokaże jego uczestników i mecze.'} action={!dashboard.tournaments.length && <Link to="/tournaments/create" className="mt-5 inline-flex rounded-xl bg-gradient-to-r from-[#0F62FE] to-[#8A3FFC] px-4 py-2.5 text-xs font-bold text-white">Utwórz wydarzenie</Link>} />}
              </section>
            )}

            {activeTab === 'live' && (
              <section className="organizer-reveal rounded-3xl border border-white/[0.08] bg-[#111827]/75 p-5 sm:p-6">
                <div className="mb-5 flex items-end justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-300">Aktualny stan bazy</p><h2 className="mt-1 text-2xl font-black text-white">Mecze na żywo</h2></div><span className="rounded-full border border-emerald-300/20 bg-emerald-300/[0.06] px-3 py-1.5 text-xs font-bold text-emerald-200">{liveMatches.length} aktywne</span></div>
                {liveMatches.length ? <div className="space-y-3">{liveMatches.map((match) => <MatchRow key={match.id} match={match} />)}</div>
                  : <EmptyState title="Na razie cisza na boisku" detail="Gdy sędzia rozpocznie mecz, jego wynik i status pojawią się tutaj na żywo." action={<button type="button" onClick={() => setActiveTab('events')} className="mt-5 rounded-xl border border-white/10 px-4 py-2.5 text-xs font-bold text-white">Zobacz wydarzenia</button>} />}
              </section>
            )}

            {activeTab === 'participants' && (
              <section className="organizer-reveal space-y-4">
                <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Rejestr uczestników</p><h2 className="mt-1 text-2xl font-black text-white">Zgłoszenia <span className="text-slate-500">({dashboard.stats.participants})</span></h2></div><p className="text-xs text-slate-500">Dane aktualizowane automatycznie co minutę</p></div>
                {dashboard.tournaments.some((tournament) => tournament.participants.length) ? dashboard.tournaments.filter((tournament) => tournament.participants.length).map((tournament) => (
                  <article key={tournament.id} className="overflow-hidden rounded-3xl border border-white/[0.08] bg-[#111827]/80">
                    <div className="flex flex-col gap-3 border-b border-white/[0.06] p-5 sm:flex-row sm:items-center sm:justify-between">
                      <div><h3 className="font-bold text-white">{tournament.title}</h3><p className="mt-1 text-xs text-slate-500">{tournament.participants.length} z {tournament.maxParticipants} zgłoszeń</p></div>
                      <div className="flex items-center gap-3"><StatusPill status={tournament.status} /><Link to={`/organizer/events/${tournament.id}`} className="text-xs font-semibold text-[#81C7FF] hover:text-white">Zarządzaj →</Link></div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[560px] text-left text-sm">
                        <thead className="text-[10px] uppercase tracking-[0.14em] text-slate-500"><tr><th className="px-5 py-3 font-semibold">Uczestnik</th><th className="px-5 py-3 font-semibold">Kontakt</th><th className="px-5 py-3 font-semibold">Zgłoszono</th><th className="px-5 py-3 font-semibold">Status turnieju</th></tr></thead>
                        <tbody className="divide-y divide-white/[0.05]">
                          {tournament.participants.map((participant) => <tr key={participant.id} className="transition hover:bg-white/[0.02]"><td className="px-5 py-3.5"><div className="flex items-center gap-3"><span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-[#0F62FE]/30 to-[#8A3FFC]/30 text-xs font-bold">{participant.user.name?.charAt(0)?.toUpperCase() || '?'}</span><span className="font-semibold text-slate-200">{participant.user.name}</span></div></td><td className="px-5 py-3.5 text-slate-400">{participant.user.email}</td><td className="px-5 py-3.5 text-slate-400">{dateLabel(participant.joinedAt)}</td><td className="px-5 py-3.5"><StatusPill status={tournament.status} /></td></tr>)}
                        </tbody>
                      </table>
                    </div>
                  </article>
                )) : <EmptyState title="Brak zgłoszeń" detail="Zapisy uczestników pojawią się tutaj, gdy dołączą do Twoich wydarzeń." action={<button type="button" onClick={() => setActiveTab('events')} className="mt-5 rounded-xl border border-white/10 px-4 py-2.5 text-xs font-bold text-white">Przejdź do wydarzeń</button>} />}
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
