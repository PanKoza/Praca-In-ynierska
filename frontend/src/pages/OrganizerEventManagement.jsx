import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { FORMAT_LABELS, MATCH_STATUS, SPORTS, TOURNAMENT_STATUS_LABELS, capacity, formatDateTime, plural, sportLabel } from '../lib/labels';
import Icon from '../components/Icon';
import { Modal, useConfirm } from '../components/Modal';
import Reveal from '../components/Reveal';
import { useTour } from '../components/Tour';
import { Arrow, Avatar, BackLink, FullPageLoader, Notice, SectionHeading, StatTile, StatusChip, TabPanel, Tabs, Title } from '../components/ui';

const TAB_IDS = ['overview', 'participants', 'matches', 'settings'];

const STATUS_LABELS = TOURNAMENT_STATUS_LABELS;

const STATUS_TRANSITIONS = {
  DRAFT: ['DRAFT'],
  OPEN: ['OPEN', 'PUBLISHED', 'IN_PROGRESS', 'CANCELLED'],
  PUBLISHED: ['PUBLISHED', 'OPEN', 'IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['IN_PROGRESS', 'FINISHED', 'CANCELLED'],
  FINISHED: ['FINISHED'],
  CANCELLED: ['CANCELLED'],
};

const TOUR = [
  { target: '[data-tour="event-plan"]', title: 'Plan wydarzenia', body: 'Cztery etapy od zgłoszeń do wyników. Podświetlony etap to Twój następny krok — przycisk obok prowadzi prosto do niego.' },
  { target: '[data-tour="event-tabs"]', title: 'Wszystko w czterech zakładkach', body: 'Uczestnicy, mecze i sędziowie oraz ustawienia. Zakładka „Mecze i sędziowie” to miejsce, gdzie spędzisz najwięcej czasu.' },
  { target: '[data-tour="event-actions"]', title: 'Szybkie akcje', body: 'Podgląd strony, którą widzą uczestnicy, oraz szybka zmiana terminu i lokalizacji.' },
];

function toDateInput(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function dateLabel(value) {
  return formatDateTime(value, { weekday: 'long', month: 'long' }, 'Nie ustalono');
}

function Field({ label, children, hint }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="hint">{hint}</span>}
    </label>
  );
}

/* Collapsible block inside a match card: the summary line shows the current state at a glance. */
function Fold({ icon, title, summary, tone, children, defaultOpen = false }) {
  return (
    <details className="group border-t border-line" open={defaultOpen || undefined}>
      <summary className="flex min-h-[52px] cursor-pointer list-none items-center gap-3 px-4 py-2.5 transition hover:bg-ink/[0.03] sm:px-5 [&::-webkit-details-marker]:hidden">
        <Icon name={icon} size={18} className="shrink-0 text-muted" />
        <span className="shrink-0 text-sm font-semibold text-ink">{title}</span>
        <span className={`min-w-0 flex-1 truncate text-right text-sm ${tone === 'warn' ? 'font-semibold text-warn' : 'text-muted'}`}>{summary}</span>
        <Icon name="chevron-down" size={17} className="shrink-0 text-muted transition-transform duration-300 group-open:rotate-180" />
      </summary>
      <div className="px-4 pb-5 pt-1 sm:px-5">{children}</div>
    </details>
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
    <form onSubmit={(event) => submitScore(event, 'IN_PROGRESS')}>
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
                className="input !min-h-[60px] text-center font-display !text-3xl font-extrabold"
              />
            </Field>
          </div>
        ))}
        <span className="num col-start-2 row-start-1 pb-4 text-3xl text-muted">:</span>
      </div>
      {needsTiebreak && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <fieldset>
            <legend className="label">Dogrywka — dodatkowe punkty</legend>
            <div className="grid grid-cols-2 gap-3">
              {[1, 2].map((side) => (
                <input
                  key={side}
                  aria-label={`Dogrywka — ${match[`player${side}`]?.name || `uczestnik ${side}`}`}
                  type="number"
                  min="0"
                  max="999"
                  step="1"
                  disabled={finished || saving}
                  value={scores[`extraTimeScore${side}`]}
                  onChange={(event) => changeScore(`extraTimeScore${side}`, event.target.value)}
                  className="input input-sm text-center"
                />
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="label">Rzuty karne — wynik serii</legend>
            <div className="grid grid-cols-2 gap-3">
              {[1, 2].map((side) => (
                <input
                  key={side}
                  aria-label={`Rzuty karne — ${match[`player${side}`]?.name || `uczestnik ${side}`}`}
                  type="number"
                  min="0"
                  max="999"
                  step="1"
                  disabled={finished || saving}
                  value={scores[`penaltyScore${side}`]}
                  onChange={(event) => changeScore(`penaltyScore${side}`, event.target.value)}
                  className="input input-sm text-center"
                />
              ))}
            </div>
          </fieldset>
        </div>
      )}
      {!finished && (
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button type="submit" disabled={saving} className="btn btn-ghost btn-sm">
            {saving ? 'Zapisywanie…' : match.status === 'SCHEDULED' ? 'Zapisz wynik i rozpocznij' : 'Zapisz wynik na żywo'}
          </button>
          <button type="button" disabled={saving} onClick={(event) => submitScore(event, 'FINISHED')} className="btn btn-solid btn-sm">
            <Icon name="check" size={16} /> Zakończ i zatwierdź
          </button>
        </div>
      )}
      {finished && <p className="hint">Wynik zatwierdzony i zablokowany przed przypadkową zmianą.</p>}
    </form>
  );
}

function MatchDetailsEditor({ match, participants, onSave, saving }) {
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
    await onSave(match, match.status === 'SCHEDULED'
      ? {
        ...scheduleDetails,
        player1Id: details.player1Id || null,
        player2Id: details.player2Id || null,
        round: Number(details.round),
        groupKey: details.groupKey.trim() || null,
      }
      : scheduleDetails);
  }

  return (
    <form onSubmit={submit}>
      <div className="grid gap-3 sm:grid-cols-2">
        {match.status === 'SCHEDULED' && (
          <>
            <Field label="Uczestnik A">
              <select value={details.player1Id} onChange={(event) => update('player1Id', event.target.value)} className="input input-sm">
                <option value="">Wybierz uczestnika</option>
                {participants.filter(({ user: participant }) => participant.id !== details.player2Id).map(({ user: participant }) => (
                  <option key={participant.id} value={participant.id}>{participant.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Uczestnik B">
              <select value={details.player2Id} onChange={(event) => update('player2Id', event.target.value)} className="input input-sm">
                <option value="">Wybierz uczestnika</option>
                {participants.filter(({ user: participant }) => participant.id !== details.player1Id).map(({ user: participant }) => (
                  <option key={participant.id} value={participant.id}>{participant.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Runda">
              <input required type="number" min="1" max="64" step="1" value={details.round} onChange={(event) => update('round', event.target.value)} className="input input-sm" />
            </Field>
          </>
        )}
        <Field label="Boisko / stół">
          <input maxLength="80" value={details.court} onChange={(event) => update('court', event.target.value)} placeholder="np. Boisko A" className="input input-sm" />
        </Field>
        <Field label="Termin meczu">
          <input type="datetime-local" value={details.scheduledAt} onChange={(event) => update('scheduledAt', event.target.value)} className="input input-sm" />
        </Field>
        {match.status === 'SCHEDULED' && (
          <Field label="Grupa">
            <input maxLength="80" value={details.groupKey} onChange={(event) => update('groupKey', event.target.value)} placeholder="np. Grupa A" className="input input-sm" />
          </Field>
        )}
      </div>
      <div className="mt-4 flex justify-end">
        <button type="submit" disabled={saving} className="btn btn-solid btn-sm">
          {saving ? 'Zapisywanie…' : 'Zapisz szczegóły'}
        </button>
      </div>
    </form>
  );
}

const EMPTY_PARTICIPANTS = [];

export default function OrganizerEventManagement() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const confirm = useConfirm();
  const [tournament, setTournament] = useState(null);
  const [activeTab, setActiveTab] = useState(() => (TAB_IDS.includes(location.state?.tab) ? location.state.tab : 'overview'));
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

  useTour('event', TOUR, { auto: true, ready: !loading && Boolean(tournament) });

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
    if (!await confirm({ title: `Wypisać ${participant.user.name}?`, body: 'Uczestnik zniknie z listy zgłoszeń tego wydarzenia.', confirmLabel: 'Wypisz uczestnika', tone: 'danger' })) return;
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
    if (status === 'FINISHED' && !await confirm({ title: 'Zatwierdzić końcowy wynik?', body: `${match.player1?.name || 'Uczestnik A'} ${scores.score1} : ${scores.score2} ${match.player2?.name || 'Uczestnik B'}. Zakończonego meczu nie można ponownie otworzyć ani edytować.`, confirmLabel: 'Zatwierdź wynik' })) {
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
    if (!await confirm({ title: 'Usunąć zaplanowany mecz?', body: `${firstPlayer} vs ${secondPlayer}. Tej operacji nie można cofnąć.`, confirmLabel: 'Usuń mecz', tone: 'danger' })) return;
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
    if (!await confirm({ title: 'Odłączyć sędziego?', body: `@${match.assignedReferee.username} straci dostęp do panelu tego meczu.`, confirmLabel: 'Usuń sędziego', tone: 'danger' })) return;
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
    const confirmed = await confirm({
      title: 'Utworzyć harmonogram?',
      body: `Format „${FORMAT_LABELS[tournament.format] || tournament.format}”, ${participants.length} uczestników. Operacja utworzy mecze dla całego wydarzenia i nie można jej cofnąć.`,
      confirmLabel: 'Utwórz mecze',
    });
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
    if (!await confirm({ title: `Usunąć „${tournament.title}”?`, body: 'Razem z wydarzeniem znikną zgłoszenia, mecze i historia wyników. Tej operacji nie można cofnąć.', confirmLabel: 'Usuń wydarzenie', tone: 'danger' })) return;
    try {
      await api.delete(`/tournaments/${id}`);
      navigate('/organizer', { replace: true, state: { notice: `Wydarzenie „${tournament.title}” zostało usunięte.` } });
    } catch (deleteError) {
      notify(deleteError.response?.data?.message || 'Nie udało się usunąć wydarzenia.', 'error');
    }
  }

  if (loading) return <FullPageLoader label="Ładowanie panelu wydarzenia…" />;
  if (!tournament || !form) {
    return (
      <main className="page">
        <div className="shell-narrow grid gap-5">
          <Notice tone="danger">{error || 'Nie znaleziono wydarzenia.'}</Notice>
          <div><Link to="/organizer" className="btn btn-ghost"><Icon name="arrow-left" size={18} /> Powrót do panelu</Link></div>
        </div>
      </main>
    );
  }

  const seats = capacity(participants.length, tournament.maxParticipants);
  const liveMatches = matches.filter((match) => match.status === 'IN_PROGRESS').length;
  const playable = (match) => Boolean(match.player1Id && match.player2Id);
  const withoutReferee = matches.filter((match) => match.status === 'SCHEDULED' && playable(match) && !match.assignedReferee).length;
  const doubleEliminationBlocked = tournament.format === 'DOUBLE_ELIMINATION'
    && (participants.length & (participants.length - 1)) !== 0;

  /* The plan turns the whole job into four stages and always points at the next one. */
  const plan = [
    {
      id: 'signups',
      title: 'Zbierz zgłoszenia',
      done: participants.length >= 2,
      detail: `${participants.length} z ${tournament.maxParticipants} miejsc zajętych`,
      help: 'Udostępnij uczestnikom stronę wydarzenia — zapisują się sami. Do harmonogramu potrzeba co najmniej dwóch osób.',
      action: { label: 'Otwórz stronę zapisów', to: `/tournaments/${id}` },
    },
    {
      id: 'schedule',
      title: 'Utwórz harmonogram',
      done: matches.length > 0,
      detail: matches.length ? `${matches.length} ${plural(matches.length, 'mecz', 'mecze', 'meczów')} w harmonogramie` : 'Brak meczów',
      help: 'Jedno kliknięcie utworzy wszystkie mecze zgodnie z formatem wydarzenia. Możesz też dodawać mecze ręcznie.',
      action: { label: 'Przejdź do harmonogramu', tab: 'matches' },
    },
    {
      id: 'referees',
      title: 'Przydziel sędziów',
      done: matches.length > 0 && withoutReferee === 0,
      detail: matches.length ? (withoutReferee ? `${withoutReferee} ${plural(withoutReferee, 'mecz czeka', 'mecze czekają', 'meczów czeka')} na sędziego` : 'Wszystkie mecze obsadzone') : 'Najpierw utwórz mecze',
      help: 'Rozwiń sekcję „Sędzia” przy meczu i wpisz nazwę użytkownika konta sędziego.',
      action: { label: 'Przydziel sędziów', tab: 'matches' },
    },
    {
      id: 'results',
      title: 'Rozegraj mecze',
      done: matches.length > 0 && finishedMatches === matches.length,
      detail: matches.length ? `${finishedMatches} z ${matches.length} zakończonych` : 'Czeka na harmonogram',
      help: 'Sędziowie wprowadzają wyniki na żywo. W razie potrzeby wynik wpiszesz też samodzielnie w sekcji „Wynik”.',
      action: { label: 'Zobacz mecze', tab: 'matches' },
    },
  ];
  const currentIndex = plan.findIndex((stage) => !stage.done);
  const currentStage = currentIndex === -1 ? null : plan[currentIndex];
  const tabs = [
    { id: 'overview', label: 'Przegląd', icon: 'grid' },
    { id: 'participants', label: 'Uczestnicy', icon: 'users', badge: participants.length || null },
    { id: 'matches', label: 'Mecze i sędziowie', icon: 'whistle', badge: liveMatches || null, badgeTone: 'live' },
    { id: 'settings', label: 'Ustawienia', icon: 'sliders' },
  ];

  return (
    <main className="page">
      <div className="shell">
        <BackLink to="/organizer">Panel organizatora</BackLink>

        <header className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <p className="eyebrow">Zarządzanie wydarzeniem</p>
              <StatusChip status={tournament.status} />
            </div>
            <Title>{tournament.title}</Title>
            <p className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[0.9375rem] text-muted">
              <span className="flex items-center gap-2"><Icon name="calendar" size={17} />{dateLabel(tournament.date)}</span>
              {tournament.location && <span className="flex items-center gap-2"><Icon name="pin" size={17} />{tournament.location}</span>}
            </p>
          </div>
          <div className="flex flex-wrap gap-2" data-tour="event-actions">
            <Link to={`/tournaments/${id}`} className="btn btn-ghost"><Icon name="eye" size={18} /> Podgląd publiczny</Link>
            <button type="button" onClick={openEventDetails} className="btn btn-solid"><Icon name="edit" size={18} /> Termin i miejsce</button>
          </div>
        </header>

        {notice && (
          <Notice key={notice.message} tone={notice.type === 'error' ? 'danger' : 'ok'} className="mb-6" onClose={() => setNotice(null)}>
            {notice.message}
          </Notice>
        )}
        {error && <Notice tone="danger" className="mb-6">{error}</Notice>}

        {eventDetailsOpen && (
          <Modal labelledBy="event-details-title" onClose={() => setEventDetailsOpen(false)} busy={savingEventDetails} className="!w-[min(100%,34rem)]">
            <div className="p-6 sm:p-7">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="eyebrow mb-3">Szczegóły wydarzenia</p>
                  <h2 id="event-details-title" className="h-section">Termin i miejsce</h2>
                  <p className="mt-2 text-sm text-muted">Ustaw termin rozpoczęcia oraz lokalizację lub boisko wydarzenia.</p>
                </div>
                <button type="button" onClick={() => setEventDetailsOpen(false)} disabled={savingEventDetails} aria-label="Zamknij panel edycji" className="icon-btn">
                  <Icon name="x" size={19} />
                </button>
              </div>
              <form onSubmit={saveEventDetails} className="mt-6">
                <div className="grid gap-5">
                  <Field label="Data i godzina wydarzenia">
                    <input
                      required
                      type="datetime-local"
                      data-autofocus
                      value={eventDetailsForm.date}
                      onChange={(event) => setEventDetailsForm((current) => ({ ...current, date: event.target.value }))}
                      className="input"
                    />
                  </Field>
                  <Field label="Lokalizacja / boisko" hint="Podaj adres, nazwę obiektu lub numer boiska.">
                    <input
                      maxLength="200"
                      value={eventDetailsForm.location}
                      onChange={(event) => setEventDetailsForm((current) => ({ ...current, location: event.target.value }))}
                      placeholder="np. Hala Miejska · Boisko 2"
                      className="input"
                    />
                  </Field>
                </div>
                <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <button type="button" disabled={savingEventDetails} onClick={() => setEventDetailsOpen(false)} className="btn btn-ghost">Anuluj</button>
                  <button type="submit" disabled={savingEventDetails || !eventDetailsForm.date} className="btn btn-primary">
                    {savingEventDetails ? 'Zapisywanie…' : 'Zapisz szczegóły'}
                  </button>
                </div>
              </form>
            </div>
          </Modal>
        )}

        <Reveal as="section" className="card mb-8 overflow-hidden" aria-labelledby="plan-heading" data-tour="event-plan">
          <div className="flex flex-col gap-4 border-b border-line p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="min-w-0">
              <p className="eyebrow eyebrow-plain mb-1.5">Plan wydarzenia</p>
              <h2 id="plan-heading" className="h-section">
                {currentStage ? <>Następny krok: <span className="marker">{currentStage.title}</span></> : 'Wszystko rozegrane'}
              </h2>
              <p className="mt-2 max-w-2xl text-[0.9375rem] leading-relaxed text-muted">
                {currentStage ? currentStage.help : 'Wszystkie mecze są zakończone. Możesz zmienić status wydarzenia na „Zakończony” w ustawieniach.'}
              </p>
            </div>
            {currentStage && (
              currentStage.action.to
                ? <Link to={currentStage.action.to} className="btn btn-primary shrink-0">{currentStage.action.label} <Arrow /></Link>
                : <button type="button" onClick={() => setActiveTab(currentStage.action.tab)} className="btn btn-primary shrink-0">{currentStage.action.label} <Arrow /></button>
            )}
            {!currentStage && tournament.status === 'IN_PROGRESS' && (
              <button type="button" onClick={() => setActiveTab('settings')} className="btn btn-primary shrink-0">Przejdź do ustawień <Arrow /></button>
            )}
          </div>
          <ol className="steps p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-4">
            {plan.map((stage, index) => {
              const state = stage.done ? 'done' : index === currentIndex ? 'current' : 'todo';
              return (
                <li key={stage.id} className="step" data-state={state} aria-current={state === 'current' ? 'step' : undefined}>
                  <span className="step-index">{stage.done ? <Icon name="check" size={16} strokeWidth={2.5} /> : index + 1}</span>
                  <span className="min-w-0">
                    <span className="block font-semibold text-ink">{stage.title}</span>
                    <span className="mt-0.5 block text-sm text-muted">{stage.detail}</span>
                  </span>
                </li>
              );
            })}
          </ol>
        </Reveal>

        <Tabs tabs={tabs} value={activeTab} onChange={setActiveTab} label="Zarządzanie wydarzeniem" className="mb-8" data-tour="event-tabs" />

        <TabPanel id={activeTab}>
          {activeTab === 'overview' && (
            <div className="grid gap-10">
              <section className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="Podsumowanie wydarzenia">
                <StatTile label="Zgłoszeni uczestnicy" value={`${seats.taken}/${seats.limit}`} detail={`${seats.free} ${plural(seats.free, 'wolne miejsce', 'wolne miejsca', 'wolnych miejsc')}`} icon="users" />
                <StatTile label="Wszystkie mecze" value={matches.length} detail="Zaplanowane w tym wydarzeniu" icon="list" />
                <StatTile label="Mecze na żywo" value={liveMatches} detail="Aktualnie rozgrywane" icon="bolt" tone={liveMatches ? 'live' : undefined} />
                <StatTile label="Postęp rozgrywek" value={progress} suffix="%" detail={`${finishedMatches} ${plural(finishedMatches, 'zakończony mecz', 'zakończone mecze', 'zakończonych meczów')}`} icon="check" />
              </section>

              <div className="grid gap-10 xl:grid-cols-[1.2fr_0.8fr] xl:gap-8">
                <section>
                  <SectionHeading
                    eyebrow="Harmonogram"
                    title="Ostatnie mecze"
                    action={<button type="button" onClick={() => setActiveTab('matches')} className="link text-sm">Wszystkie <Icon name="arrow-right" size={15} /></button>}
                  />
                  {matches.length ? (
                    <div className="grid gap-3">
                      {matches.slice(0, 4).map((match) => (
                        <div key={match.id} className="card flex items-center justify-between gap-4 p-4">
                          <div className="min-w-0">
                            <p className="break-words font-semibold text-ink">{match.player1?.name || 'Oczekuje'} <span className="text-muted">vs</span> {match.player2?.name || 'Oczekuje'}</p>
                            <p className="mono mt-1 text-xs text-muted">
                              Runda {match.round}{match.court ? ` · ${match.court}` : ''}{match.scheduledAt ? ` · ${formatDateTime(match.scheduledAt)}` : ''}
                            </p>
                          </div>
                          {match.status === 'FINISHED'
                            ? <span className="num shrink-0 text-3xl">{match.score1}:{match.score2}</span>
                            : <StatusChip status={match.status} kind="match" />}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="well p-5 text-sm text-muted">Brak zaplanowanych meczów. Utwórz harmonogram w zakładce „Mecze i sędziowie”.</p>
                  )}
                </section>

                <section>
                  <SectionHeading eyebrow="Informacje" title="Szczegóły" />
                  <dl className="card divide-y divide-line">
                    {[
                      ['Dyscyplina', sportLabel(tournament.sportType)],
                      ['Format', FORMAT_LABELS[tournament.format] || tournament.format || 'Nie określono'],
                      ['Rodzaj zgłoszeń', tournament.registrationType === 'TEAM' ? 'Drużynowe' : 'Indywidualne'],
                      ['Termin zapisów', tournament.registrationDeadline ? dateLabel(tournament.registrationDeadline) : 'Nie określono'],
                    ].map(([label, value]) => (
                      <div key={label} className="flex justify-between gap-4 px-5 py-3.5 text-[0.9375rem]">
                        <dt className="text-muted">{label}</dt>
                        <dd className="text-right font-semibold text-ink">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              </div>
            </div>
          )}

          {activeTab === 'participants' && (
            <section>
              <SectionHeading
                eyebrow="Rejestr zgłoszeń"
                title="Uczestnicy"
                count={participants.length}
                action={<p className="text-sm text-muted">Limit miejsc: {tournament.maxParticipants}</p>}
              />
              {participants.length ? (
                <div className="card overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="table min-w-[600px]">
                      <thead><tr><th scope="col">Uczestnik</th><th scope="col">Zgłoszono</th><th scope="col" className="!text-right">Akcja</th></tr></thead>
                      <tbody>
                        {participants.map((participant) => (
                          <tr key={participant.id}>
                            <td>
                              <div className="flex items-center gap-3">
                                <Avatar name={participant.user.name} />
                                <div>
                                  <p className="font-semibold text-ink">{participant.user.name}</p>
                                  <p className="mt-0.5 text-sm text-muted">{participant.user.email}</p>
                                </div>
                              </div>
                            </td>
                            <td className="mono text-sm text-muted">{formatDateTime(participant.joinedAt)}</td>
                            <td className="text-right">
                              <button type="button" disabled={Boolean(removingId)} onClick={() => removeParticipant(participant)} className="btn btn-danger btn-sm">
                                {removingId === participant.userId ? 'Usuwanie…' : 'Wypisz'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="empty">
                  <span className="empty-icon"><Icon name="users" size={26} /></span>
                  <h3 className="h-card">Brak zgłoszeń</h3>
                  <p className="max-w-md text-[0.9375rem] text-muted">Uczestnicy pojawią się tutaj po zapisaniu się na wydarzenie. Udostępnij im stronę zapisów.</p>
                  <Link to={`/tournaments/${id}`} className="btn btn-ghost mt-4">Otwórz stronę zapisów <Arrow /></Link>
                </div>
              )}
            </section>
          )}

          {activeTab === 'matches' && (
            <div className="grid gap-8 xl:grid-cols-[0.75fr_1.25fr] xl:items-start">
              <div className="grid gap-5">
                <section className={`card card-pad ${matches.length === 0 ? '!border-ink' : ''}`}>
                  <p className="eyebrow mb-3">Szybki start</p>
                  <h2 className="h-card">Automatyczny harmonogram</h2>
                  <p className="mt-2 text-sm leading-relaxed text-muted">
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
                      || doubleEliminationBlocked}
                    className="btn btn-primary btn-block mt-5"
                  >
                    <Icon name="bracket" size={18} />
                    {scheduleGenerating ? 'Generowanie…' : 'Utwórz harmonogram automatycznie'}
                  </button>
                  {scheduleNotice && (
                    <Notice tone={scheduleNotice.type === 'error' ? 'danger' : 'ok'} className="mt-4 !text-sm" onClose={() => setScheduleNotice(null)}>
                      {scheduleNotice.message}
                    </Notice>
                  )}
                  <div className="mt-3 grid gap-1.5 text-[0.8125rem] leading-snug">
                    {matches.length > 0 && <p className="flex gap-2 text-muted"><Icon name="info" size={15} className="mt-0.5 shrink-0" />Harmonogram już istnieje. Automatyczne generowanie nie nadpisuje rozegranych ani zaplanowanych meczów.</p>}
                    {participants.length < 2 && <p className="flex gap-2 font-semibold text-warn"><Icon name="alert" size={15} className="mt-0.5 shrink-0" />Zapisz co najmniej dwóch uczestników, aby wygenerować mecze.</p>}
                    {tournament.format === 'DOUBLE_ELIMINATION' && participants.length >= 4 && doubleEliminationBlocked && <p className="flex gap-2 font-semibold text-warn"><Icon name="alert" size={15} className="mt-0.5 shrink-0" />Pełna drabinka podwójnej eliminacji wymaga liczby uczestników będącej potęgą dwójki.</p>}
                    {tournament.format === 'GROUP_STAGE' && <p className="flex gap-2 text-muted"><Icon name="info" size={15} className="mt-0.5 shrink-0" />Po zakończeniu fazy grupowej dodaj mecze play-off ręcznie.</p>}
                  </div>
                </section>

                <details className="group card">
                  <summary className="flex min-h-[64px] cursor-pointer list-none items-center justify-between gap-3 px-5 sm:px-7 [&::-webkit-details-marker]:hidden">
                    <span className="flex items-center gap-3">
                      <Icon name="plus" size={19} />
                      <span className="h-card">Dodaj mecz ręcznie</span>
                    </span>
                    <Icon name="chevron-down" size={18} className="text-muted transition-transform duration-300 group-open:rotate-180" />
                  </summary>
                  <form onSubmit={createMatch} className="grid gap-4 border-t border-line p-5 sm:p-7">
                    <Field label="Uczestnik A"><select required value={matchForm.player1Id} onChange={(event) => setMatchForm((current) => ({ ...current, player1Id: event.target.value }))} className="input"><option value="">Wybierz uczestnika</option>{participants.map(({ user: participant }) => <option key={participant.id} value={participant.id}>{participant.name}</option>)}</select></Field>
                    <Field label="Uczestnik B"><select required value={matchForm.player2Id} onChange={(event) => setMatchForm((current) => ({ ...current, player2Id: event.target.value }))} className="input"><option value="">Wybierz uczestnika</option>{participants.filter(({ user: participant }) => participant.id !== matchForm.player1Id).map(({ user: participant }) => <option key={participant.id} value={participant.id}>{participant.name}</option>)}</select></Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Runda"><input required min="1" max="64" type="number" value={matchForm.round} onChange={(event) => setMatchForm((current) => ({ ...current, round: event.target.value }))} className="input" /></Field>
                      <Field label="Boisko / stół"><input maxLength="80" value={matchForm.court} onChange={(event) => setMatchForm((current) => ({ ...current, court: event.target.value }))} placeholder="np. Boisko A" className="input" /></Field>
                    </div>
                    <Field label="Termin meczu"><input type="datetime-local" value={matchForm.scheduledAt} onChange={(event) => setMatchForm((current) => ({ ...current, scheduledAt: event.target.value }))} className="input" /></Field>
                    {['ROUND_ROBIN', 'GROUP_STAGE'].includes(tournament.format) && <Field label="Grupa"><input maxLength="80" value={matchForm.groupKey} onChange={(event) => setMatchForm((current) => ({ ...current, groupKey: event.target.value }))} placeholder="np. Grupa A" className="input" /></Field>}
                    <button type="submit" disabled={matchSaving || participants.length < 2} className="btn btn-solid btn-block">
                      <Icon name="plus" size={18} /> {matchSaving ? 'Dodawanie…' : 'Dodaj do harmonogramu'}
                    </button>
                    {participants.length < 2 && <p className="text-[0.8125rem] font-semibold text-warn">Do utworzenia meczu potrzebujesz co najmniej dwóch zgłoszonych uczestników.</p>}
                  </form>
                </details>
              </div>

              <section>
                <SectionHeading eyebrow="Obsada i wyniki" title="Mecze" count={matches.length} />
                {matches.length ? (
                  <div className="grid gap-4">
                    {matches.map((match) => {
                      const live = match.status === 'IN_PROGRESS';
                      const showScore = live || match.status === 'FINISHED';
                      const refereeNote = refereeNotifications[match.id];
                      return (
                        <article key={match.id} className={`card overflow-hidden ${live ? '!border-live/50' : ''}`}>
                          <div className="p-4 sm:p-5">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="chip" data-tone={MATCH_STATUS[match.status]?.tone}>
                                  {live && <span className="live-dot" aria-hidden="true" />}
                                  {MATCH_STATUS[match.status]?.label || match.status}
                                </span>
                                <span className="mono text-xs text-muted">
                                  Runda {match.round}{match.groupKey ? ` · ${match.groupKey}` : ''}
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <Link to={`/tournaments/${tournament.id}/matches/${match.id}/live`} className={`btn btn-sm ${live ? 'btn-primary' : 'btn-ghost'}`}>
                                  {live ? 'Oglądaj na żywo' : 'Śledź wynik'}
                                </Link>
                                {match.status === 'SCHEDULED' && (
                                  <button
                                    type="button"
                                    disabled={deletingMatchId === match.id}
                                    onClick={() => { void deleteScheduledMatch(match); }}
                                    className="btn btn-danger btn-sm"
                                    aria-label="Usuń mecz"
                                    title="Usuń mecz"
                                  >
                                    <Icon name="trash" size={16} />
                                    {deletingMatchId === match.id ? 'Usuwanie…' : <span className="sr-only sm:not-sr-only">Usuń</span>}
                                  </button>
                                )}
                              </div>
                            </div>
                            <p className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1 font-display text-2xl font-bold uppercase leading-tight text-ink">
                              <span className="min-w-0 break-words">{match.player1?.name || 'Oczekuje na awans'}</span>
                              <span className="num text-3xl">{showScore ? `${match.score1 ?? 0}:${match.score2 ?? 0}` : <span className="text-lg text-muted">vs</span>}</span>
                              <span className="min-w-0 break-words">{match.player2?.name || 'Oczekuje na awans'}</span>
                            </p>
                            {match.winnerId && (
                              <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-ink"><Icon name="trophy" size={16} />Zwycięzca: {participantById.get(match.winnerId) || 'uczestnik'}</p>
                            )}
                          </div>

                          <Fold
                            icon="calendar"
                            title="Termin i boisko"
                            summary={[match.scheduledAt ? formatDateTime(match.scheduledAt) : null, match.court].filter(Boolean).join(' · ') || 'Nie ustalono'}
                          >
                            <MatchDetailsEditor
                              key={`${match.id}-${match.player1Id || ''}-${match.player2Id || ''}-${match.round}-${match.groupKey || ''}-${match.court || ''}-${match.scheduledAt || ''}`}
                              match={match}
                              participants={participants}
                              onSave={saveMatchDetails}
                              saving={savingDetailsMatchId === match.id}
                            />
                          </Fold>

                          <Fold
                            icon="whistle"
                            title="Sędzia"
                            summary={match.assignedReferee ? `${match.assignedReferee.name} · @${match.assignedReferee.username}` : 'Nie przydzielono'}
                            tone={!match.assignedReferee && match.status === 'SCHEDULED' ? 'warn' : undefined}
                          >
                            {match.assignedReferee && (
                              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-line bg-bg p-3">
                                <p className="text-sm font-semibold text-ink">{match.assignedReferee.name} <span className="mono font-normal text-muted">@{match.assignedReferee.username}</span></p>
                                <div className="flex flex-wrap gap-2">
                                  <Link to={`/referee/${match.id}`} className="btn btn-ghost btn-sm">Panel sędziego <Icon name="arrow-up-right" size={16} /></Link>
                                  <button type="button" disabled={savingRefereeMatchId === match.id} onClick={() => unassignReferee(match)} className="btn btn-danger btn-sm">
                                    {savingRefereeMatchId === match.id ? 'Zapisywanie…' : 'Usuń sędziego'}
                                  </button>
                                </div>
                              </div>
                            )}
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
                                className="input input-sm min-w-0 flex-1"
                              />
                              <button type="submit" disabled={savingRefereeMatchId === match.id} className="btn btn-solid btn-sm">
                                {savingRefereeMatchId === match.id ? 'Zapisywanie…' : match.assignedReferee ? 'Zmień sędziego' : 'Przydziel sędziego'}
                              </button>
                            </form>
                            {refereeNote && (
                              <p
                                className={`mt-2 flex items-start gap-2 text-sm font-semibold ${refereeNote.type === 'error' ? 'text-danger' : 'text-ok'}`}
                                role={refereeNote.type === 'error' ? 'alert' : 'status'}
                                aria-live={refereeNote.type === 'error' ? 'assertive' : 'polite'}
                              >
                                <Icon name={refereeNote.type === 'error' ? 'alert' : 'check'} size={16} className="mt-0.5 shrink-0" />
                                <span>{refereeNote.message}</span>
                              </p>
                            )}
                            <p className="hint">Wpisz nazwę użytkownika konta z rolą „Sędzia” — znajdzie mecz w swoim panelu.</p>
                          </Fold>

                          <Fold
                            icon="edit"
                            title="Wynik"
                            summary={playable(match) ? (match.status === 'FINISHED' ? 'Zatwierdzony' : 'Wpisz ręcznie') : 'Czeka na uczestników'}
                          >
                            {playable(match) ? (
                              <MatchResultControls
                                key={`${match.id}-${match.revision}`}
                                match={match}
                                format={tournament.format}
                                onSave={saveMatchResult}
                                saving={savingResultMatchId === match.id}
                              />
                            ) : (
                              <p className="text-sm text-muted">Wynik będzie dostępny po przypisaniu obu uczestników.</p>
                            )}
                          </Fold>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <div className="empty">
                    <span className="empty-icon"><Icon name="bracket" size={26} /></span>
                    <h3 className="h-card">Harmonogram jest pusty</h3>
                    <p className="max-w-md text-[0.9375rem] text-muted">
                      {participants.length >= 2
                        ? 'Użyj przycisku „Utwórz harmonogram automatycznie” albo dodaj pierwszy mecz ręcznie.'
                        : 'Gdy zapiszą się co najmniej dwie osoby, utworzysz tu mecze jednym kliknięciem.'}
                    </p>
                  </div>
                )}
              </section>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="grid gap-6 xl:grid-cols-[1fr_340px] xl:items-start">
              <form onSubmit={saveSettings} className="card card-pad">
                <p className="eyebrow mb-3">Konfiguracja wydarzenia</p>
                <h2 className="h-section">Ustawienia podstawowe</h2>
                <div className="mt-6 grid gap-5 sm:grid-cols-2">
                  <div className="sm:col-span-2"><Field label="Nazwa wydarzenia"><input required maxLength="120" value={form.title} onChange={(event) => updateForm('title', event.target.value)} className="input" /></Field></div>
                  <div className="sm:col-span-2"><Field label="Opis"><textarea rows="4" maxLength="3000" value={form.description} onChange={(event) => updateForm('description', event.target.value)} className="input" /></Field></div>
                  <Field label="Termin rozpoczęcia"><input required type="datetime-local" value={form.date} onChange={(event) => updateForm('date', event.target.value)} className="input" /></Field>
                  <Field label="Dyscyplina"><select value={form.sportType} onChange={(event) => updateForm('sportType', event.target.value)} className="input">{SPORTS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}</select></Field>
                  <Field label="Limit uczestników" hint={`Obecnie zapisanych: ${participants.length}`}><input required type="number" min={Math.max(1, participants.length)} max="10000" value={form.maxParticipants} onChange={(event) => updateForm('maxParticipants', event.target.value)} className="input" /></Field>
                  <Field label="Status wydarzenia"><select value={form.status} onChange={(event) => updateForm('status', event.target.value)} className="input">{(STATUS_TRANSITIONS[tournament.status] || [tournament.status]).map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}</select></Field>
                </div>
                <div className="mt-7 flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:justify-end">
                  <button type="button" onClick={() => setForm({ title: tournament.title || '', description: tournament.description || '', date: toDateInput(tournament.date), sportType: tournament.sportType, maxParticipants: String(tournament.maxParticipants), status: tournament.status })} className="btn btn-ghost">Odrzuć zmiany</button>
                  <button type="submit" disabled={saving} className="btn btn-primary"><Icon name="save" size={18} /> {saving ? 'Zapisywanie…' : 'Zapisz ustawienia'}</button>
                </div>
              </form>
              <aside className="rounded-card border-[1.5px] border-danger/40 bg-danger/[0.04] p-5 sm:p-6">
                <p className="mono text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-danger">Strefa niebezpieczna</p>
                <h2 className="h-card mt-2">Usuń wydarzenie</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted">Usunięcie jest trwałe. Skasowane zostaną także zgłoszenia, harmonogram, wyniki i historia meczów.</p>
                <button type="button" onClick={deleteEvent} className="btn btn-danger btn-block mt-5"><Icon name="trash" size={18} /> Usuń wydarzenie</button>
              </aside>
            </div>
          )}
        </TabPanel>
      </div>
    </main>
  );
}
