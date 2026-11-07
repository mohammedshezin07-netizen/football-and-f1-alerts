export type SportType = 'FOOTBALL' | 'F1';
export type TimeWindow = 'PAST_RESULTS' | 'THIS_WEEK' | 'NEXT_WEEK' | 'ALL_UPCOMING';
export type SportFilter = 'ALL' | 'FOOTBALL' | 'F1';
export type ClashFilterMode =
  | 'MCI_SAN_ONLY'
  | 'FOLLOWED_ONLY'
  | 'CUSTOM_TEAMS'
  | 'ALL_MATCHES';
export type ClashTypeMode =
  | 'ALL_CLASHES'
  | 'FOOTBALL_VS_FOOTBALL'
  | 'FOOTBALL_VS_F1';
export type AlarmSoundProfile = 'BROADCAST_CHIME' | 'F1_PIT_SIREN' | 'SILENT_HAPTIC';
export type AlarmLeadTime = 0 | 15 | 30; // minutes before start

export interface FootballStandingRow {
  position: number;
  rank?: number;
  teamCode: string;
  teamName: string;
  teamLogo: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: string;
  points: number;
  deductionPoints?: number;
  deductionNote?: string;
  form: ('W' | 'D' | 'L')[];
  qualificationZone?: 'CHAMPIONS_LEAGUE' | 'LIBERTADORES' | 'EUROPA' | 'RELEGATION' | 'PLAYOFF';
  zone?: 'CHAMPIONS_LEAGUE' | 'LIBERTADORES' | 'EUROPA' | 'RELEGATION' | 'PLAYOFF';
}

export interface FootballLeagueTable {
  id: string;
  espnSlug?: string;
  seasonYear?: number;
  leagueName: string;
  name?: string;
  shortName: string;
  country: string;
  seasonLabel: string;
  season?: string;
  competitionLogo: string;
  matchweekLabel: string;
  verifiedAtIST?: string;
  rows: FootballStandingRow[];
}

export interface F1DriverStandingRow {
  position: number;
  rank?: number;
  driverId: string;
  driverCode: string;
  driverName: string;
  driverNumber: number;
  nationality: string;
  flagUrl: string;
  countryFlagUrl?: string;
  headshotUrl?: string;
  ergastDriverId?: string;
  rosterStatus?: 'ACTIVE' | 'RESERVE' | 'FORMER';
  status?: string;
  replacedByCode?: string;
  constructorCode: string;
  constructorName: string;
  constructorLogo: string;
  constructorColor: string;
  wins: number;
  podiums: number;
  poles: number;
  fastestLaps?: number;
  points: number;
  gapToLeader?: string;
}

export interface F1RosterTransferEvent {
  id: string;
  dateLabel: string;
  effectiveRound?: string;
  driverName: string;
  driverCode: string;
  driverNumber: number;
  headshotUrl: string;
  changeType: 'TRANSFER' | 'ROOKIE_PROMOTION' | 'RESERVE_CALLUP' | 'CONTRACT_TERMINATION';
  fromTeam?: string;
  previousTeam?: string;
  toTeam: string;
  newTeam?: string;
  toTeamColor: string;
  summary: string;
}

export interface F1ConstructorStandingRow {
  position: number;
  rank?: number;
  constructorCode: string;
  constructorName: string;
  shortName: string;
  constructorLogo: string;
  constructorColor: string;
  drivers: string[];
  wins: number;
  podiums: number;
  poles: number;
  fastestLaps: number;
  points: number;
  gapToLeader: string;
}

export interface TeamInfo {
  id: string;
  name: string;
  shortName: string;
  code: string;
  sport: SportType;
  logoUrl: string;
  primaryColor: string;
  competition?: string;
}

export interface FootballPlayerStats {
  id: string;
  name: string;
  teamCode: string;
  teamName: string;
  teamLogo: string;
  position: 'FWD' | 'MID' | 'DEF' | 'GK';
  shirtNumber: number;
  rating: string;
  minutesPlayed: number;
  goals: number;
  assists: number;
  passesCompleted: number;
  passesAttempted: number;
  passAccuracy: string;
  keyPasses: number;
  shotsOnTarget: number;
  xG: string;
  xA: string;
  touches: number;
  tacklesWon: number;
  duelsWon: number;
  seasonGoals: number;
  seasonAssists: number;
  heatmapZone: string;
}

export interface F1DriverCareerStats {
  id: string;
  code: string;
  name: string;
  number: number;
  nationality: string;
  flagUrl: string;
  countryFlagUrl?: string;
  headshotUrl?: string;
  ergastDriverId?: string;
  rosterStatus?: 'ACTIVE' | 'RESERVE' | 'FORMER';
  status?: string;
  constructorName: string;
  constructorCode: string;
  constructorLogo: string;
  constructorColor: string;
  championships: number;
  worldChampionships?: number;
  careerWins: number;
  careerPoles: number;
  careerPodiums: number;
  careerPoints: string | number;
  fastestLaps: number;
  grandsPrixEntered: number;
  seasonPosition: number;
  seasonPoints: number;
  seasonWins?: number;
  seasonPodiums?: number;
  seasonPoles?: number;
  sprintPoints?: number;
  dnfs?: number;
  highestRaceFinish?: string;
  highestGridPosition?: string;
  dateOfBirth?: string;
  placeOfBirth?: string;
  age?: number;
  championshipStanding?: string;
  sector1: string;
  sector2: string;
  sector3: string;
  topSpeedKph: number;
}

export interface FootballMatch {
  id: string;
  sport: 'FOOTBALL';
  competition: string;
  competitionLogo: string;
  matchweek: string;
  timeWindow: TimeWindow;
  homeTeam: {
    id: string;
    name: string;
    code: string;
    logo: string;
    form: ('W' | 'D' | 'L')[];
  };
  awayTeam: {
    id: string;
    name: string;
    code: string;
    logo: string;
    form: ('W' | 'D' | 'L')[];
  };
  startTimeISO: string; // ISO string in UTC
  istDateLabel: string; // e.g. "SUN, 08 NOV"
  istTimeLabel: string; // e.g. "10:30 PM IST" or "TBD"
  stadiumLocalTimeLabel: string; // e.g. "05:00 PM GMT" or "Time Not Declared (TBD)"
  isTimeTBD?: boolean; // true when official kickoff time is not yet declared by the league (e.g. CBF Rodada 37/38)
  venue: string;
  city: string;
  durationMinutes: number;
  liveStatus?: 'UPCOMING' | 'LIVE' | 'FINAL';
  liveMinute?: string;
  homeScore?: number;
  awayScore?: number;
  scorersSummary?: string;
  prefetchMeta: {
    referee: string;
    weather: string;
    winProbability: { home: number; draw: number; away: number };
    headToHeadSummary: string;
    keyPlayersToWatch: string[];
  };
}

export interface F1Session {
  id: string;
  name: 'FP1' | 'Sprint Qualifying' | 'FP2' | 'Sprint' | 'FP3' | 'Qualifying' | 'Grand Prix';
  shortLabel: string;
  startTimeISO: string;
  istDateLabel: string;
  istTimeLabel: string;
  trackLocalTimeLabel: string;
  durationMinutes: number;
  status?: 'UPCOMING' | 'LIVE' | 'COMPLETED';
}

export type CircuitSvgId =
  | 'bahrain'
  | 'jeddah'
  | 'albert_park'
  | 'suzuka'
  | 'shanghai'
  | 'miami'
  | 'imola'
  | 'monaco'
  | 'montreal'
  | 'barcelona'
  | 'red_bull_ring'
  | 'silverstone'
  | 'hungaroring'
  | 'spa'
  | 'zandvoort'
  | 'monza'
  | 'baku'
  | 'marina_bay'
  | 'cota'
  | 'mexico'
  | 'interlagos'
  | 'vegas'
  | 'lusail'
  | 'yas_marina'
  | 'portimao'
  | 'madrid'
  | 'istanbul';

export interface F1Weekend {
  id: string;
  sport: 'F1';
  seasonYear?: 2025 | 2026 | 2027;
  round: number;
  hostName?: string;
  countryName?: string;
  dateRangePill?: string;
  dateRangeLabel?: string;
  trackMapUrl?: string;
  isSprintWeekend?: boolean;
  isProvisional2027?: boolean;
  isTesting?: boolean;
  isNextRace?: boolean;
  status?: 'UPCOMING' | 'LIVE' | 'COMPLETED';
  winnerSummary?: string;
  grandPrixName: string;
  officialTitle: string;
  circuitName: string;
  city: string;
  countryFlagUrl: string;
  circuitSvgId: CircuitSvgId;
  laps: number;
  circuitLengthKm: string;
  raceDistanceKm: string;
  timeWindow: TimeWindow;
  sessions: F1Session[];
  prefetchMeta: {
    trackTempForecast: string;
    rainChance: string;
    tyreAllocation: string;
    lapRecord: string;
    drsZones: number;
    circuitLengthKm?: string;
    raceDistanceLaps?: number | string;
  };
}

export interface ClashPair {
  id: string;
  clashType?: 'FOOTBALL_VS_F1' | 'FOOTBALL_VS_FOOTBALL';
  isCompleted?: boolean;
  footballMatchId: string;
  f1WeekendId: string;
  f1SessionId: string;
  secondFootballMatchId?: string;
  overlapWindowIST: string;
  description: string;
  footballInfo: {
    competition: string;
    competitionLogo: string;
    homeCode: string;
    homeName: string;
    homeLogo: string;
    awayCode: string;
    awayName: string;
    awayLogo: string;
    istTime12h: string;
    istDateLabel: string;
    startTimeISO: string;
    venue: string;
    isTimeTBD?: boolean;
    homeScore?: number;
    awayScore?: number;
    liveStatus?: 'UPCOMING' | 'LIVE' | 'FINAL';
  };
  secondFootballInfo?: {
    competition: string;
    competitionLogo: string;
    homeCode: string;
    homeName: string;
    homeLogo: string;
    awayCode: string;
    awayName: string;
    awayLogo: string;
    istTime12h: string;
    istDateLabel: string;
    startTimeISO: string;
    venue: string;
    isTimeTBD?: boolean;
    homeScore?: number;
    awayScore?: number;
    liveStatus?: 'UPCOMING' | 'LIVE' | 'FINAL';
  };
  f1Info: {
    grandPrixName: string;
    sessionName: string;
    sessionShortLabel: string;
    countryFlagUrl: string;
    f1LogoUrl: string;
    circuitName: string;
    istTime12h: string;
    istDateLabel: string;
    startTimeISO: string;
  };
}

export interface ArmedAlarm {
  id: string; // matches matchId or sessionId
  parentId?: string; // F1 weekend id if session
  sport: SportType;
  title: string;
  subtitle: string;
  eventStartTimeISO: string;
  istTimeLabel: string;
  leadTimeMinutes: AlarmLeadTime;
  soundProfile: AlarmSoundProfile;
  customLabel: string;
  createdAtISO: string;
}

export interface PrefetchCacheEntry {
  eventId: string;
  sport: SportType;
  cachedAtISO: string;
  source: 'SEED_CACHE' | 'PREFETCH_ENGINE' | 'FORCE_SYNC';
  payloadSummary: string;
  details: Record<string, string | number | string[]>;
}

export interface LiveFootballState {
  id: string;
  competition: string;
  competitionLogo: string;
  stage: string;
  venue: string;
  minute: number;
  second: number;
  status: 'LIVE 2ND HALF' | 'HT' | 'FT';
  homeTeam: {
    name: string;
    code: string;
    logo: string;
    score: number;
    xG: string;
    possession: number;
    shots: number;
    shotsOnTarget: number;
    corners: number;
    fouls: number;
    scorers: { playerId: string; playerName: string; minute: string }[];
  };
  awayTeam: {
    name: string;
    code: string;
    logo: string;
    score: number;
    xG: string;
    possession: number;
    shots: number;
    shotsOnTarget: number;
    corners: number;
    fouls: number;
    scorers: { playerId: string; playerName: string; minute: string }[];
  };
  keyPlayers: FootballPlayerStats[];
  commentary: {
    id: string;
    minute: string;
    type: 'GOAL' | 'CHANCE' | 'CARD' | 'SUB' | 'INFO';
    text: string;
    playerId?: string;
    playerName?: string;
  }[];
}

export interface ClashDetectorSettings {
  enabled: boolean;
  filterMode: ClashFilterMode;
  clashTypeMode?: ClashTypeMode;
  customTeamCodes?: string[];
  keySessionsOnly: boolean;
  bufferMinutes: 0 | 15 | 30;
  dismissedClashIds: string[];
}

export type TyreCompound = 'S' | 'M' | 'H' | 'I' | 'W';

export interface LiveF1DriverRow {
  position: number;
  driverId: string;
  driverCode: string;
  driverName: string;
  driverNumber: number;
  constructorName: string;
  constructorCode: string;
  constructorLogo: string;
  constructorColor: string;
  gapToLeader: string;
  interval: string;
  lastLapTime: string;
  bestLapTime: string;
  tyreCompound: TyreCompound;
  tyreAgeLaps: number;
  lastStintRange?: string;
  stintHistory?: string;
  pitStops: number;
  hasFastestLap?: boolean;
}

export interface LiveF1State {
  id: string;
  grandPrixName: string;
  circuitName: string;
  countryFlagUrl: string;
  circuitSvgId: CircuitSvgId;
  sessionName: string;
  currentLap: number;
  totalLaps: number;
  trackStatus: 'GREEN FLAG' | 'SAFETY CAR' | 'DRS ENABLED' | 'TRACK CLEAR';
  airTempC: number;
  trackTempC: number;
  humidityPct: number;
  drivers: LiveF1DriverRow[];
  driverCareerRegistry: Record<string, F1DriverCareerStats>;
}

export interface FootballArchiveItem {
  id: string;
  sport: 'FOOTBALL';
  competition: string;
  competitionLogo: string;
  matchweek: string;
  dateIST: string;
  venue: string;
  homeTeam: {
    name: string;
    code: string;
    logo: string;
    score: number;
    xG: string;
  };
  awayTeam: {
    name: string;
    code: string;
    logo: string;
    score: number;
    xG: string;
  };
  stats: {
    possession: [number, number];
    bigChances: [number, number];
    passingAccuracy: [string, string];
    shotsOnTarget: [number, number];
    corners: [number, number];
    fouls: [number, number];
  };
  timeline: {
    minute: string;
    teamCode: string;
    type: 'GOAL' | 'YELLOW' | 'RED' | 'SUB';
    player: string;
    detail: string;
  }[];
  highlights: {
    durationSeconds: number;
    markers: {
      id: string;
      second: number;
      minuteStamp: string;
      label: string;
      description: string;
    }[];
  };
}

export interface F1ArchiveItem {
  id: string;
  sport: 'F1';
  grandPrixName: string;
  circuitName: string;
  countryFlagUrl: string;
  circuitSvgId: CircuitSvgId;
  dateIST: string;
  laps: number;
  podium: {
    position: 1 | 2 | 3;
    driverName: string;
    driverCode: string;
    constructorName: string;
    constructorLogo: string;
    constructorColor: string;
    timeOrGap: string;
  }[];
  classificationTop10: {
    pos: number;
    driverCode: string;
    driverName: string;
    constructorName: string;
    constructorLogo: string;
    constructorColor: string;
    gap: string;
    points: number;
    stints: { compound: TyreCompound; range: string }[];
  }[];
  fastestLap: {
    driverName: string;
    driverCode: string;
    lapNumber: number;
    time: string;
  };
  gridPenalties: string[];
  teamRadioHighlights: {
    id: string;
    lap: string;
    driverCode: string;
    driverName: string;
    constructorColor: string;
    transcript: string;
    durationSec: number;
  }[];
}

export type ArchiveItem = FootballArchiveItem | F1ArchiveItem;
