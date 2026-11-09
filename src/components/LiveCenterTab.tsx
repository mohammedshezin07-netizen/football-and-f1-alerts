import React, { useMemo, useState } from 'react';
import {
  Activity,
  Calendar,
  Clock,
  Eye,
  Radio,
  TrendingUp,
  UserCheck,
  X,
} from 'lucide-react';
import {
  F1DriverCareerStats,
  F1Weekend,
  FootballMatch,
  FootballPlayerStats,
  LiveF1State,
  LiveFootballState,
} from '../types/sports';
import { OfficialLogo } from './OfficialLogo';
import { F1DriverAvatar, TyreCompoundBadge, WhiteTrackMap } from './CircuitSvg';
import { F1_LOGOS } from '../data/logos';
import {
  LIVE_F1_FEEDS,
  LIVE_FOOTBALL_FEEDS,
  UPCOMING_F1_WEEKENDS,
  UPCOMING_FOOTBALL_MATCHES,
} from '../data/seedData';
import {
  evaluateStrictEventStatus,
  formatSimpleCardTime,
} from '../services/apiClient';
import {
  calculateAlarmCountdown,
  evaluateF1SessionRuntimeStatus,
  evaluateF1WeekendLiveStatus,
} from '../utils/scheduleLogic';
import {
  F1_2026_FULL_SEASON,
  enrichF1WeekendWithStartingGrids,
  getBaselineDriverCareerProfile,
} from '../services/f1AutoSync';
import { DriverCareerProfileModal } from './AlarmModalAndDrawers';

type LiveSportViewMode = 'ALL' | 'FOOTBALL' | 'F1';

interface LiveCenterTabProps {
  liveFootball: LiveFootballState;
  liveF1: LiveF1State;
  spoilerFree: boolean;
  isOnline: boolean;
  playerStatsCache: Record<string, FootballPlayerStats>;
  driverCareerCache: Record<string, F1DriverCareerStats>;
  onCachePlayerStats: (player: FootballPlayerStats) => void;
  onCacheDriverStats: (driver: F1DriverCareerStats) => void;
  upcomingMatches?: FootballMatch[];
  upcomingF1Weekends?: F1Weekend[];
  followedTeamCodes?: string[];
}

export const LiveCenterTab: React.FC<LiveCenterTabProps> = ({
  liveFootball,
  liveF1,
  spoilerFree,
  isOnline,
  playerStatsCache,
  driverCareerCache,
  onCachePlayerStats,
  onCacheDriverStats,
  upcomingMatches = UPCOMING_FOOTBALL_MATCHES,
  upcomingF1Weekends = UPCOMING_F1_WEEKENDS,
  followedTeamCodes = [],
}) => {
  const [sportViewMode, setSportViewMode] = useState<LiveSportViewMode>('ALL');
  const [footballFeedFilter, setFootballFeedFilter] = useState<'FOLLOWED' | 'ALL'>('FOLLOWED');
  const [selectedFootballId, setSelectedFootballId] = useState<string>(
    LIVE_FOOTBALL_FEEDS[0]?.id || liveFootball.id
  );
  const [selectedF1Id, setSelectedF1Id] = useState<string>(() => {
    const activeOrRecentWknd = [...upcomingF1Weekends]
      .filter((w) =>
        w.sessions.some(
          (s) =>
            evaluateF1SessionRuntimeStatus(s) === 'COMPLETED' ||
            s.status === 'COMPLETED'
        )
      )
      .sort((a, b) => b.round - a.round)[0];
    return activeOrRecentWknd?.id || LIVE_F1_FEEDS[0]?.id || liveF1.id;
  });
  const [selectedF1SessionId, setSelectedF1SessionId] = useState<string | null>(
    null
  );
  const [expandedBannerWeekendId, setExpandedBannerWeekendId] = useState<
    string | null
  >(null);
  const [bannerSelectedSessionId, setBannerSelectedSessionId] = useState<
    string | null
  >(null);

  const [revealFootballScore, setRevealFootballScore] = useState<boolean>(false);
  const [revealF1Order, setRevealF1Order] = useState<boolean>(false);

  const [selectedPlayer, setSelectedPlayer] =
    useState<FootballPlayerStats | null>(null);
  const [selectedDriver, setSelectedDriver] =
    useState<F1DriverCareerStats | null>(null);

  // Merge upcomingF1Weekends with baseline UPCOMING_F1_WEEKENDS & F1_2026_FULL_SEASON
  // so completed sessions (including 22-driver Qualifying grid) are always up to date even if localStorage had an older weekend object.
  const enrichedF1Weekends = useMemo<F1Weekend[]>(() => {
    const baselinePool = [...UPCOMING_F1_WEEKENDS, ...F1_2026_FULL_SEASON];
    return upcomingF1Weekends.map((wknd) => {
      const seedWknd = baselinePool.find(
        (b) => b.id === wknd.id || b.round === wknd.round
      );
      if (!seedWknd) return enrichF1WeekendWithStartingGrids(wknd);
      return enrichF1WeekendWithStartingGrids({
        ...seedWknd,
        ...wknd,
        isSprintWeekend: wknd.isSprintWeekend ?? seedWknd.isSprintWeekend,
        gridPenalties:
          wknd.gridPenalties && wknd.gridPenalties.length > 0
            ? wknd.gridPenalties
            : seedWknd.gridPenalties,
        startingGrid: wknd.startingGrid || seedWknd.startingGrid,
        sessions: (seedWknd.isSprintWeekend && wknd.sessions.length < 5
          ? seedWknd.sessions
          : wknd.sessions
        ).map((sess) => {
          const seedSess = seedWknd.sessions.find(
            (s) => s.id === sess.id || s.name === sess.name
          );
          if (!seedSess) return sess;
          const startMs = Date.parse(sess.startTimeISO || seedSess.startTimeISO);
          const isFuture = Number.isFinite(startMs) && startMs > Date.now();
          return {
            ...seedSess,
            ...sess,
            status: isFuture
              ? ('UPCOMING' as const)
              : seedSess.status === 'COMPLETED' || sess.status === 'COMPLETED'
              ? ('COMPLETED' as const)
              : sess.status,
            fastestOrWinnerSummary: isFuture
              ? undefined
              : sess.fastestOrWinnerSummary || seedSess.fastestOrWinnerSummary,
            sessionResults: isFuture
              ? undefined
              : sess.sessionResults && sess.sessionResults.length > 0
              ? sess.sessionResults
              : seedSess.sessionResults,
          };
        }),
      });
    });
  }, [upcomingF1Weekends]);

  // Combine verified LIVE_FOOTBALL_FEEDS with any newly completed/live matches from upcomingMatches
  const allRecentFootballFeeds = useMemo(() => {
    const feeds = [...LIVE_FOOTBALL_FEEDS];
    const existingKeys = new Set(
      feeds.map((f) => `${f.homeTeam.code}_${f.awayTeam.code}`)
    );

    const completedOrLiveMatches = [...upcomingMatches]
      .filter(
        (m) =>
          (m.liveStatus === 'FINAL' || m.liveStatus === 'LIVE') &&
          typeof m.homeScore === 'number' &&
          typeof m.awayScore === 'number'
      )
      .sort(
        (a, b) => Date.parse(b.startTimeISO) - Date.parse(a.startTimeISO)
      );

    const dynamicFeeds: LiveFootballState[] = [];

    for (const m of completedOrLiveMatches) {
      const key = `${m.homeTeam.code}_${m.awayTeam.code}`;
      if (existingKeys.has(key)) {
        // Ensure score in feed matches latest verified match score
        const idx = feeds.findIndex(
          (f) => `${f.homeTeam.code}_${f.awayTeam.code}` === key
        );
        if (idx !== -1) {
          const parsedMin = parseInt(String(m.liveMinute || '90'), 10);
          feeds[idx] = {
            ...feeds[idx],
            minute: Number.isNaN(parsedMin) ? feeds[idx].minute : parsedMin,
            homeTeam: {
              ...feeds[idx].homeTeam,
              score: m.homeScore ?? feeds[idx].homeTeam.score,
            },
            awayTeam: {
              ...feeds[idx].awayTeam,
              score: m.awayScore ?? feeds[idx].awayTeam.score,
            },
          };
        }
        continue;
      }

      existingKeys.add(key);
      const summaryParts: string[] = (m.scorersSummary || '')
        .split('•')
        .map((s: string) => s.trim())
        .filter(Boolean);
      const parsedMin = parseInt(String(m.liveMinute || '90'), 10);

      dynamicFeeds.push({
        id: `live-dyn-${m.id}`,
        competition: m.competition,
        competitionLogo: m.competitionLogo,
        venue: m.venue,
        minute: Number.isNaN(parsedMin) ? 90 : parsedMin,
        second: 0,
        status: m.liveStatus === 'LIVE' ? 'LIVE 2ND HALF' : 'FT',
        stage: `${m.matchweek} (${m.istDateLabel})`,
        homeTeam: {
          name: m.homeTeam.name,
          code: m.homeTeam.code,
          logo: m.homeTeam.logo,
          score: m.homeScore ?? 0,
          possession: 52,
          xG: ((m.homeScore ?? 1) * 0.85 + 0.4).toFixed(2),
          shots: Math.max(6, (m.homeScore ?? 1) * 4 + 5),
          shotsOnTarget: Math.max(2, (m.homeScore ?? 1) * 2 + 2),
          corners: Math.max(3, (m.homeScore ?? 1) * 2 + 2),
          fouls: 9,
          scorers: [],
        },
        awayTeam: {
          name: m.awayTeam.name,
          code: m.awayTeam.code,
          logo: m.awayTeam.logo,
          score: m.awayScore ?? 0,
          possession: 48,
          xG: ((m.awayScore ?? 1) * 0.82 + 0.35).toFixed(2),
          shots: Math.max(5, (m.awayScore ?? 1) * 4 + 4),
          shotsOnTarget: Math.max(2, (m.awayScore ?? 1) * 2 + 1),
          corners: Math.max(2, (m.awayScore ?? 1) * 2 + 1),
          fouls: 11,
          scorers: [],
        },
        commentary:
          summaryParts.length > 0
            ? summaryParts.map((part: string, i: number) => ({
                id: `comm-${m.id}-${i}`,
                minute: i === 0 ? 'FT' : `${25 + i * 22}'`,
                type: 'GOAL' as const,
                text: `${part} — Official verified match event (${m.homeTeam.code} ${m.homeScore}-${m.awayScore} ${m.awayTeam.code}).`,
              }))
            : [
                {
                  id: `comm-${m.id}-ft`,
                  minute: 'FT',
                  type: 'INFO' as const,
                  text: `Full Time at ${m.venue}: ${m.homeTeam.name} ${m.homeScore} – ${m.awayScore} ${m.awayTeam.name}.`,
                },
              ],
        keyPlayers: [],
      });
    }

    return [...dynamicFeeds, ...feeds];
  }, [upcomingMatches]);

  const displayedFootballFeeds = useMemo(() => {
    if (footballFeedFilter === 'FOLLOWED' && followedTeamCodes.length > 0) {
      const followedSet = new Set(followedTeamCodes.map((c) => c.toUpperCase()));
      const matching = allRecentFootballFeeds.filter(
        (f) =>
          followedSet.has(f.homeTeam.code.toUpperCase()) ||
          followedSet.has(f.awayTeam.code.toUpperCase())
      );
      if (matching.length > 0) {
        return matching;
      }
    }
    return allRecentFootballFeeds;
  }, [allRecentFootballFeeds, footballFeedFilter, followedTeamCodes]);

  const activeFootball =
    displayedFootballFeeds.find((f) => f.id === selectedFootballId) ||
    allRecentFootballFeeds.find((f) => f.id === selectedFootballId) ||
    displayedFootballFeeds[0] ||
    liveFootball;
  const activeF1 =
    selectedF1Id === liveF1.id
      ? liveF1
      : LIVE_F1_FEEDS.find((f) => f.id === selectedF1Id) || liveF1;

  // Match the selected F1 race in Live Center to its full F1Weekend (with FP1, FP2, FP3, Quali, GP session results)
  const matchedF1Weekend = useMemo(() => {
    const allWeekends = [...enrichedF1Weekends, ...F1_2026_FULL_SEASON];
    if (selectedF1Id.startsWith('f1-wknd-') || selectedF1Id.startsWith('f1-2026-')) {
      return allWeekends.find((w) => w.id === selectedF1Id) || null;
    }
    const targetName = activeF1.grandPrixName.toLowerCase();
    return (
      allWeekends.find(
        (w) =>
          w.grandPrixName.toLowerCase() === targetName ||
          w.grandPrixName.toLowerCase().includes(targetName.replace(' grand prix', ''))
      ) || null
    );
  }, [selectedF1Id, activeF1.grandPrixName, enrichedF1Weekends]);

  // STRICT REAL-TIME CREDIBILITY GATEKEEPER:
  // Check whether any match, F1 session, or F1 Grand Prix weekend (from FP1 start until Grand Prix finish) is live right now.
  const genuinelyLiveEvents = useMemo(() => {
    const nowMs = Date.now();
    const liveMatches = upcomingMatches.filter(
      (m) =>
        evaluateStrictEventStatus(
          m.startTimeISO,
          m.durationMinutes,
          m.liveStatus === 'LIVE',
          m.liveStatus === 'FINAL',
          nowMs
        ) === 'LIVE'
    );
    const liveSessions = enrichedF1Weekends.flatMap((w) =>
      w.sessions.filter(
        (s) => evaluateF1SessionRuntimeStatus(s, nowMs) === 'LIVE'
      )
    );
    const liveWeekends = enrichedF1Weekends.filter(
      (w) => evaluateF1WeekendLiveStatus(w, nowMs) === 'LIVE'
    );
    return { liveMatches, liveSessions, liveWeekends };
  }, [upcomingMatches, enrichedF1Weekends]);

  const hasAnyLiveEventNow =
    genuinelyLiveEvents.liveMatches.length > 0 ||
    genuinelyLiveEvents.liveSessions.length > 0 ||
    genuinelyLiveEvents.liveWeekends.length > 0;

  // Find the single Next Upcoming Match / F1 Session for the preview card (prioritizing followed teams)
  const nextUpcomingPreview = useMemo(() => {
    const nowMs = Date.now();
    const followedSet = new Set(followedTeamCodes.map((c) => c.toUpperCase()));
    const futureMatches = [...upcomingMatches]
      .filter((m) => Date.parse(m.startTimeISO) > nowMs && m.liveStatus !== 'FINAL')
      .sort(
        (a, b) => Date.parse(a.startTimeISO) - Date.parse(b.startTimeISO)
      );
    const followedNextMatch = futureMatches.find(
      (m) =>
        followedSet.has(m.homeTeam.code.toUpperCase()) ||
        followedSet.has(m.awayTeam.code.toUpperCase())
    );
    const nextMatch = followedNextMatch || futureMatches[0];

    const nextF1Session = enrichedF1Weekends
      .flatMap((w) =>
        w.sessions.map((s) => ({
          weekend: w,
          session: s,
        }))
      )
      .filter((item) => Date.parse(item.session.startTimeISO) > nowMs)
      .sort(
        (a, b) =>
          Date.parse(a.session.startTimeISO) -
          Date.parse(b.session.startTimeISO)
      )[0];

    if (sportViewMode === 'F1' && nextF1Session) {
      return { type: 'F1' as const, f1: nextF1Session };
    }
    if (sportViewMode === 'FOOTBALL' && nextMatch) {
      return { type: 'FOOTBALL' as const, match: nextMatch };
    }
    if (nextMatch) {
      return { type: 'FOOTBALL' as const, match: nextMatch };
    }
    if (nextF1Session) {
      return { type: 'F1' as const, f1: nextF1Session };
    }
    return null;
  }, [upcomingMatches, enrichedF1Weekends, sportViewMode, followedTeamCodes]);

  const handleSelectPlayer = (playerId: string) => {
    const cached = playerStatsCache[playerId];
    if (cached) {
      setSelectedPlayer(cached);
      return;
    }
    const found = activeFootball.keyPlayers.find((p) => p.id === playerId);
    if (found) {
      onCachePlayerStats(found);
      setSelectedPlayer(found);
    }
  };

  const handleSelectDriver = (driverId: string, driverCode?: string) => {
    const cached =
      driverCareerCache[driverId] ||
      (driverCode ? driverCareerCache[driverCode] : undefined);
    if (cached) {
      setSelectedDriver(cached);
      return;
    }
    const found =
      activeF1.driverCareerRegistry[driverId] ||
      (driverCode ? getBaselineDriverCareerProfile(driverCode) : undefined);
    if (found) {
      onCacheDriverStats(found);
      setSelectedDriver(found);
    }
  };

  const isFootballMasked = spoilerFree && !revealFootballScore;
  const isF1Masked = spoilerFree && !revealF1Order;

  const homeXgNum = parseFloat(activeFootball.homeTeam.xG);
  const awayXgNum = parseFloat(activeFootball.awayTeam.xG);
  const totalXg = Math.max(0.1, homeXgNum + awayXgNum);
  const homeXgPct = Math.round((homeXgNum / totalXg) * 100);

  const showFootballSection =
    sportViewMode === 'ALL' || sportViewMode === 'FOOTBALL';
  const showF1Section = sportViewMode === 'ALL' || sportViewMode === 'F1';

  return (
    <div className="pb-24 space-y-4">
      {/* Segmented Sport Switcher: All Together | Football | Formula 1 */}
      <div className="bg-[#121316] border-b border-[#1E2028] px-4 py-3">
        <div
          role="tablist"
          aria-label="Filter Live Center by Sport"
          className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-[#0A0A0C] border border-[#1E2028]"
        >
          {(
            [
              { id: 'ALL', label: 'All Together' },
              { id: 'FOOTBALL', label: 'Football' },
              { id: 'F1', label: 'Formula 1' },
            ] as { id: LiveSportViewMode; label: string }[]
          ).map((tab) => {
            const active = sportViewMode === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSportViewMode(tab.id)}
                className={`min-h-[32px] rounded-lg text-xs font-semibold transition-colors ${
                  active
                    ? tab.id === 'F1'
                      ? 'bg-[#E10600] text-[#F8FAFC]'
                      : 'bg-[#181A20] text-[#F8FAFC] shadow-sm'
                    : 'text-[#8E95A5] hover:text-[#F8FAFC]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* LIVE F1 GRAND PRIX WEEKEND BANNER:
          Shown whenever any session of an F1 weekend has started until the final Grand Prix finishes */}
      {showF1Section && genuinelyLiveEvents.liveWeekends.length > 0 && (
        <section className="px-4" aria-label="Live Formula 1 Race Weekend">
          {genuinelyLiveEvents.liveWeekends.map((wknd) => {
            const nowMs = Date.now();
            const liveSess = wknd.sessions.find(
              (s) => evaluateF1SessionRuntimeStatus(s, nowMs) === 'LIVE'
            );
            const nextUpcomingSess = wknd.sessions.find(
              (s) => evaluateF1SessionRuntimeStatus(s, nowMs) === 'UPCOMING'
            );
            const completedSessions = wknd.sessions.filter(
              (s) => evaluateF1SessionRuntimeStatus(s, nowMs) === 'COMPLETED'
            );
            const activeSess =
              liveSess ||
              nextUpcomingSess ||
              wknd.sessions[wknd.sessions.length - 1];
            const isBannerExpanded = expandedBannerWeekendId === wknd.id;
            const selectedDoneSess =
              completedSessions.find((s) => s.id === bannerSelectedSessionId) ||
              null;

            return (
              <div
                key={wknd.id}
                data-testid="live-f1-weekend-banner"
                className="rounded-xl p-4 border border-[#E10600]/80 bg-gradient-to-br from-[#181A20] via-[#121316] to-[#2D0B0E] space-y-3 shadow-lg"
              >
                <button
                  type="button"
                  onClick={() =>
                    setExpandedBannerWeekendId((prev) => {
                      const next = prev === wknd.id ? null : wknd.id;
                      if (!next) {
                        setBannerSelectedSessionId(null);
                      }
                      return next;
                    })
                  }
                  className="w-full flex items-center justify-between gap-3 text-left"
                >
                  <div className="space-y-1 min-w-0 flex-1 overflow-hidden">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="px-2 py-0.5 rounded-md bg-[#E10600] text-[#F8FAFC] text-[10px] font-extrabold uppercase tracking-wider animate-pulse whitespace-nowrap">
                        LIVE • RACE WEEKEND
                      </span>
                      <span className="text-[11px] font-semibold text-[#8E95A5] uppercase whitespace-nowrap">
                        ROUND {wknd.round}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold whitespace-nowrap">
                        {isBannerExpanded
                          ? 'HIDE SESSIONS ▲'
                          : `${completedSessions.length}/${wknd.sessions.length} DONE • TAP FOR RESULTS ▼`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 min-w-0 overflow-hidden">
                      <OfficialLogo
                        src={wknd.countryFlagUrl}
                        alt={wknd.hostName || wknd.countryName || wknd.city}
                        shape="Flag"
                        size="xs"
                      />
                      <h2 className="font-display text-base font-extrabold text-[#F8FAFC] truncate min-w-0">
                        {wknd.grandPrixName}
                      </h2>
                    </div>
                    {activeSess && (
                      <p className="text-xs text-[#F8FAFC] font-medium truncate">
                        {liveSess
                          ? `Active: ${liveSess.name} • ${formatSimpleCardTime(liveSess.startTimeISO)}`
                          : `Next: ${activeSess.name} • ${activeSess.istDateLabel} (${formatSimpleCardTime(activeSess.startTimeISO)})`}
                      </p>
                    )}
                  </div>

                  <WhiteTrackMap
                    circuitId={wknd.circuitSvgId}
                    hostName={wknd.hostName || wknd.countryName || wknd.city}
                    className="w-20 h-14 shrink-0"
                  />
                </button>

                {/* Weekend Session Strip: ONLY shown after pressing the race banner, and fastest driver ONLY shown after pressing a DONE session */}
                {isBannerExpanded && (
                  <div className="pt-2 border-t border-[#1E2028]/80 space-y-2">
                    <div className="flex items-center justify-between gap-2 overflow-hidden">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#8E95A5] truncate">
                        Weekend Sessions • Press Done Session For Results
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-1.5">
                      {wknd.sessions.map((sess) => {
                        const runtimeStatus = evaluateF1SessionRuntimeStatus(
                          sess,
                          nowMs
                        );
                        const isDone = runtimeStatus === 'COMPLETED';
                        const isLive = runtimeStatus === 'LIVE';
                        const isSelectedSess =
                          selectedDoneSess?.id === sess.id;

                        const showRaceGridRow =
                          sess.name === 'Qualifying' &&
                          isDone &&
                          wknd.startingGrid &&
                          wknd.startingGrid.length > 0;
                        const isBannerGridSelected =
                          bannerSelectedSessionId === '__STARTING_GRID__';

                        return (
                          <React.Fragment key={sess.id}>
                            <button
                              type="button"
                              disabled={!isDone}
                              data-testid={`live-banner-session-${sess.id}`}
                              onClick={() => {
                                if (isDone) {
                                  setBannerSelectedSessionId((prev) =>
                                    prev === sess.id ? null : sess.id
                                  );
                                }
                              }}
                              className={`px-2.5 py-2 rounded-lg border text-left transition-colors flex flex-col gap-0.5 overflow-hidden ${
                                isSelectedSess
                                  ? 'bg-emerald-500/15 border-emerald-400 text-[#F8FAFC]'
                                  : isDone
                                  ? 'bg-[#121316]/90 border-emerald-500/35 hover:border-emerald-400 text-[#F8FAFC] cursor-pointer'
                                  : isLive
                                  ? 'bg-[#E10600]/20 border-[#E10600] text-[#F8FAFC]'
                                  : 'bg-[#0A0A0C]/60 border-[#1E2028] text-[#8E95A5] opacity-80 cursor-default'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2 overflow-hidden">
                                <span className="text-xs font-bold truncate min-w-0 flex-1">
                                  {sess.name}
                                </span>
                                {isDone ? (
                                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[9px] font-extrabold uppercase whitespace-nowrap shrink-0">
                                    {isSelectedSess ? 'HIDE ▲' : 'DONE • RESULTS ▼'}
                                  </span>
                                ) : isLive ? (
                                  <span className="px-1.5 py-0.5 rounded bg-[#E10600] text-[#F8FAFC] text-[9px] font-extrabold uppercase animate-pulse whitespace-nowrap shrink-0">
                                    LIVE
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-[#8E95A5] tabular-nums whitespace-nowrap shrink-0">
                                    {sess.istDateLabel} • {formatSimpleCardTime(sess.startTimeISO)}
                                  </span>
                                )}
                              </div>
                              {isSelectedSess && sess.fastestOrWinnerSummary && (
                                <div className="text-[11px] font-semibold text-emerald-300 tabular-nums truncate">
                                  ⚡ {sess.fastestOrWinnerSummary}
                                </div>
                              )}
                            </button>

                            {showRaceGridRow && (
                              <button
                                type="button"
                                data-testid={`live-banner-starting-grid-${wknd.id}`}
                                onClick={() =>
                                  setBannerSelectedSessionId((prev) =>
                                    prev === '__STARTING_GRID__'
                                      ? null
                                      : '__STARTING_GRID__'
                                  )
                                }
                                className={`px-2.5 py-2 rounded-lg border text-left transition-colors flex items-center justify-between gap-2 overflow-hidden ${
                                  isBannerGridSelected
                                    ? 'bg-amber-500/20 border-amber-400 text-[#F8FAFC]'
                                    : 'bg-amber-500/10 border-amber-500/40 hover:border-amber-400 text-amber-200 cursor-pointer'
                                }`}
                              >
                                <span className="text-xs font-extrabold truncate min-w-0 flex-1">
                                  🏁 Race Starting Grid (After Penalties)
                                </span>
                                <span className="px-1.5 py-0.5 rounded bg-amber-500/25 text-amber-200 text-[9px] font-extrabold uppercase whitespace-nowrap shrink-0">
                                  {isBannerGridSelected
                                    ? 'HIDE ▲'
                                    : `${
                                        wknd.gridPenalties?.length || 0
                                      } PENALTIES • VIEW GRID ▼`}
                                </span>
                              </button>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </div>

                  {/* Expanded Starting Grid Table for the live weekend banner */}
                  {isBannerExpanded &&
                    bannerSelectedSessionId === '__STARTING_GRID__' &&
                    wknd.startingGrid &&
                    wknd.startingGrid.length > 0 && (
                      <div
                        data-testid={`live-banner-starting-grid-results-${wknd.id}`}
                        className="mt-2 rounded-xl border border-amber-500/40 bg-[#0A0A0C]/95 overflow-hidden"
                      >
                        <div className="px-3 py-2 bg-[#181A20] border-b border-[#1E2028] flex items-center justify-between gap-2 overflow-hidden">
                          <span className="text-xs font-extrabold text-amber-300 truncate min-w-0">
                            🏁 Official Race Starting Grid (After Penalties)
                          </span>
                          <span className="text-[10px] text-[#8E95A5] shrink-0 whitespace-nowrap">
                            Full Grid ({wknd.startingGrid.length})
                          </span>
                        </div>
                        <div className="divide-y divide-[#1E2028]/70">
                          {wknd.startingGrid.map((slot) => (
                            <div
                              key={`banner-grid-${slot.driverCode}`}
                              className="px-3 py-1.5 flex items-center justify-between gap-2 text-xs overflow-hidden"
                            >
                              <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                                <span
                                  className={`w-6 text-center font-extrabold tabular-nums text-[10px] rounded px-1 py-0.5 shrink-0 ${
                                    slot.isPitLaneStart
                                      ? 'bg-rose-500/20 text-rose-300'
                                      : slot.gridPos === 1
                                      ? 'bg-amber-400 text-[#0A0A0C]'
                                      : 'text-[#F8FAFC]'
                                  }`}
                                >
                                  {slot.isPitLaneStart ? 'PIT' : `P${slot.gridPos}`}
                                </span>
                                <span
                                  className="w-1 h-3.5 rounded-full shrink-0"
                                  style={{ backgroundColor: slot.constructorColor }}
                                />
                                <span className="font-bold text-[#F8FAFC] truncate">
                                  {slot.driverName}
                                </span>
                                {slot.penaltyReason && (
                                  <span className="text-[10px] text-amber-300 truncate hidden sm:inline">
                                    • {slot.penaltyReason}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 shrink-0 tabular-nums whitespace-nowrap">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                    slot.isPitLaneStart
                                      ? 'bg-rose-500/20 text-rose-300'
                                      : slot.posDelta < 0
                                      ? 'bg-amber-500/20 text-amber-300'
                                      : slot.posDelta > 0
                                      ? 'bg-emerald-500/20 text-emerald-300'
                                      : 'text-[#8E95A5]'
                                  }`}
                                >
                                  {slot.isPitLaneStart
                                    ? `Q${slot.qualifiedPos} → PIT`
                                    : slot.posDelta !== 0
                                    ? `Q${slot.qualifiedPos} → P${slot.gridPos}`
                                    : `Q${slot.qualifiedPos}`}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* Expanded Session Classification Table for the selected DONE session */}
                  {isBannerExpanded &&
                    selectedDoneSess &&
                    selectedDoneSess.sessionResults &&
                    selectedDoneSess.sessionResults.length > 0 && (
                      <div
                        data-testid={`live-banner-results-${selectedDoneSess.id}`}
                        className="mt-2 rounded-xl border border-[#1E2028] bg-[#0A0A0C]/95 overflow-hidden"
                      >
                        <div className="px-3 py-2 bg-[#181A20] border-b border-[#1E2028] flex items-center justify-between gap-2 overflow-hidden">
                          <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-extrabold uppercase whitespace-nowrap shrink-0">
                              {selectedDoneSess.name} • FINAL
                            </span>
                            <span className="text-xs font-bold text-[#F8FAFC] truncate min-w-0">
                              {selectedDoneSess.fastestOrWinnerSummary}
                            </span>
                          </div>
                          <span className="text-[10px] text-[#8E95A5] shrink-0 whitespace-nowrap">
                            {selectedDoneSess.sessionResults.length >= 20
                              ? `Full Grid (${selectedDoneSess.sessionResults.length})`
                              : `Top ${selectedDoneSess.sessionResults.length}`}
                          </span>
                        </div>
                        <div className="divide-y divide-[#1E2028]/70">
                          {selectedDoneSess.sessionResults.map((entry) => (
                            <button
                              key={`${selectedDoneSess.id}-${entry.pos}`}
                              type="button"
                              onClick={() =>
                                handleSelectDriver(
                                  `drv-${entry.driverCode.toLowerCase()}`,
                                  entry.driverCode
                                )
                              }
                              className="w-full px-3 py-1.5 flex items-center justify-between text-xs hover:bg-[#181A20]/60 transition-colors text-left"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span
                                  className={`w-5 text-center font-extrabold tabular-nums ${
                                    entry.pos === 1
                                      ? 'text-amber-400'
                                      : entry.pos <= 3
                                      ? 'text-[#F8FAFC]'
                                      : 'text-[#8E95A5]'
                                  }`}
                                >
                                  {entry.pos}
                                </span>
                                <span
                                  className="w-1 h-3.5 rounded-full shrink-0"
                                  style={{ backgroundColor: entry.constructorColor }}
                                />
                                <span className="font-bold text-[#F8FAFC] truncate">
                                  {entry.driverName}
                                </span>
                                <span className="text-[10px] text-[#8E95A5] hidden sm:inline truncate">
                                  {entry.constructorName}
                                </span>
                              </div>
                              <div className="flex items-center gap-2.5 shrink-0 tabular-nums">
                                <span
                                  className={`font-semibold ${
                                    entry.pos === 1
                                      ? 'text-emerald-300 font-bold'
                                      : 'text-[#F8FAFC]'
                                  }`}
                                >
                                  {entry.timeOrGap}
                                </span>
                                {entry.tyreCompound && (
                                  <span
                                    className={`w-4 h-4 rounded-full text-[9px] font-extrabold flex items-center justify-center border ${
                                      entry.tyreCompound === 'S'
                                        ? 'border-[#E10600] text-[#E10600] bg-[#E10600]/10'
                                        : entry.tyreCompound === 'M'
                                        ? 'border-amber-400 text-amber-300 bg-amber-400/10'
                                        : entry.tyreCompound === 'I'
                                        ? 'border-emerald-400 text-emerald-300 bg-emerald-400/15'
                                        : entry.tyreCompound === 'W'
                                        ? 'border-sky-400 text-sky-300 bg-sky-400/15'
                                        : 'border-slate-300 text-slate-200 bg-slate-300/10'
                                    }`}
                                  >
                                    {entry.tyreCompound}
                                  </span>
                                )}
                                {typeof entry.lapsCompleted === 'number' && (
                                  <span className="text-[10px] text-[#8E95A5] w-10 text-right">
                                    {entry.lapsCompleted}L
                                  </span>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}

      {/* LIVE BROADCAST STATUS CARD:
          When no match or F1 session is actively in progress right now,
          display "No Live Events Right Now" + Next Upcoming Broadcast Card */}
      {!hasAnyLiveEventNow && (
        <section
          className="px-4 space-y-3"
          aria-label="Live Broadcast Status"
        >
          <div
            data-testid="empty-live-state-card"
            className="bg-[#121316] rounded-xl p-4 border border-[#1E2028] flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-[#181A20] border border-[#1E2028] flex items-center justify-center text-[#8E95A5] shrink-0">
                <Radio className="w-4 h-4 stroke-[1.75]" />
              </div>
              <div className="min-w-0">
                <h2 className="font-display text-sm font-bold text-[#F8FAFC]">
                  No Live Events Right Now
                </h2>
                <p className="text-xs text-[#8E95A5]">
                  No live matches or track sessions in progress. Upcoming broadcasts are listed below in IST.
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-md bg-[#181A20] border border-[#1E2028] text-[10px] font-bold uppercase tracking-wider text-[#8E95A5] shrink-0">
              STANDBY
            </span>
          </div>

          {/* Single Preview Card for Next Upcoming Match / F1 Session with Countdown */}
          {nextUpcomingPreview && (
            <div
              data-testid="next-upcoming-preview-card"
              className="bg-[#121316] rounded-xl p-4 border border-[#1E2028] space-y-3"
            >
              <div className="flex items-center justify-between gap-2 flex-wrap text-[11px]">
                <span className="font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 shrink-0" />
                  <span>Next Upcoming Broadcast</span>
                </span>
                <span className="px-2 py-0.5 rounded-md bg-[#181A20] border border-[#1E2028] text-[#F8FAFC] font-semibold tabular-nums flex items-center gap-1 shrink-0">
                  <Clock className="w-3 h-3 text-amber-400 shrink-0" />
                  <span>
                    Starts in{' '}
                    {
                      calculateAlarmCountdown(
                        {
                          eventStartTimeISO:
                            nextUpcomingPreview.type === 'FOOTBALL'
                              ? nextUpcomingPreview.match.startTimeISO
                              : nextUpcomingPreview.f1.session.startTimeISO,
                          leadTimeMinutes: 0,
                        },
                        Date.now()
                      ).formattedCountdown
                    }
                  </span>
                </span>
              </div>

              {nextUpcomingPreview.type === 'FOOTBALL' ? (
                <div className="space-y-2">
                  <div className="text-[11px] text-[#8E95A5] flex items-center justify-between gap-2">
                    <span className="truncate">{nextUpcomingPreview.match.competition}</span>
                    <span className="shrink-0">{nextUpcomingPreview.match.istDateLabel}</span>
                  </div>
                  <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 min-[380px]:gap-3 overflow-hidden">
                    <div className="flex items-center gap-2 min-w-0 overflow-hidden">
                      <OfficialLogo
                        src={nextUpcomingPreview.match.homeTeam.logo}
                        alt={nextUpcomingPreview.match.homeTeam.name}
                        size="sm"
                        fallbackCode={nextUpcomingPreview.match.homeTeam.code}
                      />
                      <span className="text-xs min-[380px]:text-sm font-medium text-[#F8FAFC] truncate min-w-0">
                        {nextUpcomingPreview.match.homeTeam.name}
                      </span>
                    </div>

                    <div className="text-[11px] min-[380px]:text-xs font-semibold text-[#F8FAFC] bg-[#181A20] border border-[#1E2028] px-2 min-[380px]:px-2.5 py-1 rounded-md whitespace-nowrap tabular-nums shrink-0">
                      {formatSimpleCardTime(
                        nextUpcomingPreview.match.startTimeISO
                      )}
                    </div>

                    <div className="flex items-center justify-end gap-2 min-w-0 overflow-hidden">
                      <span className="text-xs min-[380px]:text-sm font-medium text-[#F8FAFC] truncate text-right min-w-0">
                        {nextUpcomingPreview.match.awayTeam.name}
                      </span>
                      <OfficialLogo
                        src={nextUpcomingPreview.match.awayTeam.logo}
                        alt={nextUpcomingPreview.match.awayTeam.name}
                        size="sm"
                        fallbackCode={nextUpcomingPreview.match.awayTeam.code}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <OfficialLogo
                        src={nextUpcomingPreview.f1.weekend.countryFlagUrl}
                        alt={
                          nextUpcomingPreview.f1.weekend.countryName ||
                          nextUpcomingPreview.f1.weekend.hostName ||
                          nextUpcomingPreview.f1.weekend.city
                        }
                        shape="Flag"
                        size="xs"
                      />
                      <span className="text-sm font-bold text-[#F8FAFC] truncate">
                        {nextUpcomingPreview.f1.weekend.grandPrixName}
                      </span>
                    </div>
                    <div className="text-xs text-[#E10600] font-semibold tabular-nums">
                      {nextUpcomingPreview.f1.session.name} •{' '}
                      {formatSimpleCardTime(
                        nextUpcomingPreview.f1.session.startTimeISO
                      )}
                    </div>
                  </div>
                  <WhiteTrackMap
                    circuitId={nextUpcomingPreview.f1.weekend.circuitSvgId}
                    hostName={nextUpcomingPreview.f1.weekend.hostName}
                    className="w-20 h-12 shrink-0"
                  />
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* SECTION 1: LATEST VERIFIED FOOTBALL TELEMETRY & FULL-TIME RESULTS (FINAL) */}
      {showFootballSection && (
        <section
          className="px-4 space-y-2.5"
          aria-label="Verified Completed Football Match Telemetry"
        >
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[#8E95A5]">
              Recent Football Match Center (FINAL)
            </h2>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setFootballFeedFilter('FOLLOWED')}
                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                  footballFeedFilter === 'FOLLOWED'
                    ? 'bg-emerald-500/20 border border-emerald-400/50 text-emerald-300'
                    : 'bg-[#121316] border border-[#1E2028] text-[#8E95A5] hover:text-[#F8FAFC]'
                }`}
              >
                My Favorites
              </button>
              <button
                type="button"
                onClick={() => setFootballFeedFilter('ALL')}
                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                  footballFeedFilter === 'ALL'
                    ? 'bg-[#F8FAFC] text-[#0A0A0C]'
                    : 'bg-[#121316] border border-[#1E2028] text-[#8E95A5] hover:text-[#F8FAFC]'
                }`}
              >
                All Recent
              </button>
            </div>
          </div>

          {/* Match Selector Badges */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
            {displayedFootballFeeds.map((feed) => {
              const isSelected = feed.id === activeFootball.id;
              return (
                <button
                  key={feed.id}
                  type="button"
                  onClick={() => setSelectedFootballId(feed.id)}
                  className={`min-h-[32px] px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-colors ${
                    isSelected
                      ? 'bg-[#F8FAFC] text-[#0A0A0C] font-bold'
                      : 'bg-[#121316] text-[#8E95A5] border border-[#1E2028] hover:text-[#F8FAFC]'
                  }`}
                >
                  <OfficialLogo
                    src={feed.homeTeam.logo}
                    alt={feed.homeTeam.code}
                    size="xs"
                    fallbackCode={feed.homeTeam.code}
                  />
                  <span className="tabular-nums">
                    {feed.homeTeam.code}{' '}
                    {isFootballMasked
                      ? '• - •'
                      : `${feed.homeTeam.score}-${feed.awayTeam.score}`}{' '}
                    {feed.awayTeam.code}
                  </span>
                  <OfficialLogo
                    src={feed.awayTeam.logo}
                    alt={feed.awayTeam.code}
                    size="xs"
                    fallbackCode={feed.awayTeam.code}
                  />
                </button>
              );
            })}
          </div>

          <div className="rounded-xl border border-[#1E2028] bg-[#121316] overflow-hidden">
            {/* Competition & Official FINAL Status Header */}
            <div className="px-4 py-2.5 border-b border-[#1E2028] bg-[#181A20]/70 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <OfficialLogo
                  src={activeFootball.competitionLogo}
                  alt={activeFootball.competition}
                  size="xs"
                />
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-[#F8FAFC] truncate">
                    {activeFootball.competition}
                  </div>
                  <div className="text-[11px] text-[#8E95A5] truncate">
                    {activeFootball.stage}
                  </div>
                </div>
              </div>

              <span
                data-testid="football-status-badge"
                className="px-2.5 py-0.5 rounded-md bg-[#181A20] border border-[#1E2028] text-[#F8FAFC] text-[11px] font-bold tabular-nums shrink-0"
              >
                FINAL • FT
              </span>
            </div>

            {/* 3-Column Scoreboard */}
            <div className="p-4 space-y-3.5">
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                {/* Home Team */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <OfficialLogo
                    src={activeFootball.homeTeam.logo}
                    alt={activeFootball.homeTeam.name}
                    size="md"
                    fallbackCode={activeFootball.homeTeam.code}
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-[#F8FAFC] truncate">
                      {activeFootball.homeTeam.name}
                    </div>
                    <div className="text-[11px] text-[#8E95A5]">
                      {activeFootball.homeTeam.code}
                    </div>
                  </div>
                </div>

                {/* Center Scoreline */}
                {isFootballMasked ? (
                  <button
                    type="button"
                    onClick={() => setRevealFootballScore(true)}
                    className="px-3 py-1.5 rounded-lg border border-amber-400/50 bg-amber-500/10 text-amber-300 text-xs font-bold flex items-center gap-1.5"
                  >
                    <Eye className="w-3.5 h-3.5 stroke-[1.5]" />
                    <span>Reveal</span>
                  </button>
                ) : (
                  <div className="px-3.5 py-1.5 rounded-lg bg-[#181A20] border border-[#1E2028] tabular-nums text-xl font-bold text-[#F8FAFC] whitespace-nowrap">
                    {activeFootball.homeTeam.score} –{' '}
                    {activeFootball.awayTeam.score}
                  </div>
                )}

                {/* Away Team */}
                <div className="flex items-center justify-end gap-2.5 min-w-0 text-right">
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-[#F8FAFC] truncate">
                      {activeFootball.awayTeam.name}
                    </div>
                    <div className="text-[11px] text-[#8E95A5]">
                      {activeFootball.awayTeam.code}
                    </div>
                  </div>
                  <OfficialLogo
                    src={activeFootball.awayTeam.logo}
                    alt={activeFootball.awayTeam.name}
                    size="md"
                    fallbackCode={activeFootball.awayTeam.code}
                  />
                </div>
              </div>

              {/* Goal Scorers (Tappable Player Names) */}
              {!isFootballMasked && (
                <div className="grid grid-cols-2 gap-2 pt-2.5 border-t border-[#1E2028] text-xs">
                  <div className="space-y-1">
                    {activeFootball.homeTeam.scorers.map((s, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSelectPlayer(s.playerId)}
                        className="flex items-center gap-1.5 text-left font-medium text-[#F8FAFC] hover:text-emerald-400 transition-colors"
                      >
                        <span className="tabular-nums text-[11px] text-emerald-400 font-bold">
                          {s.minute}
                        </span>
                        <span className="underline decoration-dotted underline-offset-2">
                          {s.playerName}
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className="space-y-1 flex flex-col items-end">
                    {activeFootball.awayTeam.scorers.map((s, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSelectPlayer(s.playerId)}
                        className="flex items-center gap-1.5 text-right font-medium text-[#F8FAFC] hover:text-emerald-400 transition-colors"
                      >
                        <span className="underline decoration-dotted underline-offset-2">
                          {s.playerName}
                        </span>
                        <span className="tabular-nums text-[11px] text-emerald-400 font-bold">
                          {s.minute}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Match Telemetry (xG, Possession, Shots) */}
              <div className="space-y-2.5 pt-2.5 border-t border-[#1E2028]">
                <div className="space-y-1">
                  <div className="flex items-center justify-between tabular-nums text-xs">
                    <span className="font-bold text-emerald-400">
                      {activeFootball.homeTeam.xG}
                    </span>
                    <span className="text-[11px] text-[#8E95A5]">
                      Expected Goals (xG)
                    </span>
                    <span className="font-bold text-[#F8FAFC]">
                      {activeFootball.awayTeam.xG}
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-md bg-[#181A20] overflow-hidden flex">
                    <div
                      className="h-full bg-emerald-400"
                      style={{ width: `${homeXgPct}%` }}
                    />
                    <div
                      className="h-full bg-[#E10600]"
                      style={{ width: `${100 - homeXgPct}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-1 text-center tabular-nums">
                  <div className="p-2 rounded-lg bg-[#181A20] border border-[#1E2028]">
                    <div className="text-[10px] text-[#8E95A5]">Possession</div>
                    <div className="text-xs font-bold text-[#F8FAFC]">
                      {activeFootball.homeTeam.possession}% –{' '}
                      {activeFootball.awayTeam.possession}%
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-[#181A20] border border-[#1E2028]">
                    <div className="text-[10px] text-[#8E95A5]">Shots (OT)</div>
                    <div className="text-xs font-bold text-[#F8FAFC]">
                      {activeFootball.homeTeam.shots}(
                      {activeFootball.homeTeam.shotsOnTarget}) –{' '}
                      {activeFootball.awayTeam.shots}(
                      {activeFootball.awayTeam.shotsOnTarget})
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-[#181A20] border border-[#1E2028]">
                    <div className="text-[10px] text-[#8E95A5]">Corners</div>
                    <div className="text-xs font-bold text-[#F8FAFC]">
                      {activeFootball.homeTeam.corners} –{' '}
                      {activeFootball.awayTeam.corners}
                    </div>
                  </div>
                </div>
              </div>

              {/* Tappable Key Players Strip */}
              <div className="pt-2.5 border-t border-[#1E2028] space-y-2">
                <div className="text-[11px] font-semibold text-[#8E95A5] flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Key Players (Tap for Match Stats)</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {activeFootball.keyPlayers.map((player) => (
                    <button
                      key={player.id}
                      type="button"
                      onClick={() => handleSelectPlayer(player.id)}
                      aria-label={`View player statistics for ${player.name}`}
                      className="p-2.5 rounded-xl border border-[#1E2028] bg-[#181A20] hover:border-emerald-400/50 flex items-center justify-between gap-2 text-left transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <OfficialLogo
                          src={player.teamLogo}
                          alt={player.teamName}
                          size="xs"
                          fallbackCode={player.teamCode}
                        />
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-[#F8FAFC] truncate">
                            {player.name}
                          </div>
                          <div className="text-[10px] text-[#8E95A5] tabular-nums">
                            #{player.shirtNumber} • {player.passesCompleted}/
                            {player.passesAttempted} Pass
                          </div>
                        </div>
                      </div>
                      <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 tabular-nums text-[11px] font-bold shrink-0">
                        {player.rating}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Match Events & Commentary */}
              <div className="pt-2.5 border-t border-[#1E2028] space-y-1.5">
                <div className="text-[11px] font-semibold text-[#8E95A5] flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Match Timeline</span>
                </div>
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {activeFootball.commentary.map((item) => (
                    <div
                      key={item.id}
                      className="p-2.5 rounded-lg bg-[#181A20] border border-[#1E2028] text-xs flex items-start gap-2"
                    >
                      <span className="tabular-nums font-bold text-emerald-400 shrink-0">
                        {item.minute}
                      </span>
                      <div className="space-y-0.5 min-w-0">
                        <p className="text-[#F8FAFC] leading-snug">{item.text}</p>
                        {item.playerId && item.playerName && (
                          <button
                            type="button"
                            onClick={() => handleSelectPlayer(item.playerId!)}
                            className="text-[11px] text-emerald-400 font-semibold hover:underline"
                          >
                            View {item.playerName} Stats →
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* SECTION 2: FORMULA 1 OFFICIAL RACE & SESSION CLASSIFICATION (TIMING TOWER) */}
      {showF1Section && (
        <section
          className="px-4 space-y-2.5"
          aria-label="Official Formula 1 Telemetry Classification"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[#8E95A5]">
              Official F1 Race &amp; Session Results
            </h2>
            <span className="text-[11px] text-[#8E95A5]">
              Touch any race &amp; session for results
            </span>
          </div>

          {/* F1 Grand Prix Feed Selector (Includes Active/Recently Completed Weekend + Completed Grand Prix Feeds) */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
            {enrichedF1Weekends
              .filter((w) =>
                w.sessions.some(
                  (s) =>
                    evaluateF1SessionRuntimeStatus(s) === 'COMPLETED' ||
                    s.status === 'COMPLETED'
                )
              )
              .sort((a, b) => b.round - a.round)
              .map((wknd) => {
                const isSelected = selectedF1Id === wknd.id;
                return (
                  <button
                    key={wknd.id}
                    type="button"
                    data-testid={`live-f1-race-selector-${wknd.id}`}
                    onClick={() => {
                      setSelectedF1Id(wknd.id);
                      const doneSessions = wknd.sessions.filter(
                        (s) =>
                          wknd.status === 'COMPLETED' ||
                          evaluateF1SessionRuntimeStatus(s) === 'COMPLETED'
                      );
                      setSelectedF1SessionId(
                        doneSessions[doneSessions.length - 1]?.id || null
                      );
                    }}
                    className={`min-h-[32px] px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-colors ${
                      isSelected
                        ? 'bg-[#E10600] text-[#F8FAFC] font-bold'
                        : 'bg-[#121316] text-[#8E95A5] border border-[#1E2028] hover:text-[#F8FAFC]'
                    }`}
                  >
                    <OfficialLogo
                      src={wknd.countryFlagUrl}
                      alt={wknd.grandPrixName}
                      shape="Flag"
                      size="xs"
                    />
                    <span>{wknd.grandPrixName}</span>
                  </button>
                );
              })}
            {LIVE_F1_FEEDS.map((feed) => {
              const isSelected = selectedF1Id === feed.id;
              return (
                <button
                  key={feed.id}
                  type="button"
                  onClick={() => {
                    setSelectedF1Id(feed.id);
                    setSelectedF1SessionId(null);
                  }}
                  className={`min-h-[32px] px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-colors ${
                    isSelected
                      ? 'bg-[#E10600] text-[#F8FAFC] font-bold'
                      : 'bg-[#121316] text-[#8E95A5] border border-[#1E2028] hover:text-[#F8FAFC]'
                  }`}
                >
                  <OfficialLogo
                    src={feed.countryFlagUrl}
                    alt={feed.grandPrixName}
                    shape="Flag"
                    size="xs"
                  />
                  <span>{feed.grandPrixName}</span>
                </button>
              );
            })}
            {/* Also allow touching recent completed 2026 rounds to inspect all session results */}
            {F1_2026_FULL_SEASON.filter(
              (w) =>
                w.status === 'COMPLETED' &&
                !enrichedF1Weekends.some((ew) => ew.round === w.round) &&
                !LIVE_F1_FEEDS.some((f) =>
                  w.grandPrixName
                    .toLowerCase()
                    .includes(f.grandPrixName.toLowerCase().replace(' grand prix', ''))
                )
            )
              .slice(-4)
              .reverse()
              .map((wknd) => {
                const isSelected = selectedF1Id === wknd.id;
                return (
                  <button
                    key={wknd.id}
                    type="button"
                    data-testid={`live-f1-race-selector-${wknd.id}`}
                    onClick={() => {
                      setSelectedF1Id(wknd.id);
                      const doneSessions = wknd.sessions.filter(
                        (s) =>
                          wknd.status === 'COMPLETED' ||
                          evaluateF1SessionRuntimeStatus(s) === 'COMPLETED'
                      );
                      setSelectedF1SessionId(
                        doneSessions[doneSessions.length - 1]?.id || null
                      );
                    }}
                    className={`min-h-[32px] px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-colors ${
                      isSelected
                        ? 'bg-[#E10600] text-[#F8FAFC] font-bold'
                        : 'bg-[#121316] text-[#8E95A5] border border-[#1E2028] hover:text-[#F8FAFC]'
                    }`}
                  >
                    <OfficialLogo
                      src={wknd.countryFlagUrl}
                      alt={wknd.grandPrixName}
                      shape="Flag"
                      size="xs"
                    />
                    <span>{wknd.grandPrixName}</span>
                  </button>
                );
              })}
          </div>

          <div className="rounded-xl border border-[#1E2028] bg-[#121316] overflow-hidden">
            {/* F1 Session Header */}
            {(() => {
              const displayFlag =
                matchedF1Weekend?.countryFlagUrl || activeF1.countryFlagUrl;
              const displayGpName =
                matchedF1Weekend?.grandPrixName || activeF1.grandPrixName;
              const displayCircuitSvg =
                matchedF1Weekend?.circuitSvgId || activeF1.circuitSvgId;
              const isDedicatedLiveFeed = LIVE_F1_FEEDS.some(
                (f) => f.id === selectedF1Id
              );
              const doneWeekendSessions = matchedF1Weekend
                ? matchedF1Weekend.sessions.filter(
                    (s) =>
                      matchedF1Weekend.status === 'COMPLETED' ||
                      evaluateF1SessionRuntimeStatus(s) === 'COMPLETED'
                  )
                : [];
              const activeCustomSession =
                matchedF1Weekend?.sessions.find(
                  (s) => s.id === selectedF1SessionId
                ) ||
                (!isDedicatedLiveFeed && doneWeekendSessions.length > 0
                  ? doneWeekendSessions[doneWeekendSessions.length - 1]
                  : null);

              return (
                <>
                  <div className="p-4 border-b border-[#1E2028] bg-[#181A20]/70 space-y-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <OfficialLogo
                          src={F1_LOGOS.F1_MAIN}
                          alt="Formula 1"
                          size="xs"
                        />
                        <OfficialLogo
                          src={displayFlag}
                          alt={displayGpName}
                          shape="Flag"
                          size="sm"
                        />
                        <div className="min-w-0">
                          <h3 className="font-display text-base font-bold text-[#F8FAFC] truncate">
                            {displayGpName}
                          </h3>
                          <p className="text-xs text-[#8E95A5] truncate">
                            {activeCustomSession
                              ? `${activeCustomSession.name} • ${
                                  activeCustomSession.fastestOrWinnerSummary ||
                                  activeCustomSession.istDateLabel
                                }`
                              : activeF1.sessionName}
                          </p>
                        </div>
                      </div>

                      <WhiteTrackMap
                        circuitId={displayCircuitSvg}
                        hostName={displayGpName.replace(' Grand Prix', '')}
                        className="w-20 h-12 shrink-0"
                      />
                    </div>

                    <div className="flex items-center justify-between text-xs tabular-nums pt-1">
                      <span className="px-2.5 py-0.5 rounded-md bg-[#121316] border border-[#1E2028] font-bold text-[#F8FAFC]">
                        {activeCustomSession
                          ? `${activeCustomSession.name} • DONE`
                          : `FINAL • LAP ${activeF1.currentLap}/${activeF1.totalLaps}`}
                      </span>
                      <span className="text-[#8E95A5]">
                        Track {activeF1.trackTempC}°C • Air {activeF1.airTempC}°C
                      </span>
                    </div>

                    {/* Interactive Weekend Session Strip (FP1, FP2, FP3, Qualifying, Grand Prix) */}
                    {matchedF1Weekend && (
                      <div
                        data-testid="live-center-f1-session-tabs"
                        className="pt-2 border-t border-[#1E2028] space-y-1.5"
                      >
                        <div className="text-[10px] font-bold uppercase tracking-wider text-[#8E95A5]">
                          Weekend Sessions (DONE vs UPCOMING) — Touch Session For Results:
                        </div>
                        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                          {matchedF1Weekend.sessions.map((sess) => {
                            const isDone =
                              matchedF1Weekend.status === 'COMPLETED' ||
                              evaluateF1SessionRuntimeStatus(sess) ===
                                'COMPLETED';
                            const isSelectedSess =
                              activeCustomSession
                                ? activeCustomSession.id === sess.id
                                : !selectedF1SessionId &&
                                  sess.name === 'Grand Prix' &&
                                  isDedicatedLiveFeed;

                            return (
                              <button
                                key={sess.id}
                                type="button"
                                disabled={!isDone}
                                data-testid={`f1-live-session-tab-${sess.id}`}
                                onClick={() => {
                                  if (!isDone) return;
                                  if (
                                    sess.name === 'Grand Prix' &&
                                    isDedicatedLiveFeed
                                  ) {
                                    setSelectedF1SessionId(null);
                                  } else {
                                    setSelectedF1SessionId(sess.id);
                                  }
                                }}
                                className={`px-2.5 py-1.5 rounded-lg border text-left shrink-0 transition-colors ${
                                  isSelectedSess
                                    ? 'bg-[#E10600] border-[#E10600] text-[#F8FAFC]'
                                    : isDone
                                    ? 'bg-[#121316] border-emerald-500/40 text-[#F8FAFC] hover:border-emerald-400 cursor-pointer'
                                    : 'bg-[#0A0A0C]/60 border-[#1E2028] text-[#8E95A5] opacity-70 cursor-default'
                                }`}
                              >
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[11px] font-bold">
                                    {sess.name}
                                  </span>
                                  <span
                                    className={`px-1 py-0.2 rounded text-[9px] font-extrabold uppercase ${
                                      isSelectedSess
                                        ? 'bg-black/30 text-white'
                                        : isDone
                                        ? 'bg-emerald-500/20 text-emerald-300'
                                        : 'bg-[#181A20] text-[#8E95A5]'
                                    }`}
                                  >
                                    {isDone ? 'DONE' : 'UPCOMING'}
                                  </span>
                                </div>
                                {isSelectedSess && sess.fastestOrWinnerSummary && (
                                  <div className="text-[10px] tabular-nums mt-0.5 text-white/90 font-semibold">
                                    ⚡ {sess.fastestOrWinnerSummary}
                                  </div>
                                )}
                              </button>
                            );
                          })}

                          {matchedF1Weekend.startingGrid &&
                            matchedF1Weekend.startingGrid.length > 0 && (
                              <button
                                type="button"
                                data-testid="f1-live-session-tab-starting-grid"
                                onClick={() =>
                                  setSelectedF1SessionId((prev) =>
                                    prev === '__STARTING_GRID__'
                                      ? null
                                      : '__STARTING_GRID__'
                                  )
                                }
                                className={`px-2.5 py-1.5 rounded-lg border text-left shrink-0 transition-colors ${
                                  selectedF1SessionId === '__STARTING_GRID__'
                                    ? 'bg-amber-400 border-amber-400 text-[#0A0A0C] font-bold'
                                    : 'bg-amber-500/10 border-amber-500/40 text-amber-300 hover:border-amber-400 cursor-pointer'
                                }`}
                              >
                                <div className="flex items-center gap-1.5 whitespace-nowrap">
                                  <span className="text-[11px] font-extrabold">
                                    🏁 Starting Grid (After Penalties)
                                  </span>
                                </div>
                              </button>
                            )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Timing Tower Column Headers */}
                  <div className="px-4 py-2 bg-[#0A0A0C] border-b border-[#1E2028] flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[#8E95A5]">
                    <span>
                      {selectedF1SessionId === '__STARTING_GRID__'
                        ? 'STARTING GRID POS / DRIVER (AFTER PENALTIES)'
                        : 'POS / DRIVER'}
                    </span>
                    <div className="flex items-center gap-4">
                      <span>
                        {selectedF1SessionId === '__STARTING_GRID__'
                          ? 'QUALI → GRID'
                          : 'GAP / TIME'}
                      </span>
                      <span>
                        {selectedF1SessionId === '__STARTING_GRID__'
                          ? 'QUALI TIME'
                          : activeCustomSession
                          ? 'TYRE / LAPS'
                          : 'FINAL STINT TYRE'}
                      </span>
                    </div>
                  </div>

                  {/* Timing Tower Driver Rows */}
                  {isF1Masked ? (
                    <div className="p-6 text-center">
                      <button
                        type="button"
                        onClick={() => setRevealF1Order(true)}
                        className="px-4 py-2 rounded-xl border border-amber-400/50 bg-amber-500/10 text-amber-300 text-xs font-bold inline-flex items-center gap-2"
                      >
                        <Eye className="w-4 h-4 stroke-[1.5]" />
                        <span>
                          Avoid Spoilers Active • Tap to Reveal Classification
                        </span>
                      </button>
                    </div>
                  ) : selectedF1SessionId === '__STARTING_GRID__' &&
                    matchedF1Weekend?.startingGrid &&
                    matchedF1Weekend.startingGrid.length > 0 ? (
                    <div
                      data-testid="live-center-starting-grid-results"
                      className="divide-y divide-[#1E2028]"
                    >
                      {matchedF1Weekend.startingGrid.map((slot) => {
                        const careerProfile =
                          driverCareerCache[slot.driverCode] ||
                          getBaselineDriverCareerProfile(slot.driverCode);
                        return (
                          <button
                            key={`tower-grid-${slot.driverCode}`}
                            type="button"
                            onClick={() =>
                              handleSelectDriver(
                                `drv-${slot.driverCode.toLowerCase()}`,
                                slot.driverCode
                              )
                            }
                            className={`w-full px-4 py-2.5 flex items-center justify-between gap-2 hover:bg-[#181A20] transition-colors text-left overflow-hidden ${
                              slot.penaltyReason ? 'bg-amber-500/[0.06]' : ''
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1 overflow-hidden">
                              <span
                                className={`w-7 text-center tabular-nums text-[11px] font-extrabold rounded px-1 py-0.5 shrink-0 ${
                                  slot.isPitLaneStart
                                    ? 'bg-rose-500/20 text-rose-300'
                                    : slot.gridPos === 1
                                    ? 'bg-amber-400 text-[#0A0A0C]'
                                    : 'text-[#F8FAFC]'
                                }`}
                              >
                                {slot.isPitLaneStart ? 'PIT' : `P${slot.gridPos}`}
                              </span>
                              <span
                                className="w-1 h-8 rounded-full shrink-0"
                                style={{
                                  backgroundColor: slot.constructorColor,
                                }}
                              />
                              <F1DriverAvatar
                                src={careerProfile?.headshotUrl}
                                name={slot.driverName}
                                code={slot.driverCode}
                                teamColor={slot.constructorColor}
                                size="sm"
                              />
                              <div className="min-w-0 flex-1 overflow-hidden">
                                <div className="flex items-center gap-1.5 overflow-hidden">
                                  <span className="text-xs font-bold text-[#F8FAFC] truncate">
                                    {slot.driverName}
                                  </span>
                                </div>
                                <div className="text-[11px] text-[#8E95A5] truncate">
                                  {slot.penaltyReason ? (
                                    <span className="text-amber-300 font-semibold">
                                      ⚠️ {slot.penaltyReason}
                                    </span>
                                  ) : (
                                    slot.constructorName
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 shrink-0 tabular-nums whitespace-nowrap">
                              {(() => {
                                const qPos = slot.qualiPos ?? slot.gridPos;
                                const posDelta = qPos - slot.gridPos;
                                return (
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                      slot.penaltyApplied || posDelta < 0
                                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                        : posDelta > 0
                                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                        : 'bg-[#181A20] text-[#8E95A5]'
                                    }`}
                                  >
                                    {posDelta < 0
                                      ? `Q${qPos} → P${slot.gridPos} (${posDelta})`
                                      : posDelta > 0
                                      ? `Q${qPos} → P${slot.gridPos} (+${posDelta})`
                                      : `Q${qPos} → P${slot.gridPos}`}
                                  </span>
                                );
                              })()}
                              <span className="text-xs font-bold text-[#F8FAFC] w-16 text-right">
                                {slot.qualiBestLapTime}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : activeCustomSession &&
                    activeCustomSession.sessionResults &&
                    activeCustomSession.sessionResults.length > 0 ? (
                    <div
                      data-testid={`live-center-custom-session-results-${activeCustomSession.id}`}
                      className="divide-y divide-[#1E2028]"
                    >
                      {activeCustomSession.sessionResults.map((entry) => {
                        const careerProfile =
                          driverCareerCache[entry.driverCode] ||
                          getBaselineDriverCareerProfile(entry.driverCode);
                        return (
                          <button
                            key={`${activeCustomSession.id}-${entry.pos}`}
                            type="button"
                            onClick={() =>
                              handleSelectDriver(
                                `drv-${entry.driverCode.toLowerCase()}`,
                                entry.driverCode
                              )
                            }
                            className="w-full px-4 py-2.5 flex items-center justify-between gap-2 hover:bg-[#181A20] transition-colors text-left"
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1 overflow-hidden">
                              <span className="w-5 tabular-nums text-xs font-bold text-[#8E95A5] shrink-0">
                                {entry.pos}
                              </span>
                              <span
                                className="w-1 h-8 rounded-full shrink-0"
                                style={{
                                  backgroundColor: entry.constructorColor,
                                }}
                              />
                              <F1DriverAvatar
                                src={careerProfile?.headshotUrl}
                                name={entry.driverName}
                                code={entry.driverCode}
                                teamColor={entry.constructorColor}
                                size="sm"
                              />
                              <div className="min-w-0 flex-1 overflow-hidden">
                                <div className="flex items-center gap-1.5 overflow-hidden">
                                  <span className="text-xs font-bold text-[#F8FAFC] truncate">
                                    {entry.driverName}
                                  </span>
                                  {entry.pos === 1 && (
                                    <span className="px-1.5 py-0.2 rounded-md bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[9px] font-bold shrink-0">
                                      P1
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5 text-[11px] text-[#8E95A5] tabular-nums truncate">
                                  <span className="truncate">
                                    {entry.constructorName}
                                  </span>
                                  <span className="shrink-0">•</span>
                                  <span className="shrink-0">
                                    {activeCustomSession.name}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              <div className="text-right tabular-nums">
                                <div
                                  className={`text-xs font-bold ${
                                    entry.statusText === 'DNF' ||
                                    entry.statusText === 'DNS' ||
                                    entry.statusText === 'DSQ' ||
                                    entry.timeOrGap === 'DNF' ||
                                    entry.timeOrGap === 'DNS' ||
                                    entry.timeOrGap === 'DSQ'
                                      ? 'text-rose-400'
                                      : entry.pos === 1
                                      ? 'text-emerald-400'
                                      : 'text-[#F8FAFC]'
                                  }`}
                                >
                                  {entry.timeOrGap}
                                </div>
                                {entry.tyreStints && entry.tyreStints.length > 1 ? (
                                  <div className="text-[10px] text-amber-300/90 font-semibold">
                                    {entry.tyreStints.join(' → ')} ({entry.lapsCompleted}L)
                                  </div>
                                ) : typeof entry.lapsCompleted === 'number' ? (
                                  <div className="text-[10px] text-[#8E95A5]">
                                    {entry.lapsCompleted} Laps
                                  </div>
                                ) : null}
                              </div>
                              {entry.tyreCompound && (
                                <TyreCompoundBadge
                                  compound={entry.tyreCompound}
                                  ageLaps={entry.lapsCompleted || 12}
                                />
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="divide-y divide-[#1E2028]">
                      {activeF1.drivers.map((drv) => {
                        const careerProfile =
                          driverCareerCache[drv.driverId] ||
                          driverCareerCache[drv.driverCode] ||
                          activeF1.driverCareerRegistry[drv.driverId] ||
                          getBaselineDriverCareerProfile(drv.driverCode);

                        return (
                          <button
                            key={drv.driverId}
                            type="button"
                            onClick={() =>
                              handleSelectDriver(drv.driverId, drv.driverCode)
                            }
                            aria-label={`View career statistics for ${drv.driverName}`}
                            className="w-full px-4 py-2.5 flex items-center justify-between gap-2 hover:bg-[#181A20] transition-colors text-left"
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1 overflow-hidden">
                              <span className="w-5 tabular-nums text-xs font-bold text-[#8E95A5] shrink-0">
                                {drv.position}
                              </span>

                              <span
                                className="w-1 h-8 rounded-full shrink-0"
                                style={{ backgroundColor: drv.constructorColor }}
                              />

                              <F1DriverAvatar
                                src={careerProfile?.headshotUrl}
                                name={drv.driverName}
                                code={drv.driverCode}
                                teamColor={drv.constructorColor}
                                size="sm"
                              />

                              <div className="min-w-0 flex-1 overflow-hidden">
                                <div className="flex items-center gap-1.5 overflow-hidden">
                                  <span className="text-xs font-bold text-[#F8FAFC] truncate">
                                    {drv.driverName}
                                  </span>
                                  {drv.hasFastestLap && (
                                    <span
                                      title="Fastest Lap"
                                      className="px-1.5 py-0.2 rounded-md bg-purple-500/25 border border-purple-400/40 text-purple-300 text-[9px] font-bold shrink-0"
                                    >
                                      FL
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5 text-[11px] text-[#8E95A5] tabular-nums truncate">
                                  <span className="truncate">
                                    {drv.constructorName}
                                  </span>
                                  <span className="shrink-0">•</span>
                                  <span className="shrink-0">
                                    Best {drv.bestLapTime}
                                  </span>
                                </div>
                                {drv.stintHistory && (
                                  <div
                                    data-testid={`driver-stint-history-${drv.driverCode}`}
                                    className="text-[10px] text-[#8E95A5] tabular-nums truncate mt-0.5"
                                  >
                                    Stints: {drv.stintHistory}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              <div className="text-right tabular-nums">
                                <div className="text-xs font-bold text-[#F8FAFC]">
                                  {drv.gapToLeader}
                                </div>
                                <div className="text-[10px] text-[#8E95A5]">
                                  {drv.interval}
                                </div>
                              </div>

                              <div
                                data-testid={`driver-last-stint-${drv.driverCode}`}
                                className="flex flex-col items-end gap-0.5"
                              >
                                <TyreCompoundBadge
                                  compound={drv.tyreCompound}
                                  ageLaps={drv.tyreAgeLaps}
                                />
                                {drv.lastStintRange && (
                                  <span className="text-[9px] font-semibold text-[#8E95A5] tabular-nums">
                                    {drv.lastStintRange}
                                  </span>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </section>
      )}

      {/* MODAL 1: FOOTBALL PLAYER STATISTICS MODAL */}
      {selectedPlayer && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${selectedPlayer.name} Match and Season Statistics`}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
        >
          <div className="w-full max-w-[430px] rounded-t-2xl sm:rounded-2xl border border-[#1E2028] bg-[#121316] text-[#F8FAFC] overflow-hidden shadow-2xl pb-[env(safe-area-inset-bottom)]">
            <div className="px-4 py-3.5 border-b border-[#1E2028] flex items-center justify-between gap-2 bg-[#181A20]">
              <div className="flex items-center gap-2.5 min-w-0">
                <OfficialLogo
                  src={selectedPlayer.teamLogo}
                  alt={selectedPlayer.teamName}
                  size="md"
                  fallbackCode={selectedPlayer.teamCode}
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-display text-lg font-bold text-[#F8FAFC] truncate">
                      {selectedPlayer.name}
                    </h3>
                    <span className="px-1.5 py-0.5 rounded-md bg-emerald-400 text-[#0A0A0C] tabular-nums text-xs font-bold">
                      {selectedPlayer.rating}
                    </span>
                  </div>
                  <div className="text-xs text-[#8E95A5]">
                    #{selectedPlayer.shirtNumber} • {selectedPlayer.teamName} (
                    {selectedPlayer.position})
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedPlayer(null)}
                aria-label="Close Player Statistics Modal"
                className="h-8 w-8 rounded-lg border border-[#1E2028] flex items-center justify-center text-[#8E95A5] hover:text-[#F8FAFC]"
              >
                <X className="w-4 h-4 stroke-[1.5]" />
              </button>
            </div>

            <div className="p-4 space-y-3.5">
              <div className="grid grid-cols-3 gap-2 text-center tabular-nums">
                <div className="p-3 rounded-xl bg-[#181A20] border border-[#1E2028]">
                  <div className="text-[10px] text-[#8E95A5] uppercase">
                    Goals
                  </div>
                  <div className="text-xl font-bold text-emerald-400">
                    {selectedPlayer.goals}
                  </div>
                  <div className="text-[10px] text-[#8E95A5]">
                    xG {selectedPlayer.xG}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#181A20] border border-[#1E2028]">
                  <div className="text-[10px] text-[#8E95A5] uppercase">
                    Assists
                  </div>
                  <div className="text-xl font-bold text-[#F8FAFC]">
                    {selectedPlayer.assists}
                  </div>
                  <div className="text-[10px] text-[#8E95A5]">
                    xA {selectedPlayer.xA}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#181A20] border border-[#1E2028]">
                  <div className="text-[10px] text-[#8E95A5] uppercase">
                    Passes
                  </div>
                  <div className="text-lg font-bold text-[#F8FAFC]">
                    {selectedPlayer.passesCompleted}/
                    {selectedPlayer.passesAttempted}
                  </div>
                  <div className="text-[10px] text-emerald-400">
                    {selectedPlayer.passAccuracy}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 tabular-nums text-xs">
                <div className="px-3 py-2.5 rounded-xl bg-[#181A20] border border-[#1E2028] flex items-center justify-between">
                  <span className="text-[#8E95A5]">Key Passes</span>
                  <span className="font-bold text-[#F8FAFC]">
                    {selectedPlayer.keyPasses}
                  </span>
                </div>
                <div className="px-3 py-2.5 rounded-xl bg-[#181A20] border border-[#1E2028] flex items-center justify-between">
                  <span className="text-[#8E95A5]">Shots on Target</span>
                  <span className="font-bold text-[#F8FAFC]">
                    {selectedPlayer.shotsOnTarget}
                  </span>
                </div>
                <div className="px-3 py-2.5 rounded-xl bg-[#181A20] border border-[#1E2028] flex items-center justify-between">
                  <span className="text-[#8E95A5]">Touches</span>
                  <span className="font-bold text-[#F8FAFC]">
                    {selectedPlayer.touches}
                  </span>
                </div>
                <div className="px-3 py-2.5 rounded-xl bg-[#181A20] border border-[#1E2028] flex items-center justify-between">
                  <span className="text-[#8E95A5]">Duels / Tackles</span>
                  <span className="font-bold text-[#F8FAFC]">
                    {selectedPlayer.duelsWon} / {selectedPlayer.tacklesWon}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#181A20] border border-[#1E2028] space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[#8E95A5] flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                    <span>2026 Season Totals</span>
                  </span>
                  <span className="font-bold text-[#F8FAFC] tabular-nums">
                    {selectedPlayer.seasonGoals} Goals •{' '}
                    {selectedPlayer.seasonAssists} Assists
                  </span>
                </div>
                <div className="text-[11px] text-[#8E95A5]">
                  <strong className="text-[#F8FAFC]">Tactical Zone: </strong>
                  {selectedPlayer.heatmapZone}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: OFFICIAL F1 APP DRIVER CAREER PROFILE MODAL */}
      <DriverCareerProfileModal
        driver={selectedDriver}
        isOnline={isOnline}
        onClose={() => setSelectedDriver(null)}
        onUpdateCachedDriver={onCacheDriverStats}
      />
    </div>
  );
};
