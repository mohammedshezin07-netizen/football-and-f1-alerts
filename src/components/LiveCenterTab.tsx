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
import { getBaselineDriverCareerProfile } from '../services/f1AutoSync';
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
}) => {
  const [sportViewMode, setSportViewMode] = useState<LiveSportViewMode>('ALL');
  const [selectedFootballId, setSelectedFootballId] = useState<string>(
    LIVE_FOOTBALL_FEEDS[0]?.id || liveFootball.id
  );
  const [selectedF1Id, setSelectedF1Id] = useState<string>(
    LIVE_F1_FEEDS[0]?.id || liveF1.id
  );

  const [revealFootballScore, setRevealFootballScore] = useState<boolean>(false);
  const [revealF1Order, setRevealF1Order] = useState<boolean>(false);

  const [selectedPlayer, setSelectedPlayer] =
    useState<FootballPlayerStats | null>(null);
  const [selectedDriver, setSelectedDriver] =
    useState<F1DriverCareerStats | null>(null);

  const activeFootball =
    LIVE_FOOTBALL_FEEDS.find((f) => f.id === selectedFootballId) || liveFootball;
  const activeF1 =
    selectedF1Id === liveF1.id
      ? liveF1
      : LIVE_F1_FEEDS.find((f) => f.id === selectedF1Id) || liveF1;

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
    const liveSessions = upcomingF1Weekends.flatMap((w) =>
      w.sessions.filter(
        (s) => evaluateF1SessionRuntimeStatus(s, nowMs) === 'LIVE'
      )
    );
    const liveWeekends = upcomingF1Weekends.filter(
      (w) => evaluateF1WeekendLiveStatus(w, nowMs) === 'LIVE'
    );
    return { liveMatches, liveSessions, liveWeekends };
  }, [upcomingMatches, upcomingF1Weekends]);

  const hasAnyLiveEventNow =
    genuinelyLiveEvents.liveMatches.length > 0 ||
    genuinelyLiveEvents.liveSessions.length > 0 ||
    genuinelyLiveEvents.liveWeekends.length > 0;

  // Find the single Next Upcoming Match / F1 Session for the preview card
  const nextUpcomingPreview = useMemo(() => {
    const nowMs = Date.now();
    const nextMatch = [...upcomingMatches]
      .filter((m) => Date.parse(m.startTimeISO) > nowMs)
      .sort(
        (a, b) => Date.parse(a.startTimeISO) - Date.parse(b.startTimeISO)
      )[0];

    const nextF1Session = upcomingF1Weekends
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
  }, [upcomingMatches, upcomingF1Weekends, sportViewMode]);

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
            const activeSess =
              liveSess ||
              nextUpcomingSess ||
              wknd.sessions[wknd.sessions.length - 1];
            return (
              <div
                key={wknd.id}
                data-testid="live-f1-weekend-banner"
                className="rounded-xl p-4 border border-[#E10600]/80 bg-gradient-to-br from-[#181A20] via-[#121316] to-[#2D0B0E] flex items-center justify-between gap-3 shadow-lg"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-[#E10600] text-[#F8FAFC] text-[10px] font-extrabold uppercase tracking-wider animate-pulse">
                      LIVE • RACE WEEKEND
                    </span>
                    <span className="text-[11px] font-semibold text-[#8E95A5] uppercase">
                      ROUND {wknd.round}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <OfficialLogo
                      src={wknd.countryFlagUrl}
                      alt={wknd.hostName || wknd.countryName || wknd.city}
                      shape="Flag"
                      size="xs"
                    />
                    <h2 className="font-display text-base font-extrabold text-[#F8FAFC] truncate">
                      {wknd.grandPrixName}
                    </h2>
                  </div>
                  {activeSess && (
                    <p className="text-xs text-[#F8FAFC] font-medium">
                      {liveSess
                        ? `Active Session: ${liveSess.name} (${liveSess.istTimeLabel})`
                        : `Weekend Live Through Grand Prix • Next: ${activeSess.name} (${activeSess.istDateLabel} • ${activeSess.istTimeLabel})`}
                    </p>
                  )}
                </div>

                <WhiteTrackMap
                  circuitId={wknd.circuitSvgId}
                  hostName={wknd.hostName || wknd.countryName || wknd.city}
                  className="w-20 h-14 shrink-0"
                />
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
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Next Upcoming Broadcast</span>
                </span>
                <span className="px-2 py-0.5 rounded-md bg-[#181A20] border border-[#1E2028] text-[#F8FAFC] font-semibold tabular-nums flex items-center gap-1">
                  <Clock className="w-3 h-3 text-amber-400" />
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
                  <div className="text-[11px] text-[#8E95A5] flex items-center justify-between">
                    <span>{nextUpcomingPreview.match.competition}</span>
                    <span>{nextUpcomingPreview.match.istDateLabel}</span>
                  </div>
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <OfficialLogo
                        src={nextUpcomingPreview.match.homeTeam.logo}
                        alt={nextUpcomingPreview.match.homeTeam.name}
                        size="sm"
                        fallbackCode={nextUpcomingPreview.match.homeTeam.code}
                      />
                      <span className="text-sm font-medium text-[#F8FAFC] truncate min-w-0">
                        {nextUpcomingPreview.match.homeTeam.name}
                      </span>
                    </div>

                    <div className="text-xs font-semibold text-[#F8FAFC] bg-[#181A20] border border-[#1E2028] px-2.5 py-1 rounded-md whitespace-nowrap tabular-nums">
                      {formatSimpleCardTime(
                        nextUpcomingPreview.match.startTimeISO
                      )}
                    </div>

                    <div className="flex items-center justify-end gap-2.5 min-w-0">
                      <span className="text-sm font-medium text-[#F8FAFC] truncate text-right min-w-0">
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
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[#8E95A5]">
              Recent Football Match Center (FINAL)
            </h2>
            <span className="text-[11px] text-[#8E95A5]">
              Tap player for stats
            </span>
          </div>

          {/* Match Selector Badges */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
            {LIVE_FOOTBALL_FEEDS.map((feed) => {
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

      {/* SECTION 2: FORMULA 1 OFFICIAL RACE CLASSIFICATION & TIMING TOWER (FINAL) */}
      {showF1Section && (
        <section
          className="px-4 space-y-2.5"
          aria-label="Official Formula 1 Telemetry Classification"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[#8E95A5]">
              Official F1 Race Classification (FINAL)
            </h2>
            <span className="text-[11px] text-[#8E95A5]">
              Tap driver for Career Profile
            </span>
          </div>

          {/* F1 Grand Prix Feed Selector */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
            {LIVE_F1_FEEDS.map((feed) => {
              const isSelected = feed.id === activeF1.id;
              return (
                <button
                  key={feed.id}
                  type="button"
                  onClick={() => setSelectedF1Id(feed.id)}
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
          </div>

          <div className="rounded-xl border border-[#1E2028] bg-[#121316] overflow-hidden">
            {/* F1 Session Header */}
            <div className="p-4 border-b border-[#1E2028] bg-[#181A20]/70 space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <OfficialLogo
                    src={F1_LOGOS.F1_MAIN}
                    alt="Formula 1"
                    size="xs"
                  />
                  <OfficialLogo
                    src={activeF1.countryFlagUrl}
                    alt={activeF1.grandPrixName}
                    shape="Flag"
                    size="sm"
                  />
                  <div className="min-w-0">
                    <h3 className="font-display text-base font-bold text-[#F8FAFC] truncate">
                      {activeF1.grandPrixName}
                    </h3>
                    <p className="text-xs text-[#8E95A5] truncate">
                      {activeF1.sessionName}
                    </p>
                  </div>
                </div>

                <WhiteTrackMap
                  circuitId={activeF1.circuitSvgId}
                  hostName={activeF1.grandPrixName.replace(' Grand Prix', '')}
                  className="w-20 h-12 shrink-0"
                />
              </div>

              <div className="flex items-center justify-between text-xs tabular-nums pt-1">
                <span className="px-2.5 py-0.5 rounded-md bg-[#121316] border border-[#1E2028] font-bold text-[#F8FAFC]">
                  FINAL • LAP {activeF1.currentLap}/{activeF1.totalLaps}
                </span>
                <span className="text-[#8E95A5]">
                  Track {activeF1.trackTempC}°C • Air {activeF1.airTempC}°C
                </span>
              </div>
            </div>

            {/* Timing Tower Column Headers */}
            <div className="px-4 py-2 bg-[#0A0A0C] border-b border-[#1E2028] flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[#8E95A5]">
              <span>POS / DRIVER</span>
              <div className="flex items-center gap-4">
                <span>GAP / TIME</span>
                <span>FINAL STINT TYRE</span>
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
                  <span>Avoid Spoilers Active • Tap to Reveal Classification</span>
                </button>
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
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-5 tabular-nums text-xs font-bold text-[#8E95A5]">
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

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-[#F8FAFC]">
                              {drv.driverName}
                            </span>
                            {drv.hasFastestLap && (
                              <span
                                title="Fastest Lap"
                                className="px-1.5 py-0.2 rounded-md bg-purple-500/25 border border-purple-400/40 text-purple-300 text-[9px] font-bold"
                              >
                                FL
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-[#8E95A5] tabular-nums">
                            <span>{drv.constructorName}</span>
                            <span>•</span>
                            <span>Best {drv.bestLapTime}</span>
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
