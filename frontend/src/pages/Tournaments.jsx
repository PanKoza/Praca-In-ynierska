import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';

const SPORT_LABELS = {
  BEACH_VOLLEYBALL: '🏐 Siatkówka plażowa',
  FOOTBALL_6V6: '⚽ Piłka nożna 6v6',
  BASKETBALL: '🏀 Koszykówka',
  TENNIS: '🎾 Tenis',
  OTHER: '🏅 Inne',
};

const STATUS_STYLES = {
  DRAFT:       'bg-slate-700 text-slate-300',
  OPEN:        'bg-green-900/60 text-green-300',
  IN_PROGRESS: 'bg-yellow-900/60 text-yellow-300',
  FINISHED:    'bg-blue-900/60 text-blue-300',
  CANCELLED:   'bg-red-900/60 text-red-300',
};

const STATUS_LABELS = {
  DRAFT: 'Szkic', OPEN: 'Otwarte', IN_PROGRESS: 'W toku', FINISHED: 'Zakończone', CANCELLED: 'Anulowane',
};

export default function Tournaments() {
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ sportType: '', status: '' });

  useEffect(() => {
    setLoading(true);
    const params = {};
    if (filters.sportType) params.sportType = filters.sportType;
    if (filters.status) params.status = filters.status;

    api.get('/tournaments', { params })
      .then((res) => setTournaments(res.data.tournaments))
      .catch(() => setError('Nie udało się załadować turniejów.'))
      .finally(() => setLoading(false));
  }, [filters]);

  function handleFilter(e) {
    setFilters((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-slate-950 px-4 py-10">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <h1 className="text-3xl font-bold text-white">Turnieje</h1>

          {/* Filters */}
          <div className="flex gap-3 flex-wrap">
            <select
              name="sportType"
              value={filters.sportType}
              onChange={handleFilter}
              className="bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Wszystkie sporty</option>
              {Object.entries(SPORT_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
            <select
              name="status"
              value={filters.status}
              onChange={handleFilter}
              className="bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Wszystkie statusy</option>
              {Object.entries(STATUS_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
        </div>

        {loading && (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <p className="text-red-400 text-center py-10">{error}</p>
        )}

        {!loading && !error && tournaments.length === 0 && (
          <p className="text-slate-400 text-center py-20">Brak turniejów. Zmień filtry lub utwórz nowy.</p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {tournaments.map((t) => (
            <Link
              key={t.id}
              to={`/tournaments/${t.id}`}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-6 hover:border-indigo-500/50 hover:bg-slate-800/60 transition-all group"
            >
              <div className="flex items-start justify-between mb-3">
                <span className="text-sm text-slate-400">{SPORT_LABELS[t.sportType]}</span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[t.status]}`}>
                  {STATUS_LABELS[t.status]}
                </span>
              </div>
              <h2 className="text-white font-semibold text-lg mb-1 group-hover:text-indigo-300 transition-colors">
                {t.title}
              </h2>
              <p className="text-slate-500 text-sm mb-4">
                📅 {new Date(t.date).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
              <div className="flex items-center justify-between text-sm text-slate-400">
                <span>👤 {t.organizer.name}</span>
                <span>
                  {t._count.participants}/{t.maxParticipants} uczestników
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
