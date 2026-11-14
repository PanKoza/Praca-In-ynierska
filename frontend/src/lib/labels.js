export const SPORTS = [
  { value: 'SOCCER', label: 'Piłka nożna', genitive: 'piłki nożnej', icon: 'soccer' },
  { value: 'FOOTBALL_6V6', label: 'Piłka nożna 6v6', genitive: 'piłki nożnej 6v6', icon: 'soccer' },
  { value: 'VOLLEYBALL', label: 'Siatkówka', genitive: 'siatkówki', icon: 'volleyball' },
  { value: 'BEACH_VOLLEYBALL', label: 'Siatkówka plażowa', genitive: 'siatkówki plażowej', icon: 'volleyball' },
  { value: 'BASKETBALL', label: 'Koszykówka', genitive: 'koszykówki', icon: 'basketball' },
  { value: 'TENNIS', label: 'Tenis', genitive: 'tenisa', icon: 'tennis' },
  { value: 'ESPORTS', label: 'E-sport', genitive: 'e-sportu', icon: 'esports' },
  { value: 'CUSTOM', label: 'Inna dyscyplina', genitive: 'innej dyscypliny', icon: 'trophy' },
  { value: 'OTHER', label: 'Inne', genitive: 'innej dyscypliny', icon: 'trophy' },
];

export const SPORT_LABELS = Object.fromEntries(SPORTS.map(({ value, label }) => [value, label]));
export const SPORT_ICONS = Object.fromEntries(SPORTS.map(({ value, icon }) => [value, icon]));

export function sportLabel(value) {
  return SPORT_LABELS[value] || 'Wydarzenie sportowe';
}

export function sportIcon(value) {
  return SPORT_ICONS[value] || 'trophy';
}

export const FORMATS = [
  { value: 'SINGLE_ELIMINATION', label: 'Pojedyncza eliminacja', description: 'Przegrana kończy udział w turnieju.', hint: 'Najszybszy format — dobry na jeden dzień.' },
  { value: 'DOUBLE_ELIMINATION', label: 'Podwójna eliminacja', description: 'Dwie porażki eliminują uczestnika.', hint: 'Każdy dostaje drugą szansę.' },
  { value: 'ROUND_ROBIN', label: 'Każdy z każdym', description: 'Każdy uczestnik rozgrywa mecz z każdym.', hint: 'Najwięcej gry, najlepszy dla małych lig.' },
  { value: 'GROUP_STAGE', label: 'Grupy i play-offy', description: 'Faza grupowa zakończona drabinką pucharową.', hint: 'Jak na dużych mistrzostwach.' },
];

export const FORMAT_LABELS = Object.fromEntries(FORMATS.map(({ value, label }) => [value, label]));

export const TOURNAMENT_STATUS = {
  DRAFT: { label: 'Szkic', tone: 'neutral' },
  OPEN: { label: 'Zapisy otwarte', tone: 'accent' },
  PUBLISHED: { label: 'Opublikowany', tone: 'accent' },
  IN_PROGRESS: { label: 'W trakcie', tone: 'live' },
  FINISHED: { label: 'Zakończony', tone: 'done' },
  CANCELLED: { label: 'Anulowany', tone: 'danger' },
};

export const TOURNAMENT_STATUS_LABELS = Object.fromEntries(
  Object.entries(TOURNAMENT_STATUS).map(([value, { label }]) => [value, label]),
);

export const MATCH_STATUS = {
  SCHEDULED: { label: 'Zaplanowany', tone: 'neutral' },
  IN_PROGRESS: { label: 'Na żywo', tone: 'live' },
  FINISHED: { label: 'Zakończony', tone: 'done' },
};

export const ROLE_LABELS = {
  ADMIN: 'Administrator',
  ORGANIZER: 'Organizator',
  PLAYER: 'Zawodnik',
  REFEREE: 'Sędzia',
};

export const ROLE_HOME = {
  ADMIN: '/organizer',
  ORGANIZER: '/organizer',
  PLAYER: '/player',
  REFEREE: '/referee',
};

function toDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(value, options = { day: 'numeric', month: 'long', year: 'numeric' }, fallback = 'Termin do ustalenia') {
  const date = toDate(value);
  return date ? date.toLocaleDateString('pl-PL', options) : fallback;
}

export function formatDateTime(value, options = {}, fallback = 'Termin do ustalenia') {
  const date = toDate(value);
  return date
    ? date.toLocaleString('pl-PL', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      ...options,
    })
    : fallback;
}

export function formatTime(value) {
  const date = toDate(value);
  return date ? date.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }) : '';
}

/* Day + short month, used by the "ticket stub" on event cards. */
export function dateParts(value) {
  const date = toDate(value);
  if (!date) return { day: '—', month: 'termin', weekday: '' };
  return {
    day: String(date.getDate()).padStart(2, '0'),
    month: date.toLocaleDateString('pl-PL', { month: 'short' }).replace('.', ''),
    weekday: date.toLocaleDateString('pl-PL', { weekday: 'short' }).replace('.', ''),
  };
}

export function capacity(taken, max) {
  const limit = Number(max) || 0;
  const count = Number(taken) || 0;
  return {
    taken: count,
    limit,
    free: Math.max(0, limit - count),
    percent: limit ? Math.min(100, Math.round((count / limit) * 100)) : 0,
  };
}

export function plural(count, one, few, many) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (count === 1) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}
