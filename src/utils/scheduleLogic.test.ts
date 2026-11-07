import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPrefetchEntry,
  calculateAlarmCountdown,
  detectScheduleClashes,
  ensure12HourTimeLabel,
  evaluateF1SessionRuntimeStatus,
  evaluateF1WeekendLiveStatus,
  filterArchiveItems,
  filterF1Weekends,
  filterFootballMatches,
  formatISOToIST12Hour,
  formatISTClock,
  generateGoogleCalendarUrl,
  generateICSContent,
  getUpcomingEventsToPrefetch,
  matchesTeamSearchQuery,
  shouldPrefetchEvent,
} from './scheduleLogic';
import {
  evaluateStrictEventStatus,
  formatSimpleCardTime,
  shouldActivateLivePolling,
} from '../services/apiClient';
import {
  F1_2026_FULL_SEASON,
  F1_2027_FULL_SEASON,
  VERIFIED_ROSTER_TRANSFERS,
} from '../services/f1AutoSync';
import {
  ARCHIVE_ITEMS,
  DEFAULT_FOLLOWED_TEAM_CODES,
  LIVE_F1_FEEDS,
  LIVE_FOOTBALL_FEEDS,
  UPCOMING_F1_WEEKENDS,
  UPCOMING_FOOTBALL_MATCHES,
} from '../data/seedData';
import {
  F1_DRIVER_STANDINGS_2026,
  FOOTBALL_LEAGUE_TABLES,
} from '../data/standingsData';
import { PrefetchCacheEntry } from '../types/sports';

test('Strict Real-Time Credibility Gatekeeper never shows future fixtures as LIVE', () => {
  const nowNov3 = new Date('2026-11-03T16:00:00Z').getTime();

  // Future fixture: RB Leipzig vs Man City on Nov 4 20:00Z (Nov 5 1:30 AM IST)
  const rblMciStatus = evaluateStrictEventStatus(
    '2026-11-04T20:00:00Z',
    115,
    true, // Even if a buggy caller passed apiReportsLive=true, future timestamp MUST force UPCOMING
    false,
    nowNov3
  );
  assert.equal(rblMciStatus, 'UPCOMING');

  // Active window only returns LIVE if apiReportsLive is true
  const duringWindowNoApi = evaluateStrictEventStatus(
    '2026-11-03T15:30:00Z',
    115,
    false,
    false,
    nowNov3
  );
  assert.equal(duringWindowNoApi, 'UPCOMING');

  const duringWindowWithApi = evaluateStrictEventStatus(
    '2026-11-03T15:30:00Z',
    115,
    true,
    false,
    nowNov3
  );
  assert.equal(duringWindowWithApi, 'LIVE');

  // Smart polling gatekeeper stays at 0 requests when no event is in active window
  const pollingActive = shouldActivateLivePolling(
    UPCOMING_FOOTBALL_MATCHES.map((m) => ({
      startTimeISO: m.startTimeISO,
      durationMinutes: m.durationMinutes,
    })),
    nowNov3
  );
  assert.equal(pollingActive, false);
});

test('detectScheduleClashes supports FOLLOWED_ONLY, MCI_SAN_ONLY, and both Match×Match and Match×F1 collision modes', () => {
  const mciSanClashes = detectScheduleClashes(
    UPCOMING_FOOTBALL_MATCHES,
    UPCOMING_F1_WEEKENDS,
    DEFAULT_FOLLOWED_TEAM_CODES,
    'MCI_SAN_ONLY'
  );

  assert.ok(
    mciSanClashes.length >= 1,
    'Expected Man City, Santos FC & Kerala Blasters clashes with F1 sessions'
  );
  for (const clash of mciSanClashes) {
    const involvesMciSanOrKbfc =
      clash.footballInfo.homeCode === 'MCI' ||
      clash.footballInfo.awayCode === 'MCI' ||
      clash.footballInfo.homeCode === 'SAN' ||
      clash.footballInfo.awayCode === 'SAN' ||
      clash.footballInfo.homeCode === 'KBFC' ||
      clash.footballInfo.awayCode === 'KBFC';
    assert.ok(
      involvesMciSanOrKbfc,
      `Expected MCI_SAN_ONLY clash to involve MCI, SAN, or KBFC, got ${clash.footballInfo.homeCode} vs ${clash.footballInfo.awayCode}`
    );
    assert.notEqual(
      clash.isCompleted,
      true,
      'Clashes must not include already-completed matches'
    );
  }

  // Verify Match × Match (FOOTBALL_VS_FOOTBALL) clashes for favorite teams
  const favMatchVsMatchClashes = detectScheduleClashes(
    UPCOMING_FOOTBALL_MATCHES,
    UPCOMING_F1_WEEKENDS,
    DEFAULT_FOLLOWED_TEAM_CODES,
    'FOLLOWED_ONLY',
    undefined,
    {
      enabled: true,
      filterMode: 'FOLLOWED_ONLY',
      clashTypeMode: 'FOOTBALL_VS_FOOTBALL',
      customTeamCodes: ['MCI', 'SAN'],
      keySessionsOnly: false,
      bufferMinutes: 0,
      dismissedClashIds: [],
    }
  );
  assert.ok(
    favMatchVsMatchClashes.length >= 1,
    'Expected simultaneous favorite Football × Football clashes (e.g. Arsenal vs Chelsea & Real Madrid vs Girona on Nov 7 20:00Z)'
  );
  for (const c of favMatchVsMatchClashes) {
    assert.equal(c.clashType, 'FOOTBALL_VS_FOOTBALL');
    assert.ok(c.secondFootballInfo, 'Expected secondFootballInfo on FOOTBALL_VS_FOOTBALL clash');
  }

  const allClashes = detectScheduleClashes(
    UPCOMING_FOOTBALL_MATCHES,
    UPCOMING_F1_WEEKENDS,
    DEFAULT_FOLLOWED_TEAM_CODES,
    'ALL_MATCHES'
  );
  assert.ok(allClashes.length >= mciSanClashes.length);
});

test('filterFootballMatches & filterF1Weekends include verified Santos FC schedule (no Nov 8 match, Nov 28 time TBD), past results with final scores, and full 2025/2026/2027 F1 calendars', async () => {
  const { F1_2025_HIGHLIGHT_SEASON } = await import('../services/f1AutoSync');
  const santosMatches = filterFootballMatches(
    UPCOMING_FOOTBALL_MATCHES,
    'ALL_UPCOMING',
    'FOOTBALL',
    'SAN',
    DEFAULT_FOLLOWED_TEAM_CODES
  );
  assert.equal(santosMatches.length, 5, 'Expected 1 past + 4 remaining Santos FC Brasileirão fixtures (Rounds 34-38)');

  const pastMatches = filterFootballMatches(
    UPCOMING_FOOTBALL_MATCHES,
    'PAST_RESULTS',
    'FOOTBALL',
    'ALL_TEAMS',
    DEFAULT_FOLLOWED_TEAM_CODES
  );
  assert.ok(pastMatches.length >= 12, 'Expected at least 12 completed matches in PAST_RESULTS with final scores');
  for (const pm of pastMatches) {
    assert.equal(typeof pm.homeScore, 'number', `Expected numeric homeScore on completed match ${pm.id}`);
    assert.equal(typeof pm.awayScore, 'number', `Expected numeric awayScore on completed match ${pm.id}`);
  }

  // Verify there is NO non-existent Santos FC match on Nov 8
  const nov8SantosMatch = santosMatches.find(
    (m) => m.istDateLabel.includes('08 NOV') || m.startTimeISO.startsWith('2026-11-08')
  );
  assert.equal(nov8SantosMatch, undefined, 'Santos FC must not have a match on Nov 8');

  // Verify the Nov 28th game for Santos (Vitória vs Santos FC, Rodada 37) has undeclared kickoff time (TBD)
  const nov28SantosMatch = santosMatches.find(
    (m) => m.id === 'match-bsa-vit-san' || m.istDateLabel === 'SAT, 28 NOV'
  );
  assert.ok(nov28SantosMatch, 'Expected Vitória vs Santos FC on SAT, 28 NOV');
  assert.equal(nov28SantosMatch.isTimeTBD, true, 'Expected Nov 28th Santos match to have isTimeTBD: true');
  assert.equal(nov28SantosMatch.istTimeLabel, 'TBD');
  assert.equal(
    formatSimpleCardTime(
      nov28SantosMatch.istTimeLabel,
      nov28SantosMatch.isTimeTBD ? undefined : nov28SantosMatch.startTimeISO,
      nov28SantosMatch.isTimeTBD
    ),
    'TBD'
  );

  const allUpcomingF1 = filterF1Weekends(
    UPCOMING_F1_WEEKENDS,
    'ALL_UPCOMING',
    'F1',
    'ALL_FOLLOWED',
    ['FER', 'RBR', 'MCL', 'MER']
  );
  assert.equal(allUpcomingF1.length, 4);
  const abuDhabi = allUpcomingF1.find((w) => w.id === 'f1-wknd-abudhabi');
  assert.ok(abuDhabi, 'Expected Abu Dhabi Grand Prix in ALL_UPCOMING F1 weekends');

  // Verify 2025, 2026 & 2027 full 24-round season calendars
  assert.equal(F1_2025_HIGHLIGHT_SEASON.length, 24, 'Expected all 24 rounds of the 2025 F1 World Championship');
  assert.equal(F1_2026_FULL_SEASON.length, 24, 'Expected all 24 rounds of the 2026 F1 World Championship');
  assert.ok(
    F1_2027_FULL_SEASON.length >= 25,
    'Expected 2027 calendar to include Pre-Season Testing + 24 Rounds'
  );
  assert.ok(
    F1_2027_FULL_SEASON.some((r) => r.hostName?.includes('Portimão')),
    'Expected Portugal - Portimão on 2027 calendar'
  );
  assert.ok(
    F1_2027_FULL_SEASON.some((r) => r.hostName?.includes('Madrid')),
    'Expected Spain - Madrid on 2027 calendar'
  );
  assert.ok(
    F1_2027_FULL_SEASON.some((r) => r.hostName?.includes('Istanbul Park')),
    'Expected Türkiye - Istanbul Park on 2027 calendar'
  );
});

test('OpenF1 Mexico City GP classification has Soft (S) tyres for top 8 and 22-driver 2026 WDC roster', () => {
  const mexicoFeed = LIVE_F1_FEEDS[0];
  assert.equal(mexicoFeed.grandPrixName, 'Mexico City Grand Prix');
  for (const drv of mexicoFeed.drivers.slice(0, 8)) {
    assert.equal(
      drv.tyreCompound,
      'S',
      `Expected ${drv.driverName} to finish Mexico GP on Soft (S) tyres`
    );
  }
  const hamilton = mexicoFeed.drivers.find((d) => d.driverCode === 'HAM');
  assert.ok(hamilton?.hasFastestLap);
  assert.equal(hamilton?.bestLapTime, '1:19.268');

  assert.equal(F1_DRIVER_STANDINGS_2026.length, 0, 'Initial F1 standings array must be empty until live Jolpica sync');
  assert.ok(VERIFIED_ROSTER_TRANSFERS.length >= 5);
  assert.ok(
    FOOTBALL_LEAGUE_TABLES.some((t) => t.id === 'brasileirao-2026'),
    'Expected Brasileirão Série A table config'
  );
  assert.equal(LIVE_FOOTBALL_FEEDS.length, 5);
});

test('offline-first pre-fetching prioritizes cache and never fetches when offline', () => {
  const nowMs = new Date('2026-11-03T12:00:00Z').getTime();
  const freshCacheEntry = buildPrefetchEntry(
    UPCOMING_FOOTBALL_MATCHES[0],
    'PREFETCH_ENGINE',
    '2026-11-03T11:45:00Z'
  );
  const staleCacheEntry = buildPrefetchEntry(
    UPCOMING_FOOTBALL_MATCHES[1],
    'SEED_CACHE',
    '2026-11-03T09:00:00Z'
  );

  const cacheMap: Record<string, PrefetchCacheEntry> = {
    [UPCOMING_FOOTBALL_MATCHES[0].id]: freshCacheEntry,
    [UPCOMING_FOOTBALL_MATCHES[1].id]: staleCacheEntry,
  };

  assert.equal(
    shouldPrefetchEvent(UPCOMING_FOOTBALL_MATCHES[2].id, false, cacheMap, nowMs),
    false
  );
  assert.equal(
    shouldPrefetchEvent(UPCOMING_FOOTBALL_MATCHES[0].id, true, cacheMap, nowMs, 60),
    false
  );
  assert.equal(
    shouldPrefetchEvent(UPCOMING_FOOTBALL_MATCHES[1].id, true, cacheMap, nowMs, 60),
    true
  );

  const orderedIds = UPCOMING_FOOTBALL_MATCHES.slice(0, 4).map((m) => m.id);
  const toPrefetch = getUpcomingEventsToPrefetch(
    orderedIds,
    0,
    2,
    true,
    cacheMap,
    nowMs
  );
  assert.deepEqual(toPrefetch, [
    UPCOMING_FOOTBALL_MATCHES[1].id,
    UPCOMING_FOOTBALL_MATCHES[2].id,
  ]);
});

test('Simple 12-hour IST formatting and calendar export work accurately', () => {
  const simpleTime = formatSimpleCardTime('2026-11-04T20:00:00Z');
  assert.equal(simpleTime, '1:30 AM');
  assert.ok(!simpleTime.includes('IST'));

  assert.equal(formatISOToIST12Hour('2026-11-04T20:00:00Z'), '01:30 AM IST');
  assert.equal(ensure12HourTimeLabel('22:30 IST'), '10:30 PM IST');

  const nowMs = new Date('2026-11-08T14:00:00Z').getTime();
  const countdown = calculateAlarmCountdown(
    {
      eventStartTimeISO: '2026-11-08T17:00:00Z',
      leadTimeMinutes: 30,
    },
    nowMs
  );
  assert.equal(countdown.formattedCountdown, '02H 30M');

  const clock = formatISTClock(new Date('2026-11-03T14:00:00Z').getTime());
  assert.equal(clock, '07:30:00 PM IST');

  const ics = generateICSContent([
    {
      id: 'test-ev-1',
      title: 'LIV vs MCI • Premier League',
      description: 'Kickoff at 10:30 PM IST',
      location: 'Anfield, Liverpool',
      startTimeISO: '2026-11-08T17:00:00Z',
      durationMinutes: 115,
    },
  ]);
  assert.ok(ics.includes('BEGIN:VCALENDAR'));
  assert.ok(ics.includes('BEGIN:VALARM'));
  assert.ok(ics.includes('TRIGGER:-PT15M'));
  assert.ok(ics.includes('ACTION:DISPLAY'));
  assert.ok(ics.includes('DESCRIPTION:Event starting in 15 minutes!'));
  assert.ok(ics.includes('END:VALARM'));

  const gcalUrl = generateGoogleCalendarUrl({
    title: 'São Paulo GP',
    description: 'Lights Out 10:30 PM IST',
    location: 'Interlagos',
    startTimeISO: '2026-11-08T17:00:00Z',
    durationMinutes: 120,
  });
  assert.ok(gcalUrl.includes('ctz=Asia%2FKolkata'));

  const mexicoResults = filterArchiveItems(ARCHIVE_ITEMS, 'Mexico City', 'ALL');
  assert.equal(mexicoResults.length, 1);
});

test('fetchSantosFCFixturesAndStandings fetches & parses API-Football v3 fixtures and Brasileirão Série A standings accurately', async () => {
  const {
    API_FOOTBALL_V3_BASE_URL,
    SANTOS_FC_API_FOOTBALL_TEAM_ID,
    BRASILEIRAO_SERIE_A_API_FOOTBALL_LEAGUE_ID,
    fetchSantosFCFixturesAndStandings,
    parseApiFootballV3SantosFixtures,
    parseApiFootballV3BrasileiraoStandings,
  } = await import('../services/sportsApi');

  const sampleFixturesDto = {
    get: 'fixtures',
    results: 5,
    response: [
      // Completed match (should be filtered out from upcoming schedule)
      {
        fixture: {
          id: 1200034,
          date: '2026-11-02T21:30:00Z',
          venue: { name: 'Estádio Nabi Abi Chedid', city: 'Bragança Paulista' },
          status: { short: 'FT', long: 'Match Finished' },
        },
        league: { id: 71, name: 'Serie A', season: 2026, round: 'Regular Season - 34' },
        teams: {
          home: { id: 794, name: 'RB Bragantino' },
          away: { id: 128, name: 'Santos' },
        },
        goals: { home: 2, away: 1 },
      },
      // Rodada 35: Coritiba vs Santos FC (Nov 18 22:30Z -> Nov 19 04:00 AM IST)
      {
        fixture: {
          id: 1200035,
          date: '2026-11-18T22:30:00Z',
          venue: { name: 'Estádio Couto Pereira', city: 'Curitiba' },
          status: { short: 'NS', long: 'Not Started' },
        },
        league: { id: 71, name: 'Serie A', season: 2026, round: 'Regular Season - 35' },
        teams: {
          home: { id: 147, name: 'Coritiba' },
          away: { id: 128, name: 'Santos' },
        },
      },
      // Rodada 36: Santos FC vs Grêmio (Nov 24 00:00Z -> Nov 24 05:30 AM IST)
      {
        fixture: {
          id: 1200036,
          date: '2026-11-24T00:00:00Z',
          venue: { name: 'Estádio Urbano Caldeira (Vila Belmiro)', city: 'Santos' },
          status: { short: 'NS', long: 'Not Started' },
        },
        league: { id: 71, name: 'Serie A', season: 2026, round: 'Regular Season - 36' },
        teams: {
          home: { id: 128, name: 'Santos' },
          away: { id: 130, name: 'Gremio' },
        },
      },
      // Rodada 37: Vitória vs Santos FC (Nov 28 - Time TBD)
      {
        fixture: {
          id: 1200037,
          date: '2026-11-28T00:00:00Z',
          venue: { name: 'Estádio Manoel Barradas (Barradão)', city: 'Salvador' },
          status: { short: 'TBD', long: 'Time To Be Defined' },
        },
        league: { id: 71, name: 'Serie A', season: 2026, round: 'Regular Season - 37' },
        teams: {
          home: { id: 136, name: 'Vitoria' },
          away: { id: 128, name: 'Santos' },
        },
      },
      // Rodada 38: Santos FC vs Botafogo (Dec 2 - Time TBD)
      {
        fixture: {
          id: 1200038,
          date: '2026-12-02T00:00:00Z',
          venue: { name: 'Estádio Urbano Caldeira (Vila Belmiro)', city: 'Santos' },
          status: { short: 'TBD', long: 'Time To Be Defined' },
        },
        league: { id: 71, name: 'Serie A', season: 2026, round: 'Regular Season - 38' },
        teams: {
          home: { id: 128, name: 'Santos' },
          away: { id: 120, name: 'Botafogo' },
        },
      },
    ],
  };

  const sampleStandingsDto = {
    get: 'standings',
    results: 1,
    response: [
      {
        league: {
          id: 71,
          name: 'Serie A',
          country: 'Brazil',
          season: 2026,
          standings: [
            [
              {
                rank: 1,
                team: { id: 127, name: 'Flamengo' },
                points: 73,
                goalsDiff: 40,
                form: 'WWDWW',
                description: 'CONMEBOL Libertadores',
                all: { played: 33, win: 22, draw: 7, lose: 4, goals: { for: 66, against: 26 } },
              },
              {
                rank: 9,
                team: { id: 128, name: 'Santos' },
                points: 47,
                goalsDiff: 1,
                form: 'WDWWL',
                description: 'CONMEBOL Sudamericana',
                all: { played: 34, win: 12, draw: 11, lose: 11, goals: { for: 39, against: 38 } },
              },
            ],
          ],
        },
      },
    ],
  };

  const parsedFixtures = parseApiFootballV3SantosFixtures(sampleFixturesDto);
  assert.equal(parsedFixtures.length, 4, 'Expected 4 upcoming Santos FC fixtures (FT skipped)');
  assert.equal(parsedFixtures[0].homeTeam.code, 'CFC');
  assert.equal(parsedFixtures[0].awayTeam.code, 'SAN');
  assert.equal(parsedFixtures[0].istTimeLabel, '04:00 AM IST');
  assert.equal(parsedFixtures[2].homeTeam.code, 'VIT');
  assert.equal(parsedFixtures[2].awayTeam.code, 'SAN');
  assert.equal(parsedFixtures[2].isTimeTBD, true);
  assert.equal(parsedFixtures[2].istTimeLabel, 'TBD');

  const parsedStandings = parseApiFootballV3BrasileiraoStandings(sampleStandingsDto);
  assert.ok(parsedStandings, 'Expected parsed Brasileirão Série A standings table');
  const santosStandingRow = parsedStandings.rows.find((r) => r.teamCode === 'SAN');
  assert.ok(santosStandingRow, 'Expected Santos FC row in parsed standings');
  assert.equal(santosStandingRow.position, 9);
  assert.equal(santosStandingRow.points, 47);
  assert.equal(santosStandingRow.played, 34);
  assert.equal(santosStandingRow.goalDifference, '+1');

  const requestedUrls: string[] = [];
  const result = await fetchSantosFCFixturesAndStandings({
    season: 2026,
    apiKey: 'test-api-football-v3-key',
    customFetch: (async (input: RequestInfo | URL) => {
      const urlStr = String(input);
      requestedUrls.push(urlStr);
      if (urlStr.includes('/fixtures')) {
        return new Response(JSON.stringify(sampleFixturesDto), { status: 200 });
      }
      return new Response(JSON.stringify(sampleStandingsDto), { status: 200 });
    }) as typeof fetch,
  });

  assert.equal(result.source, 'API_FOOTBALL_V3');
  assert.ok(
    requestedUrls.includes(
      `${API_FOOTBALL_V3_BASE_URL}/fixtures?team=${SANTOS_FC_API_FOOTBALL_TEAM_ID}&season=2026`
    )
  );
  assert.ok(
    requestedUrls.includes(
      `${API_FOOTBALL_V3_BASE_URL}/standings?league=${BRASILEIRAO_SERIE_A_API_FOOTBALL_LEAGUE_ID}&season=2026`
    )
  );
  // Verify keyless operation fetches from ESPN public API without needing an API key
  const keylessResult = await fetchSantosFCFixturesAndStandings({
    forceRefresh: true,
  });
  assert.equal(keylessResult.santosFixtures.length, 5);
  assert.ok(keylessResult.brasileiraoStandings.rows.length === 0 || keylessResult.brasileiraoStandings.rows.length === 20);
});

test('Kimi Antonelli headshot URL, 11 deduplicated reserve drivers, George Russell 3 DNFs, 7 supported ESPN league configs, and verified late-2026 player rosters', async () => {
  const {
    F1_DRIVER_HEADSHOTS,
    F1_RESERVE_DRIVERS_2026,
    FULL_2026_F1_DRIVER_STANDINGS,
    getBaselineDriverCareerProfile,
  } = await import('../services/f1AutoSync');
  const { DRIVER_CAREER_REGISTRY } = await import('../data/seedData');

  // 1. Kimi Antonelli verified working official F1 headshot URL
  const expectedAntonelliUrl =
    'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/K/ANDANT01_Kimi_Antonelli/andant01.png';
  assert.equal(F1_DRIVER_HEADSHOTS.ANT, expectedAntonelliUrl);
  assert.equal(
    DRIVER_CAREER_REGISTRY['ANT']?.headshotUrl,
    expectedAntonelliUrl
  );
  assert.equal(
    getBaselineDriverCareerProfile('ANT')?.headshotUrl,
    expectedAntonelliUrl
  );

  // 1b. George Russell has 3 Season DNFs (not generic 2) and distinct driver DNFs
  assert.equal(DRIVER_CAREER_REGISTRY['RUS']?.dnfs, 3);
  assert.equal(getBaselineDriverCareerProfile('RUS')?.dnfs, 3);
  assert.equal(DRIVER_CAREER_REGISTRY['ANT']?.dnfs, 0);
  assert.equal(DRIVER_CAREER_REGISTRY['HAM']?.dnfs, 1);
  assert.equal(DRIVER_CAREER_REGISTRY['NOR']?.dnfs, 4);
  assert.equal(DRIVER_CAREER_REGISTRY['ALO']?.dnfs, 7);

  // 1c. Verify all 7 Football League Table shells have 0 hardcoded rows and official ESPN slugs
  assert.equal(FOOTBALL_LEAGUE_TABLES.length, 7);
  for (const table of FOOTBALL_LEAGUE_TABLES) {
    assert.equal(table.rows.length, 0, `Expected 0 hardcoded rows in ${table.name}`);
    assert.ok(table.espnSlug, `Expected espnSlug on ${table.name}`);
  }

  // 1d. Verify outdated players (Lewandowski at Barca, Tadic, Rashford at Man Utd, Kvaratskhelia at Napoli, Son at Spurs) are removed
  const serializedMatches = JSON.stringify(UPCOMING_FOOTBALL_MATCHES);
  const serializedFeeds = JSON.stringify(LIVE_FOOTBALL_FEEDS);
  assert.ok(!serializedMatches.includes('Lewandowski'), 'Outdated player Lewandowski must not appear in Barcelona fixtures');
  assert.ok(!serializedFeeds.includes('Lewandowski'), 'Outdated player Lewandowski must not appear in live feeds');
  assert.ok(!serializedMatches.includes('Tadić'), 'Outdated player Tadic must not appear in Fenerbahce fixtures');

  // 2. Active standings have strictly 22 drivers (no reserve duplicates) and all 11 constructors have 1 reserve driver
  assert.equal(FULL_2026_F1_DRIVER_STANDINGS.length, 22);
  assert.equal(F1_RESERVE_DRIVERS_2026.length, 11);

  const reserveCodes = F1_RESERVE_DRIVERS_2026.map((d) => d.driverCode);
  assert.equal(
    new Set(reserveCodes).size,
    11,
    'Every reserve driver code must be unique (no 3x duplication)'
  );

  const reserveConstructorCodes = F1_RESERVE_DRIVERS_2026.map(
    (d) => d.constructorCode
  );
  assert.equal(
    new Set(reserveConstructorCodes).size,
    11,
    'All 11 F1 constructors must have a reserve driver represented'
  );

  // 3. Verify Mexico City GP (#11404) & United States GP (#11396) last stint tyres & stint laps
  const mexico = LIVE_F1_FEEDS[0];
  assert.equal(mexico.drivers.length, 10);
  assert.equal(mexico.drivers[0].driverCode, 'VER');
  assert.equal(mexico.drivers[0].tyreCompound, 'S');
  assert.equal(mexico.drivers[0].tyreAgeLaps, 26);
  assert.equal(mexico.drivers[0].lastStintRange, 'L46–71');
  assert.equal(mexico.drivers[8].driverCode, 'HAD');
  assert.equal(mexico.drivers[8].tyreCompound, 'S');
  assert.equal(mexico.drivers[8].tyreAgeLaps, 26);
  assert.equal(mexico.drivers[8].lastStintRange, 'L46–71');
  assert.equal(mexico.drivers[9].driverCode, 'BEA');
  assert.equal(mexico.drivers[9].tyreCompound, 'S');
  assert.equal(mexico.drivers[9].tyreAgeLaps, 26);
  assert.equal(mexico.drivers[9].lastStintRange, 'L46–71');

  const austin = LIVE_F1_FEEDS[1];
  assert.equal(austin.drivers.length, 10);
  const austinAnt = austin.drivers.find((d) => d.driverCode === 'ANT');
  assert.ok(austinAnt);
  assert.equal(austinAnt.tyreCompound, 'H');
  assert.equal(austinAnt.tyreAgeLaps, 32);
  assert.equal(austinAnt.lastStintRange, 'L25–56');

  // 4. Verify ClashDetectorSettings management (disable, keySessionsOnly, dismiss)
  const disabledClashes = detectScheduleClashes(
    UPCOMING_FOOTBALL_MATCHES,
    UPCOMING_F1_WEEKENDS,
    DEFAULT_FOLLOWED_TEAM_CODES,
    'ALL_MATCHES',
    undefined,
    {
      enabled: false,
      filterMode: 'ALL_MATCHES',
      customTeamCodes: ['MCI', 'SAN'],
      keySessionsOnly: false,
      bufferMinutes: 0,
      dismissedClashIds: [],
    }
  );
  assert.equal(disabledClashes.length, 0);

  const fullClashes = detectScheduleClashes(
    UPCOMING_FOOTBALL_MATCHES,
    UPCOMING_F1_WEEKENDS,
    DEFAULT_FOLLOWED_TEAM_CODES,
    'ALL_MATCHES'
  );
  assert.ok(fullClashes.length > 0);

  const dismissedFirst = detectScheduleClashes(
    UPCOMING_FOOTBALL_MATCHES,
    UPCOMING_F1_WEEKENDS,
    DEFAULT_FOLLOWED_TEAM_CODES,
    'ALL_MATCHES',
    undefined,
    {
      enabled: true,
      filterMode: 'ALL_MATCHES',
      customTeamCodes: ['MCI', 'SAN'],
      keySessionsOnly: false,
      bufferMinutes: 0,
      dismissedClashIds: [fullClashes[0].id],
    }
  );
  assert.equal(dismissedFirst.length, fullClashes.length - 1);
});

test('Data-validation wrapper checks ESPN/OpenF1/Jolpica schemas, verifies team IDs, strips future live statuses, and logs discrepancies', async () => {
  const {
    clearDataDiscrepancyLogs,
    getDataDiscrepancyLogs,
    sanitizeAndDeduplicateFixtures,
    validateESPNScoreboardSchema,
    validateOpenF1SessionsSchema,
    validateSportsStateBeforeUpdate,
    verifyTeamIdAgainstMapping,
  } = await import('../services/sportsApi');
  const {
    validateJolpicaDriverStandingsSchema,
    validateOpenF1DriversSchema,
    verifyF1ConstructorMapping,
  } = await import('../services/f1AutoSync');

  clearDataDiscrepancyLogs();

  // 1. Known vs unknown team ID verification
  const mciCheck = verifyTeamIdAgainstMapping({
    teamCode: 'MCI',
    espnTeamId: '382',
  });
  assert.equal(mciCheck.verified, true);
  assert.equal(mciCheck.canonicalCode, 'MCI');

  const unknownTeamCheck = verifyTeamIdAgainstMapping({
    teamCode: 'ZZZ',
    espnTeamId: '999999',
    teamName: 'Unmapped FC',
  });
  assert.equal(unknownTeamCheck.verified, false);

  // 2. ESPN Scoreboard schema validation & future-live stripping
  const refNowMs = new Date('2026-11-05T18:00:00Z').getTime();
  const espnValidation = validateESPNScoreboardSchema(
    {
      events: [
        {
          id: 'espn-future-spoofed-live',
          date: '2026-11-08T16:30:00Z', // 3 days in the future
          status: {
            type: {
              state: 'in', // Spoofed as live
              completed: false,
            },
          },
          competitions: [
            {
              id: 'comp-1',
              competitors: [
                {
                  homeAway: 'home',
                  team: { id: '382', abbreviation: 'MCI', displayName: 'Manchester City' },
                },
                {
                  homeAway: 'away',
                  team: { id: '364', abbreviation: 'LIV', displayName: 'Liverpool' },
                },
              ],
            },
          ],
        },
      ],
    },
    refNowMs
  );
  assert.equal(espnValidation.valid, true);
  assert.equal(
    espnValidation.events[0].status?.type?.state,
    'pre',
    'Future ESPN event must have spoofed live status stripped to pre'
  );

  // 3. sanitizeAndDeduplicateFixtures strips LIVE status, scores, and liveMinute from future matches
  const sampleUpcoming =
    UPCOMING_FOOTBALL_MATCHES.find((m) => m.liveStatus === 'UPCOMING') ||
    UPCOMING_FOOTBALL_MATCHES[0];
  const futureMatchSpoofedLive = {
    ...sampleUpcoming,
    id: 'test-future-spoofed-live',
    startTimeISO: '2026-11-08T16:30:00Z',
    liveStatus: 'LIVE' as const,
    liveMinute: "42'",
    homeScore: 1,
    awayScore: 1,
  };
  const sanitized = sanitizeAndDeduplicateFixtures([futureMatchSpoofedLive], refNowMs);
  assert.equal(sanitized[0].liveStatus, 'UPCOMING');
  assert.equal(sanitized[0].liveMinute, undefined);
  assert.equal(sanitized[0].homeScore, undefined);
  assert.equal(sanitized[0].awayScore, undefined);

  // 4. OpenF1 and Jolpica schema validation
  const invalidOpenF1 = validateOpenF1SessionsSchema({ error: 'Not an array' });
  assert.equal(invalidOpenF1.valid, false);

  const validOpenF1Drivers = validateOpenF1DriversSchema([
    { driver_number: 12, name_acronym: 'ANT', full_name: 'Kimi Antonelli', team_name: 'Mercedes' },
  ]);
  assert.equal(validOpenF1Drivers.valid, true);

  const constructorCheck = verifyF1ConstructorMapping({
    ergastConstructorId: 'mercedes',
  });
  assert.equal(constructorCheck.verified, true);
  assert.equal(constructorCheck.code, 'MER');

  const invalidJolpica = validateJolpicaDriverStandingsSchema({ MRData: {} });
  assert.equal(invalidJolpica.valid, false);

  // 5. validateSportsStateBeforeUpdate logs discrepancies between API data and local stored state
  const modifiedMatch = {
    ...UPCOMING_FOOTBALL_MATCHES[0],
    homeScore: 9,
    awayScore: 9,
  };
  const preUpdateResult = validateSportsStateBeforeUpdate({
    candidateMatches: [modifiedMatch, ...UPCOMING_FOOTBALL_MATCHES.slice(1)],
    candidateLeagueTables: [],
    candidateF1Weekends: UPCOMING_F1_WEEKENDS,
    localStoredMatches: UPCOMING_FOOTBALL_MATCHES,
    referenceNowMs: refNowMs,
  });

  const logs = getDataDiscrepancyLogs();
  assert.ok(logs.length >= 4, 'Discrepancy log must record unknown team ID, future live stripped, schema mismatch, and local state diff');
  assert.ok(logs.some((l) => l.category === 'UNKNOWN_TEAM_ID'));
  assert.ok(logs.some((l) => l.category === 'FUTURE_LIVE_STRIPPED'));
  assert.ok(logs.some((l) => l.category === 'SCHEMA_MISMATCH'));
  assert.ok(logs.some((l) => l.category === 'STATE_DISCREPANCY'));
  assert.equal(preUpdateResult.discrepanciesLogged.length, logs.length);
});

test('DataValidationMiddleware cross-references 2026 F1 sanity calendar, enforces NEXT_WEEK Las Vegas GP (Round 22), and forces static fallback outside logical window', async () => {
  const {
    enforceF1WeekendMiddlewareValidation,
    enforceFootballMatchMiddlewareValidation,
    SANITY_CHECK_2026_F1_CALENDAR,
  } = await import('../middleware/dataValidation');

  // 1. Verify UPCOMING_F1_WEEKENDS has Round 21 (Brazil THIS_WEEK), Round 22 (Las Vegas NEXT_WEEK), Round 23 (Qatar ALL_UPCOMING), Round 24 (Abu Dhabi ALL_UPCOMING)
  const brazil = UPCOMING_F1_WEEKENDS.find((w) => w.id === 'f1-wknd-brazil');
  const vegas = UPCOMING_F1_WEEKENDS.find((w) => w.id === 'f1-wknd-vegas');
  const qatar = UPCOMING_F1_WEEKENDS.find((w) => w.id === 'f1-wknd-qatar');
  const abudhabi = UPCOMING_F1_WEEKENDS.find((w) => w.id === 'f1-wknd-abudhabi');

  assert.ok(brazil && vegas && qatar && abudhabi);
  assert.equal(brazil.round, 21);
  assert.equal(brazil.timeWindow, 'THIS_WEEK');
  assert.equal(vegas.round, 22);
  assert.equal(vegas.timeWindow, 'NEXT_WEEK');
  assert.ok(vegas.dateRangeLabel?.includes('20 – 22 NOV 2026'));
  assert.equal(qatar.round, 23);
  assert.equal(qatar.timeWindow, 'ALL_UPCOMING');
  assert.equal(abudhabi.round, 24);
  assert.equal(abudhabi.timeWindow, 'ALL_UPCOMING');

  // 2. Verify filterF1Weekends for NEXT_WEEK returns strictly Round 22 Las Vegas GP
  const nextWeekWeekends = filterF1Weekends(
    UPCOMING_F1_WEEKENDS,
    'NEXT_WEEK',
    'F1',
    'ALL_FOLLOWED',
    ['MER', 'RBR', 'FER', 'MCL']
  );
  assert.equal(nextWeekWeekends.length, 1);
  assert.equal(nextWeekWeekends[0].round, 22);
  assert.equal(nextWeekWeekends[0].hostName, 'Las Vegas');

  // 3. Verify middleware auto-corrects off-by-one round number & strips future LIVE status
  const refNowMs = new Date('2026-11-06T12:00:00Z').getTime();
  const corruptedVegas = {
    ...vegas,
    round: 21, // Wrong old round number
    status: 'LIVE' as const,
    sessions: vegas.sessions.map((s) => ({ ...s, status: 'LIVE' as const })),
  };
  const fixedVegas = enforceF1WeekendMiddlewareValidation(corruptedVegas, refNowMs);
  assert.equal(fixedVegas.round, SANITY_CHECK_2026_F1_CALENDAR[22].round);
  assert.equal(fixedVegas.status, 'UPCOMING');
  assert.ok(fixedVegas.sessions.every((s) => s.status === 'UPCOMING'));

  // 4. Verify Football match claiming LIVE outside logical window forces static fallback
  const pastMatchSpoofedLive = {
    ...UPCOMING_FOOTBALL_MATCHES[0],
    liveStatus: 'LIVE' as const,
    liveMinute: "89'",
  };
  const fixedMatch = enforceFootballMatchMiddlewareValidation(pastMatchSpoofedLive, refNowMs);
  assert.notEqual(fixedMatch.liveStatus, 'LIVE');
});

test('ISL & Kerala Blasters favorites, Schedule ordering rules (PAST_RESULTS newest-first, THIS_WEEK upcoming-first, ALL_UPCOMING date order), Whole-Weekend F1 LIVE status, and Bi-Directional Samsung Clock Native Alarm Sync', async () => {
  const {
    cancelSamsungMatchAlarm,
    getSamsungNativeAlarm,
    hasSamsungNativeAlarm,
    setSamsungMatchAlarm,
  } = await import('../services/nativeAlarm');

  // 1. Kerala Blasters FC (KBFC) is in DEFAULT_FOLLOWED_TEAM_CODES with MCI and SAN
  assert.ok(DEFAULT_FOLLOWED_TEAM_CODES.includes('MCI'));
  assert.ok(DEFAULT_FOLLOWED_TEAM_CODES.includes('SAN'));
  assert.ok(DEFAULT_FOLLOWED_TEAM_CODES.includes('KBFC'));

  const kbfcMatches = filterFootballMatches(
    UPCOMING_FOOTBALL_MATCHES,
    'ALL_UPCOMING',
    'FOOTBALL',
    'KBFC',
    DEFAULT_FOLLOWED_TEAM_CODES
  );
  assert.ok(kbfcMatches.length >= 5, 'Expected past and upcoming ISL fixtures for Kerala Blasters FC');

  // Verify current ISL fixture on Sat, 07 Nov 2026 • 07:30 PM IST is Chennaiyin FC vs East Bengal FC
  const currentIslMatch = UPCOMING_FOOTBALL_MATCHES.find(
    (m) => m.id === 'match-isl-cfc-ebfc'
  );
  assert.ok(currentIslMatch, 'Expected Chennaiyin FC vs East Bengal FC on Sat, 07 Nov 2026');
  assert.equal(currentIslMatch.homeTeam.code, 'CFC_ISL');
  assert.equal(currentIslMatch.awayTeam.code, 'EBFC');
  assert.equal(currentIslMatch.istDateLabel, 'SAT, 07 NOV');
  assert.equal(currentIslMatch.istTimeLabel, '07:30 PM IST');

  // Verify Universal Team Fixture Search ("Man City", "Manchester City", "City", "Blasters", "East Bengal", "Chennaiyin")
  const manCityByShort = filterFootballMatches(
    UPCOMING_FOOTBALL_MATCHES,
    'THIS_WEEK',
    'ALL',
    'ALL_TEAMS',
    DEFAULT_FOLLOWED_TEAM_CODES,
    'Man City'
  );
  const manCityByFull = filterFootballMatches(
    UPCOMING_FOOTBALL_MATCHES,
    'THIS_WEEK',
    'ALL',
    'ALL_TEAMS',
    DEFAULT_FOLLOWED_TEAM_CODES,
    'Manchester City'
  );
  const cityMatches = filterFootballMatches(
    UPCOMING_FOOTBALL_MATCHES,
    'THIS_WEEK',
    'ALL',
    'ALL_TEAMS',
    DEFAULT_FOLLOWED_TEAM_CODES,
    'City'
  );
  assert.ok(manCityByShort.length >= 6, 'Searching "Man City" must return all Manchester City fixtures');
  assert.equal(manCityByShort.length, manCityByFull.length, '"Man City" and "Manchester City" must return identical fixtures');
  assert.ok(cityMatches.length >= manCityByShort.length, 'Searching "City" must match Manchester City, Hull City, Coventry City, Mumbai City');
  assert.ok(
    manCityByShort.every((m) => matchesTeamSearchQuery(m, 'Man City')),
    'Every result for "Man City" must match matchesTeamSearchQuery'
  );

  const blastersSearch = filterFootballMatches(
    UPCOMING_FOOTBALL_MATCHES,
    'THIS_WEEK',
    'ALL',
    'ALL_TEAMS',
    DEFAULT_FOLLOWED_TEAM_CODES,
    'Blasters'
  );
  assert.ok(blastersSearch.length >= 5, 'Searching "Blasters" must return all Kerala Blasters FC fixtures across weeks');

  const eastBengalSearch = filterFootballMatches(
    UPCOMING_FOOTBALL_MATCHES,
    'THIS_WEEK',
    'ALL',
    'ALL_TEAMS',
    DEFAULT_FOLLOWED_TEAM_CODES,
    'East Bengal'
  );
  assert.ok(
    eastBengalSearch.some((m) => m.id === 'match-isl-cfc-ebfc'),
    'Searching "East Bengal" must include Chennaiyin FC vs East Bengal FC'
  );

  // 2. Schedule ordering rules:
  // 2a. PAST_RESULTS: most recently finished matches FIRST (descending by startTimeISO)
  const pastResults = filterFootballMatches(
    UPCOMING_FOOTBALL_MATCHES,
    'PAST_RESULTS',
    'FOOTBALL',
    'ALL_TEAMS',
    DEFAULT_FOLLOWED_TEAM_CODES
  );
  assert.ok(pastResults.length >= 12);
  for (let i = 1; i < pastResults.length; i++) {
    const prevMs = new Date(pastResults[i - 1].startTimeISO).getTime();
    const currMs = new Date(pastResults[i].startTimeISO).getTime();
    assert.ok(
      prevMs >= currMs,
      `Expected PAST_RESULTS newest first, but ${pastResults[i - 1].startTimeISO} came before ${pastResults[i].startTimeISO}`
    );
  }

  // 2b. THIS_WEEK: upcoming/live matches FIRST, finished matches AFTER
  const thisWeekWithMixed = [
    ...UPCOMING_FOOTBALL_MATCHES,
    {
      ...UPCOMING_FOOTBALL_MATCHES[0],
      id: 'test-finished-in-this-week',
      timeWindow: 'THIS_WEEK' as const,
      liveStatus: 'FINAL' as const,
      startTimeISO: '2026-11-04T20:00:00Z',
    },
  ];
  const thisWeekOrdered = filterFootballMatches(
    thisWeekWithMixed,
    'THIS_WEEK',
    'FOOTBALL',
    'ALL_TEAMS',
    DEFAULT_FOLLOWED_TEAM_CODES
  );
  const firstFinishedIdx = thisWeekOrdered.findIndex(
    (m) => m.liveStatus === 'FINAL' || m.timeWindow === 'PAST_RESULTS'
  );
  const lastUpcomingIdx = thisWeekOrdered
    .map((m, idx) =>
      m.liveStatus !== 'FINAL' && m.timeWindow !== 'PAST_RESULTS' ? idx : -1
    )
    .reduce((a, b) => Math.max(a, b), -1);
  if (firstFinishedIdx !== -1 && lastUpcomingIdx !== -1) {
    assert.ok(
      lastUpcomingIdx < firstFinishedIdx,
      'In THIS_WEEK, all upcoming matches must appear before any finished matches'
    );
  }

  // 2c. ALL_UPCOMING (Full Calendar): strictly ordered chronologically by date
  const fullCalendar = filterFootballMatches(
    UPCOMING_FOOTBALL_MATCHES,
    'ALL_UPCOMING',
    'FOOTBALL',
    'ALL_TEAMS',
    DEFAULT_FOLLOWED_TEAM_CODES
  );
  for (let i = 1; i < fullCalendar.length; i++) {
    const prevMs = new Date(fullCalendar[i - 1].startTimeISO).getTime();
    const currMs = new Date(fullCalendar[i].startTimeISO).getTime();
    assert.ok(
      prevMs <= currMs,
      `Expected ALL_UPCOMING chronological order, but ${fullCalendar[i - 1].startTimeISO} came before ${fullCalendar[i].startTimeISO}`
    );
  }

  // 3. Whole-Weekend F1 LIVE status & Session-level LIVE vs COMPLETED (DONE) status
  const brazilWknd = UPCOMING_F1_WEEKENDS.find((w) => w.id === 'f1-wknd-brazil')!;
  const fp1Session = brazilWknd.sessions.find((s) => s.id === 'f1-br-fp1')!;
  const fp2Session = brazilWknd.sessions.find((s) => s.id === 'f1-br-fp2')!;
  const duringFridayFp1Ms = new Date('2026-11-06T14:30:00Z').getTime();
  const duringFridayFp2Ms = new Date('2026-11-06T19:30:00Z').getTime();
  const afterFridayFp2FinishedMs = new Date('2026-11-06T20:05:00Z').getTime();
  const betweenSaturdaySessionsMs = new Date('2026-11-07T16:00:00Z').getTime();
  const afterSundayRaceFinishedMs = new Date('2026-11-08T20:00:00Z').getTime();

  // During FP1: FP1 is LIVE, FP2 is UPCOMING
  assert.equal(evaluateF1SessionRuntimeStatus(fp1Session, duringFridayFp1Ms), 'LIVE');
  assert.equal(evaluateF1SessionRuntimeStatus(fp2Session, duringFridayFp1Ms), 'UPCOMING');
  // During FP2 (PS2): FP1 is COMPLETED (DONE), FP2 is LIVE
  assert.equal(evaluateF1SessionRuntimeStatus(fp1Session, duringFridayFp2Ms), 'COMPLETED');
  assert.equal(evaluateF1SessionRuntimeStatus(fp2Session, duringFridayFp2Ms), 'LIVE');
  // Once FP2 finishes: both FP1 and FP2 are COMPLETED (DONE)
  assert.equal(evaluateF1SessionRuntimeStatus(fp1Session, afterFridayFp2FinishedMs), 'COMPLETED');
  assert.equal(evaluateF1SessionRuntimeStatus(fp2Session, afterFridayFp2FinishedMs), 'COMPLETED');

  assert.equal(evaluateF1WeekendLiveStatus(brazilWknd, duringFridayFp1Ms), 'LIVE');
  assert.equal(evaluateF1WeekendLiveStatus(brazilWknd, duringFridayFp2Ms), 'LIVE');
  assert.equal(evaluateF1WeekendLiveStatus(brazilWknd, betweenSaturdaySessionsMs), 'LIVE');
  assert.equal(evaluateF1WeekendLiveStatus(brazilWknd, afterSundayRaceFinishedMs), 'COMPLETED');

  // 4. Verify live ESPN Standings fetcher & Mathematical Integrity Validator for PL (eng.1), ISL (ind.1), and UCL (uefa.champions)
  const { fetchESPNLeagueStandings } = await import('../services/sportsApi');
  const { validateFootballLeagueTable, VERIFIED_CACHE_PREFIX_V5 } = await import('./dataValidator');
  assert.equal(VERIFIED_CACHE_PREFIX_V5, 'apex_pitch_verified_v5_');

  const [pl2025, pl2024, isl2025, ucl2025] = await Promise.all([
    fetchESPNLeagueStandings('eng.1', 2025, true),
    fetchESPNLeagueStandings('eng.1', 2024, true),
    fetchESPNLeagueStandings('ind.1', 2025, true),
    fetchESPNLeagueStandings('uefa.champions', 2025, true),
  ]);

  if (pl2025) {
    assert.equal(pl2025.rows.length, 20);
    assert.equal(validateFootballLeagueTable(pl2025, { expectedClubCount: 20 }).valid, true);
  }
  if (pl2024) {
    assert.equal(pl2024.rows.length, 20);
    assert.equal(pl2024.rows[0].teamName, 'Liverpool');
    assert.equal(pl2024.rows[0].points, 84);
  }
  if (isl2025) {
    assert.equal(isl2025.rows.length, 13);
    assert.equal(validateFootballLeagueTable(isl2025).valid, true);
  }
  if (ucl2025) {
    assert.equal(ucl2025.rows.length, 36);
    assert.equal(validateFootballLeagueTable(ucl2025).valid, true);
  }

  // 5. Bi-directional Samsung Clock Native Alarm Sync
  const setRes = await setSamsungMatchAlarm({
    eventId: 'match-isl-cfc-ebfc',
    title: 'Chennaiyin FC vs East Bengal FC',
    eventStartTimeISO: '2026-11-07T14:00:00Z',
  });
  assert.equal(setRes.success, true);
  assert.equal(setRes.hour, 19);
  assert.equal(setRes.minute, 30);
  assert.ok(setRes.toastMessage.includes('Samsung system alarm set for'));
  assert.equal(hasSamsungNativeAlarm('match-isl-cfc-ebfc'), true);
  assert.equal(
    getSamsungNativeAlarm('match-isl-cfc-ebfc')?.label,
    'APEX // Chennaiyin FC vs East Bengal FC'
  );

  const cancelRes = await cancelSamsungMatchAlarm('match-isl-cfc-ebfc');
  assert.equal(cancelRes.success, true);
  assert.equal(cancelRes.toastMessage, 'Samsung system alarm removed');
  assert.equal(hasSamsungNativeAlarm('match-isl-cfc-ebfc'), false);
});

test('Data Integrity & Anti-Stale Safeguards Engine enforces 5m/12h/7d Cache TTLs, UTC Z-normalization, and Payload Sanity checks', async () => {
  const {
    CACHE_TTL_MS,
    convertUTCToISTWithIntl,
    isCacheEntryExpired,
    normalizeToStrictUTCISO,
    validateEventPayloadSanity,
  } = await import('../services/sportsApi');
  const { PREMIER_LEAGUE_2025_26_FINAL_TABLE } = await import('../data/standingsData');

  // 1. Strict TTL constants: 5m live, 12h upcoming schedule, 7d archive/stats
  assert.equal(CACHE_TTL_MS.LIVE_STATE, 5 * 60 * 1000);
  assert.equal(CACHE_TTL_MS.UPCOMING_SCHEDULE, 12 * 60 * 60 * 1000);
  assert.equal(CACHE_TTL_MS.ARCHIVE_AND_STATS, 7 * 24 * 60 * 60 * 1000);

  const baseNow = new Date('2026-11-06T12:00:00Z').getTime();
  const fourMinsAgo = new Date(baseNow - 4 * 60 * 1000).toISOString();
  const sixMinsAgo = new Date(baseNow - 6 * 60 * 1000).toISOString();
  assert.equal(isCacheEntryExpired(fourMinsAgo, CACHE_TTL_MS.LIVE_STATE, baseNow), false);
  assert.equal(isCacheEntryExpired(sixMinsAgo, CACHE_TTL_MS.LIVE_STATE, baseNow), true);

  // 2. UTC ISO-8601 standardization appends 'Z' when missing offset
  const withoutZ = '2026-11-08T17:00:00';
  const normalized = normalizeToStrictUTCISO(withoutZ);
  assert.ok(normalized.endsWith('Z'), `Expected trailing Z on ${normalized}`);
  const istFromWithoutZ = convertUTCToISTWithIntl(withoutZ);
  assert.equal(istFromWithoutZ.time12hIST, '10:30 PM IST');

  // 3. Payload sanity validation before rendering or caching
  const validSanity = validateEventPayloadSanity({
    homeTeam: { code: 'ARS', name: 'Arsenal' },
    awayTeam: { code: 'MCI', name: 'Manchester City' },
    startTimeISO: '2026-11-08T16:30:00',
    liveStatus: 'UPCOMING',
  });
  assert.equal(validSanity.valid, true);
  assert.ok(validSanity.normalizedUTCISO.endsWith('Z'));

  const missingTeamSanity = validateEventPayloadSanity({
    homeTeam: { code: '', name: '' },
    awayTeam: { code: 'MCI', name: 'Manchester City' },
    startTimeISO: '2026-11-08T16:30:00Z',
  });
  assert.equal(missingTeamSanity.valid, false);

  const pastFixtureMarkedUpcoming = validateEventPayloadSanity(
    {
      homeTeam: 'Arsenal',
      awayTeam: 'Chelsea',
      date: '2026-10-01T15:00:00Z',
      liveStatus: 'UPCOMING',
    },
    {
      rejectPastMarkedAsUpcoming: true,
      referenceNowMs: baseNow,
    }
  );
  assert.equal(pastFixtureMarkedUpcoming.valid, false);

  // 4. Verify initial standings shells contain 0 hardcoded rows
  const plLive = FOOTBALL_LEAGUE_TABLES[0];
  assert.equal(plLive.id, 'league-pl');
  assert.equal(plLive.rows.length, 0);
  assert.equal(PREMIER_LEAGUE_2025_26_FINAL_TABLE.rows.length, 0);
});

test('F1 Schedule & Live Center sessions include fastest driver summaries and Top-10 sessionResults for completed FP1, FP2, FP3, Qualifying, and Grand Prix sessions', () => {
  const brazilWknd = UPCOMING_F1_WEEKENDS.find((w) => w.id === 'f1-wknd-brazil');
  assert.ok(brazilWknd, 'Expected Brazilian Grand Prix weekend in UPCOMING_F1_WEEKENDS');

  const fp1 = brazilWknd.sessions.find((s) => s.id === 'f1-br-fp1');
  const fp2 = brazilWknd.sessions.find((s) => s.id === 'f1-br-fp2');
  const fp3 = brazilWknd.sessions.find((s) => s.id === 'f1-br-fp3');
  assert.ok(fp1 && fp2 && fp3, 'Expected FP1, FP2, and FP3 sessions on Brazilian GP');

  assert.ok(fp1.fastestOrWinnerSummary?.includes('L. Norris') && fp1.fastestOrWinnerSummary?.includes('1:10.610 (S)'));
  assert.ok(fp2.fastestOrWinnerSummary?.includes('K. Antonelli') && fp2.fastestOrWinnerSummary?.includes('1:10.184 (S)'));
  assert.ok(fp3.fastestOrWinnerSummary?.includes('M. Verstappen') && fp3.fastestOrWinnerSummary?.includes('1:09.892 (S)'));

  assert.equal(fp1.sessionResults?.length, 10, 'Expected Top-10 sessionResults for FP1');
  assert.equal(fp2.sessionResults?.length, 10, 'Expected Top-10 sessionResults for FP2');
  assert.equal(fp3.sessionResults?.length, 10, 'Expected Top-10 sessionResults for FP3');
  assert.equal(fp1.sessionResults?.[0].driverCode, 'NOR');
  assert.equal(fp2.sessionResults?.[0].driverCode, 'ANT');
  assert.equal(fp3.sessionResults?.[0].driverCode, 'VER');

  // Verify completed rounds in F1_2026_FULL_SEASON also carry FP1, FP2, FP3, Qualifying, and Grand Prix results
  const completed2026Rounds = F1_2026_FULL_SEASON.filter((w) => w.status === 'COMPLETED');
  assert.equal(completed2026Rounds.length, 20, 'Expected 20 completed 2026 rounds');
  for (const roundWknd of completed2026Rounds) {
    for (const sess of roundWknd.sessions) {
      assert.ok(
        sess.fastestOrWinnerSummary && sess.fastestOrWinnerSummary.length > 0,
        `Expected fastestOrWinnerSummary on ${roundWknd.grandPrixName} ${sess.name}`
      );
      assert.equal(
        sess.sessionResults?.length,
        10,
        `Expected 10-driver session classification on ${roundWknd.grandPrixName} ${sess.name}`
      );
    }
  }
});

