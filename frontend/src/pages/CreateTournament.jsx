import { cloneElement, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api/axios';

const STEPS = [
  { title: 'Informacje', description: 'Podstawowe dane' },
  { title: 'Format', description: 'Drabinka i rozstawienie' },
  { title: 'Zasady', description: 'Zgłoszenia i opłaty' },
  { title: 'Podsumowanie', description: 'Weryfikacja i publikacja' },
];

const SPORTS = [
  ['BEACH_VOLLEYBALL', 'Siatkówka plażowa'],
  ['FOOTBALL_6V6', 'Piłka nożna 6v6'],
  ['SOCCER', 'Piłka nożna'],
  ['BASKETBALL', 'Koszykówka'],
  ['VOLLEYBALL', 'Siatkówka'],
  ['TENNIS', 'Tenis'],
  ['ESPORTS', 'E-sport'],
  ['CUSTOM', 'Inna dyscyplina'],
  ['OTHER', 'Inne'],
];

const FORMATS = [
  ['SINGLE_ELIMINATION', 'Pojedyncza eliminacja', 'Przegrana kończy udział w turnieju.'],
  ['DOUBLE_ELIMINATION', 'Podwójna eliminacja', 'Dwie porażki eliminują uczestnika.'],
  ['ROUND_ROBIN', 'Każdy z każdym', 'Każdy uczestnik rozgrywa mecz z każdym.'],
  ['GROUP_STAGE', 'Grupy i play-offy', 'Faza grupowa zakończona drabinką pucharową.'],
];

const INITIAL_FORM = {
  title: '',
  description: '',
  sportType: 'SOCCER',
  date: '',
  endDate: '',
  registrationDeadline: '',
  locationType: 'PHYSICAL',
  location: '',
  format: 'SINGLE_ELIMINATION',
  maxParticipants: '16',
  allowByes: true,
  seeding: 'RANDOM',
  registrationType: 'TEAM',
  minTeamSize: '5',
  maxTeamSize: '11',
  entryFee: '',
  currency: 'PLN',
  autoApprove: false,
};

const INPUT_CLASS = 'w-full rounded-xl border border-white/10 bg-[#090D16] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-[#0F62FE] focus:ring-2 focus:ring-[#0F62FE]/20';

function localDraftKey(id) {
  return `tourniDesk.eventWizard.${id}`;
}

function getLocalDateOffset(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function validateStep(step, form) {
  const errors = {};
  if (step === 1) {
    if (!form.title.trim()) errors.title = 'Podaj nazwę wydarzenia.';
    if (!form.date) errors.date = 'Wybierz datę rozpoczęcia.';
    if (form.endDate && form.endDate < form.date) errors.endDate = 'Zakończenie nie może być wcześniejsze niż rozpoczęcie.';
    if (form.registrationDeadline && form.registrationDeadline > form.date) {
      errors.registrationDeadline = 'Termin zapisów musi przypadać przed rozpoczęciem wydarzenia.';
    }
    if (!form.location.trim()) errors.location = 'Podaj lokalizację wydarzenia.';
  }
  if (step === 2) {
    const capacity = Number(form.maxParticipants);
    if (!Number.isInteger(capacity) || capacity < 2 || capacity > 256) {
      errors.maxParticipants = 'Limit uczestników musi wynosić od 2 do 256.';
    } else if (!form.allowByes && (capacity & (capacity - 1)) !== 0) {
      errors.maxParticipants = 'Bez wolnych losów wybierz potęgę dwójki: 8, 16, 32 lub 64.';
    }
  }
  if (step === 3) {
    const min = Number(form.minTeamSize);
    const max = Number(form.maxTeamSize);
    if (form.registrationType === 'TEAM' && (!Number.isInteger(min) || min < 1)) {
      errors.minTeamSize = 'Minimalny skład musi wynosić co najmniej 1.';
    }
    if (form.registrationType === 'TEAM' && (!Number.isInteger(max) || max < min)) {
      errors.maxTeamSize = 'Maksymalny skład nie może być mniejszy od minimalnego.';
    }
    if (form.entryFee !== '' && (!Number.isFinite(Number(form.entryFee)) || Number(form.entryFee) < 0)) {
      errors.entryFee = 'Opłata musi być nieujemną kwotą.';
    }
  }
  return errors;
}

export default function CreateTournament() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState(INITIAL_FORM);
  const [step, setStep] = useState(1);
  const [draftId, setDraftId] = useState('');
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [preview, setPreview] = useState(null);
  const queue = useRef(Promise.resolve());
  const hydrated = useRef(false);
  const draftRequest = useRef(null);

  const reportSaveError = useCallback((saveError) => {
    setError(saveError.response?.data?.message || 'Nie udało się zapisać szkicu. Dane pozostają zapisane lokalnie.');
    setErrors(saveError.response?.data?.errors || {});
    setSaving(false);
  }, []);

  const saveDraft = useCallback((id, data, requestedStep, fromStep = requestedStep) => {
    setSaving(true);
    setError('');
    queue.current = queue.current
      .catch((previousError) => {
        reportSaveError(previousError);
      })
      .then(() => api.patch(`/tournaments/drafts/${id}`, { data, step: requestedStep, fromStep }))
      .then(() => {
        setSaving(false);
        return true;
      })
      .catch((saveError) => {
        reportSaveError(saveError);
        return false;
      });
    return queue.current;
  }, [reportSaveError]);

  useEffect(() => {
    let active = true;
    async function loadDraft() {
      try {
        if (!draftRequest.current) {
          draftRequest.current = (async () => {
            const existingId = localStorage.getItem('tourniDesk.eventWizardDraftId');
            let draft;
            if (existingId) {
              try {
                ({ data: { draft } } = await api.get(`/tournaments/drafts/${existingId}`));
              } catch (loadError) {
                if (loadError.response?.status !== 404) throw loadError;
                localStorage.removeItem('tourniDesk.eventWizardDraftId');
              }
            }
            if (!draft) {
              ({ data: { draft } } = await api.post('/tournaments/drafts'));
              localStorage.setItem('tourniDesk.eventWizardDraftId', draft.id);
            }
            return draft;
          })().catch((loadError) => {
            draftRequest.current = null;
            throw loadError;
          });
        }
        const draft = await draftRequest.current;
        if (!active) return;
        setDraftId(draft.id);
        const local = localStorage.getItem(localDraftKey(draft.id));
        let restored = draft.wizardData || {};
        if (Object.keys(restored).length === 0) {
          const suggestedSport = searchParams.get('sportType');
          const suggestedCapacity = Number(searchParams.get('maxParticipants'));
          if (SPORTS.some(([value]) => value === suggestedSport)) {
            restored = { ...restored, sportType: suggestedSport };
          }
          if (Number.isInteger(suggestedCapacity) && suggestedCapacity >= 2 && suggestedCapacity <= 256) {
            restored = { ...restored, maxParticipants: String(suggestedCapacity) };
          }
        }
        let restoredStep = draft.wizardStep || 1;
        let restoreFromLocal = false;
        if (local) {
          const cached = JSON.parse(local);
          if (cached.savedAt > new Date(draft.updatedAt).getTime()) {
            restored = cached.data;
            restoredStep = cached.step;
            restoreFromLocal = true;
          }
        }
        const nextForm = {
          ...INITIAL_FORM,
          ...restored,
          date: restored.date || getLocalDateOffset(7),
        };
        setForm(nextForm);
        setStep(Math.min(4, Math.max(1, restoredStep)));
        hydrated.current = true;
        if (restoreFromLocal) {
          const targetStep = Math.min(4, Math.max(1, restoredStep));
          let syncedStep = Math.min(draft.wizardStep || 1, targetStep);
          while (syncedStep < targetStep) {
            const nextStep = syncedStep + 1;
            const saved = await saveDraft(draft.id, nextForm, nextStep, syncedStep);
            if (!saved) {
              setStep(syncedStep);
              break;
            }
            syncedStep = nextStep;
          }
          if (syncedStep === targetStep) {
            await saveDraft(draft.id, nextForm, syncedStep, syncedStep);
          }
          localStorage.setItem(localDraftKey(draft.id), JSON.stringify({
            data: nextForm, step: syncedStep, savedAt: Date.now(),
          }));
        }
      } catch (loadError) {
        if (active) setError(loadError.response?.data?.message || 'Nie udało się przygotować szkicu wydarzenia.');
      } finally {
        if (active) setLoading(false);
      }
    }
    loadDraft();
    return () => { active = false; };
  }, [saveDraft, searchParams]);

  useEffect(() => {
    if (!draftId || !hydrated.current) return undefined;
    localStorage.setItem(localDraftKey(draftId), JSON.stringify({ data: form, step, savedAt: Date.now() }));
    const timeout = window.setTimeout(() => saveDraft(draftId, form, step), 650);
    return () => window.clearTimeout(timeout);
  }, [draftId, form, step, saveDraft]);

  function updateField(event) {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
    setError('');
    setMessage('');
  }

  async function moveToStep(nextStep) {
    if (nextStep < 1 || nextStep > 4 || nextStep > step + 1) return;
    setError('');
    setMessage('');
    if (nextStep > step) {
      const stepErrors = validateStep(step, form);
      if (Object.keys(stepErrors).length) {
        setErrors(stepErrors);
        setError('Sprawdź wymagane pola przed przejściem dalej.');
        return;
      }
      setErrors({});
      const saved = await saveDraft(draftId, form, nextStep, step);
      if (!saved) return;
      if (nextStep === 4) {
        try {
          const response = await api.get(`/tournaments/drafts/${draftId}/preview`);
          setPreview(response.data.structure);
        } catch {
          return;
        }
      }
    }
    setStep(nextStep);
  }

  async function saveForLater() {
    if (!draftId) return;
    if (await saveDraft(draftId, form, step)) {
      setMessage('Szkic zapisany. Możesz bezpiecznie wrócić do niego później.');
    }
  }

  async function publish() {
    const allErrors = [1, 2, 3].reduce((current, item) => ({ ...current, ...validateStep(item, form) }), {});
    if (Object.keys(allErrors).length) {
      setErrors(allErrors);
      setError('Popraw oznaczone pola przed publikacją.');
      return;
    }
    setPublishing(true);
    setError('');
    try {
      if (!await saveDraft(draftId, form, 4, 4)) return;
      const response = await api.post(`/tournaments/drafts/${draftId}/publish`, { data: form });
      localStorage.removeItem('tourniDesk.eventWizardDraftId');
      localStorage.removeItem(localDraftKey(draftId));
      navigate(`/tournaments/${response.data.tournament.id}`);
    } catch (publishError) {
      setErrors(publishError.response?.data?.errors || {});
      setError(publishError.response?.data?.message || 'Nie udało się opublikować wydarzenia.');
    } finally {
      setPublishing(false);
    }
  }

  function stepperKeyDown(event, index) {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      const nextIndex = event.key === 'ArrowRight' ? Math.min(3, index + 1) : Math.max(0, index - 1);
      document.getElementById(`wizard-step-${nextIndex + 1}`)?.focus();
    }
  }

  if (loading) {
    return <main className="flex min-h-[70vh] items-center justify-center text-slate-300" aria-live="polite">Przygotowuję kreator…</main>;
  }

  return (
    <main className="event-wizard min-h-[calc(100vh-4rem)] bg-[#090D16] px-4 py-10 text-white sm:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-[#8A3FFC]">Kreator wydarzenia · organizator</p>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Stwórz wydarzenie</h1>
            <p className="mt-2 text-sm text-slate-400">Wykonaj cztery krótkie kroki. Postęp zapisuje się automatycznie i możesz wrócić później.</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400" aria-live="polite">
            <span className={`h-2 w-2 rounded-full ${saving ? 'animate-pulse bg-amber-400' : 'bg-emerald-400'}`} />
            {saving ? 'Zapisywanie…' : 'Zmiany zapisane'}
          </div>
        </div>

        <nav aria-label="Postęp kreatora" className="mb-6 rounded-2xl border border-white/10 bg-[#121826] p-4 sm:p-6">
          <ol className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {STEPS.map((item, index) => {
              const itemStep = index + 1;
              const complete = itemStep < step;
              return (
                <li key={item.title}>
                  <button
                    id={`wizard-step-${itemStep}`}
                    type="button"
                    aria-current={itemStep === step ? 'step' : undefined}
                    aria-label={`Krok ${itemStep}: ${item.title}${errors[Object.keys(errors)[0]] && itemStep < step ? ', zawiera błąd' : ''}`}
                    onClick={() => moveToStep(itemStep)}
                    onKeyDown={(event) => stepperKeyDown(event, index)}
                    disabled={itemStep > step}
                    className={`flex w-full items-center gap-3 rounded-xl p-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F62FE] disabled:cursor-default ${
                      itemStep === step ? 'bg-[#0F62FE]/10' : 'hover:bg-white/[0.04]'
                    }`}
                  >
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold ${
                      complete ? 'bg-[#8A3FFC] text-white' :
                        itemStep === step ? 'bg-[#0F62FE] text-white' : 'bg-white/10 text-slate-400'
                    }`}>{complete ? '✓' : itemStep}</span>
                    <span>
                      <span className={`block text-sm font-semibold ${itemStep === step ? 'text-white' : 'text-slate-300'}`}>{item.title}</span>
                      <span className="block text-xs text-slate-500">{item.description}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-label="Ukończenie kreatora" aria-valuemin="0" aria-valuemax="4" aria-valuenow={step}>
            <div className="h-full rounded-full bg-gradient-to-r from-[#0F62FE] to-[#8A3FFC] transition-all" style={{ width: `${step * 25}%` }} />
          </div>
        </nav>

        <section className="rounded-2xl border border-white/10 bg-[#121826] p-5 shadow-2xl shadow-blue-950/20 sm:p-8" aria-labelledby="step-heading">
          {error && <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200" role="alert">{error}</div>}
          {message && <div className="mb-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200" role="status">{message}</div>}
          <div className="mb-7">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#39B4FE]">Krok {step} z 4</p>
            <h2 id="step-heading" className="mt-1 text-2xl font-bold">{STEPS[step - 1].title}</h2>
          </div>

          {step === 1 && (
            <div className="grid gap-5 sm:grid-cols-2">
              <Field name="title" label="Nazwa wydarzenia" error={errors.title} className="sm:col-span-2">
                <input id="title" name="title" value={form.title} onChange={updateField} maxLength={120} required className={INPUT_CLASS} placeholder="np. TourniDesk Open 2026" />
              </Field>
              <Field name="description" label="Opis" error={errors.description} className="sm:col-span-2">
                <textarea id="description" name="description" value={form.description} onChange={updateField} rows={3} maxLength={2000} className={INPUT_CLASS} placeholder="Opowiedz uczestnikom o wydarzeniu…" />
              </Field>
              <Field name="sportType" label="Dyscyplina" error={errors.sportType}>
                <select id="sportType" name="sportType" value={form.sportType} onChange={updateField} className={INPUT_CLASS}>
                  {SPORTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </Field>
              <Field name="locationType" label="Rodzaj lokalizacji">
                <select id="locationType" name="locationType" value={form.locationType} onChange={updateField} className={INPUT_CLASS}>
                  <option value="PHYSICAL">Stacjonarna</option>
                  <option value="ONLINE">Online</option>
                  <option value="HYBRID">Hybrydowa</option>
                </select>
              </Field>
              <Field name="date" label="Rozpoczęcie" error={errors.date}>
                <input id="date" type="datetime-local" name="date" value={form.date} onChange={updateField} required className={INPUT_CLASS} />
              </Field>
              <Field name="endDate" label="Zakończenie (opcjonalnie)" error={errors.endDate}>
                <input id="endDate" type="datetime-local" name="endDate" value={form.endDate} onChange={updateField} className={INPUT_CLASS} />
              </Field>
              <Field name="registrationDeadline" label="Zamknięcie zapisów (opcjonalnie)" error={errors.registrationDeadline}>
                <input id="registrationDeadline" type="datetime-local" name="registrationDeadline" value={form.registrationDeadline} onChange={updateField} className={INPUT_CLASS} />
              </Field>
              <Field name="location" label={form.locationType === 'ONLINE' ? 'Platforma / link do wydarzenia' : 'Adres / lokalizacja'} error={errors.location} className="sm:col-span-2">
                <input id="location" name="location" value={form.location} onChange={updateField} required className={INPUT_CLASS} placeholder={form.locationType === 'ONLINE' ? 'np. Discord, Steam…' : 'np. Hala sportowa, ul. Sportowa 1, Warszawa'} />
              </Field>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <fieldset>
                <legend className="mb-3 text-sm font-medium text-slate-200">Format rozgrywek</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  {FORMATS.map(([value, label, description]) => (
                    <label key={value} className={`cursor-pointer rounded-xl border p-4 transition focus-within:ring-2 focus-within:ring-[#0F62FE] ${
                      form.format === value ? 'border-[#0F62FE] bg-[#0F62FE]/10' : 'border-white/10 bg-[#090D16] hover:border-white/20'
                    }`}>
                      <input className="sr-only" type="radio" name="format" value={value} checked={form.format === value} onChange={updateField} />
                      <span className="block text-sm font-semibold">{label}</span>
                      <span className="mt-1 block text-xs text-slate-400">{description}</span>
                    </label>
                  ))}
                </div>
                {errors.format && <p className="mt-1 text-xs text-red-300" role="alert">{errors.format}</p>}
              </fieldset>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field name="maxParticipants" label="Maksymalna liczba uczestników" error={errors.maxParticipants}>
                  <input id="maxParticipants" type="number" name="maxParticipants" min="2" max="256" value={form.maxParticipants} onChange={updateField} required className={INPUT_CLASS} />
                </Field>
                <Field name="seeding" label="Rozstawienie" error={errors.seeding}>
                  <select id="seeding" name="seeding" value={form.seeding} onChange={updateField} className={INPUT_CLASS}>
                    <option value="RANDOM">Losowe</option>
                    <option value="MANUAL">Ręczne</option>
                    <option value="RANKED">Ranking / punkty</option>
                  </select>
                </Field>
              </div>
              <label className="flex items-start gap-3 rounded-xl border border-white/10 bg-[#090D16] p-4">
                <input type="checkbox" name="allowByes" checked={form.allowByes} onChange={updateField} className="mt-1 accent-[#0F62FE]" />
                <span>
                  <span className="block text-sm font-medium">Dopuść wolne losy (BYE)</span>
                  <span className="mt-1 block text-xs text-slate-400">Umożliwia limity inne niż potęgi dwójki; część uczestników przejdzie pierwszą rundę bez meczu.</span>
                </span>
              </label>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <fieldset>
                <legend className="mb-3 text-sm font-medium text-slate-200">Zgłoszenia</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    ['TEAM', 'Drużynowe', 'Uczestnicy zgłaszają drużynę.'],
                    ['INDIVIDUAL', 'Indywidualne', 'Każdy uczestnik zapisuje się osobno.'],
                  ].map(([value, label, description]) => (
                    <label key={value} className={`cursor-pointer rounded-xl border p-4 transition focus-within:ring-2 focus-within:ring-[#0F62FE] ${
                      form.registrationType === value ? 'border-[#0F62FE] bg-[#0F62FE]/10' : 'border-white/10 bg-[#090D16] hover:border-white/20'
                    }`}>
                      <input className="sr-only" type="radio" name="registrationType" value={value} checked={form.registrationType === value} onChange={updateField} />
                      <span className="block text-sm font-semibold">{label}</span>
                      <span className="mt-1 block text-xs text-slate-400">{description}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              {form.registrationType === 'TEAM' && (
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field name="minTeamSize" label="Minimalny skład drużyny" error={errors.minTeamSize}>
                    <input id="minTeamSize" type="number" name="minTeamSize" min="1" max="100" value={form.minTeamSize} onChange={updateField} className={INPUT_CLASS} />
                  </Field>
                  <Field name="maxTeamSize" label="Maksymalny skład drużyny" error={errors.maxTeamSize}>
                    <input id="maxTeamSize" type="number" name="maxTeamSize" min="1" max="100" value={form.maxTeamSize} onChange={updateField} className={INPUT_CLASS} />
                  </Field>
                </div>
              )}
              <div className="grid gap-5 sm:grid-cols-2">
                <Field name="entryFee" label="Opłata wpisowa (opcjonalnie)" error={errors.entryFee}>
                  <input id="entryFee" type="number" name="entryFee" min="0" step="0.01" value={form.entryFee} onChange={updateField} className={INPUT_CLASS} placeholder="0,00" />
                </Field>
                <Field name="currency" label="Waluta" error={errors.currency}>
                  <select id="currency" name="currency" value={form.currency} onChange={updateField} disabled={!form.entryFee} className={INPUT_CLASS}>
                    {['PLN', 'EUR', 'USD', 'GBP'].map((currency) => <option key={currency} value={currency}>{currency}</option>)}
                  </select>
                </Field>
              </div>
              <label className="flex items-start gap-3 rounded-xl border border-white/10 bg-[#090D16] p-4">
                <input type="checkbox" name="autoApprove" checked={form.autoApprove} onChange={updateField} className="mt-1 accent-[#0F62FE]" />
                <span>
                  <span className="block text-sm font-medium">Automatycznie akceptuj zgłoszenia</span>
                  <span className="mt-1 block text-xs text-slate-400">Nowe zgłoszenia będą zatwierdzane bez ręcznej weryfikacji organizatora.</span>
                </span>
              </label>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <SummaryCard title="Wydarzenie">
                  <SummaryRow label="Nazwa" value={form.title || '—'} />
                  <SummaryRow label="Dyscyplina" value={SPORTS.find(([value]) => value === form.sportType)?.[1] || form.sportType} />
                  <SummaryRow label="Termin" value={form.date ? new Date(form.date).toLocaleString('pl-PL') : '—'} />
                  <SummaryRow label="Lokalizacja" value={form.location || '—'} />
                </SummaryCard>
                <SummaryCard title="Rozgrywki i zgłoszenia">
                  <SummaryRow label="Format" value={FORMATS.find(([value]) => value === form.format)?.[1] || form.format} />
                  <SummaryRow label="Limit" value={`${form.maxParticipants} uczestników`} />
                  <SummaryRow label="Rozstawienie" value={{ RANDOM: 'Losowe', MANUAL: 'Ręczne', RANKED: 'Ranking / punkty' }[form.seeding]} />
                  <SummaryRow label="Zgłoszenia" value={form.registrationType === 'TEAM' ? `Drużynowe (${form.minTeamSize}–${form.maxTeamSize})` : 'Indywidualne'} />
                  <SummaryRow label="Opłata" value={form.entryFee ? `${Number(form.entryFee).toFixed(2)} ${form.currency}` : 'Brak'} />
                </SummaryCard>
              </div>
              <div className="rounded-xl border border-white/10 bg-[#090D16] p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-semibold">Podgląd struktury meczów</h3>
                    <p className="mt-1 text-xs text-slate-400">Szablon zostanie wygenerowany na podstawie wybranego formatu.</p>
                  </div>
                  {preview && <span className="rounded-full bg-[#8A3FFC]/15 px-3 py-1 text-xs font-semibold text-purple-200">{preview.matchCount} meczów</span>}
                </div>
                {preview?.groups && <p className="mt-4 text-sm text-slate-300">Faza grupowa: {preview.groups.join(', ')}</p>}
                {preview?.byeCount > 0 && <p className="mt-2 text-xs text-slate-400">Wolne losy w drabince: {preview.byeCount}</p>}
                {preview?.rounds?.length ? (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {preview.rounds.slice(0, 4).map((round, index) => (
                      <div key={`round-${index}`} className="rounded-lg border border-white/10 p-3">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#39B4FE]">
                          {preview.format === 'ROUND_ROBIN' ? `Mecze ligowe (${round.length})` : `Runda ${index + 1}`}
                        </p>
                        <ul className="space-y-1 text-xs text-slate-300">
                          {round.slice(0, 3).map((match, matchIndex) => <li key={`${index}-${matchIndex}`}>{match.participants.join(' vs ')}</li>)}
                          {round.length > 3 && <li className="text-slate-500">i {round.length - 3} kolejnych…</li>}
                        </ul>
                      </div>
                    ))}
                    {preview.rounds.length > 4 && <p className="text-xs text-slate-500">… oraz {preview.rounds.length - 4} kolejnych rund</p>}
                  </div>
                ) : <p className="mt-4 text-sm text-slate-400">Podgląd pojawi się po poprawnym uzupełnieniu wcześniejszych kroków.</p>}
              </div>
              <div className="rounded-xl border border-[#0F62FE]/20 bg-[#0F62FE]/5 p-4 text-sm text-slate-300">
                Po publikacji wydarzenie będzie widoczne dla uczestników i otwarte na zapisy.
              </div>
            </div>
          )}

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-6">
            <button type="button" onClick={() => step > 1 ? moveToStep(step - 1) : navigate('/organizer')} className="rounded-xl px-4 py-3 text-sm font-medium text-slate-300 transition hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F62FE]">
              {step > 1 ? '← Wstecz' : 'Anuluj'}
            </button>
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={saveForLater} disabled={!draftId || saving} className="rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/5 disabled:opacity-50">
                Zapisz szkic
              </button>
              {step < 4 ? (
                <button type="button" onClick={() => moveToStep(step + 1)} disabled={!draftId} className="rounded-xl bg-gradient-to-r from-[#0F62FE] to-[#8A3FFC] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-950/30 transition hover:brightness-110 disabled:opacity-50">
                  Dalej <span aria-hidden="true">→</span>
                </button>
              ) : (
                <button type="button" onClick={publish} disabled={publishing || !draftId} className="rounded-xl bg-gradient-to-r from-[#0F62FE] to-[#8A3FFC] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-950/30 transition hover:brightness-110 disabled:opacity-50">
                  {publishing ? 'Publikowanie…' : 'Opublikuj wydarzenie'}
                </button>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function Field({ name, label, error, className = '', children }) {
  return (
    <div className={className}>
      <label htmlFor={name} className="mb-2 block text-sm font-medium text-slate-200">{label}</label>
      {cloneElement(children, {
        'aria-invalid': Boolean(error),
        'aria-describedby': error ? `${name}-error` : undefined,
      })}
      {error && <p id={`${name}-error`} className="mt-1.5 text-xs text-red-300" role="alert">{error}</p>}
    </div>
  );
}

function SummaryCard({ title, children }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#090D16] p-5">
      <h3 className="mb-3 font-semibold">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="text-right text-slate-200">{value}</span>
    </div>
  );
}
