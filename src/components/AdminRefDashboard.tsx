import React, { useEffect, useMemo, useState } from 'react';
import {
  ShieldCheck,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Calendar,
  Send,
  DollarSign,
  RotateCcw,
  FastForward,
  LogOut,
  Copy,
  Palette,
  Calculator,
  Megaphone,
  UserPlus,
  Handshake,
  Tag,
  Trophy,
  GitBranch,
  Edit3,
  Trash2,
  MapPin,
  Save,
  ExternalLink,
} from 'lucide-react';
import type {
  League,
  LeagueDatabase,
  LeagueDivision,
  LeagueFormat,
  LeagueStatus,
  LeagueType,
  Match,
  MatchEvent,
  Partner,
  Player,
  SkillLevel,
  StaffMember,
  Venue,
} from '../types.ts';
import {
  calculateSeasonDurationLabel,
  checkCoEdTeamCompliance,
  computeChampionsCupSeeds,
  computeDynamicPrizeDisplay,
  computeMatchClockBreakdown,
  computeProfitEstimate,
  getPlayerEligibilityForMatch,
} from '../utils/leagueHelpers.ts';

export type AdminSection =
  | 'referee'
  | 'leagues'
  | 'supercup'
  | 'customizer'
  | 'staff'
  | 'ops'
  | 'venues'
  | 'payments';

interface AdminRefDashboardProps {
  db: LeagueDatabase;
  initialSection: AdminSection;
  onNavigateSection: (section: AdminSection) => void;
  onDatabaseUpdate: (db: LeagueDatabase) => void;
}

export const AdminRefDashboard: React.FC<AdminRefDashboardProps> = ({
  db,
  initialSection,
  onNavigateSection,
  onDatabaseUpdate,
}) => {
  const [authRole, setAuthRole] = useState<'none' | 'referee' | 'admin'>(() => {
    const storedRole = window.sessionStorage.getItem('ball-out-admin-role');
    return storedRole === 'admin' || storedRole === 'referee' ? storedRole : 'none';
  });
  const [passcode, setPasscode] = useState('');
  const [authError, setAuthError] = useState('');

  const [section, setSection] = useState<AdminSection>(initialSection);
  const navigateSection = (nextSection: AdminSection) => {
    setSection(nextSection);
    onNavigateSection(nextSection);
  };

  useEffect(() => {
    setSection(initialSection);
  }, [initialSection]);

  useEffect(() => {
    if (authRole === 'referee' && initialSection !== 'referee') {
      navigateSection('referee');
    }
  }, [authRole, initialSection]);
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const navigationGroups = [
    {
      label: 'League Operations',
      items: [
        { id: 'leagues' as const, label: 'Leagues & Profit', icon: <Calculator className="h-4 w-4" />, adminOnly: true, badge: db.leagues.length },
        { id: 'supercup' as const, label: 'Co-Ed Super Cup', icon: <GitBranch className="h-4 w-4" />, adminOnly: true },
        { id: 'referee' as const, label: 'Ref Scorekeeper', icon: <ShieldCheck className="h-4 w-4" />, adminOnly: false },
      ],
    },
    {
      label: 'Organization',
      items: [
        { id: 'venues' as const, label: 'Cities & Fields', icon: <MapPin className="h-4 w-4" />, adminOnly: true, badge: db.venues.length },
        { id: 'staff' as const, label: 'Staff & Partners', icon: <Handshake className="h-4 w-4" />, adminOnly: true },
      ],
    },
    {
      label: 'Finance & Growth',
      items: [
        { id: 'payments' as const, label: 'Fee Ledger', icon: <DollarSign className="h-4 w-4" />, adminOnly: true },
        { id: 'ops' as const, label: 'Promos & Suspensions', icon: <Megaphone className="h-4 w-4" />, adminOnly: true },
        { id: 'customizer' as const, label: 'Brand Customizer', icon: <Palette className="h-4 w-4" />, adminOnly: true },
      ],
    },
  ]
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.adminOnly || authRole === 'admin'),
    }))
    .filter((group) => group.items.length > 0);

  // Champions Cup Local Controls
  const [cupName, setCupName] = useState(db.championsCup.name);
  const [cupSeasonLabel, setCupSeasonLabel] = useState(db.championsCup.seasonLabel);
  const [cupBonusPrize, setCupBonusPrize] = useState(db.championsCup.bonusPrizeText);
  const [cupScores, setCupScores] = useState<Record<string, { home: number; away: number }>>({});

  // Referee Scorekeeper State
  const scheduledMatches = useMemo(
    () => db.matches.filter((m) => m.status === 'Scheduled'),
    [db.matches]
  );
  const [selectedMatchId, setSelectedMatchId] = useState<string>(scheduledMatches[0]?.id || '');
  const [homeScore, setHomeScore] = useState<number>(0);
  const [awayScore, setAwayScore] = useState<number>(0);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [eventPlayerId, setEventPlayerId] = useState<string>('');
  const [eventType, setEventType] = useState<'Goal' | 'Yellow' | 'Red'>('Goal');
  const [loanAppearanceIds, setLoanAppearanceIds] = useState<string[]>([]);

  // Visual Site Customizer State
  const [brandName, setBrandName] = useState(db.brand.siteName);
  const [brandTagline, setBrandTagline] = useState(db.brand.tagline);
  const [brandAbout, setBrandAbout] = useState(db.brand.aboutText);
  const [brandRules, setBrandRules] = useState(db.brand.rulesSummary);
  const [brandBannerEnabled, setBrandBannerEnabled] = useState(db.brand.bannerEnabled);
  const [brandBannerText, setBrandBannerText] = useState(db.brand.bannerText);
  const [brandPin, setBrandPin] = useState(db.brand.adminPin);

  // League Builder & Profit Estimator State (Blank Launch: Manual venue/city entry; $250 Solo / $2,500 Team defaults)
  const [editLeagueId, setEditLeagueId] = useState<string>(db.leagues[0]?.id || '');
  const [expandedEditLeagueId, setExpandedEditLeagueId] = useState<string>('');
  const [leagueDrafts, setLeagueDrafts] = useState<Record<string, Record<string, string | number | boolean>>>({});
  const [showNewLeagueForm, setShowNewLeagueForm] = useState(false);
  const [newLeagueName, setNewLeagueName] = useState('');
  const [newLeagueCity, setNewLeagueCity] = useState('');
  const [newLeagueRegion, setNewLeagueRegion] = useState('');
  const [newLeagueCountry, setNewLeagueCountry] = useState('');
  const [newLeagueVenueName, setNewLeagueVenueName] = useState('');
  const [newLeagueVenueAddress, setNewLeagueVenueAddress] = useState('');
  const [newLeagueIndoorOutdoor, setNewLeagueIndoorOutdoor] = useState<Venue['indoorOutdoor']>('Outdoor Turf');
  const [newLeagueVenueFields, setNewLeagueVenueFields] = useState('Turf 1, Turf 2');
  const [newLeagueDescription, setNewLeagueDescription] = useState('');
  const [newLeagueRules, setNewLeagueRules] = useState('');
  const [newLeagueType, setNewLeagueType] = useState<LeagueType>('League');
  const [newLeagueDay, setNewLeagueDay] = useState<League['dayOfWeek']>('Sunday');
  const [newLeagueFormat, setNewLeagueFormat] = useState<LeagueFormat>('7v7');
  const [newLeagueDivision, setNewLeagueDivision] = useState<LeagueDivision>('Co-Ed');
  const [newLeagueSkill, setNewLeagueSkill] = useState<SkillLevel>('Competitive');
  const [newLeagueFeeTeam, setNewLeagueFeeTeam] = useState(2500);
  const [newLeagueFeeSolo, setNewLeagueFeeSolo] = useState(250);
  const [newLeagueMaxTeams, setNewLeagueMaxTeams] = useState(10);
  const [newLeagueGameWeeks, setNewLeagueGameWeeks] = useState(15);
  const [newLeagueGamesPerWeek, setNewLeagueGamesPerWeek] = useState<1 | 2>(1);
  const [newLeagueStartDate, setNewLeagueStartDate] = useState('Kickoff Date TBD');
  const [newLeagueTimeWindow, setNewLeagueTimeWindow] = useState('3:00 PM – 9:00 PM');
  const [newLeaguePrizeText, setNewLeaguePrizeText] = useState('Cash Prize ($500 – $1,000+)');
  const [newLeagueDynamicScaling, setNewLeagueDynamicScaling] = useState(true);

  // Profit Calculator inputs
  const [calcTurfHourly, setCalcTurfHourly] = useState(140);
  const [calcHoursPerWeek, setCalcHoursPerWeek] = useState(3);
  const [calcRefPerGame, setCalcRefPerGame] = useState(35);
  const [calcPlannedPrize, setCalcPlannedPrize] = useState(750);

  // Staff & Partner states
  const [staffName, setStaffName] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffRole, setStaffRole] = useState<StaffMember['role']>('COO');
  const [staffPerms, setStaffPerms] = useState('League Ops, Manage Schedules');
  const [ptName, setPtName] = useState('');
  const [ptCategory, setPtCategory] = useState<Partner['category']>('Local Sponsor');
  const [ptTagline, setPtTagline] = useState('');
  const [ptUrl, setPtUrl] = useState('');

  // Promo & WhatsApp Blast
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [promoDiscount, setPromoDiscount] = useState(50);
  const [promoDesc, setPromoDesc] = useState('Early-Bird Pre-Season Team Discount');
  const [blastType, setBlastType] = useState<'schedule' | 'weather' | 'spots'>('spots');
  const [copiedBlast, setCopiedBlast] = useState(false);

  // City & Venue Creator / Inline Editor
  const [newCityName, setNewCityName] = useState('');
  const [editingCity, setEditingCity] = useState<string>('');
  const [editingCityValue, setEditingCityValue] = useState<string>('');
  const [venueCity, setVenueCity] = useState('');
  const [venueName, setVenueName] = useState('');
  const [venueAddress, setVenueAddress] = useState('');
  const [venueNeighborhood, setVenueNeighborhood] = useState('');
  const [venueIndoorOutdoor, setVenueIndoorOutdoor] = useState<Venue['indoorOutdoor']>('Outdoor Turf');
  const [venueSurface, setVenueSurface] = useState('Synthetic Turf');
  const [venueFieldsText, setVenueFieldsText] = useState('Turf 1, Turf 2');
  const [editingVenueId, setEditingVenueId] = useState<string>('');
  const [venueDraft, setVenueDraft] = useState<Partial<Venue> & { fieldsText?: string }>({});

  // Match & Team Inline Edit Drafts
  const [matchDrafts, setMatchDrafts] = useState<Record<string, { fieldNumber: string; scheduledDate: string; scheduledTime: string }>>({});
  const [editingTeamId, setEditingTeamId] = useState<string>('');
  const [teamDraft, setTeamDraft] = useState<{ name: string; totalFee: number; amountPaid: number }>({
    name: '',
    totalFee: 2500,
    amountPaid: 0,
  });

  const handleLogin = async (
    e: React.FormEvent,
    roleAttempt: 'admin' | 'referee',
    codeOverride?: string
  ) => {
    e.preventDefault();
    setAuthError('');
    const codeToTry = codeOverride ?? passcode;
    const res = await fetch('/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: roleAttempt, passcode: codeToTry }),
    });
    const data = await res.json();
    if (!res.ok) {
      setAuthError(data.error || 'Invalid PIN or passcode');
      return;
    }
    setAuthRole(data.role);
    window.sessionStorage.setItem('ball-out-admin-role', data.role);
    navigateSection(data.role === 'admin' ? initialSection : 'referee');
  };

  if (authRole === 'none') {
    return (
      <div className="mx-auto max-w-lg px-4 sm:px-6 py-16">
        <div className="rounded-2xl border border-white/10 bg-[#111821] p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold text-white">
                Super-Admin & Referee Portal
              </h1>
              <p className="text-xs text-slate-400">
                Enter your Admin PIN (26231) or Referee passcode to unlock controls.
              </p>
            </div>
          </div>

          <form
            onSubmit={(e) => handleLogin(e, passcode === 'REF2026' ? 'referee' : 'admin')}
            className="space-y-4"
          >
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Access PIN / Passcode
              </label>
              <input
                type="password"
                required
                placeholder="Enter Admin PIN (26231) or Ref code"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                className="w-full rounded-lg border border-white/15 bg-[#090D12] px-3 py-2.5 text-sm text-white"
              />
            </div>

            {authError && (
              <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
                {authError}
              </div>
            )}

            <button
              type="submit"
              className="w-full min-h-[44px] rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 cursor-pointer"
            >
              Unlock Console
            </button>
          </form>

          <div className="rounded-xl border border-white/10 bg-[#090D12] p-4 space-y-2.5">
            <div className="text-xs font-medium text-slate-300">Quick Access</div>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={(e) => handleLogin(e, 'admin', db.brand.adminPin)}
                className="min-h-[40px] rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-white hover:bg-white/10 cursor-pointer"
              >
                Super-Admin ({db.brand.adminPin})
              </button>
              <button
                type="button"
                onClick={(e) => handleLogin(e, 'referee', 'REF2026')}
                className="min-h-[40px] rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 cursor-pointer"
              >
                Referee (REF2026)
              </button>
            </div>
          </div>
          <a
            href="/"
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Return to public website
          </a>
        </div>
      </div>
    );
  }

  const activeMatch =
    scheduledMatches.find((m) => m.id === selectedMatchId) || scheduledMatches[0];
  const activeMatchLeague = activeMatch
    ? db.leagues.find((l) => l.id === activeMatch.leagueId)
    : undefined;

  const getMatchSquad = (teamId: string): Player[] => {
    const base = db.players.filter((p) => p.teamId === teamId);
    const activeLoansIn = db.transfers.filter(
      (tr) =>
        tr.kind === 'loan' &&
        tr.status === 'Active' &&
        tr.borrowingTeamId === teamId &&
        (tr.gamesRemaining ?? 0) > 0
    );
    const loanedPlayers = activeLoansIn.flatMap((ln) =>
      (ln.loanPlayerIds || [])
        .map((pid) => db.players.find((p) => p.id === pid))
        .filter(Boolean) as Player[]
    );
    return [...base, ...loanedPlayers];
  };

  const homeSquad = activeMatch ? getMatchSquad(activeMatch.homeTeamId) : [];
  const awaySquad = activeMatch ? getMatchSquad(activeMatch.awayTeamId) : [];
  const editLeague = db.leagues.find((l) => l.id === editLeagueId) || db.leagues[0];

  const profitEst = computeProfitEstimate({
    turfHourlyCost: calcTurfHourly,
    hoursPerGameWeek: calcHoursPerWeek,
    gameWeeks: newLeagueGameWeeks,
    refCostPerGame: calcRefPerGame,
    numTeams: newLeagueMaxTeams,
    entryFeeTeam: newLeagueFeeTeam,
    plannedCashPrize: calcPlannedPrize,
  });

  const suspendedPlayers = db.players.filter((p) => p.suspendedNextMatch);

  const blastTemplate =
    blastType === 'schedule'
      ? `⚽ ${db.brand.siteName} SCHEDULE DROP: ${editLeague?.name || 'League'} fixtures are live! Check your match time, turf field, and kit colors in the Clubhouse before kickoff.`
      : blastType === 'weather'
      ? `🌧️ ${db.brand.siteName} WEATHER / FIELD UPDATE: Matches at ${editLeague?.locationName || 'the turf'} are ON AS SCHEDULED. Bring turf shoes and check the Opponent Lobby for updates.`
      : `🏆 ${db.brand.siteName} OPEN SPOTS: Limited spots left in ${editLeague?.name || 'our cash league'} (${editLeague?.customPrizeText || '$500–$1,000+ Cash Prize'}). Register at ${window.location.origin} with code EARLY50 for $50 off!`;

  const handleSubmitMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMatch) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/matches/${activeMatch.id}/submit-result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          homeScore,
          awayScore,
          events,
          loanAppearancePlayerIds: loanAppearanceIds,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onDatabaseUpdate(data);
      setEvents([]);
      setHomeScore(0);
      setAwayScore(0);
      setLoanAppearanceIds([]);
      setStatusMsg('Official match score logged. Standings, cards, suspensions & 4-game loan counters updated.');
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : 'Score submit error');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const res = await fetch('/api/brand', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        siteName: brandName,
        tagline: brandTagline,
        aboutText: brandAbout,
        rulesSummary: brandRules,
        bannerEnabled: brandBannerEnabled,
        bannerText: brandBannerText,
        adminPin: brandPin,
      }),
    });
    if (res.ok) {
      onDatabaseUpdate(await res.json());
      setStatusMsg('Site branding, descriptions, and Admin PIN updated live.');
    }
    setBusy(false);
  };

  const handleApplyColorSwatch = async (primaryColor: string, accentColor: string) => {
    const res = await fetch('/api/brand', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ primaryColor, accentColor }),
    });
    if (res.ok) {
      onDatabaseUpdate(await res.json());
      setStatusMsg('Brand color palette updated live.');
    }
  };

  const handlePatchLeague = async (lid: string, patch: Record<string, unknown>) => {
    const res = await fetch(`/api/leagues/${lid}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (res.ok) {
      onDatabaseUpdate(data);
      setStatusMsg('League & field configuration updated live.');
    } else {
      setStatusMsg(data.error || 'Could not update league');
    }
  };

  const openEditEverything = (lg: League) => {
    if (expandedEditLeagueId === lg.id) {
      setExpandedEditLeagueId('');
      return;
    }
    const ven = db.venues.find((v) => v.id === lg.venueId);
    setLeagueDrafts((prev) => ({
      ...prev,
      [lg.id]: {
        name: lg.name,
        city: lg.city || ven?.city || '',
        region: lg.region || ven?.region || '',
        country: lg.country || ven?.country || '',
        venueName: ven?.name || lg.locationName.split('·').pop()?.trim() || '',
        venueAddress: ven?.address || '',
        indoorOutdoor: ven?.indoorOutdoor || 'Outdoor Turf',
        venueFields: (ven?.fields || ['Turf 1']).join(', '),
        description: lg.description || '',
        rulesSummary: lg.rulesSummary || '',
        leagueType: lg.leagueType,
        status: lg.status,
        dayOfWeek: lg.dayOfWeek,
        format: lg.format,
        division: lg.division,
        skillLevel: lg.skillLevel,
        entryFeeTeam: lg.entryFeeTeam,
        entryFeeSolo: lg.entryFeeSolo,
        maxTeams: lg.maxTeams,
        gameWeeks: lg.gameWeeks,
        gamesPerWeek: lg.gamesPerWeek,
        gameDurationMins: lg.gameDurationMins,
        playoffMinGames: lg.playoffMinGames,
        transferDeadlineWeek: lg.transferDeadlineWeek,
        transferExtensionWeeks: lg.transferExtensionWeeks ?? 2,
        startDate: lg.startDate,
        matchTimeWindow: lg.matchTimeWindow || '7:00 PM – 10:00 PM',
        customPrizeText: lg.customPrizeText,
        imageUrl: lg.imageUrl,
        rosterMaxCap: lg.rosterMaxCap || 11,
        coedMaleCap: lg.coedMaleCap ?? 7,
        coedFemaleCap: lg.coedFemaleCap ?? 4,
        autoFlipEnabled: lg.autoFlipEnabled ?? false,
        deadlineHoursRemaining: lg.deadlineHoursRemaining ?? 72,
        dynamicPrizeScaling: lg.dynamicPrizeScaling,
        isPlayoffsActive: lg.isPlayoffsActive,
        rosterLocked: lg.rosterLocked,
        requireAdminTransferSignOff: lg.requireAdminTransferSignOff,
      },
    }));
    setExpandedEditLeagueId(lg.id);
  };

  const updateLeagueDraftField = (lid: string, key: string, val: string | number | boolean) => {
    setLeagueDrafts((prev) => ({
      ...prev,
      [lid]: {
        ...(prev[lid] || {}),
        [key]: val,
      },
    }));
  };

  const handlePatchMatch = async (m: Match) => {
    const draft = matchDrafts[m.id];
    if (!draft) return;
    const res = await fetch(`/api/matches/${m.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft),
    });
    if (res.ok) {
      onDatabaseUpdate(await res.json());
      setStatusMsg(`Updated fixture: ${m.homeTeamName} vs ${m.awayTeamName} (${draft.fieldNumber}).`);
    }
  };

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6 py-6 pb-24 space-y-6 lg:mx-0 lg:ml-[270px]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-400">
            {authRole === 'admin' ? `Administration · ${db.brand.siteName}` : 'Match Operations'}
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-white mt-0.5">
            {authRole === 'admin' ? 'Management Console' : 'Referee Console'}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {authRole === 'admin' && (
            <>
              <button
                type="button"
                onClick={async () => {
                  const res = await fetch('/api/admin/advance-cooldowns', { method: 'POST' });
                  if (res.ok) {
                    onDatabaseUpdate(await res.json());
                    setStatusMsg('All 3-day market cooldowns fast-forwarded.');
                  }
                }}
                className="min-h-[38px] inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-200 cursor-pointer"
              >
                <FastForward className="h-3.5 w-3.5 text-amber-400" />
                <span>Unlock Cooldowns</span>
              </button>
              <button
                type="button"
                onClick={async () => {
                  const res = await fetch('/api/reset-demo', { method: 'POST' });
                  if (res.ok) {
                    onDatabaseUpdate(await res.json());
                    setStatusMsg('Database reset to clean seed.');
                  }
                }}
                className="min-h-[38px] inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-200 cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Reset Seed</span>
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => {
              window.sessionStorage.removeItem('ball-out-admin-role');
              setAuthRole('none');
            }}
            className="min-h-[38px] inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Lock</span>
          </button>
        </div>
      </div>

      <aside className="admin-sidebar-scroll mb-6 max-h-[55vh] overflow-y-auto overscroll-contain rounded-2xl border border-white/10 bg-gradient-to-b from-[#111821] to-[#0D131A] p-4 lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:mb-0 lg:h-screen lg:max-h-none lg:w-[270px] lg:rounded-none lg:border-y-0 lg:border-l-0">
          <div className="flex items-center gap-3 border-b border-white/10 px-1 pb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-500/10 text-emerald-300">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-white">{db.brand.siteName}</div>
              <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                Admin workspace
              </div>
            </div>
          </div>

          <nav className="mt-5 space-y-5" aria-label="Admin sections">
            {navigationGroups.map((group) => (
              <div key={group.label}>
                <h2 className="mb-2 px-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                  {group.label}
                </h2>
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-1">
                  {group.items.map((item) => {
                    const isActive = section === item.id;
                    return (
                      <a
                        key={item.id}
                        href={item.id === 'leagues' ? '/admin' : `/admin/${item.id}`}
                        aria-current={isActive ? 'page' : undefined}
                        onClick={(event) => {
                          event.preventDefault();
                          navigateSection(item.id);
                        }}
                        className={`relative flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-xs font-semibold transition-colors cursor-pointer ${
                          isActive
                            ? 'border border-emerald-400/20 bg-emerald-500/10 text-emerald-200'
                            : 'border border-transparent text-slate-400 hover:border-white/10 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        {isActive && <span className="absolute inset-y-2 left-0 w-1 rounded-full bg-emerald-400" />}
                        <span
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                            isActive ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/5 text-slate-400'
                          }`}
                        >
                          {item.icon}
                        </span>
                        <span className="min-w-0 flex-1">{item.label}</span>
                        {'badge' in item && item.badge !== undefined && (
                          <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-[10px] font-mono-num text-slate-400">
                            {item.badge}
                          </span>
                        )}
                      </a>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          <div className="mt-5 border-t border-white/10 px-2 pt-4">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Signed in as
            </div>
            <div className="mt-1 text-xs font-semibold capitalize text-slate-300">{authRole}</div>
          </div>
          <a
            href="/"
            className="mt-4 flex min-h-10 items-center gap-2 rounded-xl border border-white/10 px-3 text-xs font-semibold text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
          >
            <ExternalLink className="h-4 w-4" />
            View public website
          </a>
      </aside>

        <div className="min-w-0 space-y-6">
          {statusMsg && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-300">
              {statusMsg}
            </div>
          )}

      {/* 1. MOBILE REFEREE SCOREKEEPER */}
      {section === 'referee' && (
        <div className="rounded-2xl border border-white/10 bg-[#111821] p-5 sm:p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl font-bold text-white">
                Pre-Kickoff Check-In & Mobile Scorekeeper
              </h2>
              <p className="text-xs text-slate-400">
                Blocks 4-game loan parent-club locks, red-card suspensions, and playoff anti-ringers.
              </p>
            </div>
            <select
              value={activeMatch?.id || ''}
              onChange={(e) => {
                setSelectedMatchId(e.target.value);
                setEvents([]);
                setLoanAppearanceIds([]);
              }}
              className="min-h-[42px] rounded-lg border border-white/15 bg-[#090D12] px-3 py-2 text-xs text-white"
            >
              {scheduledMatches.map((m) => (
                <option key={m.id} value={m.id}>
                  Wk {m.week}: {m.homeTeamName} vs {m.awayTeamName} · {m.fieldNumber}
                </option>
              ))}
            </select>
          </div>

          {!activeMatch || !activeMatchLeague ? (
            <div className="py-8 text-center text-sm text-slate-400">
              No scheduled matches pending. Generate a schedule in the Leagues tab.
            </div>
          ) : (
            <div className="space-y-6">
              <div className="rounded-xl border border-emerald-500/25 bg-[#090D12] px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-emerald-400">
                  Assigned Field: {activeMatch.fieldNumber}
                </span>
                <span className="font-mono-num text-amber-300">
                  {
                    computeMatchClockBreakdown(
                      activeMatch.scheduledTime,
                      activeMatch.firstHalfMins ?? 25,
                      activeMatch.halftimeMins ?? 5,
                      activeMatch.secondHalfMins ?? 25
                    ).timelineLabel
                  }
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { label: activeMatch.homeTeamName, teamId: activeMatch.homeTeamId, squad: homeSquad },
                  { label: activeMatch.awayTeamName, teamId: activeMatch.awayTeamId, squad: awaySquad },
                ].map((side) => (
                  <div key={side.teamId} className="rounded-xl border border-white/10 bg-[#090D12] p-4 space-y-2.5">
                    <div className="flex items-center justify-between border-b border-white/10 pb-2">
                      <span className="text-sm font-bold text-white">
                        {side.label} — Roster Check
                      </span>
                      {activeMatchLeague.division === 'Co-Ed' && (
                        <span className="text-[11px] font-semibold text-amber-300">
                          Female Rostered: {side.squad.filter((p) => p.gender === 'Female').length} (Min {db.championsCup.minFemaleOnField} on pitch)
                        </span>
                      )}
                    </div>
                    {side.squad.map((p) => {
                      const elig = getPlayerEligibilityForMatch(
                        p,
                        activeMatch,
                        side.teamId,
                        activeMatchLeague,
                        db.transfers
                      );
                      return (
                        <div key={`${side.teamId}_${p.id}`} className="flex items-center justify-between text-xs py-1">
                          <div>
                            <span className="font-semibold text-white">{p.name}</span>
                            <span className="text-slate-500 ml-1">({p.position} · {p.gamesPlayed} GP)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {elig.eligible ? (
                              <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                <span>{elig.status}</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-rose-400 font-semibold">
                                <Lock className="h-3.5 w-3.5" />
                                <span>{elig.status}</span>
                              </span>
                            )}
                            {elig.isLoanedIn && elig.eligible && (
                              <label className="inline-flex items-center gap-1 text-[11px] text-amber-300 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={loanAppearanceIds.includes(p.id)}
                                  onChange={(e) => {
                                    if (e.target.checked) setLoanAppearanceIds((prev) => [...prev, p.id]);
                                    else setLoanAppearanceIds((prev) => prev.filter((id) => id !== p.id));
                                  }}
                                />
                                <span>Played</span>
                              </label>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>

              <form onSubmit={handleSubmitMatch} className="rounded-xl border border-white/10 bg-[#090D12] p-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-300 mb-1">{activeMatch.homeTeamName}</label>
                    <input
                      type="number"
                      min={0}
                      value={homeScore}
                      onChange={(e) => setHomeScore(Number(e.target.value))}
                      className="w-full min-h-[46px] rounded-lg border border-white/15 bg-[#111821] text-center font-mono-num text-2xl font-bold text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-300 mb-1">{activeMatch.awayTeamName}</label>
                    <input
                      type="number"
                      min={0}
                      value={awayScore}
                      onChange={(e) => setAwayScore(Number(e.target.value))}
                      className="w-full min-h-[46px] rounded-lg border border-white/15 bg-[#111821] text-center font-mono-num text-2xl font-bold text-white"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <select
                    value={eventPlayerId}
                    onChange={(e) => setEventPlayerId(e.target.value)}
                    className="flex-1 min-w-[180px] rounded-lg border border-white/15 bg-[#111821] px-3 py-2 text-xs text-white"
                  >
                    <option value="">Log Goal / Card Player…</option>
                    {[...homeSquad, ...awaySquad].map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <select
                    value={eventType}
                    onChange={(e) => setEventType(e.target.value as 'Goal' | 'Yellow' | 'Red')}
                    className="rounded-lg border border-white/15 bg-[#111821] px-3 py-2 text-xs text-white"
                  >
                    <option value="Goal">Goal</option>
                    <option value="Yellow">Yellow Card</option>
                    <option value="Red">Red Card (Auto-Suspend)</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      const pl = [...homeSquad, ...awaySquad].find((p) => p.id === eventPlayerId);
                      if (!pl) return;
                      setEvents((prev) => [
                        ...prev,
                        { id: `ev_${Date.now()}`, playerId: pl.id, playerName: pl.name, teamId: pl.teamId, type: eventType },
                      ]);
                    }}
                    className="rounded-lg border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold text-white cursor-pointer"
                  >
                    Add
                  </button>
                </div>

                {events.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {events.map((ev) => (
                      <span key={ev.id} className="rounded bg-[#111821] border border-white/10 px-2.5 py-1 text-xs text-slate-200">
                        {ev.type}: {ev.playerName}
                      </span>
                    ))}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full min-h-[46px] rounded-lg bg-emerald-500 text-sm font-bold text-slate-950 cursor-pointer"
                >
                  Submit Official Match Result
                </button>
              </form>
            </div>
          )}
        </div>
      )}

      {/* 2. VISUAL SITE & BRAND CUSTOMIZER ("POINT & EDIT") */}
      {section === 'customizer' && authRole === 'admin' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form onSubmit={handleSaveBrand} className="lg:col-span-7 rounded-2xl border border-white/10 bg-[#111821] p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Palette className="h-5 w-5 text-emerald-400" />
              <h2 className="font-display text-2xl font-bold text-white">
                Visual Site & Brand Customizer
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-300 mb-1">Website / Brand Name</label>
                <input
                  type="text"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  className="w-full rounded-lg border border-white/15 bg-[#090D12] px-3 py-2 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">Admin Access PIN</label>
                <input
                  type="text"
                  value={brandPin}
                  onChange={(e) => setBrandPin(e.target.value)}
                  className="w-full rounded-lg border border-white/15 bg-[#090D12] px-3 py-2 text-sm font-mono text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">Hero Headline / Tagline</label>
              <input
                type="text"
                value={brandTagline}
                onChange={(e) => setBrandTagline(e.target.value)}
                className="w-full rounded-lg border border-white/15 bg-[#090D12] px-3 py-2 text-sm text-white"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">Homepage About Description</label>
              <textarea
                rows={2}
                value={brandAbout}
                onChange={(e) => setBrandAbout(e.target.value)}
                className="w-full rounded-lg border border-white/15 bg-[#090D12] px-3 py-2 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">Waiver & League Rules Summary</label>
              <textarea
                rows={2}
                value={brandRules}
                onChange={(e) => setBrandRules(e.target.value)}
                className="w-full rounded-lg border border-white/15 bg-[#090D12] px-3 py-2 text-xs text-white"
              />
            </div>

            <div className="rounded-xl border border-white/10 bg-[#090D12] p-4 space-y-2.5">
              <label className="flex items-center gap-2.5 text-xs font-semibold text-white cursor-pointer">
                <input
                  type="checkbox"
                  checked={brandBannerEnabled}
                  onChange={(e) => setBrandBannerEnabled(e.target.checked)}
                />
                <span>Show Site-Wide Pre-Season / Testing Banner</span>
              </label>
              <input
                type="text"
                value={brandBannerText}
                onChange={(e) => setBrandBannerText(e.target.value)}
                className="w-full rounded-lg border border-white/15 bg-[#111821] px-3 py-2 text-xs text-amber-200"
              />
            </div>

            <button
              type="submit"
              disabled={busy}
              className="min-h-[44px] rounded-lg bg-emerald-500 px-6 py-2 text-sm font-semibold text-slate-950 cursor-pointer"
            >
              Save Brand & Site Text Live
            </button>
          </form>

          <div className="lg:col-span-5 rounded-2xl border border-white/10 bg-[#111821] p-6 space-y-4 self-start">
            <h3 className="font-display text-xl font-bold text-white">One-Click Brand Color Swatches</h3>
            <p className="text-xs text-slate-400">
              Switch primary and accent colors across headers, buttons, and highlights instantly.
            </p>
            <div className="space-y-3">
              {[
                { name: 'Emerald Pitch & Trophy Gold (Default)', primary: '#10B981', accent: '#F59E0B' },
                { name: 'Electric Cyan & Obsidian', primary: '#06B6D4', accent: '#38BDF8' },
                { name: 'Matchday Lime & Amber', primary: '#84CC16', accent: '#FBBF24' },
                { name: 'Crimson Cup & Gold', primary: '#F43F5E', accent: '#F59E0B' },
              ].map((sw) => (
                <button
                  key={sw.name}
                  type="button"
                  onClick={() => handleApplyColorSwatch(sw.primary, sw.accent)}
                  className={`w-full rounded-xl border p-3.5 flex items-center justify-between text-left cursor-pointer ${
                    db.brand.primaryColor === sw.primary
                      ? 'border-white bg-white/10'
                      : 'border-white/10 bg-[#090D12] hover:border-white/25'
                  }`}
                >
                  <span className="text-xs font-semibold text-white">{sw.name}</span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-5 w-5 rounded" style={{ backgroundColor: sw.primary }} />
                    <span className="h-5 w-5 rounded" style={{ backgroundColor: sw.accent }} />
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 3. UNLIMITED LEAGUES, TOURNAMENTS, DUPLICATOR & PROFIT CALCULATOR */}
      {section === 'leagues' && authRole === 'admin' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-bold text-white">
                Leagues, Monthly Tournaments &amp; Profit Estimator
              </h2>
              <p className="text-xs text-slate-400">
                Admin creates and manages leagues only — players form, join, and manage their own teams directly in the League Hub &amp; Clubhouse.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowNewLeagueForm((p) => !p)}
              className="min-h-[42px] inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Create League or Monthly Cup</span>
            </button>
          </div>

          {showNewLeagueForm && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const fieldsArr = newLeagueVenueFields
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean);
                  const res = await fetch('/api/leagues', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      name: newLeagueName,
                      city: newLeagueCity,
                      region: newLeagueRegion,
                      country: newLeagueCountry,
                      venueName: newLeagueVenueName,
                      venueAddress: newLeagueVenueAddress,
                      indoorOutdoor: newLeagueIndoorOutdoor,
                      venueFields: fieldsArr.length > 0 ? fieldsArr : ['Turf 1'],
                      description: newLeagueDescription,
                      rulesSummary: newLeagueRules,
                      leagueType: newLeagueType,
                      status: 'TESTING',
                      dayOfWeek: newLeagueDay,
                      format: newLeagueFormat,
                      division: newLeagueDivision,
                      skillLevel: newLeagueSkill,
                      entryFeeTeam: newLeagueFeeTeam,
                      entryFeeSolo: newLeagueFeeSolo,
                      maxTeams: newLeagueMaxTeams,
                      gameWeeks: newLeagueGameWeeks,
                      gamesPerWeek: newLeagueGamesPerWeek,
                      startDate: newLeagueStartDate,
                      matchTimeWindow: newLeagueTimeWindow,
                      customPrizeText: newLeaguePrizeText,
                      dynamicPrizeScaling: newLeagueDynamicScaling,
                      prizeTiers: newLeagueDynamicScaling
                        ? [
                            { minTeams: 8, prizeLabel: '$500 Cash Prize', prizeAmount: 500 },
                            { minTeams: 10, prizeLabel: '$1,000+ Cash Prize', prizeAmount: 1000 },
                          ]
                        : [],
                    }),
                  });
                  const data = await res.json();
                  if (res.ok) {
                    onDatabaseUpdate(data);
                    setShowNewLeagueForm(false);
                    setNewLeagueName('');
                    setNewLeagueVenueName('');
                    setNewLeagueVenueAddress('');
                    setNewLeagueDescription('');
                    setStatusMsg(`Published "${newLeagueName}" at ${newLeagueVenueName} (${newLeagueCity}).`);
                  } else {
                    setStatusMsg(data.error || 'Could not create league');
                  }
                }}
                className="lg:col-span-7 rounded-2xl border border-emerald-500/30 bg-[#111821] p-6 space-y-4"
              >
                <h3 className="font-display text-xl font-bold text-white">
                  League & Manual Field Builder
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="text"
                    required
                    placeholder="League / Cup Name"
                    value={newLeagueName}
                    onChange={(e) => setNewLeagueName(e.target.value)}
                    className="sm:col-span-2 rounded-lg border border-white/15 bg-[#090D12] px-3 py-2 text-xs text-white"
                  />
                  <select
                    value={newLeagueType}
                    onChange={(e) => setNewLeagueType(e.target.value as LeagueType)}
                    className="rounded-lg border border-white/15 bg-[#090D12] px-3 py-2 text-xs text-white"
                  >
                    <option value="League">Regular League</option>
                    <option value="Tournament">Monthly Tournament</option>
                  </select>
                </div>

                {/* Manual City & Venue / Field Inputs (No Pre-Loaded Venue List) */}
                <div className="rounded-xl border border-white/10 bg-[#090D12] p-3.5 space-y-3">
                  <div className="text-[11px] font-semibold text-emerald-400">
                    Field &amp; Location Details (Type Manually — Editable Anytime)
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">City / Region *</label>
                      <input
                        type="text"
                        required
                        placeholder="Type City (e.g. Toronto, Ottawa, Etobicoke)"
                        value={newLeagueCity}
                        onChange={(e) => setNewLeagueCity(e.target.value)}
                        className="w-full rounded-lg border border-white/15 bg-[#111821] px-3 py-2 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">Province / State</label>
                      <input
                        type="text"
                        placeholder="e.g. Ontario, Alberta, New York"
                        value={newLeagueRegion}
                        onChange={(e) => setNewLeagueRegion(e.target.value)}
                        className="w-full rounded-lg border border-white/15 bg-[#111821] px-3 py-2 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">Country</label>
                      <input
                        type="text"
                        placeholder="e.g. Canada"
                        value={newLeagueCountry}
                        onChange={(e) => setNewLeagueCountry(e.target.value)}
                        className="w-full rounded-lg border border-white/15 bg-[#111821] px-3 py-2 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">Venue / Field / Dome Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="Type Field Name (e.g. Downsview Hangar)"
                        value={newLeagueVenueName}
                        onChange={(e) => setNewLeagueVenueName(e.target.value)}
                        className="w-full rounded-lg border border-white/15 bg-[#111821] px-3 py-2 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">Street Address / Location Notes</label>
                      <input
                        type="text"
                        placeholder="e.g. 75 Carl Hall Rd (Optional)"
                        value={newLeagueVenueAddress}
                        onChange={(e) => setNewLeagueVenueAddress(e.target.value)}
                        className="w-full rounded-lg border border-white/15 bg-[#111821] px-3 py-2 text-xs text-white"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-1">Environment</label>
                        <select
                          value={newLeagueIndoorOutdoor}
                          onChange={(e) => setNewLeagueIndoorOutdoor(e.target.value as Venue['indoorOutdoor'])}
                          className="w-full rounded-lg border border-white/15 bg-[#111821] px-2 py-2 text-xs text-white"
                        >
                          <option value="Outdoor Turf">Outdoor Turf</option>
                          <option value="Indoor Dome">Indoor Dome</option>
                          <option value="Outdoor Grass">Outdoor Grass</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-1">Pitch / Field #s (1–3+)</label>
                        <input
                          type="text"
                          value={newLeagueVenueFields}
                          onChange={(e) => setNewLeagueVenueFields(e.target.value)}
                          placeholder="Field 1, Field 2, Field 3"
                          className="w-full rounded-lg border border-white/15 bg-[#111821] px-2 py-2 text-xs text-white"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Day</label>
                    <select
                      value={newLeagueDay}
                      onChange={(e) => setNewLeagueDay(e.target.value as League['dayOfWeek'])}
                      className="w-full rounded-lg border border-white/15 bg-[#090D12] px-3 py-2 text-xs text-white"
                    >
                      {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Format</label>
                    <select
                      value={newLeagueFormat}
                      onChange={(e) => setNewLeagueFormat(e.target.value as LeagueFormat)}
                      className="w-full rounded-lg border border-white/15 bg-[#090D12] px-3 py-2 text-xs text-white"
                    >
                      {['5v5', '6v6', '7v7', '11v11'].map((f) => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Division</label>
                    <select
                      value={newLeagueDivision}
                      onChange={(e) => setNewLeagueDivision(e.target.value as LeagueDivision)}
                      className="w-full rounded-lg border border-white/15 bg-[#090D12] px-3 py-2 text-xs text-emerald-300 font-semibold"
                    >
                      <option value="Co-Ed">Co-Ed (Strictly Co-Ed)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Skill Tier</label>
                    <select
                      value={newLeagueSkill}
                      onChange={(e) => setNewLeagueSkill(e.target.value as SkillLevel)}
                      className="w-full rounded-lg border border-white/15 bg-[#090D12] px-3 py-2 text-xs text-white"
                    >
                      {['Recreational', 'Intermediate', 'Competitive', 'Premier'].map((sk) => (
                        <option key={sk} value={sk}>{sk}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Pricing Defaults ($250 Free Agent / $2,500 Full Team — Editable Anytime, No Deposits) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Full Team Price ($)</label>
                    <input
                      type="number"
                      min={0}
                      value={newLeagueFeeTeam}
                      onChange={(e) => setNewLeagueFeeTeam(Number(e.target.value))}
                      className="w-full rounded-lg border border-white/15 bg-[#090D12] px-3 py-2 text-xs font-mono-num text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Free Agent Price ($)</label>
                    <input
                      type="number"
                      min={0}
                      value={newLeagueFeeSolo}
                      onChange={(e) => setNewLeagueFeeSolo(Number(e.target.value))}
                      className="w-full rounded-lg border border-white/15 bg-[#090D12] px-3 py-2 text-xs font-mono-num text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Max Teams</label>
                    <input
                      type="number"
                      min={2}
                      value={newLeagueMaxTeams}
                      onChange={(e) => setNewLeagueMaxTeams(Number(e.target.value))}
                      className="w-full rounded-lg border border-white/15 bg-[#090D12] px-3 py-2 text-xs font-mono-num text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Game Weeks</label>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={newLeagueGameWeeks}
                      onChange={(e) => setNewLeagueGameWeeks(Number(e.target.value))}
                      className="w-full rounded-lg border border-white/15 bg-[#090D12] px-3 py-2 text-xs font-mono-num text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Games / Week</label>
                    <select
                      value={newLeagueGamesPerWeek}
                      onChange={(e) => setNewLeagueGamesPerWeek(Number(e.target.value) as 1 | 2)}
                      className="w-full rounded-lg border border-white/15 bg-[#090D12] px-3 py-2 text-xs text-white"
                    >
                      <option value={1}>1x / Week</option>
                      <option value={2}>2x / Week (Fast-Track)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Kickoff Date</label>
                    <input
                      type="text"
                      value={newLeagueStartDate}
                      onChange={(e) => setNewLeagueStartDate(e.target.value)}
                      className="w-full rounded-lg border border-white/15 bg-[#090D12] px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Time Window</label>
                    <input
                      type="text"
                      value={newLeagueTimeWindow}
                      onChange={(e) => setNewLeagueTimeWindow(e.target.value)}
                      className="w-full rounded-lg border border-white/15 bg-[#090D12] px-3 py-2 text-xs text-white"
                    />
                  </div>
                </div>

                <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
                  Auto-Calculated Timeline:{' '}
                  <strong>
                    {calculateSeasonDurationLabel(newLeagueGameWeeks, newLeagueGamesPerWeek, newLeagueType)}
                  </strong>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={newLeaguePrizeText}
                    onChange={(e) => setNewLeaguePrizeText(e.target.value)}
                    placeholder="Custom Cash Prize Text"
                    className="rounded-lg border border-white/15 bg-[#090D12] px-3 py-2 text-xs text-white"
                  />
                  <input
                    type="text"
                    value={newLeagueDescription}
                    onChange={(e) => setNewLeagueDescription(e.target.value)}
                    placeholder="Short League Description (Optional)"
                    className="rounded-lg border border-white/15 bg-[#090D12] px-3 py-2 text-xs text-white"
                  />
                </div>

                <div className="flex items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newLeagueDynamicScaling}
                      onChange={(e) => setNewLeagueDynamicScaling(e.target.checked)}
                    />
                    <span>Dynamic Team-Count Prize Scaling</span>
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowNewLeagueForm(false)}
                      className="rounded-lg border border-white/15 px-4 py-2 text-xs text-slate-300 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="rounded-lg bg-emerald-500 px-5 py-2 text-xs font-semibold text-slate-950 cursor-pointer"
                    >
                      Publish League
                    </button>
                  </div>
                </div>
              </form>

              {/* Built-In Profit & Prize Pool Estimator */}
              <div className="lg:col-span-5 rounded-2xl border border-amber-400/25 bg-[#111821] p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <Calculator className="h-5 w-5 text-amber-400" />
                  <h3 className="font-display text-xl font-bold text-white">
                    Profit & Prize Pool Estimator
                  </h3>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Turf Cost / Hr ($)</label>
                    <input
                      type="number"
                      value={calcTurfHourly}
                      onChange={(e) => setCalcTurfHourly(Number(e.target.value))}
                      className="w-full rounded-lg border border-white/15 bg-[#090D12] px-3 py-1.5 font-mono-num text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Hours / Game Week</label>
                    <input
                      type="number"
                      value={calcHoursPerWeek}
                      onChange={(e) => setCalcHoursPerWeek(Number(e.target.value))}
                      className="w-full rounded-lg border border-white/15 bg-[#090D12] px-3 py-1.5 font-mono-num text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Ref Cost / Game ($)</label>
                    <input
                      type="number"
                      value={calcRefPerGame}
                      onChange={(e) => setCalcRefPerGame(Number(e.target.value))}
                      className="w-full rounded-lg border border-white/15 bg-[#090D12] px-3 py-1.5 font-mono-num text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Planned Cash Prize ($)</label>
                    <input
                      type="number"
                      value={calcPlannedPrize}
                      onChange={(e) => setCalcPlannedPrize(Number(e.target.value))}
                      className="w-full rounded-lg border border-white/15 bg-[#090D12] px-3 py-1.5 font-mono-num text-white"
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-[#090D12] p-4 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Gross Team Revenue ({newLeagueMaxTeams} teams)</span>
                    <span className="font-mono-num font-bold text-white">${profitEst.grossRevenue}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Turf + Ref Costs ({profitEst.totalGames} games)</span>
                    <span className="font-mono-num text-rose-400">-${profitEst.totalOperatingCost}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Break-Even Point</span>
                    <span className="font-mono-num text-amber-300">{profitEst.breakEvenTeams} Teams</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Safe Max Cash Prize (45% Margin)</span>
                    <span className="font-mono-num text-emerald-400">${profitEst.safeMaxPrize}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-white/10 text-sm font-bold">
                    <span className="text-white">Estimated Net Profit</span>
                    <span className={`font-mono-num ${profitEst.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      ${profitEst.netProfit}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Manage Existing Leagues List + Full "Edit Everything" Inline Editor */}
          <div className="space-y-4">
            {db.leagues.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-[#111821] p-8 text-center space-y-3">
                <div className="font-display text-xl font-bold text-white">
                  No Active Leagues Created Yet
                </div>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Click &quot;Create League or Monthly Cup&quot; above to launch your first league, type your venue/field location manually, and customize the $250 Free Agent / $2,500 Full Team prices anytime.
                </p>
              </div>
            ) : (
              db.leagues.map((lg) => {
                const teamCnt = db.teams.filter((t) => t.leagueId === lg.id).length;
                const ven = db.venues.find((v) => v.id === lg.venueId);
                const isExpanded = expandedEditLeagueId === lg.id;
                const draft = leagueDrafts[lg.id] || {};
                const leagueMatches = db.matches.filter((m) => m.leagueId === lg.id);

                return (
                  <div
                    key={lg.id}
                    className="rounded-2xl border border-white/10 bg-[#111821] p-5 space-y-4"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-display text-xl font-bold text-white">{lg.name}</span>
                          <span className="text-xs text-slate-400">
                            ({lg.leagueType} · {teamCnt}/{lg.maxTeams} Teams · ${lg.entryFeeSolo} Solo / ${lg.entryFeeTeam} Team)
                          </span>
                        </div>
                        <div className="text-xs text-emerald-400 mt-0.5">
                          {lg.city || ven?.city} · {ven?.name || lg.locationName} ·{' '}
                          {calculateSeasonDurationLabel(lg.gameWeeks, lg.gamesPerWeek, lg.leagueType)} ·{' '}
                          {computeDynamicPrizeDisplay(lg, teamCnt).headlinePrize}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={lg.status}
                          onChange={(e) => handlePatchLeague(lg.id, { status: e.target.value as LeagueStatus })}
                          className="min-h-[38px] rounded-lg border border-amber-400/30 bg-[#090D12] px-3 py-1.5 text-xs font-semibold text-amber-300"
                        >
                          <option value="TESTING">TESTING / PRE-SEASON</option>
                          <option value="OPEN">OPEN</option>
                          <option value="LIVE">LIVE</option>
                          <option value="COMPLETED">COMPLETED</option>
                        </select>

                        <button
                          type="button"
                          onClick={() => openEditEverything(lg)}
                          className={`min-h-[38px] inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold cursor-pointer ${
                            isExpanded
                              ? 'border-emerald-500 bg-emerald-500 text-slate-950'
                              : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                          }`}
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          <span>{isExpanded ? 'Close Editor' : 'Edit Everything'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={async () => {
                            const res = await fetch(`/api/leagues/${lg.id}/duplicate`, { method: 'POST' });
                            if (res.ok) {
                              onDatabaseUpdate(await res.json());
                              setStatusMsg(`Duplicated "${lg.name}" in 1 click.`);
                            }
                          }}
                          className="min-h-[38px] inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10 cursor-pointer"
                        >
                          <Copy className="h-3.5 w-3.5" />
                          <span>Duplicate</span>
                        </button>

                        <button
                          type="button"
                          onClick={async () => {
                            const res = await fetch(`/api/leagues/${lg.id}/generate-schedule`, { method: 'POST' });
                            const data = await res.json();
                            if (res.ok) {
                              onDatabaseUpdate(data);
                              setStatusMsg(`Generated next week schedule for ${lg.name}.`);
                            } else {
                              setStatusMsg(data.error || 'Could not generate schedule');
                            }
                          }}
                          className="min-h-[38px] inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-950 cursor-pointer"
                        >
                          <Calendar className="h-3.5 w-3.5" />
                          <span>Gen Schedule</span>
                        </button>

                        <button
                          type="button"
                          title="Delete League"
                          onClick={async () => {
                            const res = await fetch(`/api/leagues/${lg.id}`, { method: 'DELETE' });
                            if (res.ok) {
                              onDatabaseUpdate(await res.json());
                              setStatusMsg(`Deleted league "${lg.name}".`);
                            }
                          }}
                          className="min-h-[38px] inline-flex items-center gap-1 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-xs text-rose-300 hover:bg-rose-500/20 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Quick Inline Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2 border-t border-white/10 text-xs">
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-1">Full Team Price ($)</label>
                        <input
                          type="number"
                          min={0}
                          defaultValue={lg.entryFeeTeam}
                          onBlur={(e) => handlePatchLeague(lg.id, { entryFeeTeam: Number(e.target.value) })}
                          className="w-full rounded-lg border border-white/15 bg-[#090D12] px-3 py-1.5 font-mono-num text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-1">Free Agent Price ($)</label>
                        <input
                          type="number"
                          min={0}
                          defaultValue={lg.entryFeeSolo}
                          onBlur={(e) => handlePatchLeague(lg.id, { entryFeeSolo: Number(e.target.value) })}
                          className="w-full rounded-lg border border-white/15 bg-[#090D12] px-3 py-1.5 font-mono-num text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-1">Custom Cash Prize Label</label>
                        <input
                          type="text"
                          defaultValue={lg.customPrizeText}
                          onBlur={(e) => handlePatchLeague(lg.id, { customPrizeText: e.target.value })}
                          className="w-full rounded-lg border border-white/15 bg-[#090D12] px-3 py-1.5 text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-1">Kickoff Date / Window</label>
                        <input
                          type="text"
                          defaultValue={lg.startDate}
                          onBlur={(e) => handlePatchLeague(lg.id, { startDate: e.target.value })}
                          className="w-full rounded-lg border border-white/15 bg-[#090D12] px-3 py-1.5 text-white"
                        />
                      </div>
                    </div>

                    {/* Full "Edit Everything" Expanded Panel (Title, Field Name, City, Address, Fields, Pricing, Rules, Caps) */}
                    {isExpanded && (
                      <form
                        onSubmit={async (e) => {
                          e.preventDefault();
                          const fieldsArr = String(draft.venueFields || '')
                            .split(',')
                            .map((s) => s.trim())
                            .filter(Boolean);
                          await handlePatchLeague(lg.id, {
                            ...draft,
                            entryFeeTeam: Number(draft.entryFeeTeam),
                            entryFeeSolo: Number(draft.entryFeeSolo),
                            maxTeams: Number(draft.maxTeams),
                            gameWeeks: Number(draft.gameWeeks),
                            gamesPerWeek: Number(draft.gamesPerWeek) === 2 ? 2 : 1,
                            gameDurationMins: Number(draft.gameDurationMins),
                            playoffMinGames: Number(draft.playoffMinGames),
                            transferDeadlineWeek: Number(draft.transferDeadlineWeek),
                            transferExtensionWeeks: Math.max(0, Number(draft.transferExtensionWeeks)),
                            rosterMaxCap: Number(draft.rosterMaxCap),
                            coedMaleCap: Number(draft.coedMaleCap),
                            coedFemaleCap: Number(draft.coedFemaleCap),
                            deadlineHoursRemaining: Number(draft.deadlineHoursRemaining),
                            venueFields: fieldsArr.length > 0 ? fieldsArr : ['Turf 1'],
                          });
                        }}
                        className="rounded-xl border border-emerald-500/30 bg-[#090D12] p-4 sm:p-5 space-y-4 text-xs"
                      >
                        <div className="flex items-center justify-between border-b border-white/10 pb-2">
                          <span className="font-bold text-emerald-400">
                            Edit Everything — Title, Field Name, Location, Pricing, Rules &amp; Caps
                          </span>
                          <button
                            type="submit"
                            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-1.5 font-bold text-slate-950 cursor-pointer"
                          >
                            <Save className="h-3.5 w-3.5" />
                            <span>Save All Changes</span>
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="sm:col-span-2">
                            <label className="block text-[10px] text-slate-400 mb-1">League Title</label>
                            <input
                              type="text"
                              value={String(draft.name ?? '')}
                              onChange={(e) => updateLeagueDraftField(lg.id, 'name', e.target.value)}
                              className="w-full rounded-lg border border-white/15 bg-[#111821] px-3 py-1.5 text-white font-semibold"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-400 mb-1">Event Type</label>
                            <select
                              value={String(draft.leagueType ?? 'League')}
                              onChange={(e) => updateLeagueDraftField(lg.id, 'leagueType', e.target.value)}
                              className="w-full rounded-lg border border-white/15 bg-[#111821] px-3 py-1.5 text-white"
                            >
                              <option value="League">Regular League</option>
                              <option value="Tournament">Monthly Tournament</option>
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                          <div>
                            <label className="block text-[10px] text-amber-300 mb-1">City / Region</label>
                            <input
                              type="text"
                              value={String(draft.city ?? '')}
                              onChange={(e) => updateLeagueDraftField(lg.id, 'city', e.target.value)}
                              className="w-full rounded-lg border border-white/15 bg-[#111821] px-3 py-1.5 text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-amber-300 mb-1">Province / State</label>
                            <input
                              type="text"
                              value={String(draft.region ?? '')}
                              onChange={(e) => updateLeagueDraftField(lg.id, 'region', e.target.value)}
                              className="w-full rounded-lg border border-white/15 bg-[#111821] px-3 py-1.5 text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-amber-300 mb-1">Country</label>
                            <input
                              type="text"
                              value={String(draft.country ?? '')}
                              onChange={(e) => updateLeagueDraftField(lg.id, 'country', e.target.value)}
                              className="w-full rounded-lg border border-white/15 bg-[#111821] px-3 py-1.5 text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-amber-300 mb-1">Field / Venue Name</label>
                            <input
                              type="text"
                              value={String(draft.venueName ?? '')}
                              onChange={(e) => updateLeagueDraftField(lg.id, 'venueName', e.target.value)}
                              className="w-full rounded-lg border border-white/15 bg-[#111821] px-3 py-1.5 text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-amber-300 mb-1">Venue Location / Address</label>
                            <input
                              type="text"
                              value={String(draft.venueAddress ?? '')}
                              onChange={(e) => updateLeagueDraftField(lg.id, 'venueAddress', e.target.value)}
                              className="w-full rounded-lg border border-white/15 bg-[#111821] px-3 py-1.5 text-white"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] text-slate-400 mb-1">Type</label>
                              <select
                                value={String(draft.indoorOutdoor ?? 'Outdoor Turf')}
                                onChange={(e) => updateLeagueDraftField(lg.id, 'indoorOutdoor', e.target.value)}
                                className="w-full rounded-lg border border-white/15 bg-[#111821] px-2 py-1.5 text-white"
                              >
                                <option value="Outdoor Turf">Outdoor Turf</option>
                                <option value="Indoor Dome">Indoor Dome</option>
                                <option value="Outdoor Grass">Outdoor Grass</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-[10px] text-slate-400 mb-1">Pitches</label>
                              <input
                                type="text"
                                value={String(draft.venueFields ?? '')}
                                onChange={(e) => updateLeagueDraftField(lg.id, 'venueFields', e.target.value)}
                                className="w-full rounded-lg border border-white/15 bg-[#111821] px-2 py-1.5 text-white"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div>
                            <label className="block text-[10px] text-slate-400 mb-1">Day of Week</label>
                            <select
                              value={String(draft.dayOfWeek ?? 'Sunday')}
                              onChange={(e) => updateLeagueDraftField(lg.id, 'dayOfWeek', e.target.value)}
                              className="w-full rounded-lg border border-white/15 bg-[#111821] px-3 py-1.5 text-white"
                            >
                              {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((d) => (
                                <option key={d} value={d}>{d}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-400 mb-1">Format</label>
                            <select
                              value={String(draft.format ?? '7v7')}
                              onChange={(e) => updateLeagueDraftField(lg.id, 'format', e.target.value)}
                              className="w-full rounded-lg border border-white/15 bg-[#111821] px-3 py-1.5 text-white"
                            >
                              {['5v5', '6v6', '7v7', '11v11'].map((f) => <option key={f} value={f}>{f}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-400 mb-1">Division</label>
                            <select
                              value="Co-Ed"
                              onChange={() => updateLeagueDraftField(lg.id, 'division', 'Co-Ed')}
                              className="w-full rounded-lg border border-white/15 bg-[#111821] px-3 py-1.5 text-emerald-300 font-semibold"
                            >
                              <option value="Co-Ed">Co-Ed (Co-Ed Only)</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-400 mb-1">Skill Tier</label>
                            <select
                              value={String(draft.skillLevel ?? 'Competitive')}
                              onChange={(e) => updateLeagueDraftField(lg.id, 'skillLevel', e.target.value)}
                              className="w-full rounded-lg border border-white/15 bg-[#111821] px-3 py-1.5 text-white"
                            >
                              {['Recreational', 'Intermediate', 'Competitive', 'Premier'].map((s) => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                          <div>
                            <label className="block text-[10px] text-slate-400 mb-1">Full Team ($)</label>
                            <input
                              type="number"
                              min={0}
                              value={Number(draft.entryFeeTeam ?? 2500)}
                              onChange={(e) => updateLeagueDraftField(lg.id, 'entryFeeTeam', Number(e.target.value))}
                              className="w-full rounded-lg border border-white/15 bg-[#111821] px-2.5 py-1.5 font-mono-num text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-400 mb-1">Free Agent ($)</label>
                            <input
                              type="number"
                              min={0}
                              value={Number(draft.entryFeeSolo ?? 250)}
                              onChange={(e) => updateLeagueDraftField(lg.id, 'entryFeeSolo', Number(e.target.value))}
                              className="w-full rounded-lg border border-white/15 bg-[#111821] px-2.5 py-1.5 font-mono-num text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-400 mb-1">Max Teams</label>
                            <input
                              type="number"
                              min={2}
                              value={Number(draft.maxTeams ?? 10)}
                              onChange={(e) => updateLeagueDraftField(lg.id, 'maxTeams', Number(e.target.value))}
                              className="w-full rounded-lg border border-white/15 bg-[#111821] px-2.5 py-1.5 font-mono-num text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-400 mb-1">Game Weeks</label>
                            <input
                              type="number"
                              min={1}
                              value={Number(draft.gameWeeks ?? 15)}
                              onChange={(e) => updateLeagueDraftField(lg.id, 'gameWeeks', Number(e.target.value))}
                              className="w-full rounded-lg border border-white/15 bg-[#111821] px-2.5 py-1.5 font-mono-num text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-400 mb-1">Games / Wk</label>
                            <select
                              value={Number(draft.gamesPerWeek ?? 1)}
                              onChange={(e) => updateLeagueDraftField(lg.id, 'gamesPerWeek', Number(e.target.value))}
                              className="w-full rounded-lg border border-white/15 bg-[#111821] px-2 py-1.5 text-white"
                            >
                              <option value={1}>1x / wk</option>
                              <option value={2}>2x / wk</option>
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
                          <div>
                            <label className="block text-[10px] text-slate-400 mb-1">Clock (Mins · 25/5/25)</label>
                            <input
                              type="number"
                              min={20}
                              value={Number(draft.gameDurationMins ?? 55)}
                              onChange={(e) => updateLeagueDraftField(lg.id, 'gameDurationMins', Number(e.target.value))}
                              className="w-full rounded-lg border border-white/15 bg-[#111821] px-2.5 py-1.5 font-mono-num text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-400 mb-1">Playoff Min GP</label>
                            <input
                              type="number"
                              min={0}
                              value={Number(draft.playoffMinGames ?? 2)}
                              onChange={(e) => updateLeagueDraftField(lg.id, 'playoffMinGames', Number(e.target.value))}
                              className="w-full rounded-lg border border-white/15 bg-[#111821] px-2.5 py-1.5 font-mono-num text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-400 mb-1">Max Roster</label>
                            <input
                              type="number"
                              min={5}
                              value={Number(draft.rosterMaxCap ?? 11)}
                              onChange={(e) => updateLeagueDraftField(lg.id, 'rosterMaxCap', Number(e.target.value))}
                              className="w-full rounded-lg border border-white/15 bg-[#111821] px-2.5 py-1.5 font-mono-num text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-400 mb-1">Co-Ed M Cap</label>
                            <input
                              type="number"
                              min={0}
                              value={Number(draft.coedMaleCap ?? 7)}
                              onChange={(e) => updateLeagueDraftField(lg.id, 'coedMaleCap', Number(e.target.value))}
                              className="w-full rounded-lg border border-white/15 bg-[#111821] px-2.5 py-1.5 font-mono-num text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-400 mb-1">Co-Ed F Cap</label>
                            <input
                              type="number"
                              min={0}
                              value={Number(draft.coedFemaleCap ?? 4)}
                              onChange={(e) => updateLeagueDraftField(lg.id, 'coedFemaleCap', Number(e.target.value))}
                              className="w-full rounded-lg border border-white/15 bg-[#111821] px-2.5 py-1.5 font-mono-num text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-400 mb-1">Flip Hrs Left</label>
                            <input
                              type="number"
                              min={0}
                              value={Number(draft.deadlineHoursRemaining ?? 72)}
                              onChange={(e) => updateLeagueDraftField(lg.id, 'deadlineHoursRemaining', Number(e.target.value))}
                              className="w-full rounded-lg border border-white/15 bg-[#111821] px-2.5 py-1.5 font-mono-num text-white"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                          <div>
                            <label className="block text-[10px] text-slate-400 mb-1">Transfer Window Ends (Week)</label>
                            <input
                              type="number"
                              min={1}
                              value={Number(draft.transferDeadlineWeek ?? 1)}
                              onChange={(e) => updateLeagueDraftField(lg.id, 'transferDeadlineWeek', Number(e.target.value))}
                              className="w-full rounded-lg border border-white/15 bg-[#111821] px-3 py-1.5 text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-400 mb-1">Rank 8th–10th Extension (Weeks)</label>
                            <input
                              type="number"
                              min={0}
                              value={Number(draft.transferExtensionWeeks ?? 2)}
                              onChange={(e) => updateLeagueDraftField(lg.id, 'transferExtensionWeeks', Number(e.target.value))}
                              className="w-full rounded-lg border border-white/15 bg-[#111821] px-3 py-1.5 text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-400 mb-1">Kickoff Date</label>
                            <input
                              type="text"
                              value={String(draft.startDate ?? '')}
                              onChange={(e) => updateLeagueDraftField(lg.id, 'startDate', e.target.value)}
                              className="w-full rounded-lg border border-white/15 bg-[#111821] px-3 py-1.5 text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-400 mb-1">Match Time Window</label>
                            <input
                              type="text"
                              value={String(draft.matchTimeWindow ?? '')}
                              onChange={(e) => updateLeagueDraftField(lg.id, 'matchTimeWindow', e.target.value)}
                              className="w-full rounded-lg border border-white/15 bg-[#111821] px-3 py-1.5 text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-400 mb-1">Banner Image URL</label>
                            <input
                              type="text"
                              value={String(draft.imageUrl ?? '')}
                              onChange={(e) => updateLeagueDraftField(lg.id, 'imageUrl', e.target.value)}
                              className="w-full rounded-lg border border-white/15 bg-[#111821] px-3 py-1.5 text-white"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] text-slate-400 mb-1">Description</label>
                            <textarea
                              rows={2}
                              value={String(draft.description ?? '')}
                              onChange={(e) => updateLeagueDraftField(lg.id, 'description', e.target.value)}
                              className="w-full rounded-lg border border-white/15 bg-[#111821] px-3 py-1.5 text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-400 mb-1">League Rules Summary</label>
                            <textarea
                              rows={2}
                              value={String(draft.rulesSummary ?? '')}
                              onChange={(e) => updateLeagueDraftField(lg.id, 'rulesSummary', e.target.value)}
                              className="w-full rounded-lg border border-white/15 bg-[#111821] px-3 py-1.5 text-white"
                            />
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-4 pt-1">
                          {[
                            { key: 'dynamicPrizeScaling', label: 'Dynamic Prize Scaling' },
                            { key: 'isPlayoffsActive', label: 'Playoffs Active' },
                            { key: 'autoFlipEnabled', label: 'Co-Ed 4M/7F Auto-Flip' },
                            { key: 'rosterLocked', label: 'Lock Rosters' },
                            { key: 'requireAdminTransferSignOff', label: 'Admin Transfer Sign-Off' },
                          ].map((chk) => (
                            <label key={chk.key} className="flex items-center gap-1.5 text-slate-200 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={Boolean(draft[chk.key])}
                                onChange={(e) => updateLeagueDraftField(lg.id, chk.key, e.target.checked)}
                              />
                              <span>{chk.label}</span>
                            </label>
                          ))}
                        </div>

                        {/* Inline Match Field, Date & Time Editor */}
                        {leagueMatches.length > 0 && (
                          <div className="pt-3 border-t border-white/10 space-y-2">
                            <div className="text-[11px] font-bold text-amber-300">
                              Edit Scheduled Match Fields, Dates &amp; Kickoff Times
                            </div>
                            <div className="space-y-2 max-h-60 overflow-y-auto">
                              {leagueMatches.map((m) => {
                                const md = matchDrafts[m.id] || {
                                  fieldNumber: m.fieldNumber,
                                  scheduledDate: m.scheduledDate,
                                  scheduledTime: m.scheduledTime,
                                };
                                return (
                                  <div
                                    key={m.id}
                                    className="grid grid-cols-1 sm:grid-cols-6 gap-2 items-center rounded-lg border border-white/10 bg-[#111821] p-2"
                                  >
                                    <span className="sm:col-span-2 font-semibold text-white truncate">
                                      Wk {m.week}: {m.homeTeamName} vs {m.awayTeamName}
                                    </span>
                                    <input
                                      type="text"
                                      value={md.fieldNumber}
                                      onChange={(e) =>
                                        setMatchDrafts((p) => ({
                                          ...p,
                                          [m.id]: { ...md, fieldNumber: e.target.value },
                                        }))
                                      }
                                      placeholder="Field / Pitch"
                                      className="rounded border border-white/15 bg-[#090D12] px-2 py-1 text-white"
                                    />
                                    <input
                                      type="text"
                                      value={md.scheduledDate}
                                      onChange={(e) =>
                                        setMatchDrafts((p) => ({
                                          ...p,
                                          [m.id]: { ...md, scheduledDate: e.target.value },
                                        }))
                                      }
                                      placeholder="Date"
                                      className="rounded border border-white/15 bg-[#090D12] px-2 py-1 text-white"
                                    />
                                    <input
                                      type="text"
                                      value={md.scheduledTime}
                                      onChange={(e) =>
                                        setMatchDrafts((p) => ({
                                          ...p,
                                          [m.id]: { ...md, scheduledTime: e.target.value },
                                        }))
                                      }
                                      placeholder="Time"
                                      className="rounded border border-white/15 bg-[#090D12] px-2 py-1 text-white"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handlePatchMatch(m)}
                                      className="rounded bg-amber-400 px-2.5 py-1 font-semibold text-slate-950 cursor-pointer"
                                    >
                                      Save Match
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </form>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* 3B. CO-ED CHAMPION OF CHAMPIONS SUPER CUP MANAGER */}
      {section === 'supercup' && authRole === 'admin' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Link Divisions & Rules */}
            <div className="lg:col-span-7 rounded-2xl border border-white/10 bg-[#111821] p-6 space-y-5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-amber-400" />
                  <h2 className="font-display text-2xl font-bold text-white">
                    Champion of Champions Super Cup Controls
                  </h2>
                </div>
                <label className="flex items-center gap-2 text-xs font-semibold text-emerald-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={db.championsCup.enabled}
                    onChange={async (e) => {
                      const r = await fetch('/api/super-cup', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ enabled: e.target.checked }),
                      });
                      if (r.ok) {
                        onDatabaseUpdate(await r.json());
                        setStatusMsg(`Super Cup tracker ${e.target.checked ? 'enabled' : 'hidden'} on homepage.`);
                      }
                    }}
                  />
                  <span>Show on Homepage</span>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Cup Title</label>
                  <input
                    type="text"
                    value={cupName}
                    onChange={(e) => setCupName(e.target.value)}
                    className="w-full rounded-lg border border-white/15 bg-[#090D12] px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Season Label</label>
                  <input
                    type="text"
                    value={cupSeasonLabel}
                    onChange={(e) => setCupSeasonLabel(e.target.value)}
                    className="w-full rounded-lg border border-white/15 bg-[#090D12] px-3 py-2 text-white"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Bonus Cash Prize & Free Entry Reward
                  </label>
                  <input
                    type="text"
                    value={cupBonusPrize}
                    onChange={(e) => setCupBonusPrize(e.target.value)}
                    className="w-full rounded-lg border border-white/15 bg-[#090D12] px-3 py-2 text-amber-300 font-semibold"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={async () => {
                  const r = await fetch('/api/super-cup', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      name: cupName,
                      seasonLabel: cupSeasonLabel,
                      bonusPrizeText: cupBonusPrize,
                    }),
                  });
                  if (r.ok) {
                    onDatabaseUpdate(await r.json());
                    setStatusMsg('Super Cup title & bonus cash prize saved.');
                  }
                }}
                className="min-h-[40px] rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 cursor-pointer"
              >
                Save Cup Title & Prize
              </button>

              {/* Co-Ed Gender Ratio & Anti-Ringer Rules */}
              <div className="rounded-xl border border-white/10 bg-[#090D12] p-4 space-y-3 text-xs">
                <div className="font-semibold text-white">Co-Ed Fair-Play & Anti-Ringer Rules</div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label className="flex items-center gap-2 text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={db.championsCup.enforceGenderRatio}
                      onChange={async (e) => {
                        const r = await fetch('/api/super-cup', {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ enforceGenderRatio: e.target.checked }),
                        });
                        if (r.ok) onDatabaseUpdate(await r.json());
                      }}
                    />
                    <span>Enforce On-Field Co-Ed Gender Ratio</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">Min Female on Pitch:</span>
                    <select
                      value={db.championsCup.minFemaleOnField}
                      onChange={async (e) => {
                        const r = await fetch('/api/super-cup', {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ minFemaleOnField: Number(e.target.value) }),
                        });
                        if (r.ok) onDatabaseUpdate(await r.json());
                      }}
                      className="rounded border border-white/15 bg-[#111821] px-2.5 py-1 text-white font-mono-num"
                    >
                      <option value={1}>1 Female</option>
                      <option value={2}>2 Females</option>
                      <option value={3}>3 Females</option>
                    </select>
                  </div>
                </div>

                <label className="flex items-center gap-2 text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={db.championsCup.lockRostersToRegularSeason}
                    onChange={async (e) => {
                      const r = await fetch('/api/super-cup', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ lockRostersToRegularSeason: e.target.checked }),
                      });
                      if (r.ok) onDatabaseUpdate(await r.json());
                    }}
                  />
                  <span>
                    Lock Cup Rosters to Regular-Season Squads (Min {db.championsCup.minRegularSeasonGames} GP · Blocks Outside Ringers)
                  </span>
                </label>
              </div>

              {/* Link Any Leagues */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white">
                    Linked Leagues ({db.championsCup.linkedLeagueIds.length} Selected — Auto-Scales Bracket)
                  </span>
                  <button
                    type="button"
                    onClick={async () => {
                      const r = await fetch('/api/super-cup/generate-bracket', { method: 'POST' });
                      if (r.ok) {
                        onDatabaseUpdate(await r.json());
                        setStatusMsg('Auto-scaled knockout bracket refreshed from latest division leaders.');
                      }
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 text-xs font-semibold text-amber-300 cursor-pointer"
                  >
                    <GitBranch className="h-3.5 w-3.5" />
                    <span>Refresh Bracket</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {db.leagues.map((lg) => {
                    const linked = db.championsCup.linkedLeagueIds.includes(lg.id);
                    return (
                      <label
                        key={lg.id}
                        className={`flex items-center justify-between rounded-xl border p-3 text-xs cursor-pointer ${
                          linked
                            ? 'border-emerald-500/40 bg-emerald-500/10 text-white'
                            : 'border-white/10 bg-[#090D12] text-slate-300'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={linked}
                            onChange={async (e) => {
                              const nextIds = e.target.checked
                                ? [...db.championsCup.linkedLeagueIds, lg.id]
                                : db.championsCup.linkedLeagueIds.filter((id) => id !== lg.id);
                              const r = await fetch('/api/super-cup', {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ linkedLeagueIds: nextIds }),
                              });
                              if (r.ok) {
                                onDatabaseUpdate(await r.json());
                                setStatusMsg(
                                  `Super Cup updated to ${nextIds.length} division${nextIds.length === 1 ? '' : 's'} — bracket auto-scaled.`
                                );
                              }
                            }}
                          />
                          <span>{lg.name}</span>
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {lg.dayOfWeek.slice(0, 3)} · {lg.division}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Live Seeds + Score Advancement */}
            <div className="lg:col-span-5 space-y-4">
              <div className="rounded-2xl border border-white/10 bg-[#111821] p-6 space-y-3">
                <h3 className="font-display text-xl font-bold text-white">
                  Current Automatic Division Seeds
                </h3>
                <div className="divide-y divide-white/10 text-xs">
                  {computeChampionsCupSeeds(
                    db.championsCup.linkedLeagueIds,
                    db.leagues,
                    db.teams,
                    db.matches
                  ).map((sd) => {
                    const comp = checkCoEdTeamCompliance(sd.teamId, db.players, db.championsCup);
                    return (
                      <div key={sd.leagueId} className="py-2.5 flex items-center justify-between gap-2">
                        <div>
                          <div className="font-semibold text-white">
                            #{sd.seed} {sd.teamName}{' '}
                            <span className="text-slate-400 font-normal">({sd.divisionDay})</span>
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {sd.pts} PTS · GD {sd.gd >= 0 ? `+${sd.gd}` : sd.gd} · Female Eligible:{' '}
                            <span className={comp.meetsGenderRatio ? 'text-emerald-400' : 'text-rose-400'}>
                              {comp.femaleEligibleCount}/{db.championsCup.minFemaleOnField}
                            </span>
                          </div>
                        </div>
                        <span className="font-mono-num text-amber-300 font-semibold">Seed #{sd.seed}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-amber-400/25 bg-[#111821] p-6 space-y-3">
                <h3 className="font-display text-xl font-bold text-white">
                  Score & Advance Cup Knockout Matches
                </h3>
                {db.championsCup.matches.length === 0 ? (
                  <p className="text-xs text-slate-400">Link at least 2 leagues to generate the knockout bracket.</p>
                ) : (
                  <div className="space-y-3">
                    {db.championsCup.matches.map((cm) => {
                      const canScore =
                        cm.status !== 'Final' &&
                        !cm.homeTeamId.startsWith('TBD_') &&
                        !cm.awayTeamId.startsWith('TBD_');
                      const sc = cupScores[cm.id] || { home: 2, away: 1 };
                      return (
                        <div key={cm.id} className="rounded-xl border border-white/10 bg-[#090D12] p-3.5 text-xs space-y-2">
                          <div className="flex justify-between text-slate-400">
                            <span className="font-semibold text-amber-300">{cm.bracketSlot}</span>
                            <span>{cm.status}</span>
                          </div>
                          <div className="font-semibold text-white">
                            {cm.homeTeamName} vs {cm.awayTeamName}
                          </div>
                          {cm.status === 'Final' ? (
                            <div className="font-mono-num text-emerald-400 font-bold">
                              Final Score: {cm.homeScore} — {cm.awayScore}
                            </div>
                          ) : canScore ? (
                            <div className="flex items-center gap-2 pt-1">
                              <input
                                type="number"
                                min={0}
                                value={sc.home}
                                onChange={(e) =>
                                  setCupScores((p) => ({
                                    ...p,
                                    [cm.id]: { ...sc, home: Number(e.target.value) },
                                  }))
                                }
                                className="w-14 rounded border border-white/15 bg-[#111821] px-2 py-1 text-center font-mono-num text-white"
                              />
                              <span className="text-slate-500">—</span>
                              <input
                                type="number"
                                min={0}
                                value={sc.away}
                                onChange={(e) =>
                                  setCupScores((p) => ({
                                    ...p,
                                    [cm.id]: { ...sc, away: Number(e.target.value) },
                                  }))
                                }
                                className="w-14 rounded border border-white/15 bg-[#111821] px-2 py-1 text-center font-mono-num text-white"
                              />
                              <button
                                type="button"
                                onClick={async () => {
                                  const r = await fetch(`/api/super-cup/matches/${cm.id}/result`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ homeScore: sc.home, awayScore: sc.away }),
                                  });
                                  const data = await r.json();
                                  if (r.ok) {
                                    onDatabaseUpdate(data);
                                    setStatusMsg(`${cm.bracketSlot} finalized & winner advanced.`);
                                  } else {
                                    setStatusMsg(data.error || 'Could not save Cup match');
                                  }
                                }}
                                className="flex-1 rounded-lg bg-emerald-500 px-3 py-1.5 font-semibold text-slate-950 cursor-pointer"
                              >
                                Finalize & Advance
                              </button>
                            </div>
                          ) : (
                            <div className="text-[11px] text-slate-500">Awaiting earlier round winner</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. STAFF, COO & PARTNER MANAGER */}
      {section === 'staff' && authRole === 'admin' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Staff & Roles */}
          <div className="rounded-2xl border border-white/10 bg-[#111821] p-6 space-y-4">
            <div className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-emerald-400" />
              <h2 className="font-display text-xl font-bold text-white">
                Staff, COO & Role Invite Manager
              </h2>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const res = await fetch('/api/staff', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    name: staffName,
                    email: staffEmail,
                    role: staffRole,
                    permissions: staffPerms.split(',').map((s) => s.trim()).filter(Boolean),
                  }),
                });
                if (res.ok) {
                  onDatabaseUpdate(await res.json());
                  setStaffName('');
                  setStaffEmail('');
                  setStatusMsg('Staff invite generated.');
                }
              }}
              className="space-y-2.5 rounded-xl border border-white/10 bg-[#090D12] p-4"
            >
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  required
                  placeholder="Staff Name"
                  value={staffName}
                  onChange={(e) => setStaffName(e.target.value)}
                  className="rounded-lg border border-white/15 bg-[#111821] px-3 py-2 text-xs text-white"
                />
                <input
                  type="email"
                  required
                  placeholder="Email"
                  value={staffEmail}
                  onChange={(e) => setStaffEmail(e.target.value)}
                  className="rounded-lg border border-white/15 bg-[#111821] px-3 py-2 text-xs text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={staffRole}
                  onChange={(e) => setStaffRole(e.target.value as StaffMember['role'])}
                  className="rounded-lg border border-white/15 bg-[#111821] px-3 py-2 text-xs text-white"
                >
                  <option value="COO">COO (Chief Operating Officer)</option>
                  <option value="League Manager">League Manager</option>
                  <option value="Referee / Scorekeeper">Referee / Scorekeeper</option>
                  <option value="Worker / Field Staff">Worker / Field Staff</option>
                  <option value="Founder / Super Admin">Founder / Super Admin</option>
                </select>
                <input
                  type="text"
                  placeholder="Permissions (comma-separated)"
                  value={staffPerms}
                  onChange={(e) => setStaffPerms(e.target.value)}
                  className="rounded-lg border border-white/15 bg-[#111821] px-3 py-2 text-xs text-white"
                />
              </div>
              <button
                type="submit"
                className="w-full min-h-[38px] rounded-lg bg-emerald-500 text-xs font-semibold text-slate-950 cursor-pointer"
              >
                Generate Staff Invite Link
              </button>
            </form>

            <div className="divide-y divide-white/10">
              {db.staff.map((st) => (
                <div key={st.id} className="py-3 flex items-center justify-between gap-2 text-xs">
                  <div>
                    <div className="font-semibold text-white">
                      {st.name} <span className="text-emerald-400">· {st.role}</span>
                    </div>
                    <div className="text-slate-400">
                      {st.permissions.join(' · ')} · Invite: <span className="font-mono text-amber-300">{st.inviteCode}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      const res = await fetch(`/api/staff/${st.id}`, { method: 'DELETE' });
                      if (res.ok) onDatabaseUpdate(await res.json());
                    }}
                    className="text-rose-400 hover:text-rose-300 cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Partners & Sponsors Manager */}
          <div className="rounded-2xl border border-white/10 bg-[#111821] p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Handshake className="h-5 w-5 text-amber-400" />
              <h2 className="font-display text-xl font-bold text-white">
                Partners & Sponsors Manager
              </h2>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const res = await fetch('/api/partners', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    name: ptName,
                    category: ptCategory,
                    tagline: ptTagline,
                    promoUrl: ptUrl || 'https://example.com',
                    status: 'Approved',
                  }),
                });
                if (res.ok) {
                  onDatabaseUpdate(await res.json());
                  setPtName('');
                  setPtTagline('');
                  setPtUrl('');
                }
              }}
              className="space-y-2.5 rounded-xl border border-white/10 bg-[#090D12] p-4"
            >
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  required
                  placeholder="Sponsor / Venue Name"
                  value={ptName}
                  onChange={(e) => setPtName(e.target.value)}
                  className="rounded-lg border border-white/15 bg-[#111821] px-3 py-2 text-xs text-white"
                />
                <select
                  value={ptCategory}
                  onChange={(e) => setPtCategory(e.target.value as Partner['category'])}
                  className="rounded-lg border border-white/15 bg-[#111821] px-3 py-2 text-xs text-white"
                >
                  <option value="Local Sponsor">Local Sponsor</option>
                  <option value="Turf Venue">Turf Venue</option>
                  <option value="Equipment & Apparel">Equipment & Apparel</option>
                  <option value="Media Partner">Media Partner</option>
                </select>
              </div>
              <input
                type="text"
                required
                placeholder="Offer / Description"
                value={ptTagline}
                onChange={(e) => setPtTagline(e.target.value)}
                className="w-full rounded-lg border border-white/15 bg-[#111821] px-3 py-2 text-xs text-white"
              />
              <button
                type="submit"
                className="w-full min-h-[38px] rounded-lg bg-amber-400 text-xs font-semibold text-slate-950 cursor-pointer"
              >
                Add Approved Sponsor
              </button>
            </form>

            <div className="divide-y divide-white/10">
              {db.partners.map((pt) => (
                <div key={pt.id} className="py-3 flex items-center justify-between gap-2 text-xs">
                  <div>
                    <div className="font-semibold text-white">
                      {pt.name}{' '}
                      <span className={pt.status === 'Approved' ? 'text-emerald-400' : 'text-amber-400'}>
                        ({pt.status})
                      </span>
                    </div>
                    <div className="text-slate-400">{pt.tagline}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {pt.status === 'Pending' && (
                      <button
                        type="button"
                        onClick={async () => {
                          const r = await fetch(`/api/partners/${pt.id}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ status: 'Approved' }),
                          });
                          if (r.ok) onDatabaseUpdate(await r.json());
                        }}
                        className="rounded bg-emerald-500 px-2 py-1 text-[11px] font-semibold text-slate-950 cursor-pointer"
                      >
                        Approve
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={async () => {
                        const r = await fetch(`/api/partners/${pt.id}`, { method: 'DELETE' });
                        if (r.ok) onDatabaseUpdate(await r.json());
                      }}
                      className="text-rose-400 cursor-pointer"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 5. PROMOS, WHATSAPP BLASTS, SUSPENSIONS & WAITLIST */}
      {section === 'ops' && authRole === 'admin' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Promo Codes */}
          <div className="rounded-2xl border border-white/10 bg-[#111821] p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Tag className="h-5 w-5 text-emerald-400" />
              <h2 className="font-display text-xl font-bold text-white">
                Promo Codes & Referrals
              </h2>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const r = await fetch('/api/promos', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    code: promoCodeInput,
                    discountAmount: promoDiscount,
                    description: promoDesc,
                  }),
                });
                if (r.ok) {
                  onDatabaseUpdate(await r.json());
                  setPromoCodeInput('');
                }
              }}
              className="flex flex-wrap gap-2"
            >
              <input
                type="text"
                required
                placeholder="CODE (e.g. WINTER75)"
                value={promoCodeInput}
                onChange={(e) => setPromoCodeInput(e.target.value.toUpperCase())}
                className="flex-1 rounded-lg border border-white/15 bg-[#090D12] px-3 py-2 text-xs font-mono text-white"
              />
              <input
                type="number"
                value={promoDiscount}
                onChange={(e) => setPromoDiscount(Number(e.target.value))}
                className="w-20 rounded-lg border border-white/15 bg-[#090D12] px-2 py-2 text-xs font-mono-num text-white"
              />
              <button
                type="submit"
                className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 cursor-pointer"
              >
                Create
              </button>
            </form>

            <div className="divide-y divide-white/10">
              {db.promoCodes.map((pr) => (
                <div key={pr.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-mono font-bold text-amber-300">{pr.code}</span>
                    <span className="text-slate-400 ml-2">
                      -${pr.discountAmount} · {pr.uses} uses
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      const r = await fetch(`/api/promos/${pr.id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ active: !pr.active }),
                      });
                      if (r.ok) onDatabaseUpdate(await r.json());
                    }}
                    className={`rounded px-2.5 py-1 font-semibold cursor-pointer ${
                      pr.active ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/10 text-slate-400'
                    }`}
                  >
                    {pr.active ? 'Active' : 'Paused'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* 1-Click WhatsApp / Email Blast */}
          <div className="rounded-2xl border border-white/10 bg-[#111821] p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-amber-400" />
              <h2 className="font-display text-xl font-bold text-white">
                1-Click WhatsApp / Email Blast
              </h2>
            </div>

            <div className="flex gap-2">
              {[
                { id: 'spots' as const, label: 'Open Spots' },
                { id: 'schedule' as const, label: 'Schedule Drop' },
                { id: 'weather' as const, label: 'Weather Update' },
              ].map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setBlastType(b.id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer ${
                    blastType === b.id ? 'bg-amber-400 text-slate-950' : 'bg-[#090D12] text-slate-300'
                  }`}
                >
                  {b.label}
                </button>
              ))}
            </div>

            <textarea
              readOnly
              rows={3}
              value={blastTemplate}
              className="w-full rounded-xl border border-white/10 bg-[#090D12] p-3 text-xs text-slate-200"
            />
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(blastTemplate);
                setCopiedBlast(true);
                setTimeout(() => setCopiedBlast(false), 1800);
              }}
              className="min-h-[40px] inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 cursor-pointer"
            >
              <Copy className="h-3.5 w-3.5" />
              <span>{copiedBlast ? 'Copied to Clipboard!' : 'Copy for Captain WhatsApp Group'}</span>
            </button>
          </div>

          {/* Suspension Manager */}
          <div className="rounded-2xl border border-white/10 bg-[#111821] p-6 space-y-3">
            <h2 className="font-display text-xl font-bold text-white">
              Red-Card Suspension Manager ({suspendedPlayers.length})
            </h2>
            {suspendedPlayers.length === 0 ? (
              <p className="text-xs text-slate-400">
                No active red-card suspensions. Players issued a Red Card in the Ref Scorekeeper appear here automatically.
              </p>
            ) : (
              suspendedPlayers.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-lg bg-[#090D12] p-3 text-xs">
                  <span className="font-semibold text-rose-400">{p.name} (Suspended Next Match)</span>
                  <button
                    type="button"
                    onClick={async () => {
                      const r = await fetch(`/api/players/${p.id}/clear-suspension`, { method: 'POST' });
                      if (r.ok) onDatabaseUpdate(await r.json());
                    }}
                    className="rounded bg-emerald-500 px-2.5 py-1 font-semibold text-slate-950 cursor-pointer"
                  >
                    Mark Served
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Waitlist Capture Viewer */}
          <div className="rounded-2xl border border-white/10 bg-[#111821] p-6 space-y-3">
            <h2 className="font-display text-xl font-bold text-white">
              Early-Bird Interest & Waitlist ({db.waitlist.length})
            </h2>
            <div className="divide-y divide-white/10 max-h-48 overflow-y-auto">
              {db.waitlist.map((w) => {
                const lg = db.leagues.find((l) => l.id === w.leagueId);
                return (
                  <div key={w.id} className="py-2 flex justify-between text-xs">
                    <div>
                      <span className="font-semibold text-white">{w.name}</span>
                      <span className="text-slate-400 ml-2">({w.entryType}) · {w.email}</span>
                    </div>
                    <span className="text-emerald-400">{lg?.name}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 6. CITIES, VENUES & FIELDS MANAGER (ZERO PRE-LOADED DEFAULTS; FULL EDIT EVERYTHING) */}
      {section === 'venues' && authRole === 'admin' && (
        <div className="space-y-6">
          {/* Free-Text City Manager */}
          <div className="rounded-2xl border border-white/10 bg-[#111821] p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-bold text-white">
                  Multi-City Manager ({db.cities.length})
                </h2>
                <p className="text-xs text-slate-400">
                  Add, rename, or remove cities anytime. Changes automatically sync to all fields, leagues, and homepage filters.
                </p>
              </div>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!newCityName.trim()) return;
                  const r = await fetch('/api/cities', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: newCityName.trim() }),
                  });
                  if (r.ok) {
                    onDatabaseUpdate(await r.json());
                    setNewCityName('');
                    setStatusMsg(`City "${newCityName.trim()}" added.`);
                  }
                }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  required
                  placeholder="Type City Name (e.g. Toronto)"
                  value={newCityName}
                  onChange={(e) => setNewCityName(e.target.value)}
                  className="rounded-lg border border-white/15 bg-[#090D12] px-3 py-2 text-xs text-white"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 cursor-pointer"
                >
                  Add City
                </button>
              </form>
            </div>

            {db.cities.length === 0 ? (
              <p className="text-xs text-slate-500">
                No cities pre-loaded. Cities are created automatically when you add a venue/league or add one above.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {db.cities.map((c) => (
                  <div
                    key={c}
                    className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-[#090D12] px-3 py-1.5 text-xs text-white"
                  >
                    {editingCity === c ? (
                      <>
                        <input
                          type="text"
                          value={editingCityValue}
                          onChange={(e) => setEditingCityValue(e.target.value)}
                          className="w-28 rounded border border-white/20 bg-[#111821] px-2 py-0.5 text-white"
                        />
                        <button
                          type="button"
                          onClick={async () => {
                            const r = await fetch('/api/cities', {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ oldName: c, newName: editingCityValue }),
                            });
                            if (r.ok) {
                              onDatabaseUpdate(await r.json());
                              setEditingCity('');
                              setStatusMsg(`Renamed city "${c}" to "${editingCityValue}".`);
                            }
                          }}
                          className="text-emerald-400 font-semibold cursor-pointer"
                        >
                          Save
                        </button>
                      </>
                    ) : (
                      <>
                        <MapPin className="h-3.5 w-3.5 text-emerald-400" />
                        <span className="font-semibold">{c}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCity(c);
                            setEditingCityValue(c);
                          }}
                          className="text-slate-400 hover:text-white cursor-pointer"
                          title="Rename City"
                        >
                          <Edit3 className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            const r = await fetch(`/api/cities/${encodeURIComponent(c)}`, { method: 'DELETE' });
                            if (r.ok) onDatabaseUpdate(await r.json());
                          }}
                          className="text-rose-400 hover:text-rose-300 cursor-pointer"
                          title="Delete City"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 rounded-2xl border border-white/10 bg-[#111821] divide-y divide-white/10">
              <div className="p-5 flex items-center justify-between">
                <h2 className="font-display text-xl font-bold text-white">
                  Active Fields &amp; Venues ({db.venues.length})
                </h2>
                <span className="text-[11px] text-slate-400">All fields &amp; locations editable</span>
              </div>

              {db.venues.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  No pre-loaded venues. Type a field/venue manually on the right or directly inside the Create League builder.
                </div>
              ) : (
                db.venues.map((v) => {
                  const isEditingVen = editingVenueId === v.id;
                  return (
                    <div key={v.id} className="p-5 space-y-3 text-xs">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="text-sm font-bold text-white">
                            {v.name} <span className="text-emerald-400 font-normal">· {v.city}</span>
                          </div>
                          <div className="text-slate-400">
                            {v.indoorOutdoor || 'Outdoor Turf'} · {v.neighborhood} · {v.address}
                          </div>
                          <div className="font-mono-num text-amber-300 mt-0.5">{v.fields.join(' · ')}</div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              if (isEditingVen) {
                                setEditingVenueId('');
                              } else {
                                setEditingVenueId(v.id);
                                setVenueDraft({
                                  name: v.name,
                                  city: v.city,
                                  address: v.address,
                                  neighborhood: v.neighborhood,
                                  indoorOutdoor: v.indoorOutdoor || 'Outdoor Turf',
                                  surface: v.surface,
                                  mapsUrl: v.mapsUrl,
                                  fieldsText: v.fields.join(', '),
                                });
                              }
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-3 py-1.5 font-semibold text-emerald-300 cursor-pointer"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                            <span>{isEditingVen ? 'Cancel' : 'Edit Field / Location'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              const r = await fetch(`/api/venues/${v.id}`, { method: 'DELETE' });
                              if (r.ok) {
                                onDatabaseUpdate(await r.json());
                                setStatusMsg(`Removed venue "${v.name}".`);
                              }
                            }}
                            className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-1.5 text-rose-300 cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {isEditingVen && (
                        <form
                          onSubmit={async (e) => {
                            e.preventDefault();
                            const fieldsArr = (venueDraft.fieldsText || '')
                              .split(',')
                              .map((s) => s.trim())
                              .filter(Boolean);
                            const r = await fetch(`/api/venues/${v.id}`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                name: venueDraft.name,
                                city: venueDraft.city,
                                address: venueDraft.address,
                                neighborhood: venueDraft.neighborhood,
                                indoorOutdoor: venueDraft.indoorOutdoor,
                                surface: venueDraft.surface,
                                mapsUrl: venueDraft.mapsUrl,
                                fields: fieldsArr.length > 0 ? fieldsArr : ['Turf 1'],
                              }),
                            });
                            if (r.ok) {
                              onDatabaseUpdate(await r.json());
                              setEditingVenueId('');
                              setStatusMsg(`Updated venue "${venueDraft.name}" (${venueDraft.city}).`);
                            }
                          }}
                          className="rounded-xl border border-emerald-500/30 bg-[#090D12] p-3.5 space-y-2.5"
                        >
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <input
                              type="text"
                              required
                              placeholder="Field / Venue Name"
                              value={venueDraft.name || ''}
                              onChange={(e) => setVenueDraft((p) => ({ ...p, name: e.target.value }))}
                              className="rounded-lg border border-white/15 bg-[#111821] px-2.5 py-1.5 text-white"
                            />
                            <input
                              type="text"
                              required
                              placeholder="City"
                              value={venueDraft.city || ''}
                              onChange={(e) => setVenueDraft((p) => ({ ...p, city: e.target.value }))}
                              className="rounded-lg border border-white/15 bg-[#111821] px-2.5 py-1.5 text-white"
                            />
                            <input
                              type="text"
                              required
                              placeholder="Street Address"
                              value={venueDraft.address || ''}
                              onChange={(e) => setVenueDraft((p) => ({ ...p, address: e.target.value }))}
                              className="rounded-lg border border-white/15 bg-[#111821] px-2.5 py-1.5 text-white"
                            />
                            <input
                              type="text"
                              placeholder="Neighborhood / Area"
                              value={venueDraft.neighborhood || ''}
                              onChange={(e) => setVenueDraft((p) => ({ ...p, neighborhood: e.target.value }))}
                              className="rounded-lg border border-white/15 bg-[#111821] px-2.5 py-1.5 text-white"
                            />
                            <select
                              value={venueDraft.indoorOutdoor || 'Outdoor Turf'}
                              onChange={(e) =>
                                setVenueDraft((p) => ({
                                  ...p,
                                  indoorOutdoor: e.target.value as Venue['indoorOutdoor'],
                                }))
                              }
                              className="rounded-lg border border-white/15 bg-[#111821] px-2.5 py-1.5 text-white"
                            >
                              <option value="Outdoor Turf">Outdoor Turf</option>
                              <option value="Indoor Dome">Indoor Dome</option>
                              <option value="Outdoor Grass">Outdoor Grass</option>
                            </select>
                            <input
                              type="text"
                              placeholder="Surface (e.g. FIFA Synthetic Turf)"
                              value={venueDraft.surface || ''}
                              onChange={(e) => setVenueDraft((p) => ({ ...p, surface: e.target.value }))}
                              className="rounded-lg border border-white/15 bg-[#111821] px-2.5 py-1.5 text-white"
                            />
                            <input
                              type="text"
                              placeholder="Pitch / Field Numbers (comma-separated)"
                              value={venueDraft.fieldsText || ''}
                              onChange={(e) => setVenueDraft((p) => ({ ...p, fieldsText: e.target.value }))}
                              className="rounded-lg border border-white/15 bg-[#111821] px-2.5 py-1.5 text-white"
                            />
                            <input
                              type="text"
                              placeholder="Google Maps Link"
                              value={venueDraft.mapsUrl || ''}
                              onChange={(e) => setVenueDraft((p) => ({ ...p, mapsUrl: e.target.value }))}
                              className="rounded-lg border border-white/15 bg-[#111821] px-2.5 py-1.5 text-white"
                            />
                          </div>
                          <button
                            type="submit"
                            className="rounded-lg bg-emerald-500 px-4 py-1.5 font-semibold text-slate-950 cursor-pointer"
                          >
                            Save Venue &amp; Location Changes
                          </button>
                        </form>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const r = await fetch('/api/venues', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    city: venueCity,
                    name: venueName,
                    address: venueAddress,
                    neighborhood: venueNeighborhood || venueCity,
                    indoorOutdoor: venueIndoorOutdoor,
                    surface: venueSurface,
                    fields: venueFieldsText.split(',').map((s) => s.trim()).filter(Boolean),
                  }),
                });
                const data = await r.json();
                if (r.ok) {
                  onDatabaseUpdate(data);
                  setVenueName('');
                  setVenueAddress('');
                  setVenueCity('');
                  setVenueNeighborhood('');
                  setStatusMsg(`Added field venue "${venueName}" in ${venueCity}.`);
                } else {
                  setStatusMsg(data.error || 'Could not add venue');
                }
              }}
              className="lg:col-span-5 rounded-2xl border border-white/10 bg-[#111821] p-5 space-y-3 self-start"
            >
              <h3 className="font-display text-xl font-bold text-white">Add Custom Turf Venue</h3>
              <input
                type="text"
                required
                placeholder="City (e.g. Toronto, Ottawa, Mississauga)"
                value={venueCity}
                onChange={(e) => setVenueCity(e.target.value)}
                className="w-full rounded-lg border border-white/15 bg-[#090D12] px-3 py-2 text-xs text-white"
              />
              <input
                type="text"
                required
                placeholder="Venue / Field Name (Type Manually)"
                value={venueName}
                onChange={(e) => setVenueName(e.target.value)}
                className="w-full rounded-lg border border-white/15 bg-[#090D12] px-3 py-2 text-xs text-white"
              />
              <input
                type="text"
                required
                placeholder="Street Address"
                value={venueAddress}
                onChange={(e) => setVenueAddress(e.target.value)}
                className="w-full rounded-lg border border-white/15 bg-[#090D12] px-3 py-2 text-xs text-white"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Neighborhood / Area"
                  value={venueNeighborhood}
                  onChange={(e) => setVenueNeighborhood(e.target.value)}
                  className="rounded-lg border border-white/15 bg-[#090D12] px-3 py-2 text-xs text-white"
                />
                <select
                  value={venueIndoorOutdoor}
                  onChange={(e) => setVenueIndoorOutdoor(e.target.value as Venue['indoorOutdoor'])}
                  className="rounded-lg border border-white/15 bg-[#090D12] px-3 py-2 text-xs text-white"
                >
                  <option value="Outdoor Turf">Outdoor Turf</option>
                  <option value="Indoor Dome">Indoor Dome</option>
                  <option value="Outdoor Grass">Outdoor Grass</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Surface Type"
                  value={venueSurface}
                  onChange={(e) => setVenueSurface(e.target.value)}
                  className="rounded-lg border border-white/15 bg-[#090D12] px-3 py-2 text-xs text-white"
                />
                <input
                  type="text"
                  placeholder="Field #s (Turf 1, Turf 2)"
                  value={venueFieldsText}
                  onChange={(e) => setVenueFieldsText(e.target.value)}
                  className="rounded-lg border border-white/15 bg-[#090D12] px-3 py-2 text-xs text-white"
                />
              </div>
              <button
                type="submit"
                className="w-full min-h-[40px] rounded-lg bg-emerald-500 text-xs font-semibold text-slate-950 cursor-pointer"
              >
                Save Custom Venue
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 7. PAYMENTS LEDGER (PLAYER-FORMED TEAMS) */}
      {section === 'payments' && authRole === 'admin' && (
        <div className="rounded-2xl border border-white/10 bg-[#111821] overflow-hidden">
          <div className="px-5 py-4 border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-xl font-bold text-white">
                Fee &amp; Payment Ledger (Player-Formed Teams)
              </h2>
              <p className="text-xs text-slate-400">
                Admin does not manually register teams. Squads appear here once players create and join teams in the League Hub.
              </p>
            </div>
            <span className="text-xs text-slate-400 shrink-0">{db.teams.length} Teams</span>
          </div>
          {db.teams.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              No player-formed teams registered yet. Teams appear here automatically as soon as players create or join squads in the League Hub &amp; Clubhouse.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 bg-[#090D12] text-[11px] font-semibold text-slate-400">
                    <th className="py-3 px-4">Team</th>
                    <th className="py-3 px-4">League</th>
                    <th className="py-3 px-3 text-right">Total Fee</th>
                    <th className="py-3 px-3 text-right">Paid</th>
                    <th className="py-3 px-3 text-right">Due</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-xs">
                  {db.teams.map((tm) => {
                    const lg = db.leagues.find((l) => l.id === tm.leagueId);
                    const due = Math.max(0, tm.totalFee - tm.amountPaid);
                    const isEditingTm = editingTeamId === tm.id;
                    return (
                      <tr key={tm.id}>
                        <td className="py-3 px-4 font-semibold text-white">
                          {isEditingTm ? (
                            <input
                              type="text"
                              value={teamDraft.name}
                              onChange={(e) => setTeamDraft((p) => ({ ...p, name: e.target.value }))}
                              className="w-36 rounded border border-white/20 bg-[#090D12] px-2 py-1 text-white"
                            />
                          ) : (
                            tm.name
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-300">{lg?.name}</td>
                        <td className="py-3 px-3 text-right font-mono-num">
                          {isEditingTm ? (
                            <input
                              type="number"
                              min={0}
                              value={teamDraft.totalFee}
                              onChange={(e) => setTeamDraft((p) => ({ ...p, totalFee: Number(e.target.value) }))}
                              className="w-20 rounded border border-white/20 bg-[#090D12] px-2 py-1 text-right text-white"
                            />
                          ) : (
                            `$${tm.totalFee}`
                          )}
                        </td>
                        <td className="py-3 px-3 text-right font-mono-num text-emerald-400">
                          {isEditingTm ? (
                            <input
                              type="number"
                              min={0}
                              value={teamDraft.amountPaid}
                              onChange={(e) => setTeamDraft((p) => ({ ...p, amountPaid: Number(e.target.value) }))}
                              className="w-20 rounded border border-white/20 bg-[#090D12] px-2 py-1 text-right text-white"
                            />
                          ) : (
                            `$${tm.amountPaid}`
                          )}
                        </td>
                        <td className="py-3 px-3 text-right font-mono-num font-bold text-amber-400">${due}</td>
                        <td className="py-3 px-4">
                          {due === 0 || tm.registrationStatus === 'Complete' ? (
                            <span className="text-emerald-400 font-semibold">Complete (Paid in Full)</span>
                          ) : (
                            <span className="text-amber-400 font-semibold inline-flex items-center gap-1">
                              <AlertTriangle className="h-3.5 w-3.5" /> Pending Payment (${due} due)
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex flex-wrap justify-end gap-1.5">
                            {isEditingTm ? (
                              <>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const r = await fetch(`/api/teams/${tm.id}`, {
                                      method: 'PATCH',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify(teamDraft),
                                    });
                                    if (r.ok) {
                                      onDatabaseUpdate(await r.json());
                                      setEditingTeamId('');
                                      setStatusMsg(`Updated ${teamDraft.name} fee & payment details.`);
                                    }
                                  }}
                                  className="rounded bg-emerald-500 px-2.5 py-1 font-semibold text-slate-950 cursor-pointer"
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingTeamId('')}
                                  className="rounded border border-white/15 px-2 py-1 text-slate-300 cursor-pointer"
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingTeamId(tm.id);
                                    setTeamDraft({
                                      name: tm.name,
                                      totalFee: tm.totalFee,
                                      amountPaid: tm.amountPaid,
                                    });
                                  }}
                                  className="rounded border border-white/15 px-2.5 py-1 text-slate-200 cursor-pointer inline-flex items-center gap-1"
                                >
                                  <Edit3 className="h-3 w-3" /> Edit
                                </button>
                                {due > 0 && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        const r = await fetch(`/api/teams/${tm.id}/remind`, { method: 'POST' });
                                        if (r.ok) {
                                          onDatabaseUpdate(await r.json());
                                          setStatusMsg(`Reminder sent to ${tm.captainName}.`);
                                        }
                                      }}
                                      className="rounded border border-white/15 px-2.5 py-1 text-slate-200 cursor-pointer inline-flex items-center gap-1"
                                    >
                                      <Send className="h-3 w-3" /> Remind
                                    </button>
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        const r = await fetch(`/api/teams/${tm.id}/record-payment`, {
                                          method: 'POST',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({}),
                                        });
                                        if (r.ok) onDatabaseUpdate(await r.json());
                                      }}
                                      className="rounded bg-emerald-500 px-2.5 py-1 font-semibold text-slate-950 cursor-pointer inline-flex items-center gap-1"
                                    >
                                      <DollarSign className="h-3 w-3" /> Paid
                                    </button>
                                  </>
                                )}
                              </>
                            )}
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
        </div>
      </div>
    </div>
  );
};
