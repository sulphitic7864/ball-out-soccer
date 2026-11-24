import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Pool } from 'pg';
import type { PoolClient } from 'pg';
import type {
  BrandConfig,
  ChampionsCupConfig,
  FreeAgentFriendInvite,
  League,
  LeagueDatabase,
  Match,
  MatchEvent,
  Partner,
  Player,
  PromoCode,
  RideRequest,
  StaffMember,
  SubRequest,
  Team,
  TeamInvite,
  TransferOrLoanRequest,
  Venue,
} from './src/types.ts';
import {
  checkDivisionGenderEligibility,
  computeChampionsCupSeeds,
  evaluateTeamRosterAddition,
  generateAutoScaledCupMatches,
} from './src/utils/leagueHelpers.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const APP_DIR = process.env.VERCEL ? process.cwd() : __dirname;
const DATA_DIR = path.join(APP_DIR, 'data');
const DB_FILE = path.join(DATA_DIR, 'league-db.json');
const PORT = Number(process.env.PORT) || 3000;
const REF_PASSCODE = process.env.REF_PASSCODE || 'REF2026';
const POSTGRES_CONNECTION_STRING = process.env.POSTGRES_URL || process.env.DATABASE_URL;
const POSTGRES_TABLE = 'ball_out_state';
const POSTGRES_LOCK_ID = 85172931;

let postgresPool: Pool | undefined;
let postgresSchemaReady: Promise<void> | undefined;
let postgresWritePending = false;

const MARKET_COOLDOWN_MS = 72 * 60 * 60 * 1000;
const LIFELINE_COOLDOWN_MS = 72 * 60 * 60 * 1000;

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;
}

function createSeedDatabase(): LeagueDatabase {
  const brand: BrandConfig = {
    siteName: 'Ball Out Soccer',
    tagline: 'Find your team. Play your game. Ball out.',
    aboutText:
      'Adult soccer leagues and tournaments for every level. Find your next game, bring your squad, and follow every fixture, table, and result in one place.',
    rulesSummary:
      'Mandatory digital liability waiver required before kickoff. Permanent transfers are 1-for-1 swaps only. 4-game loans lock players from playing for their parent club for 4 matches. Playoff rosters require minimum regular-season appearances (anti-ringer rule).',
    primaryColor: '#10B981',
    accentColor: '#F59E0B',
    bannerEnabled: true,
    bannerText: 'Your next season starts here — find a league, bring your team, and get ready to play.',
    adminPin: '26231',
  };

  const cities: string[] = [];
  const venues: Venue[] = [];
  const leagues: League[] = [];
  const teams: Team[] = [];
  const players: Player[] = [];
  const matches: Match[] = [];
  const transfers: TransferOrLoanRequest[] = [];
  const doneDeals: LeagueDatabase['doneDeals'] = [];

  const staff: StaffMember[] = [
    {
      id: 'st_founder',
      name: 'Founder / Super Admin',
      email: 'founder@pitchpot.io',
      role: 'Founder / Super Admin',
      permissions: ['All Access', 'Finance & Payouts', 'Edit Site Brand', 'Manage Staff'],
      inviteCode: 'FOUNDER1',
      status: 'Active',
      createdAt: daysAgoIso(1),
    },
    {
      id: 'st_ref',
      name: 'Head Referee',
      email: 'ref@pitchpot.io',
      role: 'Referee / Scorekeeper',
      permissions: ['Roster Check-In', 'Submit Match Scores', 'Issue Cards'],
      inviteCode: 'REF2026',
      status: 'Active',
      createdAt: daysAgoIso(1),
    },
  ];

  const partners: Partner[] = [];
  const promoCodes: PromoCode[] = [
    {
      id: 'pr_early50',
      code: 'EARLY50',
      discountAmount: 50,
      description: 'Early-Bird Pre-Season Team Discount ($50 off)',
      active: true,
      uses: 0,
    },
  ];

  const waitlist: LeagueDatabase['waitlist'] = [];
  const rides: RideRequest[] = [];
  const teamMessages: LeagueDatabase['teamMessages'] = [];
  const directMessages: LeagueDatabase['directMessages'] = [];
  const rsvps: LeagueDatabase['rsvps'] = [];
  const polls: LeagueDatabase['polls'] = [];
  const opponentMessages: LeagueDatabase['opponentMessages'] = [];
  const subRequests: SubRequest[] = [];
  const motmVotes: LeagueDatabase['motmVotes'] = [];

  const championsCup: ChampionsCupConfig = {
    id: 'cup_coed_2026',
    name: 'Co-Ed Champion of Champions Super Cup',
    seasonLabel: 'Inaugural Season',
    enabled: true,
    linkedLeagueIds: [],
    bonusPrizeText: '$1,500 Bonus Cash Pot + Free Next Season Entry',
    minFemaleOnField: 2,
    enforceGenderRatio: true,
    lockRostersToRegularSeason: true,
    minRegularSeasonGames: 2,
    matches: [],
  };

  const teamInvites: TeamInvite[] = [];
  const freeAgentInvites: FreeAgentFriendInvite[] = [];

  return {
    brand,
    cities,
    venues,
    leagues,
    teams,
    players,
    matches,
    transfers,
    doneDeals,
    staff,
    partners,
    promoCodes,
    waitlist,
    rides,
    teamMessages,
    directMessages,
    rsvps,
    polls,
    opponentMessages,
    mutedPlayerIds: [],
    subRequests,
    motmVotes,
    championsCup,
    teamInvites,
    freeAgentInvites,
    schemaVersion: 4,
  };
}

function loadDatabase(persistToFile = true): LeagueDatabase {
  if (persistToFile && !fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    const seed = createSeedDatabase();
    if (persistToFile) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(DB_FILE, JSON.stringify(seed, null, 2), 'utf-8');
    }
    return seed;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<LeagueDatabase>;
    // Upgrade older pre-seeded DBs cleanly to Blank Launch schema v4
    if (
      parsed.schemaVersion !== 4 ||
      !parsed.brand ||
      !parsed.rides ||
      !parsed.staff ||
      !parsed.subRequests ||
      !parsed.championsCup ||
      !parsed.cities ||
      !parsed.teamInvites
    ) {
      const seed = createSeedDatabase();
      if (persistToFile) {
        fs.writeFileSync(DB_FILE, JSON.stringify(seed, null, 2), 'utf-8');
      }
      return seed;
    }
    const dbLoaded = parsed as LeagueDatabase;
    dbLoaded.freeAgentInvites = dbLoaded.freeAgentInvites || [];
    dbLoaded.leagues = (dbLoaded.leagues || []).map((l) => {
      const rest = { ...l } as League & { entryFeeDeposit?: number };
      delete rest.entryFeeDeposit;
      return {
        ...rest,
        division: 'Co-Ed' as const,
      };
    });
    dbLoaded.teams = (dbLoaded.teams || []).map((t) => ({
      ...t,
      paymentMode: t.paymentMode === 'full' ? 'full' : 'split',
      registrationStatus:
        t.amountPaid >= t.totalFee ? 'Complete' : t.registrationStatus || 'Pending Payment',
    }));
    dbLoaded.players = (dbLoaded.players || []).map((p) => ({
      ...p,
      registrationStatus:
        p.registrationStatus ||
        (p.waiverSigned && ((p.registrationPaidAmount ?? 0) > 0 || Boolean(p.paidByPlayerId))
          ? 'Complete'
          : 'Pending Payment'),
    }));
    return dbLoaded;
  } catch {
    const seed = createSeedDatabase();
    if (persistToFile) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(DB_FILE, JSON.stringify(seed, null, 2), 'utf-8');
    }
    return seed;
  }
}

function saveDatabase(db: LeagueDatabase): void {
  if (POSTGRES_CONNECTION_STRING) {
    postgresWritePending = true;
    return;
  }
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
}

function getPostgresPool(): Pool {
  if (!POSTGRES_CONNECTION_STRING) {
    throw new Error('POSTGRES_URL or DATABASE_URL must be configured.');
  }
  if (!postgresPool) {
    postgresPool = new Pool({
      connectionString: POSTGRES_CONNECTION_STRING,
      max: 1,
      connectionTimeoutMillis: 10000,
    });
  }
  return postgresPool;
}

async function ensurePostgresSchema(client: PoolClient): Promise<void> {
  if (!postgresSchemaReady) {
    postgresSchemaReady = client
      .query(
        `CREATE TABLE IF NOT EXISTS ${POSTGRES_TABLE} (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          payload JSONB NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`
      )
      .then(() => undefined)
      .catch((error: unknown) => {
        postgresSchemaReady = undefined;
        throw error;
      });
  }
  await postgresSchemaReady;
}

async function loadPostgresDatabase(
  client: PoolClient,
  initialState: LeagueDatabase
): Promise<LeagueDatabase> {
  const existing = await client.query<{ payload: LeagueDatabase | string }>(
    `SELECT payload FROM ${POSTGRES_TABLE} WHERE id = 1`
  );
  if (existing.rows[0]) {
    return typeof existing.rows[0].payload === 'string'
      ? (JSON.parse(existing.rows[0].payload) as LeagueDatabase)
      : existing.rows[0].payload;
  }

  await client.query(
    `INSERT INTO ${POSTGRES_TABLE} (id, payload)
     VALUES (1, $1::jsonb)
     ON CONFLICT (id) DO NOTHING`,
    [JSON.stringify(initialState)]
  );
  const initialized = await client.query<{ payload: LeagueDatabase | string }>(
    `SELECT payload FROM ${POSTGRES_TABLE} WHERE id = 1`
  );
  const payload = initialized.rows[0]?.payload;
  if (!payload) {
    throw new Error('Postgres league state could not be initialized.');
  }
  return typeof payload === 'string' ? (JSON.parse(payload) as LeagueDatabase) : payload;
}

async function persistPostgresDatabase(
  client: PoolClient,
  db: LeagueDatabase
): Promise<void> {
  await client.query(
    `INSERT INTO ${POSTGRES_TABLE} (id, payload, updated_at)
     VALUES (1, $1::jsonb, NOW())
     ON CONFLICT (id)
     DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()`,
    [JSON.stringify(db)]
  );
}

function computeServerStandings(leagueId: string, db: LeagueDatabase) {
  const leagueTeams = db.teams.filter((t) => t.leagueId === leagueId);
  const finals = db.matches.filter(
    (m) => m.leagueId === leagueId && (m.stage === 'Regular' || m.stage === 'Group') && m.status === 'Final'
  );
  const stats = new Map<string, { teamId: string; pts: number; gd: number; gf: number; name: string }>();
  for (const t of leagueTeams) {
    stats.set(t.id, { teamId: t.id, pts: 0, gd: 0, gf: 0, name: t.name });
  }
  for (const m of finals) {
    if (m.homeScore === null || m.awayScore === null) continue;
    const h = stats.get(m.homeTeamId);
    const a = stats.get(m.awayTeamId);
    if (!h || !a) continue;
    h.gf += m.homeScore;
    a.gf += m.awayScore;
    h.gd += m.homeScore - m.awayScore;
    a.gd += m.awayScore - m.homeScore;
    if (m.homeScore > m.awayScore) h.pts += 3;
    else if (m.homeScore < m.awayScore) a.pts += 3;
    else {
      h.pts += 1;
      a.pts += 1;
    }
  }
  return Array.from(stats.values())
    .sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.name.localeCompare(b.name))
    .map((s, idx) => ({ ...s, rank: idx + 1 }));
}

export async function createApp() {
  const app = express();
  app.use(express.json({ limit: '4mb' }));

  let db = loadDatabase(!POSTGRES_CONNECTION_STRING);

  if (POSTGRES_CONNECTION_STRING) {
    app.use('/api', async (_req, res, next) => {
      let client: PoolClient | undefined;
      let transactionOpen = false;
      let released = false;
      const finishTransaction = async (commit: boolean) => {
        if (!client || released) return;
        try {
          if (transactionOpen) {
            await client.query(commit ? 'COMMIT' : 'ROLLBACK');
            transactionOpen = false;
          }
        } catch (error) {
          released = true;
          client.release(true);
          throw error;
        }
        released = true;
        client.release();
      };

      try {
        client = await getPostgresPool().connect();
        await ensurePostgresSchema(client);
        await client.query('BEGIN');
        transactionOpen = true;
        await client.query('SELECT pg_advisory_xact_lock($1::bigint)', [POSTGRES_LOCK_ID]);
        db = await loadPostgresDatabase(client, db);
        postgresWritePending = false;

        const activeClient = client;
        const sendJson = res.json.bind(res);
        let responseStarted = false;
        res.once('finish', () => {
          void finishTransaction(false).catch((error: unknown) =>
            console.error('Failed to close the Postgres request transaction.', error)
          );
        });
        res.once('close', () => {
          if (!res.writableEnded) {
            void finishTransaction(false).catch((error: unknown) =>
              console.error('Failed to roll back the disconnected Postgres request.', error)
            );
          }
        });
        res.json = (body: unknown) => {
          if (responseStarted) return res;
          responseStarted = true;
          const shouldPersist = postgresWritePending;
          postgresWritePending = false;
          void (async () => {
            if (shouldPersist) {
              await persistPostgresDatabase(activeClient, db);
            }
            await finishTransaction(true);
            sendJson(body);
          })().catch(async (error: unknown) => {
            console.error('Failed to persist league state to Postgres.', error);
            try {
              await finishTransaction(false);
            } catch (rollbackError) {
              console.error('Failed to roll back the Postgres request transaction.', rollbackError);
            }
            if (!res.headersSent) {
              res.status(500);
              sendJson({ error: 'Unable to save league data. Please try again.' });
            }
          });
          return res;
        };
        next();
      } catch (error) {
        console.error('Unable to connect to the Postgres league database.', error);
        try {
          await finishTransaction(false);
        } catch (rollbackError) {
          console.error('Failed to roll back the Postgres request transaction.', rollbackError);
        }
        res.status(503).json({ error: 'League database is unavailable.' });
      }
    });
  }

  app.get('/api/state', (_req, res) => {
    res.json(db);
  });

  app.post('/api/reset-demo', (_req, res) => {
    db = createSeedDatabase();
    saveDatabase(db);
    res.json(db);
  });

  // Passcode verification (Admin PIN defaults to 26231; Ref defaults to REF2026)
  app.post('/api/auth/verify', (req, res) => {
    const { role, passcode } = req.body as { role: 'admin' | 'referee'; passcode: string };
    const adminPin = db.brand?.adminPin || '26231';
    if (passcode === adminPin) {
      return res.json({ ok: true, role: 'admin' });
    }
    if (role === 'referee' && passcode === REF_PASSCODE) {
      return res.json({ ok: true, role: 'referee' });
    }
    return res.status(401).json({ ok: false, error: 'Invalid access PIN or passcode' });
  });

  // Update Visual Site & Brand Customizer
  app.patch('/api/brand', (req, res) => {
    Object.assign(db.brand, req.body);
    saveDatabase(db);
    res.json(db);
  });

  // Cities Manager
  app.post('/api/cities', (req, res) => {
    const { name } = req.body as { name: string };
    const clean = name?.trim();
    if (!clean) return res.status(400).json({ error: 'City name required' });
    if (!db.cities.some((c) => c.toLowerCase() === clean.toLowerCase())) {
      db.cities.push(clean);
      saveDatabase(db);
    }
    res.json(db);
  });

  app.patch('/api/cities', (req, res) => {
    const { oldName, newName } = req.body as { oldName: string; newName: string };
    const clean = newName?.trim();
    if (!oldName || !clean) return res.status(400).json({ error: 'Old and new city names required' });
    db.cities = db.cities.map((c) => (c === oldName ? clean : c));
    db.venues.forEach((v) => {
      if (v.city === oldName) v.city = clean;
    });
    db.leagues.forEach((l) => {
      if (l.city === oldName) {
        l.city = clean;
        const ven = db.venues.find((v) => v.id === l.venueId);
        if (ven) l.locationName = `${clean} · ${ven.name}`;
      }
    });
    saveDatabase(db);
    res.json(db);
  });

  app.delete('/api/cities/:name', (req, res) => {
    const target = decodeURIComponent(req.params.name);
    db.cities = db.cities.filter((c) => c !== target);
    saveDatabase(db);
    res.json(db);
  });

  // Venues
  app.post('/api/venues', (req, res) => {
    const { id, city, name, address, neighborhood, indoorOutdoor, surface, fields, mapsUrl } =
      req.body as Partial<Venue>;
    if (!name || !address) {
      return res.status(400).json({ error: 'Venue name and address are required' });
    }
    const cleanCity = city?.trim() || db.cities[0] || 'Toronto';
    if (!db.cities.some((c) => c.toLowerCase() === cleanCity.toLowerCase())) {
      db.cities.push(cleanCity);
    }
    if (id) {
      const existing = db.venues.find((v) => v.id === id);
      if (existing) {
        Object.assign(existing, {
          city: cleanCity,
          name,
          address,
          neighborhood: neighborhood || existing.neighborhood,
          indoorOutdoor: indoorOutdoor || existing.indoorOutdoor || 'Outdoor Turf',
          surface: surface || existing.surface,
          fields: fields && fields.length > 0 ? fields : existing.fields,
          mapsUrl: mapsUrl || existing.mapsUrl,
        });
        saveDatabase(db);
        return res.json(db);
      }
    }
    db.venues.push({
      id: uid('ven'),
      city: cleanCity,
      name,
      address,
      neighborhood: neighborhood || cleanCity,
      indoorOutdoor: indoorOutdoor || 'Outdoor Turf',
      surface: surface || 'Synthetic Turf',
      fields: fields && fields.length > 0 ? fields : ['Turf 1'],
      mapsUrl: mapsUrl || `https://maps.google.com/?q=${encodeURIComponent(address)}`,
    });
    saveDatabase(db);
    res.json(db);
  });

  app.patch('/api/venues/:id', (req, res) => {
    const venue = db.venues.find((v) => v.id === req.params.id);
    if (!venue) return res.status(404).json({ error: 'Venue not found' });
    const body = req.body as Partial<Venue>;
    if (body.city && !db.cities.some((c) => c.toLowerCase() === body.city!.trim().toLowerCase())) {
      db.cities.push(body.city.trim());
    }
    Object.assign(venue, body);
    if (body.address && !body.mapsUrl) {
      venue.mapsUrl = `https://maps.google.com/?q=${encodeURIComponent(body.address)}`;
    }
    db.leagues.forEach((l) => {
      if (l.venueId === venue.id) {
        l.city = venue.city;
        l.locationName = `${venue.city} · ${venue.name}`;
      }
    });
    saveDatabase(db);
    res.json(db);
  });

  app.delete('/api/venues/:id', (req, res) => {
    db.venues = db.venues.filter((v) => v.id !== req.params.id);
    saveDatabase(db);
    res.json(db);
  });

  // Create League or Monthly Tournament (Requires manual venue name typing — no pre-loaded defaults)
  app.post('/api/leagues', (req, res) => {
    const body = req.body as Partial<League> & {
      venueName?: string;
      venueAddress?: string;
      indoorOutdoor?: Venue['indoorOutdoor'];
      venueFields?: string[];
    };
    if (!body.name?.trim()) {
      return res.status(400).json({ error: 'League title is required' });
    }
    const existingVenue = body.venueId ? db.venues.find((v) => v.id === body.venueId) : undefined;
    const typedVenueName = (body.venueName || existingVenue?.name || '').trim();
    if (!typedVenueName) {
      return res.status(400).json({ error: 'Venue / field name must be typed manually' });
    }
    const cityName = (body.city || existingVenue?.city || '').trim() || 'Custom City';
    if (!db.cities.some((c) => c.toLowerCase() === cityName.toLowerCase())) {
      db.cities.push(cityName);
    }

    let venue = existingVenue || db.venues.find(
      (v) => v.name.toLowerCase() === typedVenueName.toLowerCase() && v.city.toLowerCase() === cityName.toLowerCase()
    );
    if (!venue) {
      const cleanAddress = (body.venueAddress || `${typedVenueName}, ${cityName}`).trim();
      const fields =
        Array.isArray(body.venueFields) && body.venueFields.length > 0
          ? body.venueFields
          : ['Turf 1', 'Turf 2'];
      venue = {
        id: uid('ven'),
        city: cityName,
        name: typedVenueName,
        address: cleanAddress,
        neighborhood: cityName,
        indoorOutdoor: body.indoorOutdoor || 'Outdoor Turf',
        surface: 'Synthetic Turf',
        fields,
        mapsUrl: `https://maps.google.com/?q=${encodeURIComponent(cleanAddress)}`,
      };
      db.venues.push(venue);
    }

    const gameWeeks = Math.max(1, Number(body.gameWeeks) || 15);
    const gamesPerWeek = body.gamesPerWeek === 2 ? 2 : 1;
    const entryFeeTeam =
      body.entryFeeTeam !== undefined && Number(body.entryFeeTeam) >= 0
        ? Number(body.entryFeeTeam)
        : 2500;
    const entryFeeSolo =
      body.entryFeeSolo !== undefined && Number(body.entryFeeSolo) >= 0
        ? Number(body.entryFeeSolo)
        : 250;

    const newLeague: League = {
      id: uid('lg'),
      name: body.name.trim(),
      city: cityName,
      description: body.description || '',
      rulesSummary: body.rulesSummary || '',
      leagueType: body.leagueType || 'League',
      status: body.status || 'TESTING',
      venueId: venue.id,
      locationName: `${cityName} · ${venue.name}`,
      dayOfWeek: body.dayOfWeek || 'Sunday',
      format: body.format || '7v7',
      division: 'Co-Ed',
      skillLevel: body.skillLevel || 'Competitive',
      entryFeeTeam,
      entryFeeSolo,
      maxTeams: Number(body.maxTeams) || 10,
      rosterMaxCap: Math.max(5, Number(body.rosterMaxCap) || 11),
      coedMaleCap: Number(body.coedMaleCap ?? 7),
      coedFemaleCap: Number(body.coedFemaleCap ?? 4),
      autoFlipEnabled: body.autoFlipEnabled ?? true,
      deadlineHoursRemaining: Number(body.deadlineHoursRemaining ?? 72),
      gameWeeks,
      gamesPerWeek,
      currentWeek: 1,
      totalWeeks: gameWeeks,
      transferDeadlineWeek: Number(body.transferDeadlineWeek) || Math.max(1, Math.floor(gameWeeks * 0.7)),
      gameDurationMins: Number(body.gameDurationMins) || 55,
      playoffMinGames: Number(body.playoffMinGames) || 2,
      rosterLocked: Boolean(body.rosterLocked),
      isPlayoffsActive: false,
      requireAdminTransferSignOff: Boolean(body.requireAdminTransferSignOff),
      customPrizeText: body.customPrizeText || 'Cash Prize ($500 – $1,000+)',
      dynamicPrizeScaling: Boolean(body.dynamicPrizeScaling),
      prizeTiers: body.prizeTiers || [],
      imageUrl: body.imageUrl || '/src/assets/images/league_turf_downtown_1795345163078.jpg',
      startDate: body.startDate || 'Kickoff Date TBD',
      matchTimeWindow: body.matchTimeWindow || '3:00 PM – 9:00 PM',
    };
    db.leagues.push(newLeague);
    if (
      newLeague.division === 'Co-Ed' &&
      !db.championsCup.linkedLeagueIds.includes(newLeague.id)
    ) {
      db.championsCup.linkedLeagueIds.push(newLeague.id);
    }
    saveDatabase(db);
    res.json(db);
  });

  app.patch('/api/leagues/:id', (req, res) => {
    const league = db.leagues.find((l) => l.id === req.params.id);
    if (!league) return res.status(404).json({ error: 'League not found' });
    const body = req.body as Partial<League> & {
      venueName?: string;
      venueAddress?: string;
      indoorOutdoor?: Venue['indoorOutdoor'];
      venueFields?: string[];
      entryFeeDeposit?: number;
    };
    const {
      venueName,
      venueAddress,
      indoorOutdoor,
      venueFields,
      entryFeeDeposit: _ignoredDeposit,
      ...leagueFields
    } = body;
    void _ignoredDeposit;
    Object.assign(league, leagueFields, { division: 'Co-Ed' });

    if (body.city && !db.cities.some((c) => c.toLowerCase() === body.city!.trim().toLowerCase())) {
      db.cities.push(body.city.trim());
    }

    let ven = db.venues.find((v) => v.id === league.venueId);
    const targetCity = (league.city || ven?.city || 'Custom City').trim();

    if (venueName && venueName.trim()) {
      const cleanVenue = venueName.trim();
      if (!ven) {
        ven = {
          id: uid('ven'),
          city: targetCity,
          name: cleanVenue,
          address: venueAddress?.trim() || `${cleanVenue}, ${targetCity}`,
          neighborhood: targetCity,
          indoorOutdoor: indoorOutdoor || 'Outdoor Turf',
          surface: 'Synthetic Turf',
          fields: venueFields && venueFields.length > 0 ? venueFields : ['Turf 1', 'Turf 2'],
          mapsUrl: `https://maps.google.com/?q=${encodeURIComponent(venueAddress?.trim() || `${cleanVenue}, ${targetCity}`)}`,
        };
        db.venues.push(ven);
        league.venueId = ven.id;
      } else {
        ven.name = cleanVenue;
        ven.city = targetCity;
      }
    } else if (body.venueId) {
      const targetVen = db.venues.find((v) => v.id === body.venueId);
      if (targetVen) {
        ven = targetVen;
        league.city = body.city || targetVen.city;
      }
    }

    if (ven) {
      if (venueAddress?.trim()) {
        ven.address = venueAddress.trim();
        ven.mapsUrl = `https://maps.google.com/?q=${encodeURIComponent(ven.address)}`;
      }
      if (indoorOutdoor) ven.indoorOutdoor = indoorOutdoor;
      if (Array.isArray(venueFields) && venueFields.length > 0) ven.fields = venueFields;
      ven.city = targetCity;
      league.locationName = `${targetCity} · ${ven.name}`;
    } else if (body.city) {
      league.locationName = `${body.city} · ${league.locationName.split('·').pop()?.trim() || 'Turf'}`;
    }

    if (body.gameWeeks !== undefined) {
      league.totalWeeks = Number(body.gameWeeks);
    }
    if (body.rosterMaxCap) {
      db.teams.forEach((t) => {
        if (t.leagueId === league.id) t.rosterLimit = Number(body.rosterMaxCap);
      });
    }
    if (league.division === 'Co-Ed' && !db.championsCup.linkedLeagueIds.includes(league.id)) {
      db.championsCup.linkedLeagueIds.push(league.id);
    }
    saveDatabase(db);
    res.json(db);
  });

  app.delete('/api/leagues/:id', (req, res) => {
    const lid = req.params.id;
    db.leagues = db.leagues.filter((l) => l.id !== lid);
    db.teams = db.teams.filter((t) => t.leagueId !== lid);
    db.players = db.players.filter((p) => p.leagueId !== lid);
    db.matches = db.matches.filter((m) => m.leagueId !== lid);
    db.championsCup.linkedLeagueIds = db.championsCup.linkedLeagueIds.filter((id) => id !== lid);
    saveDatabase(db);
    res.json(db);
  });

  app.patch('/api/matches/:id', (req, res) => {
    const match = db.matches.find((m) => m.id === req.params.id);
    if (!match) return res.status(404).json({ error: 'Match not found' });
    Object.assign(match, req.body);
    saveDatabase(db);
    res.json(db);
  });

  app.patch('/api/teams/:id', (req, res) => {
    const team = db.teams.find((t) => t.id === req.params.id);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    Object.assign(team, req.body);
    saveDatabase(db);
    res.json(db);
  });

  // 1-Click Duplicate League
  app.post('/api/leagues/:id/duplicate', (req, res) => {
    const src = db.leagues.find((l) => l.id === req.params.id);
    if (!src) return res.status(404).json({ error: 'League not found' });
    const clone: League = {
      ...src,
      id: uid('lg'),
      name: `${src.name} (Copy)`,
      status: 'TESTING',
      currentWeek: 1,
      isPlayoffsActive: false,
      rosterLocked: false,
      startDate: 'Kickoff Date TBD',
      prizeTiers: src.prizeTiers.map((pt) => ({ ...pt })),
    };
    db.leagues.push(clone);
    if (clone.division === 'Co-Ed' && !db.championsCup.linkedLeagueIds.includes(clone.id)) {
      db.championsCup.linkedLeagueIds.push(clone.id);
    }
    saveDatabase(db);
    res.json(db);
  });

  // Generate Schedule (Randomized Field Assignment Per Game + 25m / 5m / 25m Match Clock)
  app.post('/api/leagues/:id/generate-schedule', (req, res) => {
    const league = db.leagues.find((l) => l.id === req.params.id);
    if (!league) return res.status(404).json({ error: 'League not found' });
    const leagueTeams = db.teams.filter((t) => t.leagueId === league.id);
    if (leagueTeams.length < 2) {
      return res.status(400).json({ error: 'Need at least 2 teams to generate a schedule' });
    }
    const venue = db.venues.find((v) => v.id === league.venueId) || db.venues[0];
    const fieldPool = venue?.fields?.length ? venue.fields : ['Turf 1'];
    const existingWeeks = db.matches
      .filter((m) => m.leagueId === league.id && m.stage === 'Regular')
      .map((m) => m.week);
    const nextWeek = (existingWeeks.length > 0 ? Math.max(...existingWeeks) : 0) + 1;

    const parseWindowStartMins = (win?: string): number => {
      const m = (win || '').match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
      if (!m) return 15 * 60; // Default 3:00 PM
      let h = Number(m[1]);
      const min = Number(m[2]);
      const mer = m[3]?.toUpperCase();
      if (mer === 'PM' && h < 12) h += 12;
      if (mer === 'AM' && h === 12) h = 0;
      return h * 60 + min;
    };

    const formatTime12 = (mins: number): string => {
      const dayMins = ((mins % (24 * 60)) + 24 * 60) % (24 * 60);
      const h24 = Math.floor(dayMins / 60);
      const mm = String(dayMins % 60).padStart(2, '0');
      const period = h24 >= 12 ? 'PM' : 'AM';
      const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
      return `${h12}:${mm} ${period}`;
    };

    const firstHalfMins = 25;
    const halftimeMins = 5;
    const secondHalfMins = 25;
    const totalMatchMins = firstHalfMins + halftimeMins + secondHalfMins; // 55 mins
    const baseStartMins = parseWindowStartMins(league.matchTimeWindow);
    const fieldSlotCounter: Record<string, number> = {};

    const dateStr =
      league.status === 'TESTING'
        ? 'Kickoff Date TBD'
        : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    for (let i = 0; i + 1 < leagueTeams.length; i += 2) {
      const home = leagueTeams[i];
      const away = leagueTeams[i + 1];
      // Randomly pick a field from this venue's available fields for each game
      const chosenField = fieldPool[Math.floor(Math.random() * fieldPool.length)] || 'Turf 1';
      const slotIdx = fieldSlotCounter[chosenField] ?? 0;
      fieldSlotCounter[chosenField] = slotIdx + 1;

      // Space games on the same field by 60 mins (55m game + 5m transition)
      const kickoffMins = baseStartMins + slotIdx * 60;
      const endMins = kickoffMins + totalMatchMins;

      db.matches.push({
        id: uid('m'),
        leagueId: league.id,
        week: nextWeek,
        stage: league.leagueType === 'Tournament' ? 'Group' : 'Regular',
        homeTeamId: home.id,
        awayTeamId: away.id,
        homeTeamName: home.name,
        awayTeamName: away.name,
        fieldNumber: chosenField,
        scheduledDate: dateStr,
        scheduledTime: formatTime12(kickoffMins),
        firstHalfMins,
        halftimeMins,
        secondHalfMins,
        endTime: formatTime12(endMins),
        status: 'Scheduled',
        homeScore: null,
        awayScore: null,
        events: [],
        loanAppearancePlayerIds: [],
      });
    }
    saveDatabase(db);
    res.json(db);
  });

  // Early-Bird Waitlist
  app.post('/api/waitlist', (req, res) => {
    const { leagueId, name, email, entryType } = req.body as {
      leagueId: string;
      name: string;
      email: string;
      entryType: 'Team Captain' | 'Solo Player';
    };
    if (!name || !email) return res.status(400).json({ error: 'Name and email required' });
    db.waitlist.unshift({
      id: uid('wl'),
      leagueId,
      name,
      email,
      entryType: entryType || 'Solo Player',
      createdAt: new Date().toISOString(),
    });
    saveDatabase(db);
    res.json(db);
  });

  // Registration (with Promo Code support)
  app.post('/api/register/team', (req, res) => {
    const {
      leagueId,
      teamName,
      captainName,
      captainEmail,
      position,
      gender,
      kitColor,
      paymentMode,
      splitTargetPlayers,
      promoCode,
      waiverSigned,
      waiverSignatureName,
      paymentProcessed,
    } = req.body as {
      leagueId: string;
      teamName: string;
      captainName: string;
      captainEmail: string;
      position: Player['position'];
      gender?: Player['gender'];
      kitColor: string;
      paymentMode: 'full' | 'split';
      splitTargetPlayers: number;
      promoCode?: string;
      waiverSigned: boolean;
      waiverSignatureName: string;
      paymentProcessed?: boolean;
    };

    const league = db.leagues.find((l) => l.id === leagueId);
    if (!league) return res.status(404).json({ error: 'League not found' });
    if (!teamName?.trim() || !captainName?.trim() || !captainEmail?.trim() || !captainEmail.includes('@')) {
      return res.status(400).json({ error: 'All required team & captain registration details are required.' });
    }
    const divCheck = checkDivisionGenderEligibility(league.division, gender || 'Male');
    if (!divCheck.allowed) {
      return res.status(400).json({ error: divCheck.reason });
    }
    if (!waiverSigned || !waiverSignatureName?.trim()) {
      return res.status(400).json({ error: 'Digital liability waiver signature is required' });
    }
    const existingCount = db.teams.filter((t) => t.leagueId === leagueId).length;
    if (existingCount >= league.maxTeams) {
      return res.status(400).json({ error: 'League has reached maximum team capacity' });
    }

    let discount = 0;
    if (promoCode?.trim()) {
      const promo = db.promoCodes.find(
        (p) => p.active && p.code.toLowerCase() === promoCode.trim().toLowerCase()
      );
      if (promo) {
        discount = promo.discountAmount;
        promo.uses += 1;
      }
    }

    const normalizedMode: 'full' | 'split' = paymentMode === 'full' ? 'full' : 'split';
    const totalFee = Math.max(0, league.entryFeeTeam - discount);
    const teamId = uid('tm');
    const captainId = uid('pl');
    const targetPlayers = Math.max(2, Number(splitTargetPlayers) || 10);
    const splitShare = Math.round((totalFee / targetPlayers) * 100) / 100;
    const isPaymentDone = totalFee === 0 || paymentProcessed === true;
    const amountPaid = isPaymentDone ? (normalizedMode === 'full' ? totalFee : splitShare) : 0;
    const nowIso = new Date().toISOString();
    const teamComplete = isPaymentDone && amountPaid >= totalFee;

    const splitPayCode =
      teamName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 4) +
      Math.floor(10 + Math.random() * 89);

    const newTeam: Team = {
      id: teamId,
      leagueId,
      name: teamName.trim(),
      tag: teamName.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'PFC',
      captainId,
      captainName: captainName.trim(),
      kitColor: kitColor || '#10B981',
      kitColorName: 'Custom',
      awayKitColor: '#FFFFFF',
      awayKitColorName: 'Away White',
      badgeStyle: 'Shield',
      bio: `${teamName.trim()} — Competing in ${league.name}`,
      rosterLimit: league.rosterMaxCap || 11,
      standbyWaitlist: [],
      splitPayCode,
      splitTargetPlayers: targetPlayers,
      totalFee,
      amountPaid,
      paymentMode: normalizedMode,
      registrationStatus: teamComplete ? 'Complete' : 'Pending Payment',
      registrationCompletedAt: teamComplete ? nowIso : undefined,
    };

    const newCaptain: Player = {
      id: captainId,
      name: captainName.trim(),
      email: captainEmail.trim(),
      teamId,
      leagueId,
      position: position || 'MID',
      gender: gender || 'Male',
      jerseyNumber: 10,
      skillRating: league.skillLevel,
      isCaptain: true,
      gamesPlayed: 0,
      goals: 0,
      assists: 0,
      cleanSheets: 0,
      wins: 0,
      yellowCards: 0,
      redCards: 0,
      suspendedNextMatch: false,
      motmAwards: 0,
      joinedTeamAt: nowIso,
      lastMarketActionAt: nowIso,
      marketListing: null,
      loansUsedThisSeason: 0,
      activeLoanId: null,
      waiverSigned: true,
      waiverSignedAt: nowIso,
      waiverSignatureName: waiverSignatureName.trim(),
      registrationPaidAmount: amountPaid,
      registrationStatus: isPaymentDone ? 'Complete' : 'Pending Payment',
      registrationCompletedAt: isPaymentDone ? nowIso : undefined,
    };

    db.teams.push(newTeam);
    db.players.push(newCaptain);
    saveDatabase(db);
    res.json({ db, team: newTeam, captain: newCaptain, discountApplied: discount });
  });

  app.post('/api/register/split-join', (req, res) => {
    const {
      splitPayCode,
      playerName,
      playerEmail,
      position,
      gender,
      waiverSigned,
      waiverSignatureName,
      paymentProcessed,
    } = req.body as {
      splitPayCode: string;
      playerName: string;
      playerEmail: string;
      position: Player['position'];
      gender?: 'Male' | 'Female';
      waiverSigned: boolean;
      waiverSignatureName: string;
      paymentProcessed?: boolean;
    };

    const team = db.teams.find(
      (t) => t.splitPayCode.toLowerCase() === splitPayCode.trim().toLowerCase()
    );
    if (!team) return res.status(404).json({ error: 'Split-pay team code not found' });
    const league = db.leagues.find((l) => l.id === team.leagueId);
    if (!league) return res.status(404).json({ error: 'League not found' });
    if (!playerName?.trim() || !playerEmail?.trim() || !playerEmail.includes('@')) {
      return res.status(400).json({ error: 'Player full name and valid email are required.' });
    }
    if (!waiverSigned || !waiverSignatureName?.trim()) {
      return res.status(400).json({ error: 'Digital liability waiver signature is required' });
    }

    const incomingGender: 'Male' | 'Female' = gender === 'Female' ? 'Female' : 'Male';
    const rosterPlayers = db.players.filter((p) => p.teamId === team.id);
    const evalRes = evaluateTeamRosterAddition(team, league, rosterPlayers, incomingGender);
    if (!evalRes.allowed) {
      return res.status(400).json({ error: evalRes.reason, standbyRecommended: evalRes.standbyRecommended });
    }
    if (evalRes.shouldAutoFlipTo4M7F) {
      team.customMaleCap = 4;
      team.customFemaleCap = 7;
      team.autoFlippedCoEd = true;
    }

    const isPaidInFull = team.amountPaid >= team.totalFee;
    const rawShare = Math.round((team.totalFee / Math.max(1, team.splitTargetPlayers)) * 100) / 100;
    const expectedShare = isPaidInFull ? 0 : Math.min(Math.max(0, team.totalFee - team.amountPaid), rawShare);
    const isPaymentDone = isPaidInFull || expectedShare === 0 || paymentProcessed === true;
    const splitShare = isPaymentDone ? expectedShare : 0;
    team.amountPaid = Math.min(team.totalFee, Math.round((team.amountPaid + splitShare) * 100) / 100);

    const nowIso = new Date().toISOString();
    if (team.amountPaid >= team.totalFee) {
      team.registrationStatus = 'Complete';
      team.registrationCompletedAt = team.registrationCompletedAt || nowIso;
    } else {
      team.registrationStatus = 'Pending Payment';
    }

    const newPlayer: Player = {
      id: uid('pl'),
      name: playerName.trim(),
      email: playerEmail.trim(),
      teamId: team.id,
      leagueId: team.leagueId,
      position: position || 'MID',
      gender: incomingGender,
      jerseyNumber: rosterPlayers.length + 2,
      skillRating: league.skillLevel,
      isCaptain: false,
      gamesPlayed: 0,
      goals: 0,
      assists: 0,
      cleanSheets: 0,
      wins: 0,
      yellowCards: 0,
      redCards: 0,
      suspendedNextMatch: false,
      motmAwards: 0,
      joinedTeamAt: nowIso,
      lastMarketActionAt: nowIso,
      marketListing: null,
      loansUsedThisSeason: 0,
      activeLoanId: null,
      waiverSigned: true,
      waiverSignedAt: nowIso,
      waiverSignatureName: waiverSignatureName.trim(),
      registrationPaidAmount: splitShare,
      registrationStatus: isPaymentDone ? 'Complete' : 'Pending Payment',
      registrationCompletedAt: isPaymentDone ? nowIso : undefined,
    };
    db.players.push(newPlayer);
    saveDatabase(db);
    res.json({
      db,
      team,
      player: newPlayer,
      paidShare: splitShare,
      autoFlippedCoEd: evalRes.shouldAutoFlipTo4M7F,
    });
  });

  app.post('/api/register/solo', (req, res) => {
    const {
      leagueId,
      playerName,
      playerEmail,
      position,
      gender,
      availableToSub,
      waiverSigned,
      waiverSignatureName,
      paymentProcessed,
      inviteFriend,
      friendName,
      friendEmail,
      friendGender,
      friendPosition,
    } = req.body as {
      leagueId: string;
      playerName: string;
      playerEmail: string;
      position: Player['position'];
      gender?: 'Male' | 'Female';
      availableToSub?: boolean;
      waiverSigned: boolean;
      waiverSignatureName: string;
      paymentProcessed?: boolean;
      inviteFriend?: boolean;
      friendName?: string;
      friendEmail?: string;
      friendGender?: 'Male' | 'Female';
      friendPosition?: Player['position'];
    };

    const league = db.leagues.find((l) => l.id === leagueId);
    if (!league) return res.status(404).json({ error: 'League not found' });
    if (!playerName?.trim() || !playerEmail?.trim() || !playerEmail.includes('@')) {
      return res.status(400).json({ error: 'Player full name and valid email are required.' });
    }
    const incomingGender: 'Male' | 'Female' = gender === 'Female' ? 'Female' : 'Male';
    const divCheck = checkDivisionGenderEligibility(league.division, incomingGender);
    if (!divCheck.allowed) {
      return res.status(400).json({ error: divCheck.reason });
    }
    if (!waiverSigned || !waiverSignatureName?.trim()) {
      return res.status(400).json({ error: 'Digital liability waiver signature is required' });
    }
    if (inviteFriend && !friendName?.trim()) {
      return res.status(400).json({ error: 'Friend full name is required when inviting a friend.' });
    }

    const isPaymentDone = league.entryFeeSolo === 0 || paymentProcessed === true;
    const paidAmount = isPaymentDone ? league.entryFeeSolo : 0;

    let houseTeam = db.teams.find((t) => {
      if (t.leagueId !== leagueId) return false;
      const squad = db.players.filter((p) => p.teamId === t.id);
      const ev = evaluateTeamRosterAddition(t, league, squad, incomingGender);
      return ev.allowed && (t.name.toLowerCase().includes('house') || squad.length < (league.rosterMaxCap || 11));
    });

    const nowIso = new Date().toISOString();
    if (!houseTeam) {
      const tid = uid('tm');
      houseTeam = {
        id: tid,
        leagueId,
        name: 'House Free Agents FC',
        tag: 'HFA',
        captainId: '',
        captainName: playerName.trim(),
        kitColor: '#10B981',
        kitColorName: 'Emerald',
        awayKitColor: '#FFFFFF',
        awayKitColorName: 'Away White',
        badgeStyle: 'Circle',
        bio: 'Solo Free Agent House Squad',
        rosterLimit: league.rosterMaxCap || 11,
        standbyWaitlist: [],
        splitPayCode: 'HOUSE' + Math.floor(10 + Math.random() * 89),
        splitTargetPlayers: 10,
        totalFee: league.entryFeeTeam,
        amountPaid: paidAmount,
        paymentMode: 'split',
        registrationStatus: paidAmount >= league.entryFeeTeam ? 'Complete' : 'Pending Payment',
        registrationCompletedAt: paidAmount >= league.entryFeeTeam ? nowIso : undefined,
      };
      db.teams.push(houseTeam);
    } else {
      const squad = db.players.filter((p) => p.teamId === houseTeam!.id);
      const ev = evaluateTeamRosterAddition(houseTeam, league, squad, incomingGender);
      if (ev.shouldAutoFlipTo4M7F) {
        houseTeam.customMaleCap = 4;
        houseTeam.customFemaleCap = 7;
        houseTeam.autoFlippedCoEd = true;
      }
      houseTeam.amountPaid = Math.min(houseTeam.totalFee, houseTeam.amountPaid + paidAmount);
      if (houseTeam.amountPaid >= houseTeam.totalFee) {
        houseTeam.registrationStatus = 'Complete';
        houseTeam.registrationCompletedAt = houseTeam.registrationCompletedAt || nowIso;
      }
    }

    const pid = uid('pl');
    if (!houseTeam.captainId) houseTeam.captainId = pid;

    const newPlayer: Player = {
      id: pid,
      name: playerName.trim(),
      email: playerEmail.trim(),
      teamId: houseTeam.id,
      leagueId,
      position: position || 'MID',
      gender: incomingGender,
      jerseyNumber: db.players.filter((p) => p.teamId === houseTeam!.id).length + 3,
      skillRating: league.skillLevel,
      isCaptain: houseTeam.captainId === pid,
      isFreeAgent: true,
      gamesPlayed: 0,
      goals: 0,
      assists: 0,
      cleanSheets: 0,
      wins: 0,
      yellowCards: 0,
      redCards: 0,
      suspendedNextMatch: false,
      motmAwards: 0,
      availableToSub: availableToSub ?? true,
      joinedTeamAt: nowIso,
      lastMarketActionAt: nowIso,
      marketListing: null,
      loansUsedThisSeason: 0,
      activeLoanId: null,
      waiverSigned: true,
      waiverSignedAt: nowIso,
      waiverSignatureName: waiverSignatureName.trim(),
      registrationPaidAmount: paidAmount,
      registrationStatus: isPaymentDone ? 'Complete' : 'Pending Payment',
      registrationCompletedAt: isPaymentDone ? nowIso : undefined,
    };
    db.players.push(newPlayer);
    db.doneDeals.unshift({
      id: uid('dd'),
      leagueId,
      kind: 'free_agent',
      summary: `${playerName.trim()} placed onto ${houseTeam.name}`,
      details: isPaymentDone
        ? `Free Agent (${position} · ${incomingGender}) · $${paidAmount} paid — Complete`
        : `Free Agent (${position} · ${incomingGender}) · Pending Payment ($${league.entryFeeSolo} due)`,
      timestamp: nowIso,
    });

    let createdFriendInvite: FreeAgentFriendInvite | undefined;
    if (inviteFriend && friendName?.trim()) {
      createdFriendInvite = {
        id: uid('fainv'),
        leagueId,
        leagueName: league.name,
        inviterPlayerId: newPlayer.id,
        inviterName: newPlayer.name,
        inviterTeamId: houseTeam.id,
        friendName: friendName.trim(),
        friendEmail: friendEmail?.trim() || undefined,
        friendGender: friendGender === 'Female' ? 'Female' : 'Male',
        friendPosition: friendPosition || 'MID',
        selfFee: league.entryFeeSolo,
        friendFee: league.entryFeeSolo,
        totalIfAccepted: league.entryFeeSolo * 2,
        status: 'Pending',
        createdAt: nowIso,
      };
      db.freeAgentInvites.unshift(createdFriendInvite);
    }

    saveDatabase(db);
    res.json({ db, team: houseTeam, player: newPlayer, friendInvite: createdFriendInvite });
  });

  // Free Agent Friend Invites (Pay for Both: $250 self + $250 friend = $500 total when friend accepts)
  app.post('/api/free-agents/:playerId/invite-friend', (req, res) => {
    const inviter = db.players.find((p) => p.id === req.params.playerId);
    if (!inviter) return res.status(404).json({ error: 'Free agent player not found' });
    const league = db.leagues.find((l) => l.id === inviter.leagueId);
    if (!league) return res.status(404).json({ error: 'League not found' });

    const { friendName, friendEmail, friendGender, friendPosition } = req.body as {
      friendName: string;
      friendEmail?: string;
      friendGender?: 'Male' | 'Female';
      friendPosition?: Player['position'];
    };
    if (!friendName?.trim()) {
      return res.status(400).json({ error: 'Friend name is required' });
    }

    const selfPaid = inviter.registrationPaidAmount ?? league.entryFeeSolo;
    const friendFee = league.entryFeeSolo;
    const invite: FreeAgentFriendInvite = {
      id: uid('fainv'),
      leagueId: league.id,
      leagueName: league.name,
      inviterPlayerId: inviter.id,
      inviterName: inviter.name,
      inviterTeamId: inviter.teamId,
      friendName: friendName.trim(),
      friendEmail: friendEmail?.trim() || undefined,
      friendGender: friendGender === 'Female' ? 'Female' : 'Male',
      friendPosition: friendPosition || 'MID',
      selfFee: league.entryFeeSolo,
      friendFee,
      totalIfAccepted: selfPaid + friendFee,
      status: 'Pending',
      createdAt: new Date().toISOString(),
    };
    db.freeAgentInvites.unshift(invite);
    saveDatabase(db);
    res.json({ db, invite });
  });

  app.post('/api/free-agent-invites/:id/respond', (req, res) => {
    const invite = db.freeAgentInvites.find((i) => i.id === req.params.id);
    if (!invite) return res.status(404).json({ error: 'Friend invite not found' });
    if (invite.status !== 'Pending') return res.status(400).json({ error: 'Friend invite already processed' });

    const { decision } = req.body as { decision: 'Accepted' | 'Declined' };
    if (decision === 'Declined') {
      invite.status = 'Declined';
      saveDatabase(db);
      return res.json({ db, invite });
    }

    const inviter = db.players.find((p) => p.id === invite.inviterPlayerId);
    const league = db.leagues.find((l) => l.id === invite.leagueId);
    if (!inviter || !league) {
      return res.status(404).json({ error: 'Inviting Free Agent or league not found' });
    }

    let targetTeam = db.teams.find((t) => {
      if (t.id !== invite.inviterTeamId) return false;
      const squad = db.players.filter((p) => p.teamId === t.id);
      return evaluateTeamRosterAddition(t, league, squad, invite.friendGender).allowed;
    });

    if (!targetTeam) {
      targetTeam = db.teams.find((t) => {
        if (t.leagueId !== league.id) return false;
        const squad = db.players.filter((p) => p.teamId === t.id);
        const ev = evaluateTeamRosterAddition(t, league, squad, invite.friendGender);
        return ev.allowed && (t.name.toLowerCase().includes('house') || squad.length < (league.rosterMaxCap || 11));
      });
    }

    if (!targetTeam) {
      const tid = uid('tm');
      targetTeam = {
        id: tid,
        leagueId: league.id,
        name: `House Free Agents ${db.teams.filter((t) => t.leagueId === league.id).length + 1}`,
        tag: 'HFA',
        captainId: inviter.id,
        captainName: inviter.name,
        kitColor: '#10B981',
        kitColorName: 'Emerald',
        awayKitColor: '#FFFFFF',
        awayKitColorName: 'Away White',
        badgeStyle: 'Circle',
        bio: 'Free Agent House Squad',
        rosterLimit: league.rosterMaxCap || 11,
        standbyWaitlist: [],
        splitPayCode: 'HOUSE' + Math.floor(10 + Math.random() * 89),
        splitTargetPlayers: 10,
        totalFee: league.entryFeeTeam,
        amountPaid: 0,
        paymentMode: 'split',
      };
      db.teams.push(targetTeam);
    }

    const existingSquad = db.players.filter((p) => p.teamId === targetTeam!.id);
    const evalRes = evaluateTeamRosterAddition(targetTeam, league, existingSquad, invite.friendGender);
    if (!evalRes.allowed) {
      return res.status(400).json({ error: evalRes.reason });
    }
    if (evalRes.shouldAutoFlipTo4M7F) {
      targetTeam.customMaleCap = 4;
      targetTeam.customFemaleCap = 7;
      targetTeam.autoFlippedCoEd = true;
    }

    const nowIso = new Date().toISOString();
    const friendPlayer: Player = {
      id: uid('pl'),
      name: invite.friendName,
      email:
        invite.friendEmail ||
        `${invite.friendName.toLowerCase().replace(/[^a-z]/g, '')}@pitchpot.io`,
      teamId: targetTeam.id,
      leagueId: league.id,
      position: invite.friendPosition,
      gender: invite.friendGender,
      jerseyNumber: existingSquad.length + 4,
      skillRating: league.skillLevel,
      isCaptain: false,
      isFreeAgent: true,
      availableToSub: true,
      gamesPlayed: 0,
      goals: 0,
      assists: 0,
      cleanSheets: 0,
      wins: 0,
      yellowCards: 0,
      redCards: 0,
      suspendedNextMatch: false,
      motmAwards: 0,
      joinedTeamAt: nowIso,
      lastMarketActionAt: nowIso,
      marketListing: null,
      loansUsedThisSeason: 0,
      activeLoanId: null,
      waiverSigned: true,
      waiverSignedAt: nowIso,
      waiverSignatureName: invite.friendName,
      registrationPaidAmount: 0,
      paidByPlayerId: inviter.id,
      registrationStatus: 'Complete',
      registrationCompletedAt: nowIso,
    };

    const wasInviterAlreadyComplete = inviter.registrationStatus === 'Complete';
    const currentInviterPaid = inviter.registrationPaidAmount ?? 0;
    const baseSelf = wasInviterAlreadyComplete
      ? Math.max(invite.selfFee, currentInviterPaid)
      : invite.selfFee;
    const updatedInviterTotal = baseSelf + invite.friendFee;
    inviter.registrationPaidAmount = updatedInviterTotal;
    inviter.registrationStatus = 'Complete';
    inviter.registrationCompletedAt = inviter.registrationCompletedAt || nowIso;
    const teamCredit = wasInviterAlreadyComplete ? invite.friendFee : invite.selfFee + invite.friendFee;
    targetTeam.amountPaid = Math.min(targetTeam.totalFee, targetTeam.amountPaid + teamCredit);
    if (targetTeam.amountPaid >= targetTeam.totalFee) {
      targetTeam.registrationStatus = 'Complete';
      targetTeam.registrationCompletedAt = targetTeam.registrationCompletedAt || nowIso;
    }

    invite.status = 'Accepted';
    invite.acceptedAt = nowIso;
    invite.totalIfAccepted = updatedInviterTotal;

    db.players.push(friendPlayer);
    db.doneDeals.unshift({
      id: uid('dd'),
      leagueId: league.id,
      kind: 'free_agent',
      summary: `${invite.friendName} accepted ${inviter.name}'s Free Agent invite`,
      details: `Pay-for-Both confirmed: ${inviter.name} paid $${invite.selfFee} (self) + $${invite.friendFee} (friend) = $${updatedInviterTotal} total`,
      timestamp: nowIso,
    });

    saveDatabase(db);
    res.json({ db, invite, inviter, friendPlayer });
  });

  // Complete a Pending Payment player registration
  app.post('/api/players/:id/complete-payment', (req, res) => {
    const player = db.players.find((p) => p.id === req.params.id);
    if (!player) return res.status(404).json({ error: 'Player not found' });
    const team = db.teams.find((t) => t.id === player.teamId);
    const league = db.leagues.find((l) => l.id === player.leagueId);
    if (!team || !league) return res.status(404).json({ error: 'Team or league not found' });

    if (!player.name?.trim() || !player.email?.trim() || !player.waiverSigned) {
      return res.status(400).json({ error: 'Required registration info & waiver must be completed before payment.' });
    }

    const { amount } = req.body as { amount?: number };
    const defaultCharge = player.isFreeAgent
      ? league.entryFeeSolo
      : team.paymentMode === 'full' && player.isCaptain
      ? team.totalFee
      : Math.round((team.totalFee / Math.max(1, team.splitTargetPlayers)) * 100) / 100;
    const paidAmount = Math.max(0, amount !== undefined ? Number(amount) : defaultCharge);

    const nowIso = new Date().toISOString();
    player.registrationPaidAmount = (player.registrationPaidAmount ?? 0) + paidAmount;
    player.registrationStatus = 'Complete';
    player.registrationCompletedAt = nowIso;

    team.amountPaid = Math.min(team.totalFee, Math.round((team.amountPaid + paidAmount) * 100) / 100);
    if (team.amountPaid >= team.totalFee) {
      team.registrationStatus = 'Complete';
      team.registrationCompletedAt = team.registrationCompletedAt || nowIso;
    }

    saveDatabase(db);
    res.json({ db, player, team });
  });

  // Captain Team Studio ("Make It Yours" + Co-Ed Split + Lineup Board + Jersey #)
  app.patch('/api/teams/:id/studio', (req, res) => {
    const team = db.teams.find((t) => t.id === req.params.id);
    if (!team) return res.status(404).json({ error: 'Team not found' });

    const {
      name,
      tag,
      kitColor,
      kitColorName,
      awayKitColor,
      awayKitColorName,
      badgeStyle,
      badgeUrl,
      bio,
      viceCaptainId,
      jerseyNumbers,
      customMaleCap,
      customFemaleCap,
      autoFlippedCoEd,
      lineupPositions,
      splitTargetPlayers,
    } = req.body as Partial<Team> & { jerseyNumbers?: Record<string, number> };

    if (name !== undefined && name.trim()) team.name = name.trim();
    if (tag !== undefined) team.tag = tag.trim().toUpperCase().slice(0, 4);
    if (kitColor !== undefined) team.kitColor = kitColor;
    if (kitColorName !== undefined) team.kitColorName = kitColorName;
    if (awayKitColor !== undefined) team.awayKitColor = awayKitColor;
    if (awayKitColorName !== undefined) team.awayKitColorName = awayKitColorName;
    if (badgeStyle !== undefined) team.badgeStyle = badgeStyle;
    if (badgeUrl !== undefined) team.badgeUrl = badgeUrl;
    if (bio !== undefined) team.bio = bio;
    if (lineupPositions !== undefined) team.lineupPositions = lineupPositions;
    if (customMaleCap !== undefined) team.customMaleCap = Number(customMaleCap);
    if (customFemaleCap !== undefined) team.customFemaleCap = Number(customFemaleCap);
    if (autoFlippedCoEd !== undefined) team.autoFlippedCoEd = Boolean(autoFlippedCoEd);
    if (splitTargetPlayers !== undefined) {
      team.splitTargetPlayers = Math.max(2, Math.min(22, Number(splitTargetPlayers) || 10));
    }

    if (viceCaptainId !== undefined) {
      team.viceCaptainId = viceCaptainId;
      db.players.forEach((p) => {
        if (p.teamId === team.id) {
          p.isViceCaptain = p.id === viceCaptainId;
        }
      });
    }

    if (jerseyNumbers) {
      for (const [pid, num] of Object.entries(jerseyNumbers)) {
        const pl = db.players.find((p) => p.id === pid && p.teamId === team.id);
        if (pl) pl.jerseyNumber = Math.max(0, Math.min(99, Number(num) || 0));
      }
    }

    saveDatabase(db);
    res.json(db);
  });

  // Team Standby Waitlist & Drop Auto-Promote
  app.post('/api/teams/:id/waitlist', (req, res) => {
    const team = db.teams.find((t) => t.id === req.params.id);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    const { name, email, gender, position } = req.body as {
      name: string;
      email: string;
      gender: 'Male' | 'Female';
      position: Player['position'];
    };
    if (!name?.trim() || !email?.trim()) {
      return res.status(400).json({ error: 'Name and email required for Team Standby Waitlist' });
    }
    team.standbyWaitlist = team.standbyWaitlist || [];
    team.standbyWaitlist.push({
      id: uid('sb'),
      name: name.trim(),
      email: email.trim(),
      gender: gender === 'Female' ? 'Female' : 'Male',
      position: position || 'MID',
      createdAt: new Date().toISOString(),
    });
    saveDatabase(db);
    res.json(db);
  });

  app.delete('/api/teams/:id/roster/:playerId', (req, res) => {
    const team = db.teams.find((t) => t.id === req.params.id);
    const league = db.leagues.find((l) => l.id === team?.leagueId);
    if (!team || !league) return res.status(404).json({ error: 'Team or league not found' });
    const target = db.players.find((p) => p.id === req.params.playerId && p.teamId === team.id);
    if (!target) return res.status(404).json({ error: 'Player not found on roster' });
    if (target.isCaptain) {
      return res.status(400).json({ error: 'Cannot drop the primary Team Captain.' });
    }

    db.players = db.players.filter((p) => p.id !== target.id);

    // Check standby waitlist for first eligible replacement
    let promotedName: string | null = null;
    const waitlist = team.standbyWaitlist || [];
    const currentRoster = db.players.filter((p) => p.teamId === team.id);
    const promoIdx = waitlist.findIndex(
      (w) => evaluateTeamRosterAddition(team, league, currentRoster, w.gender).allowed
    );
    if (promoIdx >= 0) {
      const [promoted] = waitlist.splice(promoIdx, 1);
      const nowIso = new Date().toISOString();
      db.players.push({
        id: uid('pl'),
        name: promoted.name,
        email: promoted.email,
        teamId: team.id,
        leagueId: team.leagueId,
        position: promoted.position,
        gender: promoted.gender,
        jerseyNumber: currentRoster.length + 5,
        skillRating: league.skillLevel,
        isCaptain: false,
        gamesPlayed: 0,
        goals: 0,
        assists: 0,
        cleanSheets: 0,
        wins: 0,
        yellowCards: 0,
        redCards: 0,
        suspendedNextMatch: false,
        motmAwards: 0,
        joinedTeamAt: nowIso,
        lastMarketActionAt: nowIso,
        marketListing: null,
        loansUsedThisSeason: 0,
        activeLoanId: null,
        waiverSigned: true,
        waiverSignedAt: nowIso,
        waiverSignatureName: promoted.name,
      });
      promotedName = promoted.name;
      db.doneDeals.unshift({
        id: uid('dd'),
        leagueId: team.leagueId,
        kind: 'free_agent',
        summary: `Waitlist Auto-Promote: ${promoted.name} joined ${team.name}`,
        details: `Promoted automatically after ${target.name} opened a roster slot`,
        timestamp: nowIso,
      });
    }

    saveDatabase(db);
    res.json({ db, promotedName });
  });

  // Friend Invites & Free-Agent Recruiting Pool
  app.post('/api/teams/:id/invite', (req, res) => {
    const team = db.teams.find((t) => t.id === req.params.id);
    const league = db.leagues.find((l) => l.id === team?.leagueId);
    if (!team || !league) return res.status(404).json({ error: 'Team or league not found' });

    const { invitedPlayerId, invitedName, invitedEmail, invitedGender, position } = req.body as {
      invitedPlayerId?: string;
      invitedName: string;
      invitedEmail?: string;
      invitedGender?: 'Male' | 'Female';
      position?: Player['position'];
    };

    const freeAgent = invitedPlayerId
      ? db.players.find((p) => p.id === invitedPlayerId)
      : undefined;
    const finalGender: 'Male' | 'Female' =
      freeAgent?.gender === 'Female' || invitedGender === 'Female' ? 'Female' : 'Male';
    const rosterPlayers = db.players.filter((p) => p.teamId === team.id);
    const evalRes = evaluateTeamRosterAddition(team, league, rosterPlayers, finalGender);
    if (!evalRes.allowed) {
      return res.status(400).json({ error: evalRes.reason });
    }

    const isPaidInFull = team.amountPaid >= team.totalFee;
    const invite: TeamInvite = {
      id: uid('inv'),
      teamId: team.id,
      teamName: team.name,
      leagueId: league.id,
      leagueName: league.name,
      invitedPlayerId: freeAgent?.id,
      invitedName: freeAgent?.name || invitedName || 'Invited Friend',
      invitedEmail: freeAgent?.email || invitedEmail,
      invitedGender: finalGender,
      position: freeAgent?.position || position || 'MID',
      isPaidInFullFreeJoin: isPaidInFull,
      status: 'Pending',
      createdAt: new Date().toISOString(),
    };
    db.teamInvites.unshift(invite);
    saveDatabase(db);
    res.json({ db, invite });
  });

  app.post('/api/invites/:id/respond', (req, res) => {
    const invite = db.teamInvites.find((i) => i.id === req.params.id);
    if (!invite) return res.status(404).json({ error: 'Invite not found' });
    if (invite.status !== 'Pending') return res.status(400).json({ error: 'Invite already processed' });

    const { decision } = req.body as { decision: 'Accepted' | 'Declined' };
    if (decision === 'Declined') {
      invite.status = 'Declined';
      saveDatabase(db);
      return res.json(db);
    }

    const team = db.teams.find((t) => t.id === invite.teamId);
    const league = db.leagues.find((l) => l.id === invite.leagueId);
    if (!team || !league) return res.status(404).json({ error: 'Team or league not found' });

    const rosterPlayers = db.players.filter((p) => p.teamId === team.id);
    const evalRes = evaluateTeamRosterAddition(team, league, rosterPlayers, invite.invitedGender);
    if (!evalRes.allowed) {
      return res.status(400).json({ error: evalRes.reason });
    }
    if (evalRes.shouldAutoFlipTo4M7F) {
      team.customMaleCap = 4;
      team.customFemaleCap = 7;
      team.autoFlippedCoEd = true;
    }

    const nowIso = new Date().toISOString();
    if (invite.invitedPlayerId) {
      const fa = db.players.find((p) => p.id === invite.invitedPlayerId);
      if (fa) {
        fa.teamId = team.id;
        fa.leagueId = league.id;
        fa.isFreeAgent = false;
        fa.joinedTeamAt = nowIso;
      }
    } else {
      db.players.push({
        id: uid('pl'),
        name: invite.invitedName,
        email: invite.invitedEmail || `${invite.invitedName.toLowerCase().replace(/[^a-z]/g, '')}@pitchpot.io`,
        teamId: team.id,
        leagueId: league.id,
        position: invite.position,
        gender: invite.invitedGender,
        jerseyNumber: rosterPlayers.length + 4,
        skillRating: league.skillLevel,
        isCaptain: false,
        gamesPlayed: 0,
        goals: 0,
        assists: 0,
        cleanSheets: 0,
        wins: 0,
        yellowCards: 0,
        redCards: 0,
        suspendedNextMatch: false,
        motmAwards: 0,
        joinedTeamAt: nowIso,
        lastMarketActionAt: nowIso,
        marketListing: null,
        loansUsedThisSeason: 0,
        activeLoanId: null,
        waiverSigned: true,
        waiverSignedAt: nowIso,
        waiverSignatureName: invite.invitedName,
      });
    }

    invite.status = 'Accepted';
    db.doneDeals.unshift({
      id: uid('dd'),
      leagueId: league.id,
      kind: 'free_agent',
      summary: `${invite.invitedName} accepted invite to ${team.name}`,
      details: `${invite.isPaidInFullFreeJoin ? '$0 Free Join (Team Paid in Full)' : 'Split-Pay Teammate Spot'} · ${invite.invitedGender}`,
      timestamp: nowIso,
    });
    saveDatabase(db);
    res.json(db);
  });

  // Payment reminders & recording
  app.post('/api/teams/:id/remind', (req, res) => {
    const team = db.teams.find((t) => t.id === req.params.id);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    team.lastReminderAt = new Date().toISOString();
    saveDatabase(db);
    res.json(db);
  });

  app.post('/api/teams/:id/record-payment', (req, res) => {
    const team = db.teams.find((t) => t.id === req.params.id);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    const { amount } = req.body as { amount?: number };
    team.amountPaid = amount !== undefined ? Math.min(team.totalFee, team.amountPaid + Number(amount)) : team.totalFee;
    const nowIso = new Date().toISOString();
    if (team.amountPaid >= team.totalFee) {
      team.paymentMode = 'full';
      team.registrationStatus = 'Complete';
      team.registrationCompletedAt = team.registrationCompletedAt || nowIso;
      db.players.forEach((p) => {
        if (p.teamId === team.id && p.waiverSigned && p.registrationStatus !== 'Complete') {
          p.registrationStatus = 'Complete';
          p.registrationCompletedAt = nowIso;
        }
      });
    } else {
      team.registrationStatus = 'Pending Payment';
    }
    saveDatabase(db);
    res.json(db);
  });

  // Staff Manager
  app.post('/api/staff', (req, res) => {
    const { name, email, role, permissions } = req.body as Partial<StaffMember>;
    if (!name || !email || !role) return res.status(400).json({ error: 'Name, email, and role required' });
    db.staff.push({
      id: uid('st'),
      name,
      email,
      role,
      permissions: permissions && permissions.length > 0 ? permissions : ['League Ops'],
      inviteCode: role.slice(0, 3).toUpperCase() + Math.floor(100 + Math.random() * 899),
      status: 'Invited',
      createdAt: new Date().toISOString(),
    });
    saveDatabase(db);
    res.json(db);
  });

  app.delete('/api/staff/:id', (req, res) => {
    db.staff = db.staff.filter((s) => s.id !== req.params.id);
    saveDatabase(db);
    res.json(db);
  });

  // Partners & Sponsors + Become a Partner Form
  app.post('/api/partners', (req, res) => {
    const { name, category, tagline, promoUrl, contactEmail, status } = req.body as Partial<Partner>;
    if (!name || !tagline) return res.status(400).json({ error: 'Partner name and description required' });
    db.partners.push({
      id: uid('pt'),
      name,
      category: category || 'Local Sponsor',
      tagline,
      promoUrl: promoUrl || 'https://example.com',
      contactEmail,
      status: status || 'Approved',
    });
    saveDatabase(db);
    res.json(db);
  });

  app.patch('/api/partners/:id', (req, res) => {
    const partner = db.partners.find((p) => p.id === req.params.id);
    if (!partner) return res.status(404).json({ error: 'Partner not found' });
    Object.assign(partner, req.body);
    saveDatabase(db);
    res.json(db);
  });

  app.delete('/api/partners/:id', (req, res) => {
    db.partners = db.partners.filter((p) => p.id !== req.params.id);
    saveDatabase(db);
    res.json(db);
  });

  // Promo Codes
  app.post('/api/promos', (req, res) => {
    const { code, discountAmount, description } = req.body as Partial<PromoCode>;
    if (!code || !discountAmount) return res.status(400).json({ error: 'Code and discount required' });
    db.promoCodes.push({
      id: uid('pr'),
      code: code.trim().toUpperCase(),
      discountAmount: Number(discountAmount),
      description: description || `$${discountAmount} off entry`,
      active: true,
      uses: 0,
    });
    saveDatabase(db);
    res.json(db);
  });

  app.patch('/api/promos/:id', (req, res) => {
    const pr = db.promoCodes.find((p) => p.id === req.params.id);
    if (!pr) return res.status(404).json({ error: 'Promo not found' });
    Object.assign(pr, req.body);
    saveDatabase(db);
    res.json(db);
  });

  // Suspension Manager
  app.post('/api/players/:id/clear-suspension', (req, res) => {
    const p = db.players.find((pl) => pl.id === req.params.id);
    if (!p) return res.status(404).json({ error: 'Player not found' });
    p.suspendedNextMatch = false;
    saveDatabase(db);
    res.json(db);
  });

  // Market Self-Listing
  app.post('/api/players/:id/market-listing', (req, res) => {
    const player = db.players.find((p) => p.id === req.params.id);
    if (!player) return res.status(404).json({ error: 'Player not found' });

    const { action, mode, preferredPosition, availabilityNotes } = req.body as {
      action: 'list' | 'unlist';
      mode?: 'Swap Transfer' | '4-Game Loan' | 'Both';
      preferredPosition?: Player['position'];
      availabilityNotes?: string;
    };

    if (action === 'unlist') {
      player.marketListing = null;
      player.lastMarketActionAt = new Date().toISOString();
      saveDatabase(db);
      return res.json(db);
    }

    if (player.activeLoanId) {
      return res.status(400).json({ error: 'Cannot list yourself while on an active 4-game loan' });
    }

    const refMs = new Date(player.lastMarketActionAt || player.joinedTeamAt).getTime();
    if (Date.now() - refMs < MARKET_COOLDOWN_MS) {
      return res.status(400).json({
        error: '3-day market cooldown has not elapsed yet since joining or last market action.',
      });
    }

    player.marketListing = {
      mode: mode || 'Both',
      preferredPosition: preferredPosition || player.position,
      availabilityNotes: availabilityNotes || 'Available for league fixtures.',
      listedAt: new Date().toISOString(),
    };
    saveDatabase(db);
    res.json(db);
  });

  // 1-for-1 Swap Transfer
  app.post('/api/transfers/swap', (req, res) => {
    const {
      leagueId,
      initiatedByPlayerId,
      fromTeamId,
      toTeamId,
      offeredPlayerId,
      requestedPlayerId,
      note,
    } = req.body as {
      leagueId: string;
      initiatedByPlayerId: string;
      fromTeamId: string;
      toTeamId: string;
      offeredPlayerId: string;
      requestedPlayerId: string;
      note?: string;
    };

    const league = db.leagues.find((l) => l.id === leagueId);
    if (!league) return res.status(404).json({ error: 'League not found' });
    if (league.rosterLocked || league.isPlayoffsActive) {
      return res.status(400).json({ error: 'Rosters are locked for playoffs.' });
    }
    if (league.currentWeek > league.transferDeadlineWeek) {
      return res.status(400).json({
        error: `Permanent transfer window closed after Week ${league.transferDeadlineWeek}.`,
      });
    }
    if (fromTeamId === toTeamId) {
      return res.status(400).json({ error: 'Swap must be between two different teams.' });
    }

    const initiator = db.players.find((p) => p.id === initiatedByPlayerId);
    const fromTeam = db.teams.find((t) => t.id === fromTeamId);
    const toTeam = db.teams.find((t) => t.id === toTeamId);
    const offeredPlayer = db.players.find((p) => p.id === offeredPlayerId && p.teamId === fromTeamId);
    const requestedPlayer = db.players.find((p) => p.id === requestedPlayerId && p.teamId === toTeamId);

    if (!initiator || !fromTeam || !toTeam || !offeredPlayer || !requestedPlayer) {
      return res.status(400).json({ error: 'Both teams and both swapped players must be valid (1-for-1 Swap required).' });
    }
    if (offeredPlayer.activeLoanId || requestedPlayer.activeLoanId) {
      return res.status(400).json({ error: 'Players currently on an active loan cannot be permanently swapped.' });
    }

    const standings = computeServerStandings(leagueId, db);
    const fromRank = standings.find((s) => s.teamId === fromTeamId)?.rank ?? 99;
    const isStrugglingLifeline = fromRank >= 8 && fromRank <= 10;

    if (!initiator.isCaptain) {
      if (!isStrugglingLifeline) {
        return res.status(403).json({
          error: 'Only the Team Captain can initiate swaps unless the team is ranked 8th, 9th, or 10th (Struggling Team Lifeline).',
        });
      }
      if (fromTeam.lastLifelineRequestAt) {
        const elapsed = Date.now() - new Date(fromTeam.lastLifelineRequestAt).getTime();
        if (elapsed < LIFELINE_COOLDOWN_MS) {
          return res.status(400).json({
            error: 'Struggling Team Lifeline is on a 3-day cooldown since the last request.',
          });
        }
      }
      fromTeam.lastLifelineRequestAt = new Date().toISOString();
    }

    db.transfers.unshift({
      id: uid('tr'),
      kind: 'swap',
      leagueId,
      status: 'Pending',
      createdAt: new Date().toISOString(),
      initiatedByPlayerId,
      initiatedByName: initiator.name,
      isStrugglingTeamLifeline: isStrugglingLifeline,
      note: note || (isStrugglingLifeline ? `Rank #${fromRank} Struggling Team Lifeline 1-for-1 Swap` : '1-for-1 Swap Transfer'),
      fromTeamId,
      toTeamId,
      offeredPlayerId,
      requestedPlayerId,
      swapApprovals: {
        requestingCaptain: initiator.isCaptain,
        targetCaptain: false,
        offeredPlayer: initiator.id === offeredPlayerId,
        requestedPlayer: false,
        admin: !league.requireAdminTransferSignOff,
      },
    });
    saveDatabase(db);
    res.json(db);
  });

  // 4-Game Loan
  app.post('/api/transfers/loan', (req, res) => {
    const {
      leagueId,
      initiatedByPlayerId,
      borrowingTeamId,
      lendingTeamId,
      loanMode,
      loanPlayerIds,
      note,
    } = req.body as {
      leagueId: string;
      initiatedByPlayerId: string;
      borrowingTeamId: string;
      lendingTeamId: string;
      loanMode: 'single' | 'rotating';
      loanPlayerIds: string[];
      note?: string;
    };

    const league = db.leagues.find((l) => l.id === leagueId);
    if (!league) return res.status(404).json({ error: 'League not found' });
    if (league.rosterLocked || league.isPlayoffsActive) {
      return res.status(400).json({ error: 'Loans are blocked during playoffs and roster lock.' });
    }
    if (borrowingTeamId === lendingTeamId) {
      return res.status(400).json({ error: 'Borrowing and lending teams must be different.' });
    }
    if (!loanPlayerIds || loanPlayerIds.length === 0) {
      return res.status(400).json({ error: 'Select at least 1 player for the 4-game loan.' });
    }
    if (loanMode === 'single' && loanPlayerIds.length !== 1) {
      return res.status(400).json({ error: 'Single Player Mode requires exactly 1 player.' });
    }
    if (loanMode === 'rotating' && loanPlayerIds.length > 4) {
      return res.status(400).json({ error: 'Multi-Player Rotating Mode supports up to 4 players.' });
    }

    const initiator = db.players.find((p) => p.id === initiatedByPlayerId);
    const borrowingTeam = db.teams.find((t) => t.id === borrowingTeamId);
    const lendingTeam = db.teams.find((t) => t.id === lendingTeamId);
    if (!initiator || !borrowingTeam || !lendingTeam) {
      return res.status(400).json({ error: 'Invalid team or initiator.' });
    }

    const standings = computeServerStandings(leagueId, db);
    const borrowRank = standings.find((s) => s.teamId === borrowingTeamId)?.rank ?? 99;
    const lendRank = standings.find((s) => s.teamId === lendingTeamId)?.rank ?? 1;
    if (borrowRank < lendRank) {
      return res.status(400).json({
        error: `Anti-stacking rule: Higher-ranked #${borrowRank} ${borrowingTeam.name} cannot borrow from lower-ranked #${lendRank} ${lendingTeam.name}.`,
      });
    }

    const borrowRosterCount = db.players.filter((p) => p.teamId === borrowingTeamId).length;
    if (borrowRosterCount >= borrowingTeam.rosterLimit) {
      return res.status(400).json({ error: 'Borrowing team has no open roster spots.' });
    }

    for (const pid of loanPlayerIds) {
      const p = db.players.find((pl) => pl.id === pid && pl.teamId === lendingTeamId);
      if (!p) return res.status(400).json({ error: 'All loan players must belong to the lending team.' });
      if (p.loansUsedThisSeason >= 1) {
        return res.status(400).json({ error: `${p.name} has already used their 1 loan per season limit.` });
      }
      if (p.activeLoanId) {
        return res.status(400).json({ error: `${p.name} is already locked in an active loan.` });
      }
    }

    const isStrugglingLifeline = borrowRank >= 8 && borrowRank <= 10;
    if (!initiator.isCaptain) {
      if (!isStrugglingLifeline) {
        return res.status(403).json({
          error: 'Only Captains can propose loans unless your team is in 8th, 9th, or 10th place (Struggling Team Lifeline).',
        });
      }
      if (borrowingTeam.lastLifelineRequestAt) {
        const elapsed = Date.now() - new Date(borrowingTeam.lastLifelineRequestAt).getTime();
        if (elapsed < LIFELINE_COOLDOWN_MS) {
          return res.status(400).json({ error: 'Struggling Team Lifeline is on a 3-day cooldown.' });
        }
      }
      borrowingTeam.lastLifelineRequestAt = new Date().toISOString();
    }

    const playersAccepted: Record<string, boolean> = {};
    for (const pid of loanPlayerIds) {
      playersAccepted[pid] = pid === initiatedByPlayerId;
    }

    db.transfers.unshift({
      id: uid('ln'),
      kind: 'loan',
      leagueId,
      status: 'Pending',
      createdAt: new Date().toISOString(),
      initiatedByPlayerId,
      initiatedByName: initiator.name,
      isStrugglingTeamLifeline: isStrugglingLifeline,
      note:
        note ||
        `${loanMode === 'rotating' ? 'Multi-Player Rotating' : 'Single Player'} 4-Game Loan`,
      borrowingTeamId,
      lendingTeamId,
      loanMode,
      loanPlayerIds,
      gamesTotal: 4,
      gamesRemaining: 4,
      gameLogs: [],
      loanApprovals: {
        borrowingCaptain: initiator.isCaptain && initiator.teamId === borrowingTeamId,
        lendingCaptain: initiator.isCaptain && initiator.teamId === lendingTeamId,
        playersAccepted,
        admin: !league.requireAdminTransferSignOff,
      },
    });
    saveDatabase(db);
    res.json(db);
  });

  app.post('/api/transfers/:id/approve', (req, res) => {
    const tr = db.transfers.find((t) => t.id === req.params.id);
    if (!tr) return res.status(404).json({ error: 'Request not found' });
    if (tr.status !== 'Pending') return res.status(400).json({ error: 'Request is no longer pending' });

    const league = db.leagues.find((l) => l.id === tr.leagueId);
    const { role, playerId } = req.body as { role: string; playerId?: string };

    if (tr.kind === 'swap' && tr.swapApprovals) {
      if (role === 'requestingCaptain') tr.swapApprovals.requestingCaptain = true;
      if (role === 'targetCaptain') tr.swapApprovals.targetCaptain = true;
      if (role === 'offeredPlayer') tr.swapApprovals.offeredPlayer = true;
      if (role === 'requestedPlayer') tr.swapApprovals.requestedPlayer = true;
      if (role === 'admin') tr.swapApprovals.admin = true;

      const appv = tr.swapApprovals;
      const adminOk = !league?.requireAdminTransferSignOff || appv.admin;
      if (
        appv.requestingCaptain &&
        appv.targetCaptain &&
        appv.offeredPlayer &&
        appv.requestedPlayer &&
        adminOk
      ) {
        const pOut = db.players.find((p) => p.id === tr.offeredPlayerId);
        const pIn = db.players.find((p) => p.id === tr.requestedPlayerId);
        const tFrom = db.teams.find((t) => t.id === tr.fromTeamId);
        const tTo = db.teams.find((t) => t.id === tr.toTeamId);
        if (pOut && pIn && tFrom && tTo) {
          pOut.teamId = tTo.id;
          pIn.teamId = tFrom.id;
          pOut.isCaptain = false;
          pIn.isCaptain = false;
          const nowIso = new Date().toISOString();
          pOut.marketListing = null;
          pIn.marketListing = null;
          pOut.lastMarketActionAt = nowIso;
          pIn.lastMarketActionAt = nowIso;
          tr.status = 'Completed';
          tr.completedAt = nowIso;
          db.doneDeals.unshift({
            id: uid('dd'),
            leagueId: tr.leagueId,
            kind: 'swap',
            summary: `1-for-1 Swap: ${pOut.name} (${tFrom.name}) <-> ${pIn.name} (${tTo.name})`,
            details: 'All 4 approvals verified · Rosters updated automatically',
            timestamp: nowIso,
          });
        }
      }
    } else if (tr.kind === 'loan' && tr.loanApprovals) {
      if (role === 'borrowingCaptain') tr.loanApprovals.borrowingCaptain = true;
      if (role === 'lendingCaptain') tr.loanApprovals.lendingCaptain = true;
      if (role === 'admin') tr.loanApprovals.admin = true;
      if (role === 'player' && playerId && tr.loanPlayerIds?.includes(playerId)) {
        tr.loanApprovals.playersAccepted[playerId] = true;
      }

      const appv = tr.loanApprovals;
      const allPlayersOk = (tr.loanPlayerIds || []).every((pid) => appv.playersAccepted[pid]);
      const adminOk = !league?.requireAdminTransferSignOff || appv.admin;
      if (appv.borrowingCaptain && appv.lendingCaptain && allPlayersOk && adminOk) {
        tr.status = 'Active';
        const nowIso = new Date().toISOString();
        const borrowTeam = db.teams.find((t) => t.id === tr.borrowingTeamId);
        const lendTeam = db.teams.find((t) => t.id === tr.lendingTeamId);
        const pNames: string[] = [];
        for (const pid of tr.loanPlayerIds || []) {
          const pl = db.players.find((p) => p.id === pid);
          if (pl) {
            pl.activeLoanId = tr.id;
            pl.loansUsedThisSeason += 1;
            pl.marketListing = null;
            pl.lastMarketActionAt = nowIso;
            pNames.push(pl.name);
          }
        }
        db.doneDeals.unshift({
          id: uid('dd'),
          leagueId: tr.leagueId,
          kind: 'loan',
          summary: `4-Game Loan (${tr.loanMode === 'rotating' ? 'Rotating' : 'Single'}): ${pNames.join(', ')} (${lendTeam?.name} -> ${borrowTeam?.name})`,
          details: '4 of 4 games remaining · Ineligible for original club during 4-game window',
          timestamp: nowIso,
        });
      }
    }

    saveDatabase(db);
    res.json(db);
  });

  app.post('/api/transfers/:id/reject', (req, res) => {
    const tr = db.transfers.find((t) => t.id === req.params.id);
    if (!tr) return res.status(404).json({ error: 'Request not found' });
    tr.status = 'Rejected';
    saveDatabase(db);
    res.json(db);
  });

  // Emergency Sub Request Board
  app.post('/api/subs', (req, res) => {
    const { leagueId, matchId, teamId, positionNeeded, subFee } = req.body as {
      leagueId: string;
      matchId: string;
      teamId: string;
      positionNeeded: SubRequest['positionNeeded'];
      subFee: string;
    };
    const league = db.leagues.find((l) => l.id === leagueId);
    const match = db.matches.find((m) => m.id === matchId);
    const team = db.teams.find((t) => t.id === teamId);
    if (!league || !match || !team) return res.status(400).json({ error: 'Invalid sub request data' });
    if (league.isPlayoffsActive || (match.stage !== 'Regular' && match.stage !== 'Group')) {
      return res.status(400).json({
        error: 'Cash-prize anti-ringer guardrail: Emergency sub requests are disabled during playoffs.',
      });
    }
    const venue = db.venues.find((v) => v.id === league.venueId);
    db.subRequests.unshift({
      id: uid('sub'),
      leagueId,
      matchId,
      teamId,
      teamName: team.name,
      matchDate: match.scheduledDate,
      matchTime: match.scheduledTime,
      fieldLocation: `${venue?.name || league.locationName} · ${match.fieldNumber}`,
      positionNeeded: positionNeeded || 'ANY',
      skillLevel: league.skillLevel,
      subFee: subFee || 'Free / Covered by Team',
      status: 'Open',
      createdAt: new Date().toISOString(),
    });
    saveDatabase(db);
    res.json(db);
  });

  app.post('/api/subs/:id/claim', (req, res) => {
    const sub = db.subRequests.find((s) => s.id === req.params.id);
    if (!sub) return res.status(404).json({ error: 'Sub request not found' });
    if (sub.status !== 'Open') return res.status(400).json({ error: 'Sub spot already claimed' });
    const { playerId } = req.body as { playerId: string };
    const player = db.players.find((p) => p.id === playerId);
    if (!player) return res.status(404).json({ error: 'Player not found' });
    if (player.teamId === sub.teamId) {
      return res.status(400).json({ error: 'You are already on this team roster.' });
    }
    if (player.suspendedNextMatch) {
      return res.status(400).json({ error: 'Suspended players cannot claim sub spots.' });
    }
    sub.status = 'Claimed';
    sub.claimedByPlayerId = player.id;
    sub.claimedByName = player.name;
    db.doneDeals.unshift({
      id: uid('dd'),
      leagueId: sub.leagueId,
      kind: 'sub',
      summary: `Emergency Sub Claimed: ${player.name} -> ${sub.teamName}`,
      details: `${sub.matchDate} ${sub.matchTime} · ${sub.positionNeeded} · ${sub.subFee}`,
      timestamp: new Date().toISOString(),
    });
    saveDatabase(db);
    res.json(db);
  });

  // Ride Hub (Safe Public Carpool Matcher)
  app.post('/api/rides', (req, res) => {
    const {
      leagueId,
      riderPlayerId,
      landmarkType,
      landmarkName,
      matchDate,
      matchTime,
      detourEstimate,
    } = req.body as {
      leagueId: string;
      riderPlayerId: string;
      landmarkType: RideRequest['landmarkType'];
      landmarkName: string;
      matchDate: string;
      matchTime: string;
      detourEstimate?: string;
    };
    const player = db.players.find((p) => p.id === riderPlayerId);
    const team = db.teams.find((t) => t.id === player?.teamId);
    const league = db.leagues.find((l) => l.id === leagueId);
    const venue = db.venues.find((v) => v.id === league?.venueId);
    if (!player || !landmarkName) return res.status(400).json({ error: 'Public landmark required' });

    db.rides.unshift({
      id: uid('rd'),
      leagueId,
      venueName: venue?.name || league?.locationName || 'League Turf',
      matchDate: matchDate || 'Next Matchday',
      matchTime: matchTime || '7:00 PM',
      riderPlayerId: player.id,
      riderName: player.name,
      riderTeamName: team?.name || 'Free Agent',
      landmarkType: landmarkType || 'Subway / GO Station',
      landmarkName,
      detourEstimate: detourEstimate || '~6 mins off route',
      status: 'Open',
      messages: [],
      createdAt: new Date().toISOString(),
    });
    saveDatabase(db);
    res.json(db);
  });

  app.post('/api/rides/:id/accept', (req, res) => {
    const ride = db.rides.find((r) => r.id === req.params.id);
    if (!ride) return res.status(404).json({ error: 'Ride request not found' });
    const { driverPlayerId, seatsAvailable, costOption } = req.body as {
      driverPlayerId: string;
      seatsAvailable: number;
      costOption: 'Free Lift' | 'Split Gas ($5)';
    };
    const driver = db.players.find((p) => p.id === driverPlayerId);
    if (!driver) return res.status(404).json({ error: 'Driver not found' });
    ride.status = 'Accepted';
    ride.driverPlayerId = driver.id;
    ride.driverName = driver.name;
    ride.seatsAvailable = Math.min(4, Math.max(1, Number(seatsAvailable) || 2));
    ride.costOption = costOption || 'Free Lift';
    driver.isTeamDriver = true;
    saveDatabase(db);
    res.json(db);
  });

  app.post('/api/rides/:id/status', (req, res) => {
    const ride = db.rides.find((r) => r.id === req.params.id);
    if (!ride) return res.status(404).json({ error: 'Ride request not found' });
    const { status } = req.body as { status: RideRequest['status'] };
    ride.status = status;
    saveDatabase(db);
    res.json(db);
  });

  app.post('/api/rides/:id/message', (req, res) => {
    const ride = db.rides.find((r) => r.id === req.params.id);
    if (!ride) return res.status(404).json({ error: 'Ride request not found' });
    const { senderName, text } = req.body as { senderName: string; text: string };
    if (!text?.trim()) return res.status(400).json({ error: 'Message text required' });
    ride.messages.push({
      id: uid('rc'),
      senderName: senderName || 'Player',
      text: text.trim(),
      timestamp: new Date().toISOString(),
    });
    saveDatabase(db);
    res.json(db);
  });

  // Team Locker Room: Group Chat, 1-on-1 DMs, RSVP, Polls, MOTM
  app.post('/api/clubhouse/team-chat', (req, res) => {
    const { teamId, senderId, senderName, text } = req.body as {
      teamId: string;
      senderId: string;
      senderName: string;
      text: string;
    };
    if (!text?.trim()) return res.status(400).json({ error: 'Message required' });
    db.teamMessages.push({
      id: uid('tmsg'),
      teamId,
      senderId,
      senderName,
      text: text.trim(),
      timestamp: new Date().toISOString(),
    });
    saveDatabase(db);
    res.json(db);
  });

  app.post('/api/clubhouse/dm', (req, res) => {
    const { fromPlayerId, fromName, toPlayerId, toName, text } = req.body as {
      fromPlayerId: string;
      fromName: string;
      toPlayerId: string;
      toName: string;
      text: string;
    };
    if (!text?.trim()) return res.status(400).json({ error: 'Message required' });
    db.directMessages.push({
      id: uid('dm'),
      fromPlayerId,
      fromName,
      toPlayerId,
      toName,
      text: text.trim(),
      timestamp: new Date().toISOString(),
    });
    saveDatabase(db);
    res.json(db);
  });

  app.post('/api/clubhouse/rsvp', (req, res) => {
    const { matchId, teamId, playerId, playerName, status } = req.body as {
      matchId: string;
      teamId: string;
      playerId: string;
      playerName: string;
      status: 'IN' | 'OUT' | 'MAYBE';
    };
    const existing = db.rsvps.find(
      (r) => r.matchId === matchId && r.teamId === teamId && r.playerId === playerId
    );
    if (existing) {
      existing.status = status;
    } else {
      db.rsvps.push({ matchId, teamId, playerId, playerName, status });
    }
    saveDatabase(db);
    res.json(db);
  });

  app.post('/api/clubhouse/polls', (req, res) => {
    const { teamId, question, createdByName, options } = req.body as {
      teamId: string;
      question: string;
      createdByName: string;
      options: string[];
    };
    if (!question?.trim() || !options || options.length < 2) {
      return res.status(400).json({ error: 'Question and at least 2 options required' });
    }
    db.polls.unshift({
      id: uid('poll'),
      teamId,
      question: question.trim(),
      createdByName,
      options: options.map((lbl, idx) => ({ id: `opt_${idx}_${Date.now()}`, label: lbl, voterIds: [] })),
      createdAt: new Date().toISOString(),
    });
    saveDatabase(db);
    res.json(db);
  });

  app.post('/api/clubhouse/polls/:id/vote', (req, res) => {
    const poll = db.polls.find((p) => p.id === req.params.id);
    if (!poll) return res.status(404).json({ error: 'Poll not found' });
    const { optionId, playerId } = req.body as { optionId: string; playerId: string };
    for (const opt of poll.options) {
      opt.voterIds = opt.voterIds.filter((id) => id !== playerId);
      if (opt.id === optionId) opt.voterIds.push(playerId);
    }
    saveDatabase(db);
    res.json(db);
  });

  app.post('/api/clubhouse/motm', (req, res) => {
    const { matchId, teamId, voterPlayerId, nomineePlayerId } = req.body as {
      matchId: string;
      teamId: string;
      voterPlayerId: string;
      nomineePlayerId: string;
    };
    const already = db.motmVotes.find(
      (v) => v.matchId === matchId && v.voterPlayerId === voterPlayerId
    );
    if (already) return res.status(400).json({ error: 'You already voted for MOTM in this match.' });
    db.motmVotes.push({ matchId, teamId, voterPlayerId, nomineePlayerId });
    const nominee = db.players.find((p) => p.id === nomineePlayerId);
    if (nominee) nominee.motmAwards = (nominee.motmAwards ?? 0) + 1;
    saveDatabase(db);
    res.json(db);
  });

  // Opponent Matchday Chat ("Pre-Game Lobby")
  app.post('/api/opponent-chat', (req, res) => {
    const { matchId, senderPlayerId, senderName, teamName, text } = req.body as {
      matchId: string;
      senderPlayerId: string;
      senderName: string;
      teamName: string;
      text: string;
    };
    if (db.mutedPlayerIds.includes(senderPlayerId)) {
      return res.status(403).json({ error: 'Player is muted in Matchday Lobby.' });
    }
    if (!text?.trim()) return res.status(400).json({ error: 'Message text required' });
    db.opponentMessages.push({
      id: uid('op'),
      matchId,
      senderPlayerId,
      senderName,
      teamName,
      text: text.trim(),
      timestamp: new Date().toISOString(),
    });
    saveDatabase(db);
    res.json(db);
  });

  app.post('/api/opponent-chat/:id/report', (req, res) => {
    const msg = db.opponentMessages.find((m) => m.id === req.params.id);
    if (!msg) return res.status(404).json({ error: 'Message not found' });
    msg.reported = true;
    saveDatabase(db);
    res.json(db);
  });

  app.post('/api/opponent-chat/mute', (req, res) => {
    const { playerId } = req.body as { playerId: string };
    if (playerId && !db.mutedPlayerIds.includes(playerId)) {
      db.mutedPlayerIds.push(playerId);
    }
    saveDatabase(db);
    res.json(db);
  });

  // Referee Match Result Submission (updates Standings, Scorers, Red Card Suspensions, 4-Game Loans, Bracket)
  app.post('/api/matches/:id/submit-result', (req, res) => {
    const match = db.matches.find((m) => m.id === req.params.id);
    if (!match) return res.status(404).json({ error: 'Match not found' });
    if (match.status === 'Final') {
      return res.status(400).json({ error: 'Match result has already been finalized' });
    }

    const { homeScore, awayScore, events, loanAppearancePlayerIds } = req.body as {
      homeScore: number;
      awayScore: number;
      events: MatchEvent[];
      loanAppearancePlayerIds?: string[];
    };

    match.homeScore = Number(homeScore);
    match.awayScore = Number(awayScore);
    match.status = 'Final';
    match.events = events || [];
    match.loanAppearancePlayerIds = loanAppearancePlayerIds || [];

    const activeLoans = db.transfers.filter(
      (tr) => tr.kind === 'loan' && tr.status === 'Active' && (tr.gamesRemaining ?? 0) > 0
    );

    const homeRoster = db.players.filter((p) => p.teamId === match.homeTeamId);
    const awayRoster = db.players.filter((p) => p.teamId === match.awayTeamId);

    for (const p of [...homeRoster, ...awayRoster]) {
      const lockedOut = activeLoans.some(
        (ln) => ln.lendingTeamId === p.teamId && ln.loanPlayerIds?.includes(p.id)
      );
      if (!lockedOut) {
        p.gamesPlayed += 1;
        if (
          (p.teamId === match.homeTeamId && match.homeScore > match.awayScore) ||
          (p.teamId === match.awayTeamId && match.awayScore > match.homeScore)
        ) {
          p.wins = (p.wins ?? 0) + 1;
        }
        if (
          p.position === 'GK' &&
          ((p.teamId === match.homeTeamId && match.awayScore === 0) ||
            (p.teamId === match.awayTeamId && match.homeScore === 0))
        ) {
          p.cleanSheets = (p.cleanSheets ?? 0) + 1;
        }
      }
    }

    for (const pid of match.loanAppearancePlayerIds) {
      const lp = db.players.find((p) => p.id === pid);
      if (lp) lp.gamesPlayed += 1;
    }

    for (const ev of match.events) {
      const pl = db.players.find((p) => p.id === ev.playerId);
      if (!pl) continue;
      if (ev.type === 'Goal') pl.goals += 1;
      if (ev.type === 'Yellow') pl.yellowCards += 1;
      if (ev.type === 'Red') {
        pl.redCards += 1;
        pl.suspendedNextMatch = true;
      }
    }

    const nowIso = new Date().toISOString();
    for (const loan of activeLoans) {
      if (loan.leagueId !== match.leagueId) continue;
      const borrowingPlayed =
        loan.borrowingTeamId === match.homeTeamId || loan.borrowingTeamId === match.awayTeamId;
      if (!borrowingPlayed) continue;

      const appearedIds = (loan.loanPlayerIds || []).filter((pid) =>
        match.loanAppearancePlayerIds.includes(pid)
      );
      const creditedId = appearedIds[0] || loan.loanPlayerIds?.[0] || '';
      const creditedPlayer = db.players.find((p) => p.id === creditedId);

      loan.gamesRemaining = Math.max(0, (loan.gamesRemaining ?? 4) - 1);
      loan.gameLogs = loan.gameLogs || [];
      loan.gameLogs.push({
        matchId: match.id,
        playerId: creditedId,
        playerName: creditedPlayer ? creditedPlayer.name : 'Loan Slot',
        date: nowIso,
      });

      if (loan.gamesRemaining === 0) {
        loan.status = 'Completed';
        loan.completedAt = nowIso;
        const lendTeam = db.teams.find((t) => t.id === loan.lendingTeamId);
        const names: string[] = [];
        for (const pid of loan.loanPlayerIds || []) {
          const p = db.players.find((pl) => pl.id === pid);
          if (p) {
            p.activeLoanId = null;
            p.lastMarketActionAt = nowIso;
            names.push(p.name);
          }
        }
        db.doneDeals.unshift({
          id: uid('dd'),
          leagueId: loan.leagueId,
          kind: 'loan_return',
          summary: `Loan Completed (4/4): ${names.join(', ')} returned to ${lendTeam?.name}`,
          details: 'Automatic return after 4th game · Parent club eligibility restored',
          timestamp: nowIso,
        });
      }
    }

    if (match.stage === 'Semifinal') {
      const winnerId =
        match.homeScore > match.awayScore ? match.homeTeamId : match.awayTeamId;
      const winnerName =
        match.homeScore > match.awayScore ? match.homeTeamName : match.awayTeamName;
      const finalMatch = db.matches.find(
        (m) => m.leagueId === match.leagueId && m.stage === 'Final'
      );
      if (finalMatch) {
        if (match.bracketSlot === 'SF1') {
          finalMatch.homeTeamId = winnerId;
          finalMatch.homeTeamName = winnerName.replace(/\s*\(#\d+\)/, '');
        } else if (match.bracketSlot === 'SF2') {
          finalMatch.awayTeamId = winnerId;
          finalMatch.awayTeamName = winnerName.replace(/\s*\(#\d+\)/, '');
        }
      }
    }

    saveDatabase(db);
    res.json(db);
  });

  app.post('/api/admin/advance-cooldowns', (_req, res) => {
    const fourDaysAgo = daysAgoIso(4);
    for (const p of db.players) {
      p.lastMarketActionAt = fourDaysAgo;
    }
    for (const t of db.teams) {
      if (t.lastLifelineRequestAt) {
        t.lastLifelineRequestAt = fourDaysAgo;
      }
    }
    saveDatabase(db);
    res.json(db);
  });

  // Co-Ed Champion of Champions Super Cup Admin & Bracket Progression
  app.patch('/api/super-cup', (req, res) => {
    const body = req.body as Partial<ChampionsCupConfig>;
    const prevLinked = JSON.stringify(db.championsCup.linkedLeagueIds);
    Object.assign(db.championsCup, body);
    if (body.linkedLeagueIds && JSON.stringify(body.linkedLeagueIds) !== prevLinked) {
      const seeds = computeChampionsCupSeeds(
        db.championsCup.linkedLeagueIds,
        db.leagues,
        db.teams,
        db.matches
      );
      db.championsCup.matches = generateAutoScaledCupMatches(seeds);
    }
    saveDatabase(db);
    res.json(db);
  });

  app.post('/api/super-cup/generate-bracket', (_req, res) => {
    const seeds = computeChampionsCupSeeds(
      db.championsCup.linkedLeagueIds,
      db.leagues,
      db.teams,
      db.matches
    );
    db.championsCup.matches = generateAutoScaledCupMatches(seeds);
    saveDatabase(db);
    res.json(db);
  });

  app.post('/api/super-cup/matches/:matchId/result', (req, res) => {
    const match = db.championsCup.matches.find((m) => m.id === req.params.matchId);
    if (!match) return res.status(404).json({ error: 'Champions Cup match not found' });
    const { homeScore, awayScore } = req.body as { homeScore: number; awayScore: number };
    const h = Number(homeScore);
    const a = Number(awayScore);
    if (h === a) {
      return res.status(400).json({ error: 'Knockout match cannot end in a draw (enter penalty winner score).' });
    }
    match.homeScore = h;
    match.awayScore = a;
    match.status = 'Final';

    const homeWon = h > a;
    const winId = homeWon ? match.homeTeamId : match.awayTeamId;
    const winName = homeWon ? match.homeTeamName : match.awayTeamName;
    const winSeed = homeWon ? match.homeSeed : match.awaySeed;
    const winDiv = homeWon ? match.homeDivisionLabel : match.awayDivisionLabel;

    if (match.round === 'Quarterfinal') {
      const qfNum = match.id.replace('cup_qf_', '');
      const targetSf = db.championsCup.matches.find((m) => m.awayTeamId === `TBD_QF${qfNum}`);
      if (targetSf) {
        targetSf.awayTeamId = winId;
        targetSf.awayTeamName = winName;
        targetSf.awaySeed = winSeed;
        targetSf.awayDivisionLabel = winDiv;
      }
    } else if (match.round === 'Semifinal') {
      const finalMatch = db.championsCup.matches.find((m) => m.round === 'Final');
      if (finalMatch) {
        if (match.id === 'cup_sf_1' && finalMatch.homeTeamId === 'TBD_SF1') {
          finalMatch.homeTeamId = winId;
          finalMatch.homeTeamName = winName;
          finalMatch.homeSeed = winSeed;
          finalMatch.homeDivisionLabel = winDiv;
        } else if (match.id === 'cup_sf_1' && finalMatch.awayTeamId === 'TBD_SF1') {
          finalMatch.awayTeamId = winId;
          finalMatch.awayTeamName = winName;
          finalMatch.awaySeed = winSeed;
          finalMatch.awayDivisionLabel = winDiv;
        } else if (match.id === 'cup_sf_2') {
          finalMatch.awayTeamId = winId;
          finalMatch.awayTeamName = winName;
          finalMatch.awaySeed = winSeed;
          finalMatch.awayDivisionLabel = winDiv;
        }
      }
    }

    saveDatabase(db);
    res.json(db);
  });

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API route not found.' });
  });

  if (!process.env.VERCEL) {
    if (process.env.NODE_ENV !== 'production') {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.join(__dirname, 'dist');
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  return app;
}

if (!process.env.VERCEL) {
  void createApp()
    .then((app) =>
      app.listen(PORT, '0.0.0.0', () => {
        console.log(`Ball Out Soccer server running at http://localhost:${PORT}`);
      })
    )
    .catch((error: unknown) => {
      console.error('Failed to start Ball Out Soccer server.', error);
      process.exitCode = 1;
    });
}
