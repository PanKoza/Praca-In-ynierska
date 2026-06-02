import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

const SPORT_LABELS = {
  BEACH_VOLLEYBALL: '🏐 Siatkówka plażowa',
  FOOTBALL_6V6: '⚽ Piłka nożna 6v6',
  BASKETBALL: '🏀 Koszykówka',
  TENNIS: '🎾 Tenis',
  OTHER: '🏅 Inne',
};

const STATUS_STYLES = {
  DRAFT: 'bg-slate-700 text-slate-300',
  OPEN: 'bg-green-900/60 text-green-300',
  IN_PROGRESS: 'bg-yellow-900/60 text-yellow-300',
  FINISHED: 'bg-blue-900/60 text-blue-300',
  CANCELLED: 'bg-red-900/60 text-red-300',
};
const STATUS_LABELS = {
  DRAFT: 'Szkic', OPEN: 'Otwarte', IN_PROGRESS: 'W toku', FINISHED: 'Zakończone', CANCELLED: 'Anulowane',
};
const MATCH_STATUS_LABELS = { SCHEDULED: 'Zaplanowany', IN_PROGRESS: 'W trakcie', FINISHED: 'Zakończony' };

export default function TournamentDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [tournament, setTournament] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joinLoading, setJoinLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState('');

  function fetchTournament() {
    return api.get(`/tournaments/${id}`)
      .then((res) => setTournament(res.data.tournament))
      .catch(() => navigate('/tournaments'));
  }

  useEffect(() => {
    fetchTournament().finally(() => setLoading(false));
  }, [id]);

  const isParticipant = user && tournament?.participants.some((p) => p.userId === user.id);
  const isOrganizer = user && tournament?.organizerId === user.id;
  const canJoin = user?.role === 'PLAYER' && tournament?.status === 'OPEN' && !isParticipant;
  const canLeave = user?.role === 'PLAYER' && isParticipant;

  async function handleJoin() {
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

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!tournament) return null;

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-slate-950 px-4 py-10">
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
            <Stat label="Data" value={new Date(tournament.date).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })} />
            <Stat label="Organizator" value={tournament.organizer.name} />
            <Stat label="Uczestnicy" value={`${tournament._count.participants} / ${tournament.maxParticipants}`} />
            <Stat label="Mecze" value={tournament.matches.length} />
          </div>

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
        {tournament.matches.length > 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-white font-semibold text-lg mb-4">Mecze</h2>
            <div className="space-y-3">
              {tournament.matches.map((m) => (
                <div key={m.id} className="bg-slate-800 rounded-xl px-4 py-3 flex flex-wrap items-center gap-4">
                  <span className="text-xs text-slate-500 w-16">Runda {m.round}</span>
                  <div className="flex items-center gap-3 flex-1 justify-center font-semibold text-white">
                    <span>{m.player1.name}</span>
                    <span className="text-slate-400 text-lg">
                      {m.status === 'FINISHED'
                        ? `${m.score1} — ${m.score2}`
                        : 'vs'}
                    </span>
                    <span>{m.player2.name}</span>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    m.status === 'FINISHED' ? 'bg-blue-900/60 text-blue-300' :
                    m.status === 'IN_PROGRESS' ? 'bg-yellow-900/60 text-yellow-300' :
                    'bg-slate-700 text-slate-400'
                  }`}>
                    {MATCH_STATUS_LABELS[m.status]}
                  </span>
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
