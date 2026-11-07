import React, { useEffect, useState } from 'react';
import {
  Award,
  Bell,
  BellRing,
  Check,
  Clock,
  MapPin,
  RefreshCw,
  Trophy,
  Volume2,
  X,
} from 'lucide-react';
import {
  AlarmLeadTime,
  AlarmSoundProfile,
  ArmedAlarm,
  F1DriverCareerStats,
} from '../types/sports';
import { calculateAlarmCountdown } from '../utils/scheduleLogic';
import { playAlarmAudio } from '../utils/soundEngine';
import { formatSimpleCardTime } from '../services/apiClient';
import { fetchLiveDriverCareerProfile } from '../services/f1AutoSync';
import { F1DriverAvatar } from './CircuitSvg';
import { OfficialLogo } from './OfficialLogo';

interface AlarmDrawerTarget {
  id: string;
  parentId?: string;
  sport: 'FOOTBALL' | 'F1';
  title: string;
  subtitle: string;
  eventStartTimeISO: string;
  istTimeLabel: string;
}

interface AlarmConfigDrawerProps {
  target: AlarmDrawerTarget | null;
  existingAlarm?: ArmedAlarm;
  onClose: () => void;
  onSaveAlarm: (alarm: ArmedAlarm) => void;
  onRemoveAlarm: (id: string) => void;
  onTriggerTestWakeUp: (alarm: ArmedAlarm) => void;
}

export const AlarmConfigDrawer: React.FC<AlarmConfigDrawerProps> = ({
  target,
  existingAlarm,
  onClose,
  onSaveAlarm,
  onRemoveAlarm,
  onTriggerTestWakeUp,
}) => {
  const [leadTime, setLeadTime] = useState<AlarmLeadTime>(
    existingAlarm?.leadTimeMinutes ?? 15
  );
  const [soundProfile, setSoundProfile] = useState<AlarmSoundProfile>(
    existingAlarm?.soundProfile ??
      (target?.sport === 'F1' ? 'F1_PIT_SIREN' : 'BROADCAST_CHIME')
  );
  const [customLabel, setCustomLabel] = useState<string>(
    existingAlarm?.customLabel ??
      (target?.sport === 'F1'
        ? 'Formation Lap & Pit Wall Telemetry Alert'
        : 'Starting XI Lineups & Kickoff Alert')
  );

  if (!target) return null;

  const countdown = calculateAlarmCountdown(
    {
      eventStartTimeISO: target.eventStartTimeISO,
      leadTimeMinutes: leadTime,
    },
    Date.now()
  );

  const simpleTime = formatSimpleCardTime(target.eventStartTimeISO);

  const buildDraftAlarm = (): ArmedAlarm => ({
    id: target.id,
    parentId: target.parentId,
    sport: target.sport,
    title: target.title,
    subtitle: target.subtitle,
    eventStartTimeISO: target.eventStartTimeISO,
    istTimeLabel: simpleTime,
    leadTimeMinutes: leadTime,
    soundProfile,
    customLabel: customLabel.trim() || target.title,
    createdAtISO: new Date().toISOString(),
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const alarm = buildDraftAlarm();
    playAlarmAudio(soundProfile);
    onSaveAlarm(alarm);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Configure Match or Session Alarm"
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      <div className="w-full max-w-[430px] rounded-t-2xl sm:rounded-xl border border-[#1E2028] bg-[#121316] text-[#F8FAFC] overflow-hidden shadow-2xl pb-[env(safe-area-inset-bottom)]">
        <div className="px-4 py-3.5 border-b border-[#1E2028] bg-[#181A20] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Bell className="w-4 h-4 stroke-[1.75] text-amber-400 shrink-0" />
            <div className="min-w-0">
              <h3 className="font-display text-base font-bold tracking-tight text-[#F8FAFC] truncate">
                Set Event Reminder
              </h3>
              <p className="text-xs text-[#8E95A5] truncate">{target.title}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Alarm Configuration Drawer"
            className="h-8 w-8 rounded-lg border border-[#1E2028] flex items-center justify-center text-[#8E95A5] hover:text-[#F8FAFC]"
          >
            <X className="w-4 h-4 stroke-[1.5]" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-4 space-y-4">
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between tabular-nums">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-400">
              <Clock className="w-4 h-4 stroke-[1.5]" />
              <span>Triggers in {countdown.formattedCountdown}</span>
            </div>
            <span className="text-xs text-[#F8FAFC] font-bold">{simpleTime}</span>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#8E95A5]">
              Alert Lead Time
            </label>
            <div className="space-y-1.5">
              {(
                [
                  {
                    value: 0 as AlarmLeadTime,
                    label: 'At Start Time',
                    desc: 'Kickoff / Lights Out whistle',
                  },
                  {
                    value: 15 as AlarmLeadTime,
                    label: '15 Minutes Before',
                    desc: 'Lineups / Formation Lap build-up',
                  },
                  {
                    value: 30 as AlarmLeadTime,
                    label: '30 Minutes Before',
                    desc: 'Early tactical preview & grid walk',
                  },
                ] as const
              ).map((opt) => {
                const selected = leadTime === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setLeadTime(opt.value)}
                    className={`w-full p-3 rounded-xl border text-left flex items-center justify-between transition-colors ${
                      selected
                        ? 'bg-amber-500/15 border-amber-400 text-[#F8FAFC]'
                        : 'bg-[#181A20] border-[#1E2028] text-[#8E95A5]'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-semibold text-[#F8FAFC]">
                        {opt.label}
                      </div>
                      <div className="text-[11px] text-[#8E95A5]">{opt.desc}</div>
                    </div>
                    {selected && (
                      <Check className="w-4 h-4 stroke-[2] text-amber-400" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#8E95A5]">
              Alert Tone
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  { id: 'BROADCAST_CHIME', label: 'Broadcast' },
                  { id: 'F1_PIT_SIREN', label: 'F1 Pit Siren' },
                  { id: 'SILENT_HAPTIC', label: 'Silent' },
                ] as const
              ).map((snd) => {
                const active = soundProfile === snd.id;
                return (
                  <button
                    key={snd.id}
                    type="button"
                    onClick={() => {
                      setSoundProfile(snd.id);
                      playAlarmAudio(snd.id);
                    }}
                    className={`min-h-[38px] px-2 py-1.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1 transition-colors ${
                      active
                        ? 'bg-[#F8FAFC] text-[#0A0A0C] border-[#F8FAFC]'
                        : 'bg-[#181A20] border-[#1E2028] text-[#F8FAFC]'
                    }`}
                  >
                    <Volume2 className="w-3.5 h-3.5 stroke-[1.5] shrink-0" />
                    <span className="truncate">{snd.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1">
            <label
              htmlFor="custom-alarm-label"
              className="block text-xs font-semibold uppercase tracking-wider text-[#8E95A5]"
            >
              Note
            </label>
            <input
              id="custom-alarm-label"
              type="text"
              value={customLabel}
              onChange={(e) => setCustomLabel(e.target.value)}
              className="w-full min-h-[38px] px-3 py-1.5 rounded-lg border border-[#1E2028] bg-[#181A20] text-xs text-[#F8FAFC] focus:outline-none focus:border-amber-400"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                const draft = buildDraftAlarm();
                playAlarmAudio(soundProfile);
                onTriggerTestWakeUp(draft);
              }}
              className="min-h-[42px] px-3 py-2 rounded-xl border border-amber-400/50 bg-amber-500/10 text-amber-300 text-xs font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              <BellRing className="w-3.5 h-3.5 stroke-[1.5]" />
              <span>Preview</span>
            </button>

            <button
              type="submit"
              className="flex-1 min-h-[42px] px-4 py-2 rounded-xl bg-[#F8FAFC] text-[#0A0A0C] text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-zinc-200 transition-colors"
            >
              <Bell className="w-3.5 h-3.5 stroke-[2]" />
              <span>
                {existingAlarm
                  ? 'Update & Sync Alarm'
                  : 'Save & Sync Alarm'}
              </span>
            </button>
          </div>

          {existingAlarm && (
            <button
              type="button"
              onClick={() => {
                onRemoveAlarm(target.id);
                onClose();
              }}
              className="w-full py-1.5 text-center text-xs text-[#E10600] font-semibold hover:underline"
            >
              Remove Reminder &amp; Delete Alarm
            </button>
          )}
        </form>
      </div>
    </div>
  );
};

interface WakeUpAlertOverlayProps {
  alarm: ArmedAlarm | null;
  onDismiss: () => void;
}

export const WakeUpAlertOverlay: React.FC<WakeUpAlertOverlayProps> = ({
  alarm,
  onDismiss,
}) => {
  if (!alarm) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label="Wake-Up and Kickoff Alert"
      className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
    >
      <div className="w-full max-w-[390px] rounded-xl border border-amber-400 bg-[#121316] p-5 text-center space-y-4 shadow-2xl">
        <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-400 flex items-center justify-center mx-auto text-amber-400">
          <BellRing className="w-6 h-6 stroke-[1.5] animate-bounce" />
        </div>

        <div className="space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-widest text-amber-400 tabular-nums">
            EVENT REMINDER • {alarm.istTimeLabel}
          </span>
          <h2 className="font-display text-xl font-bold tracking-tight text-[#F8FAFC]">
            {alarm.title}
          </h2>
          <p className="text-xs text-[#8E95A5]">{alarm.customLabel}</p>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-2">
          <button
            type="button"
            onClick={() => playAlarmAudio(alarm.soundProfile)}
            className="min-h-[42px] px-3 py-2 rounded-xl border border-[#1E2028] bg-[#181A20] text-[#F8FAFC] text-xs font-semibold"
          >
            Replay Tone
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="min-h-[42px] px-3 py-2 rounded-xl bg-amber-400 text-[#0A0A0C] text-xs font-bold"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};

interface PushBannerProps {
  banner: {
    sport: 'FOOTBALL' | 'F1';
    title: string;
    message: string;
    timestampIST: string;
  } | null;
  onDismiss: () => void;
}

export const InAppPushBanner: React.FC<PushBannerProps> = ({
  banner,
  onDismiss,
}) => {
  if (!banner) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-20 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-24px)] max-w-[406px]"
    >
      <div
        className={`rounded-xl border p-3 shadow-2xl bg-[#121316] flex items-start justify-between gap-2.5 ${
          banner.sport === 'FOOTBALL'
            ? 'border-emerald-500/60'
            : 'border-[#E10600]/70'
        }`}
      >
        <div className="space-y-0.5 min-w-0">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider">
            <span
              className={
                banner.sport === 'FOOTBALL'
                  ? 'text-emerald-400'
                  : 'text-[#E10600]'
              }
            >
              {banner.sport === 'FOOTBALL' ? 'FOOTBALL SYNC' : 'FORMULA 1 SYNC'}
            </span>
          </div>
          <div className="text-xs font-bold text-[#F8FAFC]">{banner.title}</div>
          <p className="text-xs text-[#8E95A5] leading-snug">{banner.message}</p>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss Notification Banner"
          className="p-1 text-[#8E95A5] hover:text-[#F8FAFC]"
        >
          <X className="w-4 h-4 stroke-[1.5]" />
        </button>
      </div>
    </div>
  );
};

interface DriverCareerProfileModalProps {
  driver: F1DriverCareerStats | null;
  isOnline: boolean;
  onClose: () => void;
  onUpdateCachedDriver?: (updated: F1DriverCareerStats) => void;
}

export const DriverCareerProfileModal: React.FC<DriverCareerProfileModalProps> = ({
  driver,
  isOnline,
  onClose,
  onUpdateCachedDriver,
}) => {
  const [liveStats, setLiveStats] = useState<F1DriverCareerStats | null>(driver);
  const [isSyncingCareer, setIsSyncingCareer] = useState<boolean>(false);

  useEffect(() => {
    setLiveStats(driver);
    if (!driver || !isOnline) return;

    let cancelled = false;
    setIsSyncingCareer(true);
    fetchLiveDriverCareerProfile(driver.code || driver.id)
      .then((fresh) => {
        if (!cancelled && fresh) {
          setLiveStats(fresh);
          onUpdateCachedDriver?.(fresh);
        }
      })
      .catch(() => {
        // Keep fallback
      })
      .finally(() => {
        if (!cancelled) setIsSyncingCareer(false);
      });

    return () => {
      cancelled = true;
    };
  }, [driver, isOnline, onUpdateCachedDriver]);

  if (!liveStats) return null;

  const isReserve =
    liveStats.rosterStatus === 'RESERVE' || liveStats.rosterStatus === 'FORMER';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${liveStats.name} Official F1 Driver Profile`}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      <div className="w-full max-w-[430px] max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-xl border border-[#1E2028] bg-[#121316] text-[#F8FAFC] shadow-2xl pb-[env(safe-area-inset-bottom)]">
        {/* Top Hero Banner with Team Accent Color, Stylized Number & Official Cutout Headshot */}
        <div
          className="relative px-4 pt-4 pb-3 border-b border-[#1E2028] overflow-hidden"
          style={{
            background: `linear-gradient(135deg, ${liveStats.constructorColor}33 0%, #121316 75%)`,
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <F1DriverAvatar
                headshotUrl={liveStats.headshotUrl}
                driverName={liveStats.name}
                driverCode={liveStats.code}
                driverNumber={liveStats.number}
                teamColor={liveStats.constructorColor}
                size="lg"
              />
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <span
                    className="font-display text-2xl font-extrabold italic tracking-tight tabular-nums"
                    style={{ color: liveStats.constructorColor }}
                  >
                    #{liveStats.number}
                  </span>
                  {liveStats.flagUrl && (
                    <OfficialLogo
                      src={liveStats.flagUrl}
                      alt={liveStats.nationality}
                      shape="Flag"
                      size="xs"
                    />
                  )}
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                      isReserve
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    }`}
                  >
                    {isReserve ? 'FORMER / RESERVE' : 'ACTIVE'}
                  </span>
                </div>

                <h3 className="font-display text-xl font-bold tracking-tight text-[#F8FAFC] truncate">
                  {liveStats.name}
                </h3>

                <div className="flex items-center gap-1.5 text-xs text-[#F8FAFC]">
                  <OfficialLogo
                    src={liveStats.constructorLogo}
                    alt={liveStats.constructorName}
                    size="xs"
                    fallbackCode={liveStats.constructorCode}
                  />
                  <span className="font-medium truncate">
                    {liveStats.constructorName}
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close Driver Career Modal"
              className="h-8 w-8 rounded-lg border border-[#1E2028] bg-[#0A0A0C]/60 flex items-center justify-center text-[#8E95A5] hover:text-[#F8FAFC] shrink-0"
            >
              <X className="w-4 h-4 stroke-[1.5]" />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* 1. CURRENT 2026 SEASON STATS */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#8E95A5] flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5 text-[#E10600]" />
                <span>2026 Season Championship Standing</span>
              </span>
              {isSyncingCareer && (
                <span className="text-[10px] text-[#8E95A5] flex items-center gap-1">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  <span>Updating...</span>
                </span>
              )}
            </div>

            <div className="grid grid-cols-4 gap-2 text-center tabular-nums">
              <div className="p-2.5 rounded-xl bg-[#181A20] border border-[#1E2028]">
                <div className="text-[10px] text-[#8E95A5] uppercase">Rank</div>
                <div className="text-base font-bold text-[#F8FAFC]">
                  P{liveStats.seasonPosition}
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-[#181A20] border border-[#1E2028]">
                <div className="text-[10px] text-[#8E95A5] uppercase">Points</div>
                <div className="text-base font-bold text-[#E10600]">
                  {liveStats.seasonPoints}
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-[#181A20] border border-[#1E2028]">
                <div className="text-[10px] text-[#8E95A5] uppercase">
                  Fastest Laps
                </div>
                <div className="text-base font-bold text-[#F8FAFC]">
                  {liveStats.fastestLaps}
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-[#181A20] border border-[#1E2028]">
                <div className="text-[10px] text-[#8E95A5] uppercase">
                  Top Speed
                </div>
                <div className="text-base font-bold text-[#F8FAFC]">
                  {liveStats.topSpeedKph}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-center tabular-nums text-xs">
              <div className="px-3 py-2 rounded-lg bg-[#181A20] border border-[#1E2028] flex items-center justify-between">
                <span className="text-[#8E95A5]">Sprint Points</span>
                <span className="font-bold text-[#F8FAFC]">
                  {liveStats.sprintPoints ?? 0}
                </span>
              </div>
              <div className="px-3 py-2 rounded-lg bg-[#181A20] border border-[#1E2028] flex items-center justify-between">
                <span className="text-[#8E95A5]">Season DNFs</span>
                <span className="font-bold text-[#F8FAFC]">
                  {liveStats.dnfs ?? 0}
                </span>
              </div>
            </div>
          </div>

          {/* 2. ALL-TIME FORMULA 1 CAREER TOTALS */}
          <div className="space-y-2 pt-2 border-t border-[#1E2028]">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#8E95A5] flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-amber-400" />
              <span>All-Time FIA Career Totals</span>
            </span>

            <div className="grid grid-cols-3 gap-2 text-center tabular-nums">
              <div className="p-2.5 rounded-xl bg-[#181A20] border border-[#1E2028]">
                <div className="text-[10px] text-[#8E95A5] uppercase">
                  Career Wins
                </div>
                <div className="text-lg font-bold text-emerald-400">
                  {liveStats.careerWins}
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-[#181A20] border border-[#1E2028]">
                <div className="text-[10px] text-[#8E95A5] uppercase">
                  Podiums
                </div>
                <div className="text-lg font-bold text-[#F8FAFC]">
                  {liveStats.careerPodiums}
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-[#181A20] border border-[#1E2028]">
                <div className="text-[10px] text-[#8E95A5] uppercase">Poles</div>
                <div className="text-lg font-bold text-amber-400">
                  {liveStats.careerPoles}
                </div>
              </div>
            </div>

            <div className="divide-y divide-[#1E2028] rounded-xl bg-[#181A20] border border-[#1E2028] text-xs tabular-nums">
              <div className="px-3 py-2.5 flex items-center justify-between">
                <span className="text-[#8E95A5]">Grands Prix Entered</span>
                <span className="font-bold text-[#F8FAFC]">
                  {liveStats.grandsPrixEntered}
                </span>
              </div>
              <div className="px-3 py-2.5 flex items-center justify-between">
                <span className="text-[#8E95A5]">Career Points</span>
                <span className="font-bold text-[#F8FAFC]">
                  {liveStats.careerPoints}
                </span>
              </div>
              <div className="px-3 py-2.5 flex items-center justify-between">
                <span className="text-[#8E95A5]">World Championships</span>
                <span className="font-bold text-amber-400">
                  {liveStats.championships}
                </span>
              </div>
              <div className="px-3 py-2.5 flex items-center justify-between">
                <span className="text-[#8E95A5]">Highest Race Finish</span>
                <span className="font-bold text-[#F8FAFC]">
                  {liveStats.highestRaceFinish ||
                    (liveStats.careerWins > 0
                      ? `1 (x${liveStats.careerWins})`
                      : 'P2')}
                </span>
              </div>
              <div className="px-3 py-2.5 flex items-center justify-between">
                <span className="text-[#8E95A5]">Highest Grid Position</span>
                <span className="font-bold text-[#F8FAFC]">
                  {liveStats.highestGridPosition ||
                    (liveStats.careerPoles > 0
                      ? `1 (x${liveStats.careerPoles})`
                      : 'P2')}
                </span>
              </div>
              {liveStats.dateOfBirth && (
                <div className="px-3 py-2.5 flex items-center justify-between">
                  <span className="text-[#8E95A5]">Date of Birth</span>
                  <span className="font-medium text-[#F8FAFC]">
                    {liveStats.dateOfBirth}
                  </span>
                </div>
              )}
              {liveStats.placeOfBirth && (
                <div className="px-3 py-2.5 flex items-center justify-between gap-2">
                  <span className="text-[#8E95A5] flex items-center gap-1 shrink-0">
                    <MapPin className="w-3 h-3" />
                    <span>Place of Birth</span>
                  </span>
                  <span className="font-medium text-[#F8FAFC] truncate">
                    {liveStats.placeOfBirth}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
