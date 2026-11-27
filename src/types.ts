export type LeagueFormat = '5v5' | '6v6' | '7v7' | '11v11';
export type LeagueDivision = 'Co-Ed';
export type SkillLevel = 'Recreational' | 'Intermediate' | 'Competitive' | 'Premier';
export type PlayerPosition = 'GK' | 'DEF' | 'MID' | 'FWD';
export type MarketMode = 'Swap Transfer' | '4-Game Loan' | 'Both';
export type LeagueStatus = 'TESTING' | 'OPEN' | 'LIVE' | 'COMPLETED';
export type LeagueType = 'League' | 'Tournament';
export type RegistrationStatus = 'Pending Payment' | 'Complete';

export interface BrandConfig {
  siteName: string;
  tagline: string;
  aboutText: string;
  rulesSummary: string;
  primaryColor: string;
  accentColor: string;
  bannerEnabled: boolean;
  bannerText: string;
  adminPin: string;
}

export interface Venue {
  id: string;
  city: string;
  region?: string;
  country?: string;
  name: string;
  address: string;
  neighborhood: string;
  indoorOutdoor?: 'Indoor Dome' | 'Outdoor Turf';
  surface: string;
  fields: string[];
  mapsUrl?: string;
}

export interface PrizeTier {
  minTeams: number;
  prizeLabel: string;
  prizeAmount: number;
}

export interface League {
  id: string;
  name: string;
  city: string;
  region?: string;
  country?: string;
  description?: string;
  rulesSummary?: string;
  leagueType: LeagueType;
  status: LeagueStatus;
  venueId: string;
  locationName: string;
  dayOfWeek: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
  format: LeagueFormat;
  division: LeagueDivision;
  skillLevel: SkillLevel;
  entryFeeTeam: number;
  entryFeeSolo: number;
  maxTeams: number;
  rosterMaxCap: number;
  coedMaleCap: number;
  coedFemaleCap: number;
  autoFlipEnabled: boolean;
  deadlineHoursRemaining?: number;
  gameWeeks: number;
  gamesPerWeek: 1 | 2;
  currentWeek: number;
  totalWeeks: number;
  transferDeadlineWeek: number;
  transferExtensionWeeks?: number;
  gameDurationMins: number;
  playoffMinGames: number;
  rosterLocked: boolean;
  isPlayoffsActive: boolean;
  requireAdminTransferSignOff: boolean;
  customPrizeText: string;
  dynamicPrizeScaling: boolean;
  prizeTiers: PrizeTier[];
  imageUrl: string;
  startDate: string;
  matchTimeWindow: string;
}

export interface TeamStandbyEntry {
  id: string;
  name: string;
  email: string;
  gender: 'Male' | 'Female';
  position: PlayerPosition;
  createdAt: string;
}

export interface Team {
  id: string;
  leagueId: string;
  name: string;
  tag?: string;
  captainId: string;
  captainName: string;
  viceCaptainId?: string;
  kitColor: string;
  kitColorName?: string;
  awayKitColor?: string;
  awayKitColorName?: string;
  badgeStyle?: 'Shield' | 'Circle' | 'Diamond' | 'Hexagon';
  badgeUrl?: string;
  bio?: string;
  rosterLimit: number;
  customMaleCap?: number;
  customFemaleCap?: number;
  autoFlippedCoEd?: boolean;
  lineupPositions?: Record<string, string>;
  standbyWaitlist?: TeamStandbyEntry[];
  splitPayCode: string;
  splitTargetPlayers: number;
  totalFee: number;
  amountPaid: number;
  paymentMode: 'full' | 'split';
  registrationStatus?: RegistrationStatus;
  registrationCompletedAt?: string;
  lastReminderAt?: string;
  lastLifelineRequestAt?: string;
  teamMarketListing?: TeamMarketListing | null;
}

export interface TeamMarketListing {
  positionNeeded: PlayerPosition;
  positionOffered: PlayerPosition;
  availabilityNotes: string;
  listedAt: string;
}

export interface MarketListing {
  mode: MarketMode;
  preferredPosition: PlayerPosition;
  availabilityNotes: string;
  listedAt: string;
}

export interface Player {
  id: string;
  name: string;
  email: string;
  teamId: string;
  leagueId: string;
  position: PlayerPosition;
  gender?: 'Female' | 'Male' | 'Non-Binary';
  jerseyNumber?: number;
  isViceCaptain?: boolean;
  isFreeAgent?: boolean;
  skillRating: string;
  isCaptain: boolean;
  gamesPlayed: number;
  goals: number;
  assists: number;
  cleanSheets?: number;
  wins?: number;
  yellowCards: number;
  redCards: number;
  suspendedNextMatch?: boolean;
  motmAwards?: number;
  isTeamDriver?: boolean;
  availableToSub?: boolean;
  joinedTeamAt: string;
  lastMarketActionAt: string;
  marketListing: MarketListing | null;
  loansUsedThisSeason: number;
  activeLoanId: string | null;
  waiverSigned: boolean;
  waiverSignedAt?: string;
  waiverSignatureName?: string;
  registrationPaidAmount?: number;
  paidByPlayerId?: string;
  registrationStatus?: RegistrationStatus;
  registrationCompletedAt?: string;
}

export interface MatchEvent {
  id: string;
  playerId: string;
  playerName: string;
  teamId: string;
  type: 'Goal' | 'Yellow' | 'Red';
  minute?: number;
}

export interface Match {
  id: string;
  leagueId: string;
  week: number;
  stage: 'Regular' | 'Group' | 'Quarterfinal' | 'Semifinal' | 'Final';
  bracketSlot?: string;
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  fieldNumber: string;
  scheduledDate: string;
  scheduledTime: string;
  firstHalfMins?: number;
  halftimeMins?: number;
  secondHalfMins?: number;
  endTime?: string;
  status: 'Scheduled' | 'Final';
  homeScore: number | null;
  awayScore: number | null;
  events: MatchEvent[];
  loanAppearancePlayerIds: string[];
  hypeCount?: number;
  hypeUpdatedAt?: string;
  matchOfNight?: boolean;
}

export interface TeamRosterOpening {
  id: string;
  leagueId: string;
  teamId: string;
  teamName: string;
  position: PlayerPosition;
  gender: 'Male' | 'Female';
  fee: number;
  gamesRemaining: number;
  status: 'Open' | 'Filled' | 'Closed';
  createdAt: string;
  filledByPlayerId?: string;
}

export interface MatchPressConference {
  matchId: string;
  teamId: string;
  teamName: string;
  captainId: string;
  captainName: string;
  statement: string;
  createdAt: string;
}

export interface MatchReaction {
  matchId: string;
  teamId: string;
  playerId: string;
  playerName: string;
  emoji: '🔥' | '👏' | '💪' | '😮' | '❤️';
  createdAt: string;
}

export interface TeamAchievement {
  id: string;
  leagueId: string;
  teamId: string;
  matchId?: string;
  title: string;
  description: string;
  points: number;
  badge: string;
  createdAt: string;
}

export interface LoanGameLog {
  matchId: string;
  playerId: string;
  playerName: string;
  date: string;
}

export interface TransferOrLoanRequest {
  id: string;
  kind: 'swap' | 'loan';
  leagueId: string;
  status: 'Pending' | 'Active' | 'Completed' | 'Rejected' | 'Cancelled';
  createdAt: string;
  completedAt?: string;
  initiatedByPlayerId: string;
  initiatedByName: string;
  isStrugglingTeamLifeline: boolean;
  note?: string;
  fromTeamId?: string;
  toTeamId?: string;
  offeredPlayerId?: string;
  requestedPlayerId?: string;
  swapApprovals?: {
    requestingCaptain: boolean;
    targetCaptain: boolean;
    offeredPlayer: boolean;
    requestedPlayer: boolean;
    admin: boolean;
  };
  borrowingTeamId?: string;
  lendingTeamId?: string;
  loanMode?: 'single' | 'rotating';
  loanPlayerIds?: string[];
  gamesTotal?: number;
  gamesRemaining?: number;
  gameLogs?: LoanGameLog[];
  loanApprovals?: {
    borrowingCaptain: boolean;
    lendingCaptain: boolean;
    playersAccepted: Record<string, boolean>;
    admin: boolean;
  };
}

export interface DoneDeal {
  id: string;
  leagueId: string;
  kind: 'swap' | 'loan' | 'loan_return' | 'free_agent' | 'sub';
  summary: string;
  details: string;
  timestamp: string;
}

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: 'Founder / Super Admin' | 'COO' | 'League Manager' | 'Referee / Scorekeeper' | 'Worker / Field Staff';
  permissions: string[];
  inviteCode: string;
  status: 'Active' | 'Invited';
  createdAt: string;
}

export interface Partner {
  id: string;
  name: string;
  category: 'Turf Venue' | 'Local Sponsor' | 'Equipment & Apparel' | 'Media Partner';
  tagline: string;
  promoUrl: string;
  contactEmail?: string;
  status: 'Approved' | 'Pending';
}

export interface PromoCode {
  id: string;
  code: string;
  discountAmount: number;
  description: string;
  active: boolean;
  uses: number;
}

export interface WaitlistEntry {
  id: string;
  leagueId: string;
  name: string;
  email: string;
  entryType: 'Team Captain' | 'Solo Player';
  createdAt: string;
}

export interface RideChatMessage {
  id: string;
  senderName: string;
  text: string;
  timestamp: string;
}

export interface RideRequest {
  id: string;
  leagueId: string;
  venueName: string;
  matchDate: string;
  matchTime: string;
  riderPlayerId: string;
  riderName: string;
  riderTeamName: string;
  landmarkType: 'Gas Station' | 'Subway / GO Station' | 'Bus Stop' | 'Plaza / Tim Hortons';
  landmarkName: string;
  detourEstimate: string;
  status: 'Open' | 'Accepted' | 'On My Way' | 'At Pickup Spot' | 'Picked Up';
  driverPlayerId?: string;
  driverName?: string;
  seatsAvailable?: number;
  costOption?: 'Free Lift' | 'Split Gas ($5)';
  messages: RideChatMessage[];
  createdAt: string;
}

export interface TeamChatMessage {
  id: string;
  teamId: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: string;
}

export interface DirectMessage {
  id: string;
  fromPlayerId: string;
  fromName: string;
  toPlayerId: string;
  toName: string;
  text: string;
  timestamp: string;
}

export interface MatchRsvp {
  matchId: string;
  teamId: string;
  playerId: string;
  playerName: string;
  status: 'IN' | 'OUT' | 'MAYBE';
}

export interface TeamPoll {
  id: string;
  teamId: string;
  question: string;
  createdByName: string;
  options: { id: string; label: string; voterIds: string[] }[];
  createdAt: string;
}

export interface OpponentChatMessage {
  id: string;
  matchId: string;
  senderPlayerId: string;
  senderName: string;
  teamName: string;
  text: string;
  reported?: boolean;
  timestamp: string;
}

export interface SubRequest {
  id: string;
  leagueId: string;
  matchId: string;
  teamId: string;
  teamName: string;
  matchDate: string;
  matchTime: string;
  fieldLocation: string;
  positionNeeded: PlayerPosition | 'ANY';
  skillLevel: SkillLevel;
  subFee: string;
  status: 'Open' | 'Claimed';
  claimedByPlayerId?: string;
  claimedByName?: string;
  createdAt: string;
}

export interface MotmVote {
  matchId: string;
  teamId: string;
  voterPlayerId: string;
  nomineePlayerId: string;
}

export interface ChampionsCupMatch {
  id: string;
  round: 'Quarterfinal' | 'Semifinal' | 'Final';
  bracketSlot: string;
  homeSeed: number | null;
  awaySeed: number | null;
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  homeDivisionLabel: string;
  awayDivisionLabel: string;
  fieldNumber: string;
  scheduledDate: string;
  scheduledTime: string;
  status: 'Scheduled' | 'Final';
  homeScore: number | null;
  awayScore: number | null;
}

export interface ChampionsCupConfig {
  id: string;
  name: string;
  seasonLabel: string;
  enabled: boolean;
  linkedLeagueIds: string[];
  bonusPrizeText: string;
  minFemaleOnField: number;
  enforceGenderRatio: boolean;
  lockRostersToRegularSeason: boolean;
  minRegularSeasonGames: number;
  matches: ChampionsCupMatch[];
}

export interface StandingRow {
  teamId: string;
  teamName: string;
  kitColor: string;
  rank: number;
  gp: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  gd: number;
  pts: number;
  isStrugglingLifeline: boolean;
  isPlayoffSpot: boolean;
}

export interface TeamInvite {
  id: string;
  teamId: string;
  teamName: string;
  leagueId: string;
  leagueName: string;
  invitedPlayerId?: string;
  invitedName: string;
  invitedEmail?: string;
  invitedGender: 'Male' | 'Female';
  position: PlayerPosition;
  isPaidInFullFreeJoin: boolean;
  status: 'Pending' | 'Accepted' | 'Declined';
  createdAt: string;
}

export interface FreeAgentFriendInvite {
  id: string;
  leagueId: string;
  leagueName: string;
  inviterPlayerId: string;
  inviterName: string;
  inviterTeamId: string;
  friendName: string;
  friendEmail?: string;
  friendGender: 'Male' | 'Female';
  friendPosition: PlayerPosition;
  selfFee: number;
  friendFee: number;
  totalIfAccepted: number;
  status: 'Pending' | 'Accepted' | 'Declined';
  createdAt: string;
  acceptedAt?: string;
}

export interface LeagueDatabase {
  brand: BrandConfig;
  cities: string[];
  venues: Venue[];
  leagues: League[];
  teams: Team[];
  players: Player[];
  matches: Match[];
  transfers: TransferOrLoanRequest[];
  doneDeals: DoneDeal[];
  staff: StaffMember[];
  partners: Partner[];
  promoCodes: PromoCode[];
  waitlist: WaitlistEntry[];
  rides: RideRequest[];
  teamMessages: TeamChatMessage[];
  directMessages: DirectMessage[];
  rsvps: MatchRsvp[];
  polls: TeamPoll[];
  opponentMessages: OpponentChatMessage[];
  mutedPlayerIds: string[];
  subRequests: SubRequest[];
  motmVotes: MotmVote[];
  championsCup: ChampionsCupConfig;
  teamInvites: TeamInvite[];
  freeAgentInvites: FreeAgentFriendInvite[];
  rosterOpenings?: TeamRosterOpening[];
  pressConferences?: MatchPressConference[];
  matchReactions?: MatchReaction[];
  teamAchievements?: TeamAchievement[];
  schemaVersion?: number;
}
