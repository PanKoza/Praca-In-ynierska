import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api/axios';

const STATUS_LABELS = {
  SCHEDULED: 'Zaplanowany',
  IN_PROGRESS: 'Na żywo',
  FINISHED: 'Zakończony',
};

export default function LiveMatchView() {
  const { tournamentId, matchId } = useParams();
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

  if (loading) {
    return (
      <main className="grid min-h-[calc(100vh-5rem)] place-items-center bg-[#090D16] px-4 text-sm text-slate-400" role="status">
        Ładowanie wyniku meczu…
      </main>
    );
  }

  if (!match) {
    return (
      <main className="grid min-h-[calc(100vh-5rem)] place-items-center bg-[#090D16] px-4 text-white">
        <div className="max-w-lg text-center">
          <p className="text-sm text-rose-200" role="alert">{error || 'Nie znaleziono meczu.'}</p>
          <Link to={`/tournaments/${tournamentId}`} className="mt-4 inline-flex text-sm font-semibold text-[#81C7FF] hover:text-white">
            ← Wróć do wydarzenia
          </Link>
        </div>
      </main>
    );
  }

  const finished = match.status === 'FINISHED';
  const live = match.status === 'IN_PROGRESS';

  return (
    <main className="live-match-view min-h-[calc(100vh-5rem)] bg-[#090D16] px-4 py-8 text-white sm:px-6">
      <div className="mx-auto max-w-3xl">
        <Link to={`/tournaments/${tournamentId}`} className="inline-flex text-xs font-semibold text-slate-400 transition hover:text-white">
          ← Wróć do wydarzenia
        </Link>

        <section className="mt-5 overflow-hidden rounded-3xl border border-white/[0.08] bg-[#111827]/90 shadow-2xl shadow-blue-950/20">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] px-5 py-4 sm:px-7">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#81C7FF]">Wynik meczu</p>
              <h1 className="mt-1 text-lg font-bold">{match.tournament?.title || 'Podgląd na żywo'}</h1>
              <p className="mt-1 text-xs text-slate-500">
                Runda {match.round}{match.groupKey ? ` · ${match.groupKey}` : ''}{match.court ? ` · ${match.court}` : ''}
              </p>
              {match.scheduledAt && (
                <p className="mt-1 text-xs font-medium text-[#81C7FF]">
                  {new Date(match.scheduledAt).toLocaleString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-[10px] font-bold ${connected ? 'bg-emerald-300/10 text-emerald-200' : 'bg-amber-300/10 text-amber-200'}`}>
                <span className={`h-2 w-2 rounded-full ${connected ? 'animate-pulse bg-emerald-300' : 'bg-amber-300'}`} aria-hidden="true" />
                {connected ? 'Połączono na żywo' : 'Łączenie…'}
              </span>
              <span className={`rounded-full px-3 py-2 text-[10px] font-bold ${live ? 'bg-rose-300/10 text-rose-200' : finished ? 'bg-violet-300/10 text-violet-200' : 'bg-blue-300/10 text-blue-200'}`}>
                {live && <span className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-rose-300" aria-hidden="true" />}
                {STATUS_LABELS[match.status] || match.status}
              </span>
            </div>
          </header>

          <div className="px-5 py-10 sm:px-10 sm:py-14">
            {error && <p className="mb-5 rounded-xl border border-amber-300/20 bg-amber-300/[0.06] p-3 text-sm text-amber-100" role="status">{error}</p>}
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 sm:gap-8">
              <div className="min-w-0 text-center">
                <p className="min-h-12 break-words text-sm font-bold text-slate-200 sm:text-xl">{match.player1?.name || 'Oczekuje na awans'}</p>
                <p className="mt-3 font-mono text-6xl font-black tabular-nums text-white sm:text-8xl">{match.score1 ?? 0}</p>
                {match.extraTimeScore1 > 0 && <p className="mt-2 text-xs text-slate-400">Dogrywka: {match.extraTimeScore1}</p>}
                {match.penaltyScore1 !== null && <p className="mt-1 text-xs text-slate-400">Karne: {match.penaltyScore1}</p>}
              </div>
              <span className="text-2xl font-bold text-slate-600">:</span>
              <div className="min-w-0 text-center">
                <p className="min-h-12 break-words text-sm font-bold text-slate-200 sm:text-xl">{match.player2?.name || 'Oczekuje na awans'}</p>
                <p className="mt-3 font-mono text-6xl font-black tabular-nums text-white sm:text-8xl">{match.score2 ?? 0}</p>
                {match.extraTimeScore2 > 0 && <p className="mt-2 text-xs text-slate-400">Dogrywka: {match.extraTimeScore2}</p>}
                {match.penaltyScore2 !== null && <p className="mt-1 text-xs text-slate-400">Karne: {match.penaltyScore2}</p>}
              </div>
            </div>
            {match.winnerId && (
              <p className="mt-8 text-center text-sm font-bold text-emerald-200">
                Zwycięzca: {match.winnerId === match.player1Id ? match.player1?.name : match.player2?.name}
              </p>
            )}
          </div>

          <footer className="border-t border-white/[0.07] bg-black/10 px-5 py-3 text-center text-xs text-slate-500">
            Wynik aktualizuje się automatycznie podczas wprowadzania zdarzeń przez sędziego.
          </footer>
        </section>
      </div>
    </main>
  );
}
