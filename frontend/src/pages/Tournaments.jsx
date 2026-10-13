import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../api/axios';

const SPORT_LABELS = {
  BEACH_VOLLEYBALL: '🏐 Siatkówka plażowa',
  FOOTBALL_6V6: '⚽ Piłka nożna 6v6',
  SOCCER: '⚽ Piłka nożna',
  BASKETBALL: '🏀 Koszykówka',
  VOLLEYBALL: '🏐 Siatkówka',
  TENNIS: '🎾 Tenis',
  ESPORTS: '🎮 E-sport',
  CUSTOM: '🏅 Inna dyscyplina',
  OTHER: '🏅 Inne',
};

const STATUS_STYLES = {
  DRAFT: 'bg-[rgba(255,255,255,0.06)] text-[var(--app-text-muted)]',
  OPEN: 'bg-[rgba(57,180,254,0.12)] text-[var(--tourni-light-blue)]',
  PUBLISHED: 'bg-[rgba(57,180,254,0.12)] text-[var(--tourni-light-blue)]',
  IN_PROGRESS: 'bg-[rgba(15,98,254,0.12)] text-[var(--tourni-blue)]',
  FINISHED: 'bg-[rgba(138,63,252,0.12)] text-[var(--tourni-violet)]',
  CANCELLED: 'bg-[rgba(239,68,68,0.12)] text-[#f87171]',
};

const STATUS_LABELS = {
  DRAFT: 'Szkic',
  OPEN: 'Otwarte',
  PUBLISHED: 'Opublikowany',
  IN_PROGRESS: 'W toku',
  FINISHED: 'Zakończone',
  CANCELLED: 'Anulowane',
};

export default function Tournaments() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const filters = {
    sportType: searchParams.get('sportType') || '',
    status: searchParams.get('status') || '',
    search: searchParams.get('search') || '',
  };

  useEffect(() => {
    let active = true;
    const params = {};
    if (filters.sportType) params.sportType = filters.sportType;
    if (filters.status) params.status = filters.status;

    api
      .get('/tournaments', { params })
      .then((res) => { if (active) setTournaments(res.data.tournaments); })
      .catch(() => { if (active) setError('Nie udało się załadować turniejów.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [filters.sportType, filters.status]);

  function handleFilter(e) {
    const nextValue = e.target.value;
    const params = new URLSearchParams();
    const nextFilters = { ...filters, [e.target.name]: nextValue };
    if (nextFilters.sportType) params.set('sportType', nextFilters.sportType);
    if (nextFilters.status) params.set('status', nextFilters.status);
    if (nextFilters.search) params.set('search', nextFilters.search);
    if (e.target.name !== 'search') {
      setLoading(true);
      setError('');
    }
    setSearchParams(params, { replace: e.target.name === 'search' });
  }

  const normalizedSearch = filters.search.trim().toLocaleLowerCase('pl');
  const visibleTournaments = tournaments.filter((tournament) => (
    !normalizedSearch || [
      tournament.title,
      tournament.location,
      tournament.organizer?.name,
      SPORT_LABELS[tournament.sportType],
    ].filter(Boolean).join(' ').toLocaleLowerCase('pl').includes(normalizedSearch)
  ));

  return (
    <main className="discovery-page min-h-[calc(100vh-4rem)] bg-[var(--app-bg)] px-4 py-10 text-[var(--app-text)]">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="section-eyebrow">Znajdź swój następny mecz</p>
            <h1 className="mt-3 text-4xl font-bold tracking-[-0.05em] text-[var(--app-text-strong)] sm:text-5xl">Wydarzenia</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--app-text-muted)]">Przeglądaj turnieje, sprawdź wolne miejsca i wybierz to, co Cię interesuje.</p>
          </div>

        </div>

        <div className="discovery-tools mb-8">
          <label className="discovery-search">
            <span aria-hidden="true">⌕</span>
            <span className="sr-only">Szukaj wydarzenia, sportu lub miasta</span>
            <input name="search" value={filters.search} onChange={handleFilter} placeholder="Szukaj wydarzenia, sportu lub miasta" />
          </label>
          <div className="flex flex-wrap gap-3">
            <label className="sr-only" htmlFor="discovery-sport">Filtruj po dyscyplinie</label>
            <select id="discovery-sport" name="sportType" value={filters.sportType} onChange={handleFilter} className="discovery-select">
              <option value="">Wszystkie sporty</option>
              {Object.entries(SPORT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <label className="sr-only" htmlFor="discovery-status">Filtruj po statusie</label>
            <select id="discovery-status" name="status" value={filters.status} onChange={handleFilter} className="discovery-select">
              <option value="">Wszystkie statusy</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
        </div>

        {loading && (
          <div className="flex justify-center py-20" role="status" aria-label="Ładowanie wydarzeń">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--tourni-blue)] border-t-transparent" />
          </div>
        )}

        {error && <p className="py-10 text-center text-red-400" role="alert">{error}</p>}

        {!loading && !error && visibleTournaments.length === 0 && (
          <div className="discovery-empty">
            <span className="discovery-empty-icon" aria-hidden="true">⌕</span>
            <h2 className="text-lg font-semibold text-[var(--app-text-strong)]">{tournaments.length ? 'Nie znaleźliśmy pasujących wydarzeń' : 'Brak wydarzeń do wyświetlenia'}</h2>
            <p className="mt-2 text-sm text-[var(--app-text-muted)]">{tournaments.length ? 'Zmień wyszukiwaną frazę lub usuń część filtrów.' : 'Wróć później albo zacznij organizować własne wydarzenie.'}</p>
            {tournaments.length === 0 && <Link to="/tournaments/create" className="primary-action mt-5">Zorganizuj wydarzenie <span aria-hidden="true">→</span></Link>}
          </div>
        )}

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {!loading && !error && visibleTournaments.map((t) => (
            <Link
              key={t.id}
              to={`/tournaments/${t.id}`}
              className="discovery-event-card group rounded-3xl border border-[var(--app-border)] bg-[var(--app-surface)] p-6 transition-all hover:border-[rgba(15,98,254,0.5)] hover:bg-[var(--app-surface-strong)]"
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <span className="text-sm text-[var(--app-text-muted)]">{SPORT_LABELS[t.sportType]}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[t.status]}`}>
                  {STATUS_LABELS[t.status]}
                </span>
              </div>
              <h2 className="mb-1 text-lg font-semibold text-[var(--app-text-strong)] transition-colors group-hover:text-[var(--tourni-blue)]">
                {t.title}
              </h2>
              <p className="mb-4 text-sm text-[var(--app-text-muted)]">
                📅{' '}
                {new Date(t.date).toLocaleDateString('pl-PL', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
              <div className="flex items-center justify-between text-sm text-[var(--app-text-muted)]">
                <span>{t.organizer?.name || 'Organizator'}</span>
                <span>
                  {t._count.participants}/{t.maxParticipants} uczestników
                </span>
              </div>
              <div className="home-progress-track mt-3" aria-label={`${t._count.participants} z ${t.maxParticipants} miejsc zajętych`}>
                <span style={{ width: `${t.maxParticipants ? Math.min(100, Math.round((t._count.participants / t.maxParticipants) * 100)) : 0}%` }} />
              </div>
              <span className="home-accent-text mt-5 inline-flex text-sm font-semibold">Sprawdź szczegóły <span className="ml-2" aria-hidden="true">→</span></span>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
