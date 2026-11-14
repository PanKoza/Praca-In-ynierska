import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { gsap, prefersReducedMotion, scrollToTarget, useGSAP } from '../lib/motion';
import { ROLE_HOME, SPORTS, plural, sportIcon } from '../lib/labels';
import BracketPreview from '../components/BracketPreview';
import CourtLines from '../components/CourtLines';
import DemoScoreboard from '../components/DemoScoreboard';
import EventCard from '../components/EventCard';
import Icon from '../components/Icon';
import Reveal from '../components/Reveal';
import { useTour } from '../components/Tour';
import { Arrow, EmptyState, Notice, Tabs } from '../components/ui';
import Magnet from '../components/reactbits/Magnet';
import RotatingText from '../components/reactbits/RotatingText';
import ScrollVelocity from '../components/reactbits/ScrollVelocity';
import SplitText from '../components/reactbits/SplitText';

const ROTATING_SPORTS = ['piłki nożnej', 'siatkówki', 'koszykówki', 'tenisa', 'e-sportu'];
const PLAYGROUND_SPORTS = SPORTS.filter(({ value }) => value !== 'OTHER');

const HOME_TOUR = [
  { target: '[data-tour="home-paths"]', title: 'Zacznij od wyboru', body: 'Powiedz nam, po co przychodzisz — grać, organizować czy sędziować. Każda ścieżka prowadzi prosto do właściwego miejsca.' },
  { target: '[data-tour="home-search"]', title: 'Albo po prostu szukaj', body: 'Wpisz nazwę wydarzenia, dyscyplinę lub miasto. Wyniki zobaczysz od razu na liście wydarzeń.' },
  { target: '[data-tour="home-how"]', title: 'Trzy kroki dla każdej roli', body: 'Tutaj sprawdzisz, jak wygląda cała droga zawodnika, organizatora i sędziego — bez czytania instrukcji.' },
  { target: '[data-tour="home-events"]', title: 'Otwarte zapisy', body: 'Wydarzenia, do których można dołączyć już teraz. Kliknij kartę, aby zobaczyć szczegóły i się zapisać.' },
];

const ROLE_TABS = [
  { id: 'PLAYER', label: 'Gram', icon: 'user' },
  { id: 'ORGANIZER', label: 'Organizuję', icon: 'bracket' },
  { id: 'REFEREE', label: 'Sędziuję', icon: 'whistle' },
];

const ROLE_STEPS = {
  PLAYER: [
    { icon: 'search', title: 'Znajdź wydarzenie', body: 'Wyszukaj dyscyplinę lub miasto i sprawdź termin oraz wolne miejsca.' },
    { icon: 'check', title: 'Zapisz się jednym kliknięciem', body: 'Załóż konto zawodnika — po rejestracji od razu trafisz na listę uczestników.' },
    { icon: 'bolt', title: 'Graj i śledź wyniki', body: 'W panelu zawodnika zobaczysz najbliższy mecz, przeciwnika i wynik na żywo.' },
  ],
  ORGANIZER: [
    { icon: 'edit', title: 'Opisz wydarzenie', body: 'Kreator w czterech krokach zapyta o termin, format i zasady. Szkic zapisuje się sam.' },
    { icon: 'users', title: 'Opublikuj i zbieraj zapisy', body: 'Po publikacji zawodnicy zapisują się sami, a Ty widzisz listę zgłoszeń.' },
    { icon: 'bracket', title: 'Wygeneruj harmonogram', body: 'Jedno kliknięcie tworzy mecze. Potem przydzielasz sędziów i śledzisz wyniki.' },
  ],
  REFEREE: [
    { icon: 'user', title: 'Załóż konto sędziego', body: 'Podaj organizatorowi swoją nazwę użytkownika — po niej przydzieli Ci mecz.' },
    { icon: 'list', title: 'Otwórz przydzielony mecz', body: 'W panelu sędziego czeka lista Twoich spotkań z terminem i boiskiem.' },
    { icon: 'whistle', title: 'Prowadź wynik na żywo', body: 'Duże przyciski, zegar i kartki. Działa także bez internetu — zsynchronizuje się później.' },
  ],
};

function roleAction(role, user, canCreate) {
  if (role === 'PLAYER') {
    return { to: '/tournaments', label: 'Przeglądaj wydarzenia' };
  }
  if (role === 'ORGANIZER') {
    if (canCreate) return { to: '/tournaments/create', label: 'Otwórz kreator' };
    if (user) return null;
    return { to: '/register?role=ORGANIZER', label: 'Załóż konto organizatora' };
  }
  if (user?.role === 'REFEREE') return { to: '/referee', label: 'Przejdź do moich meczów' };
  if (user) return null;
  return { to: '/register?role=REFEREE', label: 'Załóż konto sędziego' };
}

function HowItWorks({ user, canCreate }) {
  const [role, setRole] = useState(user?.role === 'ORGANIZER' || user?.role === 'ADMIN' ? 'ORGANIZER' : user?.role === 'REFEREE' ? 'REFEREE' : 'PLAYER');
  const stepsRef = useRef(null);
  const action = roleAction(role, user, canCreate);

  useGSAP(() => {
    if (prefersReducedMotion()) return;
    gsap.timeline()
      .fromTo('.how-step', { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.6, ease: 'expo.out', stagger: 0.09 })
      .fromTo('.how-line', { scaleX: 0, transformOrigin: 'left center' }, { scaleX: 1, duration: 0.9, ease: 'power3.inOut' }, 0.05)
      .fromTo('.how-num', { scale: 0.4, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.5, ease: 'back.out(2.4)', stagger: 0.09 }, 0.1);
  }, { dependencies: [role], scope: stepsRef });

  return (
    <section id="how" className="border-t border-line bg-surface py-16 sm:py-24">
      <div className="shell">
        <Reveal className="mb-8 max-w-3xl">
          <p className="eyebrow mb-4">Jak to działa</p>
          <h2 className="display text-[clamp(2.4rem,6vw,4.5rem)]">Trzy kroki. <span className="text-muted">Bez instrukcji.</span></h2>
          <p className="lede mt-4">Wybierz swoją rolę, a pokażemy Ci całą drogę — od pierwszego kliknięcia do końcowego gwizdka.</p>
        </Reveal>

        <div data-tour="home-how">
          <Tabs tabs={ROLE_TABS} value={role} onChange={setRole} label="Wybierz rolę" />

          <div ref={stepsRef} className="relative mt-10">
            <div className="how-line absolute left-0 right-0 top-[27px] hidden h-px bg-line-2 md:block" aria-hidden="true" />
            <ol className="grid gap-8 md:grid-cols-3 md:gap-6">
              {ROLE_STEPS[role].map((step, index) => (
                <li key={step.title} className="how-step relative">
                  <span className="how-num relative z-[1] grid h-14 w-14 place-items-center rounded-full border-[1.5px] border-ink bg-accent font-display text-2xl font-extrabold text-accent-ink">
                    {index + 1}
                  </span>
                  <h3 className="h-card mt-5 flex items-center gap-2.5">
                    <Icon name={step.icon} size={20} className="shrink-0 text-muted" />
                    {step.title}
                  </h3>
                  <p className="mt-2 max-w-sm text-[0.9375rem] leading-relaxed text-muted">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            {action ? (
              <Link to={action.to} className="btn btn-solid btn-lg">{action.label} <Arrow /></Link>
            ) : (
              <p className="text-sm text-muted">
                Ta ścieżka wymaga innego typu konta. Twoje konto prowadzi do{' '}
                <Link to={ROLE_HOME[user.role]} className="link">swojego panelu</Link>.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function OrganizerPlayground({ user, canCreate }) {
  const [sport, setSport] = useState('SOCCER');
  const [participants, setParticipants] = useState(16);
  const rounds = Math.ceil(Math.log2(participants));
  const matches = participants - 1;

  return (
    <section id="organize" className="border-t border-line py-16 sm:py-24">
      <div className="shell grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
        <Reveal>
          <p className="eyebrow mb-4">Dla organizatorów</p>
          <h2 className="display text-[clamp(2.4rem,6vw,4.5rem)]">Pierwszy turniej <span className="marker">w 3 minuty.</span></h2>
          <p className="lede mt-5 max-w-lg">
            Pobaw się suwakiem — zobaczysz, jak będzie wyglądać drabinka. Gdy klikniesz dalej, kreator zapamięta Twój wybór i poprowadzi Cię przez resztę.
          </p>
          <ul className="mt-6 grid gap-2.5 text-[0.9375rem] text-body">
            {['Szkic zapisuje się automatycznie', 'Harmonogram generuje się jednym kliknięciem', 'Wyniki na żywo widzą wszyscy uczestnicy'].map((item) => (
              <li key={item} className="flex items-center gap-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ink text-bg"><Icon name="check" size={14} strokeWidth={2.5} /></span>
                {item}
              </li>
            ))}
          </ul>
          <div className="mt-8">
            {user && !canCreate ? (
              <Notice>Wydarzenia tworzą organizatorzy. Poproś administratora o zmianę roli konta.</Notice>
            ) : (
              <Link
                to={canCreate
                  ? `/tournaments/create?sportType=${encodeURIComponent(sport)}&maxParticipants=${participants}`
                  : '/register?role=ORGANIZER'}
                className="btn btn-primary btn-lg"
              >
                {canCreate ? 'Przejdź do kreatora' : 'Załóż konto i zacznij'} <Arrow />
              </Link>
            )}
          </div>
        </Reveal>

        <Reveal delay={0.1} className="card card-pad">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="eyebrow eyebrow-plain mb-1.5">Wypróbuj</p>
              <h3 className="h-card">Zaprojektuj drabinkę</h3>
            </div>
            <span className="chip" data-tone="accent">Podgląd</span>
          </div>

          <fieldset className="mt-6">
            <legend className="label">1. Wybierz dyscyplinę</legend>
            <div className="flex flex-wrap gap-2">
              {PLAYGROUND_SPORTS.map(({ value, label }) => (
                <button key={value} type="button" className="pill" aria-pressed={sport === value} onClick={() => setSport(value)}>
                  <Icon name={sportIcon(value)} size={17} />
                  {label}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="mt-6">
            <div className="flex items-end justify-between gap-4">
              <label className="label !mb-0" htmlFor="home-participants">2. Ustaw liczbę uczestników</label>
              <output htmlFor="home-participants" className="num text-5xl">{participants}</output>
            </div>
            <input
              id="home-participants"
              className="range mt-2"
              type="range"
              min="8"
              max="64"
              step="8"
              value={participants}
              onChange={(event) => setParticipants(Number(event.target.value))}
              style={{ '--fill': `${((participants - 8) / 56) * 100}%` }}
            />
            <div className="mono mt-1 flex justify-between text-xs text-muted"><span>8</span><span>64</span></div>
          </div>

          <div className="well mt-6 p-4 sm:p-5" aria-live="polite">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="chip"><Icon name="bracket" size={13} />{rounds} {plural(rounds, 'runda', 'rundy', 'rund')}</span>
              <span className="chip">{matches} {plural(matches, 'mecz', 'mecze', 'meczów')}</span>
            </div>
            <BracketPreview participants={participants} />
          </div>
          <p className="hint">To tylko podgląd pojedynczej eliminacji — format i limit zmienisz w kreatorze.</p>
        </Reveal>
      </div>
    </section>
  );
}

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const heroRef = useRef(null);
  const [featuredTournaments, setFeaturedTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [search, setSearch] = useState('');
  const canCreate = user?.role === 'ORGANIZER' || user?.role === 'ADMIN';

  useTour('home', HOME_TOUR);

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
      const target = document.getElementById(location.hash.slice(1));
      if (target) scrollToTarget(target, { offset: -72 });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [location.hash, location.key]);

  useGSAP(() => {
    if (prefersReducedMotion()) return;
    gsap.timeline({ defaults: { ease: 'expo.out' } })
      .fromTo('.hero-rise', { autoAlpha: 0, y: 34 }, { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.08, delay: 0.35 })
      .fromTo('.hero-board', { autoAlpha: 0, x: 70, rotate: 3 }, { autoAlpha: 1, x: 0, rotate: 0, duration: 1.2 }, 0.5);
    gsap.to('.hero-board', {
      yPercent: -10,
      ease: 'none',
      scrollTrigger: { trigger: heroRef.current, start: 'top top', end: 'bottom top', scrub: 0.5 },
    });
  }, { scope: heroRef });

  const browseUrl = search.trim() ? `/tournaments?search=${encodeURIComponent(search.trim())}` : '/tournaments';
  const refereeTarget = user?.role === 'REFEREE' ? '/referee' : user ? '/#how' : '/register?role=REFEREE';

  return (
    <main>
      <section ref={heroRef} className="relative isolate overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10 opacity-[0.13] [mask-image:linear-gradient(to_bottom,black_55%,transparent)]">
          <CourtLines className="h-full w-full" />
        </div>

        <div className="shell grid gap-12 pb-16 pt-12 sm:pt-16 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:pb-24 lg:pt-20">
          <div>
            <p className="eyebrow hero-rise mb-6">Turnieje · zapisy · wyniki na żywo</p>
            <h1 className="hero-title">
              <SplitText text="Twój turniej" tag="span" className="!block" textAlign="left" splitType="chars" effect="skew" trigger="load" delay={22} duration={1} />
              <span className="hero-rise block py-[0.04em]">
                <RotatingText
                  texts={ROTATING_SPORTS}
                  highlight
                  highlightColor="var(--accent)"
                  style={{ color: 'var(--accent-ink)' }}
                  mainClassName="hero-rotator"
                  effect="slide"
                  staggerDuration={0.018}
                  rotationInterval={2600}
                />
              </span>
              <SplitText text="zaczyna się tu." tag="span" className="!block" textAlign="left" splitType="chars" effect="skew" trigger="load" delay={22} duration={1} />
            </h1>
            <p className="lede hero-rise mt-7 max-w-xl">
              Odkrywaj turnieje, zapisuj się i śledź wyniki na żywo. Organizujesz? Kreator poprowadzi Cię od pomysłu do pierwszego gwizdka.
            </p>

            <div className="hero-rise mt-9" data-tour="home-paths">
              <p className="mono mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted">Co chcesz zrobić?</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <Magnet padding={50} magnetStrength={6} wrapperClassName="!block" innerClassName="h-full">
                  <Link to="/tournaments" className="path-card h-full" data-primary="true">
                    <Icon name="search" size={24} />
                    <span>
                      <span className="path-title">Chcę zagrać</span>
                      <span className="path-note">Znajdź turniej i zapisz się</span>
                    </span>
                    <Icon name="arrow-right" size={20} />
                  </Link>
                </Magnet>
                <Link to={canCreate ? '/tournaments/create' : '/#organize'} className="path-card">
                  <Icon name="bracket" size={24} />
                  <span>
                    <span className="path-title">Organizuję</span>
                    <span className="path-note">Kreator krok po kroku</span>
                  </span>
                  <Icon name="arrow-right" size={20} />
                </Link>
                <Link to={refereeTarget} className="path-card">
                  <Icon name="whistle" size={24} />
                  <span>
                    <span className="path-title">Sędziuję</span>
                    <span className="path-note">Wynik na żywo z telefonu</span>
                  </span>
                  <Icon name="arrow-right" size={20} />
                </Link>
              </div>
            </div>

            <form
              className="hero-rise mt-4 flex items-center gap-2 rounded-[14px] border-[1.5px] border-line-2 bg-raised p-1.5 pl-4 transition focus-within:border-ink focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_60%,transparent)]"
              data-tour="home-search"
              role="search"
              onSubmit={(event) => { event.preventDefault(); navigate(browseUrl); }}
            >
              <Icon name="search" size={20} className="shrink-0 text-muted" />
              <label className="sr-only" htmlFor="event-search">Szukaj wydarzenia, sportu lub miasta</label>
              <input
                id="event-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Szukaj wydarzenia, sportu lub miasta"
                className="min-h-11 min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-muted"
              />
              <button type="submit" className="btn btn-solid btn-sm !min-h-11">Szukaj</button>
            </form>

            {user && (
              <p className="hero-rise mt-5 text-sm text-muted">
                Cześć, <strong className="text-ink">{user.name}</strong>. Twoje sprawy czekają w{' '}
                <Link to={ROLE_HOME[user.role]} className="link">panelu <Icon name="arrow-right" size={15} /></Link>
              </p>
            )}
          </div>

          <div className="hero-board relative lg:pl-4">
            <DemoScoreboard />
            <p className="mt-3 flex items-center gap-2 text-[0.8125rem] text-muted">
              <Icon name="eye" size={16} /> Tak kibice i zawodnicy widzą wynik w trakcie meczu.
            </p>
          </div>
        </div>

        <div className="marquee-band" aria-hidden="true">
          <ScrollVelocity
            texts={['Piłka nożna / Siatkówka / Koszykówka / Tenis / E-sport', 'Zapisy / Drabinki / Harmonogram / Wyniki na żywo / Tabele']}
            velocity={38}
            numCopies={5}
            separator="/"
            gap={28}
            outlineAlternate
            velocityMapping={{ input: [0, 1000], output: [0, 3] }}
          />
        </div>
      </section>

      <HowItWorks key={user?.id || 'guest'} user={user} canCreate={canCreate} />

      <section id="events" className="border-t border-line py-16 sm:py-24">
        <div className="shell">
          <Reveal className="mb-9 flex flex-wrap items-end justify-between gap-5">
            <div className="max-w-2xl">
              <p className="eyebrow mb-4">Dołącz do gry</p>
              <h2 className="display text-[clamp(2.4rem,6vw,4.5rem)]">Zapisy otwarte</h2>
              <p className="lede mt-4">Sprawdź termin, wolne miejsca i szczegóły, zanim się zapiszesz.</p>
            </div>
            <Link to="/tournaments" className="btn btn-ghost">Wszystkie wydarzenia <Arrow /></Link>
          </Reveal>

          <div data-tour="home-events">
            {loading ? (
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3" aria-label="Ładowanie wydarzeń" role="status">
                {[0, 1, 2].map((item) => <div key={item} className="skeleton h-[290px]" />)}
              </div>
            ) : loadError ? (
              <Notice
                tone="danger"
                action={<button type="button" onClick={() => { setLoading(true); setLoadAttempt((attempt) => attempt + 1); }} className="btn btn-ghost btn-sm shrink-0">Spróbuj ponownie</button>}
              >
                {loadError}
              </Notice>
            ) : featuredTournaments.length ? (
              <Reveal stagger={0.08} className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {featuredTournaments.map((tournament) => <div key={tournament.id}><EventCard tournament={tournament} /></div>)}
              </Reveal>
            ) : (
              <EmptyState
                icon="calendar"
                title="Na razie brak otwartych zapisów"
                action={<Link to="/tournaments" className="btn btn-ghost">Przeglądaj wszystkie wydarzenia <Arrow /></Link>}
              >
                Wróć wkrótce albo sprawdź wszystkie opublikowane wydarzenia.
              </EmptyState>
            )}
          </div>
        </div>
      </section>

      <OrganizerPlayground user={user} canCreate={canCreate} />

      <section className="bg-accent py-16 text-accent-ink sm:py-20">
        <Reveal className="shell flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <h2 className="font-display text-[clamp(2.8rem,8vw,6.5rem)] font-extrabold uppercase leading-[0.88]">
            Gotowi na<br />pierwszy gwizdek?
          </h2>
          <div className="flex flex-wrap gap-3">
            <Link to="/tournaments" className="btn btn-lg border-accent-ink bg-accent-ink text-accent hover:bg-transparent hover:text-accent-ink">Znajdź turniej <Arrow /></Link>
            {!user && <Link to="/register" className="btn btn-lg border-accent-ink text-accent-ink hover:bg-accent-ink hover:text-accent">Załóż konto</Link>}
          </div>
        </Reveal>
      </section>
    </main>
  );
}
