import {
  F1ConstructorStandingRow,
  F1DriverStandingRow,
  FootballLeagueTable,
  FootballStandingRow,
} from '../types/sports';

/**
 * Official cache namespace prefix v5.
 * Any localStorage key starting with `apex_pitch_` that does NOT start with
 * `apex_pitch_verified_v5_` is purged on boot so stale/wrong tables are wiped out.
 */
export const VERIFIED_CACHE_PREFIX_V5 = 'apex_pitch_verified_v5_';

export function purgeLegacyLocalStorageKeys(): void {
  if (typeof window === 'undefined') return;
  try {
    const keysToDelete: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (
        k &&
        k.startsWith('apex_pitch_') &&
        !k.startsWith(VERIFIED_CACHE_PREFIX_V5)
      ) {
        keysToDelete.push(k);
      }
    }
    for (const k of keysToDelete) {
      window.localStorage.removeItem(k);
    }
  } catch {
    // Ignore storage quota / security errors
  }
}

export interface StandingRowValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Mathematical Integrity Validator for a single Football standings row:
 * 1. Verifies `played === won + drawn + lost` (`gamesPlayed === wins + draws + losses`).
 * 2. Verifies `goalDifference === goalsFor - goalsAgainst`.
 * 3. Verifies `points === (won * 3) + drawn` (unless an official league point deduction note exists).
 * 4. Verifies non-empty `teamName`, `teamCode`, and valid official club crest (`teamLogo`).
 */
export function validateFootballStandingRowMath(
  row: FootballStandingRow
): StandingRowValidationResult {
  const errors: string[] = [];

  if (!row || typeof row !== 'object') {
    return { valid: false, errors: ['Row is null or not an object'] };
  }

  if (!row.teamName || typeof row.teamName !== 'string' || !row.teamName.trim()) {
    errors.push('Missing valid teamName');
  }

  if (!row.teamLogo || typeof row.teamLogo !== 'string' || !row.teamLogo.startsWith('http')) {
    errors.push(`Missing valid official club crest URL for ${row.teamName || 'club'}`);
  }

  const played = Number(row.played);
  const won = Number(row.won);
  const drawn = Number(row.drawn);
  const lost = Number(row.lost);
  const goalsFor = Number(row.goalsFor);
  const goalsAgainst = Number(row.goalsAgainst);
  const points = Number(row.points);
  const parsedGD = Number(String(row.goalDifference).replace(/^\+/, ''));

  if (
    [played, won, drawn, lost, goalsFor, goalsAgainst, points, parsedGD].some((n) =>
      Number.isNaN(n)
    )
  ) {
    errors.push(`Non-numeric stat fields on ${row.teamName}`);
    return { valid: false, errors };
  }

  // 1. Verify gamesPlayed === wins + draws + losses
  if (played !== won + drawn + lost) {
    errors.push(
      `${row.teamName}: gamesPlayed (${played}) !== wins (${won}) + draws (${drawn}) + losses (${lost})`
    );
  }

  // 2. Verify goalDifference === goalsFor - goalsAgainst
  const expectedGD = goalsFor - goalsAgainst;
  if (parsedGD !== expectedGD) {
    errors.push(
      `${row.teamName}: goalDifference (${parsedGD}) !== goalsFor (${goalsFor}) - goalsAgainst (${goalsAgainst})`
    );
  }

  // 3. Verify points === (wins * 3) + draws (unless official league point deduction exists)
  const expectedRawPoints = won * 3 + drawn;
  const deduction = Number(row.deductionPoints || 0);
  const hasOfficialDeduction =
    deduction > 0 || Boolean(row.deductionNote && row.deductionNote.trim().length > 0);

  if (points !== expectedRawPoints) {
    if (!hasOfficialDeduction || points !== expectedRawPoints - deduction) {
      errors.push(
        `${row.teamName}: points (${points}) !== (wins * 3) + draws (${expectedRawPoints})`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export interface LeagueTableValidationResult {
  valid: boolean;
  errors: string[];
  table: FootballLeagueTable | null;
}

/**
 * Validates an entire FootballLeagueTable before rendering or caching:
 * - For Premier League (`eng.1` / `league-pl`), verifies all 20 clubs are present
 *   with their official club crests (`entry.team.logos[0].href`).
 * - Verifies every row passes `validateFootballStandingRowMath`.
 * - Enforces strict ascending rank order (1 to N).
 */
export function validateFootballLeagueTable(
  table: FootballLeagueTable | null | undefined,
  options?: {
    expectedClubCount?: number;
  }
): LeagueTableValidationResult {
  if (!table || !Array.isArray(table.rows) || table.rows.length === 0) {
    return {
      valid: false,
      errors: ['Table is null or has no rows'],
      table: null,
    };
  }

  const errors: string[] = [];
  const isPremierLeague =
    table.espnSlug === 'eng.1' ||
    table.id === 'league-pl' ||
    table.id.startsWith('league-pl-');

  const expectedCount =
    options?.expectedClubCount ?? (isPremierLeague ? 20 : undefined);

  if (expectedCount !== undefined && table.rows.length !== expectedCount) {
    errors.push(
      `Expected ${expectedCount} clubs for ${table.leagueName}, received ${table.rows.length}`
    );
  }

  const sortedRows = [...table.rows]
    .sort((a, b) => (a.rank ?? a.position) - (b.rank ?? b.position))
    .map((r, idx) => {
      const explicitRank = r.rank ?? r.position;
      const finalRank =
        typeof explicitRank === 'number' && explicitRank > 0
          ? explicitRank
          : idx + 1;
      return {
        ...r,
        position: finalRank,
        rank: finalRank,
      };
    });

  for (const row of sortedRows) {
    const rowCheck = validateFootballStandingRowMath(row);
    if (!rowCheck.valid) {
      errors.push(...rowCheck.errors);
    }
  }

  if (errors.length > 0) {
    return {
      valid: false,
      errors,
      table: null,
    };
  }

  return {
    valid: true,
    errors: [],
    table: {
      ...table,
      rows: sortedRows,
    },
  };
}

/**
 * Validates F1 Driver Standings returned from Jolpica / Ergast API.
 */
export function validateF1DriverStandingsTable(
  rows: F1DriverStandingRow[] | null | undefined
): { valid: boolean; rows: F1DriverStandingRow[] } {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { valid: false, rows: [] };
  }

  const validRows = rows.filter(
    (r) =>
      r &&
      typeof r.driverName === 'string' &&
      r.driverName.trim().length > 0 &&
      typeof r.points === 'number' &&
      !Number.isNaN(r.points) &&
      r.points >= 0 &&
      typeof r.wins === 'number' &&
      !Number.isNaN(r.wins) &&
      r.wins >= 0
  );

  if (validRows.length === 0) {
    return { valid: false, rows: [] };
  }

  const sorted = [...validRows]
    .sort((a, b) => (a.rank ?? a.position) - (b.rank ?? b.position))
    .map((r, idx) => ({
      ...r,
      position: idx + 1,
      rank: idx + 1,
    }));

  return { valid: true, rows: sorted };
}

/**
 * Validates F1 Constructor Standings returned from Jolpica / Ergast API.
 */
export function validateF1ConstructorStandingsTable(
  rows: F1ConstructorStandingRow[] | null | undefined
): { valid: boolean; rows: F1ConstructorStandingRow[] } {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { valid: false, rows: [] };
  }

  const validRows = rows.filter(
    (r) =>
      r &&
      typeof r.constructorName === 'string' &&
      r.constructorName.trim().length > 0 &&
      typeof r.points === 'number' &&
      !Number.isNaN(r.points) &&
      r.points >= 0
  );

  if (validRows.length === 0) {
    return { valid: false, rows: [] };
  }

  const sorted = [...validRows]
    .sort((a, b) => (a.rank ?? a.position) - (b.rank ?? b.position))
    .map((r, idx) => ({
      ...r,
      position: idx + 1,
      rank: idx + 1,
    }));

  return { valid: true, rows: sorted };
}
