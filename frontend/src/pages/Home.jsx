import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

const SPORT_OPTIONS = [
  { value: 'BEACH_VOLLEYBALL', label: 'Siatkówka plażowa', icon: '🏐' },
  { value: 'FOOTBALL_6V6', label: 'Piłka nożna 6v6', icon: '⚽' },
  { value: 'SOCCER', label: 'Piłka nożna', icon: '⚽' },
  { value: 'BASKETBALL', label: 'Koszykówka', icon: '🏀' },
  { value: 'VOLLEYBALL', label: 'Siatkówka', icon: '🏐' },
  { value: 'TENNIS', label: 'Tenis', icon: '🎾' },
  { value: 'ESPORTS', label: 'E-sport', icon: '🎮' },
  { value: 'CUSTOM', label: 'Inna dyscyplina', icon: '🏅' },
  { value: 'OTHER', label: 'Inne', icon: '🏅' },
];

const SPORT_LABELS = Object.fromEntries(SPORT_OPTIONS.map(({ value, label, icon }) => [value, `${icon} ${label}`]));

function EventCard({ tournament }) {
  const participants = tournament._count?.participants || 0;
  const capacity = Number(tournament.maxParticipants) || 0;
  const fill = capacity ? Math.min(100, Math.round((participants / capacity) * 100)) : 0;
  const date = new Date(tournament.date);

  return (
    <Link to={`/tournaments/${tournament.id}`} className="home-event-card">
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs font-semibold text-[var(--app-text-muted)]">{SPORT_LABELS[tournament.sportType] || '🏆 Wydarzenie sportowe'}</span>
        <span className="home-open-pill">Zapisy otwarte</span>
      </div>
      <h3 className="mt-5 text-xl font-bold tracking-tight text-[var(--app-text-strong)]">{tournament.title}</h3>
      <p className="mt-2 text-sm text-[var(--app-text-muted)]">
        {Number.isNaN(date.getTime()) ? 'Termin do ustalenia' : date.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })}
        {tournament.location && ` · ${tournament.location}`}
      </p>
      <div className="mt-6">
        <div className="mb-2 flex justify-between text-xs text-[var(--app-text-muted)]">
          <span>{participants} z {capacity || '—'} miejsc zajętych</span>
          <span>{capacity ? `${Math.max(capacity - participants, 0)} wolnych` : 'Sprawdź dostępność'}</span>
        </div>
        <div className="home-progress-track" aria-label={capacity ? `Zajęte ${fill}% miejsc` : 'Liczba miejsc nieustalona'}>
          <span style={{ width: `${fill}%` }} />
        </div>
      </div>
      <span className="home-accent-text mt-5 inline-flex items-center text-sm font-semibold">Zobacz wydarzenie <span className="ml-2" aria-hidden="true">→</span></span>
    </Link>
  );
}

function OrganizerHook({ user, canCreate }) {
  const [sport, setSport] = useState('SOCCER');
  const [participants, setParticipants] = useState(16);
  const rounds = Math.ceil(Math.log2(participants));
  const roundLabel = rounds === 1 ? 'runda' : rounds < 5 ? 'rundy' : 'rund';
  const previewSize = Math.min(participants, 8);

  return (
    <section id="organize" className="home-organizer-section">
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div>
          <p className="section-eyebrow">Dla organizatorów</p>
          <h2 className="mt-4 max-w-xl text-3xl font-bold tracking-[-0.045em] text-[var(--app-text-strong)] sm:text-5xl">
            Zorganizuj pierwsze wydarzenie w 3 minuty.
          </h2>
          <p className="mt-5 max-w-lg text-base leading-7 text-[var(--app-text-muted)]">
            Zacznij od kilku prostych informacji. Kreator przeprowadzi Cię przez format, zapisy i publikację — krok po kroku.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            {user && !canCreate ? (
              <p className="self-center text-sm text-[var(--app-text-muted)]">Wydarzenia tworzą organizatorzy. Poproś administratora o zmianę roli konta.</p>
            ) : (
              <Link
                to={canCreate
                  ? `/tournaments/create?sportType=${encodeURIComponent(sport)}&maxParticipants=${participants}`
                  : '/register?role=ORGANIZER'}
                className="primary-action"
              >
                Rozpocznij konfigurację <span aria-hidden="true">→</span>
              </Link>
            )}
          </div>
        </div>

        <div className="organizer-preview-card">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="section-eyebrow">Szybki podgląd</p>
              <h3 className="mt-2 text-xl font-bold text-[var(--app-text-strong)]">Zobacz, od czego zacząć</h3>
            </div>
            <span className="organizer-preview-icon" aria-hidden="true">✦</span>
          </div>
          <label className="mt-7 block text-sm font-semibold text-[var(--app-text-strong)]" htmlFor="home-sport">Dyscyplina</label>
          <select id="home-sport" value={sport} onChange={(event) => setSport(event.target.value)} className="home-control mt-2">
            {SPORT_OPTIONS.map(({ value, label, icon }) => <option key={value} value={value}>{icon} {label}</option>)}
          </select>
          <div className="mt-6 flex items-center justify-between gap-4">
            <label className="text-sm font-semibold text-[var(--app-text-strong)]" htmlFor="home-participants">Liczba uczestników</label>
            <output htmlFor="home-participants" className="text-lg font-bold tabular-nums text-[var(--app-text-strong)]">{participants}</output>
          </div>
          <input
            id="home-participants"
            className="home-range mt-3 w-full"
            type="range"
            min="8"
            max="64"
            step="8"
            value={participants}
            onChange={(event) => setParticipants(Number(event.target.value))}
            aria-label="Liczba uczestników"
          />
          <div className="mt-1 flex justify-between text-xs text-[var(--app-text-muted)]"><span>8 osób</span><span>64 osoby</span></div>

          <div className="bracket-preview mt-6" aria-live="polite" aria-label={`Orientacyjny podgląd drabinki dla ${participants} uczestników, ${rounds} rund`}>
            <div className="flex items-center justify-between gap-2 text-xs text-[var(--app-text-muted)]">
              <span>{SPORT_LABELS[sport]}</span>                            <span>{participants} uczestników · {rounds} {roundLabel}</span>
            </div>
            <div className="mt-5 flex items-center gap-3 overflow-hidden" aria-hidden="true">
              <div className="grid shrink-0 gap-2">
                {Array.from({ length: previewSize / 2 }, (_, index) => (
                  <span key={index} className="bracket-team">{index + 1}. Uczestnik</span>
                ))}
              </div>
              <span className="bracket-connector">·····</span>
              <div className="grid shrink-0 gap-3">
                {Array.from({ length: previewSize / 4 }, (_, index) => (
                  <span key={index} className="bracket-team bracket-team-next">Zwycięzca</span>
                ))}
              </div>
              <span className="bracket-connector">·····</span>
              <span className="bracket-team bracket-final">Finał</span>
            </div>
            <p className="mt-4 text-xs text-[var(--app-text-muted)]">To tylko podgląd — ustawienia możesz zmienić w kreatorze.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [featuredTournaments, setFeaturedTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [search, setSearch] = useState('');
  const canCreate = user?.role === 'ORGANIZER' || user?.role === 'ADMIN';

  useEffect(() => {
    let active = true;
    api.get('/tournaments', { params: { status: 'OPEN' } })
      .then((response) => {
        if (active) {
          setFeaturedTournaments(response.data.tournaments.slice(0, 6));
          setLoadError('');
        }
      })
      .catch(() => { if (active) setLoadError('Nie udało się pobrać wydarzeń. Sprawdź połączenie i spróbuj ponownie.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [loadAttempt]);

  useEffect(() => {
    if (!location.hash) return undefined;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(location.hash.slice(1))?.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'start',
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [location.hash]);

  const browseUrl = search.trim() ? `/tournaments?search=${encodeURIComponent(search.trim())}` : '/tournaments';

  return (
    <main className="home-page">
      <section className="home-hero">
        <div className="home-hero-glow" aria-hidden="true" />
        <div className="mx-auto max-w-6xl px-4 pb-20 pt-16 text-center sm:px-6 sm:pb-24 sm:pt-24">
          <p className="section-eyebrow">Wszystko zaczyna się od gry</p>
          <h1 className="mx-auto mt-5 max-w-4xl text-5xl font-bold tracking-[-0.065em] text-[var(--app-text-strong)] sm:text-7xl">
            Znajdź swoją grę.<br /><span className="home-accent-text">Stwórz własne wydarzenie.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-[var(--app-text-muted)] sm:text-lg">
            Odkrywaj turnieje, zapisuj się i śledź rozgrywki. A jeśli organizujesz — poprowadzimy Cię od pomysłu aż do publikacji.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link to="/tournaments" className="primary-action">Znajdź turniej <span aria-hidden="true">→</span></Link>
            <a href="#organize" className="secondary-action">Organizuję wydarzenie</a>
          </div>

          <form className="spotlight-search mx-auto mt-12" onSubmit={(event) => { event.preventDefault(); navigate(browseUrl); }}>
            <span className="spotlight-icon" aria-hidden="true">⌕</span>
            <label className="sr-only" htmlFor="event-search">Szukaj wydarzenia, sportu lub miasta</label>
            <input id="event-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Szukaj wydarzenia, sportu lub miasta" />
            <button type="submit">Szukaj</button>
          </form>
        </div>
      </section>

      <section id="events" className="home-events-section">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="section-eyebrow">Dołącz do gry</p>
              <h2 className="mt-3 text-3xl font-bold tracking-[-0.04em] text-[var(--app-text-strong)] sm:text-4xl">Wydarzenia z otwartymi zapisami</h2>
              <p className="mt-3 text-sm text-[var(--app-text-muted)]">Sprawdź termin, wolne miejsca i szczegóły przed zapisem.</p>
            </div>
            <Link to="/tournaments" className="subtle-link">Wszystkie wydarzenia <span aria-hidden="true">→</span></Link>
          </div>
          {loading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Ładowanie wydarzeń">
              {[0, 1, 2].map((item) => <div key={item} className="home-event-skeleton" />)}
            </div>
          ) : loadError ? (
            <div className="home-empty-state" role="alert">
              <p className="text-sm text-[var(--app-text-muted)]">{loadError}</p>
              <button type="button" onClick={() => { setLoading(true); setLoadAttempt((attempt) => attempt + 1); }} className="subtle-link mt-4">Spróbuj ponownie</button>
            </div>
          ) : featuredTournaments.length ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {featuredTournaments.map((tournament) => <EventCard key={tournament.id} tournament={tournament} />)}
            </div>
          ) : (
            <div className="home-empty-state">
              <p className="text-lg font-semibold text-[var(--app-text-strong)]">Na razie brak otwartych zapisów</p>
              <p className="mt-2 text-sm text-[var(--app-text-muted)]">Wróć wkrótce albo sprawdź wszystkie opublikowane wydarzenia.</p>
              <Link to="/tournaments" className="subtle-link mt-4">Przeglądaj wydarzenia <span aria-hidden="true">→</span></Link>
            </div>
          )}
        </div>
      </section>

      <OrganizerHook user={user} canCreate={canCreate} />

      <section className="home-steps-section">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <p className="section-eyebrow">Bez zbędnych kroków</p>
          <h2 className="mt-3 text-3xl font-bold tracking-[-0.04em] text-[var(--app-text-strong)] sm:text-4xl">Od pomysłu do gry</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              ['01', 'Znajdź wydarzenie', 'Wyszukaj dyscyplinę i sprawdź dostępne miejsca.'],
              ['02', 'Poznaj szczegóły', 'Zobacz termin, zasady i format przed podjęciem decyzji.'],
              ['03', 'Dołącz do gry', 'Zapisz się i miej wydarzenie oraz mecze w jednym miejscu.'],
            ].map(([number, title, description]) => (
              <article className="home-step-card" key={number}>
                <span className="home-step-number">{number}</span>
                <h3 className="mt-5 text-lg font-semibold text-[var(--app-text-strong)]">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--app-text-muted)]">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <footer className="home-footer">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-7 text-xs text-[var(--app-text-muted)] sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span className="font-semibold text-[var(--app-text-strong)]">TourniDesk</span>
          <span>Turnieje, zapisy i rozgrywki — w jednym miejscu.</span>
        </div>
      </footer>
    </main>
  );
}
