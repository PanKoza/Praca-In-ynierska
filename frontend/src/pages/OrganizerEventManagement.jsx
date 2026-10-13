import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

const TABS = [
  { id: 'overview', label: 'Przegląd', icon: '◈' },
  { id: 'participants', label: 'Uczestnicy', icon: '◎' },
  { id: 'matches', label: 'Mecze i sędziowie', icon: '◉' },
  { id: 'settings', label: 'Ustawienia', icon: '⚙' },
];

const STATUS_LABELS = {
  DRAFT: 'Wersja robocza',
  OPEN: 'Zapisy otwarte',
  PUBLISHED: 'Opublikowany',
  IN_PROGRESS: 'W trakcie',
  FINISHED: 'Zakończony',
  CANCELLED: 'Anulowany',
};

const STATUS_STYLES = {
  DRAFT: 'bg-white/10 text-slate-300',
  OPEN: 'bg-cyan-300/10 text-cyan-200',
  PUBLISHED: 'bg-blue-300/10 text-blue-200',
  IN_PROGRESS: 'bg-emerald-300/10 text-emerald-200',
  FINISHED: 'bg-violet-300/10 text-violet-200',
  CANCELLED: 'bg-rose-300/10 text-rose-200',
};

const STATUS_TRANSITIONS = {
  DRAFT: ['DRAFT'],
  OPEN: ['OPEN', 'PUBLISHED', 'IN_PROGRESS', 'CANCELLED'],
  PUBLISHED: ['PUBLISHED', 'OPEN', 'IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['IN_PROGRESS', 'FINISHED', 'CANCELLED'],
  FINISHED: ['FINISHED'],
  CANCELLED: ['CANCELLED'],
};
const FORMAT_LABELS = {
  SINGLE_ELIMINATION: 'Pojedyncza eliminacja',
  DOUBLE_ELIMINATION: 'Podwójna eliminacja',
  ROUND_ROBIN: 'Każdy z każdym',
  GROUP_STAGE: 'Grupy i play-offy',
};

const SPORTS = [
  ['BEACH_VOLLEYBALL', 'Siatkówka plażowa'],
  ['FOOTBALL_6V6', 'Piłka nożna 6v6'],
  ['SOCCER', 'Piłka nożna'],
  ['BASKETBALL', 'Koszykówka'],
  ['VOLLEYBALL', 'Siatkówka'],
  ['TENNIS', 'Tenis'],
  ['ESPORTS', 'E-sport'],
  ['CUSTOM', 'Własna dyscyplina'],
  ['OTHER', 'Inne'],
];

function toDateInput(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function dateLabel(value) {
  if (!value) return 'Nie ustalono';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Nie ustalono' : date.toLocaleString('pl-PL', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function SummaryCard({ label, value, sublabel, accent }) {
  return (
    <div className={`rounded-2xl border border-white/[0.07] bg-gradient-to-br ${accent} p-4`}>
      <p className="text-xs font-medium text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-black tracking-tight text-white">{value}</p>
      <p className="mt-1 text-[11px] text-slate-500">{sublabel}</p>
    </div>
  );
}

function Field({ label, children, hint }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold text-slate-300">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-[11px] text-slate-500">{hint}</span>}
    </label>
  );
}

function MatchResultControls({ match, format, onSave, saving }) {
  const [scores, setScores] = useState(() => ({
    score1: match.score1 ?? 0,
    score2: match.score2 ?? 0,
    extraTimeScore1: match.extraTimeScore1 ?? 0,
    extraTimeScore2: match.extraTimeScore2 ?? 0,
    penaltyScore1: match.penaltyScore1 ?? '',
    penaltyScore2: match.penaltyScore2 ?? '',
  }));
  const finished = match.status === 'FINISHED';
  const needsTiebreak = ['SINGLE_ELIMINATION', 'DOUBLE_ELIMINATION'].includes(format)
    || (format === 'GROUP_STAGE' && !match.groupKey);

  function changeScore(field, value) {
    setScores((current) => ({ ...current, [field]: value }));
  }

  function submitScore(event, status) {
    event.preventDefault();
    void onSave(match, {
      score1: Number(scores.score1),
      score2: Number(scores.score2),
      extraTimeScore1: Number(scores.extraTimeScore1),
      extraTimeScore2: Number(scores.extraTimeScore2),
      penaltyScore1: scores.penaltyScore1 === '' ? null : Number(scores.penaltyScore1),
      penaltyScore2: scores.penaltyScore2 === '' ? null : Number(scores.penaltyScore2),
    }, status);
  }

  return (
    <form onSubmit={(event) => submitScore(event, 'IN_PROGRESS')} className="mt-4 rounded-xl border border-white/[0.06] bg-black/20 p-3">
      <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Wynik meczu</p>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-3">
        {[1, 2].map((side) => (
          <div key={side} className={side === 2 ? 'col-start-3 row-start-1' : 'col-start-1 row-start-1'}>
            <Field label={match[`player${side}`]?.name || `Uczestnik ${side}`}>
            <input
              aria-label={`Wynik ${match[`player${side}`]?.name || `uczestnika ${side}`}`}
              type="number"
              min="0"
              max="999"
              step="1"
              required
              disabled={finished || saving}
              value={scores[`score${side}`]}
              onChange={(event) => changeScore(`score${side}`, event.target.value)}
              className={`${INPUT_CLASS} text-center text-lg font-bold`}
            />
            </Field>
          </div>
        ))}
        <span className="col-start-2 row-start-1 pb-3 text-slate-500">:</span>
      </div>
      {needsTiebreak && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-semibold text-slate-300">Dogrywka — dodatkowe punkty</p>
            <div className="grid grid-cols-2 gap-3">
              {[1, 2].map((side) => (
                <Field key={side} label={match[`player${side}`]?.name || `Uczestnik ${side}`}>
                  <input
                    type="number"
                    min="0"
                    max="999"
                    step="1"
                    disabled={finished || saving}
                    value={scores[`extraTimeScore${side}`]}
                    onChange={(event) => changeScore(`extraTimeScore${side}`, event.target.value)}
                    className={`${INPUT_CLASS} text-center`}
                  />
                </Field>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold text-slate-300">Rzuty karne — wynik serii</p>
            <div className="grid grid-cols-2 gap-3">
              {[1, 2].map((side) => (
                <Field key={side} label={match[`player${side}`]?.name || `Uczestnik ${side}`}>
                  <input
                    type="number"
                    min="0"
                    max="999"
                    step="1"
                    disabled={finished || saving}
                    value={scores[`penaltyScore${side}`]}
                    onChange={(event) => changeScore(`penaltyScore${side}`, event.target.value)}
                    className={`${INPUT_CLASS} text-center`}
                  />
                </Field>
              ))}
            </div>
          </div>
        </div>
      )}
      {!finished && (
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button type="submit" disabled={saving} className="rounded-lg border border-[#0F62FE]/30 bg-[#0F62FE]/10 px-4 py-2.5 text-xs font-bold text-blue-100 transition hover:bg-[#0F62FE]/20 disabled:opacity-50">
            {saving ? 'Zapisywanie…' : match.status === 'SCHEDULED' ? 'Zapisz wynik i rozpocznij' : 'Zapisz wynik na żywo'}
          </button>
          <button type="button" disabled={saving} onClick={(event) => submitScore(event, 'FINISHED')} className="rounded-lg bg-emerald-400/15 px-4 py-2.5 text-xs font-bold text-emerald-100 transition hover:bg-emerald-400/25 disabled:opacity-50">
            Zakończ i zatwierdź
          </button>
        </div>
      )}
      {finished && <p className="mt-3 text-xs text-slate-500">Wynik zatwierdzony i zablokowany przed przypadkową zmianą.</p>}
    </form>
  );
}

function MatchDetailsEditor({ match, participants, onSave, saving }) {
  const [editing, setEditing] = useState(false);
  const [details, setDetails] = useState(() => ({
    player1Id: match.player1Id || '',
    player2Id: match.player2Id || '',
    round: String(match.round || 1),
    groupKey: match.groupKey || '',
    court: match.court || '',
    scheduledAt: toDateInput(match.scheduledAt),
  }));

  function update(field, value) {
    setDetails((current) => ({ ...current, [field]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    const scheduleDetails = {
      court: details.court.trim() || null,
      scheduledAt: details.scheduledAt ? new Date(details.scheduledAt).toISOString() : null,
    };
    const saved = await onSave(match, match.status === 'SCHEDULED'
      ? {
        ...scheduleDetails,
        player1Id: details.player1Id || null,
        player2Id: details.player2Id || null,
        round: Number(details.round),
        groupKey: details.groupKey.trim() || null,
      }
      : scheduleDetails);
    if (saved) setEditing(false);
  }

  return (
    <div className="mt-4 rounded-xl border border-white/[0.06] bg-black/15 p-3">
      <dl className="grid gap-3 text-xs sm:grid-cols-2">
        <div>
          <dt className="text-slate-500">Godzina rozpoczęcia</dt>
          <dd className="mt-1 font-semibold text-slate-200">{match.scheduledAt ? dateLabel(match.scheduledAt) : 'Nie ustalono'}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Lokalizacja / boisko</dt>
          <dd className="mt-1 font-semibold text-slate-200">{match.court || 'Nie ustalono'}</dd>
        </div>
      </dl>
      {!editing ? (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="mt-3 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-[#0F62FE]/30 hover:bg-white/[0.04] hover:text-white"
        >
          Edytuj szczegóły meczu
        </button>
      ) : (
        <form onSubmit={submit} className="rounded-xl border border-[#0F62FE]/20 bg-[#0F62FE]/[0.04] p-4">
          <p className="text-xs font-bold text-white">Szczegóły spotkania</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {match.status === 'SCHEDULED' && (
              <>
                <Field label="Uczestnik A">
                  <select value={details.player1Id} onChange={(event) => update('player1Id', event.target.value)} className={INPUT_CLASS}>
                    <option value="">Wybierz uczestnika</option>
                    {participants.filter(({ user: participant }) => participant.id !== details.player2Id).map(({ user: participant }) => (
                      <option key={participant.id} value={participant.id}>{participant.name}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Uczestnik B">
                  <select value={details.player2Id} onChange={(event) => update('player2Id', event.target.value)} className={INPUT_CLASS}>
                    <option value="">Wybierz uczestnika</option>
                    {participants.filter(({ user: participant }) => participant.id !== details.player1Id).map(({ user: participant }) => (
                      <option key={participant.id} value={participant.id}>{participant.name}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Runda">
                  <input required type="number" min="1" max="64" step="1" value={details.round} onChange={(event) => update('round', event.target.value)} className={INPUT_CLASS} />
                </Field>
              </>
            )}
            <Field label="Boisko / stół">
              <input maxLength="80" value={details.court} onChange={(event) => update('court', event.target.value)} placeholder="np. Boisko A" className={INPUT_CLASS} />
            </Field>
            <Field label="Termin meczu">
              <input type="datetime-local" value={details.scheduledAt} onChange={(event) => update('scheduledAt', event.target.value)} className={INPUT_CLASS} />
            </Field>
            {match.status === 'SCHEDULED' && (
              <Field label="Grupa">
                <input maxLength="80" value={details.groupKey} onChange={(event) => update('groupKey', event.target.value)} placeholder="np. Grupa A" className={INPUT_CLASS} />
              </Field>
            )}
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" disabled={saving} onClick={() => setEditing(false)} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-slate-300 disabled:opacity-50">Anuluj</button>
            <button type="submit" disabled={saving} className="rounded-lg bg-[#0F62FE]/20 px-4 py-2 text-xs font-bold text-blue-100 transition hover:bg-[#0F62FE]/30 disabled:opacity-50">
              {saving ? 'Zapisywanie…' : 'Zapisz szczegóły'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

const INPUT_CLASS = 'min-h-11 w-full rounded-xl border border-white/10 bg-[#090D16] px-3 text-sm text-white placeholder:text-slate-600 focus:border-[#0F62FE] focus:outline-none';
const EMPTY_PARTICIPANTS = [];

export default function OrganizerEventManagement() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tournament, setTournament] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(null);
  const [scheduleNotice, setScheduleNotice] = useState(null);
  const [saving, setSaving] = useState(false);
  const [eventDetailsOpen, setEventDetailsOpen] = useState(false);
  const [savingEventDetails, setSavingEventDetails] = useState(false);
  const [removingId, setRemovingId] = useState('');
  const [matchSaving, setMatchSaving] = useState(false);
  const [savingResultMatchId, setSavingResultMatchId] = useState('');
  const [savingDetailsMatchId, setSavingDetailsMatchId] = useState('');
  const [deletingMatchId, setDeletingMatchId] = useState('');
  const [refereeUsernames, setRefereeUsernames] = useState({});
  const [refereeNotifications, setRefereeNotifications] = useState({});
  const [savingRefereeMatchId, setSavingRefereeMatchId] = useState('');
  const [scheduleGenerating, setScheduleGenerating] = useState(false);
  const [matchForm, setMatchForm] = useState({ player1Id: '', player2Id: '', round: '1', groupKey: '', court: '', scheduledAt: '' });
  const [form, setForm] = useState(null);
  const [eventDetailsForm, setEventDetailsForm] = useState({ date: '', location: '' });

  const loadTournament = useCallback(async () => {
    try {
      const { data } = await api.get(`/tournaments/${id}`);
      const current = data.tournament;
      setTournament(current);
      setError('');
      if (current.organizerId !== user?.id && user?.role !== 'ADMIN') {
        navigate('/organizer', { replace: true });
        return;
      }
      setForm({
        title: current.title || '',
        description: current.description || '',
        date: toDateInput(current.date),
        sportType: current.sportType,
        maxParticipants: String(current.maxParticipants),
        status: current.status,
      });
      setEventDetailsForm({
        date: toDateInput(current.date),
        location: current.location || '',
      });
    } catch (loadError) {
      setError(loadError.response?.data?.message || 'Nie udało się pobrać wydarzenia.');
    } finally {
      setLoading(false);
    }
  }, [id, navigate, user]);

  useEffect(() => {
    const timeout = window.setTimeout(() => { void loadTournament(); }, 0);
    return () => window.clearTimeout(timeout);
  }, [loadTournament]);

  useEffect(() => {
    if (!eventDetailsOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape' && !savingEventDetails) setEventDetailsOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [eventDetailsOpen, savingEventDetails]);

  const participants = tournament?.participants || EMPTY_PARTICIPANTS;
  const matches = tournament?.matches || [];
  const finishedMatches = matches.filter((match) => match.status === 'FINISHED').length;
  const progress = matches.length ? Math.round((finishedMatches / matches.length) * 100) : 0;
  const participantById = useMemo(() => new Map(participants.map(({ user: participant }) => [participant.id, participant.name])), [participants]);

  function notify(message, type = 'success') {
    setNotice({ message, type });
  }

  function openEventDetails() {
    setEventDetailsForm({
      date: toDateInput(tournament.date),
      location: tournament.location || '',
    });
    setEventDetailsOpen(true);
  }

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function saveSettings(event) {
    event.preventDefault();
    setSaving(true);
    setNotice('');
    try {
      await api.patch(`/tournaments/${id}`, {
        title: form.title.trim(),
        description: form.description.trim() || null,
        date: new Date(form.date).toISOString(),
        sportType: form.sportType,
        maxParticipants: Number(form.maxParticipants),
        status: form.status,
      });
      notify('Ustawienia wydarzenia zostały zapisane.');
      await loadTournament();
    } catch (saveError) {
      notify(saveError.response?.data?.message || 'Nie udało się zapisać ustawień.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function saveEventDetails(event) {
    event.preventDefault();
    setSavingEventDetails(true);
    try {
      await api.patch(`/tournaments/${id}`, {
        date: new Date(eventDetailsForm.date).toISOString(),
        location: eventDetailsForm.location.trim() || null,
      });
      setEventDetailsOpen(false);
      notify('Data, godzina i lokalizacja wydarzenia zostały zapisane.');
      await loadTournament();
    } catch (saveError) {
      notify(saveError.response?.data?.message || 'Nie udało się zapisać szczegółów wydarzenia.', 'error');
    } finally {
      setSavingEventDetails(false);
    }
  }

  async function removeParticipant(participant) {
    if (!window.confirm(`Usunąć ${participant.user.name} z listy uczestników?`)) return;
    setRemovingId(participant.userId);
    setNotice('');
    try {
      await api.delete(`/tournaments/${id}/participants/${participant.userId}`);
      notify(`Uczestnik ${participant.user.name} został wypisany.`);
      await loadTournament();
    } catch (removeError) {
      notify(removeError.response?.data?.message || 'Nie udało się usunąć uczestnika.', 'error');
    } finally {
      setRemovingId('');
    }
  }

  async function createMatch(event) {
    event.preventDefault();
    if (!matchForm.player1Id || !matchForm.player2Id) {
      notify('Wybierz obu uczestników meczu.', 'error');
      return;
    }
    setMatchSaving(true);
    setNotice('');
    try {
      await api.post(`/tournaments/${id}/matches`, {
        player1Id: matchForm.player1Id,
        player2Id: matchForm.player2Id,
        round: Number(matchForm.round),
        groupKey: matchForm.groupKey.trim() || undefined,
        court: matchForm.court.trim() || undefined,
        scheduledAt: matchForm.scheduledAt ? new Date(matchForm.scheduledAt).toISOString() : undefined,
      });
      setMatchForm((current) => ({ ...current, player1Id: '', player2Id: '' }));
      notify('Mecz został dodany do harmonogramu.');
      await loadTournament();
    } catch (createError) {
      notify(createError.response?.data?.message || 'Nie udało się utworzyć meczu.', 'error');
    } finally {
      setMatchSaving(false);
    }
  }

  async function saveMatchResult(match, scores, status) {
    if (status === 'FINISHED' && !window.confirm('Zatwierdzić końcowy wynik? Zakończonego meczu nie można ponownie otworzyć ani edytować.')) {
      return;
    }
    setSavingResultMatchId(match.id);
    setNotice('');
    try {
      await api.patch(`/matches/${match.id}`, { ...scores, status });
      notify(status === 'FINISHED' ? 'Wynik zatwierdzony. Tabela i drabinka zostały zaktualizowane.' : 'Wynik meczu został zapisany.');
      await loadTournament();
    } catch (saveError) {
      notify(saveError.response?.data?.message || 'Nie udało się zapisać wyniku meczu.', 'error');
    } finally {
      setSavingResultMatchId('');
    }
  }

  async function saveMatchDetails(match, details) {
    setSavingDetailsMatchId(match.id);
    setNotice(null);
    try {
      await api.patch(`/matches/${match.id}`, details);
      notify('Szczegóły meczu zostały zapisane.');
      await loadTournament();
      return true;
    } catch (saveError) {
      notify(saveError.response?.data?.message || 'Nie udało się zapisać szczegółów meczu.', 'error');
      return false;
    } finally {
      setSavingDetailsMatchId('');
    }
  }

  async function deleteScheduledMatch(match) {
    const firstPlayer = match.player1?.name || 'uczestnik A';
    const secondPlayer = match.player2?.name || 'uczestnik B';
    if (!window.confirm(`Usunąć zaplanowany mecz ${firstPlayer} vs ${secondPlayer}? Tej operacji nie można cofnąć.`)) return;
    setDeletingMatchId(match.id);
    setNotice(null);
    try {
      await api.delete(`/matches/${match.id}`);
      notify('Mecz został usunięty z harmonogramu.');
      await loadTournament();
    } catch (deleteError) {
      notify(deleteError.response?.data?.message || 'Nie udało się usunąć meczu.', 'error');
    } finally {
      setDeletingMatchId('');
    }
  }

  async function assignReferee(match) {
    const username = refereeUsernames[match.id]?.trim();
    if (!username) {
      setRefereeNotifications((current) => ({
        ...current,
        [match.id]: { message: 'Wpisz nazwę użytkownika konta sędziego.', type: 'error' },
      }));
      return;
    }
    setSavingRefereeMatchId(match.id);
    setRefereeNotifications((current) => ({ ...current, [match.id]: null }));
    try {
      const { data } = await api.put(`/matches/${match.id}/referee`, { username });
      setRefereeNotifications((current) => ({
        ...current,
        [match.id]: {
          message: `Sędzia @${data.match.assignedReferee.username} został przydzielony do meczu.`,
          type: 'success',
        },
      }));
      setRefereeUsernames((current) => ({ ...current, [match.id]: '' }));
      await loadTournament();
    } catch (assignError) {
      setRefereeNotifications((current) => ({
        ...current,
        [match.id]: {
          message: assignError.response?.data?.message || 'Nie udało się przydzielić sędziego.',
          type: 'error',
        },
      }));
    } finally {
      setSavingRefereeMatchId('');
    }
  }

  async function unassignReferee(match) {
    if (!window.confirm(`Usunąć sędziego @${match.assignedReferee.username} z tego meczu?`)) return;
    setSavingRefereeMatchId(match.id);
    setNotice(null);
    try {
      await api.delete(`/matches/${match.id}/referee`);
      notify('Sędzia został odłączony od meczu.');
      await loadTournament();
    } catch (unassignError) {
      notify(unassignError.response?.data?.message || 'Nie udało się usunąć sędziego.', 'error');
    } finally {
      setSavingRefereeMatchId('');
    }
  }

  async function generateSchedule() {
    const confirmed = window.confirm(
      `Utworzyć automatyczny harmonogram „${FORMAT_LABELS[tournament.format] || tournament.format}” dla ${participants.length} uczestników? Operacja utworzy mecze dla całego wydarzenia i nie można jej cofnąć.`,
    );
    if (!confirmed) return;

    setScheduleGenerating(true);
    setScheduleNotice(null);
    try {
      const { data } = await api.post(`/tournaments/${id}/generate-schedule`);
      const { matchCount, rounds, byeCount, groups } = data.schedule;
      const groupInfo = groups.length ? ` Utworzono grupy: ${groups.join(', ')}.` : '';
      const byeInfo = byeCount ? ` Automatycznie awansowało ${byeCount} uczestników z wolnym losem.` : '';
      setScheduleNotice({
        message: `Harmonogram gotowy: ${matchCount} meczów w ${rounds} rundach.${groupInfo}${byeInfo}`,
        type: 'success',
      });
      await loadTournament();
    } catch (generateError) {
      setScheduleNotice({
        message: generateError.response?.data?.message || 'Nie udało się wygenerować harmonogramu.',
        type: 'error',
      });
    } finally {
      setScheduleGenerating(false);
    }
  }

  async function deleteEvent() {
    if (!window.confirm(`Usunąć wydarzenie „${tournament.title}” razem ze zgłoszeniami, meczami i historią wyników? Tej operacji nie można cofnąć.`)) return;
    try {
      await api.delete(`/tournaments/${id}`);
      navigate('/organizer', { replace: true, state: { notice: `Wydarzenie „${tournament.title}” zostało usunięte.` } });
    } catch (deleteError) {
      notify(deleteError.response?.data?.message || 'Nie udało się usunąć wydarzenia.', 'error');
    }
  }

  if (loading) {
    return <main className="organizer-dashboard grid min-h-[calc(100vh-5rem)] place-items-center bg-[#090D16] text-white"><p className="animate-pulse text-sm text-slate-400">Ładowanie panelu wydarzenia…</p></main>;
  }
  if (!tournament || !form) {
    return <main className="organizer-dashboard min-h-[calc(100vh-5rem)] bg-[#090D16] px-5 py-10 text-white"><div className="mx-auto max-w-3xl rounded-2xl border border-rose-300/20 bg-rose-300/[0.06] p-5 text-sm text-rose-100" role="alert">{error || 'Nie znaleziono wydarzenia.'}<div><Link to="/organizer" className="mt-4 inline-flex text-xs font-bold text-white underline">Powrót do panelu</Link></div></div></main>;
  }

  return (
    <main className="organizer-dashboard min-h-[calc(100vh-5rem)] overflow-hidden bg-[#090D16] px-4 py-7 text-white sm:px-6 lg:px-8">
      <div className="organizer-aurora organizer-aurora-one" aria-hidden="true" />
      <div className="organizer-aurora organizer-aurora-two" aria-hidden="true" />
      <div className="relative mx-auto max-w-[1320px]">
        <Link to="/organizer" className="organizer-reveal inline-flex items-center gap-2 text-xs font-semibold text-slate-400 transition hover:text-white">← Panel organizatora</Link>
        <header className="organizer-reveal mb-7 mt-5 flex flex-col gap-5 rounded-3xl border border-white/[0.08] bg-[#111827]/85 p-5 sm:p-7 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#81C7FF]">Centrum zarządzania wydarzeniem</p>
              <span className={`rounded-full px-3 py-1 text-[10px] font-bold ${STATUS_STYLES[tournament.status] || STATUS_STYLES.DRAFT}`}>{STATUS_LABELS[tournament.status] || tournament.status}</span>
            </div>
            <h1 className="mt-2 text-3xl font-black tracking-[-0.05em] sm:text-4xl">{tournament.title}</h1>
            <p className="mt-2 text-sm text-slate-400">{dateLabel(tournament.date)}{tournament.location ? ` · ${tournament.location}` : ''}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to={`/tournaments/${id}`} className="rounded-xl border border-white/10 px-4 py-3 text-xs font-bold text-slate-200 transition hover:bg-white/[0.04]">Podgląd publiczny ↗</Link>
            <button type="button" onClick={openEventDetails} className="organizer-primary-button rounded-xl px-4 py-3 text-xs font-bold text-white">Edytuj wydarzenie</button>
          </div>
        </header>

        {notice && (
          <div
            className={`mb-5 flex items-start gap-3 rounded-2xl border p-4 text-sm ${notice.type === 'error' ? 'border-rose-300/25 bg-rose-300/[0.07] text-rose-100' : 'border-emerald-300/20 bg-emerald-300/[0.06] text-emerald-100'}`}
            role={notice.type === 'error' ? 'alert' : 'status'}
            aria-live={notice.type === 'error' ? 'assertive' : 'polite'}
          >
            <span aria-hidden="true" className="font-black">{notice.type === 'error' ? '!' : '✓'}</span>
            <span>{notice.message}</span>
            <button type="button" onClick={() => setNotice(null)} className="ml-auto shrink-0 rounded px-2 text-current/70 hover:text-current" aria-label="Zamknij powiadomienie">
              ×
            </button>
          </div>
        )}
        {error && <div className="mb-5 rounded-2xl border border-rose-300/20 bg-rose-300/[0.06] p-4 text-sm text-rose-100" role="alert">{error}</div>}

        {eventDetailsOpen && (
          <div className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-[#03060c]/80 p-4 backdrop-blur-sm">
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="event-details-title"
              className="w-full max-w-xl rounded-3xl border border-white/10 bg-[#111827] p-5 shadow-2xl shadow-black/50 sm:p-7"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#81C7FF]">Szczegóły wydarzenia</p>
                  <h2 id="event-details-title" className="mt-2 text-2xl font-black text-white">Edytuj wydarzenie</h2>
                  <p className="mt-2 text-sm text-slate-400">Ustaw termin rozpoczęcia oraz lokalizację lub boisko wydarzenia.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setEventDetailsOpen(false)}
                  disabled={savingEventDetails}
                  aria-label="Zamknij panel edycji"
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 text-lg text-slate-400 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-50"
                >
                  ×
                </button>
              </div>
              <form onSubmit={saveEventDetails} className="mt-6">
                <div className="space-y-4">
                  <Field label="Data i godzina wydarzenia">
                    <input
                      required
                      type="datetime-local"
                      value={eventDetailsForm.date}
                      onChange={(event) => setEventDetailsForm((current) => ({ ...current, date: event.target.value }))}
                      className={INPUT_CLASS}
                    />
                  </Field>
                  <Field label="Lokalizacja / boisko" hint="Podaj adres, nazwę obiektu lub numer boiska.">
                    <input
                      maxLength="200"
                      value={eventDetailsForm.location}
                      onChange={(event) => setEventDetailsForm((current) => ({ ...current, location: event.target.value }))}
                      placeholder="np. Hala Miejska · Boisko 2"
                      className={INPUT_CLASS}
                    />
                  </Field>
                </div>
                <div className="mt-7 flex flex-wrap justify-end gap-3 border-t border-white/[0.06] pt-5">
                  <button type="button" disabled={savingEventDetails} onClick={() => setEventDetailsOpen(false)} className="min-h-11 rounded-xl border border-white/10 px-4 text-xs font-bold text-slate-300 transition hover:bg-white/[0.04] disabled:opacity-50">Anuluj</button>
                  <button type="submit" disabled={savingEventDetails || !eventDetailsForm.date} className="organizer-primary-button min-h-11 rounded-xl px-5 text-xs font-bold text-white disabled:opacity-50">
                    {savingEventDetails ? 'Zapisywanie…' : 'Zapisz szczegóły'}
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}

        <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="Zgłoszeni uczestnicy" value={`${participants.length}/${tournament.maxParticipants}`} sublabel={`${Math.max(0, tournament.maxParticipants - participants.length)} wolnych miejsc`} accent="from-blue-500/[0.12] to-transparent" />
          <SummaryCard label="Wszystkie mecze" value={matches.length} sublabel="Zaplanowane w tym wydarzeniu" accent="from-violet-500/[0.12] to-transparent" />
          <SummaryCard label="Mecze na żywo" value={matches.filter((match) => match.status === 'IN_PROGRESS').length} sublabel="Aktualnie rozgrywane" accent="from-emerald-500/[0.12] to-transparent" />
          <SummaryCard label="Postęp rozgrywek" value={`${progress}%`} sublabel={`${finishedMatches} zakończonych meczów`} accent="from-cyan-500/[0.12] to-transparent" />
        </section>

        <nav aria-label="Zarządzanie wydarzeniem" className="mb-6 flex gap-2 overflow-x-auto border-b border-white/[0.07] pb-3">
          {TABS.map((tab) => <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} aria-current={activeTab === tab.id ? 'page' : undefined} className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition ${activeTab === tab.id ? 'bg-white/[0.08] text-white shadow-[inset_0_-2px_0_#39B4FE]' : 'text-slate-500 hover:bg-white/[0.04] hover:text-slate-200'}`}><span className="text-[#39B4FE]">{tab.icon}</span>{tab.label}</button>)}
        </nav>

        {activeTab === 'overview' && (
          <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
            <section className="rounded-3xl border border-white/[0.08] bg-[#111827]/75 p-5 sm:p-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Szybki dostęp</p>
              <h2 className="mt-1 text-xl font-bold">Co chcesz zrobić?</h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {[['participants', 'Przejrzyj zgłoszenia', `${participants.length} uczestników`, '◎'], ['matches', 'Zarządzaj meczami', `${matches.length} w harmonogramie`, '◉'], ['settings', 'Edytuj wydarzenie', 'Data, godzina i lokalizacja', '⚙']].map(([tab, title, detail, icon]) => <button key={tab} type="button" onClick={() => (tab === 'settings' ? openEventDetails() : setActiveTab(tab))} className="group flex items-center gap-4 rounded-2xl border border-white/[0.07] bg-[#0C1220]/80 p-4 text-left transition hover:-translate-y-0.5 hover:border-[#0F62FE]/40"><span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-[#0F62FE]/20 to-[#8A3FFC]/20 text-lg text-[#81C7FF]">{icon}</span><span><span className="block text-sm font-bold text-white">{title}</span><span className="mt-1 block text-xs text-slate-500">{detail}</span></span><span className="ml-auto text-slate-600 transition group-hover:translate-x-1 group-hover:text-white">→</span></button>)}
              </div>
            </section>
            <section className="rounded-3xl border border-white/[0.08] bg-[#111827]/75 p-5 sm:p-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Informacje</p>
              <h2 className="mt-1 text-xl font-bold">Szczegóły wydarzenia</h2>
              <dl className="mt-5 space-y-4 text-sm">
                <div className="flex justify-between gap-4 border-b border-white/[0.06] pb-3"><dt className="text-slate-500">Dyscyplina</dt><dd className="text-right font-semibold">{tournament.sportType}</dd></div>
                <div className="flex justify-between gap-4 border-b border-white/[0.06] pb-3"><dt className="text-slate-500">Format</dt><dd className="text-right font-semibold">{tournament.format || 'Nie określono'}</dd></div>
                <div className="flex justify-between gap-4 border-b border-white/[0.06] pb-3"><dt className="text-slate-500">Rodzaj zgłoszeń</dt><dd className="text-right font-semibold">{tournament.registrationType === 'TEAM' ? 'Drużynowe' : 'Indywidualne'}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-slate-500">Termin zapisów</dt><dd className="text-right font-semibold">{tournament.registrationDeadline ? dateLabel(tournament.registrationDeadline) : 'Nie określono'}</dd></div>
              </dl>
            </section>
            <section className="rounded-3xl border border-white/[0.08] bg-[#111827]/75 p-5 sm:col-span-2 sm:p-6">
              <div className="mb-4 flex items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Harmonogram</p><h2 className="mt-1 text-xl font-bold">Ostatnie mecze</h2></div><button type="button" onClick={() => setActiveTab('matches')} className="text-xs font-semibold text-[#81C7FF]">Wszystkie →</button></div>
              {matches.length ? <div className="grid gap-3 md:grid-cols-2">{matches.slice(0, 4).map((match) => <div key={match.id} className="flex items-center justify-between gap-4 rounded-2xl border border-white/[0.06] bg-[#0C1220]/75 p-4"><div className="min-w-0"><p className="truncate text-sm font-bold">{match.player1?.name || 'Oczekuje'} <span className="text-slate-500">vs</span> {match.player2?.name || 'Oczekuje'}</p><p className="mt-1 text-xs text-slate-500">Runda {match.round}{match.court ? ` · ${match.court}` : ''}</p>{match.scheduledAt && <p className="mt-1 text-xs text-[#81C7FF]">{dateLabel(match.scheduledAt)}</p>}</div><span className="shrink-0 font-mono text-sm text-slate-300">{match.status === 'FINISHED' ? `${match.score1} : ${match.score2}` : STATUS_LABELS[match.status]}</span></div>)}</div> : <p className="rounded-xl border border-dashed border-white/10 p-5 text-sm text-slate-500">Brak zaplanowanych meczów. Dodaj pierwszy mecz w zakładce „Mecze i sędziowie”.</p>}
            </section>
          </div>
        )}

        {activeTab === 'participants' && (
          <section className="overflow-hidden rounded-3xl border border-white/[0.08] bg-[#111827]/80">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-white/[0.06] p-5 sm:p-6"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Rejestr zgłoszeń</p><h2 className="mt-1 text-xl font-bold">Uczestnicy <span className="text-slate-500">({participants.length})</span></h2></div><span className="text-xs text-slate-500">Limit miejsc: {tournament.maxParticipants}</span></div>
            {participants.length ? <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm"><thead className="text-[10px] uppercase tracking-[0.14em] text-slate-500"><tr><th className="px-5 py-3 font-semibold">Uczestnik</th><th className="px-5 py-3 font-semibold">Zgłoszono</th><th className="px-5 py-3 font-semibold">Status</th><th className="px-5 py-3 text-right font-semibold">Akcja</th></tr></thead><tbody className="divide-y divide-white/[0.05]">{participants.map((participant) => <tr key={participant.id} className="transition hover:bg-white/[0.02]"><td className="px-5 py-4"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-[#0F62FE]/30 to-[#8A3FFC]/30 font-bold">{participant.user.name.charAt(0).toUpperCase()}</span><div><p className="font-semibold text-white">{participant.user.name}</p><p className="mt-0.5 text-xs text-slate-500">{participant.user.email}</p></div></div></td><td className="px-5 py-4 text-slate-400">{dateLabel(participant.joinedAt)}</td><td className="px-5 py-4"><span className="rounded-full bg-emerald-300/10 px-2.5 py-1 text-[10px] font-bold text-emerald-200">Zapisany</span></td><td className="px-5 py-4 text-right"><button type="button" disabled={Boolean(removingId)} onClick={() => removeParticipant(participant)} className="rounded-lg border border-rose-300/15 px-3 py-2 text-xs font-semibold text-rose-200 transition hover:bg-rose-300/10 disabled:opacity-50">{removingId === participant.userId ? 'Usuwanie…' : 'Wypisz'}</button></td></tr>)}</tbody></table></div> : <div className="p-12 text-center"><p className="font-bold text-white">Brak zgłoszeń</p><p className="mt-2 text-sm text-slate-500">Uczestnicy pojawią się tutaj po zapisaniu się na wydarzenie.</p></div>}
          </section>
        )}

        {activeTab === 'matches' && (
          <div className="grid gap-5 xl:grid-cols-[0.75fr_1.25fr]">
            <div className="space-y-5">
              <section className="rounded-3xl border border-[#0F62FE]/20 bg-gradient-to-br from-[#0F62FE]/[0.1] via-[#111827]/90 to-[#8A3FFC]/[0.09] p-5 sm:p-6">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#81C7FF]">Szybki start</p>
                <h2 className="mt-1 text-xl font-bold">Automatyczny harmonogram</h2>
                <p className="mt-2 text-xs leading-5 text-slate-400">
                  {FORMAT_LABELS[tournament.format] || tournament.format || 'Wybierz format wydarzenia'} · {participants.length} zapisanych uczestników.
                  {tournament.format === 'ROUND_ROBIN' && ' Każdy zagra z każdym.'}
                  {tournament.format === 'SINGLE_ELIMINATION' && ' Zwycięzcy awansują dalej, wolne losy zostaną obsłużone automatycznie.'}
                  {tournament.format === 'DOUBLE_ELIMINATION' && ' Drabinka zwycięzców i przegranych zakończy się finałem.'}
                  {tournament.format === 'GROUP_STAGE' && ' Uczestnicy zostaną podzieleni na grupy, a mecze w każdej grupie ułożone w rundy.'}
                </p>
                <button
                  type="button"
                  onClick={generateSchedule}
                  disabled={scheduleGenerating
                    || matches.length > 0
                    || participants.length < 2
                    || !FORMAT_LABELS[tournament.format]
                    || (tournament.format === 'DOUBLE_ELIMINATION'
                      && (participants.length & (participants.length - 1)) !== 0)}
                  className="organizer-primary-button mt-4 min-h-12 w-full rounded-xl px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {scheduleGenerating ? 'Generowanie…' : '✦ Utwórz harmonogram automatycznie'}
                </button>
                {scheduleNotice && (
                  <div
                    className={`mt-3 flex items-start gap-2 rounded-xl border p-3 text-xs leading-5 ${scheduleNotice.type === 'error' ? 'border-rose-300/20 bg-rose-300/[0.06] text-rose-100' : 'border-emerald-300/20 bg-emerald-300/[0.06] text-emerald-100'}`}
                    role={scheduleNotice.type === 'error' ? 'alert' : 'status'}
                    aria-live={scheduleNotice.type === 'error' ? 'assertive' : 'polite'}
                  >
                    <span aria-hidden="true" className="font-black">{scheduleNotice.type === 'error' ? '!' : '✓'}</span>
                    <span>{scheduleNotice.message}</span>
                    <button
                      type="button"
                      onClick={() => setScheduleNotice(null)}
                      className="ml-auto shrink-0 rounded px-1 text-current/70 hover:text-current"
                      aria-label="Zamknij powiadomienie o harmonogramie"
                    >
                      ×
                    </button>
                  </div>
                )}
                {matches.length > 0 && <p className="mt-2 text-[11px] text-amber-200">Harmonogram już istnieje. Automatyczne generowanie nie nadpisuje rozegranych ani zaplanowanych meczów.</p>}
                {participants.length < 2 && <p className="mt-2 text-[11px] text-amber-200">Zapisz co najmniej dwóch uczestników, aby wygenerować mecze.</p>}
                {tournament.format === 'DOUBLE_ELIMINATION' && participants.length >= 4 && (participants.length & (participants.length - 1)) !== 0 && <p className="mt-2 text-[11px] text-amber-200">Pełna drabinka podwójnej eliminacji wymaga liczby uczestników będącej potęgą dwójki.</p>}
                {tournament.format === 'GROUP_STAGE' && <p className="mt-2 text-[11px] text-slate-500">Po zakończeniu fazy grupowej dodaj mecze play-off ręcznie.</p>}
              </section>

              <form onSubmit={createMatch} className="h-fit rounded-3xl border border-white/[0.08] bg-[#111827]/80 p-5 sm:p-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#81C7FF]">Harmonogram</p><h2 className="mt-1 text-xl font-bold">Dodaj mecz</h2>
              <div className="mt-5 space-y-4">
                <Field label="Uczestnik A"><select required value={matchForm.player1Id} onChange={(event) => setMatchForm((current) => ({ ...current, player1Id: event.target.value }))} className={INPUT_CLASS}><option value="">Wybierz uczestnika</option>{participants.map(({ user: participant }) => <option key={participant.id} value={participant.id}>{participant.name}</option>)}</select></Field>
                <Field label="Uczestnik B"><select required value={matchForm.player2Id} onChange={(event) => setMatchForm((current) => ({ ...current, player2Id: event.target.value }))} className={INPUT_CLASS}><option value="">Wybierz uczestnika</option>{participants.filter(({ user: participant }) => participant.id !== matchForm.player1Id).map(({ user: participant }) => <option key={participant.id} value={participant.id}>{participant.name}</option>)}</select></Field>
                <div className="grid grid-cols-2 gap-3"><Field label="Runda"><input required min="1" max="64" type="number" value={matchForm.round} onChange={(event) => setMatchForm((current) => ({ ...current, round: event.target.value }))} className={INPUT_CLASS} /></Field><Field label="Boisko / stół"><input maxLength="80" value={matchForm.court} onChange={(event) => setMatchForm((current) => ({ ...current, court: event.target.value }))} placeholder="np. Boisko A" className={INPUT_CLASS} /></Field></div>
                <Field label="Termin meczu"><input type="datetime-local" value={matchForm.scheduledAt} onChange={(event) => setMatchForm((current) => ({ ...current, scheduledAt: event.target.value }))} className={INPUT_CLASS} /></Field>
                {['ROUND_ROBIN', 'GROUP_STAGE'].includes(tournament.format) && <Field label="Grupa"><input maxLength="80" value={matchForm.groupKey} onChange={(event) => setMatchForm((current) => ({ ...current, groupKey: event.target.value }))} placeholder="np. Grupa A" className={INPUT_CLASS} /></Field>}
                <button type="submit" disabled={matchSaving || participants.length < 2} className="organizer-primary-button min-h-12 w-full rounded-xl px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">{matchSaving ? 'Dodawanie…' : '＋ Dodaj do harmonogramu'}</button>
                {participants.length < 2 && <p className="text-xs text-amber-200">Do utworzenia meczu potrzebujesz co najmniej dwóch zgłoszonych uczestników.</p>}
              </div>
              </form>
            </div>

            <section className="rounded-3xl border border-white/[0.08] bg-[#111827]/80 p-5 sm:p-6">
              <div className="mb-5"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Obsada i wyniki</p><h2 className="mt-1 text-xl font-bold">Mecze <span className="text-slate-500">({matches.length})</span></h2></div>
              {matches.length ? (
                <div className="space-y-3">
                  {matches.map((match) => (
                    <article key={match.id} className="rounded-2xl border border-white/[0.07] bg-[#0C1220]/80 p-4">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                              Runda {match.round}{match.groupKey ? ` · ${match.groupKey}` : ''}{match.court ? ` · ${match.court}` : ''}
                            </span>
                            <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${STATUS_STYLES[match.status] || STATUS_STYLES.DRAFT}`}>
                              {STATUS_LABELS[match.status] || match.status}
                            </span>
                          </div>
                          {match.scheduledAt && <p className="mt-1 text-xs text-[#81C7FF]">{dateLabel(match.scheduledAt)}</p>}
                          <p className="mt-2 truncate text-sm font-bold text-white">
                            {match.player1?.name || 'Oczekuje na awans'}
                            <span className="mx-1 text-slate-500">vs</span>
                            {match.player2?.name || 'Oczekuje na awans'}
                          </p>
                        </div>
                        <Link
                          to={`/tournaments/${tournament.id}/matches/${match.id}/live`}
                          className="shrink-0 rounded-lg border border-[#0F62FE]/25 bg-[#0F62FE]/10 px-3 py-2 text-xs font-semibold text-blue-200 transition hover:bg-[#0F62FE]/20"
                        >
                          Śledź wynik{match.status === 'IN_PROGRESS' ? ' · LIVE' : ''}
                        </Link>
                        {match.status === 'SCHEDULED' && (
                          <button
                            type="button"
                            disabled={deletingMatchId === match.id}
                            onClick={() => { void deleteScheduledMatch(match); }}
                            className="shrink-0 rounded-lg border border-rose-300/15 px-3 py-2 text-xs font-semibold text-rose-200 transition hover:bg-rose-300/10 disabled:opacity-50"
                          >
                            {deletingMatchId === match.id ? 'Usuwanie…' : 'Usuń mecz'}
                          </button>
                        )}
                      </div>
                      <MatchDetailsEditor
                        key={`${match.id}-${match.player1Id || ''}-${match.player2Id || ''}-${match.round}-${match.groupKey || ''}-${match.court || ''}-${match.scheduledAt || ''}`}
                        match={match}
                        participants={participants}
                        onSave={saveMatchDetails}
                        saving={savingDetailsMatchId === match.id}
                      />
                      {match.assignedReferee && (
                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#8A3FFC]/20 bg-[#8A3FFC]/[0.06] p-3">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-violet-200">Przydzielony sędzia</p>
                            <p className="mt-1 text-sm font-semibold text-white">{match.assignedReferee.name} <span className="font-normal text-violet-200">@{match.assignedReferee.username}</span></p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Link to={`/referee/${match.id}`} className="rounded-lg bg-[#8A3FFC]/20 px-3 py-2 text-xs font-semibold text-violet-100 hover:bg-[#8A3FFC]/30">Panel sędziego ↗</Link>
                            <button type="button" disabled={savingRefereeMatchId === match.id} onClick={() => unassignReferee(match)} className="rounded-lg border border-rose-300/15 px-3 py-2 text-xs font-semibold text-rose-200 hover:bg-rose-300/10 disabled:opacity-50">
                              {savingRefereeMatchId === match.id ? 'Zapisywanie…' : 'Usuń sędziego'}
                            </button>
                          </div>
                        </div>
                      )}
                      <div className="mt-4 rounded-xl border border-white/[0.06] bg-black/20 p-3">
                        <form onSubmit={(event) => { event.preventDefault(); void assignReferee(match); }} className="flex flex-col gap-2 sm:flex-row">
                          <label className="sr-only" htmlFor={`referee-username-${match.id}`}>Nazwa użytkownika sędziego</label>
                          <input
                            id={`referee-username-${match.id}`}
                            type="text"
                            required
                            minLength="3"
                            maxLength="24"
                            pattern="[A-Za-z0-9_]{3,24}"
                            autoComplete="off"
                            placeholder="Nazwa użytkownika sędziego"
                            value={refereeUsernames[match.id] ?? match.assignedReferee?.username ?? ''}
                            onChange={(event) => {
                              setRefereeUsernames((current) => ({ ...current, [match.id]: event.target.value }));
                              setRefereeNotifications((current) => ({ ...current, [match.id]: null }));
                            }}
                            className="min-h-10 min-w-0 flex-1 rounded-lg border border-white/10 bg-[#090D16] px-3 text-sm text-white placeholder:text-slate-600 focus:border-[#8A3FFC] focus:outline-none"
                          />
                          <button type="submit" disabled={savingRefereeMatchId === match.id} className="rounded-lg bg-[#8A3FFC]/20 px-4 py-2 text-xs font-semibold text-violet-100 transition hover:bg-[#8A3FFC]/30 disabled:opacity-50">
                            {savingRefereeMatchId === match.id ? 'Zapisywanie…' : match.assignedReferee ? 'Zmień sędziego' : 'Przydziel sędziego'}
                          </button>
                        </form>
                        {refereeNotifications[match.id] && (
                          <p
                            className={`mt-2 flex items-start gap-2 text-xs ${refereeNotifications[match.id].type === 'error' ? 'text-rose-200' : 'text-emerald-200'}`}
                            role={refereeNotifications[match.id].type === 'error' ? 'alert' : 'status'}
                            aria-live={refereeNotifications[match.id].type === 'error' ? 'assertive' : 'polite'}
                          >
                            <span aria-hidden="true" className="font-black">{refereeNotifications[match.id].type === 'error' ? '!' : '✓'}</span>
                            <span>{refereeNotifications[match.id].message}</span>
                          </p>
                        )}
                        <p className="mt-2 text-[11px] text-slate-500">Wprowadź unikalną nazwę użytkownika konta z rolą „Sędzia”.</p>
                      </div>
                      {match.player1Id && match.player2Id ? (
                        <MatchResultControls
                          key={`${match.id}-${match.revision}`}
                          match={match}
                          format={tournament.format}
                          onSave={saveMatchResult}
                          saving={savingResultMatchId === match.id}
                        />
                      ) : (
                        <p className="mt-3 text-xs text-slate-500">Wynik będzie dostępny po przypisaniu obu uczestników.</p>
                      )}
                      {match.winnerId && <p className="mt-3 text-xs font-semibold text-emerald-200">Zwycięzca: {participantById.get(match.winnerId) || 'uczestnik'}</p>}
                    </article>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center">
                  <p className="font-bold">Harmonogram jest pusty</p>
                  <p className="mt-2 text-sm text-slate-500">Dodaj pierwszy mecz, wybierając uczestników wydarzenia.</p>
                </div>
              )}
            </section>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
            <form onSubmit={saveSettings} className="rounded-3xl border border-white/[0.08] bg-[#111827]/80 p-5 sm:p-7">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#81C7FF]">Konfiguracja wydarzenia</p><h2 className="mt-1 text-xl font-bold">Ustawienia podstawowe</h2>
              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <div className="sm:col-span-2"><Field label="Nazwa wydarzenia"><input required maxLength="120" value={form.title} onChange={(event) => updateForm('title', event.target.value)} className={INPUT_CLASS} /></Field></div>
                <div className="sm:col-span-2"><Field label="Opis"><textarea rows="4" maxLength="3000" value={form.description} onChange={(event) => updateForm('description', event.target.value)} className={`${INPUT_CLASS} py-3`} /></Field></div>
                <Field label="Termin rozpoczęcia"><input required type="datetime-local" value={form.date} onChange={(event) => updateForm('date', event.target.value)} className={INPUT_CLASS} /></Field>
                <Field label="Dyscyplina"><select value={form.sportType} onChange={(event) => updateForm('sportType', event.target.value)} className={INPUT_CLASS}>{SPORTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
                <Field label="Limit uczestników"><input required type="number" min={Math.max(1, participants.length)} max="10000" value={form.maxParticipants} onChange={(event) => updateForm('maxParticipants', event.target.value)} className={INPUT_CLASS} hint={`Obecnie zapisanych: ${participants.length}`} /></Field>
                <Field label="Status wydarzenia"><select value={form.status} onChange={(event) => updateForm('status', event.target.value)} className={INPUT_CLASS}>{(STATUS_TRANSITIONS[tournament.status] || [tournament.status]).map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}</select></Field>
              </div>
              <div className="mt-7 flex flex-wrap justify-end gap-3 border-t border-white/[0.06] pt-5"><button type="button" onClick={() => setForm({ title: tournament.title || '', description: tournament.description || '', date: toDateInput(tournament.date), sportType: tournament.sportType, maxParticipants: String(tournament.maxParticipants), status: tournament.status })} className="rounded-xl border border-white/10 px-4 py-3 text-xs font-bold text-slate-300 hover:bg-white/[0.04]">Odrzuć zmiany</button><button type="submit" disabled={saving} className="organizer-primary-button rounded-xl px-5 py-3 text-xs font-bold text-white disabled:opacity-50">{saving ? 'Zapisywanie…' : 'Zapisz ustawienia'}</button></div>
            </form>
            <aside className="h-fit rounded-3xl border border-rose-300/15 bg-rose-300/[0.03] p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-rose-200">Strefa niebezpieczna</p><h2 className="mt-2 text-lg font-bold text-white">Usuń wydarzenie</h2><p className="mt-2 text-xs leading-5 text-slate-400">Usunięcie jest trwałe. Skasowane zostaną także zgłoszenia, harmonogram, wyniki i historia meczów.</p><button type="button" onClick={deleteEvent} className="mt-5 min-h-11 w-full rounded-xl border border-rose-300/20 px-4 text-xs font-bold text-rose-200 transition hover:bg-rose-300/10">Usuń wydarzenie</button>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
