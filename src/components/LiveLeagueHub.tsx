import React, { useEffect, useMemo, useState } from 'react';
import {
  Trophy,
  Calendar,
  Award,
  GitBranch,
  ArrowLeftRight,
  Sparkles,
  Users,
  UserPlus,
  Link2,
  Shield,
} from 'lucide-react';
import type { LeagueDatabase } from '../types.ts';
import {
  calculateSeasonDurationLabel,
  computeDynamicPrizeDisplay,
  computeMatchClockBreakdown,
  computeSquadChemistry,
  computeStandings,
  computeTeamOfTheWeek,
  getEffectiveTeamCaps,
  MATCH_OF_NIGHT_HYPE_THRESHOLD,
} from '../utils/leagueHelpers.ts';

interface LiveLeagueHubProps {
  db: LeagueDatabase;
  selectedLeagueId: string;
  onSelectLeague: (id: string) => void;
  onOpenMarket: () => void;
  onOpenAdmin?: () => void;
  onOpenClubhouse: (teamId: string, playerId?: string) => void;
  onOpenRegister: (
    leagueId: string,
    mode?: 'team' | 'split' | 'solo' | 'waitlist',
    splitCode?: string
  ) => void;
  onDatabaseUpdate?: (db: LeagueDatabase) => void;
}

type HubSection = 'standings' | 'teams' | 'schedule' | 'awards' | 'bracket' | 'ticker';

function formatMoney(amount: number): string {
  const rounded = Math.round(amount * 100) / 100;
  return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(2);
}

export const LiveLeagueHub: React.FC<LiveLeagueHubProps> = ({
  db,
  selectedLeagueId,
  onSelectLeague,
  onOpenMarket,
  onOpenAdmin,
  onOpenClubhouse,
  onOpenRegister,
  onDatabaseUpdate,
}) => {
  const [section, setSection] = useState<HubSection>('standings');
  const [scheduleFilter, setScheduleFilter] = useState<'all' | 'Scheduled' | 'Final'>('all');
  const [scheduleView, setScheduleView] = useState<'league' | 'team'>('league');
  const [scheduleTeamId, setScheduleTeamId] = useState('');
  const [hypeFeedback, setHypeFeedback] = useState('');
  const [hypeByMatch, setHypeByMatch] = useState<
    Record<string, { hypeCount: number; matchOfNight: boolean }>
  >({});
  const [quickJoinCode, setQuickJoinCode] = useState('');
  const [faInviterId, setFaInviterId] = useState('');
  const [faFriendName, setFaFriendName] = useState('');
  const [faFriendEmail, setFaFriendEmail] = useState('');
  const [faFriendGender, setFaFriendGender] = useState<'Male' | 'Female'>('Male');
  const [faFriendPos, setFaFriendPos] = useState<'GK' | 'DEF' | 'MID' | 'FWD'>('MID');
  const [faFeedback, setFaFeedback] = useState('');

  const league = db.leagues.find((l) => l.id === selectedLeagueId) || db.leagues[0];
  const leagueTeams = useMemo(
    () => (league ? db.teams.filter((team) => team.leagueId === league.id) : []),
    [league, db.teams]
  );
  const currentScheduleTeamId = scheduleTeamId || leagueTeams[0]?.id || '';

  const standings = useMemo(
    () => (league ? computeStandings(league.id, db.teams, db.matches) : []),
    [league, db.teams, db.matches]
  );
  const chemistryByTeam = useMemo(() => {
    if (!league) return new Map<string, ReturnType<typeof computeSquadChemistry>>();
    return new Map(
      standings.map((row) => [
        row.teamId,
        computeSquadChemistry(league.id, row.teamId, db.teams, db.players, db.matches),
      ])
    );
  }, [league, standings, db.teams, db.players, db.matches]);

  const leagueMatches = useMemo(() => {
    if (!league) return [];
    return db.matches
      .filter((m) => m.leagueId === league.id && (m.stage === 'Regular' || m.stage === 'Group'))
      .filter((m) => scheduleFilter === 'all' || m.status === scheduleFilter)
      .filter(
        (m) =>
          scheduleView === 'league' ||
          m.homeTeamId === currentScheduleTeamId ||
          m.awayTeamId === currentScheduleTeamId
      )
      .sort((a, b) => b.week - a.week);
  }, [league, db.matches, scheduleFilter, scheduleView, currentScheduleTeamId]);

  useEffect(() => {
    if (!league || section !== 'schedule') return;
    let active = true;
    const refreshHype = async () => {
      try {
        const response = await fetch(`/api/leagues/${league.id}/match-hype`);
        if (!response.ok) throw new Error('Could not refresh match hype.');
        const data = (await response.json()) as Array<{
          id: string;
          hypeCount: number;
          matchOfNight: boolean;
        }>;
        if (active) {
          setHypeByMatch(
            Object.fromEntries(
              data.map((match) => [
                match.id,
                { hypeCount: match.hypeCount, matchOfNight: match.matchOfNight },
              ])
            )
          );
        }
      } catch {
        if (active) setHypeFeedback('Live hype updates are temporarily unavailable.');
      }
    };
    void refreshHype();
    const timer = window.setInterval(() => void refreshHype(), 10000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [league, section]);

  const bracketMatches = useMemo(() => {
    if (!league) return [];
    return db.matches.filter(
      (m) => m.leagueId === league.id && m.stage !== 'Regular' && m.stage !== 'Group'
    );
  }, [league, db.matches]);

  const leagueDeals = useMemo(() => {
    if (!league) return [];
    return db.doneDeals.filter((d) => d.leagueId === league.id);
  }, [league, db.doneDeals]);

  const teamOfTheWeek = useMemo(() => {
    if (!league) return [];
    return computeTeamOfTheWeek(league.id, db.players, db.teams);
  }, [league, db.players, db.teams]);

  if (!league) {
    return (
      <div className="mx-auto max-w-4xl px-4 sm:px-6 py-16 pb-24">
        <div className="rounded-2xl border border-white/10 bg-[#111821] p-8 sm:p-10 text-center space-y-4">
          <Trophy className="h-10 w-10 text-amber-400 mx-auto" />
          <h1 className="font-display text-3xl font-bold text-white">
            No Active Leagues Running Yet
          </h1>
          <p className="text-sm text-slate-400 max-w-lg mx-auto">
            Live standings, team and league schedules, Team of the Week cards, and knockout brackets appear automatically when the first league is launched.
          </p>
          {onOpenAdmin && (
            <button
              type="button"
              onClick={onOpenAdmin}
              className="min-h-[42px] rounded-lg bg-emerald-500 px-5 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 cursor-pointer"
            >
              Launch First League in Admin (PIN: {db.brand.adminPin})
            </button>
          )}
        </div>
      </div>
    );
  }

  const teamCount = db.teams.filter((t) => t.leagueId === league.id).length;
  const prizeInfo = computeDynamicPrizeDisplay(league, teamCount);
  const transferOpen =
    !league.rosterLocked && !league.isPlayoffsActive && league.currentWeek <= league.transferDeadlineWeek;
  const isTestingPreview = league.status === 'TESTING' || standings.every((s) => s.gp === 0);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 pb-24 space-y-6">
      {/* Top League Switcher */}
      <div className="rounded-2xl border border-white/10 bg-[#111821] p-5 sm:p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-emerald-400">
              <span>Live League & Tournament Hub</span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span className="text-amber-300 font-semibold">{league.status}</span>
            </div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-white mt-0.5">
              {league.name}
            </h1>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400 mt-1.5">
              <span>{league.locationName}</span>
              <span aria-hidden="true">·</span>
              <span>
                Fields:{' '}
                {(db.venues.find((v) => v.id === league.venueId)?.fields || ['Turf 1']).join(', ')}
              </span>
              <span aria-hidden="true">·</span>
              <span>25m / 5m HT / 25m (55m)</span>
              <span aria-hidden="true">·</span>
              <span>{calculateSeasonDurationLabel(league.gameWeeks, league.gamesPerWeek, league.leagueType)}</span>
              <span aria-hidden="true">·</span>
              <span className={transferOpen ? 'text-emerald-400 font-medium' : 'text-amber-400 font-medium'}>
                {transferOpen
                  ? `Transfer Window Open (Deadline Week ${league.transferDeadlineWeek})`
                  : 'Transfer Window Locked'}
              </span>
              <span aria-hidden="true">·</span>
              <span>Anti-Ringer: Min {league.playoffMinGames} GP</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <select
              aria-label="Select League"
              value={league.id}
              onChange={(e) => onSelectLeague(e.target.value)}
              className="min-h-[42px] rounded-lg border border-white/15 bg-[#090D12] px-3 py-2 text-sm font-medium text-white"
            >
              {db.leagues.map((l) => (
                <option key={l.id} value={l.id}>
                  [{l.status}] {l.name} ({l.format})
                </option>
              ))}
            </select>
            <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-3.5 py-2">
              <div className="text-[10px] font-medium text-amber-300">Cash Pot</div>
              <div className="font-display text-base font-bold text-amber-300 whitespace-nowrap">
                {prizeInfo.headlinePrize}
              </div>
            </div>
          </div>
        </div>

        {/* Player Hub Quick Team-Formation Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-emerald-500/20 bg-[#090D12] px-4 py-3">
          <div className="text-xs text-slate-300">
            <span className="font-semibold text-white">Player-Managed Teams:</span>{' '}
            Register as a Team (${league.entryFeeTeam} split evenly across players) or Free Agent (${league.entryFeeSolo} self / ${league.entryFeeSolo * 2} w/ friend).
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onOpenRegister(league.id, 'team')}
              className="min-h-[36px] inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3.5 py-1.5 text-xs font-bold text-slate-950 hover:bg-emerald-400 cursor-pointer"
            >
              <Users className="h-3.5 w-3.5" />
              <span>Create Team (${league.entryFeeTeam})</span>
            </button>
            <button
              type="button"
              onClick={() => setSection('teams')}
              className="min-h-[36px] inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-[#111821] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-white/5 cursor-pointer"
            >
              <Link2 className="h-3.5 w-3.5 text-emerald-400" />
              <span>Join / Manage Teams ({teamCount})</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenRegister(league.id, 'solo')}
              className="min-h-[36px] inline-flex items-center gap-1.5 rounded-lg border border-amber-400/35 bg-amber-400/10 px-3.5 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-400/20 cursor-pointer"
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span>Free Agent (${league.entryFeeSolo})</span>
            </button>
          </div>
        </div>

        {/* Sub-Navigation */}
        <div className="flex items-center gap-2 overflow-x-auto pt-2 border-t border-white/10">
          {[
            { id: 'standings' as const, label: 'Standings', icon: <Trophy className="h-4 w-4" /> },
            { id: 'teams' as const, label: `Teams & Formation (${teamCount})`, icon: <Users className="h-4 w-4" /> },
            { id: 'schedule' as const, label: 'Schedule & Scores', icon: <Calendar className="h-4 w-4" /> },
            { id: 'awards' as const, label: 'Team of the Week', icon: <Award className="h-4 w-4" /> },
            { id: 'bracket' as const, label: 'Playoff Bracket', icon: <GitBranch className="h-4 w-4" /> },
            { id: 'ticker' as const, label: 'Transfer Ticker', icon: <ArrowLeftRight className="h-4 w-4" /> },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSection(tab.id)}
              className={`min-h-[40px] inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                section === tab.id
                  ? 'bg-emerald-500 text-slate-950'
                  : 'bg-[#090D12] text-slate-300 hover:text-white border border-white/10'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Pre-Season 0-0-0 Testing Preview Callout */}
      {isTestingPreview && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <span className="text-amber-200 font-medium">
            PRE-SEASON TESTING PREVIEW: Play has not kicked off yet — standings show registered squads at 0 GP · 0 W · 0 D · 0 L · 0 PTS ({league.startDate}).
          </span>
          <span className="font-mono-num text-amber-300 font-bold shrink-0">
            Status: {league.status}
          </span>
        </div>
      )}

      {/* Section Content */}
      {section === 'standings' && (
        <div className="rounded-2xl border border-white/10 bg-[#111821] overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-5 py-4 border-b border-white/10">
            <div>
              <h2 className="font-display text-xl font-bold text-white">League Standings</h2>
              <p className="text-xs text-slate-400">
                Top 4 qualify for Cash-Prize Playoffs. Ranks 8th–10th unlock the Struggling Team Lifeline. Squad Chemistry rewards shared matches, returning teammates, strong form, and league position.
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenMarket}
              className="min-h-[38px] rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-400/20 cursor-pointer self-start sm:self-auto"
            >
              Open Transfer & Sub Market
            </button>
          </div>

          {standings.length === 0 ? (
            <div className="p-8 sm:p-10 text-center space-y-4">
              <Users className="h-9 w-9 text-emerald-400 mx-auto" />
              <div className="space-y-1">
                <h3 className="font-display text-xl font-bold text-white">
                  No Teams Formed in {league.name} Yet
                </h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Players form, join, and manage teams directly here in the Hub. Start a squad as Captain, join via a teammate&apos;s split-pay code, or sign up as a Solo Free Agent.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2.5">
                <button
                  type="button"
                  onClick={() => onOpenRegister(league.id, 'team')}
                  className="min-h-[40px] rounded-lg bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400 cursor-pointer"
                >
                  Create a Team (${league.entryFeeTeam})
                </button>
                <button
                  type="button"
                  onClick={() => onOpenRegister(league.id, 'split')}
                  className="min-h-[40px] rounded-lg border border-white/15 bg-[#090D12] px-4 py-2 text-xs font-semibold text-white hover:bg-white/5 cursor-pointer"
                >
                  Join Team by Code
                </button>
                <button
                  type="button"
                  onClick={() => onOpenRegister(league.id, 'solo')}
                  className="min-h-[40px] rounded-lg border border-amber-400/35 bg-amber-400/10 px-4 py-2 text-xs font-semibold text-amber-300 hover:bg-amber-400/20 cursor-pointer"
                >
                  Solo Free Agent (${league.entryFeeSolo})
                </button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 bg-[#090D12] text-[11px] font-semibold text-slate-400">
                    <th className="py-3 px-4">#</th>
                    <th className="py-3 px-4">Team</th>
                    <th className="py-3 px-3 text-right">GP</th>
                    <th className="py-3 px-3 text-right">W</th>
                    <th className="py-3 px-3 text-right">D</th>
                    <th className="py-3 px-3 text-right">L</th>
                    <th className="py-3 px-3 text-right">GF</th>
                    <th className="py-3 px-3 text-right">GA</th>
                    <th className="py-3 px-3 text-right">GD</th>
                    <th className="py-3 px-4 text-right">PTS</th>
                    <th className="py-3 px-4">Zone &amp; Hub</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-sm">
                  {standings.map((row) => {
                    const chemistry = chemistryByTeam.get(row.teamId);
                    return (
                    <tr key={row.teamId} className="hover:bg-white/[0.03] transition-colors">
                      <td className="py-3 px-4 font-mono-num text-xs font-bold text-slate-400">
                        <span className="inline-flex items-center gap-1">
                          {row.rank}
                          {league.status === 'COMPLETED' && row.rank <= 3 && (
                            <Trophy
                              className={`h-3.5 w-3.5 ${
                                row.rank === 1 ? 'text-amber-300' : row.rank === 2 ? 'text-slate-300' : 'text-orange-400'
                              }`}
                              aria-label={`${row.rank === 1 ? 'Gold' : row.rank === 2 ? 'Silver' : 'Bronze'} trophy`}
                            />
                          )}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium text-white whitespace-nowrap">
                        <div className="space-y-1.5">
                          <button
                            type="button"
                            onClick={() => onOpenClubhouse(row.teamId)}
                            className="inline-flex items-center gap-2.5 hover:text-emerald-400 cursor-pointer"
                          >
                            <span
                              className="h-2.5 w-2.5 rounded-sm shrink-0"
                              style={{ backgroundColor: row.kitColor }}
                            />
                            <span>{row.teamName}</span>
                          </button>
                          <div
                            className="flex items-center gap-2"
                            title="Chemistry blends current-roster match continuity, returning teammates from prior seasons, unbeaten and defensive form, and league position."
                          >
                            <span className="text-[10px] font-medium text-slate-400">
                              Chemistry {chemistry?.percentage ?? 20}%
                            </span>
                            <span
                              role="progressbar"
                              aria-label={`${row.teamName} squad chemistry`}
                              aria-valuemin={0}
                              aria-valuemax={100}
                              aria-valuenow={chemistry?.percentage ?? 20}
                              className="h-1.5 w-16 overflow-hidden rounded-full bg-white/10"
                            >
                              <span
                                className="block h-full rounded-full bg-emerald-400"
                                style={{ width: `${chemistry?.percentage ?? 20}%` }}
                              />
                            </span>
                            {chemistry?.coreDynasty && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-300">
                                <Shield className="h-3 w-3" />
                                Core Dynasty
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right font-mono-num text-slate-300">{row.gp}</td>
                      <td className="py-3 px-3 text-right font-mono-num text-slate-300">{row.w}</td>
                      <td className="py-3 px-3 text-right font-mono-num text-slate-300">{row.d}</td>
                      <td className="py-3 px-3 text-right font-mono-num text-slate-300">{row.l}</td>
                      <td className="py-3 px-3 text-right font-mono-num text-slate-300">{row.gf}</td>
                      <td className="py-3 px-3 text-right font-mono-num text-slate-300">{row.ga}</td>
                      <td
                        className={`py-3 px-3 text-right font-mono-num font-medium ${
                          row.gd > 0
                            ? 'text-emerald-400'
                            : row.gd < 0
                            ? 'text-rose-400'
                            : 'text-slate-400'
                        }`}
                      >
                        {row.gd > 0 ? `+${row.gd}` : row.gd}
                      </td>
                      <td className="py-3 px-4 text-right font-mono-num font-bold text-white">
                        {row.pts}
                      </td>
                      <td className="py-3 px-4 text-xs whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          {isTestingPreview ? (
                            <span className="text-amber-300">Pre-Season Preview</span>
                          ) : row.isPlayoffSpot ? (
                            <span className="font-medium text-emerald-400">Playoff Seed</span>
                          ) : row.isStrugglingLifeline ? (
                            <span className="font-medium text-amber-400">8th–10th Lifeline</span>
                          ) : (
                            <span className="text-slate-500">Mid-Table</span>
                          )}
                          <button
                            type="button"
                            onClick={() => onOpenClubhouse(row.teamId)}
                            className="rounded border border-white/15 px-2 py-0.5 text-[11px] font-semibold text-slate-200 hover:border-emerald-500/40 hover:text-emerald-300 cursor-pointer"
                          >
                            Manage
                          </button>
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {section === 'teams' && (
        <div className="space-y-6">
          {/* 3 Self-Service Player Formation Options */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-emerald-500/30 bg-[#111821] p-5 flex flex-col justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
                  <Users className="h-4 w-4" />
                  <span>Captain a New Squad</span>
                </div>
                <h2 className="font-display text-xl font-bold text-white">Create a Team</h2>
                <p className="text-xs text-slate-400">
                  Total team cost in {league.name} is ${league.entryFeeTeam}, divided evenly across the players on your team (no deposits). Unlock your Clubhouse, QR Recruit Poster, and Lineup Tactics Board.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onOpenRegister(league.id, 'team')}
                className="min-h-[40px] w-full rounded-lg bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400 cursor-pointer"
              >
                Create &amp; Captain Team (${league.entryFeeTeam} Split)
              </button>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#111821] p-5 flex flex-col justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-semibold text-amber-300">
                  <Link2 className="h-4 w-4" />
                  <span>Join Teammates Online</span>
                </div>
                <h2 className="font-display text-xl font-bold text-white">Join via Split-Pay Code</h2>
                <p className="text-xs text-slate-400">
                  Enter a captain&apos;s team code below to pay your even share of the ${league.entryFeeTeam} team cost (or $0 if already paid in full).
                </p>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Team Code (e.g. ABCD12)"
                  value={quickJoinCode}
                  onChange={(e) => setQuickJoinCode(e.target.value.toUpperCase())}
                  className="flex-1 min-w-0 rounded-lg border border-white/15 bg-[#090D12] px-3 py-2 text-xs font-mono text-white"
                />
                <button
                  type="button"
                  onClick={() => onOpenRegister(league.id, 'split', quickJoinCode)}
                  className="min-h-[40px] rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3.5 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25 shrink-0 cursor-pointer"
                >
                  Join Code
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#111821] p-5 flex flex-col justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
                  <UserPlus className="h-4 w-4" />
                  <span>Individual + Friend Entry</span>
                </div>
                <h2 className="font-display text-xl font-bold text-white">Free Agent</h2>
                <p className="text-xs text-slate-400">
                  Register yourself for ${league.entryFeeSolo}. Invite a friend and if they accept, you pay ${league.entryFeeSolo} + ${league.entryFeeSolo} = ${league.entryFeeSolo * 2} total for both.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onOpenRegister(league.id, 'solo')}
                className="min-h-[40px] w-full rounded-lg border border-amber-400/35 bg-amber-400/10 px-4 py-2 text-xs font-semibold text-amber-300 hover:bg-amber-400/20 cursor-pointer"
              >
                Register as Free Agent (${league.entryFeeSolo})
              </button>
            </div>
          </div>

          {/* Registered Teams Roster & Direct Hub Controls */}
          <div className="rounded-2xl border border-white/10 bg-[#111821] overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-5 py-4 border-b border-white/10">
              <div>
                <h3 className="font-display text-xl font-bold text-white">
                  Player-Formed Teams in {league.name} ({teamCount}/{league.maxTeams})
                </h3>
                <p className="text-xs text-slate-400">
                  Join an open squad or open Team Clubhouse to manage kits, QR recruit posters, invites, lineups, and matchday RSVPs.
                </p>
              </div>
            </div>

            {teamCount === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No teams formed yet in {league.name}. Use &quot;Create &amp; Captain Team&quot; or &quot;Register as Solo Free Agent&quot; above — teams are created and managed exclusively by players.
              </div>
            ) : (
              <div className="divide-y divide-white/10">
                {db.teams
                  .filter((t) => t.leagueId === league.id)
                  .map((tm) => {
                    const teamPlayers = db.players.filter((p) => p.teamId === tm.id);
                    const caps = getEffectiveTeamCaps(tm, league);
                    const maleCnt = teamPlayers.filter((p) => (p.gender || 'Male') === 'Male').length;
                    const femaleCnt = teamPlayers.filter((p) => p.gender === 'Female').length;
                    const balanceDue = Math.max(0, tm.totalFee - tm.amountPaid);
                    const perSplit = formatMoney(tm.totalFee / Math.max(1, tm.splitTargetPlayers));
                    const perCurrentRoster = formatMoney(tm.totalFee / Math.max(1, teamPlayers.length || 1));
                    const isFull = teamPlayers.length >= caps.rosterCap;
                    return (
                      <div
                        key={tm.id}
                        className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-white/[0.02]"
                      >
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2.5">
                            <span
                              className="h-3 w-3 rounded-sm shrink-0"
                              style={{ backgroundColor: tm.kitColor }}
                            />
                            <span className="font-display text-lg font-bold text-white">
                              {tm.name}
                            </span>
                            <span className="font-mono text-xs text-amber-300">
                              Code: {tm.splitPayCode}
                            </span>
                            <span
                              className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                                (tm.registrationStatus === 'Complete' || balanceDue === 0)
                                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                  : 'bg-amber-400/15 text-amber-300 border border-amber-400/30'
                              }`}
                            >
                              {tm.registrationStatus === 'Complete' || balanceDue === 0
                                ? 'Registration Complete'
                                : 'Pending Payment'}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-400">
                            <span>Captain: {tm.captainName}</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono-num text-slate-200">
                              Roster: {teamPlayers.length}/{caps.rosterCap}
                            </span>
                            {league.division === 'Co-Ed' && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="font-mono-num text-amber-300">
                                  {maleCnt}/{caps.maleCap}M · {femaleCnt}/{caps.femaleCap}F
                                </span>
                              </>
                            )}
                            <span aria-hidden="true">·</span>
                            <span className={balanceDue === 0 ? 'text-emerald-400 font-medium' : 'text-slate-300'}>
                              {balanceDue === 0
                                ? '$0 Free Join (Paid in Full)'
                                : `$${tm.totalFee} ÷ ${tm.splitTargetPlayers} = $${perSplit}/ea (Live ${teamPlayers.length}p = $${perCurrentRoster}/ea)`}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => onOpenRegister(league.id, 'split', tm.splitPayCode)}
                            className="min-h-[38px] rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3.5 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 cursor-pointer"
                          >
                            {isFull ? 'Join Standby Waitlist' : balanceDue === 0 ? 'Join Squad ($0)' : `Join Squad ($${perSplit})`}
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpenClubhouse(tm.id, tm.captainId)}
                            className="min-h-[38px] inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3.5 py-1.5 text-xs font-bold text-slate-950 hover:bg-emerald-400 cursor-pointer"
                          >
                            <Shield className="h-3.5 w-3.5" />
                            <span>Manage Team (Clubhouse)</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          {/* Free Agent Friend Invites (Pay for Both) */}
          {(() => {
            const leagueFreeAgents = db.players.filter(
              (p) => p.leagueId === league.id && p.isFreeAgent && !p.paidByPlayerId
            );
            const leagueFaInvites = (db.freeAgentInvites || []).filter((i) => i.leagueId === league.id);
            const activeInviterId = faInviterId || leagueFreeAgents[0]?.id || '';
            return (
              <div className="rounded-2xl border border-amber-400/25 bg-[#111821] p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="font-display text-xl font-bold text-white">
                      Free Agent Friend Invites (Pay for Both)
                    </h3>
                    <p className="text-xs text-slate-400">
                      Registered Free Agents pay ${league.entryFeeSolo} for themselves. Invite a friend — when they accept, you pay +${league.entryFeeSolo} for your friend (${league.entryFeeSolo * 2} total paid by you for both).
                    </p>
                  </div>
                </div>

                {faFeedback && (
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
                    {faFeedback}
                  </div>
                )}

                {leagueFreeAgents.length === 0 ? (
                  <p className="text-xs text-slate-400">
                    No Free Agents registered in {league.name} yet. Click &quot;Register as Free Agent (${league.entryFeeSolo})&quot; above to sign up and invite a friend.
                  </p>
                ) : (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!activeInviterId) return;
                      const res = await fetch(`/api/free-agents/${activeInviterId}/invite-friend`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          friendName: faFriendName,
                          friendEmail: faFriendEmail,
                          friendGender: faFriendGender,
                          friendPosition: faFriendPos,
                        }),
                      });
                      const data = await res.json();
                      if (res.ok) {
                        onDatabaseUpdate?.(data.db);
                        setFaFriendName('');
                        setFaFriendEmail('');
                        setFaFeedback(
                          `Friend invite sent to ${data.invite.friendName} (When accepted, inviter total becomes $${data.invite.totalIfAccepted}).`
                        );
                      } else {
                        setFaFeedback(data.error || 'Could not send friend invite');
                      }
                    }}
                    className="grid grid-cols-1 sm:grid-cols-6 gap-2 rounded-xl border border-white/10 bg-[#090D12] p-3 text-xs"
                  >
                    <select
                      value={activeInviterId}
                      onChange={(e) => setFaInviterId(e.target.value)}
                      className="rounded-lg border border-white/15 bg-[#111821] px-2.5 py-2 text-white"
                    >
                      {leagueFreeAgents.map((fa) => (
                        <option key={fa.id} value={fa.id}>
                          {fa.name} (${fa.registrationPaidAmount ?? league.entryFeeSolo} paid)
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      required
                      placeholder="Friend Full Name"
                      value={faFriendName}
                      onChange={(e) => setFaFriendName(e.target.value)}
                      className="rounded-lg border border-white/15 bg-[#111821] px-2.5 py-2 text-white"
                    />
                    <input
                      type="email"
                      placeholder="Friend Email (opt)"
                      value={faFriendEmail}
                      onChange={(e) => setFaFriendEmail(e.target.value)}
                      className="rounded-lg border border-white/15 bg-[#111821] px-2.5 py-2 text-white"
                    />
                    <select
                      value={faFriendGender}
                      onChange={(e) => setFaFriendGender(e.target.value as 'Male' | 'Female')}
                      className="rounded-lg border border-white/15 bg-[#111821] px-2.5 py-2 text-white"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                    <select
                      value={faFriendPos}
                      onChange={(e) => setFaFriendPos(e.target.value as 'GK' | 'DEF' | 'MID' | 'FWD')}
                      className="rounded-lg border border-white/15 bg-[#111821] px-2.5 py-2 text-white"
                    >
                      {(['GK', 'DEF', 'MID', 'FWD'] as const).map((pos) => (
                        <option key={pos} value={pos}>{pos}</option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      className="rounded-lg bg-amber-400 px-3 py-2 font-bold text-slate-950 hover:bg-amber-300 cursor-pointer"
                    >
                      Invite (+${league.entryFeeSolo})
                    </button>
                  </form>
                )}

                {leagueFaInvites.length > 0 && (
                  <div className="divide-y divide-white/10 rounded-xl border border-white/10 bg-[#090D12]">
                    {leagueFaInvites.map((inv) => (
                      <div
                        key={inv.id}
                        className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                      >
                        <div>
                          <span className="font-semibold text-white">{inv.inviterName}</span> invited{' '}
                          <span className="font-semibold text-amber-300">{inv.friendName}</span>{' '}
                          <span className="text-slate-400">
                            ({inv.friendGender} · {inv.friendPosition})
                          </span>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {inv.status === 'Accepted'
                              ? `Accepted — ${inv.inviterName} paid $${inv.selfFee} (self) + $${inv.friendFee} (friend) = $${inv.totalIfAccepted} total for both.`
                              : inv.status === 'Declined'
                              ? `Declined — ${inv.inviterName} pays $${inv.selfFee} only.`
                              : `Pending — if ${inv.friendName} accepts, ${inv.inviterName} pays $${inv.selfFee} + $${inv.friendFee} = $${inv.totalIfAccepted} total.`}
                          </div>
                        </div>
                        {inv.status === 'Pending' ? (
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={async () => {
                                const r = await fetch(`/api/free-agent-invites/${inv.id}/respond`, {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ decision: 'Accepted' }),
                                });
                                const d = await r.json();
                                if (r.ok) {
                                  onDatabaseUpdate?.(d.db);
                                  setFaFeedback(
                                    `${inv.friendName} accepted! ${inv.inviterName} paid $${d.invite.totalIfAccepted} total for both.`
                                  );
                                } else {
                                  setFaFeedback(d.error || 'Could not accept friend invite');
                                }
                              }}
                              className="rounded-lg bg-emerald-500 px-3 py-1.5 font-semibold text-slate-950 cursor-pointer"
                            >
                              Accept (+${inv.friendFee} → ${inv.totalIfAccepted})
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                const r = await fetch(`/api/free-agent-invites/${inv.id}/respond`, {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ decision: 'Declined' }),
                                });
                                const d = await r.json();
                                if (r.ok) {
                                  onDatabaseUpdate?.(d.db);
                                  setFaFeedback(`${inv.friendName} declined; ${inv.inviterName} stays at $${inv.selfFee}.`);
                                }
                              }}
                              className="rounded-lg border border-white/15 px-3 py-1.5 text-slate-300 cursor-pointer"
                            >
                              Decline
                            </button>
                          </div>
                        ) : (
                          <span
                            className={`font-semibold ${
                              inv.status === 'Accepted' ? 'text-emerald-400' : 'text-slate-400'
                            }`}
                          >
                            {inv.status}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {section === 'schedule' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-xl font-bold text-white">
                {scheduleView === 'team' ? 'My Team Schedule' : 'League Schedule & Results'}
              </h2>
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setScheduleView('team')}
                  className={`rounded-md px-3 py-1 text-xs font-semibold ${
                    scheduleView === 'team' ? 'bg-emerald-500 text-slate-950' : 'border border-white/10 text-slate-300'
                  }`}
                >
                  My Team
                </button>
                <button
                  type="button"
                  onClick={() => setScheduleView('league')}
                  className={`rounded-md px-3 py-1 text-xs font-semibold ${
                    scheduleView === 'league' ? 'bg-emerald-500 text-slate-950' : 'border border-white/10 text-slate-300'
                  }`}
                >
                  All Teams
                </button>
                {scheduleView === 'team' && (
                  <select
                    value={currentScheduleTeamId}
                    onChange={(event) => setScheduleTeamId(event.target.value)}
                    className="rounded-md border border-white/10 bg-[#111821] px-2 py-1 text-xs text-white"
                    aria-label="Select team schedule"
                  >
                    {leagueTeams.map((team) => (
                      <option key={team.id} value={team.id}>{team.name}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-[#111821] p-1">
              {(['all', 'Scheduled', 'Final'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setScheduleFilter(st)}
                  className={`min-h-[34px] rounded-md px-3 py-1 text-xs font-medium cursor-pointer ${
                    scheduleFilter === st
                      ? 'bg-emerald-500 text-slate-950 font-semibold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {st === 'all' ? 'All Matches' : st === 'Scheduled' ? 'Upcoming' : 'Final'}
                </button>
              ))}
            </div>
          </div>

          {leagueMatches.some((match) => (hypeByMatch[match.id]?.matchOfNight ?? match.matchOfNight)) && (
            <div className="rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm font-bold text-amber-200">
              Crazy Match Happening Now — the sideline has named this the Match of the Night!
            </div>
          )}
          {hypeFeedback && (
            <div className="text-xs text-amber-300" role="status">{hypeFeedback}</div>
          )}

          {leagueMatches.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-[#111821] p-10 text-center text-sm text-slate-400">
              Kickoff Date TBD — Match schedule will publish once registration closes (or Admin generates preview weeks).
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {leagueMatches.map((m) => {
                const clock = computeMatchClockBreakdown(
                  m.scheduledTime,
                  m.firstHalfMins ?? 25,
                  m.halftimeMins ?? 5,
                  m.secondHalfMins ?? 25
                );
                const hypeCount = hypeByMatch[m.id]?.hypeCount ?? m.hypeCount ?? 0;
                const hypeProgress = Math.min(100, (hypeCount / MATCH_OF_NIGHT_HYPE_THRESHOLD) * 100);
                return (
                  <div
                    key={m.id}
                    className="rounded-xl border border-white/10 bg-[#111821] p-4 flex flex-col justify-between gap-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                      <span className="font-semibold text-emerald-400">
                        Week {m.week} · Assigned Field: {m.fieldNumber}
                      </span>
                      <span className="font-mono-num text-slate-300">
                        {m.scheduledDate} · {clock.kickoff} – {clock.fullTime}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-3 py-1">
                      <div className="flex-1 text-sm font-semibold text-white truncate">
                        {m.homeTeamName}
                      </div>
                      <div className="shrink-0 rounded-lg border border-white/10 bg-[#090D12] px-3 py-1.5 font-mono-num text-sm font-bold text-white">
                        {m.status === 'Final' ? `${m.homeScore} — ${m.awayScore}` : 'vs'}
                      </div>
                      <div className="flex-1 text-right text-sm font-semibold text-white truncate">
                        {m.awayTeamName}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] pt-2 border-t border-white/5">
                      <span
                        className={
                          m.status === 'Final' ? 'text-emerald-400 font-medium' : 'text-amber-400 font-medium'
                        }
                      >
                        {m.status === 'Final' ? 'Final Score Verified' : 'Scheduled Fixture'}
                      </span>
                      <span className="font-mono-num text-slate-400">
                        {clock.timelineLabel}
                      </span>
                    </div>
                    {m.status === 'Scheduled' && (
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-xs text-amber-300">
                          {hypeByMatch[m.id]?.matchOfNight || m.matchOfNight
                            ? '🏆 Match of the Night'
                            : `${hypeCount}/${MATCH_OF_NIGHT_HYPE_THRESHOLD} sideline hype taps`}
                        </div>
                        <div
                          className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10"
                          aria-label={`${hypeCount} of ${MATCH_OF_NIGHT_HYPE_THRESHOLD} hype taps`}
                        >
                          <div
                            className="h-full rounded-full bg-amber-400 transition-[width]"
                            style={{ width: `${hypeProgress}%` }}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            setHypeFeedback('');
                            try {
                              const response = await fetch(`/api/matches/${m.id}/hype`, { method: 'POST' });
                              const data = await response.json();
                              if (!response.ok) throw new Error(data.error || 'Could not send hype.');
                              onDatabaseUpdate?.(data);
                            } catch (error) {
                              setHypeFeedback(error instanceof Error ? error.message : 'Could not send hype.');
                            }
                          }}
                          className="rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-amber-300"
                        >
                          Hype the match!
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {section === 'awards' && (
        <div className="space-y-6">
          {/* Team of the Week Showcase */}
          {teamOfTheWeek.length > 0 && (
            <div className="rounded-2xl border border-amber-400/25 bg-[#111821] p-5 sm:p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-400" />
                  <h2 className="font-display text-xl font-bold text-white">
                    Team of the Week (Top 7 OVR Starting VII)
                  </h2>
                </div>
                <span className="text-xs text-slate-400">
                  Ranked by Goals, Assists, Clean Sheets &amp; MOTM Votes
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                {teamOfTheWeek.map((item) => (
                  <div
                    key={item.player.id}
                    className={`rounded-xl border p-3.5 space-y-1.5 ${
                      item.tier === 'Champion'
                        ? 'border-amber-400/50 bg-amber-400/10'
                        : item.tier === 'Gold'
                        ? 'border-emerald-500/40 bg-emerald-500/5'
                        : 'border-white/10 bg-[#090D12]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono-num text-lg font-extrabold text-amber-300">
                        {item.ovr}
                      </span>
                      <span className="text-[11px] font-bold text-emerald-400">
                        {item.player.position}
                      </span>
                    </div>
                    <div className="text-xs font-bold text-white truncate">{item.player.name}</div>
                    <div className="text-[11px] text-slate-400 truncate">
                      {item.team?.tag || item.team?.name || 'Club'}
                    </div>
                    <div className="pt-1 border-t border-white/10 text-[10px] font-mono-num text-slate-300">
                      {item.player.goals}G · {item.player.assists}A · {item.player.motmAwards ?? 0} MOTM
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}

      {section === 'bracket' && (
        <div className="rounded-2xl border border-white/10 bg-[#111821] p-5 sm:p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div>
              <h2 className="font-display text-2xl font-bold text-white">
                Cash-Prize Knockout Bracket
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Top 4 advance. Minimum {league.playoffMinGames} regular-season games required (Anti-Ringer rule).
              </p>
            </div>
            <div className="text-xs font-semibold text-amber-300">
              Prize Pool: {prizeInfo.headlinePrize}
            </div>
          </div>

          {bracketMatches.length === 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
              <div className="space-y-4">
                <div className="rounded-xl border border-white/10 bg-[#090D12] p-4 space-y-1">
                  <div className="text-xs text-slate-400">Semifinal 1 · Seed #1 vs #4</div>
                  <div className="font-semibold text-white text-sm">
                    {standings[0]?.teamName || 'Seed #1'} vs {standings[3]?.teamName || 'Seed #4'}
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-[#090D12] p-4 space-y-1">
                  <div className="text-xs text-slate-400">Semifinal 2 · Seed #2 vs #3</div>
                  <div className="font-semibold text-white text-sm">
                    {standings[1]?.teamName || 'Seed #2'} vs {standings[2]?.teamName || 'Seed #3'}
                  </div>
                </div>
              </div>
              <div className="hidden md:flex justify-center text-slate-600">→</div>
              <div className="rounded-xl border border-amber-400/30 bg-amber-400/5 p-5 space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-amber-300">
                  <Trophy className="h-4 w-4" />
                  <span>Championship Final</span>
                </div>
                <div className="font-display text-xl font-bold text-white">
                  Winner SF1 vs Winner SF2
                </div>
                <div className="text-xs text-slate-400">{prizeInfo.headlinePrize}</div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
              <div className="space-y-4">
                {bracketMatches
                  .filter((m) => m.stage === 'Semifinal')
                  .map((m) => (
                    <div
                      key={m.id}
                      className="rounded-xl border border-white/10 bg-[#090D12] p-4 space-y-2"
                    >
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>{m.bracketSlot} · {m.fieldNumber}</span>
                        <span>{m.scheduledDate} · {m.scheduledTime}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm font-semibold text-white">
                        <span>{m.homeTeamName}</span>
                        <span className="font-mono-num">
                          {m.status === 'Final' ? m.homeScore : '—'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm font-semibold text-white">
                        <span>{m.awayTeamName}</span>
                        <span className="font-mono-num">
                          {m.status === 'Final' ? m.awayScore : '—'}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
              <div>
                {bracketMatches
                  .filter((m) => m.stage === 'Final')
                  .map((m) => (
                    <div
                      key={m.id}
                      className="rounded-xl border border-amber-400/35 bg-amber-400/5 p-6 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-300">
                          <Trophy className="h-4 w-4" />
                          <span>Championship Final · {m.fieldNumber}</span>
                        </span>
                        <span className="text-xs font-mono-num text-slate-300">
                          {m.scheduledDate} · {m.scheduledTime}
                        </span>
                      </div>
                      <div className="space-y-2 pt-1">
                        <div className="flex items-center justify-between text-base font-bold text-white">
                          <span>{m.homeTeamName}</span>
                          <span className="font-mono-num text-amber-300">
                            {m.status === 'Final' ? m.homeScore : '—'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-base font-bold text-white">
                          <span>{m.awayTeamName}</span>
                          <span className="font-mono-num text-amber-300">
                            {m.status === 'Final' ? m.awayScore : '—'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {section === 'ticker' && (
        <div className="rounded-2xl border border-white/10 bg-[#111821] p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-bold text-white">
              Approved Transfers, 4-Game Loans & Sub Claims
            </h2>
            <button
              type="button"
              onClick={onOpenMarket}
              className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 cursor-pointer"
            >
              Go to Market & Sub Board →
            </button>
          </div>
          {leagueDeals.length === 0 ? (
            <p className="text-sm text-slate-400">No completed deals yet in this division.</p>
          ) : (
            <div className="divide-y divide-white/10">
              {leagueDeals.map((d) => (
                <div key={d.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-white">{d.summary}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{d.details}</div>
                  </div>
                  <div className="text-xs font-mono-num text-slate-500 shrink-0">
                    {new Date(d.timestamp).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
