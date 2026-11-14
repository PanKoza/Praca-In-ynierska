import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, useLocation, useParams, useSearchParams } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import {
  cacheMatch,
  enqueueMatchCommand,
  readCachedMatch,
  readMatchCommands,
  removeMatchCommand,
} from '../api/offlineMatchQueue';
import { gsap, prefersReducedMotion, useGSAP } from '../lib/motion';
import { useThemeName } from '../lib/theme';
import Icon from '../components/Icon';
import { useTour } from '../components/Tour';
import ClickSpark from '../components/reactbits/ClickSpark';
import Counter from '../components/reactbits/Counter';
import { BackLink, FullPageLoader, Notice } from '../components/ui';

const AUTHORIZATION = (token) => ({ Authorization: `Bearer ${token}` });
const TOUR = [
  { target: '[data-tour="ref-clock"]', title: 'Zacznij od startu', body: 'Naciśnij „Start meczu”, gdy drużyny są gotowe. Zegar ruszy, a kibice zobaczą, że mecz trwa.' },
  { target: '[data-tour="ref-score"]', title: 'Punkty jednym dotknięciem', body: 'Duży przycisk +1 dodaje punkt stronie A lub B. Mniejszy −1 poprawia pomyłkę.' },
  { target: '[data-tour="ref-cards"]', title: 'Kartki', body: 'Wybierz zawodnika z listy i dotknij żółtej lub czerwonej kartki.' },
  { target: '[data-tour="ref-undo"]', title: 'Zawsze możesz cofnąć', body: '„Cofnij” usuwa ostatnie zdarzenie, „Ponów” je przywraca. Nic nie ginie — wszystko jest w historii.' },
  { target: '[data-tour="ref-finish"]', title: 'Na koniec zatwierdź wynik', body: 'Po ostatnim gwizdku naciśnij „Zakończ mecz” i potwierdź. Wynik trafi do tabeli i drabinki.' },
];

function applyOptimistic(match, command) {
  const next = { ...match, revision: match.revision + 1 };
  if (command.type === 'MATCH_STARTED') {
    next.status = 'IN_PROGRESS';
    next.clockRunning = true;
    next.clockStartedAt = new Date().toISOString();
  } else if (command.type === 'SCORE_CHANGED') {
    const prefix = command.data.period === 'extraTime' ? 'extraTimeScore' : 'score';
    const field = `${prefix}${command.data.side}`;
    next[field] = Math.max(0, (next[field] || 0) + command.data.delta);
    if (next.status === 'SCHEDULED') next.status = 'IN_PROGRESS';
  } else if (command.type === 'SCORE_SET') {
    next.score1 = command.data.score1;
    next.score2 = command.data.score2;
    next.status = 'IN_PROGRESS';
  } else if (command.type === 'PERIOD_CHANGED') {
    next.period = command.data.period;
  } else if (command.type === 'CLOCK_CHANGED') {
    if (command.data.action === 'START') {
      next.clockRunning = true;
      next.clockStartedAt = new Date().toISOString();
    } else if (command.data.action === 'PAUSE') {
      next.clockSeconds = elapsedClock(match, Date.now());
      next.clockRunning = false;
      next.clockStartedAt = null;
    } else {
      next.clockSeconds = command.data.seconds;
    }
  } else if (command.type === 'MATCH_COMPLETED') {
    Object.assign(next, command.data, { status: 'FINISHED', clockRunning: false, clockStartedAt: null });
  }
  return next;
}

function applyPending(match, commands) {
  return commands.reduce(applyOptimistic, match);
}

function formatClock(match, now) {
  const seconds = elapsedClock(match, now);
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`;
}

function elapsedClock(match, now) {
  return (match.clockSeconds || 0)
    + (match.clockRunning && match.clockStartedAt
      ? Math.max(0, Math.floor((now - new Date(match.clockStartedAt).getTime()) / 1000))
      : 0);
}

function requiresPenaltyDecision(match) {
  return match.tournament?.format === 'SINGLE_ELIMINATION'
    || match.tournament?.format === 'DOUBLE_ELIMINATION'
    || (match.tournament?.format === 'GROUP_STAGE' && !match.groupKey);
}

export default function RefereePanel() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const [accessToken] = useState(() => (
    searchParams.get('access') || sessionStorage.getItem(`tourniDesk.referee.${id}`) || ''
  ));
  const [match, setMatch] = useState(null);
  const [pending, setPending] = useState([]);
  const [online, setOnline] = useState(navigator.onLine);
  const [now, setNow] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [syncMessage, setSyncMessage] = useState('');
  const [finishing, setFinishing] = useState(false);
  const [extraTime, setExtraTime] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [penalties, setPenalties] = useState({ penaltyScore1: 0, penaltyScore2: 0 });
  const [clockCorrection, setClockCorrection] = useState(null);
  const confirmedMatch = useRef(null);
  const queuedCommands = useRef([]);
  const syncing = useRef(false);
  const rootRef = useRef(null);
  const theme = useThemeName();
  const matchStatus = match?.status;

  useTour('referee-panel', TOUR, { auto: true, ready: Boolean(match) });

  /* The hint bar nudges in whenever the advice changes, so the next step never goes unnoticed. */
  useGSAP(() => {
    if (!matchStatus || prefersReducedMotion()) return;
    gsap.fromTo('.ref-hint', { y: -8, autoAlpha: 0.3 }, { y: 0, autoAlpha: 1, duration: 0.5, ease: 'expo.out' });
  }, { dependencies: [matchStatus, finishing], scope: rootRef });

  useEffect(() => {
    if (!searchParams.has('access')) return;
    const token = searchParams.get('access') || '';
    sessionStorage.setItem(`tourniDesk.referee.${id}`, token);
    window.history.replaceState({}, '', `${window.location.pathname}`);
  }, [id, searchParams]);

  const updateVisibleMatch = useCallback((base, commands = queuedCommands.current) => {
    confirmedMatch.current = base;
    setMatch(applyPending(base, commands));
  }, []);

  const flushQueue = useCallback(async () => {
    if (syncing.current || !navigator.onLine || !confirmedMatch.current) return;
    syncing.current = true;
    setSyncMessage('Synchronizuję zapisane zdarzenia…');
    try {
      let base = confirmedMatch.current;
      let commands = await readMatchCommands(id);
      for (let index = 0; index < commands.length; index += 1) {
        let command = { ...commands[index], expectedRevision: base.revision };
        try {
          let response;
          try {
            response = await api.post(`/matches/${id}/events`, command, accessToken ? { headers: AUTHORIZATION(accessToken) } : {});
          } catch (requestError) {
            if (requestError.response?.status !== 409 || !requestError.response?.data?.current) throw requestError;
            const safeToRebase = ['SCORE_CHANGED', 'FOUL_CARD_ISSUED']
              .includes(command.type);
            if (!safeToRebase) throw requestError;
            base = requestError.response.data.current;
            command = { ...command, expectedRevision: base.revision };
            response = await api.post(`/matches/${id}/events`, command, accessToken ? { headers: AUTHORIZATION(accessToken) } : {});
          }
          await removeMatchCommand(command.commandId);
          base = response.data.match;
          confirmedMatch.current = base;
          await cacheMatch(base);
          queuedCommands.current = queuedCommands.current.filter((item) => item.commandId !== command.commandId);
        } catch (requestError) {
          if (!requestError.response) setOnline(false);
          setError(requestError.response?.data?.message || 'Nie udało się zsynchronizować kolejki. Zdarzenia pozostają bezpiecznie zapisane na urządzeniu.');
          break;
        }
        commands = commands.slice(index + 1);
      }
      queuedCommands.current = await readMatchCommands(id);
      setPending(queuedCommands.current);
      updateVisibleMatch(base, queuedCommands.current);
      if (!queuedCommands.current.length) {
        setError('');
        setSyncMessage('Wynik zsynchronizowany.');
      }
    } catch (queueError) {
      setError(queueError.message || 'Nie udało się odczytać lokalnej kolejki synchronizacji.');
    } finally {
      syncing.current = false;
    }
  }, [accessToken, id, updateVisibleMatch]);

  const loadMatch = useCallback(async () => {
    setNow(Date.now());
    if (authLoading || (!accessToken && !user)) {
      return;
    }
    try {
      const response = await api.get(`/matches/${id}/live`, accessToken ? { headers: AUTHORIZATION(accessToken) } : {});
      const base = response.data.match;
      const commands = await readMatchCommands(id);
      queuedCommands.current = commands;
      await cacheMatch(base);
      updateVisibleMatch(base, commands);
      setSelectedPlayerId((current) => current || base.player1?.id || '');
      setError('');
    } catch (loadError) {
      const cached = await readCachedMatch(id).catch(() => null);
      if (cached) {
        const commands = await readMatchCommands(id);
        queuedCommands.current = commands;
        updateVisibleMatch(cached, commands);
        setSelectedPlayerId((current) => current || cached.player1?.id || '');
        setOnline(false);
        setSyncMessage('Tryb offline — zmiany będą wysłane po odzyskaniu połączenia.');
      } else {
        setError(loadError.response?.data?.message || 'Nie udało się pobrać meczu ani lokalnego zapisu.');
      }
    } finally {
      setLoading(false);
    }
  }, [accessToken, authLoading, id, updateVisibleMatch, user]);

  useEffect(() => {
    const timeout = window.setTimeout(() => { void loadMatch(); }, 0);
    return () => window.clearTimeout(timeout);
  }, [loadMatch]);

  useEffect(() => {
    const onOnline = () => { setOnline(true); flushQueue(); };
    const onOffline = () => { setOnline(false); setSyncMessage('Brak połączenia — zapisuję zdarzenia lokalnie.'); };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [flushQueue]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!online || !match || !pending.length) return undefined;
    const timeout = window.setTimeout(() => { void flushQueue(); }, 0);
    return () => window.clearTimeout(timeout);
  }, [online, match, pending.length, flushQueue]);

  async function record(type, data = {}) {
    if (!confirmedMatch.current) return;
    const command = {
      commandId: crypto.randomUUID(),
      matchId: id,
      expectedRevision: match.revision,
      type,
      data,
      createdAt: Date.now(),
    };
    try {
      await enqueueMatchCommand(command);
      queuedCommands.current = [...queuedCommands.current, command];
      setPending(queuedCommands.current);
      setError('');
      setSyncMessage(navigator.onLine ? 'Zapisuję wynik…' : 'Zdarzenie zapisane lokalnie — oczekuje na synchronizację.');
      setMatch(applyOptimistic(match, command));
      if (navigator.onLine) flushQueue();
    } catch (queueError) {
      setError(queueError.message || 'Nie udało się zapisać zdarzenia na tym urządzeniu.');
    }
  }

  async function controlAction(type) {
    if (!confirmedMatch.current || pending.length) return;
    const command = {
      commandId: crypto.randomUUID(),
      expectedRevision: match.revision,
    };
    try {
      const response = await api.post(`/matches/${id}/${type.toLowerCase()}`, command, {
        ...(accessToken ? { headers: AUTHORIZATION(accessToken) } : {}),
      });
      await cacheMatch(response.data.match);
      updateVisibleMatch(response.data.match, []);
      setError('');
      setSyncMessage(type === 'UNDO' ? 'Ostatnie zdarzenie cofnięte.' : 'Zdarzenie ponowione.');
    } catch (actionError) {
      if (actionError.response?.data?.current) {
        await cacheMatch(actionError.response.data.current);
        updateVisibleMatch(actionError.response.data.current, []);
      }
      setError(actionError.response?.data?.message || 'Nie udało się wykonać operacji.');
    }
  }

  async function requestFinish() {
    if (!finishing) {
      setFinishing(true);
      return;
    }
    if (requiresPenaltyDecision(match)
      && (match.score1 || 0) + (match.extraTimeScore1 || 0) === (match.score2 || 0) + (match.extraTimeScore2 || 0)
      && penalties.penaltyScore1 === penalties.penaltyScore2) {
      setError('Mecz pucharowy musi mieć zwycięzcę. Wprowadź różne wyniki rzutów karnych.');
      return;
    }
    await record('MATCH_COMPLETED', {
      score1: match.score1 || 0,
      score2: match.score2 || 0,
      extraTimeScore1: match.extraTimeScore1 || 0,
      extraTimeScore2: match.extraTimeScore2 || 0,
      ...penalties,
    });
    setFinishing(false);
  }

  if (!authLoading && !accessToken && !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  if (loading || authLoading) {
    return <FullPageLoader label="Łączenie z meczem…" />;
  }
  if (!match) {
    return (
      <main className="page">
        <div className="shell-narrow"><Notice tone="danger">{error}</Notice></div>
      </main>
    );
  }

  const finished = match.status === 'FINISHED';
  const canScore = !finished && Boolean(match.player1?.id && match.player2?.id);
  const clock = formatClock(match, now);
  const players = [match.player1, match.player2];
  const scheduled = match.status === 'SCHEDULED';
  const hint = finished
    ? 'Mecz zakończony. Wynik trafił do tabeli i drabinki.'
    : finishing
      ? 'Sprawdź wynik poniżej i potwierdź zakończenie meczu.'
      : !canScore
        ? 'Ten mecz czeka jeszcze na obu uczestników — wynik odblokuje się po ich przypisaniu.'
        : scheduled
          ? 'Krok 1: gdy obie strony są gotowe, naciśnij „Start meczu”.'
          : 'Dodawaj punkty przyciskami +1. Pomyłka? „Cofnij” usuwa ostatnie zdarzenie.';

  return (
    <main ref={rootRef} className="min-h-[calc(100vh-var(--nav-h))] px-3 pb-16 pt-5 sm:px-6 sm:pt-8">
      <div className="mx-auto max-w-2xl">
        {user?.role === 'REFEREE' && <BackLink to="/referee">Moje mecze</BackLink>}
        <header className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="eyebrow mb-2">Panel sędziego</p>
            <h1 className="h-section break-words">{match.tournament?.title || 'Panel sędziego'}</h1>
          </div>
          <span className="chip mt-1" data-tone={online ? 'ok' : 'warn'}>
            <Icon name={online ? 'wifi' : 'wifi-off'} size={13} />
            {online ? 'Online' : 'Offline'}
          </span>
        </header>

        <div className="ref-hint mb-4 flex items-start gap-3 rounded-[12px] border-[1.5px] border-ink bg-accent px-4 py-3 text-[0.9375rem] font-semibold leading-snug text-accent-ink" aria-live="polite">
          <Icon name={finished ? 'check' : 'flag'} size={19} className="mt-0.5 shrink-0" />
          <span>{hint}</span>
        </div>

        {error && <Notice tone="danger" className="mb-4">{error}</Notice>}
        <div className="mono mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-xs text-muted" aria-live="polite">
          <Icon name={pending.length ? 'refresh' : 'check'} size={14} className={pending.length && online ? 'spin' : ''} />
          <span>{syncMessage || (pending.length ? `${pending.length} zdarzeń oczekuje na synchronizację.` : 'Wszystkie zdarzenia są zsynchronizowane.')}</span>
          {pending.length > 0 && <span className="chip !h-[22px]" data-tone="warn">Kolejka: {pending.length}</span>}
        </div>

        <section className="scoreboard" aria-label="Wynik na żywo">
          <div className="scoreboard-head">
            <span className="mono text-xs font-semibold uppercase tracking-[0.1em] text-muted">{match.court ? `Boisko · ${match.court}` : `Runda ${match.round}`}</span>
            <span className="chip" data-tone={finished ? 'done' : scheduled ? 'neutral' : 'live'}>
              {!finished && !scheduled && <span className="live-dot" aria-hidden="true" />}
              {finished ? 'Mecz zakończony' : scheduled ? 'Gotowy do startu' : 'Mecz w toku'}
            </span>
          </div>

          <div className="p-4 sm:p-6">
            <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2 sm:gap-4">
              {[1, 2].map((side) => (
                <div key={side} className={`min-w-0 text-center ${side === 2 ? 'col-start-3' : 'col-start-1'} row-start-1`}>
                  <p className="mono mb-1 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-muted">Strona {side === 1 ? 'A' : 'B'}</p>
                  <p className="flex min-h-[2.6rem] items-end justify-center break-words font-display text-lg font-bold uppercase leading-none text-ink sm:text-2xl">
                    {match[`player${side}`]?.name || 'Oczekiwanie na awans'}
                  </p>
                  <div className="score-digits mt-2">
                    <Counter value={match[`score${side}`] ?? 0} fontSize="clamp(4.75rem, 21vw, 8rem)" fontWeight={800} duration={0.45} fade={0.1} intro={false} />
                  </div>
                  {match[`extraTimeScore${side}`] > 0 && <p className="mono mt-1 text-xs text-muted">Dogrywka: {match[`extraTimeScore${side}`]}</p>}
                </div>
              ))}
              <span className="score-digits col-start-2 row-start-1 pb-3 text-5xl text-muted" aria-hidden="true">:</span>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5" data-tour="ref-clock">
              <span className="clock rounded-[10px] border border-line bg-bg px-3.5 py-2" aria-live="off">{clock}</span>
              <span className="chip !h-[34px]">Część {match.period || '1'}</span>
              {match.clockRunning
                ? (
                  <button type="button" disabled={pending.length > 0} onClick={() => record('CLOCK_CHANGED', { action: 'PAUSE' })} className="btn btn-ghost">
                    <Icon name="pause" size={18} /> Pauza
                  </button>
                )
                : (
                  <button
                    type="button"
                    disabled={finished || pending.length > 0}
                    onClick={() => record(scheduled ? 'MATCH_STARTED' : 'CLOCK_CHANGED', { action: 'START' })}
                    className={`btn ${scheduled ? 'btn-primary' : 'btn-solid'}`}
                  >
                    <Icon name="play" size={18} /> {scheduled ? 'Start meczu' : 'Wznów czas'}
                  </button>
                )}
              <button type="button" disabled={finished || pending.length > 0} onClick={() => setExtraTime((current) => !current)} aria-pressed={extraTime} className="pill !min-h-[48px]">
                Dogrywka
              </button>
            </div>
            {extraTime && !finished && <p className="mt-3 text-center text-sm font-semibold text-ink">Tryb dogrywki: przyciski +1 / −1 liczą teraz punkty dogrywki.</p>}

            <ClickSpark sparkColor={theme === 'dark' ? '#c8f31d' : '#14130f'} sparkSize={12} sparkRadius={34} sparkCount={10} duration={450} style={{ height: 'auto' }}>
              <div className="mt-5 grid grid-cols-2 gap-3" data-tour="ref-score">
                {[1, 2].map((side) => (
                  <div key={side} className="grid grid-cols-[1fr_2fr] gap-2">
                    <button
                      type="button"
                      aria-label={`Odejmij punkt stronie ${side === 1 ? 'A' : 'B'}`}
                      disabled={!canScore || ((extraTime ? match[`extraTimeScore${side}`] : match[`score${side}`]) || 0) < 1}
                      onClick={() => record('SCORE_CHANGED', { side, delta: -1, period: extraTime ? 'extraTime' : 'regular' })}
                      className="ref-minus"
                    >−1</button>
                    <button
                      type="button"
                      aria-label={`Dodaj punkt stronie ${side === 1 ? 'A' : 'B'}`}
                      disabled={!canScore}
                      onClick={() => record('SCORE_CHANGED', { side, delta: 1, period: extraTime ? 'extraTime' : 'regular' })}
                      className="ref-plus"
                    >
                      <span aria-hidden="true" className="text-[2.5rem]">+1</span>
                      <span className="mono text-[0.6875rem] font-semibold uppercase tracking-[0.12em]">Punkt · {side === 1 ? 'A' : 'B'}</span>
                    </button>
                  </div>
                ))}
              </div>
            </ClickSpark>

            <div className="mt-5 grid gap-2.5 sm:grid-cols-[1fr_auto_auto] sm:items-end" data-tour="ref-cards">
              <div>
                <label className="label" htmlFor="referee-player">Kartka dla zawodnika</label>
                <select
                  id="referee-player"
                  value={selectedPlayerId}
                  onChange={(event) => setSelectedPlayerId(event.target.value)}
                  disabled={!canScore}
                  className="input !min-h-[52px]"
                >
                  <option value="">Wybierz zawodnika</option>
                  {players.filter((player) => player?.id).map((player) => (
                    <option key={player.id} value={player.id}>{player.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2.5 sm:contents">
                <button type="button" disabled={!canScore || !selectedPlayerId} onClick={() => record('FOUL_CARD_ISSUED', { playerId: selectedPlayerId, cardType: 'YELLOW' })} className="btn btn-ghost !min-h-[52px]">
                  <span className="h-5 w-3.5 rounded-[3px] border border-black/30 bg-[#f5c518]" aria-hidden="true" /> Żółta
                </button>
                <button type="button" disabled={!canScore || !selectedPlayerId} onClick={() => record('FOUL_CARD_ISSUED', { playerId: selectedPlayerId, cardType: 'RED' })} className="btn btn-ghost !min-h-[52px]">
                  <span className="h-5 w-3.5 rounded-[3px] border border-black/30 bg-[#e03a1e]" aria-hidden="true" /> Czerwona
                </button>
              </div>
            </div>

            <details className="group mt-5 rounded-[12px] border border-line">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 text-sm font-semibold text-ink [&::-webkit-details-marker]:hidden">
                <span className="flex items-center gap-2"><Icon name="sliders" size={17} /> Część meczu i korekta czasu</span>
                <Icon name="chevron-down" size={17} className="text-muted transition-transform duration-300 group-open:rotate-180" />
              </summary>
              <div className="grid gap-3 border-t border-line p-4 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="referee-period">Część meczu</label>
                  <select id="referee-period" disabled={finished || pending.length > 0} value={match.period || '1'} onChange={(event) => record('PERIOD_CHANGED', { period: event.target.value })} className="input">
                    <option value="1">1. połowa / set</option>
                    <option value="2">2. połowa / set</option>
                    <option value="3">3. połowa / set</option>
                    <option value="OT">Dogrywka</option>
                    <option value="PEN">Rzuty karne</option>
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="referee-clock">Korekta czasu (minuty)</label>
                  <input
                    id="referee-clock"
                    type="number"
                    min="0"
                    max="600"
                    disabled={finished || pending.length > 0}
                    value={clockCorrection ?? Math.floor(elapsedClock(match, now) / 60)}
                    onChange={(event) => setClockCorrection(event.target.value)}
                    onBlur={() => {
                      if (clockCorrection === null || clockCorrection === '') return;
                      record('CLOCK_CHANGED', { action: 'SET', seconds: Math.min(36000, Math.max(0, Number(clockCorrection) || 0) * 60) });
                      setClockCorrection(null);
                    }}
                    className="input"
                  />
                </div>
              </div>
            </details>

            <div className="mt-5 flex flex-wrap justify-between gap-3 border-t border-line pt-5">
              <div className="flex gap-2" data-tour="ref-undo">
                <button type="button" disabled={!match.canUndo || !online || pending.length > 0} onClick={() => controlAction('UNDO')} className="btn btn-ghost"><Icon name="undo" size={18} /> Cofnij</button>
                <button type="button" disabled={!match.canRedo || !online || pending.length > 0} onClick={() => controlAction('REDO')} className="btn btn-ghost"><Icon name="redo" size={18} /> Ponów</button>
              </div>
              {!finished && !finishing && (
                <button type="button" disabled={pending.length > 0} onClick={requestFinish} className="btn btn-danger" data-tour="ref-finish">
                  <Icon name="flag" size={18} /> Zakończ mecz…
                </button>
              )}
            </div>

            {finishing && (
              <div className="ref-confirm mt-4 rounded-[14px] border-[1.5px] border-danger/60 bg-danger/[0.06] p-4 sm:p-5">
                <p className="h-card">Zatwierdzić wynik {match.score1 ?? 0} : {match.score2 ?? 0}?</p>
                <p className="mt-2 text-sm text-muted">Wynik możesz później skorygować przez cofnięcie zdarzenia w historii.</p>
                {requiresPenaltyDecision(match)
                  && (match.score1 || 0) + (match.extraTimeScore1 || 0)
                    === (match.score2 || 0) + (match.extraTimeScore2 || 0) && (
                  <div className="mt-4">
                    <p className="mb-3 text-sm font-semibold text-ink">Remis w meczu pucharowym — wpisz wynik rzutów karnych.</p>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="label !mb-0">Karne — strona A<input type="number" min="0" value={penalties.penaltyScore1} onChange={(event) => setPenalties((current) => ({ ...current, penaltyScore1: Number(event.target.value) }))} className="input mt-1.5" /></label>
                      <label className="label !mb-0">Karne — strona B<input type="number" min="0" value={penalties.penaltyScore2} onChange={(event) => setPenalties((current) => ({ ...current, penaltyScore2: Number(event.target.value) }))} className="input mt-1.5" /></label>
                    </div>
                  </div>
                )}
                <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <button type="button" onClick={() => setFinishing(false)} className="btn btn-ghost">Wróć do meczu</button>
                  <button type="button" disabled={pending.length > 0} onClick={requestFinish} className="btn btn-danger-solid">
                    <Icon name="check" size={18} /> Potwierdź i zakończ mecz
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {match.eventHistory?.length > 0 && (
          <section className="card mt-5 p-4 sm:p-5">
            <h2 className="h-card mb-3">Historia zdarzeń</h2>
            <ol className="grid">
              {match.eventHistory.slice(-8).reverse().map((event) => (
                <li key={event.id} className="flex items-center justify-between gap-3 border-b border-line py-2.5 text-sm last:border-b-0">
                  <span className="text-ink">{({
                    MATCH_STARTED: 'Mecz rozpoczęty',
                    SCORE_CHANGED: `Zmiana wyniku · ${event.payload.commandData?.side === 1 ? 'strona A' : 'strona B'}`,
                    SCORE_SET: 'Korekta wyniku',
                    PERIOD_CHANGED: `Część meczu · ${event.payload.after?.period || ''}`,
                    CLOCK_CHANGED: 'Zmiana czasu',
                    FOUL_CARD_ISSUED: `${event.payload.after?.cardPoints === 3 ? 'Czerwona' : 'Żółta'} kartka`,
                    MATCH_COMPLETED: 'Mecz zatwierdzony',
                    ACTION_UNDONE: 'Cofnięto zdarzenie',
                    ACTION_REDONE: 'Ponowiono zdarzenie',
                  }[event.type] || event.type)}</span>
                  <span className="mono shrink-0 text-xs text-muted">v{event.sequence}</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        <p className="mono mt-4 text-center text-xs text-muted">
          Zmiany zapisywane są jako historia zdarzeń. {match.revision ? `Wersja meczu: ${match.revision}.` : ''}
        </p>
      </div>
    </main>
  );
}
