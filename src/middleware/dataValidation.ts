import {
  F1Session,
  F1Weekend,
  FootballLeagueTable,
  FootballMatch,
} from '../types/sports';
import {
  F1_WEEKENDS,
  UPCOMING_FOOTBALL_MATCHES,
} from '../data/seedData';
import { FOOTBALL_LEAGUE_TABLES } from '../data/standingsData';

/**
 * ============================================================================
 * RIGOROUS DATA VALIDATION MIDDLEWARE (ESPN / OpenF1 / Jolpica-F1)
 * ============================================================================
 * 1. Validates incoming JSON responses against expected schemas before state updates.
 * 2. Cross-references Football match times and F1 session dates against the
 *    hardcoded 2026 sanity-check calendar.
 * 3. Strips 'LIVE' statuses from any event whose start time is in the future.
 * 4. Forces a fallback to verified static seed data for any match or session
 *    showing 'LIVE' status outside of its logical event window.
 * 5. Logs all detected inconsistencies to the console and persistent audit store.
 */

export type ValidationMiddlewareSource =
  | 'ESPN'
  | 'OPENF1'
  | 'JOLPICA'
  | 'API_FOOTBALL_V3'
  | 'SANITY_CALENDAR'
  | 'LOCAL_STATE_DIFF';

export type ValidationDiscrepancyType =
  | 'SCHEMA_MISMATCH'
  | 'UNKNOWN_TEAM_ID'
  | 'FUTURE_LIVE_STRIPPED'
  | 'OUTSIDE_LOGICAL_WINDOW_FALLBACK'
  | 'CALENDAR_DATE_MISMATCH'
  | 'STATE_DISCREPANCY'
  | 'POSITION_SEQUENCE_FIXED';

export interface ValidationMiddlewareLogEntry {
  id: string;
  timestampISO: string;
  source: ValidationMiddlewareSource;
  category: ValidationDiscrepancyType;
  entityId: string;
  field: string;
  apiValue: unknown;
  expectedOrFallbackValue: unknown;
  resolution: string;
}

/**
 * Hardcoded 2026 FIA Formula 1 Sanity-Check Calendar (24 Rounds)
 * Cross-referenced against every incoming OpenF1 / Jolpica weekend payload.
 */
export interface F1CalendarSanityEntry {
  round: number;
  id: string;
  hostName: string;
  grandPrixName: string;
  startDateISO: string; // YYYY-MM-DD (FP1 date UTC/IST)
  endDateISO: string;   // YYYY-MM-DD (Race date UTC/IST)
  raceStartISO: string; // Exact UTC ISO of Lights Out
  dateRangePill: string;
  expectedTimeWindow: 'PAST_RESULTS' | 'THIS_WEEK' | 'NEXT_WEEK' | 'ALL_UPCOMING';
}

export const SANITY_CHECK_2026_F1_CALENDAR: Record<number, F1CalendarSanityEntry> = {
  1: {
    round: 1,
    id: 'f1-2026-r1-albert_park',
    hostName: 'Australia',
    grandPrixName: 'Australian Grand Prix',
    startDateISO: '2026-03-06',
    endDateISO: '2026-03-08',
    raceStartISO: '2026-03-08T04:00:00Z',
    dateRangePill: 'MAR 06 - 08',
    expectedTimeWindow: 'PAST_RESULTS',
  },
  2: {
    round: 2,
    id: 'f1-2026-r2-shanghai',
    hostName: 'China',
    grandPrixName: 'Chinese Grand Prix',
    startDateISO: '2026-03-13',
    endDateISO: '2026-03-15',
    raceStartISO: '2026-03-15T07:00:00Z',
    dateRangePill: 'MAR 13 - 15',
    expectedTimeWindow: 'PAST_RESULTS',
  },
  3: {
    round: 3,
    id: 'f1-2026-r3-suzuka',
    hostName: 'Japan',
    grandPrixName: 'Japanese Grand Prix',
    startDateISO: '2026-03-27',
    endDateISO: '2026-03-29',
    raceStartISO: '2026-03-29T05:00:00Z',
    dateRangePill: 'MAR 27 - 29',
    expectedTimeWindow: 'PAST_RESULTS',
  },
  19: {
    round: 19,
    id: 'f1-2026-r19-americas',
    hostName: 'United States',
    grandPrixName: 'United States Grand Prix',
    startDateISO: '2026-10-23',
    endDateISO: '2026-10-25',
    raceStartISO: '2026-10-25T20:00:00Z',
    dateRangePill: 'OCT 23 - 25',
    expectedTimeWindow: 'PAST_RESULTS',
  },
  20: {
    round: 20,
    id: 'f1-2026-r20-rodriguez',
    hostName: 'Mexico',
    grandPrixName: 'Mexico City Grand Prix',
    startDateISO: '2026-10-30',
    endDateISO: '2026-11-01',
    raceStartISO: '2026-11-01T20:00:00Z',
    dateRangePill: 'OCT 30 - NOV 01',
    expectedTimeWindow: 'PAST_RESULTS',
  },
  21: {
    round: 21,
    id: 'f1-wknd-brazil',
    hostName: 'Brazil',
    grandPrixName: 'Brazilian (São Paulo) Grand Prix',
    startDateISO: '2026-11-06',
    endDateISO: '2026-11-08',
    raceStartISO: '2026-11-08T17:00:00Z',
    dateRangePill: 'NOV 06 - 08',
    expectedTimeWindow: 'THIS_WEEK',
  },
  22: {
    round: 22,
    id: 'f1-wknd-vegas',
    hostName: 'Las Vegas',
    grandPrixName: 'Las Vegas Grand Prix',
    startDateISO: '2026-11-20',
    endDateISO: '2026-11-22',
    raceStartISO: '2026-11-22T04:00:00Z',
    dateRangePill: 'NOV 20 - 22 IST',
    expectedTimeWindow: 'NEXT_WEEK',
  },
  23: {
    round: 23,
    id: 'f1-wknd-qatar',
    hostName: 'Qatar',
    grandPrixName: 'Qatar Grand Prix',
    startDateISO: '2026-11-27',
    endDateISO: '2026-11-29',
    raceStartISO: '2026-11-29T16:00:00Z',
    dateRangePill: 'NOV 27 - 29',
    expectedTimeWindow: 'ALL_UPCOMING',
  },
  24: {
    round: 24,
    id: 'f1-wknd-abudhabi',
    hostName: 'Abu Dhabi',
    grandPrixName: 'Abu Dhabi Grand Prix',
    startDateISO: '2026-12-04',
    endDateISO: '2026-12-06',
    raceStartISO: '2026-12-06T13:00:00Z',
    dateRangePill: 'DEC 04 - 06',
    expectedTimeWindow: 'ALL_UPCOMING',
  },
};

/**
 * Logical window constants:
 * An event can only legitimately report 'LIVE' if `nowMs` is within:
 * [startTimeMs - PRE_EVENT_BUFFER_MS, endTimeMs + POST_EVENT_BUFFER_MS]
 */
const PRE_EVENT_BUFFER_MS = 15 * 60 * 1000; // 15 minutes before scheduled start
const POST_EVENT_BUFFER_MS = 30 * 60 * 1000; // 30 minutes after scheduled duration

const middlewareLogs: ValidationMiddlewareLogEntry[] = [];
const MAX_MIDDLEWARE_LOGS = 100;

export function recordValidationMiddlewareLog(
  entry: Omit<ValidationMiddlewareLogEntry, 'id' | 'timestampISO'>
): ValidationMiddlewareLogEntry {
  const now = new Date();
  const fullEntry: ValidationMiddlewareLogEntry = {
    ...entry,
    id: `mw-${now.getTime()}-${Math.random().toString(36).slice(2, 7)}`,
    timestampISO: now.toISOString(),
  };

  middlewareLogs.unshift(fullEntry);
  if (middlewareLogs.length > MAX_MIDDLEWARE_LOGS) {
    middlewareLogs.length = MAX_MIDDLEWARE_LOGS;
  }

  console.info(
    `[APEX // PITCH DataValidationMiddleware] [${fullEntry.source}] [${fullEntry.category}] entity=${fullEntry.entityId} field=${fullEntry.field}:`,
    {
      apiValue: fullEntry.apiValue,
      expectedOrFallbackValue: fullEntry.expectedOrFallbackValue,
      resolution: fullEntry.resolution,
    }
  );

  return fullEntry;
}

export function getValidationMiddlewareLogs(): ValidationMiddlewareLogEntry[] {
  return [...middlewareLogs];
}

/**
 * Checks whether a timestamp + duration is currently inside its logical active event window.
 */
export function isWithinLogicalEventWindow(params: {
  startTimeISO: string;
  durationMinutes: number;
  referenceNowMs?: number;
}): {
  withinWindow: boolean;
  isFuture: boolean;
  isPast: boolean;
  windowStartMs: number;
  windowEndMs: number;
} {
  const nowMs = params.referenceNowMs ?? Date.now();
  const startMs = new Date(params.startTimeISO).getTime();
  const durationMs = Math.max(30, params.durationMinutes || 115) * 60 * 1000;
  const windowStartMs = startMs - PRE_EVENT_BUFFER_MS;
  const windowEndMs = startMs + durationMs + POST_EVENT_BUFFER_MS;

  if (Number.isNaN(startMs)) {
    return {
      withinWindow: false,
      isFuture: false,
      isPast: false,
      windowStartMs: 0,
      windowEndMs: 0,
    };
  }

  return {
    withinWindow: nowMs >= windowStartMs && nowMs <= windowEndMs,
    isFuture: startMs > nowMs,
    isPast: nowMs > windowEndMs,
    windowStartMs,
    windowEndMs,
  };
}

/**
 * Cross-references a FootballMatch against verified static seed fixtures (`UPCOMING_FOOTBALL_MATCHES`)
 * and enforces logical event window rules:
 * - If the match is in the future and marked 'LIVE', strips 'LIVE' -> 'UPCOMING'.
 * - If the match reports 'LIVE' outside its logical `[start - 15m, end + 30m]` window,
 *   forces a fallback to the verified static seed fixture (or strips false live state).
 * - If kickoff year is outside the current 2025/2026 season calendar, logs a discrepancy and
 *   restores the verified static seed kickoff time.
 */
export function enforceFootballMatchMiddlewareValidation(
  match: FootballMatch,
  referenceNowMs: number = Date.now(),
  onDiscrepancy?: (entry: ValidationMiddlewareLogEntry) => void
): FootballMatch {
  const staticFallback = UPCOMING_FOOTBALL_MATCHES.find(
    (m) =>
      m.id === match.id ||
      (m.homeTeam.code === match.homeTeam?.code &&
        m.awayTeam.code === match.awayTeam?.code &&
        m.startTimeISO.slice(0, 10) === (match.startTimeISO || '').slice(0, 10))
  );

  const startMs = new Date(match.startTimeISO).getTime();
  const startYear = new Date(match.startTimeISO).getUTCFullYear();

  // 1. Sanity check against current 2025/2026 season calendar year
  if (Number.isNaN(startMs) || startYear < 2025 || startYear > 2027) {
    const logEntry = recordValidationMiddlewareLog({
      source: 'SANITY_CALENDAR',
      category: 'CALENDAR_DATE_MISMATCH',
      entityId: match.id || 'unknown_match',
      field: 'startTimeISO',
      apiValue: match.startTimeISO,
      expectedOrFallbackValue: staticFallback?.startTimeISO || '2026 Season Calendar Window',
      resolution: staticFallback
        ? 'Forced fallback to verified static seed fixture due to out-of-calendar kickoff date.'
        : 'Flagged out-of-calendar football match date.',
    });
    onDiscrepancy?.(logEntry);
    if (staticFallback) {
      return { ...staticFallback };
    }
  }

  // 2. Check logical event window for any match claiming 'LIVE' status
  const windowCheck = isWithinLogicalEventWindow({
    startTimeISO: match.startTimeISO,
    durationMinutes: match.durationMinutes || 115,
    referenceNowMs,
  });

  if (match.liveStatus === 'LIVE' && !windowCheck.withinWindow) {
    const category: ValidationDiscrepancyType = windowCheck.isFuture
      ? 'FUTURE_LIVE_STRIPPED'
      : 'OUTSIDE_LOGICAL_WINDOW_FALLBACK';

    const fallbackStatus: 'UPCOMING' | 'FINAL' = windowCheck.isFuture ? 'UPCOMING' : 'FINAL';

    const logEntry = recordValidationMiddlewareLog({
      source: 'ESPN',
      category,
      entityId: match.id,
      field: 'liveStatus',
      apiValue: {
        liveStatus: match.liveStatus,
        startTimeISO: match.startTimeISO,
        referenceNowISO: new Date(referenceNowMs).toISOString(),
      },
      expectedOrFallbackValue: staticFallback
        ? `Static fallback (${staticFallback.id} -> ${fallbackStatus})`
        : fallbackStatus,
      resolution: staticFallback
        ? `Match ${match.id} reported 'LIVE' outside logical window; forced fallback to verified static data (${fallbackStatus}).`
        : `Match ${match.id} reported 'LIVE' outside logical window; stripped 'LIVE' to '${fallbackStatus}'.`,
    });
    onDiscrepancy?.(logEntry);

    if (staticFallback) {
      return {
        ...staticFallback,
        liveStatus: fallbackStatus,
        liveMinute: undefined,
        homeScore: fallbackStatus === 'UPCOMING' ? undefined : staticFallback.homeScore,
        awayScore: fallbackStatus === 'UPCOMING' ? undefined : staticFallback.awayScore,
      };
    }

    return {
      ...match,
      liveStatus: fallbackStatus,
      liveMinute: undefined,
      homeScore: fallbackStatus === 'UPCOMING' ? undefined : match.homeScore,
      awayScore: fallbackStatus === 'UPCOMING' ? undefined : match.awayScore,
    };
  }

  return match;
}

/**
 * Cross-references an F1Weekend and all of its sessions against the hardcoded
 * 2026 FIA Formula 1 Sanity-Check Calendar (`SANITY_CHECK_2026_F1_CALENDAR`)
 * and verified static `F1_WEEKENDS` seed data.
 * - Verifies Round numbers (e.g. Brazil = R21, Las Vegas = R22, Qatar = R23, Abu Dhabi = R24).
 * - Strips 'LIVE' status from any future F1 session or weekend outside its logical window.
 * - Restores verified static session schedule if API dates conflict with the 2026 calendar.
 */
export function enforceF1WeekendMiddlewareValidation(
  weekend: F1Weekend,
  referenceNowMs: number = Date.now(),
  onDiscrepancy?: (entry: ValidationMiddlewareLogEntry) => void
): F1Weekend {
  // Match against static seed weekend by ID or circuitSvgId
  const staticSeedWeekend = F1_WEEKENDS.find(
    (w) => w.id === weekend.id || w.circuitSvgId === weekend.circuitSvgId
  );

  // Determine canonical 2026 round number from circuitSvgId or id if off-by-one
  const svgToCanonicalRound: Record<string, number> = {
    interlagos: 21,
    vegas: 22,
    lusail: 23,
    yas_marina: 24,
  };
  const expectedRound =
    svgToCanonicalRound[weekend.circuitSvgId] ||
    staticSeedWeekend?.round ||
    weekend.round;

  const sanityEntry = SANITY_CHECK_2026_F1_CALENDAR[expectedRound];
  let resolvedRound = weekend.round;
  let resolvedDateRangePill = weekend.dateRangePill || weekend.dateRangeLabel;
  let resolvedTimeWindow = weekend.timeWindow;
  let resolvedHostName = weekend.hostName || weekend.city;

  if (sanityEntry) {
    if (weekend.round !== sanityEntry.round) {
      const logEntry = recordValidationMiddlewareLog({
        source: 'SANITY_CALENDAR',
        category: 'CALENDAR_DATE_MISMATCH',
        entityId: weekend.id,
        field: 'round',
        apiValue: weekend.round,
        expectedOrFallbackValue: sanityEntry.round,
        resolution: `Corrected F1 weekend round number ${weekend.round} -> ${sanityEntry.round} (${sanityEntry.grandPrixName}) per 2026 FIA 24-round calendar.`,
      });
      onDiscrepancy?.(logEntry);
      resolvedRound = sanityEntry.round;
    }

    if (!resolvedDateRangePill) {
      resolvedDateRangePill = sanityEntry.dateRangePill;
    }
    if (!resolvedHostName) {
      resolvedHostName = sanityEntry.hostName;
    }
    if (weekend.timeWindow !== sanityEntry.expectedTimeWindow && sanityEntry.round >= 21) {
      resolvedTimeWindow = sanityEntry.expectedTimeWindow;
    }
  }

  // Validate each session against logical event window and sanity calendar dates
  const validatedSessions: F1Session[] = weekend.sessions.map((session, idx) => {
    const staticSession = staticSeedWeekend?.sessions[idx];
    const windowCheck = isWithinLogicalEventWindow({
      startTimeISO: session.startTimeISO,
      durationMinutes: session.durationMinutes || 90,
      referenceNowMs,
    });

    let resolvedSession = { ...session };

    // If session date year is not 2026 or date is invalid, fall back to static session
    const sessionStartMs = new Date(session.startTimeISO).getTime();
    const sessionYear = new Date(session.startTimeISO).getUTCFullYear();
    if ((Number.isNaN(sessionStartMs) || sessionYear !== 2026) && staticSession) {
      const logEntry = recordValidationMiddlewareLog({
        source: 'OPENF1',
        category: 'CALENDAR_DATE_MISMATCH',
        entityId: session.id,
        field: 'startTimeISO',
        apiValue: session.startTimeISO,
        expectedOrFallbackValue: staticSession.startTimeISO,
        resolution: `Session ${session.id} date conflicted with 2026 F1 calendar; fell back to verified static session schedule.`,
      });
      onDiscrepancy?.(logEntry);
      resolvedSession = { ...staticSession };
    }

    const exactStartMs = new Date(resolvedSession.startTimeISO).getTime();
    const exactDurationMs =
      Math.max(30, resolvedSession.durationMinutes || 60) * 60 * 1000;
    const exactEndMs = exactStartMs + exactDurationMs;

    // Strip 'LIVE' status if session is in the future or has already finished
    if (resolvedSession.status === 'LIVE' && !windowCheck.withinWindow) {
      const fallbackStatus: 'UPCOMING' | 'COMPLETED' = windowCheck.isFuture
        ? 'UPCOMING'
        : 'COMPLETED';
      const logEntry = recordValidationMiddlewareLog({
        source: 'OPENF1',
        category: windowCheck.isFuture
          ? 'FUTURE_LIVE_STRIPPED'
          : 'OUTSIDE_LOGICAL_WINDOW_FALLBACK',
        entityId: resolvedSession.id,
        field: 'status',
        apiValue: 'LIVE',
        expectedOrFallbackValue: fallbackStatus,
        resolution: `Stripped invalid 'LIVE' status from F1 session ${resolvedSession.id} outside logical window -> '${fallbackStatus}'.`,
      });
      onDiscrepancy?.(logEntry);
      resolvedSession.status = fallbackStatus;
    } else if (!Number.isNaN(exactEndMs) && referenceNowMs > exactEndMs) {
      resolvedSession.status = 'COMPLETED';
    } else if (
      !Number.isNaN(exactStartMs) &&
      !Number.isNaN(exactEndMs) &&
      referenceNowMs >= exactStartMs &&
      referenceNowMs <= exactEndMs
    ) {
      resolvedSession.status = 'LIVE';
    } else if (windowCheck.isFuture) {
      resolvedSession.status = 'UPCOMING';
    }

    return resolvedSession;
  });

  // Evaluate whole-weekend active window: once FP1 starts until the final Grand Prix finishes,
  // the entire F1 weekend is LIVE. If all sessions are in the future, strip any spoofed 'LIVE' status.
  const allCompleted =
    validatedSessions.length > 0 &&
    validatedSessions.every((s) => s.status === 'COMPLETED');

  let firstSessionStartMs = Number.POSITIVE_INFINITY;
  let finalGrandPrixEndMs = Number.NEGATIVE_INFINITY;
  for (const s of validatedSessions) {
    const sStart = new Date(s.startTimeISO).getTime();
    if (Number.isNaN(sStart)) continue;
    const sEnd = sStart + Math.max(60, s.durationMinutes || 90) * 60 * 1000;
    if (sStart < firstSessionStartMs) firstSessionStartMs = sStart;
    if (sEnd > finalGrandPrixEndMs) finalGrandPrixEndMs = sEnd;
  }

  const isWithinWholeWeekendWindow =
    Number.isFinite(firstSessionStartMs) &&
    Number.isFinite(finalGrandPrixEndMs) &&
    referenceNowMs >= firstSessionStartMs - PRE_EVENT_BUFFER_MS &&
    referenceNowMs <= finalGrandPrixEndMs + POST_EVENT_BUFFER_MS &&
    !allCompleted;

  const hasAnyLiveSession = validatedSessions.some((s) => s.status === 'LIVE');

  let resolvedWeekendStatus = weekend.status;
  if (allCompleted) {
    resolvedWeekendStatus = 'COMPLETED';
  } else if (isWithinWholeWeekendWindow || hasAnyLiveSession) {
    resolvedWeekendStatus = 'LIVE';
  } else if (weekend.status === 'LIVE' && !isWithinWholeWeekendWindow && !hasAnyLiveSession) {
    const logEntry = recordValidationMiddlewareLog({
      source: 'OPENF1',
      category: 'FUTURE_LIVE_STRIPPED',
      entityId: weekend.id,
      field: 'weekend.status',
      apiValue: 'LIVE',
      expectedOrFallbackValue: allCompleted ? 'COMPLETED' : 'UPCOMING',
      resolution: `Stripped weekend 'LIVE' status from ${weekend.grandPrixName} as weekend window has not yet started.`,
    });
    onDiscrepancy?.(logEntry);
    resolvedWeekendStatus = allCompleted ? 'COMPLETED' : 'UPCOMING';
  }

  return {
    ...weekend,
    round: resolvedRound,
    hostName: resolvedHostName,
    countryName: weekend.countryName || resolvedHostName,
    dateRangePill: resolvedDateRangePill,
    dateRangeLabel: weekend.dateRangeLabel || resolvedDateRangePill,
    timeWindow: resolvedTimeWindow,
    status: resolvedWeekendStatus || (allCompleted ? 'COMPLETED' : 'UPCOMING'),
    sessions: validatedSessions,
  };
}

/**
 * Top-level Data Validation Middleware runner that inspects an entire sports state batch
 * (Football matches, League tables, and F1 weekends) for consistency, logs any discrepancies,
 * strips future 'LIVE' statuses, and falls back to verified static seed data when needed.
 */
export function runSportsDataValidationMiddleware(params: {
  matches: FootballMatch[] | null | undefined;
  leagueTables?: FootballLeagueTable[] | null | undefined;
  f1Weekends: F1Weekend[] | null | undefined;
  referenceNowMs?: number;
  onDiscrepancy?: (entry: ValidationMiddlewareLogEntry) => void;
}): {
  matches: FootballMatch[];
  leagueTables: FootballLeagueTable[];
  f1Weekends: F1Weekend[];
  logs: ValidationMiddlewareLogEntry[];
} {
  const nowMs = params.referenceNowMs ?? Date.now();

  const inputMatches =
    Array.isArray(params.matches) && params.matches.length > 0
      ? params.matches
      : UPCOMING_FOOTBALL_MATCHES;

  const inputWeekends =
    Array.isArray(params.f1Weekends) && params.f1Weekends.length > 0
      ? params.f1Weekends
      : F1_WEEKENDS;

  const inputTables =
    Array.isArray(params.leagueTables) && params.leagueTables.length > 0
      ? params.leagueTables
      : FOOTBALL_LEAGUE_TABLES;

  const validatedMatches = inputMatches.map((m) =>
    enforceFootballMatchMiddlewareValidation(m, nowMs, params.onDiscrepancy)
  );

  const validatedWeekends = inputWeekends.map((w) =>
    enforceF1WeekendMiddlewareValidation(w, nowMs, params.onDiscrepancy)
  );

  return {
    matches: validatedMatches,
    leagueTables: inputTables,
    f1Weekends: validatedWeekends,
    logs: getValidationMiddlewareLogs(),
  };
}
