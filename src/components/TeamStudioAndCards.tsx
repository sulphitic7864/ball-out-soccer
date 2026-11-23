import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  Palette,
  QrCode,
  Download,
  Shield,
  Users,
  Sparkles,
  X,
  Check,
} from 'lucide-react';
import type { League, LeagueDatabase, Player, Team } from '../types.ts';
import { computePlayerOvr, getEffectiveTeamCaps } from '../utils/leagueHelpers.ts';

interface TeamStudioProps {
  team: Team;
  league: League;
  roster: Player[];
  splitLink: string;
  onDatabaseUpdate: (db: LeagueDatabase) => void;
}

export const TeamStudioPanel: React.FC<TeamStudioProps> = ({
  team,
  league,
  roster,
  splitLink,
  onDatabaseUpdate,
}) => {
  const [name, setName] = useState(team.name);
  const [tag, setTag] = useState(team.tag || team.name.slice(0, 3).toUpperCase());
  const [bio, setBio] = useState(team.bio || '');
  const [badgeStyle, setBadgeStyle] = useState<NonNullable<Team['badgeStyle']>>(
    team.badgeStyle || 'Shield'
  );
  const [badgeUrl, setBadgeUrl] = useState(team.badgeUrl || '');
  const [kitColor, setKitColor] = useState(team.kitColor);
  const [kitColorName, setKitColorName] = useState(team.kitColorName || 'Custom Home');
  const [awayKitColor, setAwayKitColor] = useState(team.awayKitColor || '#FFFFFF');
  const [awayKitColorName, setAwayKitColorName] = useState(team.awayKitColorName || 'Away White');
  const [viceCaptainId, setViceCaptainId] = useState(team.viceCaptainId || '');
  const [jerseyNumbers, setJerseyNumbers] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    roster.forEach((p, i) => {
      map[p.id] = p.jerseyNumber ?? i + 2;
    });
    return map;
  });

  const caps = getEffectiveTeamCaps(team, league);
  const [maleCap, setMaleCap] = useState(caps.maleCap);
  const [femaleCap, setFemaleCap] = useState(caps.femaleCap);
  const [lineup, setLineup] = useState<Record<string, string>>(team.lineupPositions || {});
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  useEffect(() => {
    setName(team.name);
    setTag(team.tag || team.name.slice(0, 3).toUpperCase());
    setBio(team.bio || '');
    setBadgeStyle(team.badgeStyle || 'Shield');
    setBadgeUrl(team.badgeUrl || '');
    setKitColor(team.kitColor);
    setKitColorName(team.kitColorName || 'Custom Home');
    setAwayKitColor(team.awayKitColor || '#FFFFFF');
    setAwayKitColorName(team.awayKitColorName || 'Away White');
    setViceCaptainId(team.viceCaptainId || '');
    setLineup(team.lineupPositions || {});
    const nextCaps = getEffectiveTeamCaps(team, league);
    setMaleCap(nextCaps.maleCap);
    setFemaleCap(nextCaps.femaleCap);
    const jMap: Record<string, number> = {};
    roster.forEach((p, i) => {
      jMap[p.id] = p.jerseyNumber ?? i + 2;
    });
    setJerseyNumbers(jMap);
  }, [team.id, league.id, roster.length]);

  useEffect(() => {
    QRCode.toDataURL(splitLink, {
      width: 240,
      margin: 1,
      color: { dark: '#090D12', light: '#FFFFFF' },
    })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(''));
  }, [splitLink]);

  const handleSaveStudio = async (e?: React.FormEvent, customLineup?: Record<string, string>) => {
    if (e) e.preventDefault();
    setSaving(true);
    setSavedMsg('');
    try {
      const res = await fetch(`/api/teams/${team.id}/studio`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          tag,
          bio,
          badgeStyle,
          badgeUrl,
          kitColor,
          kitColorName,
          awayKitColor,
          awayKitColorName,
          viceCaptainId,
          jerseyNumbers,
          customMaleCap: league.division === 'Co-Ed' ? maleCap : undefined,
          customFemaleCap: league.division === 'Co-Ed' ? femaleCap : undefined,
          autoFlippedCoEd: league.division === 'Co-Ed' && maleCap === 4 && femaleCap === 7,
          lineupPositions: customLineup ?? lineup,
        }),
      });
      if (res.ok) {
        onDatabaseUpdate(await res.json());
        setSavedMsg('Team Studio & Lineup saved!');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadQrPoster = async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 900;
    canvas.height = 1200;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#090D12';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = kitColor || '#10B981';
    ctx.fillRect(0, 0, canvas.width, 22);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 58px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(name.toUpperCase(), 450, 150);

    ctx.fillStyle = '#F59E0B';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText(`${league.name} · ${league.city}`, 450, 210);

    ctx.fillStyle = '#94A3B8';
    ctx.font = '24px sans-serif';
    ctx.fillText(
      team.amountPaid >= team.totalFee
        ? 'SQUAD PAID IN FULL — $0 FRIEND JOIN'
        : `SPLIT-PAY CODE: ${team.splitPayCode}`,
      450,
      265
    );

    if (qrDataUrl) {
      const img = new Image();
      await new Promise<void>((resolve) => {
        img.onload = () => resolve();
        img.src = qrDataUrl;
      });
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(230, 340, 440, 440);
      ctx.drawImage(img, 250, 360, 400, 400);
    }

    ctx.fillStyle = '#10B981';
    ctx.font = 'bold 34px sans-serif';
    ctx.fillText('SCAN QR TO JOIN ROSTER', 450, 880);

    ctx.fillStyle = '#CBD5E1';
    ctx.font = '22px monospace';
    ctx.fillText(splitLink, 450, 940);

    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `${name.replace(/\s+/g, '_')}_Recruit_Poster.png`;
    a.click();
  };

  const slots = [
    { key: 'GK', label: 'GK (Keeper)' },
    { key: 'DEF1', label: 'DEF (Left)' },
    { key: 'DEF2', label: 'DEF (Right)' },
    { key: 'MID1', label: 'MID (Center)' },
    { key: 'MID2', label: 'MID (Wing)' },
    { key: 'FWD1', label: 'FWD (Striker)' },
    { key: 'FWD2', label: 'FWD (Second)' },
  ];

  return (
    <div className="space-y-6">
      {/* Co-Ed On-Field Gender Ratio Reminder */}
      {league.division === 'Co-Ed' && (
        <div className="rounded-xl border border-amber-400/35 bg-amber-400/10 px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="font-semibold text-amber-200">
            Co-Ed Match Rule Reminder: Minimum 2 Female players on the turf at all times.
          </div>
          <div className="font-mono-num text-amber-300 font-bold">
            Active Split: {maleCap}M / {femaleCap}F
            {maleCap === 4 && femaleCap === 7 ? ' (Auto-Flipped)' : ''}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Captain Team Studio ("Make It Yours") */}
        <form
          onSubmit={(e) => handleSaveStudio(e)}
          className="lg:col-span-7 rounded-2xl border border-white/10 bg-[#111821] p-5 sm:p-6 space-y-5"
        >
          <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <Palette className="h-5 w-5 text-emerald-400" />
              <h3 className="font-display text-xl font-bold text-white">
                Captain Team Studio (&quot;Make It Yours&quot;)
              </h3>
            </div>
            {savedMsg && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400">
                <Check className="h-3.5 w-3.5" />
                {savedMsg}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="sm:col-span-2">
              <label className="block text-[11px] text-slate-400 mb-1">Team Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-white/15 bg-[#090D12] px-3 py-2 text-white font-semibold"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">3-Letter Tag</label>
              <input
                type="text"
                maxLength={4}
                value={tag}
                onChange={(e) => setTag(e.target.value.toUpperCase())}
                className="w-full rounded-lg border border-white/15 bg-[#090D12] px-3 py-2 text-white font-mono uppercase"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Crest Badge Shape</label>
              <select
                value={badgeStyle}
                onChange={(e) => setBadgeStyle(e.target.value as NonNullable<Team['badgeStyle']>)}
                className="w-full rounded-lg border border-white/15 bg-[#090D12] px-3 py-2 text-white"
              >
                <option value="Shield">Shield Crest</option>
                <option value="Circle">Circle Badge</option>
                <option value="Hexagon">Hexagon Crest</option>
                <option value="Diamond">Diamond Crest</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Vice-Captain</label>
              <select
                value={viceCaptainId}
                onChange={(e) => setViceCaptainId(e.target.value)}
                className="w-full rounded-lg border border-white/15 bg-[#090D12] px-3 py-2 text-white"
              >
                <option value="">None Assigned</option>
                {roster
                  .filter((p) => !p.isCaptain)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.position})
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Custom Crest URL (Optional)</label>
              <input
                type="url"
                placeholder="https://..."
                value={badgeUrl}
                onChange={(e) => setBadgeUrl(e.target.value)}
                className="w-full rounded-lg border border-white/15 bg-[#090D12] px-3 py-2 text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="rounded-xl border border-white/10 bg-[#090D12] p-3 space-y-2">
              <div className="text-[11px] text-slate-400">Home Jersey Kit</div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={kitColor}
                  onChange={(e) => setKitColor(e.target.value)}
                  className="h-8 w-10 rounded border border-white/15 bg-transparent cursor-pointer"
                />
                <input
                  type="text"
                  value={kitColorName}
                  onChange={(e) => setKitColorName(e.target.value)}
                  placeholder="Home Color Name"
                  className="flex-1 rounded-lg border border-white/15 bg-[#111821] px-2.5 py-1.5 text-white"
                />
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-[#090D12] p-3 space-y-2">
              <div className="text-[11px] text-slate-400">Away Jersey Kit</div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={awayKitColor}
                  onChange={(e) => setAwayKitColor(e.target.value)}
                  className="h-8 w-10 rounded border border-white/15 bg-transparent cursor-pointer"
                />
                <input
                  type="text"
                  value={awayKitColorName}
                  onChange={(e) => setAwayKitColorName(e.target.value)}
                  placeholder="Away Color Name"
                  className="flex-1 rounded-lg border border-white/15 bg-[#111821] px-2.5 py-1.5 text-white"
                />
              </div>
            </div>
          </div>

          <div className="text-xs">
            <label className="block text-[11px] text-slate-400 mb-1">Team Bio / Locker Motto</label>
            <input
              type="text"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full rounded-lg border border-white/15 bg-[#090D12] px-3 py-2 text-white"
            />
          </div>

          {league.division === 'Co-Ed' && (
            <div className="rounded-xl border border-white/10 bg-[#090D12] p-3.5 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white">Co-Ed Roster Split (11-Player Max)</span>
                <span className="font-mono-num text-emerald-400">{maleCap}M / {femaleCap}F</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: '7M / 4F (Default)', m: 7, f: 4 },
                  { label: '4M / 7F (Flip)', m: 4, f: 7 },
                  { label: '6M / 5F', m: 6, f: 5 },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      setMaleCap(preset.m);
                      setFemaleCap(preset.f);
                    }}
                    className={`rounded-lg px-3 py-1.5 font-semibold cursor-pointer border ${
                      maleCap === preset.m && femaleCap === preset.f
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                        : 'bg-[#111821] text-slate-300 border-white/10'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Jersey Numbers */}
          <div className="space-y-2 text-xs">
            <div className="text-[11px] font-semibold text-slate-300">Squad Jersey Numbers</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {roster.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-[#090D12] px-2.5 py-1.5"
                >
                  <span className="truncate text-slate-200">{p.name.split(' ')[0]}</span>
                  <input
                    type="number"
                    min={0}
                    max={99}
                    value={jerseyNumbers[p.id] ?? 0}
                    onChange={(e) =>
                      setJerseyNumbers((prev) => ({
                        ...prev,
                        [p.id]: Number(e.target.value),
                      }))
                    }
                    className="w-12 rounded border border-white/15 bg-[#111821] px-1.5 py-0.5 text-right font-mono-num text-amber-300"
                  />
                </div>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="min-h-[42px] rounded-lg bg-emerald-500 px-5 py-2 text-xs font-semibold text-slate-950 cursor-pointer"
          >
            {saving ? 'Saving Studio…' : 'Save Team Studio Changes'}
          </button>
        </form>

        {/* QR Code Recruit Poster + Starting Lineup Tactics Board */}
        <div className="lg:col-span-5 space-y-6">
          <div className="rounded-2xl border border-white/10 bg-[#111821] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <QrCode className="h-5 w-5 text-amber-400" />
                <h3 className="font-display text-lg font-bold text-white">
                  Scannable Team QR Poster
                </h3>
              </div>
              <span className="font-mono-num text-xs text-emerald-400">{team.splitPayCode}</span>
            </div>

            <div className="flex items-center gap-4 rounded-xl border border-white/10 bg-[#090D12] p-4">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt={`QR invite code for ${team.name}`}
                  className="h-28 w-28 rounded-lg bg-white p-1.5 shrink-0"
                />
              ) : (
                <div className="h-28 w-28 rounded-lg bg-white/10 shrink-0" />
              )}
              <div className="space-y-2 text-xs">
                <div className="font-bold text-white">{name} [{tag}]</div>
                <p className="text-slate-400">
                  Teammates scan this QR code to jump straight into checkout (
                  {team.amountPaid >= team.totalFee ? '$0 Paid in Full' : 'Split-Pay Link'}).
                </p>
                <button
                  type="button"
                  onClick={handleDownloadQrPoster}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-3 py-1.5 font-semibold text-slate-950 cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download Recruit Poster (PNG)</span>
                </button>
              </div>
            </div>
          </div>

          {/* Interactive Starting Lineup / Tactics Board */}
          <div className="rounded-2xl border border-white/10 bg-[#111821] p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-emerald-400" />
                <h3 className="font-display text-lg font-bold text-white">
                  Starting Lineup &amp; Tactics Board
                </h3>
              </div>
              <button
                type="button"
                onClick={() => handleSaveStudio(undefined, lineup)}
                className="rounded-md bg-emerald-500/15 border border-emerald-500/40 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 cursor-pointer"
              >
                Save Lineup
              </button>
            </div>

            <div className="rounded-xl border border-emerald-500/25 bg-gradient-to-b from-emerald-950/40 to-[#090D12] p-3.5 space-y-2">
              {slots.map((sl) => (
                <div key={sl.key} className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-mono-num font-semibold text-emerald-300 w-28 shrink-0">
                    {sl.label}
                  </span>
                  <select
                    value={lineup[sl.key] || ''}
                    onChange={(e) => setLineup((prev) => ({ ...prev, [sl.key]: e.target.value }))}
                    className="flex-1 rounded-lg border border-white/15 bg-[#111821] px-2.5 py-1.5 text-xs text-white"
                  >
                    <option value="">Open Spot…</option>
                    {roster.map((p) => (
                      <option key={p.id} value={p.id}>
                        #{jerseyNumbers[p.id] ?? p.jerseyNumber ?? 0} {p.name} ({p.gender || 'M'} · {p.position})
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface PlayerCardModalProps {
  player: Player | null;
  team: Team;
  league: League;
  onClose: () => void;
}

export const PlayerCardModal: React.FC<PlayerCardModalProps> = ({
  player,
  team,
  league,
  onClose,
}) => {
  if (!player) return null;
  const stats = computePlayerOvr(player);

  const handleDownloadStoryPng = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 720;
    canvas.height = 1280;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const grad = ctx.createLinearGradient(0, 0, 720, 1280);
    grad.addColorStop(0, '#090D12');
    grad.addColorStop(0.5, '#111821');
    grad.addColorStop(1, '#062019');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 720, 1280);

    // Card frame
    ctx.strokeStyle = stats.tier === 'Champion' ? '#F59E0B' : '#10B981';
    ctx.lineWidth = 8;
    ctx.strokeRect(60, 140, 600, 880);

    ctx.fillStyle = '#F59E0B';
    ctx.font = 'bold 120px sans-serif';
    ctx.fillText(String(stats.ovr), 110, 290);

    ctx.fillStyle = '#10B981';
    ctx.font = 'bold 42px sans-serif';
    ctx.fillText(player.position, 118, 345);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 54px sans-serif';
    ctx.fillText(`#${player.jerseyNumber ?? 10} ${player.name.toUpperCase()}`, 110, 480);

    ctx.fillStyle = '#CBD5E1';
    ctx.font = '28px sans-serif';
    ctx.fillText(`${team.name} · ${league.name}`, 110, 535);

    ctx.fillStyle = '#94A3B8';
    ctx.font = 'bold 34px monospace';
    ctx.fillText(`PAC ${stats.pac}   SHO ${stats.sho}`, 110, 660);
    ctx.fillText(`PAS ${stats.pas}   DEF ${stats.def}`, 110, 720);

    ctx.fillStyle = '#10B981';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText(
      `${player.gamesPlayed} GP · ${player.goals} GOALS · ${player.assists} ASSISTS · ${player.motmAwards ?? 0} MOTM`,
      110,
      860
    );

    ctx.fillStyle = '#F59E0B';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText(`BALL OUT SOCCER ${stats.tier.toUpperCase()} CARD`, 110, 1130);

    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `${player.name.replace(/\s+/g, '_')}_PlayerCard_Story.png`;
    a.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-sm rounded-2xl border border-amber-400/40 bg-gradient-to-b from-[#16202C] to-[#090D12] p-6 shadow-2xl space-y-5">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white cursor-pointer"
          aria-label="Close player card"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-start justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-300">
              <Sparkles className="h-3.5 w-3.5" />
              <span>{stats.tier} Evolving Card</span>
            </div>
            <div className="font-mono-num text-5xl font-extrabold text-white mt-1">{stats.ovr}</div>
            <div className="text-sm font-bold text-emerald-400">
              {player.position} · #{player.jerseyNumber ?? 10}
            </div>
          </div>
          <div
            className="flex h-14 w-14 items-center justify-center rounded-xl border border-white/20 text-xs font-extrabold text-slate-950"
            style={{ backgroundColor: team.kitColor }}
          >
            <Shield className="h-6 w-6" />
          </div>
        </div>

        <div>
          <h3 className="font-display text-2xl font-bold text-white">{player.name}</h3>
          <div className="text-xs text-slate-400">
            {team.name} · {player.gender || 'Male'} · {league.name}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2 rounded-xl border border-white/10 bg-[#090D12] p-3 text-center">
          <div>
            <div className="text-[10px] text-slate-400">PAC</div>
            <div className="font-mono-num text-lg font-bold text-white">{stats.pac}</div>
          </div>
          <div>
            <div className="text-[10px] text-slate-400">SHO</div>
            <div className="font-mono-num text-lg font-bold text-emerald-400">{stats.sho}</div>
          </div>
          <div>
            <div className="text-[10px] text-slate-400">PAS</div>
            <div className="font-mono-num text-lg font-bold text-white">{stats.pas}</div>
          </div>
          <div>
            <div className="text-[10px] text-slate-400">DEF</div>
            <div className="font-mono-num text-lg font-bold text-amber-300">{stats.def}</div>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs font-mono-num text-slate-300 border-t border-white/10 pt-3">
          <span>{player.gamesPlayed} GP</span>
          <span>{player.goals} G</span>
          <span>{player.assists} A</span>
          <span>{player.motmAwards ?? 0} MOTM</span>
        </div>

        <button
          type="button"
          onClick={handleDownloadStoryPng}
          className="w-full min-h-[42px] inline-flex items-center justify-center gap-2 rounded-lg bg-amber-400 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-amber-300 cursor-pointer"
        >
          <Download className="h-4 w-4" />
          <span>Download Instagram / TikTok Story Card (PNG)</span>
        </button>
      </div>
    </div>
  );
};
