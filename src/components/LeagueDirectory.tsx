import React, { useEffect, useMemo, useState } from 'react';
import {
  Trophy,
  MapPin,
  Calendar,
  RotateCcw,
  ArrowRight,
  Clock,
  Handshake,
  ExternalLink,
  GitBranch,
  ShieldCheck,
  UserRound,
  Users,
  UsersRound,
} from 'lucide-react';
import heroImage from '../assets/images/hero_floodlit_pitch_1795345163452.jpg';
import type { League, LeagueDatabase, LeagueType, Partner } from '../types.ts';
import {
  calculateSeasonDurationLabel,
  checkCoEdTeamCompliance,
  computeChampionsCupSeeds,
  computeDynamicPrizeDisplay,
} from '../utils/leagueHelpers.ts';

interface LeagueDirectoryProps {
  db: LeagueDatabase;
  selectedLeagueType: 'All' | 'League' | 'Tournament';
  onSelectLeagueType: (type: 'All' | 'League' | 'Tournament') => void;
  onRegisterLeague: (leagueId: string, mode?: 'team' | 'split' | 'solo' | 'waitlist') => void;
  onOpenHub: (leagueId: string) => void;
  onDatabaseUpdate: (db: LeagueDatabase) => void;
}

export const LeagueDirectory: React.FC<LeagueDirectoryProps> = ({
  db,
  selectedLeagueType,
  onSelectLeagueType,
  onRegisterLeague,
  onOpenHub,
  onDatabaseUpdate,
}) => {
  const [typeFilter, setTypeFilter] = useState<'All' | LeagueType>(selectedLeagueType);
  const [cityFilter, setCityFilter] = useState<string>('All');
  const [venueFilter, setVenueFilter] = useState<string>('All');
  const [dayFilter, setDayFilter] = useState<string>('All');
  const [formatFilter, setFormatFilter] = useState<string>('All');
  const [skillFilter, setSkillFilter] = useState<string>('All');
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({});

  // Become a Partner form
  const [showPartnerForm, setShowPartnerForm] = useState(false);
  const [partnerName, setPartnerName] = useState('');
  const [partnerCategory, setPartnerCategory] = useState<Partner['category']>('Local Sponsor');
  const [partnerTagline, setPartnerTagline] = useState('');
  const [partnerEmail, setPartnerEmail] = useState('');
  const [partnerUrl, setPartnerUrl] = useState('');
  const [partnerSubmitted, setPartnerSubmitted] = useState(false);

  const cityOptions = useMemo(() => {
    const set = new Set<string>(db.cities || []);
    db.venues.forEach((v) => v.city && set.add(v.city));
    db.leagues.forEach((l) => l.city && set.add(l.city));
    return ['All', ...Array.from(set)];
  }, [db.cities, db.venues, db.leagues]);
  const availableCities = cityOptions.filter((city) => city !== 'All');

  useEffect(() => {
    setTypeFilter(selectedLeagueType);
  }, [selectedLeagueType]);

  const venueOptions = useMemo(() => {
    const list = db.venues.filter((v) => cityFilter === 'All' || v.city === cityFilter);
    return [{ id: 'All', name: 'All Fields & Domes' }, ...list];
  }, [db.venues, cityFilter]);

  const filteredLeagues = useMemo(() => {
    return db.leagues.filter((lg) => {
      const venue = db.venues.find((v) => v.id === lg.venueId);
      const lgCity = lg.city || venue?.city || '';
      if (typeFilter !== 'All' && lg.leagueType !== typeFilter) return false;
      if (cityFilter !== 'All' && lgCity !== cityFilter) return false;
      if (venueFilter !== 'All' && lg.venueId !== venueFilter) return false;
      if (dayFilter !== 'All' && lg.dayOfWeek !== dayFilter) return false;
      if (formatFilter !== 'All' && lg.format !== formatFilter) return false;
      if (skillFilter !== 'All' && lg.skillLevel !== skillFilter) return false;
      return true;
    });
  }, [db.leagues, db.venues, typeFilter, cityFilter, venueFilter, dayFilter, formatFilter, skillFilter]);

  const approvedPartners = db.partners.filter((p) => p.status === 'Approved');
  const marketListedCount = db.players.filter((p) => p.marketListing !== null).length;
  const activeLoansCount = db.transfers.filter((t) => t.kind === 'loan' && t.status === 'Active').length;

  const cup = db.championsCup;
  const cupSeeds = useMemo(
    () =>
      cup?.enabled
        ? computeChampionsCupSeeds(cup.linkedLeagueIds, db.leagues, db.teams, db.matches)
        : [],
    [cup, db.leagues, db.teams, db.matches]
  );

  const resetFilters = () => {
    setTypeFilter('All');
    onSelectLeagueType('All');
    setCityFilter('All');
    setVenueFilter('All');
    setDayFilter('All');
    setFormatFilter('All');
    setSkillFilter('All');
  };

  const hasActiveFilters =
    typeFilter !== 'All' ||
    cityFilter !== 'All' ||
    venueFilter !== 'All' ||
    dayFilter !== 'All' ||
    formatFilter !== 'All' ||
    skillFilter !== 'All';

  const handlePartnerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/partners', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: partnerName,
        category: partnerCategory,
        tagline: partnerTagline,
        contactEmail: partnerEmail,
        promoUrl: partnerUrl || 'https://example.com',
        status: 'Pending',
      }),
    });
    if (res.ok) {
      onDatabaseUpdate(await res.json());
      setPartnerSubmitted(true);
      setPartnerName('');
      setPartnerTagline('');
      setPartnerEmail('');
      setPartnerUrl('');
    }
  };

  const getStatusLabel = (status: League['status']) => {
    if (status === 'TESTING') return 'TESTING / REGISTRATION OPEN';
    if (status === 'OPEN') return 'OPEN FOR SIGN-UPS';
    if (status === 'LIVE') return 'LIVE SEASON';
    return 'COMPLETED';
  };

  return (
    <div className="space-y-12 pb-20">
      {/* Site-Wide Pre-Season / Testing Banner */}
      {db.brand.bannerEnabled && (
        <div className="border-b border-white/10 bg-[#111821] px-4 py-2.5">
          <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
            <span className="font-medium text-slate-200 text-center sm:text-left">
              {db.brand.bannerText}
            </span>
            <button
              type="button"
              onClick={() => onRegisterLeague(db.leagues[0]?.id || '', 'waitlist')}
              className="shrink-0 font-semibold underline hover:opacity-80 cursor-pointer"
              style={{ color: db.brand.primaryColor }}
            >
              Join the waitlist <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      )}

      <section className="mx-auto max-w-7xl px-4 sm:px-6 pt-5">
        <div className="relative min-h-[440px] sm:min-h-[540px] overflow-hidden rounded-2xl border border-white/10 bg-[#111821]">
          {!imgErrors.hero ? (
            <img
              src={heroImage}
              alt="Adult soccer match under stadium floodlights"
              onError={() => setImgErrors((prev) => ({ ...prev, hero: true }))}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-950 via-[#111821] to-[#090D12]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-[#090D12]/90 via-[#090D12]/50 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#090D12]/75 via-transparent to-transparent" />
          <div className="relative flex min-h-[440px] sm:min-h-[540px] items-end px-6 py-8 sm:px-10 sm:py-12">
            <div className="max-w-3xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-md border border-white/20 bg-[#090D12]/65 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur">
                <Trophy className="h-4 w-4" style={{ color: db.brand.primaryColor }} />
                <span>Adult leagues · Tournaments · Community</span>
              </div>
              <h1
                className="font-display text-5xl sm:text-7xl lg:text-8xl font-extrabold tracking-tight leading-[0.9] text-white"
                style={{ textWrap: 'balance' }}
              >
                {db.brand.tagline}
              </h1>
              <p className="mt-5 max-w-2xl text-sm sm:text-base leading-relaxed text-slate-200">
                {db.brand.aboutText}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => document.getElementById('programs')?.scrollIntoView({ behavior: 'smooth' })}
                  style={{ backgroundColor: db.brand.primaryColor }}
                  className="min-h-[46px] rounded-lg px-5 py-2.5 text-sm font-bold text-slate-950 hover:opacity-90 transition-opacity cursor-pointer"
                >
                  Find a League
                </button>
                <button
                  type="button"
                  onClick={() => onRegisterLeague(db.leagues[0]?.id || '', 'team')}
                  className="min-h-[46px] rounded-lg border border-white/25 bg-[#090D12]/60 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur hover:bg-[#090D12]/80 transition-colors cursor-pointer"
                >
                  Register Your Team
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="rounded-xl border border-white/10 bg-[#111821] px-5 py-4">
            <div className="text-xs text-slate-400">Leagues & Tournaments</div>
            <div className="font-mono-num text-2xl font-bold text-white mt-1">
              {db.leagues.length}
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#111821] px-5 py-4">
            <div className="text-xs text-slate-400">Teams & Waitlist</div>
            <div className="font-mono-num text-2xl font-bold text-emerald-400 mt-1">
              {db.teams.length} / {db.waitlist.length}
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#111821] px-5 py-4">
            <div className="text-xs text-slate-400">Market / Active 4G Loans</div>
            <div className="font-mono-num text-2xl font-bold text-amber-400 mt-1">
              {marketListedCount} / {activeLoansCount}
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#111821] px-5 py-4">
            <div className="text-xs text-slate-400">Open Sub / Ride Requests</div>
            <div className="font-mono-num text-2xl font-bold text-white mt-1">
              {db.subRequests.filter((s) => s.status === 'Open').length} / {db.rides.length}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 sm:px-6 space-y-6">
        <div className="max-w-2xl">
          <div className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: db.brand.primaryColor }}>
            Everyone has a place on the pitch
          </div>
          <h2 className="mt-2 font-display text-3xl sm:text-4xl font-bold text-white">
            Bring your squad. Or find your people.
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Join the way that works for you. Follow your league, team, fixtures, and standings all season long.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              title: 'Free Agent',
              description: 'New to the area or just looking for a team? Register solo and get in the game.',
              icon: <UserRound className="h-5 w-5" />,
              mode: 'solo' as const,
              action: 'Join as a Free Agent',
            },
            {
              title: 'Play with a Friend',
              description: 'Sign up as a player and invite a friend to join you in the same league.',
              icon: <UsersRound className="h-5 w-5" />,
              mode: 'solo' as const,
              action: 'Find a League Together',
            },
            {
              title: 'Full Team',
              description: 'Already have a squad? Register your team and start your season together.',
              icon: <Users className="h-5 w-5" />,
              mode: 'team' as const,
              action: 'Register Your Team',
            },
          ].map((option) => (
            <article key={option.title} className="rounded-2xl border border-white/10 bg-[#111821] p-6 sm:p-7">
              <div
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10"
                style={{ color: db.brand.primaryColor, backgroundColor: `${db.brand.primaryColor}12` }}
              >
                {option.icon}
              </div>
              <h3 className="mt-4 font-display text-2xl font-bold text-white">{option.title}</h3>
              <p className="mt-2 min-h-12 text-sm leading-relaxed text-slate-400">{option.description}</p>
              <button
                type="button"
                onClick={() => onRegisterLeague(db.leagues[0]?.id || '', option.mode)}
                className="mt-5 inline-flex min-h-[42px] items-center gap-2 text-sm font-semibold hover:opacity-80 cursor-pointer"
                style={{ color: db.brand.primaryColor }}
              >
                {option.action}
                <ArrowRight className="h-4 w-4" />
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="rounded-2xl border border-white/10 bg-[#111821] p-6 sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: db.brand.primaryColor }}>
                <MapPin className="h-4 w-4" />
                Where we play
              </div>
              <h2 className="mt-2 font-display text-3xl sm:text-4xl font-bold text-white">
                Find a game near you
              </h2>
              <p className="mt-2 max-w-xl text-sm text-slate-400">
                Browse soccer leagues by city, then explore each league’s teams, fixtures, and standings.
              </p>
            </div>
            {availableCities.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {availableCities.slice(0, 8).map((city) => (
                  <button
                    key={city}
                    type="button"
                    onClick={() => {
                      setCityFilter(city);
                      document.getElementById('programs')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="min-h-[38px] rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-200 hover:border-white/30 hover:bg-white/10 cursor-pointer"
                  >
                    {city}
                  </button>
                ))}
              </div>
            )}
          </div>
          {availableCities.length === 0 && (
            <div className="mt-5 flex flex-col gap-3 rounded-xl border border-white/10 bg-[#090D12]/60 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-400">
                New league locations will appear here as seasons are added.
              </p>
              <button
                type="button"
                onClick={() => document.getElementById('programs')?.scrollIntoView({ behavior: 'smooth' })}
                className="inline-flex min-h-[40px] items-center gap-2 text-sm font-semibold hover:opacity-80 cursor-pointer"
                style={{ color: db.brand.primaryColor }}
              >
                Explore programs
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Road to the Co-Ed Champion of Champions Cup */}
      {cup?.enabled && cupSeeds.length >= 2 && (
        <section className="mx-auto max-w-7xl px-4 sm:px-6 space-y-6">
          <div className="rounded-2xl border border-amber-400/25 bg-[#111821] p-6 sm:p-8 space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/10 pb-5">
              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-2 text-xs font-semibold text-amber-300">
                  <Trophy className="h-4 w-4 text-amber-400" />
                  <span>Road to the Co-Ed Cup · {cup.seasonLabel}</span>
                </div>
                <h2 className="font-display text-3xl sm:text-4xl font-bold text-white tracking-tight">
                  {cup.name}
                </h2>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-300">
                  <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    {cup.enforceGenderRatio
                      ? `Min ${cup.minFemaleOnField} Female Players on Pitch`
                      : 'Open Co-Ed Ratio'}
                  </span>
                  <span aria-hidden="true" className="text-slate-600">·</span>
                  <span>
                    {cup.lockRostersToRegularSeason
                      ? `Regular-Season Roster Lock (Min ${cup.minRegularSeasonGames} GP · No Ringers)`
                      : 'Standard Playoff Roster'}
                  </span>
                  <span aria-hidden="true" className="text-slate-600">·</span>
                  <span className="font-mono-num text-slate-400">
                    {cupSeeds.length}-Division Auto-Scaled Bracket
                  </span>
                </div>
              </div>

              <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 shrink-0">
                <div className="text-[11px] font-medium text-amber-200">Super Cup Bonus Pot</div>
                <div className="font-display text-xl font-bold text-amber-300">
                  {cup.bonusPrizeText}
                </div>
              </div>
            </div>

            {/* Current #1 Division Seeds */}
            <div className="space-y-2.5">
              <div className="text-xs font-semibold text-slate-300">
                Current #1 Automatic Qualifiers by Division Night
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {cupSeeds.map((sd) => {
                  const compliance = checkCoEdTeamCompliance(sd.teamId, db.players, cup);
                  return (
                    <button
                      key={sd.leagueId}
                      type="button"
                      onClick={() => onOpenHub(sd.leagueId)}
                      className="text-left rounded-xl border border-white/10 bg-[#090D12] p-4 hover:border-emerald-500/40 transition-colors cursor-pointer space-y-2"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-emerald-400">{sd.divisionDay}</span>
                        <span className="font-mono-num font-bold text-amber-300">Seed #{sd.seed}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className="h-3 w-3 rounded-xs shrink-0"
                          style={{ backgroundColor: sd.kitColor }}
                        />
                        <span className="font-display text-lg font-bold text-white truncate">
                          {sd.teamName}
                        </span>
                      </div>
                      <div className="text-xs font-mono-num text-slate-400">
                        {sd.w}W-{sd.d}D-{sd.l}L · {sd.pts} PTS · GD {sd.gd >= 0 ? `+${sd.gd}` : sd.gd}
                      </div>
                      <div className="text-[11px] text-slate-300 pt-1 border-t border-white/5 flex items-center justify-between">
                        <span>
                          {compliance.meetsGenderRatio
                            ? `Female Eligible: ${compliance.femaleEligibleCount}/${cup.minFemaleOnField}`
                            : `Needs ${cup.minFemaleOnField - compliance.femaleEligibleCount} Female GP`}
                        </span>
                        <span className="text-emerald-400 font-medium">Hub →</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Live Auto-Scaled Knockout Bracket Preview */}
            <div className="space-y-3 pt-2 border-t border-white/10">
              <div className="flex items-center justify-between text-xs">
                <span className="inline-flex items-center gap-1.5 font-semibold text-white">
                  <GitBranch className="h-4 w-4 text-emerald-400" />
                  <span>
                    Live {cupSeeds.length}-Team Knockout Bracket Preview
                    {cupSeeds.length === 3 ? ' (#1 Seed Bye to Grand Final)' : ''}
                  </span>
                </span>
                <span className="text-slate-400">Updated automatically from division tables</span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-center">
                {cup.matches.some((m) => m.round === 'Quarterfinal') && (
                  <div className="space-y-3">
                    {cup.matches
                      .filter((m) => m.round === 'Quarterfinal')
                      .map((m) => (
                        <div key={m.id} className="rounded-xl border border-white/10 bg-[#090D12] p-3.5 text-xs space-y-1.5">
                          <div className="flex justify-between text-slate-400">
                            <span>{m.bracketSlot}</span>
                            <span className="font-mono-num">{m.scheduledTime}</span>
                          </div>
                          <div className="flex justify-between font-semibold text-white">
                            <span>{m.homeSeed ? `#${m.homeSeed} ` : ''}{m.homeTeamName}</span>
                            <span className="font-mono-num">{m.status === 'Final' ? m.homeScore : '—'}</span>
                          </div>
                          <div className="flex justify-between font-semibold text-white">
                            <span>{m.awaySeed ? `#${m.awaySeed} ` : ''}{m.awayTeamName}</span>
                            <span className="font-mono-num">{m.status === 'Final' ? m.awayScore : '—'}</span>
                          </div>
                        </div>
                      ))}
                  </div>
                )}

                {cup.matches.some((m) => m.round === 'Semifinal') && (
                  <div className="space-y-3 lg:col-span-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {cup.matches
                        .filter((m) => m.round === 'Semifinal')
                        .map((m) => (
                          <div key={m.id} className="rounded-xl border border-white/10 bg-[#090D12] p-4 text-xs space-y-2">
                            <div className="flex justify-between text-slate-400">
                              <span className="font-semibold text-emerald-400">{m.bracketSlot}</span>
                              <span>{m.fieldNumber}</span>
                            </div>
                            <div className="flex justify-between items-center font-semibold text-white">
                              <span>
                                {m.homeSeed ? `#${m.homeSeed} ` : ''}
                                {m.homeTeamName}{' '}
                                <span className="text-slate-500 font-normal">({m.homeDivisionLabel})</span>
                              </span>
                              <span className="font-mono-num text-sm">{m.status === 'Final' ? m.homeScore : '—'}</span>
                            </div>
                            <div className="flex justify-between items-center font-semibold text-white">
                              <span>
                                {m.awaySeed ? `#${m.awaySeed} ` : ''}
                                {m.awayTeamName}{' '}
                                <span className="text-slate-500 font-normal">({m.awayDivisionLabel})</span>
                              </span>
                              <span className="font-mono-num text-sm">{m.status === 'Final' ? m.awayScore : '—'}</span>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {cup.matches
                  .filter((m) => m.round === 'Final')
                  .map((m) => {
                    const champ =
                      m.status === 'Final' && m.homeScore !== null && m.awayScore !== null
                        ? m.homeScore > m.awayScore
                          ? m.homeTeamName
                          : m.awayTeamName
                        : null;
                    return (
                      <div
                        key={m.id}
                        className={`rounded-xl border border-amber-400/35 bg-amber-400/5 p-4 text-xs space-y-2 ${
                          !cup.matches.some((x) => x.round === 'Semifinal') ? 'lg:col-span-3' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="inline-flex items-center gap-1.5 font-bold text-amber-300">
                            <Trophy className="h-3.5 w-3.5" />
                            <span>{m.bracketSlot}</span>
                          </span>
                          <span className="font-mono-num text-slate-300">{m.scheduledDate}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm font-bold text-white">
                          <span>
                            {m.homeSeed ? `#${m.homeSeed} ` : ''}
                            {m.homeTeamName}
                          </span>
                          <span className="font-mono-num text-amber-300">
                            {m.status === 'Final' ? m.homeScore : '—'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-sm font-bold text-white">
                          <span>
                            {m.awaySeed ? `#${m.awaySeed} ` : ''}
                            {m.awayTeamName}
                          </span>
                          <span className="font-mono-num text-amber-300">
                            {m.status === 'Final' ? m.awayScore : '—'}
                          </span>
                        </div>
                        <div className="pt-1.5 border-t border-amber-400/20 text-[11px] text-amber-200 font-medium">
                          {champ
                            ? `Undisputed Co-Ed Champion: ${champ}`
                            : `Winner Claims: ${cup.bonusPrizeText}`}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Filterable League & Tournament Directory */}
      <section id="programs" className="mx-auto max-w-7xl px-4 sm:px-6 space-y-6 scroll-mt-24">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <h2 className="font-display text-3xl font-bold text-white tracking-tight">
              Find your next soccer league
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Explore open leagues and tournaments, compare divisions, and join the game that fits your schedule.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-[#111821] p-1">
              {(['All', 'League', 'Tournament'] as const).map((tp) => (
                <button
                  key={tp}
                  type="button"
                  onClick={() => {
                    setTypeFilter(tp);
                    onSelectLeagueType(tp);
                  }}
                  className={`min-h-[36px] rounded-md px-3 py-1 text-xs font-semibold cursor-pointer whitespace-nowrap ${
                    typeFilter === tp
                      ? 'bg-emerald-500 text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {tp === 'All' ? 'All Events' : tp === 'League' ? 'Leagues' : 'Monthly Cups'}
                </button>
              ))}
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="min-h-[38px] inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Multi-Facet Filter Controls */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">City</label>
            <select
              value={cityFilter}
              onChange={(e) => {
                setCityFilter(e.target.value);
                setVenueFilter('All');
              }}
              className="w-full min-h-[42px] rounded-lg border border-white/10 bg-[#111821] px-3 py-2 text-xs font-medium text-white"
            >
              {cityOptions.map((c) => (
                <option key={c} value={c}>
                  {c === 'All' ? 'All Cities' : c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">Field / Venue</label>
            <select
              value={venueFilter}
              onChange={(e) => setVenueFilter(e.target.value)}
              className="w-full min-h-[42px] rounded-lg border border-white/10 bg-[#111821] px-3 py-2 text-xs font-medium text-white"
            >
              {venueOptions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">Day</label>
            <select
              value={dayFilter}
              onChange={(e) => setDayFilter(e.target.value)}
              className="w-full min-h-[42px] rounded-lg border border-white/10 bg-[#111821] px-3 py-2 text-xs font-medium text-white"
            >
              {['All', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(
                (d) => (
                  <option key={d} value={d}>
                    {d === 'All' ? 'All Days' : d}
                  </option>
                )
              )}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">Format</label>
            <select
              value={formatFilter}
              onChange={(e) => setFormatFilter(e.target.value)}
              className="w-full min-h-[42px] rounded-lg border border-white/10 bg-[#111821] px-3 py-2 text-xs font-medium text-white"
            >
              {['All', '5v5', '6v6', '7v7', '11v11'].map((f) => (
                <option key={f} value={f}>
                  {f === 'All' ? 'All Formats' : f}
                </option>
              ))}
            </select>
          </div>

          <div className="col-span-2 sm:col-span-1">
            <label className="block text-[11px] font-medium text-slate-400 mb-1">Skill Level</label>
            <select
              value={skillFilter}
              onChange={(e) => setSkillFilter(e.target.value)}
              className="w-full min-h-[42px] rounded-lg border border-white/10 bg-[#111821] px-3 py-2 text-xs font-medium text-white"
            >
              {['All', 'Recreational', 'Intermediate', 'Competitive', 'Premier'].map((sk) => (
                <option key={sk} value={sk}>
                  {sk === 'All' ? 'All Skill Tiers' : sk}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* League & Tournament Cards */}
        {db.leagues.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-[#111821] p-8 sm:p-10 text-center space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-amber-400/30 bg-amber-400/10 text-amber-300">
              <Trophy className="h-6 w-6" />
            </div>
            <div className="space-y-1.5 max-w-xl mx-auto">
              <h3 className="font-display text-2xl font-bold text-white">
                New seasons are on the way
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                There are no published leagues right now. Join the waitlist and we’ll let you know when the next soccer season opens.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => onRegisterLeague('', 'waitlist')}
                style={{ backgroundColor: db.brand.primaryColor }}
                className="min-h-[42px] rounded-lg px-5 py-2 text-xs font-bold text-slate-950 hover:opacity-90 cursor-pointer"
              >
                Join the Waitlist
              </button>
            </div>
          </div>
        ) : filteredLeagues.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-[#111821] p-8 text-center space-y-3">
            <div className="font-display text-xl font-bold text-white">
              No leagues match your selected filters
            </div>
            <p className="text-xs text-slate-400">
              Try clearing your City, Field, Day, Format, or Division filters.
            </p>
            <button
              type="button"
              onClick={resetFilters}
              className="min-h-[38px] inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-semibold text-white hover:bg-white/10 cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset Filters</span>
            </button>
          </div>
        ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredLeagues.map((league: League) => {
            const venue = db.venues.find((v) => v.id === league.venueId);
            const registeredTeams = db.teams.filter((t) => t.leagueId === league.id).length;
            const prizeInfo = computeDynamicPrizeDisplay(league, registeredTeams);
            const durationLabel = calculateSeasonDurationLabel(
              league.gameWeeks,
              league.gamesPerWeek,
              league.leagueType
            );
            const fillPercent = Math.min(100, Math.round((registeredTeams / league.maxTeams) * 100));

            return (
              <article
                key={league.id}
                className="flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#111821] hover:border-white/20 transition-colors"
              >
                <div className="relative h-48 w-full overflow-hidden bg-[#090D12]">
                  {!imgErrors[league.id] ? (
                    <img
                      src={league.imageUrl}
                      alt={league.name}
                      referrerPolicy="no-referrer"
                      onError={() => setImgErrors((prev) => ({ ...prev, [league.id]: true }))}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full bg-gradient-to-br from-emerald-950/60 to-[#090D12] flex items-center justify-center">
                      <Trophy className="h-12 w-12 text-amber-400/50" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#111821] via-black/35 to-transparent" />

                  <div className="absolute top-3.5 left-3.5 right-3.5 flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-400/50 bg-gradient-to-r from-amber-500/95 to-emerald-500/95 px-2.5 py-1 text-xs font-bold text-slate-950">
                      <Trophy className="h-3.5 w-3.5" />
                      <span>Cash Prize {league.leagueType === 'Tournament' ? 'Cup' : 'League'}</span>
                    </span>

                    <span
                      className={`rounded-md px-2.5 py-1 text-[11px] font-bold border ${
                        league.status === 'TESTING'
                          ? 'bg-amber-500/20 border-amber-400/50 text-amber-200'
                          : league.status === 'LIVE'
                          ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200'
                          : 'bg-slate-800/90 border-white/20 text-slate-200'
                      }`}
                    >
                      {getStatusLabel(league.status)}
                    </span>
                  </div>

                  <div className="absolute bottom-3 left-4 right-4">
                    <h3 className="font-display text-2xl font-bold text-white leading-tight">
                      {league.name}
                    </h3>
                  </div>
                </div>

                <div className="flex flex-1 flex-col justify-between p-5 sm:p-6 space-y-4">
                  <div className="space-y-3.5">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-300">
                      <span className="inline-flex items-center gap-1 font-medium text-white">
                        <MapPin className="h-3.5 w-3.5 text-emerald-400" />
                        {league.city || venue?.city || 'Toronto'} · {venue?.name || league.locationName}
                      </span>
                      {venue?.indoorOutdoor && (
                        <>
                          <span aria-hidden="true" className="text-slate-600">·</span>
                          <span className="text-sky-300 font-medium">{venue.indoorOutdoor}</span>
                        </>
                      )}
                      <span aria-hidden="true" className="text-slate-600">·</span>
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5 text-emerald-400" />
                        {league.dayOfWeek}s ({league.startDate})
                      </span>
                      <span aria-hidden="true" className="text-slate-600">·</span>
                      <span>{league.format}</span>
                      <span aria-hidden="true" className="text-slate-600">·</span>
                      <span>{league.division}</span>
                      <span aria-hidden="true" className="text-slate-600">·</span>
                      <span>{league.skillLevel}</span>
                    </div>

                    {league.description && (
                      <p className="text-xs text-slate-400 leading-relaxed">{league.description}</p>
                    )}

                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-emerald-300 font-medium">
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 shrink-0" />
                        <span>{durationLabel}</span>
                      </span>
                      <span aria-hidden="true" className="text-slate-600">·</span>
                      <span className="text-slate-300">25m / 5m HT / 25m (55m)</span>
                      <span aria-hidden="true" className="text-slate-600">·</span>
                      <span className="text-slate-300">
                        {(venue?.fields?.length || 1)}{' '}
                        {(venue?.fields?.length || 1) === 1 ? 'Field' : 'Fields'} ({(venue?.fields || ['Turf 1']).join(', ')})
                      </span>
                      <span aria-hidden="true" className="text-slate-600">·</span>
                      <span className="text-slate-300">Max {league.rosterMaxCap || 11}/Team</span>
                      {league.division === 'Co-Ed' && (
                        <>
                          <span aria-hidden="true" className="text-slate-600">·</span>
                          <span className="text-amber-300">
                            {league.coedMaleCap}M/{league.coedFemaleCap}F Split
                            {league.autoFlipEnabled ? ' (Auto-Flips 4M/7F)' : ''}
                          </span>
                        </>
                      )}
                    </div>

                    <div className="rounded-xl border border-amber-400/25 bg-amber-400/5 px-4 py-3">
                      <div className="text-[11px] font-medium text-amber-300/90">
                        Championship Cash Prize
                      </div>
                      <div className="font-display text-xl font-bold text-amber-300 mt-0.5">
                        {prizeInfo.headlinePrize}
                      </div>
                      {prizeInfo.scalingSubtext && (
                        <div className="mt-1 text-xs font-mono-num text-slate-300">
                          Scaling: {prizeInfo.scalingSubtext}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-3 pt-1">
                      <div>
                        <div className="text-[11px] text-slate-400">Team Fee</div>
                        <div className="font-mono-num text-base font-bold text-white">
                          ${league.entryFeeTeam}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-400">Free Agent</div>
                        <div className="font-mono-num text-base font-bold text-slate-200">
                          ${league.entryFeeSolo}
                        </div>
                        <div className="text-[10px] text-amber-300/90">
                          ${league.entryFeeSolo * 2} w/ Friend
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-400">Squads Filled</div>
                        <div className="font-mono-num text-base font-bold text-emerald-400">
                          {registeredTeams} / {league.maxTeams}
                        </div>
                      </div>
                    </div>

                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all"
                        style={{ width: `${fillPercent}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-white/10">
                    <button
                      type="button"
                      onClick={() => onRegisterLeague(league.id, 'team')}
                      style={{ backgroundColor: db.brand.primaryColor }}
                      className="flex-1 min-h-[42px] rounded-lg px-4 py-2 text-xs font-semibold text-slate-950 hover:opacity-90 cursor-pointer whitespace-nowrap"
                    >
                      Register Team / Solo
                    </button>
                    <button
                      type="button"
                      onClick={() => onRegisterLeague(league.id, 'waitlist')}
                      className="min-h-[42px] rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs font-semibold text-amber-300 hover:bg-amber-400/20 cursor-pointer whitespace-nowrap"
                    >
                      Waitlist
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenHub(league.id)}
                      className="min-h-[42px] rounded-lg border border-white/15 px-3.5 py-2 text-xs font-medium text-white hover:bg-white/5 cursor-pointer whitespace-nowrap"
                    >
                      Hub
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
        )}
      </section>

      {/* Sponsors & Partners Showcase + Become a Partner Form */}
      <section id="partnerships" className="mx-auto max-w-7xl px-4 sm:px-6 space-y-6 scroll-mt-24">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <h2 className="font-display text-3xl font-bold text-white tracking-tight">
              Venue Partners & Local Sponsors
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Local venues and community partners help make every season possible.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setShowPartnerForm((p) => !p);
              setPartnerSubmitted(false);
            }}
            className="min-h-[42px] inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-white hover:bg-white/10 cursor-pointer self-start sm:self-auto"
          >
            <Handshake className="h-4 w-4 text-emerald-400" />
            <span>Become a Partner / Sponsor</span>
          </button>
        </div>

        {showPartnerForm && (
          <form
            onSubmit={handlePartnerSubmit}
            className="rounded-2xl border border-emerald-500/30 bg-[#111821] p-6 space-y-4"
          >
            <div className="text-base font-bold text-white">
              Partner & Sponsor Inquiry Form
            </div>
            {partnerSubmitted ? (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-emerald-300">
                Inquiry received! Our COO & League Admin can review and approve your sponsor card in the Admin Dashboard.
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <input
                    type="text"
                    required
                    placeholder="Business / Venue Name"
                    value={partnerName}
                    onChange={(e) => setPartnerName(e.target.value)}
                    className="rounded-lg border border-white/15 bg-[#090D12] px-3 py-2 text-xs text-white"
                  />
                  <select
                    value={partnerCategory}
                    onChange={(e) => setPartnerCategory(e.target.value as Partner['category'])}
                    className="rounded-lg border border-white/15 bg-[#090D12] px-3 py-2 text-xs text-white"
                  >
                    <option value="Local Sponsor">Local Sponsor</option>
                    <option value="Turf Venue">Turf Venue</option>
                    <option value="Equipment & Apparel">Equipment & Apparel</option>
                    <option value="Media Partner">Media Partner</option>
                  </select>
                  <input
                    type="email"
                    required
                    placeholder="Contact Email"
                    value={partnerEmail}
                    onChange={(e) => setPartnerEmail(e.target.value)}
                    className="rounded-lg border border-white/15 bg-[#090D12] px-3 py-2 text-xs text-white"
                  />
                  <input
                    type="url"
                    placeholder="Website / Promo Link"
                    value={partnerUrl}
                    onChange={(e) => setPartnerUrl(e.target.value)}
                    className="rounded-lg border border-white/15 bg-[#090D12] px-3 py-2 text-xs text-white"
                  />
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    required
                    placeholder="Player perk or partnership description (e.g. 15% off recovery massages for league players)"
                    value={partnerTagline}
                    onChange={(e) => setPartnerTagline(e.target.value)}
                    className="flex-1 rounded-lg border border-white/15 bg-[#090D12] px-3 py-2 text-xs text-white"
                  />
                  <button
                    type="submit"
                    className="min-h-[40px] rounded-lg bg-emerald-500 px-5 py-2 text-xs font-semibold text-slate-950 cursor-pointer whitespace-nowrap"
                  >
                    Submit Partner Inquiry
                  </button>
                </div>
              </>
            )}
          </form>
        )}

        {approvedPartners.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-[#111821] p-6 text-center text-xs text-slate-400">
            No approved partners yet — apply via the Partner Inquiry button above or add partners in Admin.
          </div>
        ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {approvedPartners.map((pt) => (
            <div
              key={pt.id}
              className="rounded-2xl border border-white/10 bg-[#111821] p-5 flex flex-col justify-between gap-3"
            >
              <div>
                <div className="text-[11px] font-semibold text-emerald-400">{pt.category}</div>
                <div className="font-display text-xl font-bold text-white mt-0.5">{pt.name}</div>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">{pt.tagline}</p>
              </div>
              <a
                href={pt.promoUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-amber-300 hover:text-amber-200 pt-2 border-t border-white/5"
              >
                <span>Visit Partner</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          ))}
        </div>
        )}
      </section>
    </div>
  );
};
