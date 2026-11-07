import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  CalendarPlus,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  EyeOff,
  MapPin,
  RotateCcw,
  Settings2,
  SlidersHorizontal,
  Trophy,
  Tv,
  X,
} from 'lucide-react';
import {
  ArmedAlarm,
  ClashDetectorSettings,
  ClashFilterMode,
  ClashPair,
  ClashTypeMode,
  F1Weekend,
  FootballMatch,
  PrefetchCacheEntry,
  SportFilter,
  TeamInfo,
  TimeWindow,
} from '../types/sports';
import {
  buildPrefetchEntry,
  detectScheduleClashes,
  evaluateF1SessionRuntimeStatus,
  evaluateF1WeekendLiveStatus,
  filterF1Weekends,
  filterFootballMatches,
  getUpcomingEventsToPrefetch,
} from '../utils/scheduleLogic';
import { formatSimpleCardTime, evaluateStrictEventStatus } from '../services/apiClient';
import {
  F1_2025_HIGHLIGHT_SEASON,
  F1_2026_FULL_SEASON,
  F1_2027_FULL_SEASON,
  fetchF1SeasonCalendar,
} from '../services/f1AutoSync';
import { OfficialLogo } from './OfficialLogo';
import { WhiteTrackMap } from './CircuitSvg';
import { F1_LOGOS } from '../data/logos';

const DEFAULT_CLASH_SETTINGS: ClashDetectorSettings = {
  enabled: true,
  filterMode: 'FOLLOWED_ONLY',
  clashTypeMode: 'ALL_CLASHES',
  customTeamCodes: ['MCI', 'SAN', 'KBFC', 'RMA', 'BAR', 'ARS', 'LIV'],
  keySessionsOnly: false,
  bufferMinutes: 0,
  dismissedClashIds: [],
};

interface ScheduleTabProps {
  matches: FootballMatch[];
  f1Weekends: F1Weekend[];
  allTeams: TeamInfo[];
  followedTeamCodes: string[];
  armedAlarms: ArmedAlarm[];
  isOnline: boolean;
  isSyncingLiveApi: boolean;
  liveApiSources: string[];
  onSyncLiveSportsApi: () => void;
  prefetchCache: Record<string, PrefetchCacheEntry>;
  onRegisterPrefetchedEntries: (entries: PrefetchCacheEntry[]) => void;
  onOpenAlarmDrawer: (target: {
    id: string;
    parentId?: string;
    sport: 'FOOTBALL' | 'F1';
    title: string;
    subtitle: string;
    eventStartTimeISO: string;
    istTimeLabel: string;
  }) => void;
  onToggleSamsungAlarm?: (target: {
    id: string;
    parentId?: string;
    sport: 'FOOTBALL' | 'F1';
    title: string;
    subtitle: string;
    eventStartTimeISO: string;
    istTimeLabel: string;
  }) => void;
  onArmDualClashAlarms: (clash: ClashPair) => void;
  onExportSingleCalendarEvent: (event: {
    id: string;
    title: string;
    description: string;
    location: string;
    startTimeISO: string;
    durationMinutes: number;
  }) => void;
  clashSettings?: ClashDetectorSettings;
  onUpdateClashSettings?: (
    updater: (prev: ClashDetectorSettings) => ClashDetectorSettings
  ) => void;
}

export const ScheduleTab: React.FC<ScheduleTabProps> = ({
  matches,
  f1Weekends,
  allTeams,
  followedTeamCodes,
  armedAlarms,
  isOnline,
  isSyncingLiveApi,
  prefetchCache,
  onRegisterPrefetchedEntries,
  onOpenAlarmDrawer,
  onToggleSamsungAlarm,
  onArmDualClashAlarms,
  onExportSingleCalendarEvent,
  clashSettings: externalClashSettings,
  onUpdateClashSettings,
}) => {
  const [timeWindow, setTimeWindow] = useState<TimeWindow>('ALL_UPCOMING');
  const [sportFilter, setSportFilter] = useState<SportFilter>('ALL');
  const [selectedTeamCode, setSelectedTeamCode] = useState<string>('ALL_TEAMS');
  const [localClashSettings, setLocalClashSettings] =
    useState<ClashDetectorSettings>(DEFAULT_CLASH_SETTINGS);
  const [clashHubExpanded, setClashHubExpanded] = useState<boolean>(true);
  const [showClashManager, setShowClashManager] = useState<boolean>(false);
  const [showAllClashes, setShowAllClashes] = useState<boolean>(false);

  const effectiveClashSettings = externalClashSettings ?? localClashSettings;
  const updateClashSettings = (
    updater: (prev: ClashDetectorSettings) => ClashDetectorSettings
  ) => {
    if (onUpdateClashSettings) {
      onUpdateClashSettings(updater);
    } else {
      setLocalClashSettings(updater);
    }
  };

  // Official F1 App Season Switcher (2025 | 2026 | 2027)
  const [selectedF1Season, setSelectedF1Season] = useState<2025 | 2026 | 2027>(
    2026
  );
  const [seasonWeekendsMap, setSeasonWeekendsMap] = useState<
    Record<number, F1Weekend[]>
  >({
    2025: F1_2025_HIGHLIGHT_SEASON,
    2026: F1_2026_FULL_SEASON,
    2027: F1_2027_FULL_SEASON,
  });

  // Progressive Disclosure Detail Bottom Sheets / Modals
  const [selectedMatchModal, setSelectedMatchModal] =
    useState<FootballMatch | null>(null);
  const [selectedWeekendModal, setSelectedWeekendModal] =
    useState<F1Weekend | null>(null);

  const [activeVisibleIndex, setActiveVisibleIndex] = useState<number>(0);
  const cardRefs = useRef<Record<string, HTMLElement | null>>({});

  // Sync dynamic F1 calendar when season changes
  useEffect(() => {
    let cancelled = false;
    fetchF1SeasonCalendar(selectedF1Season)
      .then((weekends) => {
        if (!cancelled && Array.isArray(weekends) && weekends.length > 0) {
          setSeasonWeekendsMap((prev) => ({
            ...prev,
            [selectedF1Season]: weekends,
          }));
        }
      })
      .catch(() => {
        // Fallback already in state
      });
    return () => {
      cancelled = true;
    };
  }, [selectedF1Season]);

  const f1ConstructorCodes = useMemo(
    () => allTeams.filter((t) => t.sport === 'F1').map((t) => t.code),
    [allTeams]
  );

  const footballClubObjects = useMemo(
    () => allTeams.filter((t) => t.sport === 'FOOTBALL'),
    [allTeams]
  );

  const followedTeamObjects = useMemo(
    () => allTeams.filter((t) => followedTeamCodes.includes(t.code)),
    [allTeams, followedTeamCodes]
  );

  const filteredMatches = useMemo(
    () =>
      filterFootballMatches(
        matches,
        timeWindow,
        sportFilter,
        selectedTeamCode,
        followedTeamCodes
      ),
    [matches, timeWindow, sportFilter, selectedTeamCode, followedTeamCodes]
  );

  // For Formula 1 calendar display, use the selected season's full calendar enriched with any synced sessions
  const activeF1SeasonCalendar = useMemo(() => {
    if (selectedF1Season === 2026) {
      const base2026 = seasonWeekendsMap[2026]?.length
        ? seasonWeekendsMap[2026]
        : F1_2026_FULL_SEASON;
      return base2026.map((wknd) => {
        const syncedMatch = f1Weekends.find(
          (fw) => fw.id === wknd.id || fw.circuitSvgId === wknd.circuitSvgId
        );
        if (!syncedMatch) return wknd;
        return {
          ...wknd,
          sessions: syncedMatch.sessions?.length ? syncedMatch.sessions : wknd.sessions,
        };
      });
    }
    return seasonWeekendsMap[selectedF1Season] || F1_2026_FULL_SEASON;
  }, [selectedF1Season, seasonWeekendsMap, f1Weekends]);

  const filteredWeekends = useMemo(() => {
    if (sportFilter === 'FOOTBALL') return [];
    if (selectedF1Season !== 2026) {
      return activeF1SeasonCalendar;
    }
    if (timeWindow === 'ALL_UPCOMING') {
      return activeF1SeasonCalendar;
    }
    if (timeWindow === 'PAST_RESULTS') {
      return activeF1SeasonCalendar.filter(
        (w) =>
          evaluateF1WeekendLiveStatus(w) === 'COMPLETED' ||
          w.timeWindow === 'PAST_RESULTS'
      );
    }
    return filterF1Weekends(
      activeF1SeasonCalendar,
      timeWindow,
      sportFilter,
      selectedTeamCode === 'ALL_TEAMS' ? 'ALL_FOLLOWED' : selectedTeamCode,
      f1ConstructorCodes
    );
  }, [
    activeF1SeasonCalendar,
    timeWindow,
    sportFilter,
    selectedTeamCode,
    f1ConstructorCodes,
    selectedF1Season,
  ]);

  // Adjustable Clash Detector (Match × Match, Match × F1, or All Collisions)
  const clashes: ClashPair[] = useMemo(
    () =>
      detectScheduleClashes(
        matches,
        f1Weekends,
        followedTeamCodes,
        effectiveClashSettings.filterMode,
        effectiveClashSettings.customTeamCodes,
        effectiveClashSettings
      ),
    [matches, f1Weekends, followedTeamCodes, effectiveClashSettings]
  );

  const clashByMatchId = useMemo(() => {
    const map: Record<string, ClashPair[]> = {};
    for (const c of clashes) {
      if (!map[c.footballMatchId]) map[c.footballMatchId] = [];
      map[c.footballMatchId].push(c);
      if (c.secondFootballMatchId) {
        if (!map[c.secondFootballMatchId]) map[c.secondFootballMatchId] = [];
        map[c.secondFootballMatchId].push(c);
      }
    }
    return map;
  }, [clashes]);

  // Unified ordered event IDs for offline-first scroll lookahead pre-fetching
  const orderedEvents = useMemo(
    () => [...filteredMatches, ...filteredWeekends],
    [filteredMatches, filteredWeekends]
  );

  const orderedEventIds = useMemo(
    () => orderedEvents.map((e) => e.id),
    [orderedEvents]
  );

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const eventId = entry.target.getAttribute('data-event-id');
            if (eventId) {
              const idx = orderedEventIds.indexOf(eventId);
              if (idx !== -1) setActiveVisibleIndex(idx);
            }
          }
        }
      },
      { threshold: 0.25 }
    );

    Object.values(cardRefs.current).forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [orderedEventIds]);

  useEffect(() => {
    const toPrefetchIds = getUpcomingEventsToPrefetch(
      orderedEventIds,
      activeVisibleIndex,
      3,
      isOnline,
      prefetchCache,
      Date.now()
    );
    if (toPrefetchIds.length === 0) return;

    const newEntries: PrefetchCacheEntry[] = [];
    for (const id of toPrefetchIds) {
      const found = orderedEvents.find((ev) => ev.id === id);
      if (found) {
        newEntries.push(buildPrefetchEntry(found, 'PREFETCH_ENGINE'));
      }
    }
    if (newEntries.length > 0) {
      onRegisterPrefetchedEntries(newEntries);
    }
  }, [
    orderedEventIds,
    orderedEvents,
    activeVisibleIndex,
    isOnline,
    prefetchCache,
    onRegisterPrefetchedEntries,
  ]);

  const isAlarmArmed = (id: string) => armedAlarms.some((a) => a.id === id);

  // Group football matches by date label while strictly preserving the ordered sequence:
  // - PAST_RESULTS: most recently finished first
  // - THIS_WEEK / NEXT_WEEK: upcoming & live first, followed by completed matches from earlier in the week
  // - ALL_UPCOMING (Full Calendar): chronological order by date
  const matchesByDate = useMemo(() => {
    const groups: { dateLabel: string; items: FootballMatch[] }[] = [];
    for (const m of filteredMatches) {
      const isFinished =
        m.liveStatus === 'FINAL' || m.timeWindow === 'PAST_RESULTS';
      const groupLabel =
        (timeWindow === 'THIS_WEEK' || timeWindow === 'NEXT_WEEK') && isFinished
          ? `${m.istDateLabel} • COMPLETED`
          : m.istDateLabel;
      const existing = groups.find((g) => g.dateLabel === groupLabel);
      if (existing) {
        existing.items.push(m);
      } else {
        groups.push({ dateLabel: groupLabel, items: [m] });
      }
    }
    return groups;
  }, [filteredMatches, timeWindow]);

  // Identify the active LIVE or Next Up F1 Grand Prix (e.g. Round 21 Brazil in 2026)
  const nextHeroWeekend = useMemo(() => {
    const liveWknd = filteredWeekends.find(
      (w) => evaluateF1WeekendLiveStatus(w) === 'LIVE'
    );
    if (liveWknd) return liveWknd;
    const explicitNext = filteredWeekends.find((w) => w.isNextRace);
    if (explicitNext) return explicitNext;
    const upcoming = filteredWeekends.find(
      (w) => evaluateF1WeekendLiveStatus(w) === 'UPCOMING'
    );
    return upcoming || null;
  }, [filteredWeekends]);

  const activeClashTypeMode: ClashTypeMode =
    effectiveClashSettings.clashTypeMode || 'ALL_CLASHES';

  return (
    <div className="pb-24 space-y-4">
      {/* Top Filter Controls: Sport & Time Window */}
      <div className="bg-[#121316] border-b border-[#1E2028] px-4 py-3 space-y-2.5">
        {/* Time Window Segmented Switcher (4 Tabs including Past Results) */}
        <div
          role="tablist"
          aria-label="Schedule Time Window"
          className="grid grid-cols-4 bg-[#0A0A0C] p-1 rounded-xl border border-[#1E2028] gap-0.5"
        >
          {(
            [
              { id: 'PAST_RESULTS', label: 'Past Results' },
              { id: 'THIS_WEEK', label: 'This Week' },
              { id: 'NEXT_WEEK', label: 'Next Week' },
              { id: 'ALL_UPCOMING', label: 'Full Calendar' },
            ] as const
          ).map((tab) => {
            const active = timeWindow === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTimeWindow(tab.id)}
                className={`min-h-[32px] px-1.5 py-1 text-[11px] font-semibold rounded-lg transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-[#181A20] text-[#F8FAFC] shadow-sm font-bold'
                    : 'text-[#8E95A5] hover:text-[#F8FAFC]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Sport & Favorite Clubs Quick Filter Strip */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          {(
            [
              { id: 'ALL', label: 'All Sports' },
              { id: 'FOOTBALL', label: 'Football' },
              { id: 'F1', label: 'Formula 1' },
            ] as const
          ).map((sport) => {
            const active =
              sportFilter === sport.id &&
              (selectedTeamCode === 'ALL_TEAMS' ||
                selectedTeamCode === 'ALL_FOLLOWED');
            return (
              <button
                key={sport.id}
                type="button"
                onClick={() => {
                  setSportFilter(sport.id);
                  setSelectedTeamCode('ALL_TEAMS');
                }}
                className={`min-h-[32px] px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                  active
                    ? sport.id === 'F1'
                      ? 'bg-[#E10600] text-[#F8FAFC]'
                      : 'bg-[#F8FAFC] text-[#0A0A0C]'
                    : 'bg-[#181A20] text-[#8E95A5] hover:text-[#F8FAFC] border border-[#1E2028]'
                }`}
              >
                {sport.label}
              </button>
            );
          })}

          <button
            type="button"
            onClick={() =>
              setSelectedTeamCode((prev) =>
                prev === 'ALL_FOLLOWED' ? 'ALL_TEAMS' : 'ALL_FOLLOWED'
              )
            }
            className={`min-h-[32px] px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
              selectedTeamCode === 'ALL_FOLLOWED'
                ? 'bg-emerald-500 text-[#0A0A0C] font-bold'
                : 'bg-[#181A20] text-[#8E95A5] hover:text-[#F8FAFC] border border-[#1E2028]'
            }`}
          >
            My Favorites
          </button>

          <span className="h-4 w-[1px] bg-[#1E2028] shrink-0 mx-0.5" />

          {followedTeamObjects.map((team) => {
            const isSelected = selectedTeamCode === team.code;
            return (
              <button
                key={team.id}
                type="button"
                onClick={() => {
                  if (isSelected) {
                    setSelectedTeamCode('ALL_TEAMS');
                  } else {
                    setSelectedTeamCode(team.code);
                    setSportFilter('ALL');
                  }
                }}
                aria-label={`Filter by ${team.name}`}
                className={`min-h-[32px] px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                  isSelected
                    ? 'bg-[#F8FAFC] text-[#0A0A0C]'
                    : 'bg-[#181A20] text-[#F8FAFC] border border-[#1E2028] hover:border-[#8E95A5]/40'
                }`}
              >
                <OfficialLogo
                  src={team.logoUrl}
                  alt={team.name}
                  size="xs"
                  fallbackCode={team.code}
                />
                <span>{team.code}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Smooth non-shifting background sync skeleton bar */}
      {isSyncingLiveApi && (
        <div className="px-4" aria-live="polite">
          <div className="rounded-xl border border-[#1E2028] bg-[#121316] px-3.5 py-2 flex items-center justify-between gap-2">
            <span className="text-[11px] font-medium text-[#8E95A5]">
              Updating live schedules &amp; IST kickoffs...
            </span>
            <div className="w-20 h-1.5 rounded-md bg-[#181A20] overflow-hidden">
              <div className="h-full w-1/2 bg-emerald-400 animate-pulse rounded-md" />
            </div>
          </div>
        </div>
      )}

      {/* ADJUSTABLE CLASH DETECTOR & MANAGEMENT MODULE (Hidden on Past Results tab) */}
      {timeWindow !== 'PAST_RESULTS' && (
        <section className="px-4" aria-label="Schedule Clash Detector">
          <div
            data-testid="clash-detector-banner"
            className="rounded-xl border border-amber-500/40 bg-[#121316] overflow-hidden"
          >
            {/* Clash Header & Mode Filter */}
            <div className="p-3 bg-amber-500/10 border-b border-amber-500/20 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-6 h-6 rounded-lg bg-amber-400 text-[#0A0A0C] flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-3.5 h-3.5 stroke-[2]" />
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                      <span>CLASH DETECTOR</span>
                      <span>•</span>
                      <span>
                        {effectiveClashSettings.enabled
                          ? `${clashes.length} OVERLAPS`
                          : 'PAUSED'}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#8E95A5] truncate">
                      Match × Match &amp; Match × F1 Collision Manager
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    data-testid="clash-detector-manage-btn"
                    onClick={() => setShowClashManager((prev) => !prev)}
                    aria-expanded={showClashManager}
                    className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold flex items-center gap-1 transition-colors ${
                      showClashManager
                        ? 'bg-amber-400 text-[#0A0A0C] border-amber-400 font-bold'
                        : 'border-amber-400/30 bg-[#181A20] text-[#F8FAFC] hover:border-amber-400'
                    }`}
                  >
                    <Settings2 className="w-3 h-3 stroke-[1.75]" />
                    <span>Manage</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setClashHubExpanded((prev) => !prev)}
                    aria-expanded={clashHubExpanded}
                    className="px-2.5 py-1 rounded-lg border border-amber-400/30 bg-[#181A20] text-[11px] font-semibold text-[#F8FAFC] flex items-center gap-1"
                  >
                    <Tv className="w-3 h-3 stroke-[1.5] text-amber-400" />
                    <span>{clashHubExpanded ? 'Hide' : 'Show'}</span>
                    {clashHubExpanded ? (
                      <ChevronUp className="w-3 h-3 stroke-[1.5]" />
                    ) : (
                      <ChevronDown className="w-3 h-3 stroke-[1.5]" />
                    )}
                  </button>
                </div>
              </div>

              {/* Clash Team Scope Selector Badges (Default: My Favorites) */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400 shrink-0 mr-0.5" />
                {(
                  [
                    {
                      id: 'FOLLOWED_ONLY' as ClashFilterMode,
                      label: 'My Favorites Only',
                    },
                    {
                      id: 'MCI_SAN_ONLY' as ClashFilterMode,
                      label: 'Man City, Santos & Blasters',
                    },
                    {
                      id: 'CUSTOM_TEAMS' as ClashFilterMode,
                      label: 'Custom Clubs',
                    },
                    {
                      id: 'ALL_MATCHES' as ClashFilterMode,
                      label: 'All Matches',
                    },
                  ] as const
                ).map((mode) => {
                  const active = effectiveClashSettings.filterMode === mode.id;
                  return (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => {
                        updateClashSettings((prev) => ({
                          ...prev,
                          enabled: true,
                          filterMode: mode.id,
                        }));
                        if (mode.id === 'CUSTOM_TEAMS') {
                          setShowClashManager(true);
                        }
                      }}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-semibold whitespace-nowrap transition-colors ${
                        active
                          ? 'bg-amber-400 text-[#0A0A0C] font-bold'
                          : 'bg-[#181A20] text-[#8E95A5] border border-[#1E2028] hover:text-[#F8FAFC]'
                      }`}
                    >
                      {mode.label}
                    </button>
                  );
                })}
              </div>

              {/* Expandable Clash Detector Management Drawer */}
              {showClashManager && (
                <div
                  data-testid="clash-detector-management-panel"
                  className="p-3 rounded-xl bg-[#121316] border border-amber-400/30 space-y-2.5 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#F8FAFC]">
                      Clash Detection Engine
                    </span>
                    <button
                      type="button"
                      data-testid="clash-detector-toggle-enabled"
                      onClick={() =>
                        updateClashSettings((prev) => ({
                          ...prev,
                          enabled: !prev.enabled,
                        }))
                      }
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${
                        effectiveClashSettings.enabled
                          ? 'bg-emerald-400 text-[#0A0A0C]'
                          : 'bg-[#181A20] text-[#8E95A5] border border-[#1E2028]'
                      }`}
                    >
                      {effectiveClashSettings.enabled ? 'ACTIVE' : 'DISABLED'}
                    </button>
                  </div>

                  {/* Collision Type Filter (All Collisions vs Match×Match vs Match×F1) */}
                  <div className="space-y-1.5 pt-1 border-t border-[#1E2028]">
                    <span className="text-[#8E95A5] text-[11px] font-semibold">
                      When to Detect Clashes (Collision Type)
                    </span>
                    <div className="grid grid-cols-3 gap-1">
                      {(
                        [
                          {
                            id: 'ALL_CLASHES' as ClashTypeMode,
                            label: 'All Collisions',
                          },
                          {
                            id: 'FOOTBALL_VS_FOOTBALL' as ClashTypeMode,
                            label: 'Match × Match',
                          },
                          {
                            id: 'FOOTBALL_VS_F1' as ClashTypeMode,
                            label: 'Match × F1',
                          },
                        ] as const
                      ).map((ct) => {
                        const active = activeClashTypeMode === ct.id;
                        return (
                          <button
                            key={ct.id}
                            type="button"
                            onClick={() =>
                              updateClashSettings((prev) => ({
                                ...prev,
                                enabled: true,
                                clashTypeMode: ct.id,
                              }))
                            }
                            className={`py-1 px-2 rounded-md text-[11px] font-semibold transition-colors ${
                              active
                                ? 'bg-amber-400 text-[#0A0A0C] font-bold'
                                : 'bg-[#181A20] text-[#8E95A5]'
                            }`}
                          >
                            {ct.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Custom Clubs Selector when filterMode === CUSTOM_TEAMS */}
                  {effectiveClashSettings.filterMode === 'CUSTOM_TEAMS' && (
                    <div className="space-y-1.5 pt-1 border-t border-[#1E2028]">
                      <span className="text-[#8E95A5] text-[11px] font-semibold">
                        Monitored Clubs (Tap to toggle):
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {footballClubObjects.map((club) => {
                          const currentCustom =
                            effectiveClashSettings.customTeamCodes || [];
                          const selected = currentCustom.includes(club.code);
                          return (
                            <button
                              key={club.code}
                              type="button"
                              onClick={() =>
                                updateClashSettings((prev) => {
                                  const prevCodes = prev.customTeamCodes || [];
                                  const exists = prevCodes.includes(club.code);
                                  const nextCodes = exists
                                    ? prevCodes.filter((c) => c !== club.code)
                                    : [...prevCodes, club.code];
                                  return {
                                    ...prev,
                                    customTeamCodes:
                                      nextCodes.length > 0
                                        ? nextCodes
                                        : [club.code],
                                  };
                                })
                              }
                              className={`px-2 py-0.5 rounded-md text-[11px] font-semibold flex items-center gap-1 border ${
                                selected
                                  ? 'bg-emerald-500/20 border-emerald-400 text-[#F8FAFC] font-bold'
                                  : 'bg-[#181A20] border-[#1E2028] text-[#8E95A5]'
                              }`}
                            >
                              <span>{club.code}</span>
                              {selected && (
                                <Check className="w-2.5 h-2.5 text-emerald-400" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#1E2028]">
                    <span className="text-[#8E95A5]">F1 Session Filter</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          updateClashSettings((prev) => ({
                            ...prev,
                            keySessionsOnly: false,
                          }))
                        }
                        className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                          !effectiveClashSettings.keySessionsOnly
                            ? 'bg-amber-400 text-[#0A0A0C] font-bold'
                            : 'bg-[#181A20] text-[#8E95A5]'
                        }`}
                      >
                        All Sessions
                      </button>
                      <button
                        type="button"
                        data-testid="clash-key-sessions-only-btn"
                        onClick={() =>
                          updateClashSettings((prev) => ({
                            ...prev,
                            keySessionsOnly: true,
                          }))
                        }
                        className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                          effectiveClashSettings.keySessionsOnly
                            ? 'bg-amber-400 text-[#0A0A0C] font-bold'
                            : 'bg-[#181A20] text-[#8E95A5]'
                        }`}
                      >
                        Quali / Sprint / Race Only
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#1E2028]">
                    <span className="text-[#8E95A5]">
                      Pre/Post Overlap Buffer
                    </span>
                    <div className="flex items-center gap-1">
                      {([0, 15, 30] as const).map((mins) => (
                        <button
                          key={mins}
                          type="button"
                          onClick={() =>
                            updateClashSettings((prev) => ({
                              ...prev,
                              bufferMinutes: mins,
                            }))
                          }
                          className={`px-2 py-0.5 rounded-md text-[11px] font-semibold tabular-nums ${
                            effectiveClashSettings.bufferMinutes === mins
                              ? 'bg-amber-400 text-[#0A0A0C] font-bold'
                              : 'bg-[#181A20] text-[#8E95A5]'
                          }`}
                        >
                          {mins === 0 ? 'Exact (0m)' : `+${mins}m`}
                        </button>
                      ))}
                    </div>
                  </div>

                  {effectiveClashSettings.dismissedClashIds.length > 0 && (
                    <div className="flex items-center justify-between pt-1 border-t border-[#1E2028]">
                      <span className="text-[#8E95A5] text-[11px]">
                        {effectiveClashSettings.dismissedClashIds.length}{' '}
                        dismissed clash(es) hidden
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          updateClashSettings((prev) => ({
                            ...prev,
                            dismissedClashIds: [],
                          }))
                        }
                        className="px-2 py-0.5 rounded-md bg-[#181A20] text-amber-400 border border-amber-400/30 text-[11px] font-semibold flex items-center gap-1"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Restore All</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Clash Cards */}
            {clashHubExpanded && (
              <div className="p-3 space-y-2.5 divide-y divide-[#1E2028]">
                {!effectiveClashSettings.enabled ? (
                  <div className="text-center py-2 text-xs text-[#8E95A5] flex items-center justify-center gap-2">
                    <span>Clash Detector is currently paused.</span>
                    <button
                      type="button"
                      onClick={() =>
                        updateClashSettings((prev) => ({
                          ...prev,
                          enabled: true,
                        }))
                      }
                      className="px-2 py-0.5 rounded-md bg-amber-400 text-[#0A0A0C] font-bold text-[11px]"
                    >
                      Enable
                    </button>
                  </div>
                ) : clashes.length === 0 ? (
                  <div className="text-center py-2 text-xs text-[#8E95A5]">
                    No schedule clashes found for the selected filter.
                  </div>
                ) : (
                  (() => {
                    // Pick top 2 representative clashes (1 Match×F1 + 1 Match×Match when both exist) unless showAllClashes is true
                    let displayedClashes = clashes;
                    if (!showAllClashes && clashes.length > 2) {
                      const firstF1Clash = clashes.find(
                        (c) => c.clashType !== 'FOOTBALL_VS_FOOTBALL'
                      );
                      const firstFbClash = clashes.find(
                        (c) => c.clashType === 'FOOTBALL_VS_FOOTBALL'
                      );
                      if (firstF1Clash && firstFbClash) {
                        displayedClashes = [firstF1Clash, firstFbClash];
                      } else {
                        displayedClashes = clashes.slice(0, 2);
                      }
                    }

                    return (
                      <>
                        {displayedClashes.map((clash) => {
                          const isMatchVsMatch =
                            clash.clashType === 'FOOTBALL_VS_FOOTBALL' &&
                            Boolean(clash.secondFootballInfo);
                          const secondEventId =
                            clash.secondFootballMatchId || clash.f1SessionId;
                          const bothArmed =
                            isAlarmArmed(clash.footballMatchId) &&
                            isAlarmArmed(secondEventId);
                          const isClashTBD =
                            Boolean(clash.footballInfo.isTimeTBD) ||
                            /\bTBD\b|NOT DECLARED/i.test(
                              clash.footballInfo.istTime12h || ''
                            );
                          const fbSimpleTime = isClashTBD
                            ? 'TBD (Time Not Declared)'
                            : formatSimpleCardTime(
                                clash.footballInfo.istTime12h,
                                clash.footballInfo.startTimeISO,
                                clash.footballInfo.isTimeTBD
                              );
                          const f1SimpleTime = formatSimpleCardTime(
                            clash.f1Info.startTimeISO
                          );
                          const secondFbSimpleTime = clash.secondFootballInfo
                            ? formatSimpleCardTime(
                                clash.secondFootballInfo.istTime12h,
                                clash.secondFootballInfo.startTimeISO,
                                clash.secondFootballInfo.isTimeTBD
                              )
                            : f1SimpleTime;

                          return (
                            <div
                              key={clash.id}
                              className="pt-2.5 first:pt-0 space-y-2"
                            >
                              <div className="flex items-center justify-between gap-2 text-[11px]">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className="text-amber-400 font-semibold whitespace-nowrap truncate">
                                    {clash.footballInfo.istDateLabel}
                                    {isClashTBD ? ' • TBD' : ''}
                                  </span>
                                  <span
                                    className={`px-1.5 py-0.2 rounded-md text-[9px] font-bold uppercase whitespace-nowrap shrink-0 ${
                                      isMatchVsMatch
                                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                        : 'bg-[#E10600]/20 text-[#E10600] border border-[#E10600]/40'
                                    }`}
                                  >
                                    {isMatchVsMatch
                                      ? 'MATCH × MATCH'
                                      : 'MATCH × F1'}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {!clash.isCompleted && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        onArmDualClashAlarms(clash)
                                      }
                                      className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors ${
                                        bothArmed
                                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                                          : 'bg-amber-400 text-[#0A0A0C]'
                                      }`}
                                    >
                                      <Bell className="w-2.5 h-2.5 stroke-[2]" />
                                      <span>
                                        {bothArmed
                                          ? 'Reminders Set'
                                          : 'Set Dual Alert'}
                                      </span>
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    title="Dismiss this clash"
                                    aria-label={`Dismiss clash ${clash.footballInfo.homeCode} vs ${clash.footballInfo.awayCode}`}
                                    onClick={() =>
                                      updateClashSettings((prev) => ({
                                        ...prev,
                                        dismissedClashIds: [
                                          ...prev.dismissedClashIds,
                                          clash.id,
                                        ],
                                      }))
                                    }
                                    className="p-1 rounded-md bg-[#181A20] text-[#8E95A5] hover:text-[#F8FAFC] border border-[#1E2028] shrink-0"
                                  >
                                    <EyeOff className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>

                              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 bg-[#181A20] rounded-xl p-2.5 border border-[#1E2028]">
                                {/* Left: First Football Match */}
                                <div className="space-y-1 min-w-0">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <OfficialLogo
                                      src={clash.footballInfo.homeLogo}
                                      alt={clash.footballInfo.homeName}
                                      size="xs"
                                      fallbackCode={clash.footballInfo.homeCode}
                                    />
                                    <span className="text-xs font-semibold text-[#F8FAFC] truncate">
                                      {clash.footballInfo.homeCode}
                                    </span>
                                    <span className="text-[10px] text-[#8E95A5]">
                                      v
                                    </span>
                                    <OfficialLogo
                                      src={clash.footballInfo.awayLogo}
                                      alt={clash.footballInfo.awayName}
                                      size="xs"
                                      fallbackCode={clash.footballInfo.awayCode}
                                    />
                                    <span className="text-xs font-semibold text-[#F8FAFC] truncate">
                                      {clash.footballInfo.awayCode}
                                    </span>
                                  </div>
                                  <div
                                    className={`text-[11px] tabular-nums truncate ${
                                      isClashTBD
                                        ? 'text-amber-300 font-semibold'
                                        : 'text-[#8E95A5]'
                                    }`}
                                  >
                                    {clash.footballInfo.competition} •{' '}
                                    {fbSimpleTime}
                                  </div>
                                </div>

                                {/* Center Badge */}
                                <span className="px-2 py-0.5 rounded-md bg-amber-400/15 border border-amber-400/40 text-amber-300 text-[10px] font-bold">
                                  {isClashTBD ? 'TBD' : 'CLASH'}
                                </span>

                                {/* Right: Second Football Match OR Formula 1 Session */}
                                {isMatchVsMatch && clash.secondFootballInfo ? (
                                  <div className="space-y-1 min-w-0 text-right">
                                    <div className="flex items-center justify-end gap-1.5 min-w-0">
                                      <OfficialLogo
                                        src={clash.secondFootballInfo.homeLogo}
                                        alt={clash.secondFootballInfo.homeName}
                                        size="xs"
                                        fallbackCode={
                                          clash.secondFootballInfo.homeCode
                                        }
                                      />
                                      <span className="text-xs font-semibold text-[#F8FAFC] truncate">
                                        {clash.secondFootballInfo.homeCode}
                                      </span>
                                      <span className="text-[10px] text-[#8E95A5]">
                                        v
                                      </span>
                                      <OfficialLogo
                                        src={clash.secondFootballInfo.awayLogo}
                                        alt={clash.secondFootballInfo.awayName}
                                        size="xs"
                                        fallbackCode={
                                          clash.secondFootballInfo.awayCode
                                        }
                                      />
                                      <span className="text-xs font-semibold text-[#F8FAFC] truncate">
                                        {clash.secondFootballInfo.awayCode}
                                      </span>
                                    </div>
                                    <div className="text-[11px] text-emerald-400 font-semibold tabular-nums truncate">
                                      {clash.secondFootballInfo.competition} •{' '}
                                      {secondFbSimpleTime}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="space-y-1 min-w-0 text-right">
                                    <div className="flex items-center justify-end gap-1.5 min-w-0">
                                      <OfficialLogo
                                        src={clash.f1Info.countryFlagUrl}
                                        alt={clash.f1Info.grandPrixName}
                                        shape="Flag"
                                        size="xs"
                                      />
                                      <span className="text-xs font-semibold text-[#F8FAFC] truncate">
                                        {clash.f1Info.grandPrixName.replace(
                                          ' Grand Prix',
                                          ' GP'
                                        )}
                                      </span>
                                    </div>
                                    <div className="text-[11px] text-[#E10600] font-semibold tabular-nums truncate">
                                      {clash.f1Info.sessionShortLabel} •{' '}
                                      {f1SimpleTime}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}

                        {clashes.length > 2 && (
                          <div className="pt-2.5 text-center">
                            <button
                              type="button"
                              onClick={() => setShowAllClashes((prev) => !prev)}
                              className="w-full py-1.5 rounded-lg bg-[#181A20] hover:bg-white/10 border border-[#1E2028] text-[11px] font-semibold text-amber-300 transition-colors"
                            >
                              {showAllClashes
                                ? 'Show Top 2 Overlaps Only'
                                : `Show All ${clashes.length} Overlaps (Match × Match & Match × F1)`}
                            </button>
                          </div>
                        )}
                      </>
                    );
                  })()
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {/* SECTION 1: FOOTBALL FIXTURES (CLEAN 3-COLUMN APPLE SPORTS / FOTMOB LAYOUT) */}
      {(sportFilter === 'ALL' || sportFilter === 'FOOTBALL') && (
        <section
          className="px-4 space-y-3"
          aria-label="Upcoming Football Matches"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[#8E95A5]">
              Football Fixtures ({filteredMatches.length})
            </h2>
            <span className="text-[11px] text-[#8E95A5]">
              Tap any match for details
            </span>
          </div>

          {matchesByDate.length === 0 ? (
            <div className="bg-[#121316] rounded-xl p-4 border border-[#1E2028] text-center space-y-2">
              <p className="text-xs text-[#8E95A5] font-medium">
                No scheduled fixtures in this window for the selected filter.
              </p>
              {timeWindow !== 'ALL_UPCOMING' && (
                <button
                  type="button"
                  onClick={() => setTimeWindow('ALL_UPCOMING')}
                  className="px-3 py-1.5 rounded-lg bg-[#F8FAFC] text-[#0A0A0C] text-xs font-bold"
                >
                  View Full Calendar
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3.5">
              {matchesByDate.map((group) => (
                <div key={group.dateLabel} className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wider text-[#8E95A5] px-1">
                    {group.dateLabel}
                  </div>

                  <div className="space-y-2">
                    {group.items.map((match) => {
                      const matchClashes = clashByMatchId[match.id] ?? [];
                      const hasClash = matchClashes.length > 0;
                      const isTBD =
                        Boolean(match.isTimeTBD) ||
                        /\bTBD\b|NOT DECLARED/i.test(match.istTimeLabel || '');
                      const simpleTime = formatSimpleCardTime(
                        match.istTimeLabel,
                        isTBD ? undefined : match.startTimeISO,
                        isTBD
                      );
                      const strictStatus = isTBD
                        ? 'UPCOMING'
                        : evaluateStrictEventStatus(
                            match.startTimeISO,
                            match.durationMinutes,
                            match.liveStatus === 'LIVE',
                            match.liveStatus === 'FINAL'
                          );
                      const isFinished =
                        match.liveStatus === 'FINAL' ||
                        match.timeWindow === 'PAST_RESULTS' ||
                        strictStatus === 'FINAL';
                      const isLive =
                        !isFinished &&
                        (match.liveStatus === 'LIVE' ||
                          strictStatus === 'LIVE');
                      const armed = !isFinished && isAlarmArmed(match.id);
                      const hasScore =
                        typeof match.homeScore === 'number' &&
                        typeof match.awayScore === 'number';

                      return (
                        <div
                          key={match.id}
                          data-event-id={match.id}
                          ref={(el) => {
                            cardRefs.current[match.id] = el;
                          }}
                          onClick={() => setSelectedMatchModal(match)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setSelectedMatchModal(match);
                            }
                          }}
                          className={`bg-[#121316] rounded-xl px-4 py-3.5 border transition-colors cursor-pointer hover:bg-[#181A20] ${
                            isLive
                              ? 'border-[#E10600]/60'
                              : hasClash && !isFinished
                              ? 'border-amber-400/50'
                              : 'border-[#1E2028]'
                          }`}
                        >
                          {/* Subtle Competition Header */}
                          <div className="flex items-center justify-between gap-2 mb-2 text-[11px] text-[#8E95A5]">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <OfficialLogo
                                src={match.competitionLogo}
                                alt={match.competition}
                                size="xs"
                              />
                              <span className="truncate">
                                {match.competition}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {isFinished && (
                                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.5 rounded-md uppercase">
                                  FINAL • FT
                                </span>
                              )}
                              {isLive && (
                                <span className="text-[10px] font-bold text-[#F8FAFC] bg-[#E10600] px-1.5 py-0.5 rounded-md uppercase animate-pulse">
                                  LIVE {match.liveMinute || ''}
                                </span>
                              )}
                              {isTBD && !isFinished && (
                                <span className="text-[10px] font-semibold text-amber-300 bg-amber-400/10 border border-amber-400/30 px-1.5 py-0.5 rounded-md">
                                  Time Not Declared
                                </span>
                              )}
                              {hasClash && !isTBD && !isFinished && (
                                <span className="text-[10px] font-semibold text-amber-400">
                                  {matchClashes.some(
                                    (c) =>
                                      c.clashType === 'FOOTBALL_VS_FOOTBALL'
                                  )
                                    ? 'Match Clash'
                                    : 'F1 Clash'}
                                </span>
                              )}
                              {armed && !isFinished && (
                                <Bell className="w-3 h-3 text-amber-400 stroke-[2]" />
                              )}
                            </div>
                          </div>

                          {/* STRICT 3-COLUMN GRID: Home | Score or Time Badge | Away */}
                          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                            {/* Left (Home): Official Club Crest (24px) + Team Name */}
                            <div className="flex items-center gap-2.5 min-w-0">
                              <OfficialLogo
                                src={match.homeTeam.logo}
                                alt={match.homeTeam.name}
                                size="sm"
                                fallbackCode={match.homeTeam.code}
                              />
                              <span className="text-sm font-medium text-[#F8FAFC] truncate min-w-0">
                                {match.homeTeam.name}
                              </span>
                            </div>

                            {/* Center (Score / Live / Time): Compact Badge */}
                            <div
                              className={`text-xs font-semibold px-2.5 py-1 rounded-md whitespace-nowrap tabular-nums ${
                                isFinished
                                  ? 'text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 font-extrabold'
                                  : isLive
                                  ? 'text-[#F8FAFC] bg-[#E10600] font-extrabold'
                                  : isTBD
                                  ? 'text-amber-300 bg-amber-400/15 border border-amber-400/30 font-bold'
                                  : 'text-[#F8FAFC] bg-[#181A20] border border-[#1E2028]'
                              }`}
                            >
                              {isFinished
                                ? `FT  ${match.homeScore ?? 0} – ${
                                    match.awayScore ?? 0
                                  }`
                                : isLive
                                ? hasScore
                                  ? `LIVE  ${match.homeScore} – ${match.awayScore}`
                                  : 'LIVE'
                                : simpleTime}
                            </div>

                            {/* Right (Away): Team Name + Official Club Crest (24px) */}
                            <div className="flex items-center justify-end gap-2.5 min-w-0">
                              <span className="text-sm font-medium text-[#F8FAFC] truncate text-right min-w-0">
                                {match.awayTeam.name}
                              </span>
                              <OfficialLogo
                                src={match.awayTeam.logo}
                                alt={match.awayTeam.name}
                                size="sm"
                                fallbackCode={match.awayTeam.code}
                              />
                            </div>
                          </div>

                          {/* Verified Final Scorers Summary for Completed Matches */}
                          {isFinished && match.scorersSummary && (
                            <div className="mt-2 pt-1.5 border-t border-[#1E2028] text-[11px] text-[#8E95A5] truncate">
                              ⚽ {match.scorersSummary}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* SECTION 2: OFFICIAL FORMULA 1 APP CALENDAR UI, SEASON SWITCHER & WHITE TRACK MAPS */}
      {(sportFilter === 'ALL' || sportFilter === 'F1') && (
        <section
          className="space-y-3.5"
          aria-label="Official Formula 1 Race Calendar"
        >
          {/* Official F1 App Season Switcher Bar with Red Bottom Border */}
          <div className="bg-[#121316] border-y border-[#1E2028] border-b-2 border-b-[#E10600] px-4 py-2.5 flex items-center justify-between">
            <button
              type="button"
              onClick={() =>
                setSelectedF1Season((prev) =>
                  prev === 2027 ? 2026 : 2025
                )
              }
              disabled={selectedF1Season === 2025}
              aria-label="Previous F1 Season"
              className="p-1 text-[#8E95A5] hover:text-[#F8FAFC] disabled:opacity-30"
            >
              <ChevronLeft className="w-4 h-4 stroke-[2]" />
            </button>

            <div className="flex items-center gap-3">
              {([2025, 2026, 2027] as const).map((yr) => {
                const active = selectedF1Season === yr;
                return (
                  <button
                    key={yr}
                    type="button"
                    onClick={() => setSelectedF1Season(yr)}
                    data-testid={`f1-season-tab-${yr}`}
                    className={`text-xs font-display font-bold tracking-wide px-2.5 py-1 rounded-md transition-colors ${
                      active
                        ? 'text-[#F8FAFC] bg-[#E10600]'
                        : 'text-[#8E95A5] hover:text-[#F8FAFC]'
                    }`}
                  >
                    {yr} season
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() =>
                setSelectedF1Season((prev) =>
                  prev === 2025 ? 2026 : 2027
                )
              }
              disabled={selectedF1Season === 2027}
              aria-label="Next F1 Season"
              className="p-1 text-[#8E95A5] hover:text-[#F8FAFC] disabled:opacity-30"
            >
              <ChevronRight className="w-4 h-4 stroke-[2]" />
            </button>
          </div>

          <div className="px-4 space-y-3">
            {/* Season Status Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <OfficialLogo
                  src={F1_LOGOS.F1_MAIN}
                  alt="Formula 1"
                  size="xs"
                />
                <h2 className="text-xs font-semibold uppercase tracking-wider text-[#8E95A5]">
                  {selectedF1Season} FIA Formula 1 Calendar (
                  {filteredWeekends.length})
                </h2>
              </div>

              {selectedF1Season === 2027 && (
                <span className="px-2 py-0.5 rounded-md bg-[#E10600]/20 border border-[#E10600]/50 text-[10px] font-bold text-[#F8FAFC] uppercase tracking-wider">
                  FIA 2027 PROVISIONAL / CONFIRMED
                </span>
              )}
            </div>

            {/* FIA Calendar Notice when viewing NEXT_WEEK */}
            {selectedF1Season === 2026 && timeWindow === 'NEXT_WEEK' && (
              <div
                data-testid="f1-next-week-calendar-notice"
                className="rounded-xl bg-[#181A20] border border-amber-400/30 px-3.5 py-2.5 text-xs text-[#F8FAFC] flex items-center justify-between gap-2"
              >
                <div>
                  <span className="font-bold text-amber-400 uppercase tracking-wider">
                    NEXT F1 RACE WEEKEND (ROUND 22):
                  </span>{' '}
                  <span>
                    Nov 13–15 is an official FIA break week after Brazil (R21). The next Grand Prix is{' '}
                    <strong className="text-[#F8FAFC]">Las Vegas GP (20 – 22 NOV IST / 19 – 21 NOV PST)</strong>.
                  </span>
                </div>
              </div>
            )}

            {/* OFFICIAL F1 RACE CARDS WITH WHITE TRACK MAPS (SINGLE CARD PER RACE — NO DUPLICATES) */}
            <div className="space-y-2.5">
              {filteredWeekends.map((wknd) => {
                const hostLabel =
                  wknd.hostName || wknd.countryName || wknd.city;
                const roundLabel = wknd.isTesting
                  ? 'TESTING'
                  : `ROUND ${wknd.round}`;
                const computedDatePill =
                  wknd.dateRangeLabel ||
                  wknd.dateRangePill ||
                  (wknd.sessions?.length
                    ? `${wknd.sessions[0].istDateLabel} – ${wknd.sessions[wknd.sessions.length - 1].istDateLabel}`
                    : '2026 FIA CALENDAR');

                const wkndLiveStatus = evaluateF1WeekendLiveStatus(wknd);
                const isWeekendLive = wkndLiveStatus === 'LIVE';
                const isWeekendCompleted = wkndLiveStatus === 'COMPLETED';
                const isHeroCard = nextHeroWeekend?.id === wknd.id;
                const showInlineSessions =
                  timeWindow === 'THIS_WEEK' ||
                  timeWindow === 'NEXT_WEEK' ||
                  isWeekendLive;

                return (
                  <div
                    key={wknd.id}
                    data-event-id={wknd.id}
                    data-testid={
                      isHeroCard ? 'f1-next-up-hero-card' : undefined
                    }
                    ref={(el) => {
                      cardRefs.current[wknd.id] = el;
                    }}
                    onClick={() => setSelectedWeekendModal(wknd)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedWeekendModal(wknd);
                      }
                    }}
                    className={`rounded-xl p-4 border transition-colors cursor-pointer space-y-3 ${
                      isWeekendLive
                        ? 'bg-gradient-to-br from-[#181A20] via-[#121316] to-[#2D0B0E] border-[#E10600]/80 shadow-lg'
                        : isHeroCard
                        ? 'bg-gradient-to-br from-[#181A20] via-[#121316] to-[#2D0B0E] border-[#1E2028] shadow-lg'
                        : 'bg-[#121316] border-[#1E2028] hover:border-[#8E95A5]/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      {/* Left Side: ROUND #, Flag + Bold Host Name, Official FIA Title, Crisp Date Badge */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center flex-wrap gap-2">
                          <span className="text-[10px] uppercase tracking-wider text-[#8E95A5] font-semibold">
                            {roundLabel} • {wknd.grandPrixName}
                          </span>
                          {isWeekendLive && (
                            <span
                              data-testid="f1-live-weekend-badge"
                              className="px-2 py-0.5 rounded-md bg-[#E10600] text-[#F8FAFC] text-[10px] font-extrabold uppercase tracking-wider animate-pulse"
                            >
                              LIVE • RACE WEEKEND
                            </span>
                          )}
                          {!isWeekendLive && isHeroCard && (
                            <span className="px-2 py-0.5 rounded-md bg-[#F8FAFC] text-[#0A0A0C] text-[10px] font-extrabold uppercase tracking-wider">
                              {timeWindow === 'NEXT_WEEK'
                                ? `NEXT RACE (R${wknd.round})`
                                : 'NEXT'}
                            </span>
                          )}
                          {isWeekendCompleted && (
                            <span className="text-[10px] font-bold uppercase text-emerald-400">
                              • COMPLETED
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 mt-1">
                          <OfficialLogo
                            src={wknd.countryFlagUrl}
                            alt={hostLabel}
                            shape="Flag"
                            size="xs"
                          />
                          <h3 className="font-display text-lg font-bold tracking-tight text-[#F8FAFC] truncate">
                            {hostLabel}
                          </h3>
                        </div>

                        <p className="text-[11px] uppercase tracking-wide text-[#8E95A5] mt-0.5 line-clamp-1">
                          {wknd.officialTitle}
                        </p>

                        {wknd.winnerSummary && (
                          <p className="text-[11px] font-semibold text-emerald-400 mt-1 truncate">
                            🏆 {wknd.winnerSummary}
                          </p>
                        )}

                        {/* Crisp Date Badge at bottom-left */}
                        <div className="bg-[#F8FAFC] text-[#0A0A0C] text-xs font-bold px-2.5 py-1 rounded-md mt-2.5 inline-flex items-center gap-1.5 tabular-nums">
                          <span>{computedDatePill}</span>
                        </div>
                      </div>

                      {/* Right Side: Authentic White Circuit Layout Map (w-24 h-16) */}
                      <WhiteTrackMap
                        circuitId={wknd.circuitSvgId}
                        hostName={hostLabel}
                        className="w-24 h-16 shrink-0"
                      />
                    </div>

                    {/* Inline Verified IST Session Breakdown for THIS_WEEK, NEXT_WEEK, and LIVE weekend */}
                    {showInlineSessions && wknd.sessions?.length > 0 && (
                      <div className="pt-2.5 border-t border-[#1E2028] grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {wknd.sessions.map((sess) => {
                          const sessRuntimeStatus =
                            evaluateF1SessionRuntimeStatus(sess);
                          const isSessLive = sessRuntimeStatus === 'LIVE';
                          const isSessDone =
                            sessRuntimeStatus === 'COMPLETED' ||
                            wknd.status === 'COMPLETED';

                          return (
                            <div
                              key={sess.id}
                              className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] ${
                                isSessLive
                                  ? 'bg-[#E10600]/20 border border-[#E10600]/60'
                                  : 'bg-[#181A20] border border-[#1E2028]'
                              }`}
                            >
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span
                                  className={`font-bold uppercase ${
                                    isSessLive
                                      ? 'text-[#F8FAFC]'
                                      : sess.name === 'Grand Prix'
                                      ? 'text-[#E10600]'
                                      : sess.name === 'Qualifying'
                                      ? 'text-amber-400'
                                      : 'text-[#F8FAFC]'
                                  }`}
                                >
                                  {sess.name}
                                </span>
                                <span className="text-[#8E95A5]">•</span>
                                <span className="text-[#8E95A5] font-medium tabular-nums">
                                  {sess.istDateLabel}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {isSessLive && (
                                  <span className="px-1.5 py-0.2 rounded-md bg-[#E10600] text-[#F8FAFC] text-[9px] font-extrabold uppercase">
                                    LIVE
                                  </span>
                                )}
                                {isSessDone && !isSessLive && (
                                  <span className="text-[9px] font-bold text-emerald-400 uppercase">
                                    DONE
                                  </span>
                                )}
                                <span className="font-bold text-[#F8FAFC] tabular-nums">
                                  {sess.istTimeLabel}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* PROGRESSIVE DISCLOSURE MODAL 1: FOOTBALL MATCH DETAIL BOTTOM SHEET */}
      {selectedMatchModal &&
        (() => {
          const isModalTBD =
            Boolean(selectedMatchModal.isTimeTBD) ||
            /\bTBD\b|NOT DECLARED/i.test(selectedMatchModal.istTimeLabel || '');
          const modalStrictStatus = isModalTBD
            ? 'UPCOMING'
            : evaluateStrictEventStatus(
                selectedMatchModal.startTimeISO,
                selectedMatchModal.durationMinutes,
                selectedMatchModal.liveStatus === 'LIVE',
                selectedMatchModal.liveStatus === 'FINAL'
              );
          const isModalMatchFinished =
            selectedMatchModal.liveStatus === 'FINAL' ||
            selectedMatchModal.timeWindow === 'PAST_RESULTS' ||
            modalStrictStatus === 'FINAL';
          const isModalMatchLive =
            !isModalMatchFinished &&
            (selectedMatchModal.liveStatus === 'LIVE' ||
              modalStrictStatus === 'LIVE');

          return (
            <div
              role="dialog"
              aria-modal="true"
              aria-label={`${selectedMatchModal.homeTeam.name} vs ${selectedMatchModal.awayTeam.name} Match Details`}
              className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
            >
              <div className="w-full max-w-[430px] max-h-[88vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-[#1E2028] bg-[#121316] text-[#F8FAFC] shadow-2xl pb-[env(safe-area-inset-bottom)]">
                <div className="px-4 py-3.5 border-b border-[#1E2028] bg-[#181A20] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <OfficialLogo
                      src={selectedMatchModal.competitionLogo}
                      alt={selectedMatchModal.competition}
                      size="xs"
                    />
                    <div className="min-w-0">
                      <h3 className="font-display text-sm font-bold text-[#F8FAFC] truncate">
                        {selectedMatchModal.competition} •{' '}
                        {selectedMatchModal.matchweek}
                      </h3>
                      <p className="text-[11px] text-[#8E95A5] truncate">
                        {selectedMatchModal.venue}, {selectedMatchModal.city}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedMatchModal(null)}
                    aria-label="Close Match Details Modal"
                    className="h-8 w-8 rounded-lg border border-[#1E2028] flex items-center justify-center text-[#8E95A5] hover:text-[#F8FAFC]"
                  >
                    <X className="w-4 h-4 stroke-[1.5]" />
                  </button>
                </div>

                <div className="p-4 space-y-4">
                  {/* Matchup Header */}
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-2">
                    <div className="flex flex-col items-center text-center gap-2 min-w-0">
                      <OfficialLogo
                        src={selectedMatchModal.homeTeam.logo}
                        alt={selectedMatchModal.homeTeam.name}
                        size="lg"
                        fallbackCode={selectedMatchModal.homeTeam.code}
                      />
                      <span className="text-sm font-bold text-[#F8FAFC] truncate max-w-full">
                        {selectedMatchModal.homeTeam.name}
                      </span>
                    </div>

                    <div className="text-center space-y-1">
                      {isModalMatchFinished ? (
                        <>
                          <div className="px-3.5 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-lg font-extrabold text-emerald-300 tabular-nums">
                            {selectedMatchModal.homeScore ?? 0} –{' '}
                            {selectedMatchModal.awayScore ?? 0}
                          </div>
                          <div className="text-[10px] font-bold uppercase text-emerald-400">
                            FINAL • OFFICIAL RESULT
                          </div>
                        </>
                      ) : isModalMatchLive ? (
                        <>
                          <div className="px-3.5 py-1.5 rounded-lg bg-[#E10600] text-lg font-extrabold text-[#F8FAFC] tabular-nums">
                            {selectedMatchModal.homeScore ?? 0} –{' '}
                            {selectedMatchModal.awayScore ?? 0}
                          </div>
                          <div className="text-[10px] font-bold uppercase text-[#E10600]">
                            LIVE • {selectedMatchModal.liveMinute || 'IN PLAY'}
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="px-3 py-1.5 rounded-lg bg-[#181A20] border border-[#1E2028] text-sm font-bold text-[#F8FAFC] tabular-nums">
                            {formatSimpleCardTime(
                              selectedMatchModal.istTimeLabel,
                              selectedMatchModal.isTimeTBD
                                ? undefined
                                : selectedMatchModal.startTimeISO,
                              selectedMatchModal.isTimeTBD
                            )}
                          </div>
                          {selectedMatchModal.isTimeTBD && (
                            <div className="text-[10px] font-semibold text-amber-300">
                              Time Not Declared
                            </div>
                          )}
                        </>
                      )}
                      <div className="text-[11px] text-[#8E95A5]">
                        {selectedMatchModal.istDateLabel}
                      </div>
                    </div>

                    <div className="flex flex-col items-center text-center gap-2 min-w-0">
                      <OfficialLogo
                        src={selectedMatchModal.awayTeam.logo}
                        alt={selectedMatchModal.awayTeam.name}
                        size="lg"
                        fallbackCode={selectedMatchModal.awayTeam.code}
                      />
                      <span className="text-sm font-bold text-[#F8FAFC] truncate max-w-full">
                        {selectedMatchModal.awayTeam.name}
                      </span>
                    </div>
                  </div>

                  {isModalMatchFinished &&
                    selectedMatchModal.scorersSummary && (
                      <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-200 text-center font-medium">
                        ⚽ {selectedMatchModal.scorersSummary}
                      </div>
                    )}

                  {/* Action Buttons: ONLY shown when match is NOT finished */}
                  {isModalMatchFinished ? (
                    <div
                      data-testid="completed-match-status-banner"
                      className="p-3 rounded-xl bg-[#181A20] border border-emerald-500/30 flex items-center justify-center gap-2 text-xs text-emerald-400 font-semibold"
                    >
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>
                        Match Completed • Reminders &amp; Calendar Export
                        Closed
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const match = selectedMatchModal;
                            setSelectedMatchModal(null);
                            onOpenAlarmDrawer({
                              id: match.id,
                              sport: 'FOOTBALL',
                              title: `${match.homeTeam.name} vs ${match.awayTeam.name}`,
                              subtitle: `${match.competition} • ${match.istDateLabel}`,
                              eventStartTimeISO: match.startTimeISO,
                              istTimeLabel: formatSimpleCardTime(
                                match.istTimeLabel,
                                match.isTimeTBD ? undefined : match.startTimeISO,
                                match.isTimeTBD
                              ),
                            });
                          }}
                          className="min-h-[40px] px-3 py-2 rounded-xl bg-amber-400 text-[#0A0A0C] text-xs font-bold flex items-center justify-center gap-1.5"
                        >
                          <Bell className="w-3.5 h-3.5 stroke-[2]" />
                          <span>
                            {isAlarmArmed(selectedMatchModal.id)
                              ? 'Edit Reminder'
                              : 'Set Reminder'}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            onExportSingleCalendarEvent({
                              id: selectedMatchModal.id,
                              title: `${selectedMatchModal.homeTeam.name} vs ${selectedMatchModal.awayTeam.name} (${selectedMatchModal.competition})`,
                              description: `${selectedMatchModal.competition} (${selectedMatchModal.matchweek})`,
                              location: `${selectedMatchModal.venue}, ${selectedMatchModal.city}`,
                              startTimeISO: selectedMatchModal.startTimeISO,
                              durationMinutes: selectedMatchModal.durationMinutes,
                            })
                          }
                          className="min-h-[40px] px-3 py-2 rounded-xl border border-[#1E2028] bg-[#181A20] text-[#F8FAFC] text-xs font-semibold flex items-center justify-center gap-1.5"
                        >
                          <CalendarPlus className="w-3.5 h-3.5 stroke-[1.5]" />
                          <span>Add to Calendar</span>
                        </button>
                      </div>

                      {onToggleSamsungAlarm && (
                        <button
                          type="button"
                          data-testid="samsung-native-alarm-toggle-btn"
                          onClick={() =>
                            onToggleSamsungAlarm({
                              id: selectedMatchModal.id,
                              sport: 'FOOTBALL',
                              title: `${selectedMatchModal.homeTeam.name} vs ${selectedMatchModal.awayTeam.name}`,
                              subtitle: `${selectedMatchModal.competition} • ${selectedMatchModal.istDateLabel}`,
                              eventStartTimeISO: selectedMatchModal.startTimeISO,
                              istTimeLabel: formatSimpleCardTime(
                                selectedMatchModal.istTimeLabel,
                                selectedMatchModal.isTimeTBD
                                  ? undefined
                                  : selectedMatchModal.startTimeISO,
                                selectedMatchModal.isTimeTBD
                              ),
                            })
                          }
                          className={`w-full min-h-[38px] px-3 py-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                            isAlarmArmed(selectedMatchModal.id)
                              ? 'bg-[#E10600]/15 border-[#E10600]/50 text-[#E10600]'
                              : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                          }`}
                        >
                          <Clock className="w-3.5 h-3.5" />
                          <span>
                            {isAlarmArmed(selectedMatchModal.id)
                              ? 'Turn Off Samsung Clock System Alarm'
                              : '1-Tap Sync to Samsung Clock App'}
                          </span>
                        </button>
                      )}
                    </div>
                  )}

                  {/* Match Preview & Win Probability */}
                  <div className="p-3.5 rounded-xl bg-[#181A20] border border-[#1E2028] space-y-2.5 text-xs">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-[#F8FAFC] tabular-nums">
                      <span>
                        {selectedMatchModal.homeTeam.code}{' '}
                        {selectedMatchModal.prefetchMeta.winProbability.home}%
                      </span>
                      <span className="text-[#8E95A5]">
                        Draw{' '}
                        {selectedMatchModal.prefetchMeta.winProbability.draw}%
                      </span>
                      <span>
                        {selectedMatchModal.awayTeam.code}{' '}
                        {selectedMatchModal.prefetchMeta.winProbability.away}%
                      </span>
                    </div>

                    <p className="text-[#F8FAFC] leading-relaxed">
                      {selectedMatchModal.prefetchMeta.headToHeadSummary}
                    </p>

                    <div className="pt-2 border-t border-[#1E2028] space-y-1 text-[11px] text-[#8E95A5]">
                      <div>
                        <strong className="text-[#F8FAFC]">Key Players: </strong>
                        {selectedMatchModal.prefetchMeta.keyPlayersToWatch.join(
                          ' · '
                        )}
                      </div>
                      <div>
                        <strong className="text-[#F8FAFC]">Official: </strong>
                        {selectedMatchModal.prefetchMeta.referee} •{' '}
                        {selectedMatchModal.prefetchMeta.weather}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

      {/* PROGRESSIVE DISCLOSURE MODAL 2: FORMULA 1 GRAND PRIX WEEKEND BOTTOM SHEET */}
      {selectedWeekendModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${selectedWeekendModal.grandPrixName} Weekend Schedule`}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
        >
          <div className="w-full max-w-[430px] max-h-[88vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-[#1E2028] bg-[#121316] text-[#F8FAFC] shadow-2xl pb-[env(safe-area-inset-bottom)]">
            <div className="px-4 py-3.5 border-b border-[#1E2028] bg-[#181A20] flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <OfficialLogo
                  src={selectedWeekendModal.countryFlagUrl}
                  alt={
                    selectedWeekendModal.hostName ||
                    selectedWeekendModal.countryName ||
                    selectedWeekendModal.city
                  }
                  shape="Flag"
                  size="xs"
                />
                <div className="min-w-0">
                  <h3 className="font-display text-base font-bold text-[#F8FAFC] truncate">
                    {selectedWeekendModal.grandPrixName}
                  </h3>
                  <p className="text-[11px] text-[#8E95A5] truncate">
                    {selectedWeekendModal.circuitName} •{' '}
                    {selectedWeekendModal.dateRangeLabel}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedWeekendModal(null)}
                aria-label="Close Grand Prix Weekend Modal"
                className="h-8 w-8 rounded-lg border border-[#1E2028] flex items-center justify-center text-[#8E95A5] hover:text-[#F8FAFC]"
              >
                <X className="w-4 h-4 stroke-[1.5]" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Circuit Map + Track Specs */}
              <div className="p-3.5 rounded-xl bg-[#181A20] border border-[#1E2028] flex items-center justify-between gap-3">
                <div className="space-y-1 text-xs">
                  <div className="text-[10px] uppercase tracking-wider text-[#8E95A5] font-semibold">
                    {selectedWeekendModal.isTesting
                      ? 'PRE-SEASON TESTING'
                      : `ROUND ${selectedWeekendModal.round} • ${
                          selectedWeekendModal.seasonYear || selectedF1Season
                        }`}
                  </div>
                  <div className="font-bold text-[#F8FAFC]">
                    {selectedWeekendModal.circuitName}
                  </div>
                  <div className="text-[11px] text-[#8E95A5] flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    <span>{selectedWeekendModal.city}</span>
                  </div>
                  {selectedWeekendModal.winnerSummary && (
                    <div className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1 pt-1">
                      <Trophy className="w-3 h-3" />
                      <span>{selectedWeekendModal.winnerSummary}</span>
                    </div>
                  )}
                </div>

                <WhiteTrackMap
                  circuitId={selectedWeekendModal.circuitSvgId}
                  hostName={
                    selectedWeekendModal.hostName ||
                    selectedWeekendModal.countryName
                  }
                  className="w-28 h-20 shrink-0"
                />
              </div>

              {/* Weekend Sessions Schedule (Simple 12-Hour Times) */}
              {selectedWeekendModal.sessions.length > 0 ? (
                <div className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wider text-[#8E95A5]">
                    Session Schedule
                  </div>

                  <div className="divide-y divide-[#1E2028] rounded-xl bg-[#181A20] border border-[#1E2028]">
                    {selectedWeekendModal.sessions.map((session) => {
                      const simpleSessionTime = formatSimpleCardTime(
                        session.startTimeISO
                      );
                      const sessionRuntimeStatus =
                        evaluateF1SessionRuntimeStatus(session);
                      const isSessionLive = sessionRuntimeStatus === 'LIVE';
                      const isSessionFinished =
                        selectedWeekendModal.status === 'COMPLETED' ||
                        sessionRuntimeStatus === 'COMPLETED';
                      const sessionArmed =
                        !isSessionFinished &&
                        !isSessionLive &&
                        isAlarmArmed(session.id);

                      return (
                        <div
                          key={session.id}
                          className={`px-3.5 py-2.5 flex items-center justify-between gap-2 ${
                            isSessionLive ? 'bg-[#E10600]/15' : ''
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-xs font-bold ${
                                  session.name === 'Grand Prix'
                                    ? 'text-[#E10600]'
                                    : 'text-[#F8FAFC]'
                                }`}
                              >
                                {session.name}
                              </span>
                              <span className="text-[11px] text-[#8E95A5]">
                                {session.istDateLabel}
                              </span>
                            </div>
                            <div className="text-xs font-semibold text-[#F8FAFC] tabular-nums mt-0.5 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-[#8E95A5]" />
                              <span>{simpleSessionTime}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {isSessionLive ? (
                              <span className="px-2 py-0.5 rounded-md bg-[#E10600] text-[#F8FAFC] text-[10px] font-extrabold uppercase animate-pulse">
                                LIVE
                              </span>
                            ) : isSessionFinished ? (
                              <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-bold text-emerald-400 uppercase">
                                DONE
                              </span>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const wknd = selectedWeekendModal;
                                    setSelectedWeekendModal(null);
                                    onOpenAlarmDrawer({
                                      id: session.id,
                                      parentId: wknd.id,
                                      sport: 'F1',
                                      title: `${wknd.grandPrixName} • ${session.name}`,
                                      subtitle: `${wknd.circuitName} • ${session.istDateLabel}`,
                                      eventStartTimeISO: session.startTimeISO,
                                      istTimeLabel: simpleSessionTime,
                                    });
                                  }}
                                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 ${
                                    sessionArmed
                                      ? 'bg-amber-400 text-[#0A0A0C] font-bold'
                                      : 'bg-[#121316] text-[#F8FAFC] border border-[#1E2028]'
                                  }`}
                                >
                                  <Bell className="w-3 h-3" />
                                  <span>{sessionArmed ? 'Armed' : 'Remind'}</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    onExportSingleCalendarEvent({
                                      id: session.id,
                                      title: `F1 ${selectedWeekendModal.grandPrixName} — ${session.name}`,
                                      description:
                                        selectedWeekendModal.officialTitle,
                                      location: `${selectedWeekendModal.circuitName}, ${selectedWeekendModal.city}`,
                                      startTimeISO: session.startTimeISO,
                                      durationMinutes: session.durationMinutes,
                                    })
                                  }
                                  aria-label={`Export ${session.name} to Calendar`}
                                  className="p-1.5 rounded-lg bg-[#121316] text-[#8E95A5] border border-[#1E2028] hover:text-[#F8FAFC]"
                                >
                                  <CalendarPlus className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-[#181A20] border border-[#1E2028] text-xs text-[#F8FAFC] space-y-1">
                  <div className="font-semibold text-[#F8FAFC]">
                    Official FIA Weekend Window:{' '}
                    {selectedWeekendModal.dateRangeLabel ||
                      selectedWeekendModal.dateRangePill}
                  </div>
                  <p className="text-[#8E95A5]">
                    {selectedWeekendModal.circuitLengthKm ||
                      selectedWeekendModal.prefetchMeta.circuitLengthKm}{' '}
                    •{' '}
                    {selectedWeekendModal.laps ||
                      selectedWeekendModal.prefetchMeta.raceDistanceLaps}{' '}
                    Laps • Lap Record:{' '}
                    {selectedWeekendModal.prefetchMeta.lapRecord}
                  </p>
                </div>
              )}

              {/* Circuit Telemetry Specs */}
              <div className="p-3.5 rounded-xl bg-[#181A20] border border-[#1E2028] text-xs space-y-1.5">
                <div className="flex items-center justify-between text-[#8E95A5]">
                  <span>Circuit Length</span>
                  <span className="font-bold text-[#F8FAFC]">
                    {selectedWeekendModal.circuitLengthKm ||
                      selectedWeekendModal.prefetchMeta.circuitLengthKm}{' '}
                    (
                    {selectedWeekendModal.laps ||
                      selectedWeekendModal.prefetchMeta.raceDistanceLaps}{' '}
                    Laps)
                  </span>
                </div>
                <div className="flex items-center justify-between text-[#8E95A5]">
                  <span>Tyre Allocation</span>
                  <span className="font-bold text-[#F8FAFC]">
                    {selectedWeekendModal.prefetchMeta.tyreAllocation}
                  </span>
                </div>
                <div className="pt-1 text-[11px] text-[#8E95A5]">
                  {selectedWeekendModal.prefetchMeta.lapRecord}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
