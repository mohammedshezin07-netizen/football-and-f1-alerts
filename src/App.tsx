import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Archive,
  Bell,
  Calendar,
  Radio,
  Trophy,
} from 'lucide-react';
import {
  ALL_TEAMS,
  ARCHIVE_ITEMS,
  DEFAULT_FOLLOWED_TEAM_CODES,
  DRIVER_CAREER_REGISTRY,
  INITIAL_ARMED_ALARMS,
  LIVE_F1_INITIAL,
  LIVE_FOOTBALL_FEEDS,
  LIVE_FOOTBALL_INITIAL,
  UPCOMING_F1_WEEKENDS,
  UPCOMING_FOOTBALL_MATCHES,
} from './data/seedData';
import {
  F1_CONSTRUCTOR_STANDINGS_2026,
  F1_DRIVER_STANDINGS_2026,
  FOOTBALL_LEAGUE_TABLES,
} from './data/standingsData';
import { preloadOfficialLogos } from './data/logos';
import {
  ArmedAlarm,
  ClashDetectorSettings,
  ClashPair,
  F1ConstructorStandingRow,
  F1DriverCareerStats,
  F1DriverStandingRow,
  F1RosterTransferEvent,
  F1Weekend,
  FootballLeagueTable,
  FootballMatch,
  FootballPlayerStats,
  LiveF1State,
  LiveFootballState,
  PrefetchCacheEntry,
} from './types/sports';
import {
  buildPrefetchEntry,
  formatISTClock,
  generateGoogleCalendarUrl,
  generateICSContent,
} from './utils/scheduleLogic';
import {
  CACHE_TTL_MS,
  clearAllSportsCacheForForceSync,
  clearOutdatedCache,
  fetchSantosFCFixturesAndStandings,
  isCacheEntryExpired,
  sanitizeAndDeduplicateFixtures,
  sanitizeAndVerifyF1Weekends,
  verifyAndSyncSportsData,
} from './services/sportsApi';
import { purgeLegacyLocalStorageKeys } from './utils/dataValidator';
import {
  syncF1RosterAndStandings,
  VERIFIED_ROSTER_TRANSFERS,
} from './services/f1AutoSync';
import {
  formatSimpleCardTime,
  shouldActivateLivePolling,
} from './services/apiClient';
import { playAlarmAudio } from './utils/soundEngine';
import { TopUtilityBar } from './components/TopUtilityBar';
import { ScheduleTab } from './components/ScheduleTab';
import { LiveCenterTab } from './components/LiveCenterTab';
import { StandingsTab } from './components/StandingsTab';
import { ArchiveTab } from './components/ArchiveTab';
import { TeamsAlertsTab } from './components/TeamsAlertsTab';
import {
  AlarmConfigDrawer,
  InAppPushBanner,
  WakeUpAlertOverlay,
} from './components/AlarmModalAndDrawers';
import { AppInstallAndSyncModal } from './components/AppInstallAndSyncModal';
import {
  cancelSamsungMatchAlarm,
  setSamsungMatchAlarm,
  syncQueuedNativeAlarmsWithin24Hours,
} from './services/nativeAlarm';

type ActiveTab = 'SCHEDULE' | 'LIVE' | 'STANDINGS' | 'ARCHIVE' | 'TEAMS_ALERTS';

const STORAGE_KEYS = {
  THEME_DARK: 'apex_pitch_verified_v5_theme_dark',
  FOLLOWED_TEAMS: 'apex_pitch_verified_v5_followed_teams_v2',
  ARMED_ALARMS: 'apex_pitch_verified_v5_armed_alarms',
  ACTIVE_ALERTS: 'apex_active_alerts',
  SPOILER_FREE: 'apex_pitch_verified_v5_spoiler_free',
  PREFETCH_CACHE: 'apex_pitch_verified_v5_prefetch_cache',
  PLAYER_STATS_CACHE: 'apex_pitch_verified_v5_player_stats',
  DRIVER_STATS_CACHE: 'apex_pitch_verified_v5_driver_stats',
  LAST_SYNC_IST: 'apex_pitch_verified_v5_last_sync_ist',
  MATCHES_DATA: 'apex_pitch_verified_v5_matches_data_v15',
  FOOTBALL_STANDINGS_DATA: 'apex_pitch_verified_v5_football_standings',
  F1_WEEKENDS_DATA: 'apex_pitch_verified_v5_f1_weekends_data_v15',
  CLASH_SETTINGS: 'apex_pitch_verified_v5_clash_settings',
};

// One-time cleanup of all legacy/unverified localStorage keys on module load
purgeLegacyLocalStorageKeys();

const KEY_TTL_MAP: Record<string, number> = {
  [STORAGE_KEYS.MATCHES_DATA]: CACHE_TTL_MS.UPCOMING_SCHEDULE, // 12 hours
  [STORAGE_KEYS.FOOTBALL_STANDINGS_DATA]: CACHE_TTL_MS.UPCOMING_SCHEDULE, // 12 hours
  [STORAGE_KEYS.F1_WEEKENDS_DATA]: CACHE_TTL_MS.UPCOMING_SCHEDULE, // 12 hours
  [STORAGE_KEYS.PREFETCH_CACHE]: CACHE_TTL_MS.LIVE_STATE, // 5 minutes
  [STORAGE_KEYS.PLAYER_STATS_CACHE]: CACHE_TTL_MS.ARCHIVE_AND_STATS, // 7 days
  [STORAGE_KEYS.DRIVER_STATS_CACHE]: CACHE_TTL_MS.ARCHIVE_AND_STATS, // 7 days
};

const DEFAULT_CLASH_DETECTOR_SETTINGS: ClashDetectorSettings = {
  enabled: true,
  filterMode: 'FOLLOWED_ONLY',
  clashTypeMode: 'ALL_CLASHES',
  customTeamCodes: ['MCI', 'SAN', 'KBFC', 'RMA', 'BAR', 'ARS', 'LIV'],
  keySessionsOnly: false,
  bufferMinutes: 0,
  dismissedClashIds: [],
};

function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    const ttl = KEY_TTL_MAP[key];
    if (
      ttl &&
      parsed &&
      typeof parsed === 'object' &&
      '__cachedAtISO' in parsed &&
      '__data' in parsed
    ) {
      if (isCacheEntryExpired(parsed.__cachedAtISO as string, ttl)) {
        window.localStorage.removeItem(key);
        return fallback;
      }
      return parsed.__data as T;
    }
    return parsed as T;
  } catch {
    return fallback;
  }
}

function writeStorage<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    const ttl = KEY_TTL_MAP[key];
    const payload = ttl
      ? { __cachedAtISO: new Date().toISOString(), __data: value }
      : value;
    window.localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // Ignore storage quota errors
  }
}

/**
 * Synchronously applies the 'dark' or 'light' class and color-scheme to document.documentElement
 * to guarantee zero flickering across initial mount and theme toggles.
 */
function applyDocumentThemeClass(isDarkTheme: boolean): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (isDarkTheme) {
    root.classList.add('dark');
    root.classList.remove('light');
    root.dataset.theme = 'dark';
    root.style.colorScheme = 'dark';
  } else {
    root.classList.remove('dark');
    root.classList.add('light');
    root.dataset.theme = 'light';
    root.style.colorScheme = 'light';
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('SCHEDULE');
  const [showInstallAndSyncModal, setShowInstallAndSyncModal] = useState<boolean>(false);
  const [isDark, setIsDark] = useState<boolean>(() => {
    const stored = readStorage<boolean>(STORAGE_KEYS.THEME_DARK, true);
    applyDocumentThemeClass(stored);
    return stored;
  });
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine !== false : true
  );
  const [isSyncingLiveApi, setIsSyncingLiveApi] = useState<boolean>(false);
  const [liveApiSources, setLiveApiSources] = useState<string[]>([
    'OpenF1 Telemetry API (api.openf1.org)',
    'Jolpica-F1 FIA API (api.jolpi.ca)',
    'Verified Built-In Football Seed Engine (Zero Keys Required)',
  ]);

  const [spoilerFree, setSpoilerFree] = useState<boolean>(() =>
    readStorage(STORAGE_KEYS.SPOILER_FREE, false)
  );

  const [clashSettings, setClashSettings] = useState<ClashDetectorSettings>(
    () => readStorage(STORAGE_KEYS.CLASH_SETTINGS, DEFAULT_CLASH_DETECTOR_SETTINGS)
  );

  const [matches, setMatches] = useState<FootballMatch[]>(() =>
    sanitizeAndDeduplicateFixtures(
      readStorage(STORAGE_KEYS.MATCHES_DATA, UPCOMING_FOOTBALL_MATCHES)
    )
  );

  const [f1Weekends, setF1Weekends] = useState<F1Weekend[]>(() =>
    sanitizeAndVerifyF1Weekends(
      readStorage(STORAGE_KEYS.F1_WEEKENDS_DATA, UPCOMING_F1_WEEKENDS)
    )
  );

  const [followedTeamCodes, setFollowedTeamCodes] = useState<string[]>(() =>
    readStorage(STORAGE_KEYS.FOLLOWED_TEAMS, DEFAULT_FOLLOWED_TEAM_CODES)
  );

  const [armedAlarms, setArmedAlarms] = useState<ArmedAlarm[]>(() =>
    readStorage(STORAGE_KEYS.ARMED_ALARMS, INITIAL_ARMED_ALARMS)
  );

  const [prefetchCache, setPrefetchCache] = useState<
    Record<string, PrefetchCacheEntry>
  >(() => {
    const initialMap: Record<string, PrefetchCacheEntry> = {};
    UPCOMING_FOOTBALL_MATCHES.slice(0, 3).forEach((m) => {
      initialMap[m.id] = buildPrefetchEntry(m, 'SEED_CACHE');
    });
    if (UPCOMING_F1_WEEKENDS[0]) {
      initialMap[UPCOMING_F1_WEEKENDS[0].id] = buildPrefetchEntry(
        UPCOMING_F1_WEEKENDS[0],
        'SEED_CACHE'
      );
    }
    return readStorage(STORAGE_KEYS.PREFETCH_CACHE, initialMap);
  });

  const [playerStatsCache, setPlayerStatsCache] = useState<
    Record<string, FootballPlayerStats>
  >(() => {
    const map: Record<string, FootballPlayerStats> = {};
    LIVE_FOOTBALL_FEEDS.forEach((feed) => {
      feed.keyPlayers.forEach((p) => {
        map[p.id] = p;
      });
    });
    return readStorage(STORAGE_KEYS.PLAYER_STATS_CACHE, map);
  });

  const [driverCareerCache, setDriverCareerCache] = useState<
    Record<string, F1DriverCareerStats>
  >(() =>
    readStorage(STORAGE_KEYS.DRIVER_STATS_CACHE, DRIVER_CAREER_REGISTRY)
  );

  const [driverStandings, setDriverStandings] = useState<
    F1DriverStandingRow[]
  >(F1_DRIVER_STANDINGS_2026);

  const [constructorStandings, setConstructorStandings] = useState<
    F1ConstructorStandingRow[]
  >(F1_CONSTRUCTOR_STANDINGS_2026);

  const [footballLeagueTables, setFootballLeagueTables] = useState<
    FootballLeagueTable[]
  >(() =>
    readStorage(STORAGE_KEYS.FOOTBALL_STANDINGS_DATA, FOOTBALL_LEAGUE_TABLES)
  );

  const [rosterTransfers, setRosterTransfers] = useState<
    F1RosterTransferEvent[]
  >(VERIFIED_ROSTER_TRANSFERS);

  const [liveF1, setLiveF1] = useState<LiveF1State>(LIVE_F1_INITIAL);
  const [liveFootball, setLiveFootball] = useState<LiveFootballState>(
    LIVE_FOOTBALL_INITIAL
  );

  const [logoCacheStatus, setLogoCacheStatus] = useState<{
    cachedCount: number;
    totalCount: number;
  }>({ cachedCount: 48, totalCount: 48 });

  const [lastSyncedAtIST, setLastSyncedAtIST] = useState<string>(() =>
    readStorage(STORAGE_KEYS.LAST_SYNC_IST, formatISTClock())
  );

  const [alarmDrawerTarget, setAlarmDrawerTarget] = useState<{
    id: string;
    parentId?: string;
    sport: 'FOOTBALL' | 'F1';
    title: string;
    subtitle: string;
    eventStartTimeISO: string;
    istTimeLabel: string;
  } | null>(null);

  const [activeWakeUpAlert, setActiveWakeUpAlert] =
    useState<ArmedAlarm | null>(null);

  const [pushBanner, setPushBanner] = useState<{
    sport: 'FOOTBALL' | 'F1';
    title: string;
    message: string;
    timestampIST: string;
  } | null>(null);

  const mainScrollRef = useRef<HTMLElement | null>(null);

  // Scroll to top when switching main navigation tabs
  useEffect(() => {
    if (mainScrollRef.current) {
      mainScrollRef.current.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    }
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [activeTab]);

  // Synchronously sync dark/light mode class on <html> before browser paint to prevent flickering
  useLayoutEffect(() => {
    applyDocumentThemeClass(isDark);
    writeStorage(STORAGE_KEYS.THEME_DARK, isDark);
  }, [isDark]);

  const handleToggleTheme = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      applyDocumentThemeClass(next);
      writeStorage(STORAGE_KEYS.THEME_DARK, next);
      return next;
    });
  }, []);

  useEffect(() => {
    writeStorage(STORAGE_KEYS.CLASH_SETTINGS, clashSettings);
  }, [clashSettings]);

  // Listen to browser online/offline events
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    writeStorage(STORAGE_KEYS.FOLLOWED_TEAMS, followedTeamCodes);
  }, [followedTeamCodes]);

  useEffect(() => {
    writeStorage(STORAGE_KEYS.ARMED_ALARMS, armedAlarms);
    writeStorage(
      STORAGE_KEYS.ACTIVE_ALERTS,
      armedAlarms.map((a) => a.id)
    );
  }, [armedAlarms]);

  useEffect(() => {
    writeStorage(STORAGE_KEYS.SPOILER_FREE, spoilerFree);
  }, [spoilerFree]);

  useEffect(() => {
    writeStorage(STORAGE_KEYS.PREFETCH_CACHE, prefetchCache);
  }, [prefetchCache]);

  useEffect(() => {
    writeStorage(STORAGE_KEYS.PLAYER_STATS_CACHE, playerStatsCache);
  }, [playerStatsCache]);

  useEffect(() => {
    writeStorage(STORAGE_KEYS.DRIVER_STATS_CACHE, driverCareerCache);
  }, [driverCareerCache]);

  useEffect(() => {
    writeStorage(STORAGE_KEYS.MATCHES_DATA, matches);
  }, [matches]);

  useEffect(() => {
    writeStorage(STORAGE_KEYS.FOOTBALL_STANDINGS_DATA, footballLeagueTables);
  }, [footballLeagueTables]);

  useEffect(() => {
    writeStorage(STORAGE_KEYS.F1_WEEKENDS_DATA, f1Weekends);
  }, [f1Weekends]);

  useEffect(() => {
    preloadOfficialLogos().then((status) => {
      setLogoCacheStatus(status);
    });
  }, []);

  // Background auto-sync of F1 Driver Roster & Standings + OpenF1 + API-Football v3 Santos FC verification
  useEffect(() => {
    if (!isOnline) return;
    let cancelled = false;

    syncF1RosterAndStandings()
      .then((res) => {
        if (cancelled) return;
        setDriverStandings(res.standings);
        setConstructorStandings(res.constructorStandings);
        setDriverCareerCache((prev) => ({ ...prev, ...res.careerRegistry }));
        setRosterTransfers(res.transferEvents);
      })
      .catch(() => {
        // Fallback already loaded
      });

    fetchSantosFCFixturesAndStandings({ forceRefresh: false })
      .then((santosData) => {
        if (cancelled) return;
        if (santosData.footballLeagueTables.some((t) => t.rows.length > 0)) {
          setFootballLeagueTables(santosData.footballLeagueTables);
        }
      })
      .catch(() => {
        // Fallback already loaded
      });

    verifyAndSyncSportsData({
      fallbackMatches: UPCOMING_FOOTBALL_MATCHES,
      fallbackF1Weekends: UPCOMING_F1_WEEKENDS,
      fallbackLiveF1: LIVE_F1_INITIAL,
      forceRefresh: false,
    })
      .then((verified) => {
        if (cancelled) return;
        setMatches(verified.matches);
        const activeOrRecentMatch =
          verified.matches.find((m) => m.liveStatus === 'LIVE') ||
          verified.matches.find(
            (m) =>
              m.liveStatus === 'FINAL' &&
              typeof m.homeScore === 'number' &&
              typeof m.awayScore === 'number'
          );
        if (activeOrRecentMatch) {
          const parsedMin = parseInt(
            String(activeOrRecentMatch.liveMinute || '90').replace(/\D/g, ''),
            10
          );
          setLiveFootball((prev) => ({
            ...prev,
            id: activeOrRecentMatch.id,
            competition: activeOrRecentMatch.competition,
            competitionLogo: activeOrRecentMatch.competitionLogo,
            venue: activeOrRecentMatch.venue,
            minute: Number.isNaN(parsedMin) ? prev.minute : parsedMin,
            status:
              activeOrRecentMatch.liveStatus === 'LIVE'
                ? 'LIVE 2ND HALF'
                : 'FT',
            homeTeam: {
              ...prev.homeTeam,
              name: activeOrRecentMatch.homeTeam.name,
              code: activeOrRecentMatch.homeTeam.code,
              logo: activeOrRecentMatch.homeTeam.logo,
              score: activeOrRecentMatch.homeScore ?? prev.homeTeam.score,
            },
            awayTeam: {
              ...prev.awayTeam,
              name: activeOrRecentMatch.awayTeam.name,
              code: activeOrRecentMatch.awayTeam.code,
              logo: activeOrRecentMatch.awayTeam.logo,
              score: activeOrRecentMatch.awayScore ?? prev.awayTeam.score,
            },
          }));
        }
        if (verified.footballLeagueTables.some((t) => t.rows.length > 0)) {
          setFootballLeagueTables(verified.footballLeagueTables);
        }
        setF1Weekends(verified.f1Weekends);
        setLiveF1(verified.liveF1);
        setLiveApiSources(verified.sources);
        setLastSyncedAtIST(verified.lastVerifiedIST);
      })
      .catch(() => {
        // Fallback already loaded
      });

    void syncQueuedNativeAlarmsWithin24Hours();

    return () => {
      cancelled = true;
    };
  }, [isOnline]);

  const handleSyncLiveSportsApi = useCallback(async () => {
    if (!isOnline) return;
    setIsSyncingLiveApi(true);
    try {
      const [verified, rosterSync, santosSync] = await Promise.all([
        verifyAndSyncSportsData({
          fallbackMatches: UPCOMING_FOOTBALL_MATCHES,
          fallbackF1Weekends: UPCOMING_F1_WEEKENDS,
          fallbackLiveF1: LIVE_F1_INITIAL,
          forceRefresh: true,
        }),
        syncF1RosterAndStandings(true),
        fetchSantosFCFixturesAndStandings({ forceRefresh: true }),
      ]);

      setMatches(verified.matches);
      const activeOrRecentMatch =
        verified.matches.find((m) => m.liveStatus === 'LIVE') ||
        verified.matches.find(
          (m) =>
            m.liveStatus === 'FINAL' &&
            typeof m.homeScore === 'number' &&
            typeof m.awayScore === 'number'
        );
      if (activeOrRecentMatch) {
        const parsedMin = parseInt(
          String(activeOrRecentMatch.liveMinute || '90').replace(/\D/g, ''),
          10
        );
        setLiveFootball((prev) => ({
          ...prev,
          id: activeOrRecentMatch.id,
          competition: activeOrRecentMatch.competition,
          competitionLogo: activeOrRecentMatch.competitionLogo,
          venue: activeOrRecentMatch.venue,
          minute: Number.isNaN(parsedMin) ? prev.minute : parsedMin,
          status:
            activeOrRecentMatch.liveStatus === 'LIVE'
              ? 'LIVE 2ND HALF'
              : 'FT',
          homeTeam: {
            ...prev.homeTeam,
            name: activeOrRecentMatch.homeTeam.name,
            code: activeOrRecentMatch.homeTeam.code,
            logo: activeOrRecentMatch.homeTeam.logo,
            score: activeOrRecentMatch.homeScore ?? prev.homeTeam.score,
          },
          awayTeam: {
            ...prev.awayTeam,
            name: activeOrRecentMatch.awayTeam.name,
            code: activeOrRecentMatch.awayTeam.code,
            logo: activeOrRecentMatch.awayTeam.logo,
            score: activeOrRecentMatch.awayScore ?? prev.awayTeam.score,
          },
        }));
      }
      if (santosSync.footballLeagueTables.some((t) => t.rows.length > 0)) {
        setFootballLeagueTables(santosSync.footballLeagueTables);
      } else if (verified.footballLeagueTables.some((t) => t.rows.length > 0)) {
        setFootballLeagueTables(verified.footballLeagueTables);
      }
      setF1Weekends(verified.f1Weekends);
      setLiveF1(verified.liveF1);
      setLiveApiSources(verified.sources);
      setDriverStandings(rosterSync.standings);
      setConstructorStandings(rosterSync.constructorStandings);
      setDriverCareerCache((prev) => ({
        ...prev,
        ...rosterSync.careerRegistry,
      }));
      setRosterTransfers(rosterSync.transferEvents);
      setLastSyncedAtIST(verified.lastVerifiedIST);
      writeStorage(STORAGE_KEYS.LAST_SYNC_IST, verified.lastVerifiedIST);

      setPushBanner({
        sport: 'FOOTBALL',
        title: 'Schedules & Standings Updated',
        message: `Synced ${verified.matches.length} Football fixtures & ${verified.f1Weekends.length} Formula 1 race weekends in IST.`,
        timestampIST: verified.lastVerifiedIST,
      });
    } finally {
      setIsSyncingLiveApi(false);
    }
  }, [isOnline]);

  // Smart Background Live Polling Gatekeeper:
  // Polls every 45 seconds ONLY when at least one match or F1 session is verified as 'LIVE'.
  // Remains at 0 req/s when no event is live.
  useEffect(() => {
    if (!isOnline) return;
    const candidateEvents = [
      ...matches.map((m) => ({
        startTimeISO: m.startTimeISO,
        durationMinutes: m.durationMinutes ?? 115,
        apiState:
          m.liveStatus === 'LIVE'
            ? 'in'
            : m.liveStatus === 'FINAL'
            ? 'post'
            : 'pre',
      })),
      ...f1Weekends.flatMap((w) =>
        w.sessions.map((s) => ({
          startTimeISO: s.startTimeISO,
          durationMinutes: s.durationMinutes ?? 90,
          apiState:
            s.status === 'LIVE'
              ? 'in'
              : s.status === 'COMPLETED'
              ? 'post'
              : 'pre',
        }))
      ),
    ];

    if (!shouldActivateLivePolling(candidateEvents)) {
      return;
    }

    const timer = window.setInterval(() => {
      void verifyAndSyncSportsData({
        fallbackMatches: matches,
        fallbackF1Weekends: f1Weekends,
        fallbackLiveF1: liveF1,
        forceRefresh: true,
      }).then((verified) => {
        setMatches(verified.matches);
        setF1Weekends(verified.f1Weekends);
        setLiveF1(verified.liveF1);
        setLastSyncedAtIST(verified.lastVerifiedIST);
      });
    }, 45_000);

    return () => window.clearInterval(timer);
  }, [isOnline, matches, f1Weekends, liveF1]);

  const handleRegisterPrefetchedEntries = useCallback(
    (entries: PrefetchCacheEntry[]) => {
      setPrefetchCache((prev) => {
        const next = { ...prev };
        let changed = false;
        for (const entry of entries) {
          if (!next[entry.eventId]) {
            next[entry.eventId] = entry;
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    },
    []
  );

  const handleCachePlayerStats = useCallback((player: FootballPlayerStats) => {
    setPlayerStatsCache((prev) => ({ ...prev, [player.id]: player }));
  }, []);

  const handleCacheDriverStats = useCallback((driver: F1DriverCareerStats) => {
    setDriverCareerCache((prev) => ({ ...prev, [driver.id]: driver }));
  }, []);

  const handleSaveAlarm = (alarm: ArmedAlarm) => {
    setArmedAlarms((prev) => {
      const exists = prev.some((a) => a.id === alarm.id);
      if (exists) {
        return prev.map((a) => (a.id === alarm.id ? alarm : a));
      }
      return [alarm, ...prev];
    });

    setSamsungMatchAlarm({
      eventId: alarm.id,
      title: alarm.title,
      eventStartTimeISO: alarm.eventStartTimeISO,
      leadTimeMinutes: alarm.leadTimeMinutes,
    }).then((res) => {
      setPushBanner({
        sport: alarm.sport,
        title: 'Samsung Clock Synchronized',
        message: res.toastMessage,
        timestampIST: formatISTClock(),
      });
    });
  };

  const handleToggleSamsungAlarm = (target: {
    id: string;
    parentId?: string;
    sport: 'FOOTBALL' | 'F1';
    title: string;
    subtitle: string;
    eventStartTimeISO: string;
    istTimeLabel: string;
  }) => {
    const isCurrentlyArmed = armedAlarms.some((a) => a.id === target.id);
    if (isCurrentlyArmed) {
      handleRemoveAlarm(target.id);
      return;
    }

    const newAlarm: ArmedAlarm = {
      id: target.id,
      parentId: target.parentId,
      sport: target.sport,
      title: target.title,
      subtitle: target.subtitle,
      eventStartTimeISO: target.eventStartTimeISO,
      istTimeLabel: target.istTimeLabel,
      leadTimeMinutes: 0,
      soundProfile:
        target.sport === 'F1' ? 'F1_PIT_SIREN' : 'BROADCAST_CHIME',
      customLabel: `APEX // ${target.title}`,
      createdAtISO: new Date().toISOString(),
    };
    playAlarmAudio(newAlarm.soundProfile);
    handleSaveAlarm(newAlarm);
  };

  const handleArmDualClashAlarms = (clash: ClashPair) => {
    if (clash.isCompleted) return;

    const fbAlarm: ArmedAlarm = {
      id: clash.footballMatchId,
      sport: 'FOOTBALL',
      title: `${clash.footballInfo.homeCode} vs ${clash.footballInfo.awayCode} • ${clash.footballInfo.competition}`,
      subtitle: `${clash.footballInfo.venue} • ${clash.footballInfo.istDateLabel}`,
      eventStartTimeISO: clash.footballInfo.startTimeISO,
      istTimeLabel: formatSimpleCardTime(clash.footballInfo.startTimeISO),
      leadTimeMinutes: 15,
      soundProfile: 'BROADCAST_CHIME',
      customLabel: 'Dual-Screen Football Clash Reminder',
      createdAtISO: new Date().toISOString(),
    };

    if (
      clash.clashType === 'FOOTBALL_VS_FOOTBALL' &&
      clash.secondFootballInfo
    ) {
      const secondId = clash.secondFootballMatchId || clash.f1SessionId;
      const fbAlarm2: ArmedAlarm = {
        id: secondId,
        sport: 'FOOTBALL',
        title: `${clash.secondFootballInfo.homeCode} vs ${clash.secondFootballInfo.awayCode} • ${clash.secondFootballInfo.competition}`,
        subtitle: `${clash.secondFootballInfo.venue} • ${clash.secondFootballInfo.istDateLabel}`,
        eventStartTimeISO: clash.secondFootballInfo.startTimeISO,
        istTimeLabel: formatSimpleCardTime(
          clash.secondFootballInfo.startTimeISO
        ),
        leadTimeMinutes: 15,
        soundProfile: 'BROADCAST_CHIME',
        customLabel: 'Dual-Screen Match × Match Clash Reminder',
        createdAtISO: new Date().toISOString(),
      };

      playAlarmAudio('BROADCAST_CHIME');
      setArmedAlarms((prev) => {
        const filtered = prev.filter(
          (a) => a.id !== fbAlarm.id && a.id !== fbAlarm2.id
        );
        return [fbAlarm, fbAlarm2, ...filtered];
      });

      void setSamsungMatchAlarm({
        eventId: fbAlarm.id,
        title: fbAlarm.title,
        eventStartTimeISO: fbAlarm.eventStartTimeISO,
        leadTimeMinutes: fbAlarm.leadTimeMinutes,
      });
      void setSamsungMatchAlarm({
        eventId: fbAlarm2.id,
        title: fbAlarm2.title,
        eventStartTimeISO: fbAlarm2.eventStartTimeISO,
        leadTimeMinutes: fbAlarm2.leadTimeMinutes,
      });

      setPushBanner({
        sport: 'FOOTBALL',
        title: 'Dual Match Clash Reminders Set',
        message: `Samsung system alarms set for ${clash.footballInfo.homeCode} vs ${clash.footballInfo.awayCode} & ${clash.secondFootballInfo.homeCode} vs ${clash.secondFootballInfo.awayCode}.`,
        timestampIST: formatISTClock(),
      });
      return;
    }

    const f1Alarm: ArmedAlarm = {
      id: clash.f1SessionId,
      parentId: clash.f1WeekendId,
      sport: 'F1',
      title: `${clash.f1Info.grandPrixName} • ${clash.f1Info.sessionName}`,
      subtitle: `${clash.f1Info.circuitName} • ${clash.f1Info.istDateLabel}`,
      eventStartTimeISO: clash.f1Info.startTimeISO,
      istTimeLabel: formatSimpleCardTime(clash.f1Info.startTimeISO),
      leadTimeMinutes: 15,
      soundProfile: 'F1_PIT_SIREN',
      customLabel: 'Dual-Screen F1 Clash Reminder',
      createdAtISO: new Date().toISOString(),
    };

    playAlarmAudio('BROADCAST_CHIME');
    setArmedAlarms((prev) => {
      const filtered = prev.filter(
        (a) => a.id !== fbAlarm.id && a.id !== f1Alarm.id
      );
      return [fbAlarm, f1Alarm, ...filtered];
    });

    void setSamsungMatchAlarm({
      eventId: fbAlarm.id,
      title: fbAlarm.title,
      eventStartTimeISO: fbAlarm.eventStartTimeISO,
      leadTimeMinutes: fbAlarm.leadTimeMinutes,
    });
    void setSamsungMatchAlarm({
      eventId: f1Alarm.id,
      title: f1Alarm.title,
      eventStartTimeISO: f1Alarm.eventStartTimeISO,
      leadTimeMinutes: f1Alarm.leadTimeMinutes,
    });

    setPushBanner({
      sport: 'F1',
      title: 'Dual Clash Reminders Set',
      message: `Samsung system alarms set for ${clash.footballInfo.homeCode} vs ${clash.footballInfo.awayCode} & ${clash.f1Info.grandPrixName}.`,
      timestampIST: formatISTClock(),
    });
  };

  const handleRemoveAlarm = (id: string) => {
    const existing = armedAlarms.find((a) => a.id === id);
    setArmedAlarms((prev) => prev.filter((a) => a.id !== id));
    cancelSamsungMatchAlarm(id).then((res) => {
      setPushBanner({
        sport: existing?.sport || 'FOOTBALL',
        title: 'Samsung System Alarm Removed',
        message: res.toastMessage,
        timestampIST: formatISTClock(),
      });
    });
  };

  const handleToggleFollowTeam = (code: string) => {
    setFollowedTeamCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const triggerDownloadICS = (icsContent: string, filename: string) => {
    if (typeof window === 'undefined') return;
    const blob = new Blob([icsContent], {
      type: 'text/calendar;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const triggerGoogleCalendarLink = (url: string) => {
    if (typeof document === 'undefined') return;
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportSingleCalendarEvent = (event: {
    id: string;
    parentId?: string;
    sport?: 'FOOTBALL' | 'F1';
    title: string;
    description: string;
    location: string;
    startTimeISO: string;
    durationMinutes: number;
    mode?: 'ICS' | 'GOOGLE_CALENDAR';
  }) => {
    const sport: 'FOOTBALL' | 'F1' =
      event.sport || (event.id.startsWith('f1') ? 'F1' : 'FOOTBALL');

    if (event.mode === 'GOOGLE_CALENDAR') {
      const gcalUrl = generateGoogleCalendarUrl(event);
      triggerGoogleCalendarLink(gcalUrl);
    } else {
      const ics = generateICSContent([event]);
      triggerDownloadICS(ics, `${event.id}.ics`);
    }

    // Automatically save this event's unique ID into active alarms/alerts state & apex_active_alerts
    setArmedAlarms((prev) => {
      const exists = prev.some((a) => a.id === event.id);
      if (exists) {
        const nextIds = prev.map((a) => a.id);
        writeStorage(STORAGE_KEYS.ACTIVE_ALERTS, nextIds);
        return prev;
      }
      const newAlarm: ArmedAlarm = {
        id: event.id,
        parentId: event.parentId,
        sport,
        title: event.title,
        subtitle: `${event.location} • ${event.description}`,
        eventStartTimeISO: event.startTimeISO,
        istTimeLabel: formatSimpleCardTime(event.startTimeISO),
        leadTimeMinutes: 15,
        soundProfile: sport === 'F1' ? 'F1_PIT_SIREN' : 'BROADCAST_CHIME',
        customLabel: `Active / Armed • ${event.title}`,
        createdAtISO: new Date().toISOString(),
      };
      const updated = [newAlarm, ...prev];
      writeStorage(STORAGE_KEYS.ARMED_ALARMS, updated);
      writeStorage(
        STORAGE_KEYS.ACTIVE_ALERTS,
        updated.map((a) => a.id)
      );
      return updated;
    });

    setPushBanner({
      sport,
      title:
        event.mode === 'GOOGLE_CALENDAR'
          ? 'Google Calendar Synced • Alert Armed'
          : 'Calendar Event Exported • Alert Armed',
      message: `${event.title} exported with 15m reminder & marked Active / Armed.`,
      timestampIST: formatISTClock(),
    });
  };

  const handleExportArmedSessionsICS = () => {
    if (armedAlarms.length === 0) {
      setPushBanner({
        sport: 'FOOTBALL',
        title: 'No Armed Alerts',
        message: 'No armed alerts to export. Toggle an alert on a session first.',
        timestampIST: formatISTClock(),
      });
      return;
    }

    const armedEvents = armedAlarms.map((alarm) => {
      const matchedFootball = matches.find((m) => m.id === alarm.id);
      if (matchedFootball) {
        return {
          id: matchedFootball.id,
          title: `${matchedFootball.homeTeam.name} vs ${matchedFootball.awayTeam.name} (${matchedFootball.competition})`,
          description: `${matchedFootball.competition} (${matchedFootball.matchweek})`,
          location: `${matchedFootball.venue}, ${matchedFootball.city}`,
          startTimeISO: matchedFootball.startTimeISO,
          durationMinutes: matchedFootball.durationMinutes,
        };
      }

      for (const wknd of f1Weekends) {
        const matchedSession = wknd.sessions.find((s) => s.id === alarm.id);
        if (matchedSession) {
          return {
            id: matchedSession.id,
            title: `F1 ${wknd.grandPrixName} — ${matchedSession.name}`,
            description: `${wknd.officialTitle} (${matchedSession.shortLabel})`,
            location: `${wknd.circuitName}, ${wknd.city}`,
            startTimeISO: matchedSession.startTimeISO,
            durationMinutes: matchedSession.durationMinutes,
          };
        }
      }

      return {
        id: alarm.id,
        title: alarm.title,
        description: alarm.subtitle || alarm.customLabel,
        location: alarm.subtitle || 'APEX PITCH Schedule',
        startTimeISO: alarm.eventStartTimeISO,
        durationMinutes: alarm.sport === 'F1' ? 120 : 115,
      };
    });

    const ics = generateICSContent(armedEvents);
    triggerDownloadICS(ics, 'apex-pitch-armed-sessions.ics');
    setPushBanner({
      sport: armedAlarms[0]?.sport || 'FOOTBALL',
      title: 'Armed Sessions Exported (.ics)',
      message: `Exported ${armedEvents.length} armed session${armedEvents.length === 1 ? '' : 's'} with 15-minute popup alarms.`,
      timestampIST: formatISTClock(),
    });
  };

  const handleExportFullScheduleICS = (
    customEvents?: {
      id: string;
      title: string;
      description: string;
      location: string;
      startTimeISO: string;
      durationMinutes: number;
    }[]
  ) => {
    if (customEvents && customEvents.length > 0) {
      const ics = generateICSContent(customEvents);
      triggerDownloadICS(ics, 'apex-pitch-full-schedule.ics');
      setPushBanner({
        sport: 'F1',
        title: 'Full Schedule Exported (.ics)',
        message: `Exported ${customEvents.length} upcoming schedule events with 15m VALARM reminders.`,
        timestampIST: formatISTClock(),
      });
      return;
    }

    const upcomingMatches = matches
      .filter((m) => m.liveStatus !== 'FINAL' && m.timeWindow !== 'PAST_RESULTS')
      .map((m) => ({
        id: m.id,
        title: `${m.homeTeam.name} vs ${m.awayTeam.name} (${m.competition})`,
        description: `${m.competition} (${m.matchweek})`,
        location: `${m.venue}, ${m.city}`,
        startTimeISO: m.startTimeISO,
        durationMinutes: m.durationMinutes,
      }));

    const upcomingF1Events = f1Weekends
      .filter((w) => w.status !== 'COMPLETED')
      .flatMap((w) =>
        w.sessions.map((s) => ({
          id: s.id,
          title: `F1 ${w.grandPrixName} — ${s.name}`,
          description: `${w.officialTitle} (${s.shortLabel})`,
          location: `${w.circuitName}, ${w.city}`,
          startTimeISO: s.startTimeISO,
          durationMinutes: s.durationMinutes,
        }))
      );

    const allEvents = [...upcomingMatches, ...upcomingF1Events];
    const ics = generateICSContent(allEvents);
    triggerDownloadICS(ics, 'apex-pitch-full-schedule.ics');
    setPushBanner({
      sport: 'F1',
      title: 'Full Season / Weekend Schedule Exported',
      message: `Exported ${allEvents.length} upcoming Football & F1 sessions (.ics).`,
      timestampIST: formatISTClock(),
    });
  };

  const handleExportAllFollowedICS = () => {
    const followedMatches = matches
      .filter(
        (m) =>
          m.liveStatus !== 'FINAL' &&
          m.timeWindow !== 'PAST_RESULTS' &&
          (followedTeamCodes.includes(m.homeTeam.code) ||
            followedTeamCodes.includes(m.awayTeam.code))
      )
      .map((m) => ({
        id: m.id,
        title: `${m.homeTeam.name} vs ${m.awayTeam.name} (${m.competition})`,
        description: `${m.competition} (${m.matchweek})`,
        location: `${m.venue}, ${m.city}`,
        startTimeISO: m.startTimeISO,
        durationMinutes: m.durationMinutes,
      }));

    const f1Events = f1Weekends
      .filter((w) => w.status !== 'COMPLETED')
      .flatMap((w) =>
        w.sessions
          .filter((s) => s.name === 'Qualifying' || s.name === 'Grand Prix')
          .map((s) => ({
            id: s.id,
            title: `F1 ${w.grandPrixName} — ${s.name}`,
            description: `${w.officialTitle} (${s.shortLabel})`,
            location: `${w.circuitName}, ${w.city}`,
            startTimeISO: s.startTimeISO,
            durationMinutes: s.durationMinutes,
          }))
      );

    const ics = generateICSContent([...followedMatches, ...f1Events]);
    triggerDownloadICS(ics, 'apex-pitch-schedule.ics');
    setPushBanner({
      sport: 'F1',
      title: 'Full Schedule Bundle Exported',
      message: `Exported ${followedMatches.length + f1Events.length} upcoming Football & F1 events (.ics).`,
      timestampIST: formatISTClock(),
    });
  };

  const handleForceRefreshCache = () => {
    clearAllSportsCacheForForceSync();
    clearOutdatedCache();
    const updatedMap: Record<string, PrefetchCacheEntry> = {};
    const nowISO = new Date().toISOString();
    matches.forEach((m) => {
      updatedMap[m.id] = buildPrefetchEntry(m, 'FORCE_SYNC', nowISO);
    });
    f1Weekends.forEach((w) => {
      updatedMap[w.id] = buildPrefetchEntry(w, 'FORCE_SYNC', nowISO);
    });
    setPrefetchCache(updatedMap);

    const nowIST = formatISTClock();
    setLastSyncedAtIST(nowIST);
    writeStorage(STORAGE_KEYS.LAST_SYNC_IST, nowIST);
    preloadOfficialLogos().then(setLogoCacheStatus);
    handleSyncLiveSportsApi();
  };

  return (
    <div
      data-theme={isDark ? 'dark' : 'light'}
      className={`h-full w-full overflow-hidden flex flex-col transition-colors duration-200 ${
        isDark ? 'bg-[#0A0A0C] text-[#F8FAFC]' : 'bg-[#E2E8F0] text-[#0F172A]'
      }`}
    >
      {/* Native Mobile Viewport Shell Container (430px max-width on desktop, full width on mobile) */}
      <div
        className={`max-w-[430px] w-full mx-auto h-full flex-1 min-h-0 flex flex-col border-x relative shadow-2xl overflow-hidden transition-colors duration-200 ${
          isDark
            ? 'border-[#1E2028] bg-[#0A0A0C]'
            : 'border-slate-300 bg-[#F8FAFC]'
        }`}
      >
        {/* Top Utility Bar (Permanently Docked at Top) */}
        <TopUtilityBar
          isOnline={isOnline}
          onToggleOnline={() => setIsOnline((prev) => !prev)}
          spoilerFree={spoilerFree}
          onToggleSpoilerFree={() => setSpoilerFree((prev) => !prev)}
          isDark={isDark}
          onToggleTheme={handleToggleTheme}
          lastVerifiedIST={lastSyncedAtIST}
          onOpenInstallAndSyncModal={() => setShowInstallAndSyncModal(true)}
        />

        {/* In-App Push Notification Banner */}
        <InAppPushBanner
          banner={pushBanner}
          onDismiss={() => setPushBanner(null)}
        />

        {/* Scrollable Main Tab Content Area */}
        <main
          ref={mainScrollRef}
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain"
        >
          {activeTab === 'SCHEDULE' && (
            <ScheduleTab
              matches={matches}
              f1Weekends={f1Weekends}
              allTeams={ALL_TEAMS}
              followedTeamCodes={followedTeamCodes}
              armedAlarms={armedAlarms}
              isOnline={isOnline}
              isSyncingLiveApi={isSyncingLiveApi}
              liveApiSources={liveApiSources}
              onSyncLiveSportsApi={handleSyncLiveSportsApi}
              prefetchCache={prefetchCache}
              onRegisterPrefetchedEntries={handleRegisterPrefetchedEntries}
              onOpenAlarmDrawer={(target) => setAlarmDrawerTarget(target)}
              onToggleSamsungAlarm={handleToggleSamsungAlarm}
              onArmDualClashAlarms={handleArmDualClashAlarms}
              onExportSingleCalendarEvent={handleExportSingleCalendarEvent}
              onExportArmedSessionsICS={handleExportArmedSessionsICS}
              onExportFullScheduleICS={handleExportFullScheduleICS}
              clashSettings={clashSettings}
              onUpdateClashSettings={setClashSettings}
            />
          )}

          {activeTab === 'LIVE' && (
            <LiveCenterTab
              liveFootball={liveFootball}
              liveF1={liveF1}
              spoilerFree={spoilerFree}
              isOnline={isOnline}
              playerStatsCache={playerStatsCache}
              driverCareerCache={driverCareerCache}
              onCachePlayerStats={handleCachePlayerStats}
              onCacheDriverStats={handleCacheDriverStats}
              upcomingMatches={matches}
              upcomingF1Weekends={f1Weekends}
              followedTeamCodes={followedTeamCodes}
            />
          )}

          {activeTab === 'STANDINGS' && (
            <StandingsTab
              followedTeamCodes={followedTeamCodes}
              isOnline={isOnline}
              driverStandings={driverStandings}
              constructorStandings={constructorStandings}
              footballLeagueTables={footballLeagueTables}
              driverCareerCache={driverCareerCache}
              rosterTransfers={rosterTransfers}
              onCacheDriverStats={handleCacheDriverStats}
            />
          )}

          {activeTab === 'ARCHIVE' && (
            <ArchiveTab
              items={ARCHIVE_ITEMS}
              spoilerFree={spoilerFree}
              matches={matches}
              f1Weekends={f1Weekends}
              followedTeamCodes={followedTeamCodes}
            />
          )}

          {activeTab === 'TEAMS_ALERTS' && (
            <TeamsAlertsTab
              allTeams={ALL_TEAMS}
              followedTeamCodes={followedTeamCodes}
              onToggleFollowTeam={handleToggleFollowTeam}
              armedAlarms={armedAlarms}
              onRemoveAlarm={handleRemoveAlarm}
              onTriggerTestAlarmOverlay={(alarm) => {
                const chosen =
                  alarm || armedAlarms[0] || INITIAL_ARMED_ALARMS[0];
                playAlarmAudio(chosen.soundProfile);
                setActiveWakeUpAlert(chosen);
              }}
              matches={matches}
              f1Weekends={f1Weekends}
              onExportAllFollowedICS={handleExportAllFollowedICS}
              isOnline={isOnline}
              logoCacheStatus={logoCacheStatus}
              prefetchCache={prefetchCache}
              cachedPlayerCount={Object.keys(playerStatsCache).length}
              cachedDriverCount={Object.keys(driverCareerCache).length}
              archiveCount={ARCHIVE_ITEMS.length}
              lastSyncedAtIST={lastSyncedAtIST}
              onForceRefreshCache={handleForceRefreshCache}
              clashSettings={clashSettings}
              onUpdateClashSettings={setClashSettings}
            />
          )}
        </main>

        {/* Permanent Standard Premium Bottom Navigation Bar (Docked at Bottom on Both Mobile & Laptop) */}
        <nav
          aria-label="Primary Bottom Navigation"
          data-testid="primary-bottom-navigation"
          className="shrink-0 w-full z-40 bg-[#0E1015] border-t border-[#1E2028] shadow-[0_-8px_24px_rgba(0,0,0,0.6)] pb-[max(env(safe-area-inset-bottom,0px),4px)]"
        >
          <div className="grid grid-cols-5 items-center h-[62px] px-1">
            <button
              type="button"
              onClick={() => setActiveTab('SCHEDULE')}
              aria-current={activeTab === 'SCHEDULE' ? 'page' : undefined}
              className={`relative h-full flex flex-col items-center justify-center gap-1 px-1 min-w-0 overflow-hidden transition-colors ${
                activeTab === 'SCHEDULE'
                  ? 'text-[#F8FAFC]'
                  : 'text-[#8E95A5] hover:text-[#F8FAFC]'
              }`}
            >
              {activeTab === 'SCHEDULE' && (
                <span className="absolute top-0 inset-x-3 h-[2.5px] rounded-b-full bg-emerald-400" />
              )}
              <div
                className={`w-10 h-7 rounded-lg flex items-center justify-center transition-colors ${
                  activeTab === 'SCHEDULE' ? 'bg-emerald-500/15 text-emerald-400' : ''
                }`}
              >
                <Calendar className="w-4 h-4 stroke-[2] shrink-0" />
              </div>
              <span
                className={`text-[10px] tracking-tight leading-none truncate max-w-full ${
                  activeTab === 'SCHEDULE' ? 'font-bold' : 'font-medium'
                }`}
              >
                Schedule
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('LIVE')}
              aria-current={activeTab === 'LIVE' ? 'page' : undefined}
              className={`relative h-full flex flex-col items-center justify-center gap-1 px-1 min-w-0 overflow-hidden transition-colors ${
                activeTab === 'LIVE'
                  ? 'text-[#E10600]'
                  : 'text-[#8E95A5] hover:text-[#F8FAFC]'
              }`}
            >
              {activeTab === 'LIVE' && (
                <span className="absolute top-0 inset-x-3 h-[2.5px] rounded-b-full bg-[#E10600]" />
              )}
              <div
                className={`w-10 h-7 rounded-lg flex items-center justify-center transition-colors relative ${
                  activeTab === 'LIVE' ? 'bg-[#E10600]/15 text-[#E10600]' : ''
                }`}
              >
                <Radio className="w-4 h-4 stroke-[2] shrink-0" />
                <span className="w-1.5 h-1.5 rounded-full bg-[#E10600] absolute top-1 right-2" />
              </div>
              <span
                className={`text-[10px] tracking-tight leading-none truncate max-w-full ${
                  activeTab === 'LIVE' ? 'font-bold text-[#F8FAFC]' : 'font-medium'
                }`}
              >
                Live Center
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('STANDINGS')}
              aria-current={activeTab === 'STANDINGS' ? 'page' : undefined}
              className={`relative h-full flex flex-col items-center justify-center gap-1 px-1 min-w-0 overflow-hidden transition-colors ${
                activeTab === 'STANDINGS'
                  ? 'text-[#F8FAFC]'
                  : 'text-[#8E95A5] hover:text-[#F8FAFC]'
              }`}
            >
              {activeTab === 'STANDINGS' && (
                <span className="absolute top-0 inset-x-3 h-[2.5px] rounded-b-full bg-emerald-400" />
              )}
              <div
                className={`w-10 h-7 rounded-lg flex items-center justify-center transition-colors ${
                  activeTab === 'STANDINGS' ? 'bg-emerald-500/15 text-emerald-400' : ''
                }`}
              >
                <Trophy className="w-4 h-4 stroke-[2] shrink-0" />
              </div>
              <span
                className={`text-[10px] tracking-tight leading-none truncate max-w-full ${
                  activeTab === 'STANDINGS' ? 'font-bold' : 'font-medium'
                }`}
              >
                Standings
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('ARCHIVE')}
              aria-current={activeTab === 'ARCHIVE' ? 'page' : undefined}
              className={`relative h-full flex flex-col items-center justify-center gap-1 px-1 min-w-0 overflow-hidden transition-colors ${
                activeTab === 'ARCHIVE'
                  ? 'text-[#F8FAFC]'
                  : 'text-[#8E95A5] hover:text-[#F8FAFC]'
              }`}
            >
              {activeTab === 'ARCHIVE' && (
                <span className="absolute top-0 inset-x-3 h-[2.5px] rounded-b-full bg-emerald-400" />
              )}
              <div
                className={`w-10 h-7 rounded-lg flex items-center justify-center transition-colors ${
                  activeTab === 'ARCHIVE' ? 'bg-emerald-500/15 text-emerald-400' : ''
                }`}
              >
                <Archive className="w-4 h-4 stroke-[2] shrink-0" />
              </div>
              <span
                className={`text-[10px] tracking-tight leading-none truncate max-w-full ${
                  activeTab === 'ARCHIVE' ? 'font-bold' : 'font-medium'
                }`}
              >
                Archive
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('TEAMS_ALERTS')}
              aria-current={activeTab === 'TEAMS_ALERTS' ? 'page' : undefined}
              className={`relative h-full flex flex-col items-center justify-center gap-1 px-1 min-w-0 overflow-hidden transition-colors ${
                activeTab === 'TEAMS_ALERTS'
                  ? 'text-[#F8FAFC]'
                  : 'text-[#8E95A5] hover:text-[#F8FAFC]'
              }`}
            >
              {activeTab === 'TEAMS_ALERTS' && (
                <span className="absolute top-0 inset-x-3 h-[2.5px] rounded-b-full bg-amber-400" />
              )}
              <div
                className={`w-10 h-7 rounded-lg flex items-center justify-center transition-colors relative ${
                  activeTab === 'TEAMS_ALERTS' ? 'bg-amber-400/15 text-amber-400' : ''
                }`}
              >
                <Bell className="w-4 h-4 stroke-[2] shrink-0" />
                {armedAlarms.length > 0 && (
                  <span className="px-1 min-w-[14px] h-[14px] rounded-full bg-amber-400 text-[#0A0A0C] text-[8px] font-extrabold flex items-center justify-center absolute -top-0.5 right-0.5 tabular-nums">
                    {armedAlarms.length}
                  </span>
                )}
              </div>
              <span
                className={`text-[10px] tracking-tight leading-none truncate max-w-full ${
                  activeTab === 'TEAMS_ALERTS' ? 'font-bold' : 'font-medium'
                }`}
              >
                My Teams
              </span>
            </button>
          </div>
        </nav>

        {/* Alarm Configuration Drawer */}
        <AlarmConfigDrawer
          target={alarmDrawerTarget}
          existingAlarm={
            alarmDrawerTarget
              ? armedAlarms.find((a) => a.id === alarmDrawerTarget.id)
              : undefined
          }
          onClose={() => setAlarmDrawerTarget(null)}
          onSaveAlarm={handleSaveAlarm}
          onRemoveAlarm={handleRemoveAlarm}
          onTriggerTestWakeUp={(alarm) => {
            setAlarmDrawerTarget(null);
            setActiveWakeUpAlert(alarm);
          }}
        />

        {/* Full-Screen Native-Style Wake-Up / Kickoff Alert Overlay */}
        <WakeUpAlertOverlay
          alarm={activeWakeUpAlert}
          onDismiss={() => setActiveWakeUpAlert(null)}
        />

        {/* Phone APK Install, Friends Sharing & Laptop OTA Sync Hub Modal */}
        <AppInstallAndSyncModal
          isOpen={showInstallAndSyncModal}
          onClose={() => setShowInstallAndSyncModal(false)}
          onForceLiveSync={handleSyncLiveSportsApi}
          lastVerifiedIST={lastSyncedAtIST}
        />
      </div>
    </div>
  );
}

