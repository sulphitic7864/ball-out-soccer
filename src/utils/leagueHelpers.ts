import type {
  ChampionsCupConfig,
  ChampionsCupMatch,
  League,
  LeagueType,
  Match,
  Player,
  StandingRow,
  Team,
  TransferOrLoanRequest,
} from '../types.ts';

export const MARKET_COOLDOWN_HOURS = 72;
export const LIFELINE_COOLDOWN_HOURS = 72;
export const MATCH_OF_NIGHT_HYPE_THRESHOLD = 10;

export function calculateSeasonDurationLabel(
  gameWeeks: number,
  gamesPerWeek: 1 | 2,
  leagueType: LeagueType
): string {
  if (leagueType === 'Tournament') {
    return 'Weekend Knockout Cup · Instant Cash Payout';
  }
  const calendarWeeks = gamesPerWeek === 2 ? gameWeeks / 2 : gameWeeks;
  const approxMonths = (calendarWeeks / 4.33).toFixed(1);
  if (gamesPerWeek === 2) {
    return `${calendarWeeks} Weeks (~${approxMonths} Months) — Fast-Track Double Header (2x/wk)`;
  }
  if (gameWeeks === 15) {
    return '15 Weeks (~3.5 to 4 Months) · 1x/wk';
  }
  return `${calendarWeeks} Weeks (~${approxMonths} Months) · 1x/wk`;
}

export interface MatchClockBreakdown {
  kickoff: string;
  halftimeStart: string;
  secondHalfStart: string;
  fullTime: string;
  firstHalfMins: number;
  halftimeMins: number;
  secondHalfMins: number;
  totalMins: number;
  shortLabel: string;
  timelineLabel: string;
}

function formatMinutesAsClock(totalMins: number, use12Hour: boolean, preferBareHour: boolean): string {
  const minsInDay = ((totalMins % (24 * 60)) + 24 * 60) % (24 * 60);
  const h24 = Math.floor(minsInDay / 60);
  const m = minsInDay % 60;
  const mm = String(m).padStart(2, '0');
  if (!use12Hour) {
    return `${h24}:${mm}`;
  }
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return preferBareHour ? `${h12}:${mm}` : `${h12}:${mm} ${period}`;
}

export function computeMatchClockBreakdown(
  scheduledTime: string,
  firstHalfMins: number = 25,
  halftimeMins: number = 5,
  secondHalfMins: number = 25
): MatchClockBreakdown {
  const totalMins = firstHalfMins + halftimeMins + secondHalfMins;
  const shortLabel = `${firstHalfMins}m / ${halftimeMins}m HT / ${secondHalfMins}m (${totalMins}m)`;
  const trimmed = (scheduledTime || '').trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?/i);

  if (!match) {
    return {
      kickoff: trimmed || 'TBD',
      halftimeStart: `+${firstHalfMins}m`,
      secondHalfStart: `+${firstHalfMins + halftimeMins}m`,
      fullTime: `+${totalMins}m`,
      firstHalfMins,
      halftimeMins,
      secondHalfMins,
      totalMins,
      shortLabel,
      timelineLabel: `${firstHalfMins}m 1st Half · ${halftimeMins}m Halftime · ${secondHalfMins}m 2nd Half (${totalMins}m total)`,
    };
  }

  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = match[3]?.toUpperCase();
  const hadMeridiem = Boolean(meridiem);

  if (meridiem === 'PM' && hour < 12) hour += 12;
  if (meridiem === 'AM' && hour === 12) hour = 0;

  const is24Hour = !hadMeridiem && hour >= 13;
  const preferBare = !hadMeridiem && hour < 13;
  const baseMins = hour * 60 + minute;

  const kickoff = formatMinutesAsClock(baseMins, !is24Hour, preferBare);
  const halftimeStart = formatMinutesAsClock(baseMins + firstHalfMins, !is24Hour, preferBare);
  const secondHalfStart = formatMinutesAsClock(
    baseMins + firstHalfMins + halftimeMins,
    !is24Hour,
    preferBare
  );
  const fullTime = formatMinutesAsClock(baseMins + totalMins, !is24Hour, preferBare);

  return {
    kickoff,
    halftimeStart,
    secondHalfStart,
    fullTime,
    firstHalfMins,
    halftimeMins,
    secondHalfMins,
    totalMins,
    shortLabel,
    timelineLabel: `Kickoff ${kickoff} · HT ${halftimeStart} · 2H ${secondHalfStart} · End ${fullTime}`,
  };
}

export function computeProfitEstimate(params: {
  turfHourlyCost: number;
  hoursPerGameWeek: number;
  gameWeeks: number;
  refCostPerGame: number;
  numTeams: number;
  entryFeeTeam: number;
  plannedCashPrize: number;
}) {
  const {
    turfHourlyCost,
    hoursPerGameWeek,
    gameWeeks,
    refCostPerGame,
    numTeams,
    entryFeeTeam,
    plannedCashPrize,
  } = params;
  const totalGames = Math.floor(numTeams / 2) * gameWeeks;
  const totalFieldCost = turfHourlyCost * hoursPerGameWeek * gameWeeks;
  const totalRefCost = refCostPerGame * totalGames;
  const totalOperatingCost = totalFieldCost + totalRefCost;
  const grossRevenue = numTeams * entryFeeTeam;
  const netProfit = grossRevenue - totalOperatingCost - plannedCashPrize;
  const breakEvenTeams =
    entryFeeTeam > 0 ? Math.ceil((totalOperatingCost + plannedCashPrize) / entryFeeTeam) : 0;
  const safeMaxPrize = Math.max(0, Math.round((grossRevenue - totalOperatingCost) * 0.45));

  return {
    totalGames,
    totalFieldCost,
    totalRefCost,
    totalOperatingCost,
    grossRevenue,
    netProfit,
    breakEvenTeams,
    safeMaxPrize,
  };
}

export function computeStandings(
  leagueId: string,
  teams: Team[],
  matches: Match[]
): StandingRow[] {
  const leagueTeams = teams.filter((t) => t.leagueId === leagueId);
  const leagueMatches = matches.filter(
    (m) => m.leagueId === leagueId && (m.stage === 'Regular' || m.stage === 'Group') && m.status === 'Final'
  );

  const map = new Map<string, Omit<StandingRow, 'rank' | 'isStrugglingLifeline' | 'isPlayoffSpot'>>();

  for (const t of leagueTeams) {
    map.set(t.id, {
      teamId: t.id,
      teamName: t.name,
      kitColor: t.kitColor,
      gp: 0,
      w: 0,
      d: 0,
      l: 0,
      gf: 0,
      ga: 0,
      gd: 0,
      pts: 0,
    });
  }

  for (const m of leagueMatches) {
    if (m.homeScore === null || m.awayScore === null) continue;
    const home = map.get(m.homeTeamId);
    const away = map.get(m.awayTeamId);
    if (!home || !away) continue;

    home.gp += 1;
    away.gp += 1;
    home.gf += m.homeScore;
    away.gf += m.awayScore;
    home.ga += m.awayScore;
    away.ga += m.homeScore;

    if (m.homeScore > m.awayScore) {
      home.w += 1;
      home.pts += 3;
      away.l += 1;
    } else if (m.homeScore < m.awayScore) {
      away.w += 1;
      away.pts += 3;
      home.l += 1;
    } else {
      home.d += 1;
      away.d += 1;
      home.pts += 1;
      away.pts += 1;
    }

    home.gd = home.gf - home.ga;
    away.gd = away.gf - away.ga;
  }

  const sorted = Array.from(map.values()).sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.gd !== a.gd) return b.gd - a.gd;
    if (b.gf !== a.gf) return b.gf - a.gf;
    return a.teamName.localeCompare(b.teamName);
  });

  return sorted.map((row, idx) => {
    const rank = idx + 1;
    return {
      ...row,
      rank,
      isPlayoffSpot: rank <= 4,
      isStrugglingLifeline: rank >= 8 && rank <= 10,
    };
  });
}

export interface SquadChemistryResult {
  percentage: number;
  coreDynasty: boolean;
  coreMatchesPlayedTogether: number;
  returningTeammateMatches: number;
  rankBonus: number;
  formBonus: number;
}

export function computeSquadChemistry(
  leagueId: string,
  teamId: string,
  teams: Team[],
  players: Player[],
  matches: Match[]
): SquadChemistryResult {
  const team = teams.find((entry) => entry.id === teamId && entry.leagueId === leagueId);
  const roster = players.filter((player) => player.teamId === teamId && player.leagueId === leagueId);
  const emptyResult: SquadChemistryResult = {
    percentage: 20,
    coreDynasty: false,
    coreMatchesPlayedTogether: 0,
    returningTeammateMatches: 0,
    rankBonus: 0,
    formBonus: 0,
  };
  if (!team || roster.length === 0) return emptyResult;

  const playerById = new Map(players.map((player) => [player.id, player]));
  const stableKey = (player: Player | undefined): string | null => {
    if (!player) return null;
    const email = player.email?.trim().toLowerCase();
    return email ? `email:${email}` : `player:${player.id}`;
  };
  const rosterKeys = Array.from(new Set(roster.map((player) => stableKey(player)).filter(Boolean))) as string[];
  const rosterKeySet = new Set(rosterKeys);
  const pairKeys: string[] = [];
  for (let i = 0; i < rosterKeys.length; i += 1) {
    for (let j = i + 1; j < rosterKeys.length; j += 1) {
      pairKeys.push(JSON.stringify([rosterKeys[i], rosterKeys[j]].sort()));
    }
  }

  const finalRegularMatches = matches.filter(
    (match) =>
      (match.stage === 'Regular' || match.stage === 'Group') &&
      match.status === 'Final' &&
      match.homeScore !== null &&
      match.awayScore !== null
  );
  const currentMatches = finalRegularMatches.filter(
    (match) =>
      match.leagueId === leagueId &&
      (match.homeTeamId === teamId || match.awayTeamId === teamId)
  );
  const latestJoinedAt = roster.reduce((latest, player) => {
    const joinedAt = Date.parse(player.joinedTeamAt);
    return Number.isFinite(joinedAt) ? Math.max(latest, joinedAt) : latest;
  }, Number.NEGATIVE_INFINITY);
  const chemistrySince = Date.parse(team.rosterChemistrySince || '');
  const currentRosterSince = Number.isFinite(chemistrySince) ? chemistrySince : latestJoinedAt;

  const matchKeysForTeam = (match: Match, matchTeamId: string, useCurrentRosterFallback: boolean): string[] => {
    let playerIds = match.teamPlayedPlayerIds?.[matchTeamId];
    if (!playerIds && match.playedPlayerIds) {
      playerIds = match.playedPlayerIds.filter((playerId) => {
        const player = playerById.get(playerId);
        return player?.leagueId === match.leagueId && player.teamId === matchTeamId;
      });
    }
    if (playerIds) {
      return Array.from(
        new Set(playerIds.map((playerId) => stableKey(playerById.get(playerId))).filter(Boolean) as string[])
      );
    }
    if (useCurrentRosterFallback) return rosterKeys;

    const matchDate = Date.parse(match.scheduledDate);
    return Array.from(
      new Set(
        players
          .filter((player) => {
            if (player.leagueId !== match.leagueId || player.teamId !== matchTeamId) return false;
            const joinedAt = Date.parse(player.joinedTeamAt);
            return !Number.isFinite(matchDate) || !Number.isFinite(joinedAt) || joinedAt <= matchDate;
          })
          .map((player) => stableKey(player))
          .filter(Boolean) as string[]
      )
    );
  };

  const currentPairCounts = new Map(pairKeys.map((key) => [key, 0]));
  let matchesInCurrentRosterRevision = 0;
  for (const match of currentMatches) {
    const snapshotRevision = match.rosterRevisionSnapshot?.[teamId];
    const matchDate = Date.parse(match.scheduledDate);
    const sameRosterRevision =
      snapshotRevision !== undefined
        ? snapshotRevision === (team.rosterRevision ?? 0)
        : !Number.isFinite(currentRosterSince) ||
          (Number.isFinite(matchDate) && matchDate >= currentRosterSince);
    if (!sameRosterRevision) continue;
    matchesInCurrentRosterRevision += 1;
    const keys = matchKeysForTeam(match, teamId, true).filter((key) => rosterKeySet.has(key));
    for (let i = 0; i < keys.length; i += 1) {
      for (let j = i + 1; j < keys.length; j += 1) {
        const key = JSON.stringify([keys[i], keys[j]].sort());
        if (currentPairCounts.has(key)) currentPairCounts.set(key, (currentPairCounts.get(key) || 0) + 1);
      }
    }
  }

  const historicalPairCounts = new Map(pairKeys.map((key) => [key, 0]));
  for (const match of finalRegularMatches) {
    if (match.leagueId === leagueId) continue;
    for (const matchTeamId of [match.homeTeamId, match.awayTeamId]) {
      const keys = matchKeysForTeam(match, matchTeamId, false).filter((key) => rosterKeySet.has(key));
      for (let i = 0; i < keys.length; i += 1) {
        for (let j = i + 1; j < keys.length; j += 1) {
          const key = JSON.stringify([keys[i], keys[j]].sort());
          if (historicalPairCounts.has(key)) {
            historicalPairCounts.set(key, (historicalPairCounts.get(key) || 0) + 1);
          }
        }
      }
    }
  }

  const continuityRate = pairKeys.length
    ? pairKeys.reduce(
        (sum, key) => sum + Math.min(currentPairCounts.get(key) || 0, 8) / 8,
        0
      ) / pairKeys.length
    : Math.min(matchesInCurrentRosterRevision, 8) / 8;
  const legacyRate = pairKeys.length
    ? pairKeys.reduce(
        (sum, key) => sum + Math.min(historicalPairCounts.get(key) || 0, 5) / 5,
        0
      ) / pairKeys.length
    : 0;
  const returningPairs = pairKeys.filter((key) => (historicalPairCounts.get(key) || 0) > 0).length;
  const returningBonus = Math.min(10, returningPairs * 3);
  const returningTeammateMatches = Array.from(historicalPairCounts.values()).reduce(
    (sum, count) => sum + count,
    0
  );

  const standings = computeStandings(leagueId, teams, matches);
  const teamStanding = standings.find((row) => row.teamId === teamId);
  const teamCount = teams.filter((entry) => entry.leagueId === leagueId).length;
  const rankRate =
    teamCount <= 1 || !teamStanding ? 0 : (teamCount - teamStanding.rank) / (teamCount - 1);
  const rankBonus = Math.round(Math.max(0, Math.min(1, rankRate)) * 15);
  const formBonus = teamStanding && teamStanding.gp > 0
    ? (teamStanding.l === 0 ? 10 : 0) +
      (teamStanding.ga === 0 ? 15 : 0) +
      (teamStanding.l === 0 && teamStanding.ga === 0 ? 10 : 0)
    : 0;
  const percentage = Math.min(
    100,
    Math.round(20 + continuityRate * 40 + legacyRate * 20 + returningBonus + rankBonus + formBonus)
  );
  const coreMatchesPlayedTogether =
    pairKeys.length > 0
      ? Math.min(...Array.from(currentPairCounts.values()))
      : matchesInCurrentRosterRevision;

  return {
    percentage,
    coreDynasty: percentage >= 80 && matchesInCurrentRosterRevision >= 3,
    coreMatchesPlayedTogether,
    returningTeammateMatches,
    rankBonus,
    formBonus,
  };
}

export function computeDynamicPrizeDisplay(
  league: League,
  teamCount: number
): {
  headlinePrize: string;
  scalingSubtext: string | null;
  unlockedTierIndex: number;
} {
  if (!league.dynamicPrizeScaling || !league.prizeTiers || league.prizeTiers.length === 0) {
    return {
      headlinePrize: league.customPrizeText || 'Cash Prize Pool',
      scalingSubtext: null,
      unlockedTierIndex: -1,
    };
  }

  const sortedTiers = [...league.prizeTiers].sort((a, b) => a.minTeams - b.minTeams);
  let activeTierIdx = -1;
  for (let i = 0; i < sortedTiers.length; i++) {
    if (teamCount >= sortedTiers[i].minTeams) {
      activeTierIdx = i;
    }
  }

  const tierSummary = sortedTiers
    .map((t) => `${t.minTeams} Teams = ${t.prizeLabel}`)
    .join(' | ');

  if (activeTierIdx >= 0) {
    return {
      headlinePrize: `${sortedTiers[activeTierIdx].prizeLabel} (Unlocked at ${teamCount} Teams)`,
      scalingSubtext: tierSummary,
      unlockedTierIndex: activeTierIdx,
    };
  }

  return {
    headlinePrize: league.customPrizeText || sortedTiers[0].prizeLabel,
    scalingSubtext: tierSummary,
    unlockedTierIndex: -1,
  };
}

export function checkPlayerMarketCooldown(
  player: Player,
  nowMs: number = Date.now()
): { unlocked: boolean; hoursRemaining: number; label: string } {
  const refTime = new Date(player.lastMarketActionAt || player.joinedTeamAt).getTime();
  const elapsedHours = (nowMs - refTime) / (1000 * 60 * 60);
  if (elapsedHours >= MARKET_COOLDOWN_HOURS) {
    return { unlocked: true, hoursRemaining: 0, label: 'Ready to List' };
  }
  const rem = Math.ceil(MARKET_COOLDOWN_HOURS - elapsedHours);
  const days = Math.floor(rem / 24);
  const hrs = rem % 24;
  return {
    unlocked: false,
    hoursRemaining: rem,
    label: days > 0 ? `Unlocks in ${days}d ${hrs}h` : `Unlocks in ${hrs}h`,
  };
}

export function checkTeamLifelineCooldown(
  team: Team,
  nowMs: number = Date.now()
): { unlocked: boolean; hoursRemaining: number; label: string } {
  if (!team.lastLifelineRequestAt) {
    return { unlocked: true, hoursRemaining: 0, label: 'Lifeline Ready' };
  }
  const refTime = new Date(team.lastLifelineRequestAt).getTime();
  const elapsedHours = (nowMs - refTime) / (1000 * 60 * 60);
  if (elapsedHours >= LIFELINE_COOLDOWN_HOURS) {
    return { unlocked: true, hoursRemaining: 0, label: 'Lifeline Ready' };
  }
  const rem = Math.ceil(LIFELINE_COOLDOWN_HOURS - elapsedHours);
  const days = Math.floor(rem / 24);
  const hrs = rem % 24;
  return {
    unlocked: false,
    hoursRemaining: rem,
    label: days > 0 ? `Cooldown ${days}d ${hrs}h` : `Cooldown ${hrs}h`,
  };
}

export interface MatchEligibility {
  eligible: boolean;
  status: string;
  reason: string;
  isLoanedIn: boolean;
  loanId?: string;
}

export function getPlayerEligibilityForMatch(
  player: Player,
  match: Match,
  squadTeamId: string,
  league: League,
  transfers: TransferOrLoanRequest[]
): MatchEligibility {
  if (player.suspendedNextMatch) {
    return {
      eligible: false,
      status: 'Suspended (Red Card)',
      reason: 'Player has an active red card suspension pending admin clearance',
      isLoanedIn: false,
    };
  }

  const activeLoans = transfers.filter(
    (tr) => tr.kind === 'loan' && tr.status === 'Active' && (tr.gamesRemaining ?? 0) > 0
  );

  const playerActiveLoan = activeLoans.find((ln) => ln.loanPlayerIds?.includes(player.id));

  if (playerActiveLoan) {
    if (squadTeamId === playerActiveLoan.lendingTeamId) {
      return {
        eligible: false,
        status: 'Ineligible for Original Team (4 Games)',
        reason: `Locked out of parent club while on ${playerActiveLoan.gamesRemaining}/4 loan`,
        isLoanedIn: false,
        loanId: playerActiveLoan.id,
      };
    }

    if (squadTeamId === playerActiveLoan.borrowingTeamId) {
      const opponentId =
        match.homeTeamId === squadTeamId ? match.awayTeamId : match.homeTeamId;
      if (opponentId === playerActiveLoan.lendingTeamId) {
        return {
          eligible: false,
          status: 'Ineligible vs Parent Club',
          reason: 'Loaned players cannot play against their original club',
          isLoanedIn: true,
          loanId: playerActiveLoan.id,
        };
      }
      if (!player.waiverSigned) {
        return {
          eligible: false,
          status: 'Waiver Unsigned',
          reason: 'Digital liability waiver required',
          isLoanedIn: true,
          loanId: playerActiveLoan.id,
        };
      }
      return {
        eligible: true,
        status: `Loan Active (${playerActiveLoan.gamesRemaining}/4 left)`,
        reason: '',
        isLoanedIn: true,
        loanId: playerActiveLoan.id,
      };
    }
  }

  if (!player.waiverSigned) {
    return {
      eligible: false,
      status: 'Waiver Unsigned',
      reason: 'Player must sign digital waiver before kickoff',
      isLoanedIn: false,
    };
  }

  if (
    (match.stage === 'Quarterfinal' || match.stage === 'Semifinal' || match.stage === 'Final') &&
    player.gamesPlayed < league.playoffMinGames
  ) {
    return {
      eligible: false,
      status: `Ineligible: Anti-Ringer (<${league.playoffMinGames} GP)`,
      reason: `Needs ${league.playoffMinGames} regular-season games to qualify for cash-prize playoffs`,
      isLoanedIn: false,
    };
  }

  return {
    eligible: true,
    status: 'Eligible',
    reason: '',
    isLoanedIn: false,
  };
}

export interface ChampionsCupSeed {
  seed: number;
  leagueId: string;
  leagueName: string;
  divisionDay: string;
  teamId: string;
  teamName: string;
  kitColor: string;
  gp: number;
  w: number;
  d: number;
  l: number;
  gd: number;
  pts: number;
  ppg: number;
}

export function computeChampionsCupSeeds(
  linkedLeagueIds: string[],
  leagues: League[],
  teams: Team[],
  matches: Match[]
): ChampionsCupSeed[] {
  const leaders: Omit<ChampionsCupSeed, 'seed'>[] = [];

  for (const lid of linkedLeagueIds) {
    const lg = leagues.find((l) => l.id === lid);
    if (!lg) continue;
    const table = computeStandings(lid, teams, matches);
    const leader = table[0];
    if (!leader) continue;
    const ppg = leader.gp > 0 ? leader.pts / leader.gp : 0;
    leaders.push({
      leagueId: lg.id,
      leagueName: lg.name,
      divisionDay: `${lg.dayOfWeek} ${lg.division}`,
      teamId: leader.teamId,
      teamName: leader.teamName,
      kitColor: leader.kitColor,
      gp: leader.gp,
      w: leader.w,
      d: leader.d,
      l: leader.l,
      gd: leader.gd,
      pts: leader.pts,
      ppg,
    });
  }

  leaders.sort(
    (a, b) =>
      b.ppg - a.ppg ||
      b.pts - a.pts ||
      b.gd - a.gd ||
      a.divisionDay.localeCompare(b.divisionDay)
  );

  return leaders.map((item, idx) => ({
    ...item,
    seed: idx + 1,
  }));
}

export function generateAutoScaledCupMatches(
  seeds: ChampionsCupSeed[]
): ChampionsCupMatch[] {
  const n = seeds.length;
  if (n < 2) return [];

  if (n === 2) {
    return [
      {
        id: 'cup_final',
        round: 'Final',
        bracketSlot: 'SUPER FINAL',
        homeSeed: seeds[0].seed,
        awaySeed: seeds[1].seed,
        homeTeamId: seeds[0].teamId,
        awayTeamId: seeds[1].teamId,
        homeTeamName: seeds[0].teamName,
        awayTeamName: seeds[1].teamName,
        homeDivisionLabel: seeds[0].divisionDay,
        awayDivisionLabel: seeds[1].divisionDay,
        fieldNumber: 'Center Pitch · Turf 1',
        scheduledDate: 'Season Finale Sunday',
        scheduledTime: '8:00 PM',
        status: 'Scheduled',
        homeScore: null,
        awayScore: null,
      },
    ];
  }

  if (n === 3) {
    return [
      {
        id: 'cup_sf_1',
        round: 'Semifinal',
        bracketSlot: 'SEMIFINAL (2 vs 3)',
        homeSeed: seeds[1].seed,
        awaySeed: seeds[2].seed,
        homeTeamId: seeds[1].teamId,
        awayTeamId: seeds[2].teamId,
        homeTeamName: seeds[1].teamName,
        awayTeamName: seeds[2].teamName,
        homeDivisionLabel: seeds[1].divisionDay,
        awayDivisionLabel: seeds[2].divisionDay,
        fieldNumber: 'Turf 1',
        scheduledDate: 'Super Cup Night 1',
        scheduledTime: '7:00 PM',
        status: 'Scheduled',
        homeScore: null,
        awayScore: null,
      },
      {
        id: 'cup_final',
        round: 'Final',
        bracketSlot: 'GRAND FINAL (#1 BYE)',
        homeSeed: seeds[0].seed,
        awaySeed: null,
        homeTeamId: seeds[0].teamId,
        awayTeamId: 'TBD_SF1',
        homeTeamName: seeds[0].teamName,
        awayTeamName: 'Winner Semifinal',
        homeDivisionLabel: seeds[0].divisionDay,
        awayDivisionLabel: 'SF Winner',
        fieldNumber: 'Center Pitch · Turf 1',
        scheduledDate: 'Super Cup Night 2',
        scheduledTime: '8:30 PM',
        status: 'Scheduled',
        homeScore: null,
        awayScore: null,
      },
    ];
  }

  if (n === 4) {
    return [
      {
        id: 'cup_sf_1',
        round: 'Semifinal',
        bracketSlot: 'SEMIFINAL 1',
        homeSeed: seeds[0].seed,
        awaySeed: seeds[3].seed,
        homeTeamId: seeds[0].teamId,
        awayTeamId: seeds[3].teamId,
        homeTeamName: seeds[0].teamName,
        awayTeamName: seeds[3].teamName,
        homeDivisionLabel: seeds[0].divisionDay,
        awayDivisionLabel: seeds[3].divisionDay,
        fieldNumber: 'Turf 1',
        scheduledDate: 'Super Cup Semis',
        scheduledTime: '6:45 PM',
        status: 'Scheduled',
        homeScore: null,
        awayScore: null,
      },
      {
        id: 'cup_sf_2',
        round: 'Semifinal',
        bracketSlot: 'SEMIFINAL 2',
        homeSeed: seeds[1].seed,
        awaySeed: seeds[2].seed,
        homeTeamId: seeds[1].teamId,
        awayTeamId: seeds[2].teamId,
        homeTeamName: seeds[1].teamName,
        awayTeamName: seeds[2].teamName,
        homeDivisionLabel: seeds[1].divisionDay,
        awayDivisionLabel: seeds[2].divisionDay,
        fieldNumber: 'Turf 2',
        scheduledDate: 'Super Cup Semis',
        scheduledTime: '7:45 PM',
        status: 'Scheduled',
        homeScore: null,
        awayScore: null,
      },
      {
        id: 'cup_final',
        round: 'Final',
        bracketSlot: 'GRAND FINAL',
        homeSeed: null,
        awaySeed: null,
        homeTeamId: 'TBD_SF1',
        awayTeamId: 'TBD_SF2',
        homeTeamName: 'Winner Semifinal 1',
        awayTeamName: 'Winner Semifinal 2',
        homeDivisionLabel: 'SF1 Winner',
        awayDivisionLabel: 'SF2 Winner',
        fieldNumber: 'Center Pitch · Turf 1',
        scheduledDate: 'Super Cup Finale',
        scheduledTime: '9:00 PM',
        status: 'Scheduled',
        homeScore: null,
        awayScore: null,
      },
    ];
  }

  // 5+ teams: Dynamic Play-In Quarterfinals + Semifinals + Grand Final
  const result: ChampionsCupMatch[] = [];
  const qfCount = Math.min(4, n - 4);
  for (let i = 0; i < qfCount; i++) {
    const high = seeds[3 - i];
    const low = seeds[4 + i];
    if (!high || !low) continue;
    result.push({
      id: `cup_qf_${i + 1}`,
      round: 'Quarterfinal',
      bracketSlot: `QUARTERFINAL ${i + 1}`,
      homeSeed: high.seed,
      awaySeed: low.seed,
      homeTeamId: high.teamId,
      awayTeamId: low.teamId,
      homeTeamName: high.teamName,
      awayTeamName: low.teamName,
      homeDivisionLabel: high.divisionDay,
      awayDivisionLabel: low.divisionDay,
      fieldNumber: i % 2 === 0 ? 'Turf 1' : 'Turf 2',
      scheduledDate: 'Super Cup Play-In',
      scheduledTime: '6:00 PM',
      status: 'Scheduled',
      homeScore: null,
      awayScore: null,
    });
  }

  result.push(
    {
      id: 'cup_sf_1',
      round: 'Semifinal',
      bracketSlot: 'SEMIFINAL 1',
      homeSeed: seeds[0].seed,
      awaySeed: null,
      homeTeamId: seeds[0].teamId,
      awayTeamId: qfCount >= 1 ? 'TBD_QF1' : seeds[3].teamId,
      homeTeamName: seeds[0].teamName,
      awayTeamName: qfCount >= 1 ? 'Winner QF 1' : seeds[3].teamName,
      homeDivisionLabel: seeds[0].divisionDay,
      awayDivisionLabel: qfCount >= 1 ? 'QF 1 Winner' : seeds[3].divisionDay,
      fieldNumber: 'Turf 1',
      scheduledDate: 'Super Cup Semis',
      scheduledTime: '7:15 PM',
      status: 'Scheduled',
      homeScore: null,
      awayScore: null,
    },
    {
      id: 'cup_sf_2',
      round: 'Semifinal',
      bracketSlot: 'SEMIFINAL 2',
      homeSeed: seeds[1].seed,
      awaySeed: qfCount >= 2 ? null : seeds[2].seed,
      homeTeamId: seeds[1].teamId,
      awayTeamId: qfCount >= 2 ? 'TBD_QF2' : seeds[2].teamId,
      homeTeamName: seeds[1].teamName,
      awayTeamName: qfCount >= 2 ? 'Winner QF 2' : seeds[2].teamName,
      homeDivisionLabel: seeds[1].divisionDay,
      awayDivisionLabel: qfCount >= 2 ? 'QF 2 Winner' : seeds[2].divisionDay,
      fieldNumber: 'Turf 2',
      scheduledDate: 'Super Cup Semis',
      scheduledTime: '7:15 PM',
      status: 'Scheduled',
      homeScore: null,
      awayScore: null,
    },
    {
      id: 'cup_final',
      round: 'Final',
      bracketSlot: 'GRAND FINAL',
      homeSeed: null,
      awaySeed: null,
      homeTeamId: 'TBD_SF1',
      awayTeamId: 'TBD_SF2',
      homeTeamName: 'Winner Semifinal 1',
      awayTeamName: 'Winner Semifinal 2',
      homeDivisionLabel: 'SF1 Winner',
      awayDivisionLabel: 'SF2 Winner',
      fieldNumber: 'Center Pitch · Turf 1',
      scheduledDate: 'Super Cup Finale',
      scheduledTime: '9:00 PM',
      status: 'Scheduled',
      homeScore: null,
      awayScore: null,
    }
  );

  return result;
}

export function checkCoEdTeamCompliance(
  teamId: string,
  players: Player[],
  cupConfig: ChampionsCupConfig
): {
  eligibleCount: number;
  femaleEligibleCount: number;
  ringerBlockedCount: number;
  meetsGenderRatio: boolean;
} {
  const squad = players.filter((p) => p.teamId === teamId);
  const eligible = squad.filter((p) => {
    if (!p.waiverSigned || p.suspendedNextMatch) return false;
    if (cupConfig.lockRostersToRegularSeason && p.gamesPlayed < cupConfig.minRegularSeasonGames) {
      return false;
    }
    return true;
  });
  const femaleEligibleCount = eligible.filter((p) => p.gender === 'Female').length;
  const ringerBlockedCount = squad.filter(
    (p) => cupConfig.lockRostersToRegularSeason && p.gamesPlayed < cupConfig.minRegularSeasonGames
  ).length;
  return {
    eligibleCount: eligible.length,
    femaleEligibleCount,
    ringerBlockedCount,
    meetsGenderRatio:
      !cupConfig.enforceGenderRatio || femaleEligibleCount >= cupConfig.minFemaleOnField,
  };
}

export function checkDivisionGenderEligibility(
  _division: League['division'],
  _gender?: 'Male' | 'Female' | 'Non-Binary'
): { allowed: boolean; reason: string } {
  return { allowed: true, reason: '' };
}

export function getEffectiveTeamCaps(team: Team, league: League) {
  const rosterCap = league.rosterMaxCap || team.rosterLimit || 11;
  const maleCap = team.customMaleCap ?? league.coedMaleCap ?? 7;
  const femaleCap = team.customFemaleCap ?? league.coedFemaleCap ?? 4;
  return {
    rosterCap,
    maleCap,
    femaleCap,
    isAutoFlipped: Boolean(team.autoFlippedCoEd) || (maleCap === 4 && femaleCap === 7),
    splitLabel: `${maleCap}M / ${femaleCap}F`,
  };
}

export interface RosterSlotEvaluation {
  allowed: boolean;
  reason: string;
  shouldAutoFlipTo4M7F: boolean;
  rosterCount: number;
  rosterCap: number;
  maleCount: number;
  femaleCount: number;
  maleCap: number;
  femaleCap: number;
  standbyRecommended: boolean;
}

export function evaluateTeamRosterAddition(
  team: Team,
  league: League,
  rosterPlayers: Player[],
  incomingGender: 'Male' | 'Female'
): RosterSlotEvaluation {
  const divCheck = checkDivisionGenderEligibility(league.division, incomingGender);
  const { rosterCap, maleCap, femaleCap } = getEffectiveTeamCaps(team, league);
  const rosterCount = rosterPlayers.length;
  const maleCount = rosterPlayers.filter((p) => (p.gender || 'Male') === 'Male').length;
  const femaleCount = rosterPlayers.filter((p) => p.gender === 'Female').length;

  if (!divCheck.allowed) {
    return {
      allowed: false,
      reason: divCheck.reason,
      shouldAutoFlipTo4M7F: false,
      rosterCount,
      rosterCap,
      maleCount,
      femaleCount,
      maleCap,
      femaleCap,
      standbyRecommended: false,
    };
  }

  if (rosterCount >= rosterCap) {
    return {
      allowed: false,
      reason: `Team roster is full (${rosterCount}/${rosterCap} max players). Join the Team Standby Waitlist.`,
      shouldAutoFlipTo4M7F: false,
      rosterCount,
      rosterCap,
      maleCount,
      femaleCount,
      maleCap,
      femaleCap,
      standbyRecommended: true,
    };
  }

  if (league.division === 'Co-Ed') {
    if (incomingGender === 'Male' && maleCount >= maleCap) {
      return {
        allowed: false,
        reason: `Male roster slots full (${maleCount}/${maleCap} in ${maleCap}M/${femaleCap}F split). ${femaleCap - femaleCount} Female spots remain or join Standby Waitlist.`,
        shouldAutoFlipTo4M7F: false,
        rosterCount,
        rosterCap,
        maleCount,
        femaleCount,
        maleCap,
        femaleCap,
        standbyRecommended: true,
      };
    }

    if (incomingGender === 'Female' && femaleCount >= femaleCap) {
      const deadlineNear = (league.deadlineHoursRemaining ?? 48) <= 72;
      if (league.autoFlipEnabled && deadlineNear && maleCount <= 4 && femaleCap < 7) {
        return {
          allowed: true,
          reason: 'Deadline Auto-Flip triggered: Team Co-Ed split flipped from 7M/4F to 4M/7F to accommodate extra Female sign-ups.',
          shouldAutoFlipTo4M7F: true,
          rosterCount,
          rosterCap,
          maleCount,
          femaleCount,
          maleCap: 4,
          femaleCap: 7,
          standbyRecommended: false,
        };
      }

      return {
        allowed: false,
        reason: `Female roster slots full (${femaleCount}/${femaleCap} in ${maleCap}M/${femaleCap}F split). Join Team Standby Waitlist.`,
        shouldAutoFlipTo4M7F: false,
        rosterCount,
        rosterCap,
        maleCount,
        femaleCount,
        maleCap,
        femaleCap,
        standbyRecommended: true,
      };
    }
  }

  return {
    allowed: true,
    reason: 'Roster slot available',
    shouldAutoFlipTo4M7F: false,
    rosterCount,
    rosterCap,
    maleCount,
    femaleCount,
    maleCap,
    femaleCap,
    standbyRecommended: false,
  };
}

export function computePlayerOvr(player: Player): {
  ovr: number;
  tier: 'Bronze' | 'Silver' | 'Gold' | 'Champion';
  pac: number;
  sho: number;
  pas: number;
  def: number;
} {
  const gp = player.gamesPlayed || 0;
  const g = player.goals || 0;
  const a = player.assists || 0;
  const w = player.wins || 0;
  const cs = player.cleanSheets || 0;
  const motm = player.motmAwards || 0;

  const rawScore = 68 + gp * 1.2 + g * 2.4 + a * 1.6 + w * 1.5 + cs * 2.2 + motm * 3.5;
  const ovr = Math.min(97, Math.max(66, Math.round(rawScore)));
  const tier =
    ovr >= 88 ? 'Champion' : ovr >= 80 ? 'Gold' : ovr >= 73 ? 'Silver' : 'Bronze';

  const pac = Math.min(98, 71 + gp * 2 + (player.position === 'FWD' ? 8 : player.position === 'MID' ? 5 : 2));
  const sho = Math.min(98, 60 + g * 4 + (player.position === 'FWD' ? 12 : 4));
  const pas = Math.min(98, 64 + a * 5 + gp * 2 + (player.position === 'MID' ? 10 : 3));
  const def = Math.min(98, 55 + cs * 6 + gp * 2 + (player.position === 'DEF' || player.position === 'GK' ? 18 : 2));

  return { ovr, tier, pac, sho, pas, def };
}

export function computeTeamOfTheWeek(leagueId: string, players: Player[], teams: Team[]) {
  const leaguePlayers = players.filter((p) => p.leagueId === leagueId);
  const scored = leaguePlayers
    .map((p) => {
      const team = teams.find((t) => t.id === p.teamId);
      const { ovr, tier } = computePlayerOvr(p);
      const weekScore = p.goals * 4 + p.assists * 3 + (p.motmAwards ?? 0) * 5 + (p.cleanSheets ?? 0) * 4 + p.gamesPlayed;
      return { player: p, team, ovr, tier, weekScore };
    })
    .sort((a, b) => b.weekScore - a.weekScore || b.ovr - a.ovr);

  const pickByPos = (pos: Player['position'], count: number, excludeIds: Set<string>) => {
    const chosen: typeof scored = [];
    for (const item of scored) {
      if (chosen.length >= count) break;
      if (item.player.position === pos && !excludeIds.has(item.player.id)) {
        chosen.push(item);
        excludeIds.add(item.player.id);
      }
    }
    return chosen;
  };

  const used = new Set<string>();
  const gk = pickByPos('GK', 1, used);
  const def = pickByPos('DEF', 2, used);
  const mid = pickByPos('MID', 2, used);
  const fwd = pickByPos('FWD', 2, used);
  const lineup = [...gk, ...def, ...mid, ...fwd];

  for (const item of scored) {
    if (lineup.length >= 7) break;
    if (!used.has(item.player.id)) {
      lineup.push(item);
      used.add(item.player.id);
    }
  }
  return lineup;
}

