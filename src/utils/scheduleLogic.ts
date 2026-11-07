import {
  ArchiveItem,
  ArmedAlarm,
  ClashDetectorSettings,
  ClashFilterMode,
  ClashPair,
  F1Session,
  F1Weekend,
  FootballMatch,
  PrefetchCacheEntry,
  SportFilter,
  TimeWindow,
} from '../types/sports';
import { F1_LOGOS } from '../data/logos';

/**
 * Formats an ISO UTC timestamp into a 12-hour IST time string (e.g., "10:30 PM IST" or "01:30 AM IST")
 * using Intl.DateTimeFormat with timeZone: 'Asia/Kolkata'.
 */
export function formatISOToIST12Hour(isoString: string): string {
  const dateObj = new Date(isoString);
  if (Number.isNaN(dateObj.getTime())) return '12:00 PM IST';

  const parts = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(dateObj);

  const hour = (parts.find((p) => p.type === 'hour')?.value ?? '12').padStart(2, '0');
  const minute = (parts.find((p) => p.type === 'minute')?.value ?? '00').padStart(2, '0');
  const dayPeriodRaw = parts.find((p) => p.type === 'dayPeriod')?.value ?? 'PM';
  const period = dayPeriodRaw.toUpperCase().includes('P') ? 'PM' : 'AM';
  return `${hour}:${minute} ${period} IST`;
}

export const formatISOTo12HourIST = formatISOToIST12Hour;

/**
 * Formats an ISO UTC timestamp into an IST Date Label (e.g., "SUN, 08 NOV")
 * using Intl.DateTimeFormat with timeZone: 'Asia/Kolkata'.
 */
export function formatISOToISTDateLabel(isoString: string): string {
  const dateObj = new Date(isoString);
  if (Number.isNaN(dateObj.getTime())) return 'SUN, 08 NOV';

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  }).formatToParts(dateObj);

  const dayName = (parts.find((p) => p.type === 'weekday')?.value ?? 'SUN').toUpperCase();
  const dayNum = (parts.find((p) => p.type === 'day')?.value ?? '08').padStart(2, '0');
  const monthName = (parts.find((p) => p.type === 'month')?.value ?? 'NOV').toUpperCase();
  return `${dayName}, ${dayNum} ${monthName}`;
}

/**
 * Converts any "HH:MM TZ" 24-hour label into 12-hour format "HH:MM AM/PM TZ" if not already 12-hour.
 * Preserves "TBD" when kickoff time is not yet declared by the league.
 */
export function ensure12HourTimeLabel(label: string): string {
  if (!label || /\bTBD\b|NOT DECLARED/i.test(label)) return 'TBD';
  if (/AM|PM/i.test(label)) return label;
  const match = label.match(/(\d{1,2}):(\d{2})\s*(.*)/);
  if (!match) return label;
  const h24 = parseInt(match[1], 10);
  const mins = match[2];
  const suffix = match[3] ? ` ${match[3].trim()}` : '';
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${String(h12).padStart(2, '0')}:${mins} ${period}${suffix}`;
}

/**
 * Detects time overlaps in IST between Football matches and Formula 1 sessions.
 * Supports adjustable ClashFilterMode & ClashDetectorSettings:
 * - 'MCI_SAN_ONLY': Only detect clashes if Manchester City (MCI) or Santos FC (SAN) matches collide with F1
 * - 'FOLLOWED_ONLY': Detect clashes for user-followed Football clubs colliding with F1
 * - 'CUSTOM_TEAMS': Detect clashes for custom selected club codes colliding with F1
 * - 'ALL_MATCHES': Detect clashes for all Football matches colliding with F1
 * - keySessionsOnly: Only check Qualifying, Sprint, and Grand Prix Race sessions
 * - bufferMinutes: Pre/post broadcast buffer in minutes (0, 15, or 30)
 * - dismissedClashIds: Clash IDs hidden by the user
 */
export function detectScheduleClashes(
  matches: FootballMatch[],
  weekends: F1Weekend[],
  followedTeamCodes?: string[],
  clashFilterMode: ClashFilterMode = 'FOLLOWED_ONLY',
  customClashTeamCodes?: string[],
  clashSettings?: ClashDetectorSettings
): ClashPair[] {
  if (clashSettings && !clashSettings.enabled) {
    return [];
  }

  const effectiveMode = clashSettings?.filterMode ?? clashFilterMode;
  const clashTypeMode = clashSettings?.clashTypeMode ?? 'ALL_CLASHES';
  const effectiveCustomTeams =
    clashSettings?.customTeamCodes ?? customClashTeamCodes;
  const keySessionsOnly = Boolean(clashSettings?.keySessionsOnly);
  const bufferMs = Math.max(0, clashSettings?.bufferMinutes ?? 0) * 60 * 1000;
  const dismissedIds = new Set(clashSettings?.dismissedClashIds ?? []);

  const clashes: ClashPair[] = [];

  const activeClubFilter: string[] | null = (() => {
    if (effectiveMode === 'MCI_SAN_ONLY') {
      return ['MCI', 'SAN', 'KBFC'];
    }
    if (effectiveMode === 'CUSTOM_TEAMS') {
      return effectiveCustomTeams && effectiveCustomTeams.length > 0
        ? effectiveCustomTeams
        : ['MCI', 'SAN', 'KBFC'];
    }
    if (effectiveMode === 'ALL_MATCHES') {
      return null;
    }
    return followedTeamCodes && followedTeamCodes.length > 0
      ? followedTeamCodes
      : null;
  })();

  const doesMatchPassFilter = (match: FootballMatch): boolean => {
    // Never generate upcoming clash alerts for already finished matches
    if (match.liveStatus === 'FINAL' || match.timeWindow === 'PAST_RESULTS') {
      return false;
    }
    if (
      activeClubFilter &&
      activeClubFilter.length > 0 &&
      !activeClubFilter.includes(match.homeTeam.code) &&
      !activeClubFilter.includes(match.awayTeam.code)
    ) {
      return false;
    }
    return true;
  };

  // 1. Football × Formula 1 Clashes
  if (clashTypeMode === 'ALL_CLASHES' || clashTypeMode === 'FOOTBALL_VS_F1') {
    for (const match of matches) {
      if (!doesMatchPassFilter(match)) {
        continue;
      }

      const matchStartMs = new Date(match.startTimeISO).getTime() - bufferMs;
      const matchEndMs =
        new Date(match.startTimeISO).getTime() +
        match.durationMinutes * 60 * 1000 +
        bufferMs;
      const isMatchTBD =
        Boolean(match.isTimeTBD) ||
        /\bTBD\b|NOT DECLARED/i.test(match.istTimeLabel || '');

      for (const wknd of weekends) {
        if (wknd.status === 'COMPLETED' || wknd.timeWindow === 'PAST_RESULTS') {
          continue;
        }
        for (const session of wknd.sessions) {
          if (keySessionsOnly) {
            const isKeySession =
              session.name === 'Grand Prix' ||
              session.name === 'Qualifying' ||
              session.name === 'Sprint' ||
              session.shortLabel === 'RACE' ||
              session.shortLabel === 'Q' ||
              session.shortLabel === 'SPR';
            if (!isKeySession) {
              continue;
            }
          }

          const clashId = `clash-${match.id}-${session.id}`;
          if (dismissedIds.has(clashId)) {
            continue;
          }

          const sessionStartMs =
            new Date(session.startTimeISO).getTime() - bufferMs;
          const sessionEndMs =
            new Date(session.startTimeISO).getTime() +
            session.durationMinutes * 60 * 1000 +
            bufferMs;

          const overlapStart = Math.max(matchStartMs, sessionStartMs);
          const overlapEnd = Math.min(matchEndMs, sessionEndMs);

          if (overlapStart < overlapEnd) {
            const matchTime12h = isMatchTBD
              ? 'TBD'
              : ensure12HourTimeLabel(match.istTimeLabel);
            const sessionTime12h = ensure12HourTimeLabel(session.istTimeLabel);

            clashes.push({
              id: clashId,
              clashType: 'FOOTBALL_VS_F1',
              isCompleted: false,
              footballMatchId: match.id,
              f1WeekendId: wknd.id,
              f1SessionId: session.id,
              overlapWindowIST: isMatchTBD
                ? `${match.istDateLabel} • Time TBD`
                : `${match.istDateLabel} • ${matchTime12h}`,
              description: isMatchTBD
                ? `${match.homeTeam.code} vs ${match.awayTeam.code} (Time TBD — Not Declared) is scheduled on ${wknd.grandPrixName} ${session.name} day (${sessionTime12h})`
                : `${match.homeTeam.code} vs ${match.awayTeam.code} (${matchTime12h}) overlaps with ${wknd.grandPrixName} ${session.name} (${sessionTime12h})`,
              footballInfo: {
                competition: match.competition,
                competitionLogo: match.competitionLogo,
                homeCode: match.homeTeam.code,
                homeName: match.homeTeam.name,
                homeLogo: match.homeTeam.logo,
                awayCode: match.awayTeam.code,
                awayName: match.awayTeam.name,
                awayLogo: match.awayTeam.logo,
                istTime12h: matchTime12h,
                istDateLabel: match.istDateLabel,
                startTimeISO: match.startTimeISO,
                venue: match.venue,
                isTimeTBD: isMatchTBD,
                homeScore: match.homeScore,
                awayScore: match.awayScore,
                liveStatus: match.liveStatus,
              },
              f1Info: {
                grandPrixName: wknd.grandPrixName,
                sessionName: session.name,
                sessionShortLabel: session.shortLabel,
                countryFlagUrl: wknd.countryFlagUrl,
                f1LogoUrl: F1_LOGOS.F1_MAIN,
                circuitName: wknd.circuitName,
                istTime12h: sessionTime12h,
                istDateLabel: session.istDateLabel,
                startTimeISO: session.startTimeISO,
              },
            });
          }
        }
      }
    }
  }

  // 2. Football × Football Simultaneous Match Clashes (between 2+ followed/selected teams)
  if (
    clashTypeMode === 'ALL_CLASHES' ||
    clashTypeMode === 'FOOTBALL_VS_FOOTBALL'
  ) {
    const eligibleMatches = matches.filter(doesMatchPassFilter);
    for (let i = 0; i < eligibleMatches.length; i++) {
      const m1 = eligibleMatches[i];
      const m1StartMs = new Date(m1.startTimeISO).getTime() - bufferMs;
      const m1EndMs =
        new Date(m1.startTimeISO).getTime() +
        m1.durationMinutes * 60 * 1000 +
        bufferMs;
      const isM1TBD =
        Boolean(m1.isTimeTBD) ||
        /\bTBD\b|NOT DECLARED/i.test(m1.istTimeLabel || '');

      for (let j = i + 1; j < eligibleMatches.length; j++) {
        const m2 = eligibleMatches[j];
        if (m1.id === m2.id) continue;

        const m2StartMs = new Date(m2.startTimeISO).getTime() - bufferMs;
        const m2EndMs =
          new Date(m2.startTimeISO).getTime() +
          m2.durationMinutes * 60 * 1000 +
          bufferMs;
        const isM2TBD =
          Boolean(m2.isTimeTBD) ||
          /\bTBD\b|NOT DECLARED/i.test(m2.istTimeLabel || '');

        if (isM1TBD || isM2TBD) continue;

        const overlapStart = Math.max(m1StartMs, m2StartMs);
        const overlapEnd = Math.min(m1EndMs, m2EndMs);

        if (overlapStart < overlapEnd) {
          const clashId = `clash-fb-${m1.id}-${m2.id}`;
          if (dismissedIds.has(clashId)) continue;

          const m1Time12h = ensure12HourTimeLabel(m1.istTimeLabel);
          const m2Time12h = ensure12HourTimeLabel(m2.istTimeLabel);

          clashes.push({
            id: clashId,
            clashType: 'FOOTBALL_VS_FOOTBALL',
            isCompleted: false,
            footballMatchId: m1.id,
            secondFootballMatchId: m2.id,
            f1WeekendId: '',
            f1SessionId: m2.id,
            overlapWindowIST: `${m1.istDateLabel} • ${m1Time12h}`,
            description: `${m1.homeTeam.code} vs ${m1.awayTeam.code} (${m1Time12h}) overlaps with ${m2.homeTeam.code} vs ${m2.awayTeam.code} (${m2Time12h})`,
            footballInfo: {
              competition: m1.competition,
              competitionLogo: m1.competitionLogo,
              homeCode: m1.homeTeam.code,
              homeName: m1.homeTeam.name,
              homeLogo: m1.homeTeam.logo,
              awayCode: m1.awayTeam.code,
              awayName: m1.awayTeam.name,
              awayLogo: m1.awayTeam.logo,
              istTime12h: m1Time12h,
              istDateLabel: m1.istDateLabel,
              startTimeISO: m1.startTimeISO,
              venue: m1.venue,
              isTimeTBD: isM1TBD,
              homeScore: m1.homeScore,
              awayScore: m1.awayScore,
              liveStatus: m1.liveStatus,
            },
            secondFootballInfo: {
              competition: m2.competition,
              competitionLogo: m2.competitionLogo,
              homeCode: m2.homeTeam.code,
              homeName: m2.homeTeam.name,
              homeLogo: m2.homeTeam.logo,
              awayCode: m2.awayTeam.code,
              awayName: m2.awayTeam.name,
              awayLogo: m2.awayTeam.logo,
              istTime12h: m2Time12h,
              istDateLabel: m2.istDateLabel,
              startTimeISO: m2.startTimeISO,
              venue: m2.venue,
              isTimeTBD: isM2TBD,
              homeScore: m2.homeScore,
              awayScore: m2.awayScore,
              liveStatus: m2.liveStatus,
            },
            f1Info: {
              grandPrixName: `${m2.homeTeam.name} vs ${m2.awayTeam.name}`,
              sessionName: m2.competition,
              sessionShortLabel: `${m2.homeTeam.code} v ${m2.awayTeam.code}`,
              countryFlagUrl: m2.competitionLogo,
              f1LogoUrl: m2.competitionLogo,
              circuitName: m2.venue,
              istTime12h: m2Time12h,
              istDateLabel: m2.istDateLabel,
              startTimeISO: m2.startTimeISO,
            },
          });
        }
      }
    }
  }

  return clashes;
}

/**
 * Evaluates the real-time status of an individual Formula 1 session (FP1, FP2/PS2, FP3, Sprint, Qualifying, Grand Prix).
 * - If `referenceNowMs > endMs`, returns `'COMPLETED'` (displayed as `DONE` in the UI).
 * - If `referenceNowMs >= startMs && referenceNowMs <= endMs`, returns `'LIVE'` (displayed as `LIVE` in the UI).
 * - If `referenceNowMs < startMs`, returns `'UPCOMING'`.
 */
export function evaluateF1SessionRuntimeStatus(
  session: F1Session,
  referenceNowMs: number = Date.now()
): 'UPCOMING' | 'LIVE' | 'COMPLETED' {
  const startMs = new Date(session.startTimeISO).getTime();
  if (Number.isNaN(startMs)) {
    return session.status || 'UPCOMING';
  }
  const durationMs = Math.max(30, session.durationMinutes || 60) * 60 * 1000;
  const endMs = startMs + durationMs;

  if (referenceNowMs > endMs) {
    return 'COMPLETED';
  }
  if (referenceNowMs >= startMs && referenceNowMs <= endMs) {
    return 'LIVE';
  }
  return 'UPCOMING';
}

/**
 * Evaluates whether an entire Formula 1 Grand Prix weekend is currently LIVE.
 * Once the first event/session (FP1) starts until the final Grand Prix session finishes,
 * the entire F1 race weekend is marked as 'LIVE' everywhere.
 */
export function evaluateF1WeekendLiveStatus(
  weekend: F1Weekend,
  referenceNowMs: number = Date.now()
): 'UPCOMING' | 'LIVE' | 'COMPLETED' {
  if (!weekend.sessions || weekend.sessions.length === 0) {
    return weekend.status || 'UPCOMING';
  }

  let firstSessionStartMs = Number.POSITIVE_INFINITY;
  let finalGrandPrixEndMs = Number.NEGATIVE_INFINITY;

  for (const s of weekend.sessions) {
    const startMs = new Date(s.startTimeISO).getTime();
    if (Number.isNaN(startMs)) continue;
    const durationMs = Math.max(60, s.durationMinutes || 90) * 60 * 1000;
    const endMs = startMs + durationMs;
    if (startMs < firstSessionStartMs) firstSessionStartMs = startMs;
    if (endMs > finalGrandPrixEndMs) finalGrandPrixEndMs = endMs;
  }

  if (
    !Number.isFinite(firstSessionStartMs) ||
    !Number.isFinite(finalGrandPrixEndMs)
  ) {
    return weekend.status || 'UPCOMING';
  }

  const allCompleted = weekend.sessions.every(
    (s) => evaluateF1SessionRuntimeStatus(s, referenceNowMs) === 'COMPLETED'
  );
  if (allCompleted || referenceNowMs > finalGrandPrixEndMs) {
    return 'COMPLETED';
  }

  const hasStartedAnySession =
    referenceNowMs >= firstSessionStartMs ||
    weekend.sessions.some((s) => {
      const runtimeStatus = evaluateF1SessionRuntimeStatus(s, referenceNowMs);
      return runtimeStatus === 'LIVE' || runtimeStatus === 'COMPLETED';
    });

  if (hasStartedAnySession && referenceNowMs <= finalGrandPrixEndMs) {
    return 'LIVE';
  }

  return 'UPCOMING';
}

/**
 * Filters Football matches by timeWindow, sportFilter, and selectedTeamCode.
 * Ordering rules:
 * - 'PAST_RESULTS': Most recently finished matches FIRST (descending by startTimeISO).
 * - 'THIS_WEEK' / 'NEXT_WEEK': Upcoming & Live matches FIRST (ascending by startTimeISO),
 *   followed by any finished ('FINAL') matches from earlier in the week (descending by startTimeISO).
 * - 'ALL_UPCOMING' (Full Calendar): All fixtures ordered chronologically by date (ascending by startTimeISO).
 */
export function filterFootballMatches(
  matches: FootballMatch[],
  timeWindow: TimeWindow,
  sportFilter: SportFilter,
  selectedTeamCode: string | 'ALL_FOLLOWED' | 'ALL_TEAMS',
  followedTeamCodes: string[]
): FootballMatch[] {
  if (sportFilter === 'F1') return [];

  const filtered = matches.filter((m) => {
    const isFinished =
      m.liveStatus === 'FINAL' || m.timeWindow === 'PAST_RESULTS';
    const matchesWindow =
      timeWindow === 'ALL_UPCOMING'
        ? true
        : timeWindow === 'PAST_RESULTS'
        ? isFinished
        : m.timeWindow === timeWindow;
    if (!matchesWindow) return false;

    if (selectedTeamCode === 'ALL_TEAMS') {
      return true;
    }

    if (selectedTeamCode === 'ALL_FOLLOWED') {
      if (followedTeamCodes.length === 0) return true;
      return (
        followedTeamCodes.includes(m.homeTeam.code) ||
        followedTeamCodes.includes(m.awayTeam.code)
      );
    }

    return (
      m.homeTeam.code === selectedTeamCode ||
      m.awayTeam.code === selectedTeamCode
    );
  });

  return [...filtered].sort((a, b) => {
    const timeA = new Date(a.startTimeISO).getTime();
    const timeB = new Date(b.startTimeISO).getTime();

    if (timeWindow === 'PAST_RESULTS') {
      // Most recently finished matches FIRST
      return timeB - timeA;
    }

    if (timeWindow === 'THIS_WEEK' || timeWindow === 'NEXT_WEEK') {
      // Upcoming / Live matches FIRST, finished matches after
      const isFinishedA =
        a.liveStatus === 'FINAL' || a.timeWindow === 'PAST_RESULTS';
      const isFinishedB =
        b.liveStatus === 'FINAL' || b.timeWindow === 'PAST_RESULTS';
      if (isFinishedA !== isFinishedB) {
        return isFinishedA ? 1 : -1;
      }
      if (!isFinishedA) {
        return timeA - timeB;
      }
      return timeB - timeA;
    }

    // ALL_UPCOMING (Full Calendar): strictly chronological order by date
    return timeA - timeB;
  });
}

/**
 * Filters Formula 1 weekends by timeWindow, sportFilter, and selectedTeamCode.
 * Deduplicates by round/id so each race weekend appears at most once.
 */
export function filterF1Weekends(
  weekends: F1Weekend[],
  timeWindow: TimeWindow,
  sportFilter: SportFilter,
  selectedTeamCode: string | 'ALL_FOLLOWED' | 'ALL_TEAMS',
  f1ConstructorCodes: string[]
): F1Weekend[] {
  if (sportFilter === 'FOOTBALL') return [];

  if (
    selectedTeamCode !== 'ALL_FOLLOWED' &&
    selectedTeamCode !== 'ALL_TEAMS' &&
    !f1ConstructorCodes.includes(selectedTeamCode)
  ) {
    return [];
  }

  const seenRounds = new Set<string>();
  return weekends.filter((w) => {
    const isCompleted =
      w.status === 'COMPLETED' || w.timeWindow === 'PAST_RESULTS';
    const matchesWindow =
      timeWindow === 'ALL_UPCOMING'
        ? true
        : timeWindow === 'PAST_RESULTS'
        ? isCompleted
        : w.timeWindow === timeWindow;
    if (!matchesWindow) return false;

    const dedupKey = `${w.seasonYear || 2026}-r${w.round}-${w.circuitSvgId}`;
    if (seenRounds.has(dedupKey)) return false;
    seenRounds.add(dedupKey);
    return true;
  });
}

/**
 * Determines whether an upcoming event should be pre-fetched.
 */
export function shouldPrefetchEvent(
  eventId: string,
  isOnline: boolean,
  cacheMap: Record<string, PrefetchCacheEntry>,
  nowMs: number = Date.now(),
  cacheTTLMinutes: number = 60
): boolean {
  if (!isOnline) {
    return false;
  }

  const existing = cacheMap[eventId];
  if (!existing) {
    return true;
  }

  const cachedAtMs = new Date(existing.cachedAtISO).getTime();
  if (Number.isNaN(cachedAtMs)) {
    return true;
  }

  const ageMinutes = (nowMs - cachedAtMs) / (1000 * 60);
  return ageMinutes >= cacheTTLMinutes;
}

/**
 * Computes the next N upcoming event IDs to pre-fetch based on current scroll index / visible item ID.
 */
export function getUpcomingEventsToPrefetch(
  orderedEventIds: string[],
  currentVisibleIndex: number,
  lookaheadCount: number,
  isOnline: boolean,
  cacheMap: Record<string, PrefetchCacheEntry>,
  nowMs: number = Date.now()
): string[] {
  if (!isOnline || orderedEventIds.length === 0) return [];

  const startIdx = Math.max(0, currentVisibleIndex);
  const endIdx = Math.min(
    orderedEventIds.length,
    startIdx + lookaheadCount + 1
  );

  const candidates = orderedEventIds.slice(startIdx, endIdx);
  return candidates.filter((id) =>
    shouldPrefetchEvent(id, isOnline, cacheMap, nowMs)
  );
}

/**
 * Builds a structured offline-first PrefetchCacheEntry for a Football match or F1 weekend.
 */
export function buildPrefetchEntry(
  item: FootballMatch | F1Weekend,
  source: PrefetchCacheEntry['source'] = 'PREFETCH_ENGINE',
  nowISO: string = new Date().toISOString()
): PrefetchCacheEntry {
  if (item.sport === 'FOOTBALL') {
    return {
      eventId: item.id,
      sport: 'FOOTBALL',
      cachedAtISO: nowISO,
      source,
      payloadSummary: `H2H, Win Prob (${item.prefetchMeta.winProbability.home}%/${item.prefetchMeta.winProbability.draw}%/${item.prefetchMeta.winProbability.away}%) & Lineups Cached`,
      details: {
        referee: item.prefetchMeta.referee,
        weather: item.prefetchMeta.weather,
        headToHead: item.prefetchMeta.headToHeadSummary,
        keyPlayers: item.prefetchMeta.keyPlayersToWatch,
      },
    };
  }

  return {
    eventId: item.id,
    sport: 'F1',
    cachedAtISO: nowISO,
    source,
    payloadSummary: `Telemetry, Tyres (${item.prefetchMeta.tyreAllocation}) & Weather Cached`,
    details: {
      trackTempForecast: item.prefetchMeta.trackTempForecast,
      rainChance: item.prefetchMeta.rainChance,
      tyreAllocation: item.prefetchMeta.tyreAllocation,
      lapRecord: item.prefetchMeta.lapRecord,
      drsZones: item.prefetchMeta.drsZones,
    },
  };
}

/**
 * Formats an ISO UTC string into ICS timestamp format YYYYMMDDTHHMMSSZ
 */
export function toICSTimestamp(isoString: string): string {
  const date = new Date(isoString);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    date.getUTCFullYear().toString() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    'T' +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) +
    'Z'
  );
}

/**
 * Generates an RFC 5545 .ics calendar payload for one or multiple sports events.
 */
export function generateICSContent(
  events: {
    id: string;
    title: string;
    description: string;
    location: string;
    startTimeISO: string;
    durationMinutes: number;
  }[]
): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//APEX PITCH//IST Sports Companion//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  for (const ev of events) {
    const startMs = new Date(ev.startTimeISO).getTime();
    const endISO = new Date(startMs + ev.durationMinutes * 60 * 1000).toISOString();

    lines.push(
      'BEGIN:VEVENT',
      `UID:${ev.id}@apexpitch.app`,
      `DTSTAMP:${toICSTimestamp(new Date().toISOString())}`,
      `DTSTART:${toICSTimestamp(ev.startTimeISO)}`,
      `DTEND:${toICSTimestamp(endISO)}`,
      `SUMMARY:${ev.title}`,
      `DESCRIPTION:${ev.description}`,
      `LOCATION:${ev.location}`,
      'END:VEVENT'
    );
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

/**
 * Generates a Google Calendar deep-link URL for a single match or F1 session.
 */
export function generateGoogleCalendarUrl(event: {
  title: string;
  description: string;
  location: string;
  startTimeISO: string;
  durationMinutes: number;
}): string {
  const startMs = new Date(event.startTimeISO).getTime();
  const endISO = new Date(startMs + event.durationMinutes * 60 * 1000).toISOString();
  const dates = `${toICSTimestamp(event.startTimeISO)}/${toICSTimestamp(endISO)}`;

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates,
    details: event.description,
    location: event.location,
    ctz: 'Asia/Kolkata',
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Calculates remaining hours and minutes until an armed alarm triggers.
 */
export function calculateAlarmCountdown(
  alarm: Pick<ArmedAlarm, 'eventStartTimeISO' | 'leadTimeMinutes'>,
  nowMs: number
): {
  triggerTimeMs: number;
  remainingMs: number;
  formattedCountdown: string;
} {
  const eventStartMs = new Date(alarm.eventStartTimeISO).getTime();
  const triggerTimeMs = eventStartMs - alarm.leadTimeMinutes * 60 * 1000;
  const diffMs = Math.max(0, triggerTimeMs - nowMs);

  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const mins = totalMinutes % 60;

  const pad = (n: number) => String(n).padStart(2, '0');
  const formattedCountdown =
    days > 0
      ? `${days}D ${pad(hours)}H ${pad(mins)}M`
      : `${pad(hours)}H ${pad(mins)}M`;

  return {
    triggerTimeMs,
    remainingMs: diffMs,
    formattedCountdown,
  };
}

/**
 * Searches and filters Archive Vault items by query string and sport filter.
 */
export function filterArchiveItems(
  items: ArchiveItem[],
  query: string,
  sportFilter: SportFilter
): ArchiveItem[] {
  const normalized = query.trim().toLowerCase();

  return items.filter((item) => {
    if (sportFilter !== 'ALL' && item.sport !== sportFilter) {
      return false;
    }

    if (!normalized) return true;

    if (item.sport === 'FOOTBALL') {
      const searchable = [
        item.competition,
        item.matchweek,
        item.homeTeam.name,
        item.homeTeam.code,
        item.awayTeam.name,
        item.awayTeam.code,
        item.venue,
        ...item.timeline.map((t) => t.player),
      ]
        .join(' ')
        .toLowerCase();
      return searchable.includes(normalized);
    } else {
      const searchable = [
        item.grandPrixName,
        item.circuitName,
        item.fastestLap.driverName,
        ...item.podium.map((p) => `${p.driverName} ${p.constructorName}`),
        ...item.classificationTop10.map(
          (c) => `${c.driverName} ${c.driverCode} ${c.constructorName}`
        ),
      ]
        .join(' ')
        .toLowerCase();
      return searchable.includes(normalized);
    }
  });
}

/**
 * Formats a given UTC timestamp into a live 12-hour IST Clock string "HH:MM:SS AM/PM IST" (UTC+5:30).
 */
export function formatISTClock(nowMs: number = Date.now()): string {
  // IST is UTC + 5 hours 30 minutes (19800000 ms)
  const istDate = new Date(nowMs + 5.5 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  const hours24 = istDate.getUTCHours();
  const period = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  const hh = pad(hours12);
  const mm = pad(istDate.getUTCMinutes());
  const ss = pad(istDate.getUTCSeconds());
  return `${hh}:${mm}:${ss} ${period} IST`;
}
