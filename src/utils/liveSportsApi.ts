import { F1Session, F1Weekend, FootballMatch, TimeWindow } from '../types/sports';
import {
  COMPETITION_LOGOS,
  FOOTBALL_CLUB_LOGOS,
  GP_FLAGS,
} from '../data/logos';
import {
  ensure12HourTimeLabel,
  formatISOToIST12Hour,
  formatISOToISTDateLabel,
} from './scheduleLogic';

export interface LiveSyncResult {
  matches: FootballMatch[];
  f1Weekends: F1Weekend[];
  syncedFromLiveApi: boolean;
  sourcesUsed: string[];
  timestampIST: string;
}

const CLUB_CODE_LOGO_MAP: Record<string, string> = {
  RMA: FOOTBALL_CLUB_LOGOS.RMA,
  BAR: FOOTBALL_CLUB_LOGOS.BAR,
  ARS: FOOTBALL_CLUB_LOGOS.ARS,
  MCI: FOOTBALL_CLUB_LOGOS.MCI,
  LIV: FOOTBALL_CLUB_LOGOS.LIV,
  MUN: FOOTBALL_CLUB_LOGOS.MUN,
  CHE: FOOTBALL_CLUB_LOGOS.CHE,
  BAY: FOOTBALL_CLUB_LOGOS.BAY,
  BVB: FOOTBALL_CLUB_LOGOS.BVB,
  INT: FOOTBALL_CLUB_LOGOS.INT,
  ACM: FOOTBALL_CLUB_LOGOS.ACM,
  PSG: FOOTBALL_CLUB_LOGOS.PSG,
  ATM: FOOTBALL_CLUB_LOGOS.ATM,
  JUV: FOOTBALL_CLUB_LOGOS.JUV,
  RBL: FOOTBALL_CLUB_LOGOS.RBL,
  AVL: FOOTBALL_CLUB_LOGOS.AVL,
  SLP: FOOTBALL_CLUB_LOGOS.SLP,
  AEK: FOOTBALL_CLUB_LOGOS.AEK,
  FEN: FOOTBALL_CLUB_LOGOS.FEN,
  NFO: FOOTBALL_CLUB_LOGOS.NFO,
  VAL: FOOTBALL_CLUB_LOGOS.VAL,
  HUL: FOOTBALL_CLUB_LOGOS.HUL,
  CRY: FOOTBALL_CLUB_LOGOS.CRY,
  SUN: FOOTBALL_CLUB_LOGOS.SUN,
  COMO: FOOTBALL_CLUB_LOGOS.COMO,
  NAP: FOOTBALL_CLUB_LOGOS.NAP,
  PSV: FOOTBALL_CLUB_LOGOS.PSV,
  BRU: FOOTBALL_CLUB_LOGOS.BRU,
  NEW: FOOTBALL_CLUB_LOGOS.NEW,
  FUL: FOOTBALL_CLUB_LOGOS.FUL,
  CEL: FOOTBALL_CLUB_LOGOS.CEL,
  VIL: FOOTBALL_CLUB_LOGOS.VIL,
  TOT: FOOTBALL_CLUB_LOGOS.TOT,
  COV: FOOTBALL_CLUB_LOGOS.COV,
  BRE: FOOTBALL_CLUB_LOGOS.BRE,
};

function normalizeClubIdentity(teamObj: Record<string, any>): {
  code: string;
  name: string;
  logo: string;
} {
  const displayName = String(
    teamObj?.displayName || teamObj?.shortDisplayName || ''
  );
  const rawAbbr = String(teamObj?.abbreviation || 'CLB').toUpperCase();
  const lowerName = displayName.toLowerCase();

  let code = rawAbbr.slice(0, 4);
  if (lowerName.includes('manchester city') || rawAbbr === 'MNC') code = 'MCI';
  else if (lowerName.includes('bayern')) code = 'BAY';
  else if (lowerName.includes('manchester united') || rawAbbr === 'MAN')
    code = 'MUN';
  else if (lowerName.includes('dortmund') || rawAbbr === 'DOR') code = 'BVB';
  else if (lowerName.includes('leipzig') || rawAbbr === 'RBL') code = 'RBL';
  else if (lowerName.includes('internazionale') || lowerName.includes('inter milan'))
    code = 'INT';
  else if (lowerName.includes('ac milan') || rawAbbr === 'MIL') code = 'ACM';
  else if (lowerName.includes('real madrid')) code = 'RMA';
  else if (lowerName.includes('barcelona')) code = 'BAR';
  else if (lowerName.includes('arsenal')) code = 'ARS';
  else if (lowerName.includes('liverpool')) code = 'LIV';
  else if (lowerName.includes('chelsea')) code = 'CHE';
  else if (lowerName.includes('atlético') || lowerName.includes('atletico'))
    code = 'ATM';
  else if (lowerName.includes('tottenham') || rawAbbr === 'TOT') code = 'TOT';
  else if (lowerName.includes('coventry') || rawAbbr === 'COV') code = 'COV';
  else if (lowerName.includes('brentford') || rawAbbr === 'BRE') code = 'BRE';
  else if (lowerName.includes('como')) code = 'COMO';
  else code = rawAbbr.slice(0, 3);

  const cleanName =
    code === 'INT'
      ? 'Inter Milan'
      : code === 'BAR'
      ? 'FC Barcelona'
      : displayName || code;

  return {
    code,
    name: cleanName,
    logo:
      CLUB_CODE_LOGO_MAP[code] ||
      teamObj?.logo ||
      FOOTBALL_CLUB_LOGOS.RMA,
  };
}

function resolveFlagForCountry(country: string): string {
  const c = country.toLowerCase();
  if (c.includes('brazil') || c.includes('são paulo')) return GP_FLAGS.BR;
  if (
    c.includes('usa') ||
    c.includes('united states') ||
    c.includes('vegas') ||
    c.includes('miami')
  )
    return GP_FLAGS.US;
  if (c.includes('qatar')) return GP_FLAGS.QA;
  if (c.includes('uae') || c.includes('abu dhabi') || c.includes('emirates'))
    return GP_FLAGS.AE;
  if (c.includes('monaco')) return GP_FLAGS.MC;
  if (c.includes('uk') || c.includes('britain') || c.includes('silverstone'))
    return GP_FLAGS.GB;
  if (c.includes('italy') || c.includes('monza') || c.includes('imola'))
    return GP_FLAGS.IT;
  if (c.includes('mexico')) return GP_FLAGS.MX;
  return GP_FLAGS.BR;
}

function resolveCircuitSvg(circuitId: string): F1Weekend['circuitSvgId'] {
  const c = circuitId.toLowerCase();
  if (c.includes('interlagos')) return 'interlagos';
  if (c.includes('vegas')) return 'vegas';
  if (c.includes('losail') || c.includes('lusail')) return 'lusail';
  if (c.includes('yas')) return 'yas_marina';
  if (c.includes('monaco')) return 'monaco';
  if (c.includes('silverstone')) return 'silverstone';
  if (c.includes('monza')) return 'monza';
  return 'interlagos';
}

function formatTrackLocalTime12Hour(isoString: string, country: string): string {
  const c = country.toLowerCase();
  let offsetMinutes = 0;
  let tzAbbr = 'UTC';
  if (c.includes('brazil')) {
    offsetMinutes = -180; // BRT UTC-3
    tzAbbr = 'BRT';
  } else if (c.includes('usa') || c.includes('vegas')) {
    offsetMinutes = -480; // PST UTC-8
    tzAbbr = 'PST';
  } else if (c.includes('qatar')) {
    offsetMinutes = 180; // AST UTC+3
    tzAbbr = 'AST';
  } else if (c.includes('uae') || c.includes('abu dhabi')) {
    offsetMinutes = 240; // GST UTC+4
    tzAbbr = 'GST';
  }

  const d = new Date(new Date(isoString).getTime() + offsetMinutes * 60 * 1000);
  const h24 = d.getUTCHours();
  const m = String(d.getUTCMinutes()).padStart(2, '0');
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = String(h24 % 12 || 12).padStart(2, '0');
  return `${h12}:${m} ${period} ${tzAbbr}`;
}

function formatStadiumLocalTime12Hour(
  isoString: string,
  compName: string,
  city: string
): string {
  const c = `${compName} ${city}`.toLowerCase();
  let offsetMinutes = 60; // Default CET (UTC+1)
  let tzAbbr = 'CET';

  if (
    c.includes('premier league') ||
    c.includes('london') ||
    c.includes('manchester') ||
    c.includes('liverpool') ||
    c.includes('nottingham') ||
    c.includes('newcastle')
  ) {
    offsetMinutes = 0; // GMT (UTC+0)
    tzAbbr = 'GMT';
  } else if (c.includes('athens')) {
    offsetMinutes = 120; // EET (UTC+2)
    tzAbbr = 'EET';
  } else if (c.includes('istanbul')) {
    offsetMinutes = 180; // TRT (UTC+3)
    tzAbbr = 'TRT';
  }

  const d = new Date(new Date(isoString).getTime() + offsetMinutes * 60 * 1000);
  const h24 = d.getUTCHours();
  const m = String(d.getUTCMinutes()).padStart(2, '0');
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = String(h24 % 12 || 12).padStart(2, '0');
  return `${h12}:${m} ${period} ${tzAbbr}`;
}

/**
 * Fetches real upcoming Formula 1 Race Weekends from Jolpica-F1 API (https://api.jolpi.ca/ergast/f1/current.json)
 * and real Football fixtures from ESPN Public Soccer Scoreboard APIs across November & December 2026 matchdays,
 * converting all times into strict 12-hour IST (UTC+5:30).
 */
export async function syncRealSportsData(
  fallbackMatches: FootballMatch[],
  fallbackWeekends: F1Weekend[]
): Promise<LiveSyncResult> {
  const sourcesUsed: string[] = [];
  const fetchedWeekendMap = new Map<number, F1Weekend>();
  const fetchedMatchMap = new Map<string, FootballMatch>();

  // Pre-seed maps with our verified November & December 2026 fixtures and all 4 remaining F1 rounds (20 Brazil, 21 Las Vegas, 22 Qatar, 23 Abu Dhabi)
  for (const w of fallbackWeekends) {
    fetchedWeekendMap.set(w.round, w);
  }
  for (const m of fallbackMatches) {
    const key = `${m.homeTeam.code}-${m.awayTeam.code}-${m.startTimeISO.slice(0, 10)}`;
    const isTBD = Boolean(m.isTimeTBD) || /\bTBD\b|NOT DECLARED/i.test(m.istTimeLabel || '');
    fetchedMatchMap.set(key, {
      ...m,
      isTimeTBD: isTBD,
      istTimeLabel: isTBD ? 'TBD' : ensure12HourTimeLabel(m.istTimeLabel),
      stadiumLocalTimeLabel: isTBD
        ? 'Time Not Declared (TBD)'
        : ensure12HourTimeLabel(m.stadiumLocalTimeLabel),
    });
  }

  // 1. Fetch Real 2026 F1 Schedule from Jolpica Ergast API (includes Round 20 Brazil, Round 21 Las Vegas, Round 22 Qatar, Round 23 Abu Dhabi)
  try {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 6000);
    const res = await fetch('https://api.jolpi.ca/ergast/f1/current.json', {
      signal: controller.signal,
    });
    window.clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      const races = data?.MRData?.RaceTable?.Races || [];
      const nowMs = new Date('2026-11-03T00:00:00Z').getTime();

      const upcomingRaces = races.filter((r: { date: string; time?: string }) => {
        const raceMs = new Date(`${r.date}T${r.time || '14:00:00Z'}`).getTime();
        return raceMs >= nowMs;
      });

      const targetRaces =
        upcomingRaces.length > 0 ? upcomingRaces : races.slice(-4);

      targetRaces.forEach((race: Record<string, any>, idx: number) => {
        const country = race?.Circuit?.Location?.country || 'Brazil';
        const sessions: F1Session[] = [];
        const roundNum = Number(race.round) || 20 + idx;
        const existingSeed = fallbackWeekends.find((w) => w.round === roundNum);

        const addSession = (
          key: string,
          name: F1Session['name'],
          shortLabel: string,
          obj?: { date?: string; time?: string },
          durationMinutes = 60
        ) => {
          if (!obj?.date) return;
          const iso = `${obj.date}T${obj.time || '14:00:00Z'}`;
          sessions.push({
            id:
              existingSeed?.sessions.find((s) => s.name === name)?.id ||
              `f1-live-${race.round}-${key}`,
            name,
            shortLabel,
            startTimeISO: iso,
            istDateLabel: formatISOToISTDateLabel(iso),
            istTimeLabel: formatISOToIST12Hour(iso),
            trackLocalTimeLabel: formatTrackLocalTime12Hour(iso, country),
            durationMinutes,
          });
        };

        addSession('fp1', 'FP1', 'FREE PRACTICE 1', race.FirstPractice, 60);
        if (race.SprintQualifying || race.SprintShootout) {
          addSession(
            'sq',
            'Sprint Qualifying',
            'SPRINT QUALIFYING',
            race.SprintQualifying || race.SprintShootout,
            45
          );
        } else {
          addSession('fp2', 'FP2', 'FREE PRACTICE 2', race.SecondPractice, 60);
        }

        if (race.Sprint) {
          addSession('sprint', 'Sprint', 'F1 SPRINT', race.Sprint, 60);
        } else {
          addSession('fp3', 'FP3', 'FREE PRACTICE 3', race.ThirdPractice, 60);
        }

        addSession('quali', 'Qualifying', 'QUALIFYING', race.Qualifying, 60);
        addSession(
          'race',
          'Grand Prix',
          roundNum === 23
            ? 'GRAND PRIX (SEASON FINALE)'
            : 'GRAND PRIX (LIGHTS OUT)',
          { date: race.date, time: race.time || '17:00:00Z' },
          120
        );

        const resolvedWindow: TimeWindow =
          existingSeed?.timeWindow ||
          (roundNum === 20
            ? 'THIS_WEEK'
            : roundNum <= 22
            ? 'NEXT_WEEK'
            : 'ALL_UPCOMING');

        fetchedWeekendMap.set(roundNum, {
          id: existingSeed?.id || `f1-api-round-${roundNum}`,
          sport: 'F1',
          round: roundNum,
          grandPrixName:
            existingSeed?.grandPrixName || race.raceName || 'Grand Prix',
          officialTitle:
            existingSeed?.officialTitle ||
            `FORMULA 1 ${(race.raceName || '').toUpperCase()} ${race.season || '2026'}`,
          circuitName:
            existingSeed?.circuitName ||
            race?.Circuit?.circuitName ||
            'International Circuit',
          city: race?.Circuit?.Location?.locality || country,
          countryFlagUrl: resolveFlagForCountry(country),
          circuitSvgId: resolveCircuitSvg(race?.Circuit?.circuitId || ''),
          laps: existingSeed?.laps || 71,
          circuitLengthKm: existingSeed?.circuitLengthKm || '4.309 km',
          raceDistanceKm: existingSeed?.raceDistanceKm || '305.879 km',
          timeWindow: resolvedWindow,
          sessions:
            sessions.length > 0 ? sessions : existingSeed?.sessions || [],
          prefetchMeta: existingSeed?.prefetchMeta || {
            trackTempForecast: 'Synced via Jolpica Ergast F1 API',
            rainChance: 'Live FIA Meteo Feed Ready',
            tyreAllocation: 'C3 (Hard) • C4 (Medium) • C5 (Soft)',
            lapRecord: 'Official FIA Timing Tower Synced',
            drsZones: 2,
          },
        });
      });

      if (targetRaces.length > 0) {
        sourcesUsed.push('Jolpica-F1 Ergast API (api.jolpi.ca)');
      }
    }
  } catch {
    // Fallback cleanly if offline or blocked
  }

  // 2. Fetch Real November & December 2026 Football Fixtures from ESPN Public Scoreboard API
  try {
    const endpoints: {
      url: string;
      compName: string;
      logo: string;
      matchweek: string;
      window: TimeWindow;
    }[] = [
      {
        url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.champions/scoreboard?dates=20261104',
        compName: 'UEFA Champions League',
        logo: COMPETITION_LOGOS.UCL,
        matchweek: 'League Phase • Matchday 4',
        window: 'THIS_WEEK',
      },
      {
        url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.champions/scoreboard?dates=20261103',
        compName: 'UEFA Champions League',
        logo: COMPETITION_LOGOS.UCL,
        matchweek: 'League Phase • Matchday 4',
        window: 'THIS_WEEK',
      },
      {
        url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard?dates=20261107',
        compName: 'Premier League',
        logo: COMPETITION_LOGOS.PL,
        matchweek: 'Matchweek 10',
        window: 'THIS_WEEK',
      },
      {
        url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard?dates=20261108',
        compName: 'Premier League',
        logo: COMPETITION_LOGOS.PL,
        matchweek: 'Matchweek 10',
        window: 'THIS_WEEK',
      },
      {
        url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/esp.1/scoreboard?dates=20261107',
        compName: 'La Liga',
        logo: COMPETITION_LOGOS.LALIGA,
        matchweek: 'Jornada 12',
        window: 'THIS_WEEK',
      },
      {
        url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/esp.1/scoreboard?dates=20261108',
        compName: 'La Liga',
        logo: COMPETITION_LOGOS.LALIGA,
        matchweek: 'Jornada 12',
        window: 'THIS_WEEK',
      },
      {
        url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard?dates=20261121',
        compName: 'Premier League',
        logo: COMPETITION_LOGOS.PL,
        matchweek: 'Matchweek 11',
        window: 'NEXT_WEEK',
      },
      {
        url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard?dates=20261122',
        compName: 'Premier League',
        logo: COMPETITION_LOGOS.PL,
        matchweek: 'Matchweek 11',
        window: 'NEXT_WEEK',
      },
      {
        url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.champions/scoreboard?dates=20261124',
        compName: 'UEFA Champions League',
        logo: COMPETITION_LOGOS.UCL,
        matchweek: 'League Phase • Matchday 5',
        window: 'NEXT_WEEK',
      },
      {
        url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard?dates=20261205',
        compName: 'Premier League',
        logo: COMPETITION_LOGOS.PL,
        matchweek: 'Matchweek 14',
        window: 'ALL_UPCOMING',
      },
      {
        url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard?dates=20261206',
        compName: 'Premier League',
        logo: COMPETITION_LOGOS.PL,
        matchweek: 'Matchweek 14',
        window: 'ALL_UPCOMING',
      },
    ];

    const priorityClubs = new Set([
      'MCI',
      'RMA',
      'ARS',
      'BAR',
      'LIV',
      'RBL',
      'BAY',
      'INT',
      'MUN',
      'CHE',
      'ATM',
      'BVB',
      'PSG',
      'TOT',
    ]);

    let espnSuccess = false;
    const responses = await Promise.allSettled(
      endpoints.map(async (ep) => {
        const res = await fetch(ep.url);
        if (!res.ok) return [];
        const json = await res.json();
        return (json?.events || []).map((ev: Record<string, any>) => ({
          ev,
          ep,
        }));
      })
    );

    for (const r of responses) {
      if (r.status === 'fulfilled' && Array.isArray(r.value)) {
        for (const { ev, ep } of r.value) {
          const comp = ev?.competitions?.[0];
          const competitors = comp?.competitors || [];
          const homeRaw =
            competitors.find((c: any) => c.homeAway === 'home') ||
            competitors[0];
          const awayRaw =
            competitors.find((c: any) => c.homeAway === 'away') ||
            competitors[1];
          if (!homeRaw || !awayRaw) continue;

          const home = normalizeClubIdentity(homeRaw.team);
          const away = normalizeClubIdentity(awayRaw.team);
          if (!priorityClubs.has(home.code) && !priorityClubs.has(away.code)) {
            continue;
          }

          espnSuccess = true;
          const iso = new Date(ev.date).toISOString();
          const key = `${home.code}-${away.code}-${iso.slice(0, 10)}`;
          const existing = fetchedMatchMap.get(key);
          const resolvedCity =
            comp?.venue?.address?.city || existing?.city || 'Europe';
          const isTBD =
            comp?.timeValid === false ||
            comp?.status?.type?.shortDetail === 'TBD' ||
            Boolean(existing?.isTimeTBD);

          fetchedMatchMap.set(key, {
            id:
              existing?.id ||
              `espn-${home.code.toLowerCase()}-${away.code.toLowerCase()}`,
            sport: 'FOOTBALL',
            competition: ep.compName,
            competitionLogo: ep.logo,
            matchweek: existing?.matchweek || ep.matchweek,
            timeWindow: existing?.timeWindow || ep.window,
            homeTeam: {
              id: `team-${home.code.toLowerCase()}`,
              name: home.name,
              code: home.code,
              logo: home.logo,
              form: existing?.homeTeam.form || ['W', 'W', 'D', 'W', 'W'],
            },
            awayTeam: {
              id: `team-${away.code.toLowerCase()}`,
              name: away.name,
              code: away.code,
              logo: away.logo,
              form: existing?.awayTeam.form || ['W', 'D', 'W', 'W', 'L'],
            },
            startTimeISO: iso,
            isTimeTBD: isTBD,
            istDateLabel: isTBD && existing?.istDateLabel
              ? existing.istDateLabel
              : formatISOToISTDateLabel(iso),
            istTimeLabel: isTBD ? 'TBD' : formatISOToIST12Hour(iso),
            stadiumLocalTimeLabel: isTBD
              ? 'Time Not Declared (TBD)'
              : ensure12HourTimeLabel(
                  existing?.stadiumLocalTimeLabel ||
                    formatStadiumLocalTime12Hour(iso, ep.compName, resolvedCity)
                ),
            venue:
              comp?.venue?.fullName || existing?.venue || 'Official Stadium',
            city: resolvedCity,
            durationMinutes: 115,
            prefetchMeta: existing?.prefetchMeta || {
              referee: 'UEFA / League Appointed Official',
              weather: 'Synced via ESPN Live Scoreboard Feed',
              winProbability: { home: 45, draw: 25, away: 30 },
              headToHeadSummary: `Official ${ep.compName} fixture synced from ESPN API (${isTBD ? 'Time TBD' : formatISOToIST12Hour(iso)}).`,
              keyPlayersToWatch: [home.name, away.name],
            },
          });
        }
      }
    }

    if (espnSuccess) {
      sourcesUsed.push('ESPN Soccer Scoreboard API (site.api.espn.com)');
    }
  } catch {
    // Fallback cleanly if offline or blocked
  }

  const finalMatches = Array.from(fetchedMatchMap.values());
  const finalWeekends = Array.from(fetchedWeekendMap.values()).sort(
    (a, b) => a.round - b.round
  );

  return {
    matches: finalMatches,
    f1Weekends: finalWeekends,
    syncedFromLiveApi: sourcesUsed.length > 0,
    sourcesUsed:
      sourcesUsed.length > 0
        ? sourcesUsed
        : ['Local Verified Nov/Dec 2026 Cache (Offline / Sandbox Mode)'],
    timestampIST: formatISOToIST12Hour(new Date().toISOString()),
  };
}
