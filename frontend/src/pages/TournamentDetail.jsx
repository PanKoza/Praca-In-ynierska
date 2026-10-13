import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams, useNavigate, useLocation } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

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

const FORMAT_LABELS = {
  SINGLE_ELIMINATION: 'Pojedyncza eliminacja',
  DOUBLE_ELIMINATION: 'Podwójna eliminacja',
  ROUND_ROBIN: 'Każdy z każdym',
  GROUP_STAGE: 'Grupy i play-offy',
};

const STATUS_STYLES = {
  DRAFT: 'bg-slate-700 text-slate-300',
  OPEN: 'bg-green-900/60 text-green-300',
  PUBLISHED: 'bg-green-900/60 text-green-300',
  IN_PROGRESS: 'bg-yellow-900/60 text-yellow-300',
  FINISHED: 'bg-blue-900/60 text-blue-300',
  CANCELLED: 'bg-red-900/60 text-red-300',
};
const STATUS_LABELS = {
  DRAFT: 'Szkic', OPEN: 'Otwarte', PUBLISHED: 'Opublikowany', IN_PROGRESS: 'W toku', FINISHED: 'Zakończone', CANCELLED: 'Anulowane',
};
const MATCH_STATUS_LABELS = { SCHEDULED: 'Zaplanowany', IN_PROGRESS: 'W trakcie', FINISHED: 'Zakończony' };

export default function TournamentDetail() {
  const { id } = useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const autoJoinAttempt = useRef('');

  const [tournament, setTournament] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joinLoading, setJoinLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState('');
  const [standings, setStandings] = useState({});
  const [refereeLinks, setRefereeLinks] = useState({});
  const canManage = user?.role === 'ADMIN' || (user && tournament?.organizerId === user.id);

  const fetchTournament = useCallback(() => {
    return api.get(`/tournaments/${id}`)
      .then((res) => setTournament(res.data.tournament))
      .catch(() => navigate('/tournaments'));
  }, [id, navigate]);

  useEffect(() => {
    fetchTournament().finally(() => setLoading(false));
  }, [fetchTournament]);

  useEffect(() => {
    let active = true;
    const refreshStandings = () => api.get(`/tournaments/${id}/standings`)
      .then((response) => { if (active) setStandings(response.data.standings || {}); })
      .catch(() => {});
    refreshStandings();
    const source = new EventSource(`${api.defaults.baseURL}/tournaments/${id}/live-events`);
    source.addEventListener('match-updated', () => {
      fetchTournament();
      refreshStandings();
    });
    return () => {
      active = false;
      source.close();
    };
  }, [fetchTournament, id]);

  const isParticipant = user && tournament?.participants.some((p) => p.userId === user.id);
  const isOrganizer = user && tournament?.organizerId === user.id;
  const canJoin = (!user || user.role === 'PLAYER')
    && ['OPEN', 'PUBLISHED'].includes(tournament?.status)
    && !isParticipant;
  const canLeave = user?.role === 'PLAYER' && isParticipant;

  useEffect(() => {
    if (authLoading || loading || !tournament || location.state?.autoJoinTournamentId !== id) return;

    const attemptKey = `${id}:${user?.id || 'anonymous'}`;
    if (autoJoinAttempt.current === attemptKey) return;
    autoJoinAttempt.current = attemptKey;

    const clearJoinIntent = () => navigate(location.pathname, { replace: true, state: null });
    if (!user) {
      clearJoinIntent();
      return;
    }
    if (user.role !== 'PLAYER') {
      Promise.resolve().then(() => setActionMsg('Dołączenie do wydarzenia wymaga konta zawodnika.'));
      clearJoinIntent();
      return;
    }

    Promise.resolve()
      .then(() => {
        setJoinLoading(true);
        setActionMsg('');
        return api.post(`/tournaments/${id}/join`);
      })
      .then(async () => {
        await fetchTournament();
        setActionMsg('Zapisano na turniej!');
      })
      .catch((err) => {
        setActionMsg(err.response?.data?.message || 'Błąd zapisu.');
      })
      .finally(() => {
        setJoinLoading(false);
        clearJoinIntent();
      });
  }, [authLoading, fetchTournament, id, loading, location.pathname, location.state, navigate, tournament, user]);

  async function handleJoin() {
    if (!user) {
      navigate('/register', {
        state: { from: location, autoJoinTournamentId: id },
      });
      return;
    }
    setJoinLoading(true);
    setActionMsg('');
    try {
      await api.post(`/tournaments/${id}/join`);
      await fetchTournament();
      setActionMsg('Zapisano na turniej!');
    } catch (err) {
      setActionMsg(err.response?.data?.message || 'Błąd zapisu.');
    } finally {
      setJoinLoading(false);
    }
  }

  async function handleLeave() {
    setJoinLoading(true);
    setActionMsg('');
    try {
      await api.delete(`/tournaments/${id}/leave`);
      await fetchTournament();
      setActionMsg('Wypisano z turnieju.');
    } catch (err) {
      setActionMsg(err.response?.data?.message || 'Błąd wypisania.');
    } finally {
      setJoinLoading(false);
    }
  }

  async function createRefereeLink(matchId) {
    try {
      const response = await api.post(`/matches/${matchId}/referee-access`);
      setRefereeLinks((current) => ({ ...current, [matchId]: response.data }));
      setActionMsg('Link sędziego aktywny przez 12 godzin. Udostępnij go tylko przydzielonemu sędziemu.');
    } catch (err) {
      setActionMsg(err.response?.data?.message || 'Nie udało się utworzyć dostępu sędziego.');
    }
  }

  async function revokeRefereeLink(matchId) {
    try {
      await api.delete(`/matches/${matchId}/referee-access`);
      setRefereeLinks((current) => ({ ...current, [matchId]: undefined }));
      setActionMsg('Dostęp sędziego został unieważniony.');
    } catch (err) {
      setActionMsg(err.response?.data?.message || 'Nie udało się unieważnić dostępu sędziego.');
    }
  }

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!tournament) return null;

  return (
    <main className="tournament-detail min-h-[calc(100vh-4rem)] bg-slate-950 px-4 py-10">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8">
          <div className="flex flex-wrap gap-3 items-center mb-4">
            <span className="text-slate-400 text-sm">{SPORT_LABELS[tournament.sportType]}</span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[tournament.status]}`}>
              {STATUS_LABELS[tournament.status]}
            </span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">{tournament.title}</h1>
          {tournament.description && (
            <p className="text-slate-400 mb-4">{tournament.description}</p>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <Stat label="Data" value={new Date(tournament.date).toLocaleString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })} />
            <Stat label="Organizator" value={tournament.organizer.name} />
            <Stat label="Uczestnicy" value={`${tournament._count.participants} / ${tournament.maxParticipants}`} />
            <Stat label="Mecze" value={tournament.matches.length} />
          </div>
          {(tournament.location || tournament.format || tournament.registrationDeadline || tournament.entryFee !== null) && (
            <div className="mt-5 grid grid-cols-2 gap-4 border-t border-slate-800 pt-5 text-sm sm:grid-cols-4">
              {tournament.location && <Stat label="Lokalizacja" value={tournament.location} />}
              {tournament.format && <Stat label="Format" value={FORMAT_LABELS[tournament.format] || tournament.format} />}
              {tournament.registrationDeadline && (
                <Stat label="Zapisy do" value={new Date(tournament.registrationDeadline).toLocaleString('pl-PL')} />
              )}
              {tournament.registrationType && (
                <Stat
                  label="Zgłoszenia"
                  value={tournament.registrationType === 'TEAM'
                    ? `Drużynowe${tournament.minTeamSize ? ` · ${tournament.minTeamSize}–${tournament.maxTeamSize} osób` : ''}`
                    : 'Indywidualne'}
                />
              )}
              {tournament.entryFee !== null && (
                <Stat label="Wpisowe" value={`${Number(tournament.entryFee).toFixed(2)} ${tournament.currency || ''}`} />
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="mt-6 flex flex-wrap gap-3 items-center">
            {canJoin && (
              <button
                onClick={handleJoin}
                disabled={joinLoading}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold px-5 py-2 rounded-lg transition-colors"
              >
                {joinLoading ? 'Zapisywanie...' : 'Zapisz się'}
              </button>
            )}
            {canLeave && (
              <button
                onClick={handleLeave}
                disabled={joinLoading}
                className="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white font-semibold px-5 py-2 rounded-lg transition-colors"
              >
                {joinLoading ? '...' : 'Wypisz się'}
              </button>
            )}
            {isOrganizer && (
              <span className="text-sm text-indigo-400 font-medium">Jesteś organizatorem</span>
            )}
            {actionMsg && <span className="text-sm text-green-400">{actionMsg}</span>}
          </div>
        </div>

        {/* Participants */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-white font-semibold text-lg mb-4">
            Uczestnicy ({tournament._count.participants}/{tournament.maxParticipants})
          </h2>
          {tournament.participants.length === 0 ? (
            <p className="text-slate-500 text-sm">Brak zapisanych uczestników.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {tournament.participants.map((p) => (
                <div key={p.id} className="flex items-center gap-2 bg-slate-800 rounded-lg px-3 py-2 text-sm text-slate-300">
                  <span className="w-7 h-7 rounded-full bg-indigo-700 flex items-center justify-center text-white text-xs font-bold">
                    {p.user.name.charAt(0).toUpperCase()}
                  </span>
                  {p.user.name}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Matches */}
        {Object.keys(standings).length > 0 && (
          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="mb-4 text-lg font-semibold text-white">Tabele na żywo</h2>
            <div className="grid gap-5 md:grid-cols-2">
              {Object.entries(standings).map(([group, entries]) => (
                <div key={group}>
                  <h3 className="mb-2 text-sm font-semibold text-slate-300">{group === 'general' ? 'Klasyfikacja' : group}</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="text-slate-500">
                        <tr><th className="p-2">#</th><th className="p-2">Uczestnik</th><th className="p-2">M</th><th className="p-2">+/-</th><th className="p-2">Pkt</th><th className="p-2">FP</th></tr>
                      </thead>
                      <tbody>
                        {entries.map((entry) => (
                          <tr key={entry.participantId} className="border-t border-slate-800">
                            <td className="p-2 font-bold text-[#39B4FE]">{entry.position}</td>
                            <td className="p-2 font-medium text-white">{entry.name}</td>
                            <td className="p-2">{entry.played}</td>
                            <td className="p-2">{entry.difference > 0 ? '+' : ''}{entry.difference}</td>
                            <td className="p-2 font-bold">{entry.points}</td>
                            <td className="p-2">{entry.fairPlay}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {tournament.matches.length > 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-white font-semibold text-lg mb-4">Mecze</h2>
            <div className="space-y-3">
              {tournament.matches.map((m) => (
                <div key={m.id} className="bg-slate-800 rounded-xl px-4 py-3 flex flex-wrap items-center gap-4">
                  <span className="text-xs text-slate-500 w-16">Runda {m.round}</span>
                  <div className="flex items-center gap-3 flex-1 justify-center font-semibold text-white">
                    <span>{m.player1?.name || 'Oczekiwanie na awans'}</span>
                    <span className="text-slate-400 text-lg">
                      {m.status === 'FINISHED'
                        ? `${m.score1} — ${m.score2}`
                        : 'vs'}
                    </span>
                    <span>{m.player2?.name || 'Oczekiwanie na awans'}</span>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    m.status === 'FINISHED' ? 'bg-blue-900/60 text-blue-300' :
                    m.status === 'IN_PROGRESS' ? 'bg-yellow-900/60 text-yellow-300' :
                    'bg-slate-700 text-slate-400'
                  }`}>
                    {MATCH_STATUS_LABELS[m.status]}
                  </span>
                  {m.winnerId && (
                    <span className="text-xs font-semibold text-emerald-300">
                      Zwycięzca: {m.winnerId === m.player1Id ? m.player1?.name : m.player2?.name}
                    </span>
                  )}
                  <Link
                    to={`/tournaments/${id}/matches/${m.id}/live`}
                    className="rounded-lg border border-[#0F62FE]/25 bg-[#0F62FE]/10 px-3 py-2 text-xs font-semibold text-blue-200 transition hover:bg-[#0F62FE]/20"
                  >
                    Śledź wynik{m.status === 'IN_PROGRESS' ? ' · LIVE' : ''}
                  </Link>
                  {canManage && m.player1 && m.player2 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <button type="button" onClick={() => createRefereeLink(m.id)} className="rounded-lg bg-[#0F62FE]/15 px-3 py-2 text-xs font-semibold text-blue-200 hover:bg-[#0F62FE]/25">
                        Przydziel sędziego
                      </button>
                      {refereeLinks[m.id] && (
                        <>
                          <button
                            type="button"
                            onClick={() => navigator.clipboard.writeText(`${window.location.origin}${refereeLinks[m.id].accessUrl}`).then(() => setActionMsg('Link sędziego skopiowany.')).catch(() => setActionMsg('Skopiuj link sędziego ręcznie.'))}
                            className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-slate-200"
                          >Kopiuj link sędziego</button>
                          <button type="button" onClick={() => revokeRefereeLink(m.id)} className="rounded-lg border border-red-400/20 px-3 py-2 text-xs font-semibold text-red-200">Unieważnij</button>
                          <a href={refereeLinks[m.id].accessUrl} className="w-full break-all text-xs text-slate-400 underline">{window.location.origin}{refereeLinks[m.id].accessUrl}</a>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <p className="text-slate-500 text-xs mb-0.5">{label}</p>
      <p className="text-white font-medium">{value}</p>
    </div>
  );
}
