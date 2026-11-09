import { CircuitSvgId, F1Session, F1Weekend, FootballMatch } from '../types/sports';
import { COMPETITION_LOGOS, FOOTBALL_CLUB_LOGOS, GP_FLAGS } from '../data/logos';
import {
  evaluateStrictEventStatus,
  fetchWithResilience,
  TTL_LIVE_MS,
  TTL_SCHEDULE_ROSTER_MS,
} from '../services/apiClient';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const NEUTRAL_CLUB_CREST_FALLBACK =
  'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/No_image_available.svg/240px-No_image_available.svg.png';

export interface NormalizedClubTeam {
  id: string;
  name: string;
  code: string;
  logo: string;
  primaryColor: string;
  form: ('W' | 'D' | 'L')[];
}

function toISTDateTimeLabels(isoString: string): {
  istDateLabel: string;
  istTimeLabel: string;
} {
  const utcMs = new Date(isoString).getTime();
  const istDate = new Date(utcMs + IST_OFFSET_MS);

  const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const months = [
    'JAN',
    'FEB',
    'MAR',
    'APR',
    'MAY',
    'JUN',
    'JUL',
    'AUG',
    'SEP',
    'OCT',
    'NOV',
    'DEC',
  ];

  const dayName = days[istDate.getUTCDay()];
  const dayNum = String(istDate.getUTCDate()).padStart(2, '0');
  const monthName = months[istDate.getUTCMonth()];

  let hours = istDate.getUTCHours();
  const mins = String(istDate.getUTCMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  if (hours === 0) hours = 12;
  const hourStr = String(hours).padStart(2, '0');

  return {
    istDateLabel: `${dayName}, ${dayNum} ${monthName}`,
    istTimeLabel: `${hourStr}:${mins} ${ampm} IST`,
  };
}

function toTrackTimeLabel(isoString: string, offsetMinutes: number, tzAbbr: string): string {
  const d = new Date(new Date(isoString).getTime() + offsetMinutes * 60 * 1000);
  const hours = String(d.getUTCHours()).padStart(2, '0');
  const mins = String(d.getUTCMinutes()).padStart(2, '0');
  return `${hours}:${mins} ${tzAbbr}`;
}

function toStadiumTimeLabel(isoString: string, offsetMinutes: number, tzAbbr: string): string {
  const d = new Date(new Date(isoString).getTime() + offsetMinutes * 60 * 1000);
  let hours = d.getUTCHours();
  const mins = String(d.getUTCMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  if (hours === 0) hours = 12;
  const hourStr = String(hours).padStart(2, '0');
  return `${hourStr}:${mins} ${ampm} ${tzAbbr}`;
}

function formatESPNDateParam(ms: number): string {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

const CIRCUIT_TRACK_META: Record<
  string,
  {
    offsetMinutes: number;
    tzAbbr: string;
    circuitSvgId: CircuitSvgId;
    lapLengthKm: string;
    totalLaps: number;
    drsZones: number;
    lapRecord: string;
    countryFlagUrl: string;
    hostName: string;
  }
> = {
  americas: {
    offsetMinutes: -300,
    tzAbbr: 'CDT',
    circuitSvgId: 'cota',
    lapLengthKm: '5.513 km',
    totalLaps: 56,
    drsZones: 2,
    lapRecord: '1:36.169 (C. Leclerc, 2019)',
    countryFlagUrl: GP_FLAGS.US,
    hostName: 'Austin',
  },
  rodriguez: {
    offsetMinutes: -360,
    tzAbbr: 'CST',
    circuitSvgId: 'mexico',
    lapLengthKm: '4.304 km',
    totalLaps: 71,
    drsZones: 3,
    lapRecord: '1:17.774 (V. Bottas, 2021)',
    countryFlagUrl: GP_FLAGS.MX,
    hostName: 'Mexico City',
  },
  interlagos: {
    offsetMinutes: -180,
    tzAbbr: 'BRT',
    circuitSvgId: 'interlagos',
    lapLengthKm: '4.309 km',
    totalLaps: 71,
    drsZones: 2,
    lapRecord: '1:10.540 (V. Bottas, 2018)',
    countryFlagUrl: GP_FLAGS.BR,
    hostName: 'São Paulo',
  },
  vegas: {
    offsetMinutes: -480,
    tzAbbr: 'PST',
    circuitSvgId: 'vegas',
    lapLengthKm: '6.201 km',
    totalLaps: 50,
    drsZones: 2,
    lapRecord: '1:35.490 (O. Piastri, 2024)',
    countryFlagUrl: GP_FLAGS.US,
    hostName: 'Las Vegas',
  },
  losail: {
    offsetMinutes: 180,
    tzAbbr: 'AST',
    circuitSvgId: 'lusail',
    lapLengthKm: '5.419 km',
    totalLaps: 57,
    drsZones: 1,
    lapRecord: '1:24.319 (M. Verstappen, 2023)',
    countryFlagUrl: GP_FLAGS.QA,
    hostName: 'Lusail',
  },
  yas_marina: {
    offsetMinutes: 240,
    tzAbbr: 'GST',
    circuitSvgId: 'yas_marina',
    lapLengthKm: '5.281 km',
    totalLaps: 58,
    drsZones: 2,
    lapRecord: '1:26.103 (M. Verstappen, 2021)',
    countryFlagUrl: GP_FLAGS.AE,
    hostName: 'Abu Dhabi',
  },
};

const CLUB_CODE_LOGO_MAP: Record<string, { logo: string; primaryColor: string }> = Object.fromEntries(
  Object.entries(FOOTBALL_CLUB_LOGOS).map(([code, logo]) => [
    code,
    { logo, primaryColor: '#00E5FF' },
  ])
);

/**
 * Normalizes any ESPN club competitor object into a verified club team object
 * without truncating 4+ character club codes (`CFC_ISL`, `COMO`, `KBFC`, `MBSG`, `EBFC`)
 * or colliding on ambiguous 3-letter codes (`CFC`).
 * Also extracts `teamObj?.logo || teamObj?.logos?.[0]?.href` and uses a neutral
 * shield fallback instead of defaulting to Real Madrid's crest.
 */
export function normalizeClubIdentity(
  teamObj: any,
  leagueSlug?: string
): NormalizedClubTeam {
  const rawAbbr = (teamObj?.abbreviation || 'CLB').toUpperCase().trim();
  const rawName = teamObj?.shortDisplayName || teamObj?.displayName || teamObj?.name || 'Club';
  const lowerName = rawName.toLowerCase();

  let code = rawAbbr;
  if (lowerName.includes('bayern') || ((rawAbbr === 'MUN' || rawAbbr === 'FCB') && leagueSlug === 'ger.1')) {
    code = 'BAY';
  } else if (lowerName.includes('manchester united') || lowerName === 'man united' || lowerName === 'man utd' || rawAbbr === 'MU' || rawAbbr === 'MUN' || (rawAbbr === 'MAN' && lowerName.includes('united'))) {
    code = 'MUN';
  } else if (rawAbbr === 'MC' || rawAbbr === 'MAN' || lowerName.includes('manchester city')) {
    code = 'MCI';
  } else if (rawAbbr === 'RM' || rawAbbr === 'RMA' || lowerName.includes('real madrid')) {
    code = 'RMA';
  } else if (rawAbbr === 'FCB' || lowerName.includes('barcelona')) {
    code = 'BAR';
  } else if (rawAbbr === 'MIL' || lowerName.includes('ac milan')) {
    code = 'ACM';
  } else if (rawAbbr === 'INT' && (lowerName.includes('internacional') || leagueSlug === 'bra.1')) {
    code = 'SCI';
  } else if (rawAbbr === 'INT' || lowerName.includes('inter milan') || lowerName.includes('internazionale')) {
    code = 'INT';
  } else if (rawAbbr === 'AVL' || lowerName.includes('aston villa')) {
    code = 'AVL';
  } else if (lowerName.includes('nottingham') || rawAbbr === 'NFO') {
    code = 'NFO';
  } else if (lowerName.includes('arsenal') || rawAbbr === 'ARS') {
    code = 'ARS';
  } else if (lowerName.includes('paris saint-germain') || lowerName.includes('paris sg') || rawAbbr === 'PSG') {
    code = 'PSG';
  } else if (lowerName.includes('chennaiyin') || (rawAbbr === 'CFC' && leagueSlug === 'ind.1')) {
    code = 'CFC_ISL';
  } else if (lowerName.includes('chelsea') || (rawAbbr === 'CFC' && leagueSlug === 'eng.1')) {
    code = 'CHE';
  } else if (lowerName.includes('kerala blasters') || rawAbbr === 'KBFC') {
    code = 'KBFC';
  } else if (lowerName.includes('mohun bagan') || rawAbbr === 'MBSG') {
    code = 'MBSG';
  } else if (lowerName.includes('east bengal') || rawAbbr === 'EBFC') {
    code = 'EBFC';
  } else if (lowerName.includes('mumbai city') || rawAbbr === 'MCFC') {
    code = 'MCFC';
  } else if (lowerName.includes('northeast united') || rawAbbr === 'NEUFC') {
    code = 'NEUFC';
  } else if (lowerName.includes('como') || rawAbbr === 'COMO') {
    code = 'COMO';
  }

  const mapped = CLUB_CODE_LOGO_MAP[code];
  const espnLogo =
    teamObj?.logo ||
    teamObj?.logos?.[0]?.href ||
    teamObj?.logos?.[0]?.url ||
    undefined;

  const rawColor =
    typeof teamObj?.color === 'string' && teamObj.color.trim().length >= 3
      ? `#${teamObj.color.replace(/^#/, '')}`
      : undefined;

  return {
    id: `team-${code.toLowerCase()}`,
    name: rawName,
    code,
    logo: mapped?.logo || espnLogo || NEUTRAL_CLUB_CREST_FALLBACK,
    primaryColor: mapped?.primaryColor || rawColor || '#00E5FF',
    form: ['W', 'D', 'W', 'W', 'D'],
  };
}

export interface LiveSportsSyncResult {
  f1Weekends: F1Weekend[];
  footballMatches: FootballMatch[];
  syncedAtLabel: string;
  f1RacesCount: number;
  footballMatchesCount: number;
}

/**
 * Fetches live F1 and Football schedules + live scores from Jolpica-F1 and ESPN Public APIs:
 * 1. Routes all network calls through `fetchWithResilience` (persistent slice caching + CORS fallback).
 * 2. Dynamically computes date windows from `Date.now()` so 2026/2027 seasons never freeze.
 * 3. Extracts ESPN `status.type.state` ('pre' | 'in' | 'post'), `homeRaw.score`, `awayRaw.score`,
 *    and `displayClock` so live and completed matches update scores in real time.
 * 4. Ingests all clubs across supported leagues without dropping newly followed teams (e.g., PSG, ISL, etc.).
 */
export async function syncRealSportsData(
  fallbackF1: F1Weekend[],
  fallbackFootball: FootballMatch[],
  options?: { forceRefresh?: boolean; nowMs?: number }
): Promise<LiveSportsSyncResult> {
  const referenceNowMs = options?.nowMs ?? Date.now();
  let syncedF1: F1Weekend[] = [...fallbackF1];
  let syncedFootball: FootballMatch[] = [...fallbackFootball];

  // 1. Fetch Real F1 Schedule from Jolpica (Ergast compatible API) via fetchWithResilience
  try {
    const f1Json = await fetchWithResilience<any>(
      'https://api.jolpi.ca/ergast/f1/current.json',
      {
        cacheKey: 'jolpica_f1_current_schedule',
        ttlMs: TTL_SCHEDULE_ROSTER_MS,
        forceRefresh: options?.forceRefresh,
      }
    );
    const races: any[] = f1Json?.MRData?.RaceTable?.Races || [];

    if (races.length > 0) {
      // Dynamic 6-hour buffer before referenceNowMs so an active Grand Prix isn't hidden mid-session
      const activeCutoffMs = referenceNowMs - 6 * 60 * 60 * 1000;
      const upcomingRaces = races
        .filter((r) => {
          const raceDateStr = `${r.date}T${r.time || '14:00:00Z'}`;
          return new Date(raceDateStr).getTime() >= activeCutoffMs;
        })
        .slice(0, 6);

      if (upcomingRaces.length > 0) {
        const parsedWeekends: F1Weekend[] = upcomingRaces.map((r, idx) => {
          const circuitId = r.Circuit?.circuitId || 'interlagos';
          const meta = CIRCUIT_TRACK_META[circuitId] || CIRCUIT_TRACK_META.interlagos;
          const roundNum = Number(r.round) || 21;

          const buildSession = (
            idSuffix: string,
            name: F1Session['name'],
            sObj: { date?: string; time?: string } | undefined,
            fallbackDate: string,
            fallbackTime: string
          ): F1Session => {
            const dStr = sObj?.date || fallbackDate;
            const tStr = sObj?.time || fallbackTime;
            const iso = `${dStr}T${tStr}`;
            const { istDateLabel, istTimeLabel } = toISTDateTimeLabels(iso);
            const sessionStatus = evaluateStrictEventStatus({
              startTimeISO: iso,
              durationMinutes: name === 'Grand Prix' ? 120 : 65,
              nowMs: referenceNowMs,
            });
            return {
              id: `f1-r${roundNum}-${idSuffix}`,
              name,
              shortLabel: name.toUpperCase(),
              trackLocalTimeLabel: toTrackTimeLabel(iso, meta.offsetMinutes, meta.tzAbbr),
              istTimeLabel,
              istDateLabel,
              startTimeISO: iso,
              durationMinutes: name === 'Grand Prix' ? 120 : 60,
              status: sessionStatus === 'FINAL' ? 'COMPLETED' : sessionStatus,
            };
          };

          const isSprint = Boolean(r.Sprint);
          const sessions: F1Session[] = [];

          if (r.FirstPractice) {
            sessions.push(
              buildSession('fp1', 'FP1', r.FirstPractice, r.date, '12:30:00Z')
            );
          }

          if (isSprint) {
            const sqObj = r.SprintQualifying || r.SecondPractice;
            if (sqObj) {
              sessions.push(
                buildSession('sq', 'Sprint Qualifying', sqObj, r.date, '16:30:00Z')
              );
            }
            if (r.Sprint) {
              sessions.push(
                buildSession('sprint', 'Sprint', r.Sprint, r.date, '15:00:00Z')
              );
            }
          } else {
            if (r.SecondPractice) {
              sessions.push(
                buildSession('fp2', 'FP2', r.SecondPractice, r.date, '16:00:00Z')
              );
            }
            if (r.ThirdPractice) {
              sessions.push(
                buildSession('fp3', 'FP3', r.ThirdPractice, r.date, '12:30:00Z')
              );
            }
          }

          if (r.Qualifying) {
            sessions.push(
              buildSession('quali', 'Qualifying', r.Qualifying, r.date, '16:00:00Z')
            );
          }

          const gpIso = `${r.date}T${r.time || '14:00:00Z'}`;
          const gpIst = toISTDateTimeLabels(gpIso);
          const gpRuntimeStatus = evaluateStrictEventStatus({
            startTimeISO: gpIso,
            durationMinutes: 120,
            nowMs: referenceNowMs,
          });
          sessions.push({
            id: `f1-r${roundNum}-gp`,
            name: 'Grand Prix',
            shortLabel: 'GRAND PRIX',
            trackLocalTimeLabel: toTrackTimeLabel(gpIso, meta.offsetMinutes, meta.tzAbbr),
            istTimeLabel: gpIst.istTimeLabel,
            istDateLabel: gpIst.istDateLabel,
            startTimeISO: gpIso,
            durationMinutes: 120,
            status: gpRuntimeStatus === 'FINAL' ? 'COMPLETED' : gpRuntimeStatus,
          });

          const firstDate = sessions[0]?.istDateLabel.split(', ')[1] || '01 NOV';
          const lastDate =
            sessions[sessions.length - 1]?.istDateLabel.split(', ')[1] || '03 NOV';
          const raceYear = (new Date(gpIso).getUTCFullYear() || 2026) as 2025 | 2026 | 2027;
          const raceStartMs = new Date(gpIso).getTime();
          const daysUntilRace = (raceStartMs - referenceNowMs) / (24 * 60 * 60 * 1000);

          const dynamicTimeWindow: F1Weekend['timeWindow'] =
            idx === 0 && daysUntilRace <= 7
              ? 'THIS_WEEK'
              : daysUntilRace <= 15
              ? 'NEXT_WEEK'
              : 'ALL_UPCOMING';

          return {
            id: `f1-wknd-r${roundNum}`,
            sport: 'F1',
            seasonYear: raceYear,
            round: roundNum,
            grandPrixName: r.raceName || 'Grand Prix',
            officialTitle: `FORMULA 1 ${(r.raceName || 'GRAND PRIX').toUpperCase()} ${raceYear}`,
            circuitName: r.Circuit?.circuitName || 'Formula 1 Circuit',
            city: r.Circuit?.Location?.locality || meta.hostName,
            hostName: meta.hostName,
            countryName: r.Circuit?.Location?.country || meta.hostName,
            countryFlagUrl: meta.countryFlagUrl,
            circuitSvgId: meta.circuitSvgId,
            isSprintWeekend: isSprint,
            laps: meta.totalLaps,
            circuitLengthKm: meta.lapLengthKm,
            raceDistanceKm: '305.879 km',
            sessions,
            timeWindow: dynamicTimeWindow,
            dateRangePill: `${firstDate} - ${lastDate}`,
            dateRangeLabel: `${firstDate.slice(0, 2)} – ${lastDate} ${raceYear}`,
            status: sessions.some((s) => s.status === 'LIVE')
              ? 'LIVE'
              : sessions.every((s) => s.status === 'COMPLETED')
              ? 'COMPLETED'
              : 'UPCOMING',
            prefetchMeta: {
              trackTempForecast: '28°C Track Surface',
              rainChance: '15%',
              tyreAllocation: 'C3 (Hard) • C4 (Medium) • C5 (Soft)',
              lapRecord: meta.lapRecord,
              drsZones: meta.drsZones,
              circuitLengthKm: meta.lapLengthKm,
              raceDistanceLaps: meta.totalLaps,
            },
          };
        });

        syncedF1 = parsedWeekends;
      }
    }
  } catch {
    // Keep fallbackF1 if Jolpica API is unreachable
  }

  // 2. Fetch Real Football Fixtures & Live Scores from ESPN Public API via fetchWithResilience
  try {
    // Query single-day `?dates=YYYYMMDD` endpoints across a rolling window because ESPN rejects hyphenated ranges
    const dayMs = 24 * 60 * 60 * 1000;
    const queryDates = [-4, -3, -2, -1, 0, 1, 2].map((offset) =>
      formatESPNDateParam(referenceNowMs + offset * dayMs)
    );

    const leagueDefs = [
      {
        league: 'UEFA Champions League',
        logo: COMPETITION_LOGOS.UCL,
        slug: 'uefa.champions',
        tzOffset: 60,
        tzAbbr: 'CET',
      },
      {
        league: 'Premier League',
        logo: COMPETITION_LOGOS.PL,
        slug: 'eng.1',
        tzOffset: 0,
        tzAbbr: 'GMT',
      },
      {
        league: 'LaLiga',
        logo: COMPETITION_LOGOS.LALIGA,
        slug: 'esp.1',
        tzOffset: 60,
        tzAbbr: 'CET',
      },
      {
        league: 'Serie A',
        logo: COMPETITION_LOGOS.SERIEA,
        slug: 'ita.1',
        tzOffset: 60,
        tzAbbr: 'CET',
      },
      {
        league: 'Bundesliga',
        logo: COMPETITION_LOGOS.BUNDESLIGA,
        slug: 'ger.1',
        tzOffset: 60,
        tzAbbr: 'CET',
      },
      {
        league: 'Ligue 1',
        logo: COMPETITION_LOGOS.LIGUE1,
        slug: 'fra.1',
        tzOffset: 60,
        tzAbbr: 'CET',
      },
      {
        league: 'Indian Super League',
        logo: COMPETITION_LOGOS.ISL,
        slug: 'ind.1',
        tzOffset: 330,
        tzAbbr: 'IST',
      },
    ];

    const responses = await Promise.allSettled(
      leagueDefs.map(async (ep) => {
        const dayPayloads = await Promise.all(
          queryDates.map((dateStr) =>
            fetchWithResilience<any>(
              `https://site.api.espn.com/apis/site/v2/sports/soccer/${ep.slug}/scoreboard?dates=${dateStr}`,
              {
                cacheKey: `espn_live_sync_${ep.slug}_${dateStr}`,
                ttlMs: TTL_LIVE_MS,
                forceRefresh: options?.forceRefresh,
              }
            ).catch(() => null)
          )
        );
        const mergedEvents: any[] = [];
        const seenIds = new Set<string>();
        for (const p of dayPayloads) {
          for (const ev of p?.events || []) {
            if (ev?.id && !seenIds.has(String(ev.id))) {
              seenIds.add(String(ev.id));
              mergedEvents.push(ev);
            }
          }
        }
        return { ep, events: mergedEvents };
      })
    );

    const parsedMatchesById = new Map<string, FootballMatch>();

    for (const m of fallbackFootball) {
      parsedMatchesById.set(m.id, m);
    }

    for (const res of responses) {
      if (res.status !== 'fulfilled') continue;
      const { ep, events } = res.value;

      for (const ev of events) {
        const comp = ev.competitions?.[0];
        if (!comp) continue;
        const competitors: any[] = comp.competitors || [];
        const homeRaw =
          competitors.find((c) => c.homeAway === 'home') || competitors[0];
        const awayRaw =
          competitors.find((c) => c.homeAway === 'away') || competitors[1];
        if (!homeRaw || !awayRaw) continue;

        const homeTeam = normalizeClubIdentity(homeRaw.team, ep.slug);
        const awayTeam = normalizeClubIdentity(awayRaw.team, ep.slug);

        const iso = ev.date || comp.date || new Date(referenceNowMs).toISOString();
        const { istDateLabel, istTimeLabel } = toISTDateTimeLabels(iso);
        const venueName = comp.venue?.fullName || 'Official Stadium';
        const venueCity = comp.venue?.address?.city || '';

        const rawState = String(
          comp.status?.type?.state || ev.status?.type?.state || 'pre'
        ).toLowerCase() as 'pre' | 'in' | 'post';
        const isCompleted = Boolean(
          comp.status?.type?.completed ?? ev.status?.type?.completed ?? rawState === 'post'
        );

        const computedStatus = evaluateStrictEventStatus({
          startTimeISO: iso,
          durationMinutes: 115,
          apiState: isCompleted ? 'post' : rawState,
          nowMs: referenceNowMs,
        });

        const parsedHomeScore =
          homeRaw.score !== undefined && homeRaw.score !== null && String(homeRaw.score).trim() !== ''
            ? Number(homeRaw.score)
            : undefined;
        const parsedAwayScore =
          awayRaw.score !== undefined && awayRaw.score !== null && String(awayRaw.score).trim() !== ''
            ? Number(awayRaw.score)
            : undefined;

        const includeScores = computedStatus === 'LIVE' || computedStatus === 'FINAL';
        const homeScore =
          includeScores && typeof parsedHomeScore === 'number' && !Number.isNaN(parsedHomeScore)
            ? parsedHomeScore
            : undefined;
        const awayScore =
          includeScores && typeof parsedAwayScore === 'number' && !Number.isNaN(parsedAwayScore)
            ? parsedAwayScore
            : undefined;

        const rawClock =
          comp.status?.type?.shortDetail ||
          ev.status?.type?.shortDetail ||
          comp.status?.displayClock ||
          ev.status?.displayClock ||
          undefined;

        const liveMinute =
          computedStatus === 'LIVE'
            ? rawClock || 'LIVE'
            : computedStatus === 'FINAL'
            ? 'FT'
            : undefined;

        const kickoffMs = new Date(iso).getTime();
        const diffDays = (kickoffMs - referenceNowMs) / (24 * 60 * 60 * 1000);
        const timeWindow: FootballMatch['timeWindow'] =
          computedStatus === 'FINAL' && diffDays < -1
            ? 'PAST_RESULTS'
            : diffDays <= 7
            ? 'THIS_WEEK'
            : 'NEXT_WEEK';

        const matchId = `espn-${ev.id || `${homeTeam.code}-${awayTeam.code}-${iso.slice(0, 10)}`}`;

        let targetId = matchId;
        for (const [existingId, existingMatch] of parsedMatchesById.entries()) {
          if (
            existingMatch.homeTeam.code === homeTeam.code &&
            existingMatch.awayTeam.code === awayTeam.code &&
            Math.abs(new Date(existingMatch.startTimeISO).getTime() - kickoffMs) <=
              36 * 60 * 60 * 1000
          ) {
            targetId = existingId;
            break;
          }
        }

        const existingMatch = parsedMatchesById.get(targetId);

        parsedMatchesById.set(targetId, {
          ...(existingMatch || {}),
          id: targetId,
          sport: 'FOOTBALL',
          competition: ep.league,
          competitionLogo: existingMatch?.competitionLogo || ep.logo,
          matchweek: existingMatch?.matchweek || 'Official Fixture',
          homeTeam,
          awayTeam,
          venue: venueName,
          city: venueCity,
          stadiumLocalTimeLabel: toStadiumTimeLabel(iso, ep.tzOffset, ep.tzAbbr),
          istDateLabel,
          istTimeLabel,
          startTimeISO: iso,
          durationMinutes: 115,
          timeWindow,
          liveStatus: computedStatus,
          liveMinute,
          homeScore: homeScore ?? existingMatch?.homeScore,
          awayScore: awayScore ?? existingMatch?.awayScore,
          prefetchMeta: existingMatch?.prefetchMeta || {
            referee: 'Official Match Referee',
            weather: '16°C Clear',
            winProbability: { home: 40, draw: 25, away: 35 },
            headToHeadSummary: `${homeTeam.name} vs ${awayTeam.name}`,
            keyPlayersToWatch: [homeTeam.name, awayTeam.name],
          },
        });
      }
    }

    syncedFootball = Array.from(parsedMatchesById.values()).sort(
      (a, b) => new Date(a.startTimeISO).getTime() - new Date(b.startTimeISO).getTime()
    );
  } catch {
    // Keep fallbackFootball if ESPN API fails
  }

  const nowIst = toISTDateTimeLabels(new Date(referenceNowMs).toISOString());
  return {
    f1Weekends: syncedF1,
    footballMatches: syncedFootball,
    syncedAtLabel: `${nowIst.istDateLabel} • ${nowIst.istTimeLabel}`,
    f1RacesCount: syncedF1.length,
    footballMatchesCount: syncedFootball.length,
  };
}
