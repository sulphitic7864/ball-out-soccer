import React, { useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  Clock,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  UserCheck,
  Users,
  Lock,
  UserPlus,
} from 'lucide-react';
import type {
  LeagueDatabase,
  MarketMode,
  Player,
  PlayerPosition,
} from '../types.ts';
import {
  checkPlayerMarketCooldown,
  checkTeamLifelineCooldown,
  computeStandings,
} from '../utils/leagueHelpers.ts';

interface TransferMarketProps {
  db: LeagueDatabase;
  selectedLeagueId: string;
  onSelectLeague: (id: string) => void;
  activePlayerId: string;
  onSelectActivePlayer: (id: string) => void;
  initialSubTab?: 'board' | 'requests' | 'subs' | 'deals';
  onOpenAdmin?: () => void;
  onDatabaseUpdate: (db: LeagueDatabase) => void;
}

export const TransferMarket: React.FC<TransferMarketProps> = ({
  db,
  selectedLeagueId,
  onSelectLeague,
  activePlayerId,
  onSelectActivePlayer,
  initialSubTab = 'board',
  onOpenAdmin,
  onDatabaseUpdate,
}) => {
  const [marketTab, setMarketTab] = useState<'board' | 'requests' | 'subs' | 'deals'>(initialSubTab);
  const [showListForm, setShowListForm] = useState(false);
  const [listMode, setListMode] = useState<MarketMode>('Both');
  const [listPos, setListPos] = useState<PlayerPosition>('MID');
  const [listNotes, setListNotes] = useState('');

  // Proposal Modal state
  const [proposalKind, setProposalKind] = useState<'swap' | 'loan' | null>(null);
  const [targetTeamId, setTargetTeamId] = useState<string>('');
  const [targetPlayerId, setTargetPlayerId] = useState<string>('');
  const [offeredPlayerId, setOfferedPlayerId] = useState<string>('');
  const [loanMode, setLoanMode] = useState<'single' | 'rotating'>('single');
  const [rotatingPlayerIds, setRotatingPlayerIds] = useState<string[]>([]);
  const [proposalNote, setProposalNote] = useState('');

  // Sub Request Form state
  const [subMatchId, setSubMatchId] = useState<string>('');
  const [subPosition, setSubPosition] = useState<PlayerPosition | 'ANY'>('ANY');
  const [subFee, setSubFee] = useState<string>('Free / Covered by Team');

  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);

  const league = db.leagues.find((l) => l.id === selectedLeagueId) || db.leagues[0];
  const leagueTeams = useMemo(
    () => (league ? db.teams.filter((t) => t.leagueId === league.id) : []),
    [league, db.teams]
  );
  const leaguePlayers = useMemo(
    () => (league ? db.players.filter((p) => p.leagueId === league.id) : []),
    [league, db.players]
  );
  const standings = useMemo(
    () => (league ? computeStandings(league.id, db.teams, db.matches) : []),
    [league, db.teams, db.matches]
  );

  const activePlayer: Player | undefined =
    leaguePlayers.find((p) => p.id === activePlayerId) || leaguePlayers[0];
  const activeTeam = db.teams.find((t) => t.id === activePlayer?.teamId);
  const activeRank = standings.find((s) => s.teamId === activeTeam?.id)?.rank ?? 99;
  const isStrugglingTeam = activeRank >= 8 && activeRank <= 10;
  const teamLifelineCooldown = activeTeam
    ? checkTeamLifelineCooldown(activeTeam)
    : { unlocked: false, hoursRemaining: 0, label: '' };
  const playerCooldown = activePlayer
    ? checkPlayerMarketCooldown(activePlayer)
    : { unlocked: false, hoursRemaining: 0, label: '' };

  const canInitiateMove =
    Boolean(activePlayer?.isCaptain) || (isStrugglingTeam && teamLifelineCooldown.unlocked);

  const listedPlayers = useMemo(
    () => leaguePlayers.filter((p) => p.marketListing !== null),
    [leaguePlayers]
  );

  const leagueTransfers = useMemo(
    () => (league ? db.transfers.filter((t) => t.leagueId === league.id) : []),
    [league, db.transfers]
  );

  const leagueSubs = useMemo(
    () => (league ? db.subRequests.filter((s) => s.leagueId === league.id) : []),
    [league, db.subRequests]
  );

  const leagueDeals = useMemo(
    () => (league ? db.doneDeals.filter((d) => d.leagueId === league.id) : []),
    [league, db.doneDeals]
  );

  if (!league || !activePlayer || !activeTeam) {
    return (
      <div className="mx-auto max-w-4xl px-4 sm:px-6 py-16 pb-24">
        <div className="rounded-2xl border border-white/10 bg-[#111821] p-8 sm:p-10 text-center space-y-4">
          <ArrowLeftRight className="h-10 w-10 text-emerald-400 mx-auto" />
          <h1 className="font-display text-3xl font-bold text-white">
            Transfer Market &amp; Emergency Sub Board Standby
          </h1>
          <p className="text-sm text-slate-400 max-w-lg mx-auto">
            {!league
              ? 'No active leagues are running yet. Launch a league in the Admin Panel and register squads to unlock 1-for-1 swaps, 4-game loans, and emergency sub requests.'
              : `${league.name} has ${leagueTeams.length} registered squad(s). Once squads and players register, players can list for swaps, 4-game loans, and sub cover here.`}
          </p>
          {onOpenAdmin && !league && (
            <button
              type="button"
              onClick={onOpenAdmin}
              className="min-h-[42px] rounded-lg bg-emerald-500 px-5 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 cursor-pointer"
            >
              Create First League in Admin (PIN: {db.brand.adminPin})
            </button>
          )}
        </div>
      </div>
    );
  }

  const myRoster = leaguePlayers.filter(
    (p) => p.teamId === activeTeam.id && !p.activeLoanId
  );
  const otherTeams = leagueTeams.filter((t) => t.id !== activeTeam.id);

  const myUpcomingMatches = db.matches.filter(
    (m) =>
      m.leagueId === league.id &&
      m.status === 'Scheduled' &&
      (m.stage === 'Regular' || m.stage === 'Group') &&
      (m.homeTeamId === activeTeam.id || m.awayTeamId === activeTeam.id)
  );

  const openSwapProposal = (prefTargetTeamId?: string, prefTargetPlayerId?: string) => {
    const tId = prefTargetTeamId || otherTeams[0]?.id || '';
    const tPlayers = leaguePlayers.filter((p) => p.teamId === tId && !p.activeLoanId);
    setProposalKind('swap');
    setTargetTeamId(tId);
    setTargetPlayerId(prefTargetPlayerId || tPlayers[0]?.id || '');
    setOfferedPlayerId(myRoster[0]?.id || '');
    setProposalNote('');
    setFeedback(null);
  };

  const openLoanProposal = (prefLendingTeamId?: string, prefLoanPlayerId?: string) => {
    const lId = prefLendingTeamId || otherTeams[0]?.id || '';
    const lPlayers = leaguePlayers.filter(
      (p) => p.teamId === lId && !p.activeLoanId && p.loansUsedThisSeason === 0
    );
    const firstPid = prefLoanPlayerId || lPlayers[0]?.id || '';
    setProposalKind('loan');
    setTargetTeamId(lId);
    setLoanMode('single');
    setTargetPlayerId(firstPid);
    setRotatingPlayerIds(firstPid ? [firstPid] : []);
    setProposalNote('');
    setFeedback(null);
  };

  const handleSelfList = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/players/${activePlayer.id}/market-listing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'list',
          mode: listMode,
          preferredPosition: listPos,
          availabilityNotes: listNotes || 'Available for matches this season.',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not list player');
      onDatabaseUpdate(data);
      setShowListForm(false);
      setFeedback({ type: 'ok', msg: `${activePlayer.name} is now listed on the Market Board.` });
    } catch (err) {
      setFeedback({ type: 'err', msg: err instanceof Error ? err.message : 'Error listing player' });
    } finally {
      setBusy(false);
    }
  };

  const handleUnlist = async () => {
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/players/${activePlayer.id}/market-listing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unlist' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not unlist');
      onDatabaseUpdate(data);
      setFeedback({ type: 'ok', msg: 'Removed from Market Board (3-day cooldown reset).' });
    } catch (err) {
      setFeedback({ type: 'err', msg: err instanceof Error ? err.message : 'Error' });
    } finally {
      setBusy(false);
    }
  };

  const handleSubmitProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      if (proposalKind === 'swap') {
        const res = await fetch('/api/transfers/swap', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            leagueId: league.id,
            initiatedByPlayerId: activePlayer.id,
            fromTeamId: activeTeam.id,
            toTeamId: targetTeamId,
            offeredPlayerId,
            requestedPlayerId: targetPlayerId,
            note: proposalNote,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Swap request rejected');
        onDatabaseUpdate(data);
        setProposalKind(null);
        setMarketTab('requests');
        setFeedback({ type: 'ok', msg: '1-for-1 Swap proposal sent. Awaiting approvals.' });
      } else if (proposalKind === 'loan') {
        const chosenIds =
          loanMode === 'single' ? (targetPlayerId ? [targetPlayerId] : []) : rotatingPlayerIds;
        const res = await fetch('/api/transfers/loan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            leagueId: league.id,
            initiatedByPlayerId: activePlayer.id,
            borrowingTeamId: activeTeam.id,
            lendingTeamId: targetTeamId,
            loanMode,
            loanPlayerIds: chosenIds,
            note: proposalNote,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Loan proposal rejected');
        onDatabaseUpdate(data);
        setProposalKind(null);
        setMarketTab('requests');
        setFeedback({ type: 'ok', msg: '4-Game Loan proposal created. Awaiting party approvals.' });
      }
    } catch (err) {
      setFeedback({ type: 'err', msg: err instanceof Error ? err.message : 'Proposal failed' });
    } finally {
      setBusy(false);
    }
  };

  const handleApprove = async (transferId: string, role: string, playerId?: string) => {
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/transfers/${transferId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, playerId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Approval failed');
      onDatabaseUpdate(data);
      setFeedback({ type: 'ok', msg: 'Approval recorded.' });
    } catch (err) {
      setFeedback({ type: 'err', msg: err instanceof Error ? err.message : 'Error' });
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async (transferId: string) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/transfers/${transferId}/reject`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) onDatabaseUpdate(data);
    } finally {
      setBusy(false);
    }
  };

  const handlePostSub = async (e: React.FormEvent) => {
    e.preventDefault();
    const matchIdToUse = subMatchId || myUpcomingMatches[0]?.id;
    if (!matchIdToUse) {
      setFeedback({ type: 'err', msg: 'No upcoming regular-season match found for your team.' });
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/subs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leagueId: league.id,
          matchId: matchIdToUse,
          teamId: activeTeam.id,
          positionNeeded: subPosition,
          subFee,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not post sub request');
      onDatabaseUpdate(data);
      setFeedback({ type: 'ok', msg: 'Emergency sub slot posted for eligible division players.' });
    } catch (err) {
      setFeedback({ type: 'err', msg: err instanceof Error ? err.message : 'Error' });
    } finally {
      setBusy(false);
    }
  };

  const handleClaimSub = async (subId: string) => {
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/subs/${subId}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: activePlayer.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not claim sub spot');
      onDatabaseUpdate(data);
      setFeedback({ type: 'ok', msg: `Sub spot claimed by ${activePlayer.name}.` });
    } catch (err) {
      setFeedback({ type: 'err', msg: err instanceof Error ? err.message : 'Error' });
    } finally {
      setBusy(false);
    }
  };

  const lendingRoster = leaguePlayers.filter(
    (p) => p.teamId === targetTeamId && !p.activeLoanId
  );

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 pb-24 space-y-6">
      {/* Header + League Switcher */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="text-xs font-medium text-emerald-400">
            Player Swaps, 4-Game Loans & Single-Game Emergency Subs
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-white mt-0.5">
            Transfer Market & Sub Board
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            3-day self-listing timer · 1-for-1 mandatory swaps · 8th–10th Struggling Team Lifeline · Single/Rotating 4-game loans · Emergency Sub Board.
          </p>
        </div>

        <select
          aria-label="Filter Market by League"
          value={league.id}
          onChange={(e) => onSelectLeague(e.target.value)}
          className="min-h-[42px] rounded-lg border border-white/15 bg-[#111821] px-3 py-2 text-sm font-medium text-white"
        >
          {db.leagues.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name} ({l.format})
            </option>
          ))}
        </select>
      </div>

      {/* Player Identity & Cooldown / Struggling Lifeline Console */}
      <div className="rounded-2xl border border-white/10 bg-[#111821] p-5 sm:p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-400">
              Active Player / Captain Profile (Switch to test Cooldowns, Captains, 8th–10th Lifeline & Sub Claims)
            </label>
            <select
              value={activePlayer.id}
              onChange={(e) => onSelectActivePlayer(e.target.value)}
              className="w-full sm:w-[420px] min-h-[44px] rounded-lg border border-white/15 bg-[#090D12] px-3 py-2 text-sm font-medium text-white"
            >
              {leaguePlayers.map((p) => {
                const tm = db.teams.find((t) => t.id === p.teamId);
                const rnk = standings.find((s) => s.teamId === p.teamId)?.rank ?? '?';
                return (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.isCaptain ? 'Captain' : p.position}) — #{rnk} {tm?.name}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-xl border border-white/10 bg-[#090D12] px-4 py-2.5 flex items-center gap-2.5">
              <Clock
                className={`h-4 w-4 ${
                  playerCooldown.unlocked ? 'text-emerald-400' : 'text-amber-400'
                }`}
              />
              <div>
                <div className="text-[11px] text-slate-400">3–4 Day Market Timer</div>
                <div
                  className={`font-mono-num text-xs font-bold ${
                    playerCooldown.unlocked ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                >
                  {playerCooldown.label}
                </div>
              </div>
            </div>

            {activePlayer.marketListing ? (
              <button
                type="button"
                disabled={busy}
                onClick={handleUnlist}
                className="min-h-[44px] rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-white hover:bg-white/10 cursor-pointer"
              >
                Unlist ({activePlayer.marketListing.mode})
              </button>
            ) : (
              <button
                type="button"
                disabled={!playerCooldown.unlocked || Boolean(activePlayer.activeLoanId)}
                onClick={() => {
                  setListPos(activePlayer.position);
                  setShowListForm((prev) => !prev);
                }}
                className="min-h-[44px] rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {activePlayer.activeLoanId
                  ? 'Locked on 4-Game Loan'
                  : playerCooldown.unlocked
                  ? 'List Myself for Transfer / Loan'
                  : `Self-List Locked (${playerCooldown.label})`}
              </button>
            )}
          </div>
        </div>

        {/* Struggling Team Lifeline Banner */}
        <div className="rounded-xl border border-white/10 bg-[#090D12] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-semibold text-white">
                {activeTeam.name} (Rank #{activeRank} in {league.name})
              </span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              {activePlayer.activeLoanId ? (
                <span className="font-semibold text-rose-400 inline-flex items-center gap-1">
                  <Lock className="h-3.5 w-3.5" />
                  Ineligible for Original Team (4 Games)
                </span>
              ) : isStrugglingTeam ? (
                <span className="font-semibold text-amber-400">
                  Struggling Team Lifeline Unlocked (8th–10th Place Rule)
                </span>
              ) : activePlayer.isCaptain ? (
                <span className="text-emerald-400 font-medium">Captain Authority Active</span>
              ) : (
                <span className="text-slate-400">
                  Captains initiate moves (Ranks 8th–10th unlock any player)
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              {isStrugglingTeam
                ? `Because ${activeTeam.name} sits in #${activeRank} place, ANY teammate can request a 1-for-1 Swap or 4-Game Loan reinforcement (${teamLifelineCooldown.label}).`
                : 'Transfer deadline: Week ' + league.transferDeadlineWeek + ' · Max 1 loan per season per player.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              disabled={!canInitiateMove}
              onClick={() => openSwapProposal()}
              className="min-h-[42px] rounded-lg border border-white/15 bg-white/5 px-3.5 py-2 text-xs font-semibold text-white hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {isStrugglingTeam && !activePlayer.isCaptain
                ? 'Request Reinforcement (Swap)'
                : 'Propose 1-for-1 Swap'}
            </button>
            <button
              type="button"
              disabled={!canInitiateMove}
              onClick={() => openLoanProposal()}
              className="min-h-[42px] rounded-lg bg-amber-400 px-3.5 py-2 text-xs font-semibold text-slate-950 hover:bg-amber-300 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {isStrugglingTeam && !activePlayer.isCaptain
                ? 'Request Reinforcement (4-Game Loan)'
                : 'Propose 4-Game Loan'}
            </button>
          </div>
        </div>

        {showListForm && (
          <form
            onSubmit={handleSelfList}
            className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-4"
          >
            <div className="text-sm font-semibold text-white">
              List {activePlayer.name} on the Transfer & Loan Market
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <select
                value={listMode}
                onChange={(e) => setListMode(e.target.value as MarketMode)}
                className="rounded-lg border border-white/15 bg-[#090D12] px-3 py-2 text-xs text-white"
              >
                <option value="Swap Transfer">Swap Transfer (1-for-1)</option>
                <option value="4-Game Loan">4-Game Loan</option>
                <option value="Both">Both (Swap or 4-Game Loan)</option>
              </select>
              <select
                value={listPos}
                onChange={(e) => setListPos(e.target.value as PlayerPosition)}
                className="rounded-lg border border-white/15 bg-[#090D12] px-3 py-2 text-xs text-white"
              >
                <option value="GK">GK</option>
                <option value="DEF">DEF</option>
                <option value="MID">MID</option>
                <option value="FWD">FWD</option>
              </select>
              <input
                type="text"
                placeholder="Availability notes"
                value={listNotes}
                onChange={(e) => setListNotes(e.target.value)}
                className="rounded-lg border border-white/15 bg-[#090D12] px-3 py-2 text-xs text-white"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowListForm(false)}
                className="min-h-[38px] rounded-lg border border-white/15 px-3 py-1.5 text-xs text-slate-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="min-h-[38px] rounded-lg bg-emerald-500 px-4 py-1.5 text-xs font-semibold text-slate-950 cursor-pointer"
              >
                Publish Market Listing
              </button>
            </div>
          </form>
        )}

        {feedback && (
          <div
            className={`rounded-lg border px-4 py-2.5 text-xs ${
              feedback.type === 'ok'
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                : 'border-rose-500/30 bg-rose-500/10 text-rose-300'
            }`}
          >
            {feedback.msg}
          </div>
        )}
      </div>

      {/* Market Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto">
        {[
          { id: 'board' as const, label: `Market Board (${listedPlayers.length})` },
          { id: 'requests' as const, label: `Swaps & 4-Game Loans (${leagueTransfers.length})` },
          { id: 'subs' as const, label: `Emergency Sub Board (${leagueSubs.filter((s) => s.status === 'Open').length} Open)` },
          { id: 'deals' as const, label: `Done Deals (${leagueDeals.length})` },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setMarketTab(t.id)}
            className={`min-h-[42px] rounded-lg px-4 py-2 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
              marketTab === t.id
                ? 'bg-emerald-500 text-slate-950'
                : 'border border-white/10 bg-[#111821] text-slate-300 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB 1: MARKET BOARD */}
      {marketTab === 'board' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {listedPlayers.length === 0 ? (
            <div className="col-span-full rounded-2xl border border-white/10 bg-[#111821] p-10 text-center text-sm text-slate-400">
              No players have self-listed in this league yet.
            </div>
          ) : (
            listedPlayers.map((pl) => {
              const club = db.teams.find((t) => t.id === pl.teamId);
              const clubRank = standings.find((s) => s.teamId === pl.teamId)?.rank ?? 1;
              const isOwnTeam = pl.teamId === activeTeam.id;
              const listing = pl.marketListing!;

              return (
                <div
                  key={pl.id}
                  className="rounded-2xl border border-white/10 bg-[#111821] p-5 flex flex-col justify-between gap-4"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-display text-xl font-bold text-white">{pl.name}</h3>
                        <div className="text-xs text-slate-400">
                          {club?.name} (#{clubRank}) · {listing.preferredPosition} · {pl.goals}G / {pl.gamesPlayed}GP
                        </div>
                      </div>
                      <span className="rounded bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[11px] font-semibold text-emerald-300 whitespace-nowrap">
                        {listing.mode}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {listing.availabilityNotes}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 pt-3 border-t border-white/10">
                    <button
                      type="button"
                      disabled={isOwnTeam || !canInitiateMove || listing.mode === '4-Game Loan'}
                      onClick={() => openSwapProposal(pl.teamId, pl.id)}
                      className="flex-1 min-h-[40px] rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
                    >
                      1-for-1 Swap
                    </button>
                    <button
                      type="button"
                      disabled={
                        isOwnTeam ||
                        !canInitiateMove ||
                        listing.mode === 'Swap Transfer' ||
                        pl.loansUsedThisSeason >= 1
                      }
                      onClick={() => openLoanProposal(pl.teamId, pl.id)}
                      className="flex-1 min-h-[40px] rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-amber-300 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
                    >
                      {pl.loansUsedThisSeason >= 1 ? 'Loan Limit Used' : '4-Game Loan'}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* TAB 2: SWAPS & 4-GAME LOANS */}
      {marketTab === 'requests' && (
        <div className="space-y-4">
          {leagueTransfers.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-[#111821] p-10 text-center text-sm text-slate-400">
              No swap or 4-game loan agreements in this league yet.
            </div>
          ) : (
            leagueTransfers.map((tr) => {
              if (tr.kind === 'swap' && tr.swapApprovals) {
                const tFrom = db.teams.find((t) => t.id === tr.fromTeamId);
                const tTo = db.teams.find((t) => t.id === tr.toTeamId);
                const pOut = db.players.find((p) => p.id === tr.offeredPlayerId);
                const pIn = db.players.find((p) => p.id === tr.requestedPlayerId);
                const app = tr.swapApprovals;

                return (
                  <div
                    key={tr.id}
                    className="rounded-2xl border border-white/10 bg-[#111821] p-5 space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <ArrowLeftRight className="h-4 w-4 text-emerald-400" />
                        <span className="font-display text-xl font-bold text-white">
                          Mandatory 1-for-1 Swap: {pOut?.name} ({tFrom?.name}) ↔ {pIn?.name} ({tTo?.name})
                        </span>
                      </div>
                      <span
                        className={`text-xs font-semibold ${
                          tr.status === 'Completed'
                            ? 'text-emerald-400'
                            : tr.status === 'Rejected'
                            ? 'text-rose-400'
                            : 'text-amber-400'
                        }`}
                      >
                        {tr.status}
                      </span>
                    </div>

                    <div className="text-xs text-slate-400">
                      Initiated by {tr.initiatedByName}
                      {tr.isStrugglingTeamLifeline ? ' · 8th–10th Struggling Team Lifeline' : ''}
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
                      {[
                        { key: 'requestingCaptain', label: `${tFrom?.name} Captain`, ok: app.requestingCaptain },
                        { key: 'targetCaptain', label: `${tTo?.name} Captain`, ok: app.targetCaptain },
                        { key: 'offeredPlayer', label: `${pOut?.name} (Out)`, ok: app.offeredPlayer },
                        { key: 'requestedPlayer', label: `${pIn?.name} (In)`, ok: app.requestedPlayer },
                      ].map((step) => (
                        <div
                          key={step.key}
                          className="rounded-xl border border-white/10 bg-[#090D12] p-3 flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <div className="text-[11px] text-slate-400 truncate">{step.label}</div>
                            <div
                              className={`text-xs font-semibold mt-0.5 ${
                                step.ok ? 'text-emerald-400' : 'text-amber-400'
                              }`}
                            >
                              {step.ok ? 'Approved' : 'Pending'}
                            </div>
                          </div>
                          {tr.status === 'Pending' && !step.ok && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => handleApprove(tr.id, step.key)}
                              className="min-h-[34px] shrink-0 rounded-md bg-emerald-500 px-2.5 py-1 text-[11px] font-semibold text-slate-950 cursor-pointer"
                            >
                              Approve
                            </button>
                          )}
                          {step.ok && <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />}
                        </div>
                      ))}
                    </div>

                    {tr.status === 'Pending' && (
                      <div className="flex items-center justify-between pt-2 border-t border-white/5 text-xs">
                        {league.requireAdminTransferSignOff && !app.admin ? (
                          <button
                            type="button"
                            onClick={() => handleApprove(tr.id, 'admin')}
                            className="text-amber-400 font-semibold hover:underline cursor-pointer"
                          >
                            Admin Sign-Off Required — Approve
                          </button>
                        ) : (
                          <span className="text-slate-500">
                            Rosters swap automatically once all 4 approvals complete.
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleReject(tr.id)}
                          className="inline-flex items-center gap-1 text-rose-400 cursor-pointer"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          <span>Cancel Swap</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              }

              const bTeam = db.teams.find((t) => t.id === tr.borrowingTeamId);
              const lTeam = db.teams.find((t) => t.id === tr.lendingTeamId);
              const loanPlayers = (tr.loanPlayerIds || [])
                .map((pid) => db.players.find((p) => p.id === pid))
                .filter(Boolean) as Player[];
              const remaining = tr.gamesRemaining ?? 4;
              const total = tr.gamesTotal ?? 4;
              const completedGames = total - remaining;

              return (
                <div
                  key={tr.id}
                  className="rounded-2xl border border-white/10 bg-[#111821] p-5 space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-amber-400" />
                        <span className="font-display text-xl font-bold text-white">
                          4-Game Loan ({tr.loanMode === 'rotating' ? 'Multi-Player Rotating' : 'Single Player'}):{' '}
                          {loanPlayers.map((p) => p.name).join(', ')}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {lTeam?.name} (Parent Club) → {bTeam?.name} (Borrowing Club)
                      </div>
                    </div>

                    <div className="text-right">
                      <div
                        className={`font-mono-num text-sm font-bold ${
                          tr.status === 'Active'
                            ? 'text-amber-400'
                            : tr.status === 'Completed'
                            ? 'text-emerald-400'
                            : 'text-slate-300'
                        }`}
                      >
                        {tr.status === 'Active'
                          ? `${remaining} of ${total} games remaining`
                          : tr.status}
                      </div>
                      {tr.status === 'Active' && (
                        <div className="text-[11px] font-semibold text-rose-400 mt-0.5">
                          Ineligible for Original Team (4 Games)
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    {[1, 2, 3, 4].map((slot) => {
                      const used = slot <= completedGames;
                      const log = tr.gameLogs?.[slot - 1];
                      return (
                        <div
                          key={slot}
                          className={`rounded-lg border px-3 py-2 text-xs ${
                            used
                              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                              : 'border-white/10 bg-[#090D12] text-slate-400'
                          }`}
                        >
                          <div className="font-mono-num font-bold">Game {slot}/4</div>
                          <div className="truncate text-[11px] mt-0.5">
                            {log ? log.playerName : tr.status === 'Active' ? 'Remaining' : 'Queued'}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {tr.status === 'Pending' && tr.loanApprovals && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2">
                      <div className="rounded-xl border border-white/10 bg-[#090D12] p-3 flex items-center justify-between">
                        <div>
                          <div className="text-[11px] text-slate-400">{bTeam?.name} Captain</div>
                          <div className="text-xs font-semibold text-white">
                            {tr.loanApprovals.borrowingCaptain ? 'Approved' : 'Pending'}
                          </div>
                        </div>
                        {!tr.loanApprovals.borrowingCaptain && (
                          <button
                            type="button"
                            onClick={() => handleApprove(tr.id, 'borrowingCaptain')}
                            className="rounded-md bg-emerald-500 px-2.5 py-1 text-[11px] font-semibold text-slate-950 cursor-pointer"
                          >
                            Approve
                          </button>
                        )}
                      </div>

                      <div className="rounded-xl border border-white/10 bg-[#090D12] p-3 flex items-center justify-between">
                        <div>
                          <div className="text-[11px] text-slate-400">{lTeam?.name} Captain</div>
                          <div className="text-xs font-semibold text-white">
                            {tr.loanApprovals.lendingCaptain ? 'Approved' : 'Pending'}
                          </div>
                        </div>
                        {!tr.loanApprovals.lendingCaptain && (
                          <button
                            type="button"
                            onClick={() => handleApprove(tr.id, 'lendingCaptain')}
                            className="rounded-md bg-emerald-500 px-2.5 py-1 text-[11px] font-semibold text-slate-950 cursor-pointer"
                          >
                            Approve
                          </button>
                        )}
                      </div>

                      <div className="rounded-xl border border-white/10 bg-[#090D12] p-3 space-y-1.5">
                        <div className="text-[11px] text-slate-400">Player Acceptance</div>
                        {loanPlayers.map((lp) => {
                          const ok = tr.loanApprovals?.playersAccepted[lp.id];
                          return (
                            <div key={lp.id} className="flex items-center justify-between text-xs">
                              <span className="text-white">{lp.name}</span>
                              {ok ? (
                                <span className="text-emerald-400 font-semibold">Accepted</span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleApprove(tr.id, 'player', lp.id)}
                                  className="rounded bg-amber-400 px-2 py-0.5 text-[11px] font-semibold text-slate-950 cursor-pointer"
                                >
                                  Accept
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* TAB 3: SINGLE-GAME EMERGENCY SUB REQUEST BOARD ("NEED A SUB TONIGHT") */}
      {marketTab === 'subs' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 rounded-2xl border border-white/10 bg-[#111821] p-5 space-y-4">
            <div className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-emerald-400" />
              <h2 className="font-display text-xl font-bold text-white">
                Need a Sub Tonight — Post Slot
              </h2>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              For single-game emergency coverage when RSVPs drop below full strength. Automatically disabled during cash-prize playoffs to prevent ringers.
            </p>

            {league.isPlayoffsActive ? (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-300">
                Playoffs Active: Single-game sub requests are locked during cash-prize playoff rounds.
              </div>
            ) : (
              <form onSubmit={handlePostSub} className="space-y-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Upcoming Match ({activeTeam.name})
                  </label>
                  <select
                    value={subMatchId || myUpcomingMatches[0]?.id || ''}
                    onChange={(e) => setSubMatchId(e.target.value)}
                    className="w-full rounded-lg border border-white/15 bg-[#090D12] px-3 py-2 text-xs text-white"
                  >
                    {myUpcomingMatches.length === 0 ? (
                      <option value="">No scheduled regular matches</option>
                    ) : (
                      myUpcomingMatches.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.scheduledDate} {m.scheduledTime} — {m.homeTeamName} vs {m.awayTeamName} ({m.fieldNumber})
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Position Needed</label>
                    <select
                      value={subPosition}
                      onChange={(e) => setSubPosition(e.target.value as PlayerPosition | 'ANY')}
                      className="w-full rounded-lg border border-white/15 bg-[#090D12] px-3 py-2 text-xs text-white"
                    >
                      <option value="ANY">Any Position</option>
                      <option value="GK">Goalkeeper (GK)</option>
                      <option value="DEF">Defender (DEF)</option>
                      <option value="MID">Midfielder (MID)</option>
                      <option value="FWD">Forward (FWD)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Sub Fee</label>
                    <select
                      value={subFee}
                      onChange={(e) => setSubFee(e.target.value)}
                      className="w-full rounded-lg border border-white/15 bg-[#090D12] px-3 py-2 text-xs text-white"
                    >
                      <option value="Free / Covered by Team">Free / Covered by Team</option>
                      <option value="$10 Pitch-In">$10 Pitch-In</option>
                      <option value="$15 Pitch-In">$15 Pitch-In</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={busy || myUpcomingMatches.length === 0}
                  className="w-full min-h-[42px] rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-40 cursor-pointer"
                >
                  Post 1-Click Sub Request
                </button>
              </form>
            )}
          </div>

          <div className="lg:col-span-7 space-y-3">
            {leagueSubs.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-[#111821] p-10 text-center text-sm text-slate-400">
                No open emergency sub requests in this division.
              </div>
            ) : (
              leagueSubs.map((sub) => (
                <div
                  key={sub.id}
                  className="rounded-2xl border border-white/10 bg-[#111821] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-display text-xl font-bold text-white">
                        {sub.teamName} needs {sub.positionNeeded}
                      </span>
                      <span
                        className={`text-xs font-semibold ${
                          sub.status === 'Open' ? 'text-amber-400' : 'text-emerald-400'
                        }`}
                      >
                        · {sub.status}
                      </span>
                    </div>
                    <div className="text-xs text-slate-300">
                      {sub.matchDate} {sub.matchTime} · {sub.fieldLocation}
                    </div>
                    <div className="text-xs text-slate-400">
                      Skill Tier: {sub.skillLevel} · Fee: {sub.subFee}
                    </div>
                    {sub.claimedByName && (
                      <div className="text-xs text-emerald-400 font-medium">
                        Claimed by {sub.claimedByName} (Ref Check-In Ready)
                      </div>
                    )}
                  </div>

                  {sub.status === 'Open' && (
                    <button
                      type="button"
                      disabled={busy || sub.teamId === activeTeam.id}
                      onClick={() => handleClaimSub(sub.id)}
                      className="min-h-[42px] shrink-0 rounded-lg bg-amber-400 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-amber-300 disabled:opacity-40 cursor-pointer"
                    >
                      {sub.teamId === activeTeam.id ? 'Your Team Post' : 'Claim Sub Spot'}
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 4: DONE DEALS TICKER */}
      {marketTab === 'deals' && (
        <div className="rounded-2xl border border-white/10 bg-[#111821] divide-y divide-white/10">
          {leagueDeals.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-400">No completed deals yet.</div>
          ) : (
            leagueDeals.map((d) => (
              <div key={d.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-start gap-3">
                  <UserCheck className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-sm font-semibold text-white">{d.summary}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{d.details}</div>
                  </div>
                </div>
                <div className="font-mono-num text-xs text-slate-500">
                  {new Date(d.timestamp).toLocaleDateString()}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Proposal Modal */}
      {proposalKind && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-[#111821] p-6 shadow-2xl space-y-5">
            <div className="flex items-start justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="font-display text-2xl font-bold text-white">
                  {proposalKind === 'swap'
                    ? 'Propose Mandatory 1-for-1 Swap'
                    : 'Propose 4-Game Loan'}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {proposalKind === 'swap'
                    ? 'Both players and both captains must approve before rosters update.'
                    : 'Loaned players are locked as Ineligible for Original Team for 4 games.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setProposalKind(null)}
                className="text-slate-400 hover:text-white text-sm cursor-pointer"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleSubmitProposal} className="space-y-4">
              {proposalKind === 'swap' ? (
                <>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Target Club</label>
                    <select
                      value={targetTeamId}
                      onChange={(e) => {
                        const tid = e.target.value;
                        setTargetTeamId(tid);
                        const first = leaguePlayers.find((p) => p.teamId === tid && !p.activeLoanId);
                        setTargetPlayerId(first?.id || '');
                      }}
                      className="w-full rounded-lg border border-white/15 bg-[#090D12] px-3 py-2.5 text-sm text-white"
                    >
                      {otherTeams.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Incoming Player
                      </label>
                      <select
                        value={targetPlayerId}
                        onChange={(e) => setTargetPlayerId(e.target.value)}
                        className="w-full rounded-lg border border-white/15 bg-[#090D12] px-3 py-2.5 text-sm text-white"
                      >
                        {lendingRoster.map((p) => (
                          <option key={p.id} value={p.id}>{p.name} ({p.position})</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Outgoing Player ({activeTeam.name})
                      </label>
                      <select
                        value={offeredPlayerId}
                        onChange={(e) => setOfferedPlayerId(e.target.value)}
                        className="w-full rounded-lg border border-white/15 bg-[#090D12] px-3 py-2.5 text-sm text-white"
                      >
                        {myRoster.map((p) => (
                          <option key={p.id} value={p.id}>{p.name} ({p.position})</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2 rounded-xl bg-[#090D12] p-1 border border-white/10">
                    <button
                      type="button"
                      onClick={() => setLoanMode('single')}
                      className={`min-h-[40px] rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer ${
                        loanMode === 'single' ? 'bg-amber-400 text-slate-950' : 'text-slate-400'
                      }`}
                    >
                      Single Player (4 Games)
                    </button>
                    <button
                      type="button"
                      onClick={() => setLoanMode('rotating')}
                      className={`min-h-[40px] rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer ${
                        loanMode === 'rotating' ? 'bg-amber-400 text-slate-950' : 'text-slate-400'
                      }`}
                    >
                      Multi-Player Rotating (Up to 4)
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Lending Parent Club
                    </label>
                    <select
                      value={targetTeamId}
                      onChange={(e) => {
                        const tid = e.target.value;
                        setTargetTeamId(tid);
                        const first = leaguePlayers.find(
                          (p) => p.teamId === tid && !p.activeLoanId && p.loansUsedThisSeason === 0
                        );
                        setTargetPlayerId(first?.id || '');
                        setRotatingPlayerIds(first ? [first.id] : []);
                      }}
                      className="w-full rounded-lg border border-white/15 bg-[#090D12] px-3 py-2.5 text-sm text-white"
                    >
                      {otherTeams.map((t) => {
                        const r = standings.find((s) => s.teamId === t.id)?.rank ?? 1;
                        return <option key={t.id} value={t.id}>#{r} {t.name}</option>;
                      })}
                    </select>
                  </div>

                  {loanMode === 'single' ? (
                    <select
                      value={targetPlayerId}
                      onChange={(e) => setTargetPlayerId(e.target.value)}
                      className="w-full rounded-lg border border-white/15 bg-[#090D12] px-3 py-2.5 text-sm text-white"
                    >
                      {lendingRoster.map((p) => (
                        <option key={p.id} value={p.id} disabled={p.loansUsedThisSeason >= 1}>
                          {p.name} ({p.position}){p.loansUsedThisSeason >= 1 ? ' — 1-Loan Used' : ''}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="max-h-40 overflow-y-auto rounded-xl border border-white/10 bg-[#090D12] p-2 space-y-1">
                      {lendingRoster.map((p) => {
                        const checked = rotatingPlayerIds.includes(p.id);
                        const disabled = p.loansUsedThisSeason >= 1 || (!checked && rotatingPlayerIds.length >= 4);
                        return (
                          <label
                            key={p.id}
                            className="flex items-center justify-between rounded-lg px-2.5 py-2 hover:bg-white/5 cursor-pointer"
                          >
                            <div className="flex items-center gap-2.5">
                              <input
                                type="checkbox"
                                disabled={disabled}
                                checked={checked}
                                onChange={(e) => {
                                  if (e.target.checked) setRotatingPlayerIds((prev) => [...prev, p.id]);
                                  else setRotatingPlayerIds((prev) => prev.filter((id) => id !== p.id));
                                }}
                              />
                              <span className="text-xs text-white">{p.name} ({p.position})</span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}

                  <div className="rounded-lg border border-amber-400/25 bg-amber-400/5 p-3 flex items-start gap-2.5 text-xs text-amber-200">
                    <ShieldAlert className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                    <span>
                      Participating player(s) are locked as <strong>Ineligible for Original Team (4 Games)</strong>.
                    </span>
                  </div>
                </>
              )}

              <input
                type="text"
                placeholder="Note (Optional)"
                value={proposalNote}
                onChange={(e) => setProposalNote(e.target.value)}
                className="w-full rounded-lg border border-white/15 bg-[#090D12] px-3 py-2 text-xs text-white"
              />

              {feedback?.type === 'err' && (
                <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
                  {feedback.msg}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setProposalKind(null)}
                  className="min-h-[42px] rounded-lg border border-white/15 px-4 py-2 text-xs font-medium text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="min-h-[42px] rounded-lg bg-emerald-500 px-5 py-2 text-xs font-semibold text-slate-950 cursor-pointer"
                >
                  Send Proposal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
