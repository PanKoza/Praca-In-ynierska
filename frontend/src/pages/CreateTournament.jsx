import { cloneElement, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api/axios';
import { gsap, prefersReducedMotion, useGSAP } from '../lib/motion';
import { dateParts, sportIcon } from '../lib/labels';
import Icon from '../components/Icon';
import { useTour } from '../components/Tour';
import { Arrow, FullPageLoader, Notice, PageHeader } from '../components/ui';

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

const TIPS = [
  'Nazwa, termin i miejsce to wszystko, czego uczestnicy potrzebują na start. Opis możesz uzupełnić później.',
  'Nie wiesz, co wybrać? Pojedyncza eliminacja jest najszybsza, a „każdy z każdym” daje wszystkim najwięcej gry.',
  'Przy zgłoszeniach drużynowych zespół zapisuje kapitan. Pole opłaty zostaw puste, jeśli udział jest bezpłatny.',
  'Sprawdź podsumowanie. Po publikacji wydarzenie od razu pojawi się na liście, a zawodnicy będą mogli się zapisywać.',
];

const TOUR = [
  { target: '[data-tour="wiz-steps"]', title: 'Cztery kroki do publikacji', body: 'Pasek pokazuje, gdzie jesteś. Do ukończonych kroków możesz wracać jednym kliknięciem.' },
  { target: '[data-tour="wiz-save"]', title: 'Nic nie przepadnie', body: 'Kreator zapisuje szkic sam, po każdej zmianie. Możesz zamknąć stronę i dokończyć później.' },
  { target: '[data-tour="wiz-nav"]', title: 'Idź dalej, gdy będziesz gotowy', body: 'Przycisk „Dalej” sprawdzi wymagane pola i podpowie, co poprawić. Na końcu czeka „Opublikuj”.' },
];

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
  const rootRef = useRef(null);
  const previousStep = useRef(1);

  useTour('wizard', TOUR, { auto: true, ready: !loading });

  /* Each step slides in from the direction of travel, so going back feels like going back. */
  useGSAP(() => {
    if (loading || prefersReducedMotion()) return;
    const direction = step >= previousStep.current ? 1 : -1;
    previousStep.current = step;
    gsap.fromTo('.wizard-step', { autoAlpha: 0, x: 40 * direction }, { autoAlpha: 1, x: 0, duration: 0.55, ease: 'expo.out', clearProps: 'transform,opacity,visibility' });
    gsap.fromTo('.wizard-step > div > *', { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.5, ease: 'power3.out', stagger: 0.04, clearProps: 'transform,opacity,visibility' });
    gsap.fromTo('.wizard-tip', { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.45, ease: 'power3.out' });
  }, { dependencies: [step, loading], scope: rootRef });

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

  if (loading) return <FullPageLoader label="Przygotowuję kreator…" />;

  const sportName = SPORTS.find(([value]) => value === form.sportType)?.[1] || form.sportType;
  const formatName = FORMATS.find(([value]) => value === form.format)?.[1] || form.format;
  const previewDate = dateParts(form.date);
  const capacityNumber = Number(form.maxParticipants);

  return (
    <main className="page">
      <div ref={rootRef} className="shell">
        <PageHeader
          eyebrow="Kreator wydarzenia"
          title="Stwórz wydarzenie"
          actions={(
            <span className="chip !h-9 !px-3.5" data-tone={saving ? 'warn' : 'ok'} aria-live="polite" data-tour="wiz-save">
              <Icon name={saving ? 'refresh' : 'check'} size={14} className={saving ? 'spin' : ''} />
              {saving ? 'Zapisywanie…' : 'Zmiany zapisane'}
            </span>
          )}
        >
          Cztery krótkie kroki. Postęp zapisuje się automatycznie — możesz przerwać i wrócić później.
        </PageHeader>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
          <div className="min-w-0">
            <nav aria-label="Postęp kreatora" className="mb-6" data-tour="wiz-steps">
              <div className="relative">
                <div className="absolute left-[12.5%] right-[12.5%] top-[21px] hidden h-0.5 bg-line sm:block" aria-hidden="true">
                  <div className="wizard-progress h-full origin-left bg-mark" style={{ transform: `scaleX(${(step - 1) / 3})`, transition: 'transform 700ms cubic-bezier(0.16, 1, 0.3, 1)' }} />
                </div>
                <ol className="relative grid grid-cols-4 gap-2">
                  {STEPS.map((item, index) => {
                    const itemStep = index + 1;
                    const complete = itemStep < step;
                    const current = itemStep === step;
                    return (
                      <li key={item.title}>
                        <button
                          id={`wizard-step-${itemStep}`}
                          type="button"
                          aria-current={current ? 'step' : undefined}
                          aria-label={`Krok ${itemStep}: ${item.title}${errors[Object.keys(errors)[0]] && itemStep < step ? ', zawiera błąd' : ''}`}
                          onClick={() => moveToStep(itemStep)}
                          onKeyDown={(event) => stepperKeyDown(event, index)}
                          disabled={itemStep > step}
                          className="group flex w-full flex-col items-center gap-2 rounded-[12px] px-1 py-1 text-center disabled:cursor-default"
                        >
                          <span className={`grid h-11 w-11 place-items-center rounded-full border-[1.5px] font-display text-xl font-extrabold transition-all duration-300 ${
                            complete ? 'border-ink bg-ink text-bg group-hover:scale-105'
                              : current ? 'scale-110 border-ink bg-accent text-accent-ink'
                                : 'border-line-2 bg-bg text-muted'
                          }`}
                          >
                            {complete ? <Icon name="check" size={19} strokeWidth={2.5} /> : itemStep}
                          </span>
                          <span className="min-w-0">
                            <span className={`block font-display text-base font-bold uppercase leading-tight tracking-[0.03em] sm:text-lg ${current || complete ? 'text-ink' : 'text-muted'}`}>{item.title}</span>
                            <span className="hidden text-xs text-muted sm:block">{item.description}</span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </div>
              <div className="sr-only" role="progressbar" aria-label="Ukończenie kreatora" aria-valuemin="0" aria-valuemax="4" aria-valuenow={step} />
            </nav>

            <section className="card card-pad" aria-labelledby="step-heading">
              <div className="mb-7 flex items-end justify-between gap-4 border-b border-line pb-5">
                <div>
                  <p className="mono text-xs font-semibold uppercase tracking-[0.14em] text-muted">Krok {step} z 4</p>
                  <h2 id="step-heading" className="h-section mt-1.5">{STEPS[step - 1].title}</h2>
                </div>
                <span className="num text-6xl text-line-2" aria-hidden="true">0{step}</span>
              </div>

              <div className="wizard-step">
                {step === 1 && (
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field name="title" label="Nazwa wydarzenia" error={errors.title} className="sm:col-span-2">
                      <input id="title" name="title" value={form.title} onChange={updateField} maxLength={120} required className="input" placeholder="np. TourniDesk Open 2026" />
                    </Field>
                    <fieldset className="sm:col-span-2">
                      <legend className="label">Dyscyplina</legend>
                      <div className="flex flex-wrap gap-2">
                        {SPORTS.filter(([value]) => value !== 'OTHER' || form.sportType === 'OTHER').map(([value, label]) => (
                          <label key={value} className="pill cursor-pointer">
                            <input className="sr-only" type="radio" name="sportType" value={value} checked={form.sportType === value} onChange={updateField} />
                            <Icon name={sportIcon(value)} size={17} />
                            {label}
                          </label>
                        ))}
                      </div>
                      {errors.sportType && <p className="error-text" role="alert">{errors.sportType}</p>}
                    </fieldset>
                    <Field name="date" label="Rozpoczęcie" error={errors.date}>
                      <input id="date" type="datetime-local" name="date" value={form.date} onChange={updateField} required className="input" />
                    </Field>
                    <Field name="endDate" label="Zakończenie" optional error={errors.endDate}>
                      <input id="endDate" type="datetime-local" name="endDate" value={form.endDate} onChange={updateField} className="input" />
                    </Field>
                    <Field name="registrationDeadline" label="Zamknięcie zapisów" optional error={errors.registrationDeadline} hint="Zostaw puste, jeśli zapisy trwają do rozpoczęcia.">
                      <input id="registrationDeadline" type="datetime-local" name="registrationDeadline" value={form.registrationDeadline} onChange={updateField} className="input" />
                    </Field>
                    <Field name="locationType" label="Rodzaj lokalizacji">
                      <select id="locationType" name="locationType" value={form.locationType} onChange={updateField} className="input">
                        <option value="PHYSICAL">Stacjonarna</option>
                        <option value="ONLINE">Online</option>
                        <option value="HYBRID">Hybrydowa</option>
                      </select>
                    </Field>
                    <Field name="location" label={form.locationType === 'ONLINE' ? 'Platforma / link do wydarzenia' : 'Adres / lokalizacja'} error={errors.location} className="sm:col-span-2">
                      <input id="location" name="location" value={form.location} onChange={updateField} required className="input" placeholder={form.locationType === 'ONLINE' ? 'np. Discord, Steam…' : 'np. Hala sportowa, ul. Sportowa 1, Warszawa'} />
                    </Field>
                    <Field name="description" label="Opis" optional error={errors.description} className="sm:col-span-2">
                      <textarea id="description" name="description" value={form.description} onChange={updateField} rows={3} maxLength={2000} className="input" placeholder="Opowiedz uczestnikom o wydarzeniu…" />
                    </Field>
                  </div>
                )}

                {step === 2 && (
                  <div className="grid gap-7">
                    <fieldset>
                      <legend className="label">Format rozgrywek</legend>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {FORMATS.map(([value, label, description]) => (
                          <label key={value} className="choice">
                            <input className="sr-only" type="radio" name="format" value={value} checked={form.format === value} onChange={updateField} />
                            <span className="min-w-0 flex-1">
                              <span className="block font-display text-xl font-bold uppercase leading-none tracking-[0.02em] text-ink">{label}</span>
                              <span className="mt-1.5 block text-[0.8125rem] leading-snug text-muted">{description}</span>
                            </span>
                            <span className="choice-mark"><Icon name="check" size={14} strokeWidth={3} /></span>
                          </label>
                        ))}
                      </div>
                      {errors.format && <p className="error-text" role="alert">{errors.format}</p>}
                    </fieldset>
                    <div className="grid gap-5 sm:grid-cols-2">
                      <div>
                        <Field name="maxParticipants" label="Maksymalna liczba uczestników" error={errors.maxParticipants}>
                          <input id="maxParticipants" type="number" name="maxParticipants" min="2" max="256" value={form.maxParticipants} onChange={updateField} required className="input" />
                        </Field>
                        <div className="mt-2.5 flex flex-wrap gap-2" role="group" aria-label="Szybki wybór limitu">
                          {['8', '16', '32', '64'].map((preset) => (
                            <button key={preset} type="button" className="pill !min-h-9 !px-3.5" aria-pressed={String(form.maxParticipants) === preset} onClick={() => updateField({ target: { name: 'maxParticipants', value: preset, type: 'number' } })}>
                              {preset}
                            </button>
                          ))}
                        </div>
                      </div>
                      <Field name="seeding" label="Rozstawienie" error={errors.seeding} hint="Losowe sprawdza się najlepiej, gdy uczestnicy się nie znają.">
                        <select id="seeding" name="seeding" value={form.seeding} onChange={updateField} className="input">
                          <option value="RANDOM">Losowe</option>
                          <option value="MANUAL">Ręczne</option>
                          <option value="RANKED">Ranking / punkty</option>
                        </select>
                      </Field>
                    </div>
                    <label className="choice">
                      <input type="checkbox" name="allowByes" checked={form.allowByes} onChange={updateField} className="sr-only" />
                      <span className="choice-mark choice-mark-square"><Icon name="check" size={14} strokeWidth={3} /></span>
                      <span>
                        <span className="block font-semibold text-ink">Dopuść wolne losy (BYE)</span>
                        <span className="mt-1 block text-[0.8125rem] leading-snug text-muted">Umożliwia limity inne niż potęgi dwójki; część uczestników przejdzie pierwszą rundę bez meczu.</span>
                      </span>
                    </label>
                  </div>
                )}

                {step === 3 && (
                  <div className="grid gap-7">
                    <fieldset>
                      <legend className="label">Zgłoszenia</legend>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {[
                          ['TEAM', 'Drużynowe', 'Uczestnicy zgłaszają drużynę.', 'users'],
                          ['INDIVIDUAL', 'Indywidualne', 'Każdy uczestnik zapisuje się osobno.', 'user'],
                        ].map(([value, label, description, icon]) => (
                          <label key={value} className="choice">
                            <input className="sr-only" type="radio" name="registrationType" value={value} checked={form.registrationType === value} onChange={updateField} />
                            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] border border-line-2 bg-bg text-ink"><Icon name={icon} size={20} /></span>
                            <span className="min-w-0 flex-1">
                              <span className="block font-display text-xl font-bold uppercase leading-none tracking-[0.02em] text-ink">{label}</span>
                              <span className="mt-1.5 block text-[0.8125rem] leading-snug text-muted">{description}</span>
                            </span>
                            <span className="choice-mark"><Icon name="check" size={14} strokeWidth={3} /></span>
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    {form.registrationType === 'TEAM' && (
                      <div className="grid gap-5 sm:grid-cols-2">
                        <Field name="minTeamSize" label="Minimalny skład drużyny" error={errors.minTeamSize}>
                          <input id="minTeamSize" type="number" name="minTeamSize" min="1" max="100" value={form.minTeamSize} onChange={updateField} className="input" />
                        </Field>
                        <Field name="maxTeamSize" label="Maksymalny skład drużyny" error={errors.maxTeamSize}>
                          <input id="maxTeamSize" type="number" name="maxTeamSize" min="1" max="100" value={form.maxTeamSize} onChange={updateField} className="input" />
                        </Field>
                      </div>
                    )}
                    <div className="grid gap-5 sm:grid-cols-2">
                      <Field name="entryFee" label="Opłata wpisowa" optional error={errors.entryFee} hint="Zostaw puste, jeśli udział jest bezpłatny.">
                        <input id="entryFee" type="number" name="entryFee" min="0" step="0.01" value={form.entryFee} onChange={updateField} className="input" placeholder="0,00" />
                      </Field>
                      <Field name="currency" label="Waluta" error={errors.currency}>
                        <select id="currency" name="currency" value={form.currency} onChange={updateField} disabled={!form.entryFee} className="input">
                          {['PLN', 'EUR', 'USD', 'GBP'].map((currency) => <option key={currency} value={currency}>{currency}</option>)}
                        </select>
                      </Field>
                    </div>
                    <label className="choice">
                      <input type="checkbox" name="autoApprove" checked={form.autoApprove} onChange={updateField} className="sr-only" />
                      <span className="choice-mark choice-mark-square"><Icon name="check" size={14} strokeWidth={3} /></span>
                      <span>
                        <span className="block font-semibold text-ink">Automatycznie akceptuj zgłoszenia</span>
                        <span className="mt-1 block text-[0.8125rem] leading-snug text-muted">Nowe zgłoszenia będą zatwierdzane bez ręcznej weryfikacji organizatora.</span>
                      </span>
                    </label>
                  </div>
                )}

                {step === 4 && (
                  <div className="grid gap-5">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <SummaryCard title="Wydarzenie" onEdit={() => moveToStep(1)}>
                        <SummaryRow label="Nazwa" value={form.title || '—'} />
                        <SummaryRow label="Dyscyplina" value={sportName} />
                        <SummaryRow label="Termin" value={form.date ? new Date(form.date).toLocaleString('pl-PL') : '—'} />
                        <SummaryRow label="Lokalizacja" value={form.location || '—'} />
                      </SummaryCard>
                      <SummaryCard title="Rozgrywki i zgłoszenia" onEdit={() => moveToStep(2)}>
                        <SummaryRow label="Format" value={formatName} />
                        <SummaryRow label="Limit" value={`${form.maxParticipants} uczestników`} />
                        <SummaryRow label="Rozstawienie" value={{ RANDOM: 'Losowe', MANUAL: 'Ręczne', RANKED: 'Ranking / punkty' }[form.seeding]} />
                        <SummaryRow label="Zgłoszenia" value={form.registrationType === 'TEAM' ? `Drużynowe (${form.minTeamSize}–${form.maxTeamSize})` : 'Indywidualne'} />
                        <SummaryRow label="Opłata" value={form.entryFee ? `${Number(form.entryFee).toFixed(2)} ${form.currency}` : 'Brak'} />
                      </SummaryCard>
                    </div>
                    <div className="well p-5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h3 className="h-card">Podgląd struktury meczów</h3>
                          <p className="mt-1.5 text-sm text-muted">Szablon zostanie wygenerowany na podstawie wybranego formatu.</p>
                        </div>
                        {preview && <span className="chip" data-tone="accent">{preview.matchCount} meczów</span>}
                      </div>
                      {preview?.groups && <p className="mt-4 text-sm text-ink">Faza grupowa: {preview.groups.join(', ')}</p>}
                      {preview?.byeCount > 0 && <p className="mt-2 text-sm text-muted">Wolne losy w drabince: {preview.byeCount}</p>}
                      {preview?.rounds?.length ? (
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          {preview.rounds.slice(0, 4).map((round, index) => (
                            <div key={`round-${index}`} className="rounded-[10px] border border-line bg-surface p-3.5">
                              <p className="mono mb-2 text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-muted">
                                {preview.format === 'ROUND_ROBIN' ? `Mecze ligowe (${round.length})` : `Runda ${index + 1}`}
                              </p>
                              <ul className="grid gap-1 text-sm text-ink">
                                {round.slice(0, 3).map((match, matchIndex) => <li key={`${index}-${matchIndex}`}>{match.participants.join(' vs ')}</li>)}
                                {round.length > 3 && <li className="text-muted">i {round.length - 3} kolejnych…</li>}
                              </ul>
                            </div>
                          ))}
                          {preview.rounds.length > 4 && <p className="text-sm text-muted">… oraz {preview.rounds.length - 4} kolejnych rund</p>}
                        </div>
                      ) : <p className="mt-4 text-sm text-muted">Podgląd pojawi się po poprawnym uzupełnieniu wcześniejszych kroków.</p>}
                    </div>
                    <Notice>Po publikacji wydarzenie będzie widoczne dla uczestników i otwarte na zapisy.</Notice>
                  </div>
                )}
              </div>

              <div className="mt-8 border-t border-line pt-6">
                {error && <Notice tone="danger" className="mb-5">{error}</Notice>}
                {message && <Notice tone="ok" className="mb-5">{message}</Notice>}
                <div className="flex flex-wrap items-center justify-between gap-3" data-tour="wiz-nav">
                  <button type="button" onClick={() => step > 1 ? moveToStep(step - 1) : navigate('/organizer')} className="btn btn-quiet">
                    {step > 1 ? <><Icon name="arrow-left" size={18} /> Wstecz</> : 'Anuluj'}
                  </button>
                  <div className="flex flex-wrap gap-3">
                    <button type="button" onClick={saveForLater} disabled={!draftId || saving} className="btn btn-ghost">
                      <Icon name="save" size={18} /> Zapisz szkic
                    </button>
                    {step < 4 ? (
                      <button type="button" onClick={() => moveToStep(step + 1)} disabled={!draftId} className="btn btn-primary btn-lg">
                        Dalej: {STEPS[step].title} <Arrow />
                      </button>
                    ) : (
                      <button type="button" onClick={publish} disabled={publishing || !draftId} className="btn btn-primary btn-lg">
                        {publishing ? 'Publikowanie…' : 'Opublikuj wydarzenie'} {!publishing && <Icon name="check" size={20} />}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </section>
          </div>

          <aside className="grid gap-5 lg:sticky lg:top-[calc(var(--nav-h)+1.5rem)]">
            <div className="rounded-card border-[1.5px] border-ink bg-accent p-5 text-accent-ink">
              <p className="flex items-center gap-2 font-display text-lg font-bold uppercase tracking-[0.04em]"><Icon name="flag" size={18} /> Wskazówka</p>
              <p className="wizard-tip mt-2 text-[0.9375rem] leading-relaxed">{TIPS[step - 1]}</p>
            </div>

            <div aria-hidden="true">
              <p className="eyebrow eyebrow-plain mb-2.5">Tak zobaczą to uczestnicy</p>
              <div className="card p-5">
                <div className="flex items-start gap-4">
                  <div className="ticket-date">
                    <strong>{previewDate.day}</strong>
                    <span>{previewDate.month}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="inline-flex items-center gap-2 text-sm font-semibold text-muted"><Icon name={sportIcon(form.sportType)} size={17} />{sportName}</span>
                    <p className={`h-card mt-2 break-words ${form.title ? '' : '!text-muted'}`}>{form.title || 'Nazwa wydarzenia'}</p>
                  </div>
                </div>
                <p className="mt-4 flex items-start gap-2 text-sm text-muted"><Icon name="pin" size={16} className="mt-0.5 shrink-0" /><span className="min-w-0 break-words">{form.location || 'Miejsce wydarzenia'}</span></p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="chip">{formatName}</span>
                  {Number.isFinite(capacityNumber) && capacityNumber > 0 && <span className="chip">{capacityNumber} miejsc</span>}
                  <span className="chip">{form.registrationType === 'TEAM' ? 'Drużyny' : 'Indywidualnie'}</span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

function Field({ name, label, error, hint, optional = false, className = '', children }) {
  const describedBy = [error ? `${name}-error` : null, hint ? `${name}-hint` : null].filter(Boolean).join(' ') || undefined;
  return (
    <div className={className}>
      <label htmlFor={name} className="label">
        {label}
        {optional && <span className="ml-2 font-normal text-muted">opcjonalnie</span>}
      </label>
      {cloneElement(children, {
        'aria-invalid': Boolean(error),
        'aria-describedby': describedBy,
      })}
      {hint && !error && <p id={`${name}-hint`} className="hint">{hint}</p>}
      {error && <p id={`${name}-error`} className="error-text" role="alert">{error}</p>}
    </div>
  );
}

function SummaryCard({ title, onEdit, children }) {
  return (
    <div className="well p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="h-card">{title}</h3>
        <button type="button" onClick={onEdit} className="btn btn-quiet btn-sm !min-h-8 !px-2.5"><Icon name="edit" size={15} /> Zmień</button>
      </div>
      <dl className="grid gap-2.5">{children}</dl>
    </div>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-3 text-[0.9375rem]">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 break-words text-right font-semibold text-ink">{value}</dd>
    </div>
  );
}
