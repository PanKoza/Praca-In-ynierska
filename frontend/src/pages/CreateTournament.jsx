import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';

const SPORT_OPTIONS = [
  { value: 'BEACH_VOLLEYBALL', label: '🏐 Siatkówka plażowa' },
  { value: 'FOOTBALL_6V6',    label: '⚽ Piłka nożna 6v6' },
  { value: 'BASKETBALL',      label: '🏀 Koszykówka' },
  { value: 'TENNIS',          label: '🎾 Tenis' },
  { value: 'OTHER',           label: '🏅 Inne' },
];

export default function CreateTournament() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: '',
    description: '',
    date: '',
    sportType: 'BEACH_VOLLEYBALL',
    maxParticipants: 16,
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/tournaments', {
        ...form,
        maxParticipants: parseInt(form.maxParticipants, 10),
      });
      navigate(`/tournaments/${res.data.tournament.id}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Błąd tworzenia turnieju.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-950 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8">
          <h1 className="text-2xl font-bold text-white mb-6">Nowy turniej</h1>

          {error && (
            <div className="bg-red-900/40 border border-red-700 text-red-300 text-sm rounded-lg px-4 py-3 mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Nazwa turnieju">
              <input
                type="text"
                name="title"
                value={form.title}
                onChange={handleChange}
                required
                className={inputCls}
                placeholder="Plaża Cup 2026"
              />
            </Field>

            <Field label="Opis (opcjonalnie)">
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                rows={3}
                className={inputCls}
                placeholder="Krótki opis turnieju..."
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Sport">
                <select name="sportType" value={form.sportType} onChange={handleChange} className={inputCls}>
                  {SPORT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </Field>

              <Field label="Maks. uczestników">
                <input
                  type="number"
                  name="maxParticipants"
                  value={form.maxParticipants}
                  onChange={handleChange}
                  min={2}
                  max={256}
                  required
                  className={inputCls}
                />
              </Field>
            </div>

            <Field label="Data turnieju">
              <input
                type="datetime-local"
                name="date"
                value={form.date}
                onChange={handleChange}
                required
                className={inputCls}
              />
            </Field>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => navigate('/tournaments')}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2.5 rounded-lg transition-colors"
              >
                Anuluj
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors"
              >
                {loading ? 'Tworzenie...' : 'Utwórz turniej'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

const inputCls =
  'w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-300 mb-1">{label}</label>
      {children}
    </div>
  );
}
