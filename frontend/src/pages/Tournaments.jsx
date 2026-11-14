import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { SPORTS, SPORT_LABELS, TOURNAMENT_STATUS_LABELS, plural, sportIcon } from '../lib/labels';
import EventCard from '../components/EventCard';
import Icon from '../components/Icon';
import Reveal from '../components/Reveal';
import { useTour } from '../components/Tour';
import { Arrow, EmptyState, Notice, PageHeader } from '../components/ui';

const FILTER_SPORTS = SPORTS.filter(({ value }) => value !== 'OTHER');

const TOUR = [
  { target: '[data-tour="list-search"]', title: 'Szukaj po swojemu', body: 'Wpisz nazwę wydarzenia, miasto albo organizatora — lista zawęża się podczas pisania.' },
  { target: '[data-tour="list-sports"]', title: 'Wybierz dyscyplinę', body: 'Jedno kliknięcie pokazuje tylko wybrany sport. Kliknij ponownie „Wszystkie”, aby wrócić.' },
  { target: '[data-tour="list-results"]', title: 'Otwórz kartę wydarzenia', body: 'Na karcie widzisz termin, miejsce i wolne miejsca. Kliknij, aby zobaczyć szczegóły i się zapisać.' },
];

export default function Tournaments() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const filters = {
    sportType: searchParams.get('sportType') || '',
    status: searchParams.get('status') || '',
    search: searchParams.get('search') || '',
  };
  const canCreate = user?.role === 'ORGANIZER' || user?.role === 'ADMIN';

  useTour('tournaments', TOUR);

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

  function setFilter(name, nextValue) {
    const params = new URLSearchParams();
    const nextFilters = { ...filters, [name]: nextValue };
    if (nextFilters.sportType) params.set('sportType', nextFilters.sportType);
    if (nextFilters.status) params.set('status', nextFilters.status);
    if (nextFilters.search) params.set('search', nextFilters.search);
    if (name !== 'search' && nextValue !== filters[name]) {
      setLoading(true);
      setError('');
    }
    setSearchParams(params, { replace: name === 'search' });
  }

  function clearFilters() {
    if (filters.sportType || filters.status) {
      setLoading(true);
      setError('');
    }
    setSearchParams(new URLSearchParams(), { replace: true });
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
  const hasFilters = Boolean(filters.sportType || filters.status || filters.search);

  return (
    <main className="page">
      <div className="shell">
        <PageHeader eyebrow="Znajdź swój następny mecz" title="Wydarzenia">
          Przeglądaj turnieje, sprawdź wolne miejsca i wybierz to, co Cię interesuje.
        </PageHeader>

        <Reveal className="mb-8 grid gap-4">
          <div className="grid gap-3 md:grid-cols-[1fr_240px]">
            <label
              className="flex items-center gap-3 rounded-[12px] border-[1.5px] border-line-2 bg-raised px-4 transition focus-within:border-ink focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_60%,transparent)]"
              data-tour="list-search"
            >
              <Icon name="search" size={20} className="shrink-0 text-muted" />
              <span className="sr-only">Szukaj wydarzenia, sportu lub miasta</span>
              <input
                name="search"
                type="search"
                value={filters.search}
                onChange={(event) => setFilter('search', event.target.value)}
                placeholder="Szukaj wydarzenia, sportu lub miasta"
                className="min-h-[52px] min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-muted"
              />
            </label>
            <div>
              <label className="sr-only" htmlFor="discovery-status">Filtruj po statusie</label>
              <select id="discovery-status" name="status" value={filters.status} onChange={(event) => setFilter('status', event.target.value)} className="input !min-h-[55px]">
                <option value="">Wszystkie statusy</option>
                {Object.entries(TOURNAMENT_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
          </div>

          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Filtruj po dyscyplinie" data-tour="list-sports">
            <button type="button" className="pill" aria-pressed={!filters.sportType} onClick={() => setFilter('sportType', '')}>Wszystkie sporty</button>
            {FILTER_SPORTS.map(({ value, label }) => (
              <button key={value} type="button" className="pill" aria-pressed={filters.sportType === value} onClick={() => setFilter('sportType', filters.sportType === value ? '' : value)}>
                <Icon name={sportIcon(value)} size={17} />
                {label}
              </button>
            ))}
          </div>
        </Reveal>

        {!loading && !error && (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3" aria-live="polite">
            <p className="mono text-xs font-semibold uppercase tracking-[0.12em] text-muted">
              {visibleTournaments.length} {plural(visibleTournaments.length, 'wydarzenie', 'wydarzenia', 'wydarzeń')}
            </p>
            {hasFilters && (
              <button type="button" onClick={clearFilters} className="btn btn-quiet btn-sm">
                <Icon name="x" size={16} /> Wyczyść filtry
              </button>
            )}
          </div>
        )}

        {loading && (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" role="status" aria-label="Ładowanie wydarzeń">
            {[0, 1, 2, 3, 4, 5].map((item) => <div key={item} className="skeleton h-[290px]" />)}
          </div>
        )}

        {error && <Notice tone="danger">{error}</Notice>}

        {!loading && !error && visibleTournaments.length === 0 && (
          <EmptyState
            icon="search"
            title={tournaments.length || hasFilters ? 'Nic nie pasuje do tych filtrów' : 'Brak wydarzeń do wyświetlenia'}
            action={tournaments.length || hasFilters
              ? <button type="button" onClick={clearFilters} className="btn btn-solid">Pokaż wszystkie wydarzenia</button>
              : (canCreate || !user) && <Link to={canCreate ? '/tournaments/create' : '/register?role=ORGANIZER'} className="btn btn-primary">Zorganizuj wydarzenie <Arrow /></Link>}
          >
            {tournaments.length || hasFilters
              ? 'Zmień wyszukiwaną frazę albo usuń część filtrów.'
              : 'Wróć później albo zacznij organizować własne wydarzenie.'}
          </EmptyState>
        )}

        {!loading && !error && visibleTournaments.length > 0 && (
          <Reveal key={`${filters.sportType}-${filters.status}`} stagger={0.06} className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" data-tour="list-results">
            {visibleTournaments.map((tournament) => (
              <div key={tournament.id}><EventCard tournament={tournament} cta="Sprawdź szczegóły" /></div>
            ))}
          </Reveal>
        )}
      </div>
    </main>
  );
}
