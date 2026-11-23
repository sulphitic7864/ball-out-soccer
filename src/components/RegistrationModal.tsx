import React, { useState, useEffect } from 'react';
import { X, Check, Copy, Users, UserPlus, Link2, BookmarkCheck, ShieldAlert, MapPin, Clock } from 'lucide-react';
import type { FreeAgentFriendInvite, League, LeagueDatabase, PlayerPosition, Team } from '../types.ts';
import {
  checkDivisionGenderEligibility,
  computeDynamicPrizeDisplay,
  evaluateTeamRosterAddition,
} from '../utils/leagueHelpers.ts';

interface RegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  db: LeagueDatabase;
  initialLeagueId?: string;
  initialMode?: 'team' | 'split' | 'solo' | 'waitlist';
  initialSplitCode?: string;
  onOpenAdmin?: () => void;
  onDatabaseUpdate: (db: LeagueDatabase) => void;
  onGoToClubhouse: (teamId: string) => void;
}

function formatMoney(amount: number): string {
  const rounded = Math.round(amount * 100) / 100;
  return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(2);
}

export const RegistrationModal: React.FC<RegistrationModalProps> = ({
  isOpen,
  onClose,
  db,
  initialLeagueId,
  initialMode = 'team',
  initialSplitCode = '',
  onOpenAdmin,
  onDatabaseUpdate,
  onGoToClubhouse,
}) => {
  const [mode, setMode] = useState<'team' | 'split' | 'solo' | 'waitlist'>(initialMode);
  const [leagueId, setLeagueId] = useState<string>(initialLeagueId || db.leagues[0]?.id || '');

  const [teamName, setTeamName] = useState('');
  const [captainName, setCaptainName] = useState('');
  const [captainEmail, setCaptainEmail] = useState('');
  const [kitColor, setKitColor] = useState('#10B981');
  const [paymentMode, setPaymentMode] = useState<'full' | 'split'>('split');
  const [splitTargetPlayers, setSplitTargetPlayers] = useState(10);
  const [promoCode, setPromoCode] = useState('');

  const [splitCode, setSplitCode] = useState(initialSplitCode);
  const [playerName, setPlayerName] = useState('');
  const [playerEmail, setPlayerEmail] = useState('');
  const [position, setPosition] = useState<PlayerPosition>('MID');
  const [playerGender, setPlayerGender] = useState<'Female' | 'Male'>('Female');
  const [inviteFriend, setInviteFriend] = useState(false);
  const [friendName, setFriendName] = useState('');
  const [friendEmail, setFriendEmail] = useState('');
  const [friendGender, setFriendGender] = useState<'Female' | 'Male'>('Male');
  const [friendPosition, setFriendPosition] = useState<PlayerPosition>('MID');
  const [waitlistType, setWaitlistType] = useState<'Team Captain' | 'Solo Player'>('Team Captain');

  const [waiverChecked, setWaiverChecked] = useState(false);
  const [waiverSignature, setWaiverSignature] = useState('');
  const [paymentAuthorized, setPaymentAuthorized] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [standbyRecommendedTeamId, setStandbyRecommendedTeamId] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<{
    title: string;
    subtitle: string;
    teamId?: string;
    playerId?: string;
    splitCode?: string;
    registrationStatus?: 'Pending Payment' | 'Complete';
    teamRegistrationStatus?: 'Pending Payment' | 'Complete';
    pendingAmount?: number;
    friendInvite?: FreeAgentFriendInvite;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      if (initialLeagueId) setLeagueId(initialLeagueId);
      else if (!leagueId && db.leagues[0]) setLeagueId(db.leagues[0].id);
      if (initialSplitCode) setSplitCode(initialSplitCode);
      setError('');
      setPaymentAuthorized(false);
      setStandbyRecommendedTeamId(null);
      setSuccessResult(null);
    }
  }, [isOpen, initialLeagueId, initialMode, initialSplitCode, db.leagues]);

  if (!isOpen) return null;

  const selectedLeague: League | undefined = db.leagues.find((l) => l.id === leagueId);
  const matchedSplitTeam: Team | undefined = db.teams.find(
    (t) => t.splitPayCode.toLowerCase() === splitCode.trim().toLowerCase()
  );
  const splitLeague: League | undefined = matchedSplitTeam
    ? db.leagues.find((l) => l.id === matchedSplitTeam.leagueId)
    : undefined;
  const activeTargetLeague = mode === 'split' ? splitLeague : selectedLeague;
  const activeVenue = activeTargetLeague
    ? db.venues.find((v) => v.id === activeTargetLeague.venueId)
    : undefined;
  const activeVenueFields =
    activeVenue?.fields && activeVenue.fields.length > 0 ? activeVenue.fields : ['Turf 1'];

  const genderEligibility = activeTargetLeague
    ? checkDivisionGenderEligibility(activeTargetLeague.division, playerGender)
    : { allowed: true, reason: '' };

  const splitRosterPlayers = matchedSplitTeam
    ? db.players.filter((p) => p.teamId === matchedSplitTeam.id)
    : [];
  const splitEvaluation =
    matchedSplitTeam && splitLeague
      ? evaluateTeamRosterAddition(matchedSplitTeam, splitLeague, splitRosterPlayers, playerGender)
      : null;

  const matchedPromo = db.promoCodes.find(
    (p) => p.active && p.code.toLowerCase() === promoCode.trim().toLowerCase()
  );
  const effectiveTeamFee = selectedLeague
    ? Math.max(0, selectedLeague.entryFeeTeam - (matchedPromo?.discountAmount || 0))
    : 2500;

  const handleJoinTeamStandby = async () => {
    if (!matchedSplitTeam) return;
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch(`/api/teams/${matchedSplitTeam.id}/waitlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: playerName || 'Standby Player',
          email: playerEmail || 'standby@pitchpot.io',
          gender: playerGender,
          position,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Standby signup failed');
      onDatabaseUpdate(data);
      setSuccessResult({
        title: `Added to ${matchedSplitTeam.name} Standby Waitlist`,
        subtitle: `If a matching ${playerGender} spot opens or another player drops, you are queued for automatic promotion.`,
        teamId: matchedSplitTeam.id,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Waitlist error');
    } finally {
      setSubmitting(false);
    }
  };

  const checkoutAmountDue =
    mode === 'team'
      ? paymentMode === 'full'
        ? effectiveTeamFee
        : Math.round((effectiveTeamFee / Math.max(1, splitTargetPlayers)) * 100) / 100
      : mode === 'split'
      ? matchedSplitTeam
        ? matchedSplitTeam.amountPaid >= matchedSplitTeam.totalFee
          ? 0
          : Math.min(
              Math.max(0, matchedSplitTeam.totalFee - matchedSplitTeam.amountPaid),
              Math.round((matchedSplitTeam.totalFee / Math.max(1, matchedSplitTeam.splitTargetPlayers)) * 100) /
                100
            )
        : 0
      : mode === 'solo'
      ? selectedLeague?.entryFeeSolo ?? 250
      : 0;

  const submitRegistration = async (processPaymentNow: boolean) => {
    setError('');
    setStandbyRecommendedTeamId(null);

    if (mode !== 'waitlist' && !genderEligibility.allowed) {
      setError(genderEligibility.reason);
      return;
    }

    if (mode !== 'waitlist' && (!waiverChecked || !waiverSignature.trim())) {
      setError('All required registration info and Digital Liability Waiver e-signature must be filled out.');
      return;
    }

    if (mode !== 'waitlist' && processPaymentNow && checkoutAmountDue > 0 && !paymentAuthorized) {
      setError(`Check the payment authorization box to process $${formatMoney(checkoutAmountDue)} and mark registration Complete.`);
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'waitlist') {
        const res = await fetch('/api/waitlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            leagueId,
            name: playerName,
            email: playerEmail,
            entryType: waitlistType,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Waitlist signup failed');
        onDatabaseUpdate(data);
        setSuccessResult({
          title: 'Early-Bird Spot Reserved',
          subtitle: `${playerName} added to the pre-season interest & waitlist for ${selectedLeague?.name}. No fee charged yet.`,
        });
      } else if (mode === 'team') {
        const res = await fetch('/api/register/team', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            leagueId,
            teamName,
            captainName,
            captainEmail,
            position,
            gender: playerGender,
            kitColor,
            paymentMode,
            splitTargetPlayers,
            promoCode,
            waiverSigned: waiverChecked,
            waiverSignatureName: waiverSignature,
            paymentProcessed: processPaymentNow,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Team registration failed');
        onDatabaseUpdate(data.db);
        const capStatus: 'Pending Payment' | 'Complete' = data.captain.registrationStatus || 'Pending Payment';
        const teamStatus: 'Pending Payment' | 'Complete' = data.team.registrationStatus || 'Pending Payment';
        setSuccessResult({
          title:
            capStatus === 'Complete'
              ? `${data.team.name} — Registration Complete`
              : `${data.team.name} — Pending Payment (Not Complete)`,
          subtitle:
            capStatus !== 'Complete'
              ? `Details saved, but registration is PENDING PAYMENT until payment ($${formatMoney(
                  checkoutAmountDue
                )}) is processed.`
              : paymentMode === 'split'
              ? `Captain spot Complete ($${formatMoney(data.team.amountPaid)} paid). Team status is ${teamStatus} until all $${data.team.totalFee} (${data.team.splitTargetPlayers} players @ $${formatMoney(
                  data.team.totalFee / data.team.splitTargetPlayers
                )}/ea) is paid. Share code ${data.team.splitPayCode}.${
                  data.discountApplied ? ` ($${data.discountApplied} promo applied)` : ''
                }`
              : `Full team cost ($${data.team.totalFee}) paid in ${selectedLeague?.name} — Team & Captain marked Complete.`,
          teamId: data.team.id,
          playerId: data.captain.id,
          splitCode: data.team.splitPayCode,
          registrationStatus: capStatus,
          teamRegistrationStatus: teamStatus,
          pendingAmount: checkoutAmountDue,
        });
      } else if (mode === 'split') {
        const res = await fetch('/api/register/split-join', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            splitPayCode: splitCode,
            playerName,
            playerEmail,
            position,
            gender: playerGender,
            waiverSigned: waiverChecked,
            waiverSignatureName: waiverSignature,
            paymentProcessed: processPaymentNow,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          if (data.standbyRecommended && matchedSplitTeam) {
            setStandbyRecommendedTeamId(matchedSplitTeam.id);
          }
          throw new Error(data.error || 'Split-pay join failed');
        }
        onDatabaseUpdate(data.db);
        const pStatus: 'Pending Payment' | 'Complete' = data.player.registrationStatus || 'Pending Payment';
        const tStatus: 'Pending Payment' | 'Complete' = data.team.registrationStatus || 'Pending Payment';
        setSuccessResult({
          title:
            pStatus === 'Complete'
              ? `Joined ${data.team.name} — Complete`
              : `Joined ${data.team.name} — Pending Payment`,
          subtitle:
            pStatus !== 'Complete'
              ? `Info saved as PENDING PAYMENT. Complete your $${formatMoney(
                  checkoutAmountDue
                )} split payment to finalize registration.`
              : data.paidShare === 0
              ? `Team Paid in Full ($0 Free Join)! Registration Complete${data.autoFlippedCoEd ? ' (Co-Ed 4M/7F Auto-Flip activated!)' : ''}.`
              : `Your even team split ($${formatMoney(data.paidShare)}) is paid — player registration is Complete${
                  tStatus === 'Complete' ? ' (Team Paid in Full & Complete!)' : ''
                }.${data.autoFlippedCoEd ? ' (Co-Ed 4M/7F Auto-Flip activated!)' : ''}`,
          teamId: data.team.id,
          playerId: data.player.id,
          registrationStatus: pStatus,
          teamRegistrationStatus: tStatus,
          pendingAmount: checkoutAmountDue,
        });
      } else {
        const res = await fetch('/api/register/solo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            leagueId,
            playerName,
            playerEmail,
            position,
            gender: playerGender,
            availableToSub: true,
            waiverSigned: waiverChecked,
            waiverSignatureName: waiverSignature,
            paymentProcessed: processPaymentNow,
            inviteFriend,
            friendName: inviteFriend ? friendName : undefined,
            friendEmail: inviteFriend ? friendEmail : undefined,
            friendGender: inviteFriend ? friendGender : undefined,
            friendPosition: inviteFriend ? friendPosition : undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Free agent registration failed');
        onDatabaseUpdate(data.db);
        const soloFee = selectedLeague?.entryFeeSolo ?? 250;
        const pStatus: 'Pending Payment' | 'Complete' = data.player.registrationStatus || 'Pending Payment';
        setSuccessResult({
          title:
            pStatus === 'Complete'
              ? `Free Agent Complete — Placed on ${data.team.name}`
              : `Free Agent Pending Payment — ${data.team.name}`,
          subtitle:
            pStatus !== 'Complete'
              ? `Details saved as PENDING PAYMENT. Process $${soloFee} payment to mark Free Agent registration Complete.`
              : data.friendInvite
              ? `$${soloFee} paid for yourself (Complete). Friend invite sent to ${data.friendInvite.friendName} — when they accept, you pay +$${soloFee} for your friend ($${soloFee * 2} total paid by you for both).`
              : `$${soloFee} paid for yourself in ${selectedLeague?.name} — marked Complete on ${data.team.name}.`,
          teamId: data.team.id,
          playerId: data.player.id,
          registrationStatus: pStatus,
          pendingAmount: soloFee,
          friendInvite: data.friendInvite,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitRegistration(true);
  };

  const splitLinkUrl = successResult?.splitCode
    ? `${window.location.origin}/?join=${successResult.splitCode}`
    : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-2xl border border-white/10 bg-[#111821] p-6 sm:p-8 shadow-2xl my-8">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <h2 className="font-display text-2xl font-bold text-white tracking-tight">
              Registration, Split-Pay & Early-Bird Waitlist
            </h2>
            <p className="text-sm text-slate-400 mt-0.5">
              Enter a full squad, join via split-pay link, sign up solo, or reserve an early-bird waitlist spot.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-white cursor-pointer"
            aria-label="Close registration"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {successResult ? (
          <div className="py-6 space-y-5">
            <div
              className={`rounded-xl border p-5 ${
                successResult.registrationStatus === 'Pending Payment'
                  ? 'border-amber-400/40 bg-amber-400/10'
                  : 'border-emerald-500/30 bg-emerald-500/10'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full text-slate-950 shrink-0 ${
                      successResult.registrationStatus === 'Pending Payment'
                        ? 'bg-amber-400'
                        : 'bg-emerald-500'
                    }`}
                  >
                    <Check className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-display text-xl font-bold text-white">
                      {successResult.title}
                    </h3>
                    <p className="text-sm text-slate-200 mt-0.5">{successResult.subtitle}</p>
                  </div>
                </div>
                {successResult.registrationStatus && (
                  <span
                    className={`shrink-0 rounded-md px-2.5 py-1 text-[11px] font-bold ${
                      successResult.registrationStatus === 'Complete'
                        ? 'bg-emerald-500 text-slate-950'
                        : 'bg-amber-400 text-slate-950'
                    }`}
                  >
                    {successResult.registrationStatus.toUpperCase()}
                  </span>
                )}
              </div>

              {successResult.registrationStatus === 'Pending Payment' &&
                successResult.playerId &&
                (successResult.pendingAmount ?? 0) > 0 && (
                  <div className="mt-4 pt-4 border-t border-amber-400/25 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs text-amber-200">
                      Complete ${formatMoney(successResult.pendingAmount || 0)} payment now to finalize and mark registration Complete.
                    </span>
                    <button
                      type="button"
                      onClick={async () => {
                        const r = await fetch(
                          `/api/players/${successResult.playerId}/complete-payment`,
                          {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ amount: successResult.pendingAmount }),
                          }
                        );
                        const d = await r.json();
                        if (r.ok) {
                          onDatabaseUpdate(d.db);
                          setSuccessResult((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  title: prev.title.replace('Pending Payment (Not Complete)', 'Registration Complete').replace('Pending Payment', 'Complete'),
                                  subtitle: `Payment of $${formatMoney(prev.pendingAmount || 0)} processed! Registration is now Complete.`,
                                  registrationStatus: 'Complete',
                                  teamRegistrationStatus: d.team.registrationStatus,
                                }
                              : null
                          );
                        }
                      }}
                      className="rounded-lg bg-emerald-500 px-3.5 py-1.5 text-xs font-bold text-slate-950 hover:bg-emerald-400 cursor-pointer"
                    >
                      Pay ${formatMoney(successResult.pendingAmount || 0)} &amp; Mark Complete
                    </button>
                  </div>
                )}

              {successResult.friendInvite && (
                <div className="mt-4 pt-4 border-t border-emerald-500/20 space-y-2.5 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-semibold text-white">
                        Friend Invite ({successResult.friendInvite.status}):{' '}
                        {successResult.friendInvite.friendName}
                      </span>
                      <div className="text-emerald-200/80">
                        Accepting adds {successResult.friendInvite.friendName} &amp; charges +$
                        {successResult.friendInvite.friendFee} to you ($
                        {successResult.friendInvite.totalIfAccepted} total for both).
                      </div>
                    </div>
                    {successResult.friendInvite.status === 'Pending' && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            const r = await fetch(
                              `/api/free-agent-invites/${successResult.friendInvite!.id}/respond`,
                              {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ decision: 'Accepted' }),
                              }
                            );
                            const d = await r.json();
                            if (r.ok) {
                              onDatabaseUpdate(d.db);
                              setSuccessResult((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      subtitle: `Friend invite accepted! ${d.friendPlayer.name} joined ${prev.title.replace('Free Agent Registered — Placed on ', '')}. Total paid by you for both: $${d.invite.totalIfAccepted}.`,
                                      friendInvite: d.invite,
                                    }
                                  : null
                              );
                            } else {
                              setError(d.error || 'Could not accept friend invite');
                            }
                          }}
                          className="rounded-lg bg-amber-400 px-3 py-1.5 font-bold text-slate-950 hover:bg-amber-300 cursor-pointer"
                        >
                          Friend Accepts (+${successResult.friendInvite.friendFee} → $
                          {successResult.friendInvite.totalIfAccepted} Total)
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {successResult.splitCode && (
                <div className="mt-4 pt-4 border-t border-emerald-500/20 space-y-2">
                  <p className="text-xs font-medium text-slate-300">
                    Shareable Split-Pay Link (Code:{' '}
                    <span className="font-mono-num text-amber-400">{successResult.splitCode}</span>)
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={splitLinkUrl}
                      className="w-full rounded-lg border border-white/10 bg-[#090D12] px-3 py-2 text-xs font-mono text-slate-200"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(splitLinkUrl);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1800);
                      }}
                      className="min-h-[38px] shrink-0 rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/15 flex items-center gap-1.5 cursor-pointer"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[42px] rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/5 cursor-pointer"
              >
                Close
              </button>
              {successResult.teamId && (
                <button
                  type="button"
                  onClick={() => {
                    onGoToClubhouse(successResult.teamId!);
                    onClose();
                  }}
                  className="min-h-[42px] rounded-lg bg-emerald-500 px-5 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 cursor-pointer"
                >
                  Open Team Locker Room
                </button>
              )}
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-5 space-y-5">
            {/* Registration Mode Selector */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 rounded-xl bg-[#090D12] p-1.5 border border-white/10">
              {[
                { id: 'team' as const, label: 'Full Team', icon: <Users className="h-3.5 w-3.5" /> },
                { id: 'split' as const, label: 'Split-Pay Link', icon: <Link2 className="h-3.5 w-3.5" /> },
                { id: 'solo' as const, label: 'Solo Agent', icon: <UserPlus className="h-3.5 w-3.5" /> },
                { id: 'waitlist' as const, label: 'Early-Bird List', icon: <BookmarkCheck className="h-3.5 w-3.5" /> },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setMode(opt.id)}
                  className={`min-h-[42px] flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                    mode === opt.id
                      ? 'bg-emerald-500 text-slate-950'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {opt.icon}
                  <span className="whitespace-nowrap">{opt.label}</span>
                </button>
              ))}
            </div>

            {/* Gender Account Selector (Co-Ed 7M/4F & Auto-Flip 4M/7F Roster Caps) */}
            {mode !== 'waitlist' && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-white/10 bg-[#090D12] px-4 py-3">
                <div>
                  <div className="text-xs font-semibold text-white">Player Account Gender</div>
                  <div className="text-[11px] text-slate-400">
                    All leagues are strictly Co-Ed — enforces 7M/4F (and auto-flip 4M/7F) roster caps.
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {(['Female', 'Male'] as const).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setPlayerGender(g)}
                      className={`min-h-[34px] rounded-lg px-3.5 py-1 text-xs font-semibold cursor-pointer border ${
                        playerGender === g
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                          : 'bg-[#111821] text-slate-300 border-white/10 hover:text-white'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {mode !== 'waitlist' && !genderEligibility.allowed && (
              <div className="flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
                <ShieldAlert className="h-4 w-4 text-rose-400 shrink-0" />
                <span>{genderEligibility.reason}</span>
              </div>
            )}

            {mode !== 'split' ? (
              db.leagues.length === 0 ? (
                <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-xs space-y-2">
                  <div className="font-semibold text-amber-200">
                    No Active Leagues Launched Yet
                  </div>
                  <p className="text-slate-300">
                    {mode === 'waitlist'
                      ? 'You can still join the general Early-Bird Interest & Waitlist below — we will notify you as soon as the first league opens!'
                      : 'Team & Solo registrations open as soon as the Admin publishes the first league and types its field/venue manually.'}
                  </p>
                  {onOpenAdmin && (
                    <button
                      type="button"
                      onClick={onOpenAdmin}
                      className="rounded-lg bg-emerald-500 px-3.5 py-1.5 font-semibold text-slate-950 cursor-pointer"
                    >
                      Open Admin Panel ({db.brand.adminPin})
                    </button>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Select League or Monthly Cash Cup
                  </label>
                  <select
                    value={leagueId}
                    onChange={(e) => setLeagueId(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-[#090D12] px-3 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
                  >
                    {db.leagues.map((lg) => {
                      const count = db.teams.filter((t) => t.leagueId === lg.id).length;
                      const prize = computeDynamicPrizeDisplay(lg, count);
                      const elig = checkDivisionGenderEligibility(lg.division, playerGender);
                      return (
                        <option key={lg.id} value={lg.id}>
                          {!elig.allowed && mode !== 'waitlist' ? '[LOCKED] ' : `[${lg.status}] `}
                          {lg.name} ({lg.city} · {lg.division} {lg.format} · {prize.headlinePrize})
                        </option>
                      );
                    })}
                  </select>
                </div>
              )
            ) : (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Team Split-Pay / Friend Invite Code
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder="e.g. METR77 or APEX77"
                    value={splitCode}
                    onChange={(e) => setSplitCode(e.target.value.toUpperCase())}
                    className="w-full rounded-lg border border-white/10 bg-[#090D12] px-3 py-2.5 text-sm font-mono text-white placeholder:text-slate-500"
                  />
                  <select
                    aria-label="Quick pick team"
                    value=""
                    onChange={(e) => {
                      if (e.target.value) setSplitCode(e.target.value);
                    }}
                    className="rounded-lg border border-white/10 bg-[#090D12] px-3 py-2.5 text-xs text-slate-300"
                  >
                    <option value="">Pick Team…</option>
                    {db.teams.map((t) => (
                      <option key={t.id} value={t.splitPayCode}>
                        {t.name} ({t.splitPayCode})
                        {t.amountPaid >= t.totalFee ? ' — $0 Paid in Full' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                {matchedSplitTeam && splitEvaluation && (
                  <div className="mt-2 rounded-xl border border-white/10 bg-[#090D12] p-3 text-xs space-y-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-white">
                        {matchedSplitTeam.name} ·{' '}
                        <span className="text-emerald-400">
                          {matchedSplitTeam.amountPaid >= matchedSplitTeam.totalFee
                            ? '$0 Free Join (Team Paid in Full)'
                            : `Split Share: $${Math.round(
                                matchedSplitTeam.totalFee / matchedSplitTeam.splitTargetPlayers
                              )}`}
                        </span>
                      </span>
                      <span className="font-mono-num text-slate-300">
                        Roster: {splitEvaluation.rosterCount}/{splitEvaluation.rosterCap}
                        {splitLeague?.division === 'Co-Ed'
                          ? ` · ${splitEvaluation.maleCount}/${splitEvaluation.maleCap}M · ${splitEvaluation.femaleCount}/${splitEvaluation.femaleCap}F`
                          : ''}
                      </span>
                    </div>
                    {splitEvaluation.shouldAutoFlipTo4M7F && (
                      <div className="text-amber-300 font-medium">
                        {splitEvaluation.reason}
                      </div>
                    )}
                    {!splitEvaluation.allowed && splitEvaluation.standbyRecommended && (
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-rose-300">
                        <span>{splitEvaluation.reason}</span>
                        <button
                          type="button"
                          onClick={handleJoinTeamStandby}
                          className="rounded-md border border-amber-400/40 bg-amber-400/15 px-3 py-1 font-semibold text-amber-200 hover:bg-amber-400/25 cursor-pointer"
                        >
                          Join Team Standby Waitlist
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTargetLeague && (
              <div className="rounded-xl border border-white/10 bg-[#090D12] p-4 space-y-2.5 text-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-white">
                    <MapPin className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                    <span>
                      Available Matchday Fields ({activeVenueFields.length}{' '}
                      {activeVenueFields.length === 1 ? 'Field' : 'Fields'})
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-mono-num text-amber-300">
                    <Clock className="h-3 w-3 shrink-0" />
                    <span>25m 1st · 5m HT · 25m 2nd (55m)</span>
                  </span>
                </div>

                <div
                  className={`grid gap-2 ${
                    activeVenueFields.length >= 3
                      ? 'grid-cols-3'
                      : activeVenueFields.length === 2
                      ? 'grid-cols-2'
                      : 'grid-cols-1'
                  }`}
                >
                  {activeVenueFields.map((fieldLabel, idx) => (
                    <div
                      key={`${fieldLabel}_${idx}`}
                      className="rounded-lg border border-emerald-500/25 bg-[#111821] px-3 py-2 text-center font-semibold text-emerald-300"
                    >
                      {fieldLabel}
                    </div>
                  ))}
                </div>

                <p className="text-[11px] text-slate-400">
                  {activeVenue?.name || activeTargetLeague.locationName} has {activeVenueFields.length}{' '}
                  {activeVenueFields.length === 1 ? 'field' : 'fields'} ({activeVenueFields.join(', ')}). Fields are assigned randomly per match across each matchday schedule.
                </p>
              </div>
            )}

            {mode === 'team' && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Team Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Pier 9 Strikers"
                      value={teamName}
                      onChange={(e) => setTeamName(e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-[#090D12] px-3 py-2.5 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Captain Full Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Full name"
                      value={captainName}
                      onChange={(e) => setCaptainName(e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-[#090D12] px-3 py-2.5 text-sm text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Captain Email
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="captain@team.com"
                      value={captainEmail}
                      onChange={(e) => setCaptainEmail(e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-[#090D12] px-3 py-2.5 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Promo Code (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. EARLY50"
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                      className="w-full rounded-lg border border-white/10 bg-[#090D12] px-3 py-2.5 text-sm font-mono text-white"
                    />
                    {matchedPromo && (
                      <span className="text-[11px] text-emerald-400">
                        -${matchedPromo.discountAmount} applied!
                      </span>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Jersey Color
                    </label>
                    <div className="flex items-center gap-2">
                      {['#10B981', '#F59E0B', '#38BDF8', '#FFFFFF', '#FB7185'].map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setKitColor(c)}
                          className={`h-9 w-9 rounded-lg border cursor-pointer ${
                            kitColor === c ? 'border-emerald-400 scale-105' : 'border-white/20 opacity-70'
                          }`}
                          style={{ backgroundColor: c }}
                          aria-label={`Kit color ${c}`}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {selectedLeague && (
                  <div className="space-y-2.5">
                    <label className="block text-xs font-medium text-slate-300">
                      Team Cost Payment Option (No Deposits)
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => setPaymentMode('split')}
                        className={`rounded-xl border p-3.5 text-left transition-colors cursor-pointer ${
                          paymentMode === 'split'
                            ? 'border-emerald-500 bg-emerald-500/10'
                            : 'border-white/10 bg-[#090D12]'
                        }`}
                      >
                        <div className="text-xs font-semibold text-white">
                          Split Team Fee Evenly Across Players
                        </div>
                        <div className="font-mono-num text-lg font-bold text-emerald-400 mt-0.5">
                          ${formatMoney(effectiveTeamFee / Math.max(1, splitTargetPlayers))}/player
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          ${effectiveTeamFee} total team cost ÷ {splitTargetPlayers} players
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPaymentMode('full')}
                        className={`rounded-xl border p-3.5 text-left transition-colors cursor-pointer ${
                          paymentMode === 'full'
                            ? 'border-emerald-500 bg-emerald-500/10'
                            : 'border-white/10 bg-[#090D12]'
                        }`}
                      >
                        <div className="text-xs font-semibold text-white">Pay Full Team Cost Upfront</div>
                        <div className="font-mono-num text-lg font-bold text-emerald-400 mt-0.5">
                          ${effectiveTeamFee}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Covers all teammates ($0 free join for squad)
                        </div>
                      </button>
                    </div>

                    {paymentMode === 'split' && (
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-[#090D12] px-3 py-2.5">
                        <span className="text-xs text-slate-300">
                          Number of players splitting ${effectiveTeamFee} evenly:
                        </span>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={2}
                            max={22}
                            value={splitTargetPlayers}
                            onChange={(e) =>
                              setSplitTargetPlayers(Math.max(2, Math.min(22, Number(e.target.value) || 10)))
                            }
                            className="w-20 rounded border border-white/15 bg-[#111821] px-2 py-1 text-right font-mono-num text-sm text-white"
                          />
                          <span className="text-xs font-mono-num text-emerald-400 font-semibold">
                            = ${formatMoney(effectiveTeamFee / Math.max(1, splitTargetPlayers))}/ea
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {mode !== 'team' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Full name"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-[#090D12] px-3 py-2.5 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="player@email.com"
                    value={playerEmail}
                    onChange={(e) => setPlayerEmail(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-[#090D12] px-3 py-2.5 text-sm text-white"
                  />
                </div>
                {mode === 'waitlist' ? (
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Interest Type
                    </label>
                    <select
                      value={waitlistType}
                      onChange={(e) => setWaitlistType(e.target.value as 'Team Captain' | 'Solo Player')}
                      className="w-full rounded-lg border border-white/10 bg-[#090D12] px-3 py-2.5 text-sm text-white"
                    >
                      <option value="Team Captain">Team Captain (Reserve Spot)</option>
                      <option value="Solo Player">Solo Free Agent</option>
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Preferred Position
                    </label>
                    <select
                      value={position}
                      onChange={(e) => setPosition(e.target.value as PlayerPosition)}
                      className="w-full rounded-lg border border-white/10 bg-[#090D12] px-3 py-2.5 text-sm text-white"
                    >
                      <option value="GK">GK — Goalkeeper</option>
                      <option value="DEF">DEF — Defender</option>
                      <option value="MID">MID — Midfielder</option>
                      <option value="FWD">FWD — Forward</option>
                    </select>
                  </div>
                )}
              </div>
            )}

            {mode === 'solo' && selectedLeague && (
              <div className="rounded-xl border border-amber-400/25 bg-amber-400/5 p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-semibold text-amber-300">
                      Free Agent Pricing &amp; Invite a Friend (Pay for Both)
                    </div>
                    <p className="text-[11px] text-slate-300 mt-0.5">
                      Free Agent registration charges ${selectedLeague.entryFeeSolo} for yourself. If you invite a friend and they accept, you pay ${selectedLeague.entryFeeSolo} + ${selectedLeague.entryFeeSolo} = ${selectedLeague.entryFeeSolo * 2} total for both.
                    </p>
                  </div>
                  <label className="inline-flex items-center gap-2 shrink-0 rounded-lg border border-white/15 bg-[#090D12] px-3 py-2 text-xs font-semibold text-white cursor-pointer">
                    <input
                      type="checkbox"
                      checked={inviteFriend}
                      onChange={(e) => setInviteFriend(e.target.checked)}
                      className="h-4 w-4 accent-emerald-500"
                    />
                    <span>Invite Friend (+${selectedLeague.entryFeeSolo})</span>
                  </label>
                </div>

                {inviteFriend && (
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 pt-2 border-t border-white/10 text-xs">
                    <input
                      type="text"
                      required
                      placeholder="Friend Full Name"
                      value={friendName}
                      onChange={(e) => setFriendName(e.target.value)}
                      className="rounded-lg border border-white/15 bg-[#090D12] px-3 py-2 text-white"
                    />
                    <input
                      type="email"
                      placeholder="Friend Email (optional)"
                      value={friendEmail}
                      onChange={(e) => setFriendEmail(e.target.value)}
                      className="rounded-lg border border-white/15 bg-[#090D12] px-3 py-2 text-white"
                    />
                    <select
                      value={friendGender}
                      onChange={(e) => setFriendGender(e.target.value as 'Female' | 'Male')}
                      className="rounded-lg border border-white/15 bg-[#090D12] px-2.5 py-2 text-white"
                    >
                      <option value="Male">Friend: Male</option>
                      <option value="Female">Friend: Female</option>
                    </select>
                    <select
                      value={friendPosition}
                      onChange={(e) => setFriendPosition(e.target.value as PlayerPosition)}
                      className="rounded-lg border border-white/15 bg-[#090D12] px-2.5 py-2 text-white"
                    >
                      <option value="GK">Pos: GK</option>
                      <option value="DEF">Pos: DEF</option>
                      <option value="MID">Pos: MID</option>
                      <option value="FWD">Pos: FWD</option>
                    </select>
                  </div>
                )}
              </div>
            )}

            {mode !== 'waitlist' && (
              <div className="rounded-xl border border-white/10 bg-[#090D12] p-4 space-y-3">
                <div className="text-xs font-semibold text-white">
                  Digital Liability Waiver &amp; Cash-Prize Rules
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {db.brand.rulesSummary}
                </p>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={waiverChecked}
                    onChange={(e) => setWaiverChecked(e.target.checked)}
                    className="mt-0.5 h-5 w-5 rounded border-white/20 bg-[#111821]"
                  />
                  <span className="text-xs text-slate-200">
                    I agree to the Participant Liability Waiver and league conduct rules.
                  </span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Type full legal name as e-signature"
                  value={waiverSignature}
                  onChange={(e) => setWaiverSignature(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-[#111821] px-3 py-2 text-sm text-white"
                />
              </div>
            )}

            {mode !== 'waitlist' && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-white">
                    Payment Checkout (Required to Mark Registration Complete)
                  </span>
                  <span className="font-mono-num text-sm font-bold text-emerald-400">
                    Due Today: ${formatMoney(checkoutAmountDue)}
                  </span>
                </div>
                {checkoutAmountDue > 0 ? (
                  <>
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={paymentAuthorized}
                        onChange={(e) => setPaymentAuthorized(e.target.checked)}
                        className="mt-0.5 h-5 w-5 rounded border-white/20 bg-[#111821] accent-emerald-500"
                      />
                      <span className="text-xs text-slate-200">
                        Authorize and process payment of ${formatMoney(checkoutAmountDue)} now to finalize and mark registration Complete.
                      </span>
                    </label>
                    <p className="text-[11px] text-slate-400">
                      Registration is marked Complete only after all required info is submitted and payment is processed.
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-emerald-300">
                    $0 due today — submitting completes registration immediately.
                  </p>
                )}
              </div>
            )}

            {error && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
                <span>{error}</span>
                {standbyRecommendedTeamId && (
                  <button
                    type="button"
                    onClick={handleJoinTeamStandby}
                    className="rounded-md bg-amber-400 px-3 py-1 font-semibold text-slate-950 cursor-pointer"
                  >
                    Join Team Standby Waitlist
                  </button>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="text-xs text-slate-400">
                {mode === 'solo' && selectedLeague && (
                  <span>
                    {inviteFriend ? (
                      <>
                        Self now:{' '}
                        <span className="font-mono-num font-bold text-emerald-400">
                          ${selectedLeague.entryFeeSolo}
                        </span>{' '}
                        · Total on Friend Accept:{' '}
                        <span className="font-mono-num font-bold text-amber-300">
                          ${selectedLeague.entryFeeSolo * 2}
                        </span>
                      </>
                    ) : (
                      <>
                        Free Agent Fee (Yourself):{' '}
                        <span className="font-mono-num font-bold text-emerald-400">
                          ${selectedLeague.entryFeeSolo}
                        </span>
                      </>
                    )}
                  </span>
                )}
                {mode === 'waitlist' && (
                  <span>No payment required today — reserves priority pre-season spot.</span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[42px] rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/5 cursor-pointer"
                >
                  Cancel
                </button>
                {mode !== 'waitlist' && checkoutAmountDue > 0 && (
                  <button
                    type="button"
                    disabled={submitting || !genderEligibility.allowed || db.leagues.length === 0}
                    onClick={() => void submitRegistration(false)}
                    className="min-h-[42px] rounded-lg border border-amber-400/35 bg-amber-400/10 px-3.5 py-2 text-xs font-semibold text-amber-300 hover:bg-amber-400/20 disabled:opacity-50 cursor-pointer"
                  >
                    Save Info (Pending Payment)
                  </button>
                )}
                <button
                  type="submit"
                  disabled={
                    submitting ||
                    (mode !== 'waitlist' && !genderEligibility.allowed) ||
                    (mode !== 'waitlist' && checkoutAmountDue > 0 && !paymentAuthorized) ||
                    ((mode === 'team' || mode === 'solo') && db.leagues.length === 0)
                  }
                  className="min-h-[42px] rounded-lg bg-emerald-500 px-5 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50 cursor-pointer"
                >
                  {submitting
                    ? 'Submitting…'
                    : mode === 'waitlist'
                    ? 'Join Early-Bird Waitlist'
                    : checkoutAmountDue > 0
                    ? `Pay $${formatMoney(checkoutAmountDue)} & Complete`
                    : 'Complete Registration ($0)'}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
