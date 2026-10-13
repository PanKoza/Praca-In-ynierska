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

const AUTHORIZATION = (token) => ({ Authorization: `Bearer ${token}` });
const BASE_CLASS = 'referee-live-panel min-h-[calc(100vh-4rem)] bg-[#090D16] px-4 py-5 text-white sm:px-6 sm:py-8';
const BUTTON_CLASS = 'min-h-16 rounded-2xl border border-white/10 bg-[#171F2D] px-5 py-4 text-base font-bold text-white transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F62FE]';

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
    return <main className={`${BASE_CLASS} grid place-items-center`} aria-live="polite">Łączenie z meczem…</main>;
  }
  if (!match) {
    return <main className={`${BASE_CLASS} grid place-items-center`}><p role="alert" className="max-w-md text-center text-red-200">{error}</p></main>;
  }

  const finished = match.status === 'FINISHED';
  const canScore = !finished && Boolean(match.player1?.id && match.player2?.id);
  const clock = formatClock(match, now);
  const players = [match.player1, match.player2];

  return (
    <main className={BASE_CLASS}>
      <div className="mx-auto max-w-2xl">
        <header className="mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8A3FFC]">Panel sędziego · wynik na żywo</p>
            <h1 className="mt-1 text-lg font-bold">{match.tournament?.title || 'Panel sędziego'}</h1>
          </div>
          <span className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold ${online ? 'bg-emerald-400/10 text-emerald-300' : 'bg-amber-400/10 text-amber-200'}`}>
            <span className={`h-2 w-2 rounded-full ${online ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            {online ? 'Online' : 'Offline'}
          </span>
        </header>

        {error && <div className="mb-4 rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-200" role="alert">{error}</div>}
        <div className="mb-5 rounded-xl border border-white/10 bg-[#121826] px-4 py-3 text-xs text-slate-300" aria-live="polite">
          {syncMessage || (pending.length ? `${pending.length} zdarzeń oczekuje na synchronizację.` : 'Wszystkie zdarzenia są zsynchronizowane.')}
          {pending.length > 0 && <span className="ml-2 text-amber-200">Kolejka: {pending.length}</span>}
        </div>

        <section className="rounded-3xl border border-white/10 bg-[#121826] p-4 shadow-2xl shadow-blue-950/20 sm:p-7" aria-label="Wynik na żywo">
          <div className="mb-5 flex items-center justify-between text-xs text-slate-400">
            <span>{match.court ? `Boisko · ${match.court}` : `Runda ${match.round}`}</span>
            <span className={`rounded-full px-3 py-1 font-semibold ${finished ? 'bg-[#8A3FFC]/15 text-purple-200' : 'bg-[#0F62FE]/15 text-blue-200'}`}>
              {finished ? 'Mecz zakończony' : match.status === 'IN_PROGRESS' ? 'Mecz w toku' : 'Gotowy do startu'}
            </span>
          </div>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <div className="min-w-0 text-center">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#81B7FF]">Drużyna A</p>
              <p className="min-h-12 text-sm font-semibold text-slate-200 sm:text-base">{match.player1?.name || 'Oczekiwanie na awans'}</p>
              <p className="my-2 text-6xl font-black tabular-nums text-white sm:text-7xl">{match.score1 ?? 0}</p>
              {match.extraTimeScore1 > 0 && <p className="text-xs text-slate-400">Dogrywka: {match.extraTimeScore1}</p>}
            </div>
            <span className="text-2xl font-bold text-slate-600">:</span>
            <div className="min-w-0 text-center">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#C4B5FD]">Drużyna B</p>
              <p className="min-h-12 text-sm font-semibold text-slate-200 sm:text-base">{match.player2?.name || 'Oczekiwanie na awans'}</p>
              <p className="my-2 text-6xl font-black tabular-nums text-white sm:text-7xl">{match.score2 ?? 0}</p>
              {match.extraTimeScore2 > 0 && <p className="text-xs text-slate-400">Dogrywka: {match.extraTimeScore2}</p>}
            </div>
          </div>

          <div className="my-5 flex flex-wrap items-center justify-center gap-3">
            <span className="rounded-lg bg-black/25 px-3 py-2 font-mono text-lg font-bold tabular-nums text-[#39B4FE]" aria-live="off">{clock}</span>
            <span className="rounded-lg bg-white/5 px-3 py-2 text-xs font-medium text-slate-300">Część {match.period || '1'}</span>
            {match.clockRunning
              ? <button type="button" disabled={pending.length > 0} onClick={() => record('CLOCK_CHANGED', { action: 'PAUSE' })} className="min-h-11 rounded-xl bg-white/10 px-4 text-sm font-semibold disabled:opacity-40">Pauza</button>
              : <button type="button" disabled={finished || pending.length > 0} onClick={() => record(match.status === 'SCHEDULED' ? 'MATCH_STARTED' : 'CLOCK_CHANGED', { action: 'START' })} className="min-h-11 rounded-xl bg-[#0F62FE] px-4 text-sm font-semibold disabled:opacity-40">{match.status === 'SCHEDULED' ? 'Start meczu' : 'Wznów czas'}</button>}
            <button type="button" disabled={finished || pending.length > 0} onClick={() => setExtraTime((current) => !current)} aria-pressed={extraTime} className={`min-h-11 rounded-xl px-4 text-sm font-semibold ${extraTime ? 'bg-[#8A3FFC] text-white' : 'bg-white/10 text-slate-200'}`}>Dogrywka</button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[1, 2].map((side) => (
              <div key={side} className="grid grid-cols-2 gap-2">
                <button type="button" aria-label={`Odejmij punkt drużynie ${side === 1 ? 'A' : 'B'}`} disabled={!canScore || ((extraTime ? match[`extraTimeScore${side}`] : match[`score${side}`]) || 0) < 1} onClick={() => record('SCORE_CHANGED', { side, delta: -1, period: extraTime ? 'extraTime' : 'regular' })} className={`${BUTTON_CLASS} !min-h-[4.5rem] !px-2 text-xl`}>−1</button>
                <button type="button" aria-label={`Dodaj punkt drużynie ${side === 1 ? 'A' : 'B'}`} disabled={!canScore} onClick={() => record('SCORE_CHANGED', { side, delta: 1, period: extraTime ? 'extraTime' : 'regular' })} className="referee-score-button min-h-[4.5rem] rounded-2xl bg-gradient-to-br from-[#0F62FE] to-[#8A3FFC] text-base font-extrabold text-white shadow-lg shadow-blue-950/30 transition active:scale-[0.97] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"><span aria-hidden="true">＋1</span><span className="block text-[10px] font-bold uppercase tracking-wider">Gol · {side === 1 ? 'A' : 'B'}</span></button>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
            <label className="text-xs font-medium text-slate-400">
              Zawodnik — kartka / przewinienie
              <select
                aria-label="Wybierz zawodnika"
                value={selectedPlayerId}
                onChange={(event) => setSelectedPlayerId(event.target.value)}
                disabled={!canScore}
                className="mt-1.5 min-h-14 w-full rounded-xl border border-white/10 bg-[#090D16] px-3 text-sm text-white focus:border-[#0F62FE] focus:outline-none"
              >
                <option value="">Wybierz zawodnika</option>
                {players.filter((player) => player?.id).map((player) => (
                  <option key={player.id} value={player.id}>{player.name}</option>
                ))}
              </select>
            </label>
            <button type="button" disabled={!canScore || !selectedPlayerId} onClick={() => record('FOUL_CARD_ISSUED', { playerId: selectedPlayerId, cardType: 'YELLOW' })} className={`${BUTTON_CLASS} self-end !min-h-14 !px-4 text-sm`}>🟨 Żółta</button>
            <button type="button" disabled={!canScore || !selectedPlayerId} onClick={() => record('FOUL_CARD_ISSUED', { playerId: selectedPlayerId, cardType: 'RED' })} className={`${BUTTON_CLASS} self-end !min-h-14 !px-4 text-sm`}>🟥 Czerwona</button>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-medium text-slate-400">
              Część meczu
              <select aria-label="Część meczu" disabled={finished || pending.length > 0} value={match.period || '1'} onChange={(event) => record('PERIOD_CHANGED', { period: event.target.value })} className="mt-1.5 min-h-12 w-full rounded-xl border border-white/10 bg-[#090D16] px-3 text-sm text-white focus:border-[#0F62FE] focus:outline-none">
                <option value="1">1. połowa / set</option>
                <option value="2">2. połowa / set</option>
                <option value="3">3. połowa / set</option>
                <option value="OT">Dogrywka</option>
                <option value="PEN">Rzuty karne</option>
              </select>
            </label>
            <label className="text-xs font-medium text-slate-400">
              Korekta czasu (minuty)
              <input
                aria-label="Korekta czasu w minutach"
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
                className="mt-1.5 min-h-12 w-full rounded-xl border border-white/10 bg-[#090D16] px-3 text-sm text-white focus:border-[#0F62FE] focus:outline-none"
              />
            </label>
          </div>

          <div className="mt-5 flex flex-wrap justify-between gap-3 border-t border-white/10 pt-5">
            <div className="flex gap-2">
              <button type="button" disabled={!match.canUndo || !online || pending.length > 0} onClick={() => controlAction('UNDO')} className="min-h-12 rounded-xl border border-white/10 px-4 text-sm font-semibold disabled:opacity-40">↶ Cofnij</button>
              <button type="button" disabled={!match.canRedo || !online || pending.length > 0} onClick={() => controlAction('REDO')} className="min-h-12 rounded-xl border border-white/10 px-4 text-sm font-semibold disabled:opacity-40">↷ Ponów</button>
            </div>
            {!finished && !finishing && (
              <button type="button" disabled={pending.length > 0} onClick={requestFinish} className="referee-finish-button min-h-12 rounded-xl border border-red-400/30 bg-red-400/10 px-5 text-sm font-bold text-red-200 disabled:opacity-40">
                Zakończ mecz…
              </button>
            )}
          </div>

          {finishing && (
            <div className="mt-4 rounded-2xl border border-red-400/30 bg-red-400/5 p-4">
              <p className="font-semibold text-red-100">Czy na pewno zatwierdzić wynik {match.score1 ?? 0} : {match.score2 ?? 0}?</p>
              <p className="mt-1 text-xs text-slate-400">Wynik możesz później skorygować przez cofnięcie zdarzenia w historii.</p>
              {requiresPenaltyDecision(match)
                && (match.score1 || 0) + (match.extraTimeScore1 || 0)
                  === (match.score2 || 0) + (match.extraTimeScore2 || 0) && (
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <label className="text-xs text-slate-300">Karne — strona A<input type="number" min="0" value={penalties.penaltyScore1} onChange={(event) => setPenalties((current) => ({ ...current, penaltyScore1: Number(event.target.value) }))} className="mt-1 min-h-11 w-full rounded-lg border border-white/10 bg-[#090D16] px-3 text-white" /></label>
                  <label className="text-xs text-slate-300">Karne — strona B<input type="number" min="0" value={penalties.penaltyScore2} onChange={(event) => setPenalties((current) => ({ ...current, penaltyScore2: Number(event.target.value) }))} className="mt-1 min-h-11 w-full rounded-lg border border-white/10 bg-[#090D16] px-3 text-white" /></label>
                </div>
              )}
              <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setFinishing(false)} className="min-h-12 rounded-xl border border-white/10 px-5 text-sm font-semibold text-slate-200">Wróć do meczu</button>
                <button type="button" disabled={pending.length > 0} onClick={requestFinish} className="min-h-12 rounded-xl bg-red-500 px-5 text-sm font-bold text-white disabled:opacity-40">
                  Potwierdź i zakończ mecz
                </button>
              </div>
            </div>
          )}
        </section>

        {match.eventHistory?.length > 0 && (
          <section className="mt-5 rounded-2xl border border-white/10 bg-[#121826] p-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-200">Historia zdarzeń</h2>
            <ol className="space-y-2">
              {match.eventHistory.slice(-8).reverse().map((event) => (
                <li key={event.id} className="flex items-center justify-between gap-3 border-b border-white/5 pb-2 text-xs">
                  <span className="text-slate-300">{({
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
                  <span className="shrink-0 font-mono text-slate-500">v{event.sequence}</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        <p className="mt-4 text-center text-xs text-slate-500">
          Zmiany zapisywane są jako historia zdarzeń. {match.revision ? `Wersja meczu: ${match.revision}.` : ''}
        </p>
      </div>
    </main>
  );
}
