import {
  F1ConstructorStandingRow,
  F1DriverStandingRow,
  FootballLeagueTable,
} from '../types/sports';
import { COMPETITION_LOGOS } from './logos';

/**
 * Clean League Descriptor Registry (Zero hardcoded / mock point totals or rows).
 * All standings rows are fetched live from the official keyless ESPN Public API:
 * `https://site.web.api.espn.com/apis/v2/sports/soccer/{leagueSlug}/standings?season={year}`
 * and validated through `src/utils/dataValidator.ts` before rendering or caching.
 */
export const SUPPORTED_FOOTBALL_LEAGUE_CONFIGS: Array<{
  id: string;
  espnSlug: string;
  leagueName: string;
  name: string;
  shortName: string;
  country: string;
  competitionLogo: string;
  defaultSeasonYear: number;
  expectedClubCount?: number;
}> = [
  {
    id: 'league-pl',
    espnSlug: 'eng.1',
    leagueName: 'Premier League',
    name: 'Premier League',
    shortName: 'Premier League',
    country: 'England',
    competitionLogo: COMPETITION_LOGOS.PL,
    defaultSeasonYear: 2026,
    expectedClubCount: 20,
  },
  {
    id: 'league-isl',
    espnSlug: 'ind.1',
    leagueName: 'Indian Super League',
    name: 'Indian Super League',
    shortName: 'ISL',
    country: 'India',
    competitionLogo: COMPETITION_LOGOS.ISL,
    defaultSeasonYear: 2026,
  },
  {
    id: 'league-ucl',
    espnSlug: 'uefa.champions',
    leagueName: 'UEFA Champions League',
    name: 'UEFA Champions League',
    shortName: 'UCL',
    country: 'Europe',
    competitionLogo: COMPETITION_LOGOS.UCL,
    defaultSeasonYear: 2026,
  },
  {
    id: 'league-laliga',
    espnSlug: 'esp.1',
    leagueName: 'La Liga EA Sports',
    name: 'La Liga EA Sports',
    shortName: 'La Liga',
    country: 'Spain',
    competitionLogo: COMPETITION_LOGOS.LALIGA,
    defaultSeasonYear: 2026,
    expectedClubCount: 20,
  },
  {
    id: 'league-seriea',
    espnSlug: 'ita.1',
    leagueName: 'Serie A Enilive',
    name: 'Serie A Enilive',
    shortName: 'Serie A',
    country: 'Italy',
    competitionLogo: COMPETITION_LOGOS.SERIEA,
    defaultSeasonYear: 2026,
    expectedClubCount: 20,
  },
  {
    id: 'league-bundesliga',
    espnSlug: 'ger.1',
    leagueName: 'Bundesliga',
    name: 'Bundesliga',
    shortName: 'Bundesliga',
    country: 'Germany',
    competitionLogo: COMPETITION_LOGOS.BUNDESLIGA,
    defaultSeasonYear: 2026,
    expectedClubCount: 18,
  },
  {
    id: 'brasileirao-2026',
    espnSlug: 'bra.1',
    leagueName: 'Campeonato Brasileiro Série A',
    name: 'Brasileirão Série A',
    shortName: 'Brasileirão',
    country: 'Brazil',
    competitionLogo: COMPETITION_LOGOS.BRASILEIRAO,
    defaultSeasonYear: 2026,
    expectedClubCount: 20,
  },
];

export const FOOTBALL_LEAGUE_TABLES: FootballLeagueTable[] =
  SUPPORTED_FOOTBALL_LEAGUE_CONFIGS.map((cfg) => ({
    id: cfg.id,
    espnSlug: cfg.espnSlug,
    seasonYear: cfg.defaultSeasonYear,
    leagueName: cfg.leagueName,
    name: cfg.name,
    shortName: cfg.shortName,
    country: cfg.country,
    seasonLabel: 'Syncing official league table...',
    season: 'Syncing official league table...',
    competitionLogo: cfg.competitionLogo,
    matchweekLabel: 'Live ESPN Standings',
    rows: [],
  }));

export const PREMIER_LEAGUE_2025_26_FINAL_TABLE: FootballLeagueTable = {
  id: 'league-pl-2025',
  espnSlug: 'eng.1',
  seasonYear: 2025,
  leagueName: 'Premier League (2025/26)',
  name: 'Premier League',
  shortName: 'Premier League',
  country: 'England',
  seasonLabel: 'Syncing official league table...',
  season: 'Syncing official league table...',
  competitionLogo: COMPETITION_LOGOS.PL,
  matchweekLabel: 'Matchweek 38 of 38',
  rows: [],
};

/**
 * Empty initial F1 arrays — all driver and constructor standings are fetched
 * directly from the official Jolpica F1 API:
 * `https://api.jolpi.ca/ergast/f1/{year}/driverStandings.json`
 * `https://api.jolpi.ca/ergast/f1/{year}/constructorStandings.json`
 */
export const F1_WDC_STANDINGS: F1DriverStandingRow[] = [];
export const F1_WCC_STANDINGS: F1ConstructorStandingRow[] = [];
export const F1_DRIVER_STANDINGS_2026: F1DriverStandingRow[] = [];
export const F1_CONSTRUCTOR_STANDINGS_2026: F1ConstructorStandingRow[] = [];
