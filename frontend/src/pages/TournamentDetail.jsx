import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams, useNavigate, useLocation } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { FORMAT_LABELS, capacity, formatDateTime, plural } from '../lib/labels';
import Icon from '../components/Icon';
import Reveal from '../components/Reveal';
import { Arrow, Avatar, BackLink, FullPageLoader, Meter, Notice, SectionHeading, SportLabel, StatusChip, Title } from '../components/ui';

function Fact({ icon, label, value }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-[10px] border border-line bg-bg text-ink"><Icon name={icon} size={18} /></span>
      <div className="min-w-0">
        <dt className="mono text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-muted">{label}</dt>
        <dd className="mt-0.5 break-words font-semibold text-ink">{value}</dd>
      </div>
    </div>
  );
}

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
  const registrationOpen = ['OPEN', 'PUBLISHED'].includes(tournament?.status);
  const canJoin = (!user || user.role === 'PLAYER')
    && registrationOpen
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

  if (loading) return <FullPageLoader label="Ładowanie wydarzenia…" />;
  if (!tournament) return null;

  const seats = capacity(tournament._count.participants, tournament.maxParticipants);
  const liveCount = tournament.matches.filter((match) => match.status === 'IN_PROGRESS').length;

  return (
    <main className="page">
      <div className="shell">
        <BackLink to="/tournaments">Wszystkie wydarzenia</BackLink>

        <div className="grid gap-8 lg:grid-cols-[1fr_360px] lg:items-start">
          <header className="min-w-0">
            <div className="mb-5 flex flex-wrap items-center gap-3">
              <SportLabel sport={tournament.sportType} />
              <StatusChip status={tournament.status} />
              {liveCount > 0 && <span className="chip" data-tone="live"><span className="live-dot" aria-hidden="true" />{liveCount} {plural(liveCount, 'mecz trwa', 'mecze trwają', 'meczów trwa')}</span>}
            </div>
            <Title>{tournament.title}</Title>
            {tournament.description && <p className="lede mt-5 max-w-2xl whitespace-pre-line">{tournament.description}</p>}

            <Reveal as="dl" stagger={0.05} className="mt-8 grid gap-x-6 gap-y-5 sm:grid-cols-2 xl:grid-cols-3">
              <Fact icon="calendar" label="Termin" value={formatDateTime(tournament.date, { month: 'long' })} />
              {tournament.location && <Fact icon="pin" label="Lokalizacja" value={tournament.location} />}
              <Fact icon="user" label="Organizator" value={tournament.organizer.name} />
              {tournament.format && <Fact icon="bracket" label="Format" value={FORMAT_LABELS[tournament.format] || tournament.format} />}
              {tournament.registrationType && (
                <Fact
                  icon="users"
                  label="Zgłoszenia"
                  value={tournament.registrationType === 'TEAM'
                    ? `Drużynowe${tournament.minTeamSize ? ` · ${tournament.minTeamSize}–${tournament.maxTeamSize} osób` : ''}`
                    : 'Indywidualne'}
                />
              )}
              {tournament.registrationDeadline && <Fact icon="clock" label="Zapisy do" value={formatDateTime(tournament.registrationDeadline)} />}
              {tournament.entryFee !== null && tournament.entryFee !== undefined && (
                <Fact icon="card" label="Wpisowe" value={Number(tournament.entryFee) > 0 ? `${Number(tournament.entryFee).toFixed(2)} ${tournament.currency || ''}` : 'Bezpłatne'} />
              )}
              <Fact icon="list" label="Mecze" value={tournament.matches.length || 'Harmonogram w przygotowaniu'} />
            </Reveal>
          </header>

          <Reveal as="aside" delay={0.15} className="card card-pad lg:sticky lg:top-[calc(var(--nav-h)+1.5rem)]" aria-label="Zapisy">
            <p className="eyebrow eyebrow-plain">Zapisy</p>
            <p className="num mt-3 text-6xl">
              {seats.taken}<span className="text-muted">/{seats.limit}</span>
            </p>
            <p className="mt-2 text-sm text-muted">
              {seats.free > 0
                ? `Zostało ${seats.free} ${plural(seats.free, 'wolne miejsce', 'wolne miejsca', 'wolnych miejsc')}`
                : 'Wszystkie miejsca są zajęte'}
            </p>
            <Meter value={seats.percent} label={`Zajęte ${seats.percent}% miejsc`} className="mt-4" />

            <div className="mt-6 grid gap-3">
              {canJoin && (
                <>
                  <button type="button" onClick={handleJoin} disabled={joinLoading} className="btn btn-primary btn-lg btn-block">
                    {joinLoading ? 'Zapisywanie…' : 'Zapisz się'} {!joinLoading && <Arrow />}
                  </button>
                  <p className="hint !mt-0">
                    {user
                      ? 'Po zapisie Twoje mecze i wyniki pojawią się w panelu zawodnika.'
                      : 'Nie masz konta? Założysz je w następnym kroku, a my od razu dopiszemy Cię do listy.'}
                  </p>
                </>
              )}
              {canLeave && (
                <>
                  <div className="notice" data-tone="ok">
                    <Icon name="check" size={19} />
                    <span>Jesteś na liście uczestników.</span>
                  </div>
                  <Link to="/player" className="btn btn-solid btn-block">Mój panel zawodnika <Arrow /></Link>
                  <button type="button" onClick={handleLeave} disabled={joinLoading} className="btn btn-quiet btn-sm">
                    {joinLoading ? 'Chwileczkę…' : 'Wypisz się z wydarzenia'}
                  </button>
                </>
              )}
              {canManage && (
                <>
                  {isOrganizer && <p className="text-sm font-semibold text-ink">To Twoje wydarzenie.</p>}
                  <Link to={`/organizer/events/${id}`} className="btn btn-solid btn-block">Zarządzaj wydarzeniem <Arrow /></Link>
                </>
              )}
              {!canJoin && !canLeave && !canManage && (
                <p className="text-sm leading-relaxed text-muted">
                  {registrationOpen
                    ? 'Zapisy są przeznaczone dla kont zawodników.'
                    : 'Zapisy na to wydarzenie są zamknięte. Możesz śledzić mecze i wyniki poniżej.'}
                </p>
              )}
            </div>
          </Reveal>
        </div>

        {actionMsg && <Notice className="mt-8" onClose={() => setActionMsg('')}>{actionMsg}</Notice>}

        <section className="mt-14">
          <SectionHeading eyebrow="Kto gra" title="Uczestnicy" count={`${seats.taken}/${seats.limit}`} />
          {tournament.participants.length === 0 ? (
            <p className="well p-5 text-sm text-muted">Jeszcze nikt się nie zapisał. {canJoin ? 'Możesz być pierwszą osobą na liście.' : ''}</p>
          ) : (
            <Reveal as="ul" stagger={0.025} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {tournament.participants.map((p) => (
                <li key={p.id} className="flex items-center gap-3 rounded-[12px] border border-line bg-surface px-3 py-2.5">
                  <Avatar name={p.user.name} />
                  <span className="min-w-0 truncate text-[0.9375rem] font-semibold text-ink">{p.user.name}</span>
                  {user?.id === p.userId && <span className="chip ml-auto" data-tone="accent">Ty</span>}
                </li>
              ))}
            </Reveal>
          )}
        </section>

        {Object.keys(standings).length > 0 && (
          <section className="mt-14">
            <SectionHeading eyebrow="Aktualizowane na żywo" title="Tabele" />
            <div className="grid gap-5 lg:grid-cols-2">
              {Object.entries(standings).map(([group, entries]) => (
                <Reveal key={group} className="card overflow-hidden">
                  <h3 className="h-card border-b border-line px-5 py-4">{group === 'general' ? 'Klasyfikacja' : group}</h3>
                  <div className="overflow-x-auto">
                    <table className="table min-w-[420px]">
                      <thead>
                        <tr>
                          <th scope="col">#</th>
                          <th scope="col">Uczestnik</th>
                          <th scope="col" title="Mecze">M</th>
                          <th scope="col" title="Bilans">+/-</th>
                          <th scope="col" title="Punkty">Pkt</th>
                          <th scope="col" title="Fair play">FP</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entries.map((entry) => (
                          <tr key={entry.participantId}>
                            <td><span className={`num text-xl ${entry.position === 1 ? 'marker' : ''}`}>{entry.position}</span></td>
                            <td className="font-semibold text-ink">{entry.name}</td>
                            <td className="mono">{entry.played}</td>
                            <td className="mono">{entry.difference > 0 ? '+' : ''}{entry.difference}</td>
                            <td className="mono font-bold text-ink">{entry.points}</td>
                            <td className="mono">{entry.fairPlay}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Reveal>
              ))}
            </div>
          </section>
        )}

        {tournament.matches.length > 0 && (
          <section className="mt-14">
            <SectionHeading eyebrow="Harmonogram i wyniki" title="Mecze" count={tournament.matches.length} />
            <Reveal stagger={0.04} className="grid gap-3">
              {tournament.matches.map((m) => {
                const live = m.status === 'IN_PROGRESS';
                const showScore = m.status === 'FINISHED' || live;
                return (
                  <article key={m.id} className={`card p-4 sm:p-5 ${live ? '!border-live/50' : ''}`}>
                    <div className="grid items-center gap-4 md:grid-cols-[110px_1fr_auto]">
                      <div className="flex items-center gap-3 md:block">
                        <p className="mono text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-muted">Runda {m.round}</p>
                        <StatusChip status={m.status} kind="match" className="md:mt-2" />
                      </div>
                      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                        <p className={`min-w-0 break-words text-right font-semibold ${m.winnerId && m.winnerId === m.player1Id ? 'text-ink' : m.winnerId ? 'text-muted' : 'text-ink'}`}>
                          {m.player1?.name || 'Oczekiwanie na awans'}
                        </p>
                        <p className="num min-w-[4.5rem] text-center text-3xl">
                          {showScore ? `${m.score1 ?? 0}:${m.score2 ?? 0}` : <span className="text-xl text-muted">VS</span>}
                        </p>
                        <p className={`min-w-0 break-words font-semibold ${m.winnerId && m.winnerId === m.player2Id ? 'text-ink' : m.winnerId ? 'text-muted' : 'text-ink'}`}>
                          {m.player2?.name || 'Oczekiwanie na awans'}
                        </p>
                      </div>
                      <Link to={`/tournaments/${id}/matches/${m.id}/live`} className={`btn btn-sm ${live ? 'btn-primary' : 'btn-ghost'}`}>
                        {live ? 'Oglądaj na żywo' : 'Śledź wynik'} <Arrow size={16} />
                      </Link>
                    </div>
                    {m.winnerId && (
                      <p className="mt-3 flex items-center gap-2 border-t border-line pt-3 text-sm font-semibold text-ink">
                        <Icon name="trophy" size={16} />
                        Zwycięzca: {m.winnerId === m.player1Id ? m.player1?.name : m.player2?.name}
                      </p>
                    )}
                    {canManage && m.player1 && m.player2 && (
                      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
                        <button type="button" onClick={() => createRefereeLink(m.id)} className="btn btn-ghost btn-sm">
                          <Icon name="link" size={16} /> Utwórz link dla sędziego
                        </button>
                        {refereeLinks[m.id] && (
                          <>
                            <button
                              type="button"
                              onClick={() => navigator.clipboard.writeText(`${window.location.origin}${refereeLinks[m.id].accessUrl}`).then(() => setActionMsg('Link sędziego skopiowany.')).catch(() => setActionMsg('Skopiuj link sędziego ręcznie.'))}
                              className="btn btn-solid btn-sm"
                            ><Icon name="copy" size={16} /> Kopiuj link</button>
                            <button type="button" onClick={() => revokeRefereeLink(m.id)} className="btn btn-danger btn-sm">Unieważnij</button>
                            <a href={refereeLinks[m.id].accessUrl} className="mono w-full break-all text-xs text-muted underline">{window.location.origin}{refereeLinks[m.id].accessUrl}</a>
                          </>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </Reveal>
          </section>
        )}
      </div>
    </main>
  );
}
