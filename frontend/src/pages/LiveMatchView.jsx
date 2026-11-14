import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api/axios';
import { gsap, prefersReducedMotion, useGSAP } from '../lib/motion';
import { formatDateTime } from '../lib/labels';
import CourtLines from '../components/CourtLines';
import Icon from '../components/Icon';
import Counter from '../components/reactbits/Counter';
import { BackLink, FullPageLoader, Notice, StatusChip } from '../components/ui';

function Side({ name, score, extraTime, penalties, winner, align }) {
  return (
    <div className={`live-side min-w-0 ${align === 'right' ? 'text-right' : 'text-left'} max-sm:text-center`}>
      <p className={`flex min-h-[3.2rem] items-end gap-2 break-words font-display text-[clamp(1.3rem,3.4vw,2.4rem)] font-bold uppercase leading-none text-ink max-sm:justify-center ${align === 'right' ? 'justify-end' : ''}`}>
        {winner && <Icon name="trophy" size={22} className="mb-0.5 shrink-0" />}
        <span className="min-w-0">{name}</span>
      </p>
      <div className="score-digits mt-3">
        <Counter value={score} fontSize="clamp(5.5rem, 19vw, 13rem)" fontWeight={800} duration={0.7} fade={0.1} />
      </div>
      {extraTime > 0 && <p className="mono mt-2 text-xs text-muted">Dogrywka: {extraTime}</p>}
      {penalties !== null && penalties !== undefined && <p className="mono mt-1 text-xs text-muted">Karne: {penalties}</p>}
    </div>
  );
}

export default function LiveMatchView() {
  const { tournamentId, matchId } = useParams();
  const boardRef = useRef(null);
  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);

  const loadMatch = useCallback(async () => {
    try {
      const { data } = await api.get(`/tournaments/${tournamentId}/matches`);
      const current = data.matches.find((item) => item.id === matchId);
      if (!current) {
        setError('Nie znaleziono tego meczu w wydarzeniu.');
        return;
      }
      setMatch((previous) => (
        previous && (previous.revision ?? 0) > (current.revision ?? 0)
          ? previous
          : { ...previous, ...current }
      ));
      setError('');
    } catch (loadError) {
      setError(loadError.response?.data?.message || 'Nie udało się pobrać wyniku meczu.');
    } finally {
      setLoading(false);
    }
  }, [matchId, tournamentId]);

  useEffect(() => {
    const timeout = window.setTimeout(() => { void loadMatch(); }, 0);
    return () => window.clearTimeout(timeout);
  }, [loadMatch]);

  useEffect(() => {
    const source = new EventSource(`${api.defaults.baseURL}/tournaments/${tournamentId}/live-events`);
    source.addEventListener('connected', () => setConnected(true));
    source.addEventListener('match-updated', (event) => {
      try {
        const update = JSON.parse(event.data);
        if (update.matchId === matchId && update.match) {
          setMatch((current) => ({ ...current, ...update.match }));
        } else if (update.matchId === matchId || update.type === 'SCHEDULE_GENERATED') {
          void loadMatch();
        }
      } catch {
        setError('Otrzymano nieprawidłową aktualizację wyniku. Odśwież widok meczu.');
      }
    });
    source.onerror = () => setConnected(false);
    return () => source.close();
  }, [loadMatch, matchId, tournamentId]);

  const score1 = match?.score1 ?? 0;
  const score2 = match?.score2 ?? 0;
  const hasMatch = Boolean(match);

  useGSAP(() => {
    if (!hasMatch || prefersReducedMotion()) return;
    gsap.timeline({ defaults: { ease: 'expo.out' } })
      .fromTo(boardRef.current, { autoAlpha: 0, y: 30, scale: 0.98 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.9 })
      .fromTo('.live-side', { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.8, stagger: 0.12 }, 0.2);
  }, { dependencies: [hasMatch] });

  /* A short flash behind the scoreboard tells viewers that the score has just changed. */
  const scoreKey = `${score1}:${score2}`;
  const previousScore = useRef(null);
  useGSAP(() => {
    if (!hasMatch) return;
    if (previousScore.current !== null && previousScore.current !== scoreKey && !prefersReducedMotion()) {
      gsap.fromTo('.live-flash', { opacity: 0.55 }, { opacity: 0, duration: 1.1, ease: 'power2.out' });
    }
    previousScore.current = scoreKey;
  }, { dependencies: [scoreKey, hasMatch], scope: boardRef });

  if (loading) return <FullPageLoader label="Ładowanie wyniku meczu…" />;

  if (!match) {
    return (
      <main className="page">
        <div className="shell-narrow grid gap-5">
          <Notice tone="danger">{error || 'Nie znaleziono meczu.'}</Notice>
          <div><Link to={`/tournaments/${tournamentId}`} className="btn btn-ghost"><Icon name="arrow-left" size={18} /> Wróć do wydarzenia</Link></div>
        </div>
      </main>
    );
  }

  const finished = match.status === 'FINISHED';
  const live = match.status === 'IN_PROGRESS';

  return (
    <main className="page">
      <div className="shell">
        <BackLink to={`/tournaments/${tournamentId}`}>Wróć do wydarzenia</BackLink>

        <section ref={boardRef} className="scoreboard" aria-label="Wynik meczu">
          <div className="live-flash pointer-events-none absolute inset-0 bg-accent opacity-0" aria-hidden="true" />
          <div className="pointer-events-none absolute inset-0 opacity-[0.07]" aria-hidden="true">
            <CourtLines className="h-full w-full" parallax={false} />
          </div>

          <header className="scoreboard-head relative">
            <div className="min-w-0">
              <h1 className="h-card truncate">{match.tournament?.title || 'Podgląd na żywo'}</h1>
              <p className="mono mt-1.5 text-xs text-muted">
                Runda {match.round}{match.groupKey ? ` · ${match.groupKey}` : ''}{match.court ? ` · ${match.court}` : ''}
                {match.scheduledAt ? ` · ${formatDateTime(match.scheduledAt, { month: 'long' })}` : ''}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="chip" data-tone={connected ? 'ok' : 'warn'}>
                <Icon name={connected ? 'wifi' : 'wifi-off'} size={13} />
                {connected ? 'Połączono' : 'Łączenie…'}
              </span>
              <StatusChip status={match.status} kind="match" />
            </div>
          </header>

          <div className="relative px-4 py-10 sm:px-10 sm:py-16">
            {error && <Notice tone="warn" className="mb-6">{error}</Notice>}
            <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3 sm:gap-8" aria-live="polite">
              <Side
                name={match.player1?.name || 'Oczekuje na awans'}
                score={score1}
                extraTime={match.extraTimeScore1}
                penalties={match.penaltyScore1}
                winner={Boolean(match.winnerId) && match.winnerId === match.player1Id}
                align="right"
              />
              <span className="score-digits pb-[0.12em] text-[clamp(3rem,10vw,7rem)] text-muted" aria-hidden="true">:</span>
              <Side
                name={match.player2?.name || 'Oczekuje na awans'}
                score={score2}
                extraTime={match.extraTimeScore2}
                penalties={match.penaltyScore2}
                winner={Boolean(match.winnerId) && match.winnerId === match.player2Id}
                align="left"
              />
            </div>
            {match.winnerId && (
              <p className="mt-10 text-center">
                <span className="marker font-display text-2xl font-bold uppercase tracking-[0.03em]">
                  Zwycięzca: {match.winnerId === match.player1Id ? match.player1?.name : match.player2?.name}
                </span>
              </p>
            )}
          </div>

          <footer className="relative flex items-center justify-center gap-2 border-t border-line px-5 py-3.5 text-center text-[0.8125rem] text-muted">
            <Icon name={finished ? 'check' : live ? 'bolt' : 'clock'} size={16} className="shrink-0" />
            {finished
              ? 'Mecz zakończony — to jest wynik końcowy.'
              : live
                ? 'Nie musisz odświeżać strony — wynik zmienia się sam, gdy sędzia zapisuje zdarzenia.'
                : 'Mecz jeszcze się nie rozpoczął. Zostaw tę stronę otwartą — wynik pojawi się automatycznie.'}
          </footer>
        </section>
      </div>
    </main>
  );
}
