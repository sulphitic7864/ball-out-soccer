import React, { useMemo, useState } from 'react';
import {
  MessageSquare,
  Car,
  Users,
  Shield,
  CalendarPlus,
  MapPin,
  AlertTriangle,
  Copy,
  Check,
  Award,
  Flag,
  VolumeX,
  Lock,
  Send,
  Palette,
  Sparkles,
  Trash2,
  UserPlus,
  Calendar,
  Trophy,
} from 'lucide-react';
import type { LeagueDatabase, Player, RideRequest } from '../types.ts';
import {
  checkPlayerMarketCooldown,
  computeMatchClockBreakdown,
  computeStandings,
  getEffectiveTeamCaps,
} from '../utils/leagueHelpers.ts';
import { PlayerCardModal, TeamStudioPanel } from './TeamStudioAndCards.tsx';

interface ClubhouseProps {
  db: LeagueDatabase;
  selectedTeamId: string;
  onSelectTeam: (id: string) => void;
  activePlayerId: string;
  onSelectActivePlayer: (id: string) => void;
  onOpenSplitJoin: (splitCode: string) => void;
  onOpenRegister: (
    leagueId: string,
    mode?: 'team' | 'split' | 'solo' | 'waitlist',
    splitCode?: string
  ) => void;
  onGoToMarket: (tab?: 'board' | 'requests' | 'subs' | 'deals', leagueId?: string, playerId?: string) => void;
  onOpenAdmin?: () => void;
  onDatabaseUpdate: (db: LeagueDatabase) => void;
}

export const Clubhouse: React.FC<ClubhouseProps> = ({
  db,
  selectedTeamId,
  onSelectTeam,
  activePlayerId,
  onSelectActivePlayer,
  onOpenSplitJoin,
  onOpenRegister,
  onGoToMarket,
  onOpenAdmin,
  onDatabaseUpdate,
}) => {
  const [subTab, setSubTab] = useState<'locker' | 'press' | 'honors' | 'opponent' | 'rides' | 'roster' | 'studio'>('locker');
  const [copied, setCopied] = useState(false);
  const [cardModalPlayer, setCardModalPlayer] = useState<Player | null>(null);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteGender, setInviteGender] = useState<'Male' | 'Female'>('Male');
  const [invitePos, setInvitePos] = useState<Player['position']>('MID');
  const [recruitGenderFilter, setRecruitGenderFilter] = useState<'All' | 'Male' | 'Female'>('All');
  const [recruitPosFilter, setRecruitPosFilter] = useState<'All' | Player['position']>('All');

  // Locker Room states
  const [teamMsgText, setTeamMsgText] = useState('');
  const [dmTargetId, setDmTargetId] = useState('');
  const [dmText, setDmText] = useState('');
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptionsText, setPollOptionsText] = useState('Yes, bring ball, Need backup');
  const [pressStatement, setPressStatement] = useState('');

  // Opponent Lobby states
  const [selectedLobbyMatchId, setSelectedLobbyMatchId] = useState('');
  const [opponentMsgText, setOpponentMsgText] = useState('');

  // Ride Hub states
  const [rideLandmarkType, setRideLandmarkType] =
    useState<RideRequest['landmarkType']>('Subway / GO Station');
  const [rideLandmarkName, setRideLandmarkName] = useState('');
  const [rideMatchTime, setRideMatchTime] = useState('6:30 PM');
  const [rideSeatMap, setRideSeatMap] = useState<Record<string, number>>({});
  const [rideCostMap, setRideCostMap] = useState<Record<string, 'Free Lift' | 'Split Gas ($5)'>>({});
  const [rideChatInputs, setRideChatInputs] = useState<Record<string, string>>({});

  const [statusFeedback, setStatusFeedback] = useState('');

  const team = db.teams.find((t) => t.id === selectedTeamId) || db.teams[0];
  const league = db.leagues.find((l) => l.id === team?.leagueId) || db.leagues[0];
  const venue = db.venues.find((v) => v.id === league?.venueId);

  const roster = useMemo(
    () => (team ? db.players.filter((p) => p.teamId === team.id) : []),
    [db.players, team]
  );

  const actingPlayer =
    roster.find((p) => p.id === activePlayerId) ||
    db.players.find((p) => p.id === activePlayerId) ||
    roster[0];

  const standings = useMemo(
    () => (league ? computeStandings(league.id, db.teams, db.matches) : []),
    [league, db.teams, db.matches]
  );

  if (!team || !league || !actingPlayer) {
    const firstLeague = db.leagues[0];
    return (
      <div className="mx-auto max-w-4xl px-4 sm:px-6 py-16">
        <div className="rounded-2xl border border-white/10 bg-[#111821] p-8 sm:p-10 text-center space-y-5">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
            <Shield className="h-6 w-6" />
          </div>
          <h1 className="font-display text-3xl font-bold text-white">
            Player Team Clubhouse &amp; Hub
          </h1>
          <p className="text-sm text-slate-400 max-w-lg mx-auto leading-relaxed">
            {!firstLeague
              ? 'No active leagues are published yet. The Admin only creates and manages leagues — once a league is published, players form, join, and manage their own teams right here.'
              : 'Teams are formed directly by players in the Hub. Create a new squad, join an existing team via Split-Pay code, or enter as a Solo Free Agent to unlock Locker Room chat, QR Recruit Posters, Lineup Tactics Board, and Ride Hub.'}
          </p>
          {firstLeague ? (
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => onOpenRegister(firstLeague.id, 'team')}
                className="min-h-[42px] rounded-lg bg-emerald-500 px-5 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400 cursor-pointer"
              >
                Create a Team (${firstLeague.entryFeeTeam})
              </button>
              <button
                type="button"
                onClick={() => onOpenRegister(firstLeague.id, 'split')}
                className="min-h-[42px] rounded-lg border border-white/15 bg-[#090D12] px-5 py-2 text-xs font-semibold text-white hover:bg-white/5 cursor-pointer"
              >
                Join via Split-Pay Code
              </button>
              <button
                type="button"
                onClick={() => onOpenRegister(firstLeague.id, 'solo')}
                className="min-h-[42px] rounded-lg border border-amber-400/35 bg-amber-400/10 px-5 py-2 text-xs font-semibold text-amber-300 hover:bg-amber-400/20 cursor-pointer"
              >
                Free Agent (${firstLeague.entryFeeSolo})
              </button>
            </div>
          ) : (
            onOpenAdmin && (
              <button
                type="button"
                onClick={onOpenAdmin}
                className="min-h-[42px] rounded-lg bg-emerald-500 px-5 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400 cursor-pointer"
              >
                Open Admin Console to Publish League (PIN: {db.brand.adminPin})
              </button>
            )
          )}
        </div>
      </div>
    );
  }

  const nextMatch = db.matches
    .filter(
      (m) =>
        m.leagueId === league.id &&
        m.status === 'Scheduled' &&
        (m.homeTeamId === team.id || m.awayTeamId === team.id)
    )
    .sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime())[0];
  const lastFinalMatch = db.matches
    .filter(
      (m) =>
        m.leagueId === league.id &&
        m.status === 'Final' &&
        (m.homeTeamId === team.id || m.awayTeamId === team.id)
    )
    .sort((a, b) => new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime())[0];
  const rsvpOpensAt = lastFinalMatch ? new Date(lastFinalMatch.scheduledDate) : null;
  if (rsvpOpensAt) {
    rsvpOpensAt.setDate(rsvpOpensAt.getDate() + 1);
    rsvpOpensAt.setHours(0, 0, 0, 0);
  }
  const rsvpOpen =
    !rsvpOpensAt || Number.isNaN(rsvpOpensAt.getTime()) || Date.now() >= rsvpOpensAt.getTime();

  const opponentTeamId =
    nextMatch?.homeTeamId === team.id ? nextMatch?.awayTeamId : nextMatch?.homeTeamId;
  const opponentTeam = db.teams.find((t) => t.id === opponentTeamId);

  const matchRsvps = nextMatch
    ? db.rsvps.filter((r) => r.matchId === nextMatch.id && r.teamId === team.id)
    : [];
  const inCount = matchRsvps.filter((r) => r.status === 'IN').length;
  const lowAttendanceAlert = Boolean(nextMatch) && inCount < 6;

  const teamChat = db.teamMessages.filter((m) => m.teamId === team.id);
  const teamPolls = db.polls.filter((p) => p.teamId === team.id);

  const dmPeerId = dmTargetId || roster.find((p) => p.id !== actingPlayer.id)?.id || '';
  const dmPeer = db.players.find((p) => p.id === dmPeerId);
  const dmThread = db.directMessages.filter(
    (d) =>
      (d.fromPlayerId === actingPlayer.id && d.toPlayerId === dmPeerId) ||
      (d.fromPlayerId === dmPeerId && d.toPlayerId === actingPlayer.id)
  );

  const lobbyMatches = db.matches.filter(
    (m) => m.leagueId === league.id && (m.homeTeamId === team.id || m.awayTeamId === team.id)
  );
  const activeLobbyMatch =
    lobbyMatches.find((m) => m.id === selectedLobbyMatchId) || nextMatch || lobbyMatches[0];
  const lobbyMessages = activeLobbyMatch
    ? db.opponentMessages.filter((m) => m.matchId === activeLobbyMatch.id)
    : [];

  const downloadCalendarIcs = () => {
    if (!nextMatch) return;
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      `SUMMARY:${team.name} vs ${opponentTeam?.name || 'Opponent'} (${league.name})`,
      `LOCATION:${venue?.name || league.locationName} - ${nextMatch.fieldNumber}`,
      `DESCRIPTION:Kit Color: ${team.kitColorName || 'Custom'} vs ${opponentTeam?.kitColorName || 'Away'}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\n');
    const blob = new Blob([ics], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${team.name.replace(/\s+/g, '_')}_Match.ics`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRsvp = async (status: 'IN' | 'OUT' | 'MAYBE') => {
    if (!nextMatch || !rsvpOpen) return;
    const res = await fetch('/api/clubhouse/rsvp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        matchId: nextMatch.id,
        teamId: team.id,
        playerId: actingPlayer.id,
        playerName: actingPlayer.name,
        status,
      }),
    });
    if (res.ok) onDatabaseUpdate(await res.json());
  };

  const handleSendTeamMsg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamMsgText.trim()) return;
    const res = await fetch('/api/clubhouse/team-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        teamId: team.id,
        senderId: actingPlayer.id,
        senderName: actingPlayer.name,
        text: teamMsgText,
      }),
    });
    if (res.ok) {
      onDatabaseUpdate(await res.json());
      setTeamMsgText('');
    }
  };

  const handleSendDm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dmText.trim() || !dmPeer) return;
    const res = await fetch('/api/clubhouse/dm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromPlayerId: actingPlayer.id,
        fromName: actingPlayer.name,
        toPlayerId: dmPeer.id,
        toName: dmPeer.name,
        text: dmText,
      }),
    });
    if (res.ok) {
      onDatabaseUpdate(await res.json());
      setDmText('');
    }
  };

  const handleCreatePoll = async (e: React.FormEvent) => {
    e.preventDefault();
    const opts = pollOptionsText.split(',').map((s) => s.trim()).filter(Boolean);
    const res = await fetch('/api/clubhouse/polls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        teamId: team.id,
        question: pollQuestion,
        createdByName: actingPlayer.name,
        options: opts,
      }),
    });
    if (res.ok) {
      onDatabaseUpdate(await res.json());
      setPollQuestion('');
    }
  };

  const handleVotePoll = async (pollId: string, optionId: string) => {
    const res = await fetch(`/api/clubhouse/polls/${pollId}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ optionId, playerId: actingPlayer.id }),
    });
    if (res.ok) onDatabaseUpdate(await res.json());
  };

  const handleVoteMotm = async (nomineeId: string) => {
    if (!lastFinalMatch) return;
    const res = await fetch('/api/clubhouse/motm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        matchId: lastFinalMatch.id,
        teamId: team.id,
        voterPlayerId: actingPlayer.id,
        nomineePlayerId: nomineeId,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      onDatabaseUpdate(data);
      setStatusFeedback('Man of the Match vote recorded!');
    } else {
      setStatusFeedback(data.error || 'Already voted');
    }
  };

  const handleSendOpponentMsg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeLobbyMatch || !opponentMsgText.trim()) return;
    const res = await fetch('/api/opponent-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        matchId: activeLobbyMatch.id,
        senderPlayerId: actingPlayer.id,
        senderName: actingPlayer.name,
        teamName: team.name,
        text: opponentMsgText,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      onDatabaseUpdate(data);
      setOpponentMsgText('');
    } else {
      setStatusFeedback(data.error || 'Could not send message');
    }
  };

  const handlePostRide = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/rides', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        leagueId: league.id,
        riderPlayerId: actingPlayer.id,
        landmarkType: rideLandmarkType,
        landmarkName: rideLandmarkName,
        matchDate: nextMatch?.scheduledDate || 'Next Matchday',
        matchTime: rideMatchTime,
      }),
    });
    if (res.ok) {
      onDatabaseUpdate(await res.json());
      setRideLandmarkName('');
      setStatusFeedback('Public landmark pickup pin posted to Ride Hub.');
    }
  };

  const rank = standings.find((s) => s.teamId === team.id)?.rank ?? 1;
  const balanceDue = Math.max(0, Math.round((team.totalFee - team.amountPaid) * 100) / 100);
  const splitLink = `${window.location.origin}/?join=${team.splitPayCode}`;
  const perPlayerSplit = Math.round((team.totalFee / Math.max(1, team.splitTargetPlayers)) * 100) / 100;
  const perCurrentRosterSplit = Math.round((team.totalFee / Math.max(1, roster.length)) * 100) / 100;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 pb-24 space-y-6">
      {/* Header Switchers */}
      <div className="rounded-2xl border border-white/10 bg-[#111821] p-5 sm:p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="text-xs font-medium text-emerald-400">
              Team Locker Room, Opponent Match Lobby, Ride Hub & Split-Pay
            </div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-white mt-0.5">
              {team.name} Clubhouse
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              {league.name} · Rank #{rank} · Acting as: <span className="text-white font-semibold">{actingPlayer.name}</span>
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <select
              aria-label="Select Team"
              value={team.id}
              onChange={(e) => {
                onSelectTeam(e.target.value);
                const firstOnTeam = db.players.find((p) => p.teamId === e.target.value);
                if (firstOnTeam) onSelectActivePlayer(firstOnTeam.id);
              }}
              className="min-h-[42px] rounded-lg border border-white/15 bg-[#090D12] px-3 py-2 text-xs font-medium text-white"
            >
              {db.teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>

            <select
              aria-label="Acting Player"
              value={actingPlayer.id}
              onChange={(e) => onSelectActivePlayer(e.target.value)}
              className="min-h-[42px] rounded-lg border border-white/15 bg-[#090D12] px-3 py-2 text-xs font-medium text-white"
            >
              {roster.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.isCaptain ? 'Captain' : p.position})
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => onOpenRegister(league.id, 'team')}
              className="min-h-[42px] inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-3.5 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 cursor-pointer"
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span>Create / Join Team</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pt-2 border-t border-white/10">
          {[
            { id: 'locker' as const, label: 'Locker Room & RSVP', icon: <MessageSquare className="h-4 w-4" /> },
            { id: 'press' as const, label: 'Post-Match Press', icon: <Award className="h-4 w-4" /> },
            { id: 'honors' as const, label: 'Board & Badges', icon: <Sparkles className="h-4 w-4" /> },
            { id: 'opponent' as const, label: 'Opponent Match Lobby', icon: <Shield className="h-4 w-4" /> },
            { id: 'rides' as const, label: `Ride Hub (${db.rides.length})`, icon: <Car className="h-4 w-4" /> },
            { id: 'roster' as const, label: 'Roster, Invites & Split-Pay', icon: <Users className="h-4 w-4" /> },
            { id: 'studio' as const, label: 'Team Studio, QR & Lineup', icon: <Palette className="h-4 w-4" /> },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSubTab(tab.id)}
              className={`min-h-[40px] inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
                subTab === tab.id
                  ? 'bg-emerald-500 text-slate-950'
                  : 'border border-white/10 bg-[#090D12] text-slate-300 hover:text-white'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {statusFeedback && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs text-emerald-300">
          {statusFeedback}
        </div>
      )}

      {/* TAB 1: LOCKER ROOM, RSVP, POLLS, DMs & MOTM */}
      {subTab === 'locker' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Matchday RSVP + Kit Check + Polls + MOTM */}
          <div className="lg:col-span-5 space-y-6">
            {nextMatch && (() => {
              const nextClock = computeMatchClockBreakdown(
                nextMatch.scheduledTime,
                nextMatch.firstHalfMins ?? 25,
                nextMatch.halftimeMins ?? 5,
                nextMatch.secondHalfMins ?? 25
              );
              return (
              <div className="rounded-2xl border border-white/10 bg-[#111821] p-5 space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-[11px] font-semibold text-emerald-400">
                      Next Matchday Card · Assigned Field: {nextMatch.fieldNumber}
                    </div>
                    <h2 className="font-display text-2xl font-bold text-white mt-0.5">
                      {team.name} vs {opponentTeam?.name || 'Opponent'}
                    </h2>
                    <div className="text-xs text-slate-400 mt-0.5 font-mono-num">
                      {nextMatch.scheduledDate} · {nextClock.timelineLabel}
                    </div>
                  </div>
                </div>

                {/* Jersey / Kit Check */}
                <div className="rounded-xl border border-white/10 bg-[#090D12] p-3 flex items-center justify-between text-xs">
                  <span>
                    Your Kit: <strong className="text-white">{team.kitColorName || 'Home'}</strong>
                  </span>
                  <span className="text-slate-600">|</span>
                  <span>
                    Opponent: <strong className="text-white">{opponentTeam?.kitColorName || 'Away'}</strong>
                  </span>
                </div>

                {/* 1-Tap RSVP */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-white">1-Tap Game Day RSVP</span>
                    <span className="font-mono-num text-emerald-400">{inCount} Marked IN</span>
                  </div>
                  {rsvpOpen ? (
                    <div className="grid grid-cols-3 gap-2">
                      {(['IN', 'MAYBE', 'OUT'] as const).map((st) => {
                        const current = matchRsvps.find((r) => r.playerId === actingPlayer.id)?.status;
                        return (
                          <button
                            key={st}
                            type="button"
                            onClick={() => handleRsvp(st)}
                            className={`min-h-[42px] rounded-lg border text-xs font-bold cursor-pointer ${
                              current === st
                                ? st === 'IN'
                                  ? 'border-emerald-500 bg-emerald-500 text-slate-950'
                                  : st === 'MAYBE'
                                  ? 'border-amber-400 bg-amber-400 text-slate-950'
                                  : 'border-rose-500 bg-rose-500 text-white'
                                : 'border-white/15 bg-[#090D12] text-slate-300 hover:bg-white/5'
                            }`}
                          >
                            {st}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="rounded-lg border border-white/10 bg-[#090D12] px-3 py-2 text-xs text-slate-400">
                      Match check-in opens {rsvpOpensAt?.toLocaleDateString()} — the day after your previous game.
                    </p>
                  )}
                </div>

                {/* Low Attendance Captain Warning */}
                {lowAttendanceAlert && (
                  <div className="rounded-xl border border-amber-400/35 bg-amber-400/10 p-3.5 space-y-2.5">
                    <div className="flex items-start gap-2 text-xs text-amber-200">
                      <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                      <span>
                        Low RSVP Alert: Only <strong>{inCount}</strong> players marked IN. Request a 4-Game Loan or Emergency Sub before kickoff.
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => onGoToMarket('subs', league.id, actingPlayer.id)}
                        className="rounded-md bg-amber-400 px-3 py-1.5 text-[11px] font-bold text-slate-950 cursor-pointer"
                      >
                        Post Sub Request
                      </button>
                      <button
                        type="button"
                        onClick={() => onGoToMarket('board', league.id, actingPlayer.id)}
                        className="rounded-md border border-white/20 px-3 py-1.5 text-[11px] font-semibold text-white cursor-pointer"
                      >
                        Request 4-Game Loan
                      </button>
                    </div>
                  </div>
                )}

                {/* Calendar Sync & Maps Directions */}
                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={downloadCalendarIcs}
                    className="min-h-[40px] inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-white hover:bg-white/10 cursor-pointer"
                  >
                    <CalendarPlus className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Sync Calendar</span>
                  </button>
                  <a
                    href={venue?.mapsUrl || `https://maps.google.com/?q=${encodeURIComponent(league.locationName)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="min-h-[40px] inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-white hover:bg-white/10"
                  >
                    <MapPin className="h-3.5 w-3.5 text-amber-400" />
                    <span>Field Directions</span>
                  </a>
                </div>
              </div>
              );
            })()}

            {/* Quick Polls */}
            <div className="rounded-2xl border border-white/10 bg-[#111821] p-5 space-y-4">
              <h3 className="font-display text-xl font-bold text-white">Quick Team Polls</h3>
              {teamPolls.map((poll) => (
                <div key={poll.id} className="rounded-xl border border-white/10 bg-[#090D12] p-3.5 space-y-2.5">
                  <div className="text-xs font-semibold text-white">{poll.question}</div>
                  <div className="space-y-1.5">
                    {poll.options.map((opt) => {
                      const voted = opt.voterIds.includes(actingPlayer.id);
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => handleVotePoll(poll.id, opt.id)}
                          className={`w-full flex items-center justify-between rounded-lg border px-3 py-2 text-xs cursor-pointer ${
                            voted
                              ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300'
                              : 'border-white/10 bg-[#111821] text-slate-300'
                          }`}
                        >
                          <span>{opt.label}</span>
                          <span className="font-mono-num font-bold">{opt.voterIds.length}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              <form onSubmit={handleCreatePoll} className="space-y-2 pt-2 border-t border-white/10">
                <input
                  type="text"
                  required
                  placeholder="Ask a 5-second poll question…"
                  value={pollQuestion}
                  onChange={(e) => setPollQuestion(e.target.value)}
                  className="w-full rounded-lg border border-white/15 bg-[#090D12] px-3 py-2 text-xs text-white"
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={pollOptionsText}
                    onChange={(e) => setPollOptionsText(e.target.value)}
                    placeholder="Options comma-separated"
                    className="flex-1 rounded-lg border border-white/15 bg-[#090D12] px-3 py-1.5 text-xs text-slate-300"
                  />
                  <button
                    type="submit"
                    className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-950 cursor-pointer"
                  >
                    Post Poll
                  </button>
                </div>
              </form>
            </div>

            {/* Post-Match MOTM Voting */}
            {lastFinalMatch && (
              <div className="rounded-2xl border border-white/10 bg-[#111821] p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Award className="h-4 w-4 text-amber-400" />
                  <h3 className="font-display text-xl font-bold text-white">
                    Post-Match Man of the Match Vote
                  </h3>
                </div>
                <p className="text-xs text-slate-400">
                  Vote for your standout teammate from {lastFinalMatch.homeTeamName} vs {lastFinalMatch.awayTeamName}.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {roster.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleVoteMotm(p.id)}
                      className="rounded-lg border border-white/10 bg-[#090D12] px-3 py-2 text-left text-xs text-white hover:border-amber-400/40 cursor-pointer"
                    >
                      <div className="font-semibold">{p.name}</div>
                      <div className="text-[11px] text-amber-300 font-mono-num">
                        {p.motmAwards ?? 0} MOTM
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Private Team Group Chat & 1-on-1 DMs */}
          <div className="lg:col-span-7 space-y-6">
            <div className="rounded-2xl border border-white/10 bg-[#111821] p-5 flex flex-col h-[380px]">
              <div className="border-b border-white/10 pb-3 flex items-center justify-between">
                <div>
                  <h2 className="font-display text-xl font-bold text-white">
                    {team.name} Private Locker Room Chat
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    No phone numbers exposed. Coordinate kits, loans, and carpools.
                  </p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto py-4 space-y-3">
                {teamChat.map((m) => (
                  <div key={m.id} className="rounded-xl border border-white/5 bg-[#090D12] p-3">
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span className="font-semibold text-emerald-400">{m.senderName}</span>
                      <span className="font-mono-num">
                        {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-xs text-slate-100 mt-1">{m.text}</p>
                  </div>
                ))}
              </div>

              <form onSubmit={handleSendTeamMsg} className="flex gap-2 pt-3 border-t border-white/10">
                <input
                  type="text"
                  placeholder={`Message ${team.name} locker room…`}
                  value={teamMsgText}
                  onChange={(e) => setTeamMsgText(e.target.value)}
                  className="flex-1 min-h-[42px] rounded-lg border border-white/15 bg-[#090D12] px-3 py-2 text-xs text-white"
                />
                <button
                  type="submit"
                  className="min-h-[42px] inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 cursor-pointer"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>Send</span>
                </button>
              </form>
            </div>

            {/* 1-on-1 Direct Messages */}
            <div className="rounded-2xl border border-white/10 bg-[#111821] p-5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
                <div>
                  <h3 className="font-display text-xl font-bold text-white">
                    1-on-1 Player Direct Messages
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Message teammates privately without sharing personal phone numbers.
                  </p>
                </div>
                <select
                  value={dmPeerId}
                  onChange={(e) => setDmTargetId(e.target.value)}
                  className="rounded-lg border border-white/15 bg-[#090D12] px-3 py-1.5 text-xs text-white"
                >
                  {db.players
                    .filter((p) => p.id !== actingPlayer.id && p.leagueId === league.id)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        DM: {p.name}
                      </option>
                    ))}
                </select>
              </div>

              <div className="max-h-40 overflow-y-auto space-y-2">
                {dmThread.length === 0 ? (
                  <div className="text-xs text-slate-500 py-2">No messages with {dmPeer?.name} yet.</div>
                ) : (
                  dmThread.map((d) => (
                    <div key={d.id} className="rounded-lg bg-[#090D12] px-3 py-2 text-xs">
                      <span className="font-semibold text-amber-300">{d.fromName}: </span>
                      <span className="text-slate-200">{d.text}</span>
                    </div>
                  ))
                )}
              </div>

              <form onSubmit={handleSendDm} className="flex gap-2">
                <input
                  type="text"
                  placeholder={`Direct message ${dmPeer?.name || 'player'}…`}
                  value={dmText}
                  onChange={(e) => setDmText(e.target.value)}
                  className="flex-1 rounded-lg border border-white/15 bg-[#090D12] px-3 py-2 text-xs text-white"
                />
                <button
                  type="submit"
                  className="rounded-lg border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold text-white cursor-pointer"
                >
                  Send DM
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {subTab === 'press' && (
        <div className="space-y-5">
          {!lastFinalMatch ? (
            <div className="rounded-2xl border border-white/10 bg-[#111821] p-8 text-center text-sm text-slate-400">
              Captain statements and player reactions will appear after your first completed match.
            </div>
          ) : (
            <>
              <div className="rounded-2xl border border-white/10 bg-[#111821] p-5 space-y-4">
                <div>
                  <div className="text-xs font-semibold text-emerald-400">FULL-TIME PRESS CONFERENCE</div>
                  <h2 className="mt-1 font-display text-xl font-bold text-white">
                    {lastFinalMatch.homeTeamName} {lastFinalMatch.homeScore} – {lastFinalMatch.awayScore} {lastFinalMatch.awayTeamName}
                  </h2>
                  <p className="text-xs text-slate-400">{lastFinalMatch.scheduledDate}</p>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {[lastFinalMatch.homeTeamId, lastFinalMatch.awayTeamId].map((matchTeamId) => {
                    const teamPress = (db.pressConferences || []).find(
                      (press) => press.matchId === lastFinalMatch.id && press.teamId === matchTeamId
                    );
                    const matchTeam = db.teams.find((entry) => entry.id === matchTeamId);
                    return (
                      <div key={matchTeamId} className="rounded-xl border border-white/10 bg-[#090D12] p-4">
                        <div className="text-xs font-semibold text-white">{matchTeam?.name || 'Team'}</div>
                        {teamPress ? (
                          <blockquote className="mt-2 text-sm text-slate-300">
                            “{teamPress.statement}”
                            <footer className="mt-2 text-[11px] text-slate-500">— {teamPress.captainName}, Captain</footer>
                          </blockquote>
                        ) : (
                          <p className="mt-2 text-xs text-slate-500">No captain statement yet.</p>
                        )}
                      </div>
                    );
                  })}
                </div>
                {actingPlayer.isCaptain && (
                  <form
                    onSubmit={async (event) => {
                      event.preventDefault();
                      try {
                        const response = await fetch(`/api/matches/${lastFinalMatch.id}/press-conference`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            teamId: team.id,
                            captainId: actingPlayer.id,
                            statement: pressStatement,
                          }),
                        });
                        const data = await response.json();
                        if (!response.ok) throw new Error(data.error || 'Could not post statement.');
                        onDatabaseUpdate(data);
                        setStatusFeedback('Your post-match statement is published.');
                      } catch (error) {
                        setStatusFeedback(error instanceof Error ? error.message : 'Could not post statement.');
                      }
                    }}
                    className="space-y-2"
                  >
                    <label className="block text-xs font-semibold text-white" htmlFor="press-statement">
                      Your captain’s statement
                    </label>
                    <textarea
                      id="press-statement"
                      maxLength={500}
                      required
                      value={
                        pressStatement ||
                        (db.pressConferences || []).find(
                          (press) => press.matchId === lastFinalMatch.id && press.teamId === team.id
                        )?.statement ||
                        ''
                      }
                      onChange={(event) => setPressStatement(event.target.value)}
                      placeholder="How did your team feel about the match?"
                      className="min-h-24 w-full rounded-lg border border-white/15 bg-[#090D12] p-3 text-sm text-white"
                    />
                    <button
                      type="submit"
                      className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950"
                    >
                      Publish / Update Statement
                    </button>
                  </form>
                )}
              </div>

              <div className="rounded-2xl border border-white/10 bg-[#111821] p-5">
                <h3 className="font-display text-lg font-bold text-white">Player Reactions</h3>
                <p className="mt-1 text-xs text-slate-400">Players from either team can react to the post-match press.</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(['🔥', '👏', '💪', '😮', '❤️'] as const).map((emoji) => {
                    const reactions = (db.matchReactions || []).filter(
                      (reaction) => reaction.matchId === lastFinalMatch.id && reaction.emoji === emoji
                    );
                    const current = reactions.some((reaction) => reaction.playerId === actingPlayer.id);
                    return (
                      <button
                        key={emoji}
                        type="button"
                        onClick={async () => {
                          try {
                            const response = await fetch(`/api/matches/${lastFinalMatch.id}/reactions`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ playerId: actingPlayer.id, emoji }),
                            });
                            const data = await response.json();
                            if (!response.ok) throw new Error(data.error || 'Could not save reaction.');
                            onDatabaseUpdate(data);
                          } catch (error) {
                            setStatusFeedback(error instanceof Error ? error.message : 'Could not save reaction.');
                          }
                        }}
                        className={`rounded-lg border px-3 py-2 text-sm ${
                          current ? 'border-amber-400 bg-amber-400/15' : 'border-white/10 bg-[#090D12]'
                        }`}
                        aria-label={`React ${emoji}, ${reactions.length} reactions`}
                      >
                        {emoji} {reactions.length}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {subTab === 'honors' && (() => {
        const unclaimedFinal =
          lastFinalMatch &&
          !(db.teamAchievements || []).some(
            (achievement) =>
              achievement.teamId === team.id && achievement.matchId === lastFinalMatch.id
          );
        const objectiveMatch = unclaimedFinal ? lastFinalMatch : nextMatch || lastFinalMatch;
        const standingsBeforeMatch = objectiveMatch
          ? computeStandings(
              league.id,
              db.teams,
              db.matches.filter((match) => match.id !== objectiveMatch.id)
            )
          : standings;
        const objectiveRank = standingsBeforeMatch.find((row) => row.teamId === team.id)?.rank ?? 99;
        const teamScore = objectiveMatch
          ? objectiveMatch.homeTeamId === team.id
            ? objectiveMatch.homeScore ?? 0
            : objectiveMatch.awayScore ?? 0
          : 0;
        const opponentScore = objectiveMatch
          ? objectiveMatch.homeTeamId === team.id
            ? objectiveMatch.awayScore ?? 0
            : objectiveMatch.homeScore ?? 0
          : 0;
        const objectiveMet =
          objectiveMatch?.status === 'Final' &&
          (objectiveRank <= 3
            ? teamScore > opponentScore
            : objectiveRank >= 8
              ? teamScore >= 1
              : teamScore >= opponentScore);
        const existingAchievement = objectiveMatch
          ? (db.teamAchievements || []).find(
              (achievement) =>
                achievement.teamId === team.id && achievement.matchId === objectiveMatch.id
            )
          : undefined;
        const objectiveTitle =
          objectiveRank <= 3
            ? 'Champions Standard'
            : objectiveRank >= 8
              ? 'Climb the Table'
              : 'Build Momentum';
        const objectiveDescription =
          objectiveRank <= 3
            ? 'Win your match to maintain the top-three standard.'
            : objectiveRank >= 8
              ? 'Score at least one goal to start climbing the table.'
              : 'Earn at least one point with a draw or win.';
        const finalRank = standings.find((row) => row.teamId === team.id)?.rank;
        const milestoneGames = [1, 10, 20, 30, 40, 50];
        return (
          <div className="space-y-5">
            <div className="rounded-2xl border border-emerald-500/25 bg-[#111821] p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-emerald-300">
                    {team.name} Board Objective
                  </div>
                  <h2 className="mt-1 font-display text-xl font-bold text-white">{objectiveTitle}</h2>
                  <p className="mt-1 text-sm text-slate-300">{objectiveDescription}</p>
                </div>
                {league.status === 'COMPLETED' && finalRank && finalRank <= 3 && (
                  <Trophy className={`h-7 w-7 ${finalRank === 1 ? 'text-amber-300' : finalRank === 2 ? 'text-slate-300' : 'text-orange-400'}`} />
                )}
              </div>
              {objectiveMatch ? (
                <>
                  <div className="text-xs text-slate-400">
                    {objectiveMatch.homeTeamName} {objectiveMatch.status === 'Final' ? `${objectiveMatch.homeScore} – ${objectiveMatch.awayScore}` : 'vs'} {objectiveMatch.awayTeamName}
                    {' · '}Rank-based difficulty: #{objectiveRank}
                  </div>
                  {existingAchievement ? (
                    <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs font-semibold text-amber-200">
                      Badge earned: {existingAchievement.badge} · {existingAchievement.points} points
                    </div>
                  ) : objectiveMet ? (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const response = await fetch(`/api/teams/${team.id}/objectives/claim`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ matchId: objectiveMatch.id, playerId: actingPlayer.id }),
                          });
                          const data = await response.json();
                          if (!response.ok) throw new Error(data.error || 'Could not claim objective.');
                          onDatabaseUpdate(data);
                          setStatusFeedback('Board objective completed — team badge and 50 points awarded.');
                        } catch (error) {
                          setStatusFeedback(error instanceof Error ? error.message : 'Could not claim objective.');
                        }
                      }}
                      className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950"
                    >
                      Complete Objective &amp; Claim Badge
                    </button>
                  ) : (
                    <div className="text-xs text-slate-400">
                      {objectiveMatch.status === 'Final'
                        ? 'Objective not achieved this match. The next board challenge will adapt to your standing.'
                        : 'Objective progress is recorded when the match result is final.'}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-xs text-slate-400">Your next board objective will appear when the schedule is published.</p>
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#111821] p-5 space-y-4">
              <h3 className="font-display text-lg font-bold text-white">Player Milestone Badges</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {roster.map((player) => {
                  const earnedMilestones = milestoneGames.filter((games) => player.gamesPlayed >= games);
                  return (
                    <div key={player.id} className="rounded-xl border border-white/10 bg-[#090D12] p-4">
                      <div className="font-semibold text-white">{player.name}</div>
                      <div className="mt-1 text-xs text-slate-400">{player.gamesPlayed} games played</div>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {earnedMilestones.length ? earnedMilestones.map((games) => (
                          <span key={games} className="rounded bg-amber-400/10 px-2 py-1 text-[10px] font-semibold text-amber-200">
                            {games === 1 ? 'First Game' : `${games} Games`}
                          </span>
                        )) : (
                          <span className="text-[10px] text-slate-500">First-game badge is next</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {(db.teamAchievements || []).filter((achievement) => achievement.teamId === team.id).length > 0 && (
                <div className="border-t border-white/10 pt-4">
                  <h4 className="text-xs font-semibold text-white">Team Reward Badges</h4>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(db.teamAchievements || [])
                      .filter((achievement) => achievement.teamId === team.id)
                      .map((achievement) => (
                        <span key={achievement.id} className="rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
                          {achievement.badge} · {achievement.points} pts
                        </span>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* TAB 2: OPPONENT MATCHDAY CHAT ("PRE-GAME LOBBY") */}
      {subTab === 'opponent' && (
        <div className="rounded-2xl border border-white/10 bg-[#111821] p-5 sm:p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div>
              <h2 className="font-display text-2xl font-bold text-white">
                Opponent Matchday Chat ("Pre-Game Lobby")
              </h2>
              <p className="text-xs text-slate-400">
                Shared lobby unlocked 48h before kickoff to confirm jersey colors, coordinate late arrivals, and share post-game GG.
              </p>
            </div>
            <select
              value={activeLobbyMatch?.id || ''}
              onChange={(e) => setSelectedLobbyMatchId(e.target.value)}
              className="min-h-[42px] rounded-lg border border-white/15 bg-[#090D12] px-3 py-2 text-xs text-white"
            >
              {lobbyMatches.map((m) => (
                <option key={m.id} value={m.id}>
                  Wk {m.week}: {m.homeTeamName} vs {m.awayTeamName}
                </option>
              ))}
            </select>
          </div>

          {activeLobbyMatch ? (
            <>
              <div className="rounded-xl border border-white/10 bg-[#090D12] p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div>
                  <span className="text-slate-400">Fixture: </span>
                  <strong className="text-white">
                    {activeLobbyMatch.homeTeamName} vs {activeLobbyMatch.awayTeamName}
                  </strong>
                  <span className="text-slate-500 ml-2">
                    ({activeLobbyMatch.fieldNumber} · {activeLobbyMatch.scheduledDate} {activeLobbyMatch.scheduledTime})
                  </span>
                </div>
                <div className="font-semibold text-emerald-400">
                  Kit Check Confirmed in Chat
                </div>
              </div>

              <div className="space-y-3 max-h-80 overflow-y-auto">
                {lobbyMessages.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4">
                    No messages in this match lobby yet. Confirm your jersey colors below!
                  </p>
                ) : (
                  lobbyMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className="rounded-xl border border-white/10 bg-[#090D12] p-3.5 flex items-start justify-between gap-3"
                    >
                      <div>
                        <div className="text-xs">
                          <span className="font-bold text-white">{msg.senderName}</span>
                          <span className="text-emerald-400 ml-1.5">({msg.teamName})</span>
                          {msg.reported && (
                            <span className="ml-2 text-rose-400 font-semibold">[Reported]</span>
                          )}
                        </div>
                        <p className="text-xs text-slate-200 mt-1">{msg.text}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          title="Report message"
                          onClick={async () => {
                            const r = await fetch(`/api/opponent-chat/${msg.id}/report`, { method: 'POST' });
                            if (r.ok) onDatabaseUpdate(await r.json());
                          }}
                          className="p-1.5 rounded hover:bg-white/10 text-slate-400 hover:text-amber-400 cursor-pointer"
                        >
                          <Flag className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          title="Mute player"
                          onClick={async () => {
                            const r = await fetch('/api/opponent-chat/mute', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ playerId: msg.senderPlayerId }),
                            });
                            if (r.ok) {
                              onDatabaseUpdate(await r.json());
                              setStatusFeedback(`Muted ${msg.senderName} in Matchday Lobby.`);
                            }
                          }}
                          className="p-1.5 rounded hover:bg-white/10 text-slate-400 hover:text-rose-400 cursor-pointer"
                        >
                          <VolumeX className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <form onSubmit={handleSendOpponentMsg} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Confirm kit colors, delay alerts, or say GG…"
                  value={opponentMsgText}
                  onChange={(e) => setOpponentMsgText(e.target.value)}
                  className="flex-1 min-h-[42px] rounded-lg border border-white/15 bg-[#090D12] px-3 py-2 text-xs text-white"
                />
                <button
                  type="submit"
                  className="min-h-[42px] rounded-lg bg-emerald-500 px-5 py-2 text-xs font-semibold text-slate-950 cursor-pointer"
                >
                  Send to Lobby
                </button>
              </form>
            </>
          ) : (
            <p className="text-sm text-slate-400">No matches scheduled for this squad yet.</p>
          )}
        </div>
      )}

      {/* TAB 3: RIDE HUB (SAFE PUBLIC CARPOOL MATCHER) */}
      {subTab === 'rides' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={handlePostRide}
            className="lg:col-span-5 rounded-2xl border border-white/10 bg-[#111821] p-5 space-y-4 self-start"
          >
            <div>
              <h2 className="font-display text-xl font-bold text-white">
                Post Safe Public Pickup Pin
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Never enter home addresses. Pin a public gas station, subway/GO station, bus stop, or plaza.
              </p>
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Public Landmark Type</label>
              <select
                value={rideLandmarkType}
                onChange={(e) => setRideLandmarkType(e.target.value as RideRequest['landmarkType'])}
                className="w-full rounded-lg border border-white/15 bg-[#090D12] px-3 py-2 text-xs text-white"
              >
                <option value="Subway / GO Station">Subway / GO Station</option>
                <option value="Gas Station">Gas Station (Petro-Canada, Esso, Shell)</option>
                <option value="Bus Stop">Bus Stop</option>
                <option value="Plaza / Tim Hortons">Plaza / Tim Hortons</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Public Landmark Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Esso — Queen & Spadina"
                value={rideLandmarkName}
                onChange={(e) => setRideLandmarkName(e.target.value)}
                className="w-full rounded-lg border border-white/15 bg-[#090D12] px-3 py-2 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Match Kickoff Time</label>
              <input
                type="text"
                value={rideMatchTime}
                onChange={(e) => setRideMatchTime(e.target.value)}
                className="w-full rounded-lg border border-white/15 bg-[#090D12] px-3 py-2 text-xs text-white"
              />
            </div>

            <button
              type="submit"
              className="w-full min-h-[42px] rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 cursor-pointer"
            >
              Drop Public Pickup Pin
            </button>
          </form>

          <div className="lg:col-span-7 space-y-4">
            {db.rides.map((ride) => (
              <div
                key={ride.id}
                className="rounded-2xl border border-white/10 bg-[#111821] p-5 space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="text-[11px] font-semibold text-emerald-400">
                      {ride.landmarkType} · {ride.detourEstimate}
                    </div>
                    <h3 className="font-display text-xl font-bold text-white">
                      {ride.landmarkName}
                    </h3>
                    <div className="text-xs text-slate-400">
                      Rider: {ride.riderName} ({ride.riderTeamName}) · Heading to {ride.venueName} ({ride.matchTime})
                    </div>
                  </div>
                  <span className="rounded-md border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-xs font-semibold text-amber-300 self-start">
                    {ride.status}
                  </span>
                </div>

                {ride.status === 'Open' ? (
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/10">
                    <select
                      value={rideSeatMap[ride.id] || 2}
                      onChange={(e) =>
                        setRideSeatMap((prev) => ({ ...prev, [ride.id]: Number(e.target.value) }))
                      }
                      className="rounded-lg border border-white/15 bg-[#090D12] px-2.5 py-1.5 text-xs text-white"
                    >
                      {[1, 2, 3, 4].map((s) => (
                        <option key={s} value={s}>{s} Seats Open</option>
                      ))}
                    </select>
                    <select
                      value={rideCostMap[ride.id] || 'Free Lift'}
                      onChange={(e) =>
                        setRideCostMap((prev) => ({
                          ...prev,
                          [ride.id]: e.target.value as 'Free Lift' | 'Split Gas ($5)',
                        }))
                      }
                      className="rounded-lg border border-white/15 bg-[#090D12] px-2.5 py-1.5 text-xs text-white"
                    >
                      <option value="Free Lift">Free Lift</option>
                      <option value="Split Gas ($5)">Split Gas ($5)</option>
                    </select>
                    <button
                      type="button"
                      onClick={async () => {
                        const res = await fetch(`/api/rides/${ride.id}/accept`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            driverPlayerId: actingPlayer.id,
                            seatsAvailable: rideSeatMap[ride.id] || 2,
                            costOption: rideCostMap[ride.id] || 'Free Lift',
                          }),
                        });
                        if (res.ok) onDatabaseUpdate(await res.json());
                      }}
                      className="min-h-[36px] rounded-lg bg-emerald-500 px-3.5 py-1.5 text-xs font-semibold text-slate-950 cursor-pointer"
                    >
                      Accept Pickup (Earn Team Driver)
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3 pt-2 border-t border-white/10">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="text-slate-300">
                        Driver: <strong className="text-white">{ride.driverName}</strong> ·{' '}
                        {ride.seatsAvailable} seats ·{' '}
                        <span className="text-amber-300">{ride.costOption}</span>
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {(['On My Way', 'At Pickup Spot', 'Picked Up'] as const).map((st) => (
                          <button
                            key={st}
                            type="button"
                            onClick={async () => {
                              const res = await fetch(`/api/rides/${ride.id}/status`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ status: st }),
                              });
                              if (res.ok) onDatabaseUpdate(await res.json());
                            }}
                            className={`rounded px-2.5 py-1 text-[11px] font-semibold cursor-pointer ${
                              ride.status === st
                                ? 'bg-emerald-500 text-slate-950'
                                : 'border border-white/15 bg-[#090D12] text-slate-300'
                            }`}
                          >
                            {st}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Carpool Mini-Chat */}
                    <div className="space-y-1.5">
                      {ride.messages.map((m) => (
                        <div key={m.id} className="rounded bg-[#090D12] px-3 py-1.5 text-xs">
                          <span className="font-semibold text-emerald-400">{m.senderName}: </span>
                          <span className="text-slate-200">{m.text}</span>
                        </div>
                      ))}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Quick carpool note (e.g. 5 mins away)…"
                          value={rideChatInputs[ride.id] || ''}
                          onChange={(e) =>
                            setRideChatInputs((prev) => ({ ...prev, [ride.id]: e.target.value }))
                          }
                          className="flex-1 rounded-lg border border-white/15 bg-[#090D12] px-3 py-1.5 text-xs text-white"
                        />
                        <button
                          type="button"
                          onClick={async () => {
                            const txt = rideChatInputs[ride.id];
                            if (!txt?.trim()) return;
                            const res = await fetch(`/api/rides/${ride.id}/message`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ senderName: actingPlayer.name, text: txt }),
                            });
                            if (res.ok) {
                              onDatabaseUpdate(await res.json());
                              setRideChatInputs((prev) => ({ ...prev, [ride.id]: '' }));
                            }
                          }}
                          className="rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white cursor-pointer"
                        >
                          Send
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: ROSTER, INVITES, WAITLIST & SPLIT-PAY */}
      {subTab === 'roster' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 space-y-6">
              <div className="rounded-2xl border border-white/10 bg-[#111821] p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-xl font-bold text-white">Team Fee &amp; Even Split</h2>
                  <span
                    className={`text-xs font-semibold ${
                      balanceDue === 0 ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  >
                    {balanceDue === 0 ? 'Registration Complete ($0 Due)' : `Pending Payment ($${balanceDue} Due)`}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3 rounded-xl border border-white/10 bg-[#090D12] p-4">
                  <div>
                    <div className="text-[11px] text-slate-400">Total Cost</div>
                    <div className="font-mono-num text-lg font-bold text-white">${team.totalFee}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400">Paid</div>
                    <div className="font-mono-num text-lg font-bold text-emerald-400">
                      ${team.amountPaid}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400">Balance</div>
                    <div className="font-mono-num text-lg font-bold text-amber-400">${balanceDue}</div>
                  </div>
                </div>

                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs space-y-2">
                  <div className="flex items-center justify-between text-slate-200">
                    <span>
                      Current Roster ({roster.length} {roster.length === 1 ? 'player' : 'players'}):
                    </span>
                    <span className="font-mono-num font-bold text-emerald-400">
                      ${perCurrentRosterSplit}/player
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-slate-300">
                    <span>Split Target Players:</span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min={2}
                        max={22}
                        defaultValue={team.splitTargetPlayers}
                        onBlur={async (e) => {
                          const nextCount = Math.max(2, Math.min(22, Number(e.target.value) || 10));
                          if (nextCount === team.splitTargetPlayers) return;
                          const r = await fetch(`/api/teams/${team.id}/studio`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ splitTargetPlayers: nextCount }),
                          });
                          if (r.ok) {
                            onDatabaseUpdate(await r.json());
                            setStatusFeedback(
                              `Updated team split to ${nextCount} players ($${Math.round((team.totalFee / nextCount) * 100) / 100}/ea).`
                            );
                          }
                        }}
                        className="w-16 rounded border border-white/15 bg-[#090D12] px-2 py-1 text-right font-mono-num text-white"
                      />
                      <span className="font-mono-num text-amber-300 font-semibold">
                        = ${perPlayerSplit}/ea
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs text-slate-300">
                    Invite Code: <span className="font-mono-num text-amber-400">{team.splitPayCode}</span>{' '}
                    ({balanceDue === 0 ? '$0 Free Friend Join' : `$${perPlayerSplit}/player`})
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={splitLink}
                      className="w-full rounded-lg border border-white/10 bg-[#090D12] px-3 py-2 text-xs font-mono text-slate-300"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(splitLink);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1800);
                      }}
                      className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white inline-flex items-center gap-1 cursor-pointer"
                    >
                      {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                      <span>{copied ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenSplitJoin(team.splitPayCode)}
                    className="w-full min-h-[42px] rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 cursor-pointer"
                  >
                    {balanceDue === 0
                      ? 'Invite / Join Paid-in-Full Squad ($0)'
                      : `Join Team via Split-Pay ($${perPlayerSplit})`}
                  </button>
                </div>
              </div>

              {/* Team Schedule */}
              <div className="rounded-2xl border border-white/10 bg-[#111821] p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-emerald-400" />
                  <h3 className="font-display text-xl font-bold text-white">Team Schedule</h3>
                </div>
                {lobbyMatches.length === 0 ? (
                  <p className="text-xs text-slate-400">No fixtures generated for this squad yet.</p>
                ) : (
                  <div className="divide-y divide-white/10 text-xs">
                    {lobbyMatches.map((m) => {
                      const mClock = computeMatchClockBreakdown(
                        m.scheduledTime,
                        m.firstHalfMins ?? 25,
                        m.halftimeMins ?? 5,
                        m.secondHalfMins ?? 25
                      );
                      return (
                        <div key={m.id} className="py-2.5 flex items-center justify-between gap-2">
                          <div>
                            <div className="font-semibold text-white">
                              Wk {m.week}: {m.homeTeamName} vs {m.awayTeamName}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono-num">
                              Assigned Field: {m.fieldNumber} · {m.scheduledDate} · {mClock.kickoff} – {mClock.fullTime} (HT {mClock.halftimeStart})
                            </div>
                          </div>
                          <span className="font-mono-num font-bold text-amber-300">
                            {m.status === 'Final' ? `${m.homeScore}–${m.awayScore}` : m.status}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Team Standby Waitlist */}
              <div className="rounded-2xl border border-white/10 bg-[#111821] p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-lg font-bold text-white">
                    Team Standby Waitlist ({(team.standbyWaitlist || []).length})
                  </h3>
                  <span className="text-[11px] text-emerald-400">Auto-Promotes on Drop</span>
                </div>
                {(team.standbyWaitlist || []).length === 0 ? (
                  <p className="text-xs text-slate-400">
                    No players currently queued on Standby. Players who try to join a full team/gender cap can enter Standby.
                  </p>
                ) : (
                  <div className="divide-y divide-white/10 text-xs">
                    {(team.standbyWaitlist || []).map((w, idx) => (
                      <div key={w.id} className="py-2 flex items-center justify-between">
                        <div>
                          <span className="font-semibold text-white">#{idx + 1} {w.name}</span>
                          <span className="text-slate-400 ml-2">({w.gender} · {w.position})</span>
                        </div>
                        <span className="text-[11px] text-amber-300">Standby</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="lg:col-span-7 space-y-6">
              <div className="rounded-2xl border border-white/10 bg-[#111821] divide-y divide-white/10">
                <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="font-display text-xl font-bold text-white">
                      Player Cards & Roster ({roster.length}/{getEffectiveTeamCaps(team, league).rosterCap})
                    </h2>
                    {league.division === 'Co-Ed' && (
                      <div className="text-[11px] text-amber-300 mt-0.5">
                        Co-Ed Split: {roster.filter((p) => (p.gender || 'Male') === 'Male').length}/{getEffectiveTeamCaps(team, league).maleCap}M ·{' '}
                        {roster.filter((p) => p.gender === 'Female').length}/{getEffectiveTeamCaps(team, league).femaleCap}F
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setSubTab('studio')}
                    className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 cursor-pointer"
                  >
                    Edit Kits &amp; Numbers →
                  </button>
                </div>

                {roster.map((p) => {
                  const cd = checkPlayerMarketCooldown(p);
                  return (
                    <div
                      key={p.id}
                      className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-white">
                          <span className="font-mono-num text-amber-300">#{p.jerseyNumber ?? 10}</span>
                          <span>{p.name}</span>
                          <span className="text-xs font-normal text-slate-400">
                            {p.position} · {p.gender || 'Male'}
                            {p.isCaptain ? ' · Captain' : p.isViceCaptain ? ' · Vice-Captain' : ''}
                          </span>
                          {p.isTeamDriver && (
                            <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">
                              Team Driver
                            </span>
                          )}
                          {(p.motmAwards ?? 0) > 0 && (
                            <span className="rounded bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">
                              {p.motmAwards}x MOTM
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400 mt-1 flex flex-wrap gap-2">
                          <span className="font-mono-num">
                            {p.gamesPlayed} GP · {p.goals}G · {p.assists}A
                          </span>
                          <span>·</span>
                          {p.suspendedNextMatch ? (
                            <span className="text-rose-400 font-semibold">Suspended Next Match</span>
                          ) : p.activeLoanId ? (
                            <span className="text-rose-400 font-semibold inline-flex items-center gap-1">
                              <Lock className="h-3 w-3" /> Ineligible for Original Team (4 Games)
                            </span>
                          ) : (
                            <span>Market: {cd.label}</span>
                          )}
                          <span>·</span>
                          <span
                            className={
                              p.registrationStatus === 'Complete'
                                ? 'text-emerald-400 font-semibold'
                                : 'text-amber-300 font-semibold'
                            }
                          >
                            Reg: {p.registrationStatus === 'Complete' ? 'Complete' : 'Pending Payment'}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                        {p.registrationStatus !== 'Complete' && (
                          <button
                            type="button"
                            onClick={async () => {
                              const r = await fetch(`/api/players/${p.id}/complete-payment`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({}),
                              });
                              const data = await r.json();
                              if (r.ok) {
                                onDatabaseUpdate(data.db);
                                setStatusFeedback(`${p.name}'s payment processed — registration marked Complete!`);
                              } else {
                                setStatusFeedback(data.error || 'Could not complete payment');
                              }
                            }}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-2.5 py-1.5 text-xs font-bold text-slate-950 hover:bg-emerald-400 cursor-pointer"
                          >
                            Pay &amp; Complete
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setCardModalPlayer(p)}
                          className="inline-flex items-center gap-1 rounded-lg border border-amber-400/35 bg-amber-400/10 px-2.5 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-400/20 cursor-pointer"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          <span>Player Card</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onGoToMarket('board', league.id, p.id)}
                          className="rounded-lg border border-white/15 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-white/5 cursor-pointer"
                        >
                          Market →
                        </button>
                        {!p.isCaptain && (
                          <button
                            type="button"
                            disabled={p.gamesPlayed > 0}
                            title={
                              p.gamesPlayed > 0
                                ? 'Only players who have not played this season can be released.'
                                : 'Release inactive player; auto-promote standby or open a replacement spot when 6+ games remain.'
                            }
                            onClick={async () => {
                              const r = await fetch(`/api/teams/${team.id}/roster/${p.id}`, {
                                method: 'DELETE',
                              });
                              const data = await r.json();
                              if (r.ok) {
                                onDatabaseUpdate(data.db);
                                setStatusFeedback(
                                  data.promotedName
                                    ? `${p.name} removed. ${data.promotedName} auto-promoted from Standby Waitlist!`
                                    : data.opening
                                    ? `${p.name} removed. A paid replacement spot is open at the standard $${data.opening.fee} solo fee.`
                                    : `${p.name} removed from roster.`
                                );
                              } else {
                                setStatusFeedback(data.error || 'Could not remove player');
                              }
                            }}
                            className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-1.5 text-rose-300 hover:bg-rose-500/20 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Invite Friends & Free-Agent Recruiting Pool */}
              <div className="rounded-2xl border border-white/10 bg-[#111821] p-5 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <UserPlus className="h-4 w-4 text-emerald-400" />
                    <h3 className="font-display text-xl font-bold text-white">
                      Friend Invites &amp; Free-Agent Recruiting
                    </h3>
                  </div>
                  {balanceDue === 0 && (
                    <span className="text-[11px] font-bold text-emerald-400">$0 Paid-in-Full Join</span>
                  )}
                </div>

                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const r = await fetch(`/api/teams/${team.id}/invite`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        invitedName: inviteName,
                        invitedEmail: inviteEmail,
                        invitedGender: inviteGender,
                        position: invitePos,
                      }),
                    });
                    const data = await r.json();
                    if (r.ok) {
                      onDatabaseUpdate(data.db);
                      setInviteName('');
                      setInviteEmail('');
                      setStatusFeedback(`Team invite sent to ${data.invite.invitedName}!`);
                    } else {
                      setStatusFeedback(data.error || 'Invite blocked by roster rules');
                    }
                  }}
                  className="grid grid-cols-1 sm:grid-cols-5 gap-2 rounded-xl border border-white/10 bg-[#090D12] p-3 text-xs"
                >
                  <input
                    type="text"
                    required
                    placeholder="Friend Name"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    className="sm:col-span-2 rounded-lg border border-white/15 bg-[#111821] px-2.5 py-2 text-white"
                  />
                  <select
                    value={inviteGender}
                    onChange={(e) => setInviteGender(e.target.value as 'Male' | 'Female')}
                    className="rounded-lg border border-white/15 bg-[#111821] px-2 py-2 text-white"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                  <select
                    value={invitePos}
                    onChange={(e) => setInvitePos(e.target.value as Player['position'])}
                    className="rounded-lg border border-white/15 bg-[#111821] px-2 py-2 text-white"
                  >
                    {(['GK', 'DEF', 'MID', 'FWD'] as const).map((pos) => (
                      <option key={pos} value={pos}>{pos}</option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    className="rounded-lg bg-emerald-500 px-3 py-2 font-semibold text-slate-950 cursor-pointer"
                  >
                    Send Invite
                  </button>
                </form>

                {/* Pending Invites */}
                {db.teamInvites.filter((i) => i.status === 'Pending' && i.teamId === team.id).length > 0 && (
                  <div className="space-y-2">
                    <div className="text-[11px] font-semibold text-slate-400">Pending Squad Invites</div>
                    {db.teamInvites
                      .filter((i) => i.status === 'Pending' && i.teamId === team.id)
                      .map((inv) => (
                        <div
                          key={inv.id}
                          className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-[#090D12] px-3.5 py-2.5 text-xs"
                        >
                          <div>
                            <span className="font-semibold text-white">{inv.invitedName}</span>
                            <span className="text-slate-400 ml-2">
                              ({inv.invitedGender} · {inv.position}) · {inv.isPaidInFullFreeJoin ? '$0 Free Join' : 'Split-Pay'}
                            </span>
                          </div>
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              onClick={async () => {
                                const r = await fetch(`/api/invites/${inv.id}/respond`, {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ decision: 'Accepted' }),
                                });
                                const d = await r.json();
                                if (r.ok) {
                                  onDatabaseUpdate(d.db);
                                  setStatusFeedback(`${inv.invitedName} accepted invite and joined ${team.name}!`);
                                } else {
                                  setStatusFeedback(d.error || 'Could not accept invite');
                                }
                              }}
                              className="rounded bg-emerald-500 px-2.5 py-1 font-semibold text-slate-950 cursor-pointer"
                            >
                              Accept
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                const r = await fetch(`/api/invites/${inv.id}/respond`, {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ decision: 'Declined' }),
                                });
                                const d = await r.json();
                                if (r.ok) onDatabaseUpdate(d.db);
                              }}
                              className="rounded border border-white/15 px-2.5 py-1 text-slate-300 cursor-pointer"
                            >
                              Decline
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                )}

                {/* Free-Agent Recruiting Pool */}
                <div className="space-y-2 pt-2 border-t border-white/10">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold text-slate-300">
                      Free-Agent Recruiting Pool
                    </span>
                    <div className="flex gap-2 text-[11px]">
                      <select
                        value={recruitGenderFilter}
                        onChange={(e) => setRecruitGenderFilter(e.target.value as 'All' | 'Male' | 'Female')}
                        className="rounded border border-white/15 bg-[#090D12] px-2 py-1 text-white"
                      >
                        <option value="All">All Genders</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                      </select>
                      <select
                        value={recruitPosFilter}
                        onChange={(e) => setRecruitPosFilter(e.target.value as 'All' | Player['position'])}
                        className="rounded border border-white/15 bg-[#090D12] px-2 py-1 text-white"
                      >
                        <option value="All">All Pos</option>
                        {(['GK', 'DEF', 'MID', 'FWD'] as const).map((pos) => (
                          <option key={pos} value={pos}>{pos}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {db.players.filter(
                    (p) =>
                      p.isFreeAgent &&
                      p.leagueId === league.id &&
                      (recruitGenderFilter === 'All' || (p.gender || 'Male') === recruitGenderFilter) &&
                      (recruitPosFilter === 'All' || p.position === recruitPosFilter)
                  ).length === 0 ? (
                    <p className="text-xs text-slate-500">
                      No unaffiliated Free Agents in this league pool yet.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {db.players
                        .filter(
                          (p) =>
                            p.isFreeAgent &&
                            p.leagueId === league.id &&
                            (recruitGenderFilter === 'All' || (p.gender || 'Male') === recruitGenderFilter) &&
                            (recruitPosFilter === 'All' || p.position === recruitPosFilter)
                        )
                        .map((fa) => (
                          <div
                            key={fa.id}
                            className="flex items-center justify-between rounded-xl border border-white/10 bg-[#090D12] px-3.5 py-2 text-xs"
                          >
                            <div>
                              <span className="font-semibold text-white">{fa.name}</span>
                              <span className="text-slate-400 ml-2">
                                {fa.gender || 'Male'} · {fa.position} · {fa.skillRating}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={async () => {
                                const r = await fetch(`/api/teams/${team.id}/invite`, {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    invitedPlayerId: fa.id,
                                    invitedName: fa.name,
                                    invitedGender: fa.gender || 'Male',
                                    position: fa.position,
                                  }),
                                });
                                const d = await r.json();
                                if (r.ok) {
                                  onDatabaseUpdate(d.db);
                                  setStatusFeedback(`Recruit invite sent to ${fa.name}!`);
                                } else {
                                  setStatusFeedback(d.error || 'Could not invite Free Agent');
                                }
                              }}
                              className="rounded bg-amber-400 px-2.5 py-1 font-semibold text-slate-950 cursor-pointer"
                            >
                              Recruit
                            </button>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: TEAM STUDIO, QR POSTER & LINEUP TACTICS BOARD */}
      {subTab === 'studio' && (
        <TeamStudioPanel
          team={team}
          league={league}
          roster={roster}
          splitLink={splitLink}
          onDatabaseUpdate={onDatabaseUpdate}
        />
      )}

      <PlayerCardModal
        player={cardModalPlayer}
        team={team}
        league={league}
        onClose={() => setCardModalPlayer(null)}
      />
    </div>
  );
};
