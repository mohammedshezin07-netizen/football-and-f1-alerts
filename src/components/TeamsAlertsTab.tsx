import React, { useState } from 'react';
import {
  AlertTriangle,
  Bell,
  BellRing,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Database,
  Download,
  ExternalLink,
  Flag,
  RefreshCw,
  RotateCcw,
  Shield,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import {
  ArmedAlarm,
  ClashDetectorSettings,
  ClashFilterMode,
  ClashTypeMode,
  F1Weekend,
  FootballMatch,
  PrefetchCacheEntry,
  TeamInfo,
} from '../types/sports';
import {
  calculateAlarmCountdown,
  generateGoogleCalendarUrl,
} from '../utils/scheduleLogic';
import { OfficialLogo } from './OfficialLogo';

type ExpandableSectionId =
  | 'FOOTBALL_CLUBS'
  | 'F1_CONSTRUCTORS'
  | 'EVENT_REMINDERS'
  | 'CLASH_DETECTOR'
  | 'DATA_SYNC'
  | 'CALENDAR_SYNC';

interface TeamsAlertsTabProps {
  allTeams: TeamInfo[];
  followedTeamCodes: string[];
  onToggleFollowTeam: (code: string) => void;
  armedAlarms: ArmedAlarm[];
  onRemoveAlarm: (id: string) => void;
  onTriggerTestAlarmOverlay: (alarm?: ArmedAlarm) => void;
  matches: FootballMatch[];
  f1Weekends: F1Weekend[];
  onExportAllFollowedICS: () => void;
  isOnline: boolean;
  logoCacheStatus: { cachedCount: number; totalCount: number };
  prefetchCache: Record<string, PrefetchCacheEntry>;
  cachedPlayerCount: number;
  cachedDriverCount: number;
  archiveCount: number;
  lastSyncedAtIST: string;
  onForceRefreshCache: () => void;
  clashSettings?: ClashDetectorSettings;
  onUpdateClashSettings?: (
    updater: (prev: ClashDetectorSettings) => ClashDetectorSettings
  ) => void;
}

export const TeamsAlertsTab: React.FC<TeamsAlertsTabProps> = ({
  allTeams,
  followedTeamCodes,
  onToggleFollowTeam,
  armedAlarms,
  onRemoveAlarm,
  onTriggerTestAlarmOverlay,
  matches,
  f1Weekends,
  onExportAllFollowedICS,
  isOnline,
  logoCacheStatus,
  prefetchCache,
  cachedPlayerCount,
  cachedDriverCount,
  archiveCount,
  lastSyncedAtIST,
  onForceRefreshCache,
  clashSettings,
  onUpdateClashSettings,
}) => {
  const [expandedSections, setExpandedSections] = useState<
    Record<ExpandableSectionId, boolean>
  >({
    FOOTBALL_CLUBS: false,
    F1_CONSTRUCTORS: false,
    EVENT_REMINDERS: false,
    CLASH_DETECTOR: false,
    DATA_SYNC: false,
    CALENDAR_SYNC: false,
  });
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  const toggleSection = (id: ExpandableSectionId) => {
    setExpandedSections((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const footballClubs = allTeams.filter((t) => t.sport === 'FOOTBALL');
  const f1Constructors = allTeams.filter((t) => t.sport === 'F1');

  const followedFootballCount = footballClubs.filter((c) =>
    followedTeamCodes.includes(c.code)
  ).length;
  const followedF1Count = f1Constructors.filter((c) =>
    followedTeamCodes.includes(c.code)
  ).length;

  const totalSessionsCount = f1Weekends.reduce(
    (acc, w) => acc + w.sessions.length,
    0
  );

  const upcomingOnlyMatches = matches.filter(
    (m) => m.liveStatus !== 'FINAL' && m.timeWindow !== 'PAST_RESULTS'
  );
  const nextPriorityMatch =
    upcomingOnlyMatches.find((m) =>
      followedTeamCodes.includes(m.homeTeam.code)
    ) ||
    upcomingOnlyMatches[0] ||
    matches[0];

  const gcalUrl = generateGoogleCalendarUrl({
    title: `${nextPriorityMatch.homeTeam.name} vs ${nextPriorityMatch.awayTeam.name} (${nextPriorityMatch.competition})`,
    description: `${nextPriorityMatch.competition} • Kickoff at ${nextPriorityMatch.istTimeLabel}`,
    location: `${nextPriorityMatch.venue}, ${nextPriorityMatch.city}`,
    startTimeISO: nextPriorityMatch.startTimeISO,
    durationMinutes: nextPriorityMatch.durationMinutes,
  });

  const handleForceRefresh = () => {
    onForceRefreshCache();
    setSyncFeedback('Schedules & standings updated in IST');
    window.setTimeout(() => setSyncFeedback(null), 4000);
  };

  const anyExpanded = Object.values(expandedSections).some(Boolean);

  return (
    <div className="pb-28 px-4 pt-3.5 space-y-3">
      {/* Compact Header Bar + Quick Refresh Button */}
      <div className="rounded-xl border border-[#1E2028] bg-[#121316] px-3.5 py-2.5 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h1 className="text-xs font-semibold uppercase tracking-wider text-[#F8FAFC] truncate">
              My Teams &amp; Alerts
            </h1>
          </div>
          <p className="text-[11px] text-[#8E95A5] truncate">
            Select a category below to customize preferences
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {anyExpanded && (
            <button
              type="button"
              onClick={() =>
                setExpandedSections({
                  FOOTBALL_CLUBS: false,
                  F1_CONSTRUCTORS: false,
                  EVENT_REMINDERS: false,
                  CLASH_DETECTOR: false,
                  DATA_SYNC: false,
                  CALENDAR_SYNC: false,
                })
              }
              className="min-h-[34px] px-2.5 py-1 rounded-lg border border-[#1E2028] bg-[#181A20] text-[11px] font-semibold text-[#8E95A5] hover:text-[#F8FAFC] transition-colors"
            >
              Collapse All
            </button>
          )}
          <button
            type="button"
            onClick={handleForceRefresh}
            data-testid="verify-sync-now-btn"
            className="min-h-[34px] px-3 py-1.5 rounded-lg bg-[#F8FAFC] text-[#0A0A0C] text-[11px] font-bold flex items-center gap-1.5 hover:bg-zinc-200 transition-colors shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5 stroke-[2]" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {syncFeedback && (
        <div
          role="status"
          data-testid="verify-sync-toast"
          className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-xs text-emerald-300 font-semibold flex items-center justify-center gap-1.5"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{syncFeedback}</span>
        </div>
      )}

      {/* COMPACT INDIVIDUAL OPTION BUTTONS GRID (2x3) */}
      <div
        className="grid grid-cols-2 gap-2"
        role="group"
        aria-label="My Teams and Alerts Options"
      >
        {/* Button 1: Football Clubs */}
        <button
          type="button"
          onClick={() => toggleSection('FOOTBALL_CLUBS')}
          aria-expanded={expandedSections.FOOTBALL_CLUBS}
          data-testid="toggle-football-clubs-btn"
          className={`min-h-[54px] px-3 py-2.5 rounded-xl border text-left flex items-center justify-between gap-2 transition-all ${
            expandedSections.FOOTBALL_CLUBS
              ? 'bg-emerald-500/15 border-emerald-400 text-[#F8FAFC]'
              : 'bg-[#121316] border-[#1E2028] text-[#F8FAFC] hover:bg-[#181A20]'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <Shield className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-[#F8FAFC] truncate">
                Football Clubs
              </div>
              <div className="text-[10px] text-emerald-400 font-semibold tabular-nums">
                {followedFootballCount}/{footballClubs.length} Followed
              </div>
            </div>
          </div>
          {expandedSections.FOOTBALL_CLUBS ? (
            <ChevronUp className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 text-[#8E95A5] shrink-0" />
          )}
        </button>

        {/* Button 2: F1 Constructors */}
        <button
          type="button"
          onClick={() => toggleSection('F1_CONSTRUCTORS')}
          aria-expanded={expandedSections.F1_CONSTRUCTORS}
          data-testid="toggle-f1-constructors-btn"
          className={`min-h-[54px] px-3 py-2.5 rounded-xl border text-left flex items-center justify-between gap-2 transition-all ${
            expandedSections.F1_CONSTRUCTORS
              ? 'bg-[#E10600]/15 border-[#E10600] text-[#F8FAFC]'
              : 'bg-[#121316] border-[#1E2028] text-[#F8FAFC] hover:bg-[#181A20]'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[#E10600]/15 border border-[#E10600]/30 flex items-center justify-center shrink-0">
              <Flag className="w-4 h-4 text-[#E10600]" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-[#F8FAFC] truncate">
                F1 Teams
              </div>
              <div className="text-[10px] text-[#8E95A5] font-semibold tabular-nums">
                {followedF1Count}/{f1Constructors.length} Followed
              </div>
            </div>
          </div>
          {expandedSections.F1_CONSTRUCTORS ? (
            <ChevronUp className="w-4 h-4 text-[#E10600] shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 text-[#8E95A5] shrink-0" />
          )}
        </button>

        {/* Button 3: Event Reminders */}
        <button
          type="button"
          onClick={() => toggleSection('EVENT_REMINDERS')}
          aria-expanded={expandedSections.EVENT_REMINDERS}
          data-testid="toggle-event-reminders-btn"
          className={`min-h-[54px] px-3 py-2.5 rounded-xl border text-left flex items-center justify-between gap-2 transition-all ${
            expandedSections.EVENT_REMINDERS
              ? 'bg-amber-400/15 border-amber-400 text-[#F8FAFC]'
              : 'bg-[#121316] border-[#1E2028] text-[#F8FAFC] hover:bg-[#181A20]'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-amber-400/15 border border-amber-400/30 flex items-center justify-center shrink-0">
              <Bell className="w-4 h-4 text-amber-400" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-[#F8FAFC] truncate">
                Reminders
              </div>
              <div className="text-[10px] text-amber-400 font-semibold tabular-nums">
                {armedAlarms.length} Active Alarm{armedAlarms.length === 1 ? '' : 's'}
              </div>
            </div>
          </div>
          {expandedSections.EVENT_REMINDERS ? (
            <ChevronUp className="w-4 h-4 text-amber-400 shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 text-[#8E95A5] shrink-0" />
          )}
        </button>

        {/* Button 4: Clash Detector */}
        {clashSettings && onUpdateClashSettings && (
          <button
            type="button"
            onClick={() => toggleSection('CLASH_DETECTOR')}
            aria-expanded={expandedSections.CLASH_DETECTOR}
            data-testid="toggle-clash-detector-btn"
            className={`min-h-[54px] px-3 py-2.5 rounded-xl border text-left flex items-center justify-between gap-2 transition-all ${
              expandedSections.CLASH_DETECTOR
                ? 'bg-amber-500/15 border-amber-400 text-[#F8FAFC]'
                : 'bg-[#121316] border-[#1E2028] text-[#F8FAFC] hover:bg-[#181A20]'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-[#F8FAFC] truncate">
                  Clash Detector
                </div>
                <div className="text-[10px] text-[#8E95A5] font-semibold truncate">
                  {clashSettings.enabled ? 'Active' : 'Paused'}
                </div>
              </div>
            </div>
            {expandedSections.CLASH_DETECTOR ? (
              <ChevronUp className="w-4 h-4 text-amber-400 shrink-0" />
            ) : (
              <ChevronDown className="w-4 h-4 text-[#8E95A5] shrink-0" />
            )}
          </button>
        )}

        {/* Button 5: Live Data Sync */}
        <button
          type="button"
          onClick={() => toggleSection('DATA_SYNC')}
          aria-expanded={expandedSections.DATA_SYNC}
          data-testid="toggle-data-sync-btn"
          className={`min-h-[54px] px-3 py-2.5 rounded-xl border text-left flex items-center justify-between gap-2 transition-all ${
            expandedSections.DATA_SYNC
              ? 'bg-emerald-500/15 border-emerald-400 text-[#F8FAFC]'
              : 'bg-[#121316] border-[#1E2028] text-[#F8FAFC] hover:bg-[#181A20]'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <Database className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-[#F8FAFC] truncate">
                Schedule Sync
              </div>
              <div className="text-[10px] text-[#8E95A5] font-semibold tabular-nums truncate">
                {matches.length + totalSessionsCount} Events
              </div>
            </div>
          </div>
          {expandedSections.DATA_SYNC ? (
            <ChevronUp className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 text-[#8E95A5] shrink-0" />
          )}
        </button>

        {/* Button 6: Calendar Export */}
        <button
          type="button"
          onClick={() => toggleSection('CALENDAR_SYNC')}
          aria-expanded={expandedSections.CALENDAR_SYNC}
          data-testid="toggle-calendar-sync-btn"
          className={`min-h-[54px] px-3 py-2.5 rounded-xl border text-left flex items-center justify-between gap-2 transition-all ${
            expandedSections.CALENDAR_SYNC
              ? 'bg-emerald-500/15 border-emerald-400 text-[#F8FAFC]'
              : 'bg-[#121316] border-[#1E2028] text-[#F8FAFC] hover:bg-[#181A20]'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <Calendar className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-[#F8FAFC] truncate">
                Calendar Sync
              </div>
              <div className="text-[10px] text-[#8E95A5] font-semibold truncate">
                .ICS &amp; Google Cal
              </div>
            </div>
          </div>
          {expandedSections.CALENDAR_SYNC ? (
            <ChevronUp className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 text-[#8E95A5] shrink-0" />
          )}
        </button>
      </div>

      {/* EXPANDED PANEL 1: FOLLOWED FOOTBALL CLUBS */}
      {expandedSections.FOOTBALL_CLUBS && (
        <section
          className="rounded-xl border border-[#1E2028] bg-[#121316] p-4 space-y-3"
          aria-label="Followed Football Clubs"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[#8E95A5]">
              Followed Football Clubs ({followedFootballCount}/
              {footballClubs.length})
            </h2>
            <span className="text-[11px] text-[#8E95A5]">Tap to toggle</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {footballClubs.map((club) => {
              const followed = followedTeamCodes.includes(club.code);
              return (
                <button
                  key={club.id}
                  type="button"
                  onClick={() => onToggleFollowTeam(club.code)}
                  aria-pressed={followed}
                  className={`min-h-[44px] p-2.5 rounded-xl border text-left flex items-center justify-between gap-1.5 transition-colors ${
                    followed
                      ? 'bg-emerald-500/15 border-emerald-400 text-[#F8FAFC]'
                      : 'bg-[#181A20] border-[#1E2028] text-[#8E95A5]'
                  }`}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <OfficialLogo
                      src={club.logoUrl}
                      alt={club.name}
                      size="xs"
                      fallbackCode={club.code}
                    />
                    <span className="text-xs font-bold truncate">
                      {club.code}
                    </span>
                  </div>
                  {followed && (
                    <Check className="w-3.5 h-3.5 stroke-[2] text-emerald-400 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* EXPANDED PANEL 2: FORMULA 1 CONSTRUCTORS */}
      {expandedSections.F1_CONSTRUCTORS && (
        <section
          className="rounded-xl border border-[#1E2028] bg-[#121316] p-4 space-y-3"
          aria-label="Followed Formula 1 Constructors"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[#8E95A5]">
              Formula 1 Constructors ({followedF1Count}/{f1Constructors.length})
            </h2>
            <span className="text-[11px] text-[#8E95A5]">Tap to toggle</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {f1Constructors.map((team) => {
              const followed = followedTeamCodes.includes(team.code);
              return (
                <button
                  key={team.id}
                  type="button"
                  onClick={() => onToggleFollowTeam(team.code)}
                  aria-pressed={followed}
                  className={`min-h-[44px] p-2.5 rounded-xl border text-left flex items-center justify-between gap-2 transition-colors ${
                    followed
                      ? 'bg-[#E10600]/15 border-[#E10600] text-[#F8FAFC]'
                      : 'bg-[#181A20] border-[#1E2028] text-[#8E95A5]'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <OfficialLogo
                      src={team.logoUrl}
                      alt={team.name}
                      size="xs"
                      fallbackCode={team.code}
                    />
                    <span className="text-xs font-bold truncate">
                      {team.shortName}
                    </span>
                  </div>
                  {followed && (
                    <Check className="w-3.5 h-3.5 stroke-[2] text-[#E10600] shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* EXPANDED PANEL 3: ACTIVE EVENT REMINDERS */}
      {expandedSections.EVENT_REMINDERS && (
        <section
          className="rounded-xl border border-[#1E2028] bg-[#121316] overflow-hidden"
          aria-label="Active Event Reminders"
        >
          <div className="px-4 py-3 border-b border-[#1E2028] bg-[#181A20] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-amber-400" />
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[#F8FAFC]">
                Event Reminders ({armedAlarms.length})
              </h2>
            </div>

            {armedAlarms.length > 0 && (
              <button
                type="button"
                onClick={() => onTriggerTestAlarmOverlay(armedAlarms[0])}
                className="px-2.5 py-1 rounded-md bg-amber-400 text-black text-[11px] font-bold flex items-center gap-1"
              >
                <BellRing className="w-3 h-3 stroke-[2]" />
                <span>Preview Tone</span>
              </button>
            )}
          </div>

          <div className="divide-y divide-[#1E2028]">
            {armedAlarms.length === 0 ? (
              <div className="p-4 text-center text-xs text-[#8E95A5]">
                No reminders set. Tap any match or Grand Prix card in the
                Schedule to set a Samsung Clock reminder.
              </div>
            ) : (
              armedAlarms.map((alarm) => {
                const countdown = calculateAlarmCountdown(alarm, Date.now());
                return (
                  <div
                    key={alarm.id}
                    className="p-3.5 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold ${
                            alarm.sport === 'FOOTBALL'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-[#E10600]/20 text-[#E10600]'
                          }`}
                        >
                          {alarm.sport}
                        </span>
                        <span className="text-xs font-bold text-[#F8FAFC] truncate">
                          {alarm.title}
                        </span>
                      </div>
                      <div className="text-xs text-[#8E95A5] truncate">
                        {alarm.customLabel} •{' '}
                        {alarm.leadTimeMinutes === 0
                          ? 'At Start'
                          : `${alarm.leadTimeMinutes}m Before`}
                      </div>
                      <div className="tabular-nums text-[11px] text-amber-400 font-semibold">
                        {alarm.istTimeLabel} • Starts in{' '}
                        {countdown.formattedCountdown}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onRemoveAlarm(alarm.id)}
                      aria-label={`Delete alarm ${alarm.title}`}
                      className="h-9 w-9 rounded-lg border border-[#1E2028] flex items-center justify-center text-[#8E95A5] hover:text-[#E10600] shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5 stroke-[1.5]" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </section>
      )}

      {/* EXPANDED PANEL 4: CLASH DETECTOR MANAGEMENT */}
      {expandedSections.CLASH_DETECTOR &&
        clashSettings &&
        onUpdateClashSettings && (
          <section
            data-testid="teams-clash-detector-management"
            className="rounded-xl border border-[#1E2028] bg-[#121316] p-4 space-y-3"
            aria-label="Clash Detector Management"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <h2 className="text-xs font-semibold uppercase tracking-wider text-[#F8FAFC]">
                  Clash Detector Preferences
                </h2>
              </div>
              <button
                type="button"
                onClick={() =>
                  onUpdateClashSettings((prev) => ({
                    ...prev,
                    enabled: !prev.enabled,
                  }))
                }
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${
                  clashSettings.enabled
                    ? 'bg-emerald-400 text-black'
                    : 'bg-[#181A20] text-[#8E95A5] border border-[#1E2028]'
                }`}
              >
                {clashSettings.enabled ? 'ENABLED' : 'PAUSED'}
              </button>
            </div>

            <p className="text-xs text-[#8E95A5]">
              Detect simultaneous overlaps between your favorite Football
              matches and Formula 1 sessions.
            </p>

            {/* Collision Type Mode Selector */}
            <div className="space-y-2 pt-1">
              <div className="text-xs font-semibold uppercase tracking-wider text-[#8E95A5] flex items-center gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
                <span>Collision Type</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
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
                  const currentType =
                    clashSettings.clashTypeMode || 'ALL_CLASHES';
                  const active = currentType === ct.id;
                  return (
                    <button
                      key={ct.id}
                      type="button"
                      onClick={() =>
                        onUpdateClashSettings((prev) => ({
                          ...prev,
                          enabled: true,
                          clashTypeMode: ct.id,
                        }))
                      }
                      className={`py-2 px-2 rounded-lg text-[11px] font-semibold transition-colors ${
                        active
                          ? 'bg-amber-400 text-black font-bold'
                          : 'bg-[#181A20] text-[#8E95A5] border border-[#1E2028]'
                      }`}
                    >
                      {ct.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Club Filter Scope */}
            <div className="space-y-2 pt-1">
              <div className="text-xs font-semibold uppercase tracking-wider text-[#8E95A5] flex items-center gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-400" />
                <span>Monitored Clubs</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {(
                  [
                    {
                      id: 'FOLLOWED_ONLY' as ClashFilterMode,
                      label: 'My Favorites',
                    },
                    {
                      id: 'MCI_SAN_ONLY' as ClashFilterMode,
                      label: 'MCI, Santos & KBFC',
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
                ).map((m) => {
                  const active = clashSettings.filterMode === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() =>
                        onUpdateClashSettings((prev) => ({
                          ...prev,
                          enabled: true,
                          filterMode: m.id,
                        }))
                      }
                      className={`py-2 px-2 rounded-lg text-[11px] font-semibold transition-colors ${
                        active
                          ? 'bg-emerald-400 text-black font-bold'
                          : 'bg-[#181A20] text-[#8E95A5] border border-[#1E2028]'
                      }`}
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {clashSettings.filterMode === 'CUSTOM_TEAMS' && (
              <div className="p-2.5 rounded-xl bg-[#181A20] border border-[#1E2028] space-y-2">
                <div className="text-[11px] font-semibold text-[#F8FAFC]">
                  Select Custom Clubs for Clash Detection:
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {footballClubs.map((club) => {
                    const currentCustom = clashSettings.customTeamCodes || [];
                    const selected = currentCustom.includes(club.code);
                    return (
                      <button
                        key={club.code}
                        type="button"
                        onClick={() =>
                          onUpdateClashSettings((prev) => {
                            const prevCodes = prev.customTeamCodes || [];
                            const exists = prevCodes.includes(club.code);
                            const nextCodes = exists
                              ? prevCodes.filter((c) => c !== club.code)
                              : [...prevCodes, club.code];
                            return {
                              ...prev,
                              customTeamCodes:
                                nextCodes.length > 0 ? nextCodes : [club.code],
                            };
                          })
                        }
                        className={`px-2 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1 border ${
                          selected
                            ? 'bg-amber-400/20 border-amber-400 text-[#F8FAFC] font-bold'
                            : 'bg-[#121316] border-[#1E2028] text-[#8E95A5]'
                        }`}
                      >
                        <span>{club.code}</span>
                        {selected && (
                          <Check className="w-3 h-3 text-amber-400" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() =>
                  onUpdateClashSettings((prev) => ({
                    ...prev,
                    keySessionsOnly: !prev.keySessionsOnly,
                  }))
                }
                className={`p-2.5 rounded-xl border text-left text-xs transition-colors ${
                  clashSettings.keySessionsOnly
                    ? 'bg-amber-400/15 border-amber-400 text-[#F8FAFC] font-semibold'
                    : 'bg-[#181A20] border-[#1E2028] text-[#8E95A5]'
                }`}
              >
                <div className="text-[10px] text-[#8E95A5] uppercase">
                  F1 Sessions
                </div>
                <div className="font-bold mt-0.5 text-[#F8FAFC]">
                  {clashSettings.keySessionsOnly
                    ? 'Quali / Sprint / Race'
                    : 'All Sessions'}
                </div>
              </button>

              <button
                type="button"
                onClick={() =>
                  onUpdateClashSettings((prev) => ({
                    ...prev,
                    bufferMinutes:
                      prev.bufferMinutes === 0
                        ? 15
                        : prev.bufferMinutes === 15
                        ? 30
                        : 0,
                  }))
                }
                className="p-2.5 rounded-xl border border-[#1E2028] bg-[#181A20] text-left text-xs text-[#F8FAFC]"
              >
                <div className="text-[10px] text-[#8E95A5] uppercase">
                  Overlap Buffer
                </div>
                <div className="font-bold mt-0.5 text-amber-400 tabular-nums">
                  {clashSettings.bufferMinutes === 0
                    ? 'Exact Window (0m)'
                    : `+${clashSettings.bufferMinutes} Mins Buffer`}
                </div>
              </button>
            </div>

            {clashSettings.dismissedClashIds.length > 0 && (
              <div className="flex items-center justify-between pt-2 border-t border-[#1E2028] text-xs">
                <span className="text-[#8E95A5]">
                  {clashSettings.dismissedClashIds.length} dismissed clash(es)
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateClashSettings((prev) => ({
                      ...prev,
                      dismissedClashIds: [],
                    }))
                  }
                  className="px-2.5 py-1 rounded-md bg-[#181A20] text-amber-400 border border-amber-400/30 text-[11px] font-semibold flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Restore Dismissed</span>
                </button>
              </div>
            )}
          </section>
        )}

      {/* EXPANDED PANEL 5: SCHEDULE & STANDINGS SYNC */}
      {expandedSections.DATA_SYNC && (
        <section
          className="rounded-xl border border-[#1E2028] bg-[#121316] p-4 space-y-3"
          aria-label="Schedule and Standings Sync"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-400" />
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[#F8FAFC]">
                Schedule &amp; Standings Sync
              </h2>
            </div>
            <span className="text-[11px] text-[#8E95A5] tabular-nums">
              Updated {lastSyncedAtIST}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-[#181A20] border border-[#1E2028] space-y-1.5 text-xs tabular-nums text-[#8E95A5]">
            <div className="text-[#F8FAFC] font-semibold">
              {matches.length} Football Fixtures &amp; {f1Weekends.length}{' '}
              Formula 1 Weekends
            </div>
            <div className="text-[11px]">
              All kickoff times and track sessions are automatically displayed
              in Indian Standard Time (IST, UTC+5:30) and available offline.
            </div>
          </div>

          <button
            type="button"
            onClick={handleForceRefresh}
            className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-[#F8FAFC] text-[#0A0A0C] text-xs font-bold flex items-center justify-center gap-2 hover:bg-zinc-200 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5 stroke-[2]" />
            <span>Refresh Schedules &amp; Standings</span>
          </button>
        </section>
      )}

      {/* EXPANDED PANEL 6: PERSONALIZED CALENDAR EXPORT (.ICS & GOOGLE CALENDAR) */}
      {expandedSections.CALENDAR_SYNC && (
        <section
          className="rounded-xl border border-[#1E2028] bg-[#121316] p-4 space-y-3"
          aria-label="Calendar Synchronization"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-400" />
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[#F8FAFC]">
                Calendar Sync
              </h2>
            </div>
          </div>

          <p className="text-xs text-[#8E95A5] leading-relaxed">
            Export upcoming fixtures for your {followedTeamCodes.length}{' '}
            followed Football clubs and Formula 1 sessions to your device
            calendar.
          </p>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onExportAllFollowedICS}
              className="min-h-[44px] px-3 py-2 rounded-xl bg-emerald-400 text-black text-xs font-bold flex items-center justify-center gap-1.5 hover:opacity-95 transition-opacity whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5 stroke-[2]" />
              <span>Download .ICS</span>
            </button>

            <a
              href={gcalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[44px] px-3 py-2 rounded-xl border border-[#1E2028] bg-[#181A20] text-[#F8FAFC] text-xs font-semibold flex items-center justify-center gap-1.5 hover:border-white/25 transition-colors whitespace-nowrap"
            >
              <ExternalLink className="w-3.5 h-3.5 stroke-[1.5]" />
              <span>Google Calendar</span>
            </a>
          </div>
        </section>
      )}
    </div>
  );
};

