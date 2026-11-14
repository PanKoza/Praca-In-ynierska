import { Link } from 'react-router-dom';
import { capacity, dateParts, plural } from '../lib/labels';
import Icon from './Icon';
import SpotlightCard from './reactbits/SpotlightCard';
import { Meter, SportLabel, StatusChip } from './ui';

/**
 * Event summary used on the landing page and in the event browser.
 * The date sits in a "ticket stub" so the term is the first thing people read.
 */
export default function EventCard({ tournament, cta = 'Zobacz wydarzenie' }) {
  const seats = capacity(tournament._count?.participants, tournament.maxParticipants);
  const date = dateParts(tournament.date);
  const full = seats.limit > 0 && seats.free === 0;

  return (
    <Link to={`/tournaments/${tournament.id}`} className="group block h-full rounded-card" aria-label={`${tournament.title} — ${cta.toLowerCase()}`}>
      <SpotlightCard
        className="event-card"
        spotlightColor="var(--accent)"
        intensity={0.5}
        spotlightSize={260}
        borderGlow={0.9}
      >
        <div className="flex flex-1 flex-col p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <div className="ticket-date" aria-hidden="true">
              <strong>{date.day}</strong>
              <span>{date.month}</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <SportLabel sport={tournament.sportType} />
                <StatusChip status={tournament.status} />
              </div>
              <h3 className="h-card mt-3 break-words">{tournament.title}</h3>
            </div>
          </div>

          <p className="mt-4 flex items-start gap-2 text-sm text-muted">
            <Icon name="pin" size={16} className="mt-0.5 shrink-0" />
            <span className="min-w-0 break-words">{tournament.location || 'Miejsce do ustalenia'}</span>
          </p>

          <div className="mt-auto pt-6">
            <div className="mb-2 flex items-baseline justify-between gap-3 text-[0.8125rem]">
              <span className="text-muted">
                <span className="mono font-semibold text-ink">{seats.taken}/{seats.limit || '—'}</span> zajętych
              </span>
              <span className={`font-semibold ${full ? 'text-danger' : 'text-ink'}`}>
                {!seats.limit ? 'Sprawdź dostępność' : full ? 'Brak miejsc' : `${seats.free} ${plural(seats.free, 'wolne miejsce', 'wolne miejsca', 'wolnych miejsc')}`}
              </span>
            </div>
            <Meter value={seats.percent} label={seats.limit ? `Zajęte ${seats.percent}% miejsc` : 'Liczba miejsc nieustalona'} />
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-line px-5 py-3.5 font-display text-[1.0625rem] font-bold uppercase tracking-[0.04em] text-ink sm:px-6">
          {cta}
          <Icon name="arrow-right" size={20} className="transition-transform duration-300 ease-out group-hover:translate-x-1.5" />
        </div>
      </SpotlightCard>
    </Link>
  );
}
