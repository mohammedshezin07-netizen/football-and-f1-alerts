import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  CheckCircle2,
  RefreshCw,
  Users,
  X,
} from 'lucide-react';
import {
  F1ConstructorStandingRow,
  F1DriverCareerStats,
  F1DriverStandingRow,
  F1RosterTransferEvent,
  FootballLeagueTable,
} from '../types/sports';
import {
  F1_CONSTRUCTOR_STANDINGS_2026,
  F1_DRIVER_STANDINGS_2026,
  FOOTBALL_LEAGUE_TABLES,
  SUPPORTED_FOOTBALL_LEAGUE_CONFIGS,
} from '../data/standingsData';
import { DRIVER_CAREER_REGISTRY } from '../data/seedData';
import {
  F1_RESERVE_DRIVERS_2026,
  VERIFIED_ROSTER_TRANSFERS,
  fetchF1StandingsBySeason,
  getBaselineDriverCareerProfile,
} from '../services/f1AutoSync';
import { fetchESPNLeagueStandings } from '../services/sportsApi';
import { OfficialLogo } from './OfficialLogo';
import { F1DriverAvatar } from './CircuitSvg';
import { DriverCareerProfileModal } from './AlarmModalAndDrawers';
import { F1_LOGOS } from '../data/logos';

type StandingsPrimaryCategory = 'F1_WDC' | 'F1_WCC' | 'FOOTBALL_LEAGUES';

const F1_AVAILABLE_SEASONS = [2026, 2025, 2024, 2023, 2022, 2021] as const;
const FOOTBALL_AVAILABLE_SEASONS: Array<{ year: number; label: string }> = [
  { year: 2026, label: '2026/27' },
  { year: 2025, label: '2025/26' },
  { year: 2024, label: '2024/25' },
  { year: 2023, label: '2023/24' },
];

interface StandingsTabProps {
  followedTeamCodes: string[];
  isOnline: boolean;
  driverStandings?: F1DriverStandingRow[];
  constructorStandings?: F1ConstructorStandingRow[];
  footballLeagueTables?: FootballLeagueTable[];
  driverCareerCache: Record<string, F1DriverCareerStats>;
  rosterTransfers?: F1RosterTransferEvent[];
  onCacheDriverStats: (driver: F1DriverCareerStats) => void;
}

export const StandingsTab: React.FC<StandingsTabProps> = ({
  followedTeamCodes,
  isOnline,
  driverStandings = F1_DRIVER_STANDINGS_2026,
  constructorStandings = F1_CONSTRUCTOR_STANDINGS_2026,
  footballLeagueTables = FOOTBALL_LEAGUE_TABLES,
  driverCareerCache,
  rosterTransfers = VERIFIED_ROSTER_TRANSFERS,
  onCacheDriverStats,
}) => {
  const [category, setCategory] =
    useState<StandingsPrimaryCategory>('F1_WDC');
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>('league-pl');
  const [selectedFootballSeason, setSelectedFootballSeason] =
    useState<number>(2026);
  const [selectedF1Season, setSelectedF1Season] = useState<number>(2026);
  const [showReserveDrivers, setShowReserveDrivers] = useState<boolean>(false);
  const [showTransfersDrawer, setShowTransfersDrawer] =
    useState<boolean>(false);
  const [selectedDriverModal, setSelectedDriverModal] =
    useState<F1DriverCareerStats | null>(null);

  // Dynamic Football Standings Cache keyed by `${leagueId}_${seasonYear}`
  const [syncedFootballTables, setSyncedFootballTables] = useState<
    Record<string, FootballLeagueTable>
  >(() => {
    const initial: Record<string, FootballLeagueTable> = {};
    for (const tbl of footballLeagueTables) {
      if (tbl.rows && tbl.rows.length > 0) {
        const yr = tbl.seasonYear || 2026;
        initial[`${tbl.id}_${yr}`] = tbl;
      }
    }
    return initial;
  });
  const [isLoadingFootball, setIsLoadingFootball] = useState<boolean>(false);

  // Dynamic F1 Season Standings Cache keyed by season year (2021..2026)
  const [f1SeasonCache, setF1SeasonCache] = useState<
    Record<
      number,
      {
        driverStandings: F1DriverStandingRow[];
        constructorStandings: F1ConstructorStandingRow[];
        round: string;
        verifiedAtIST: string;
      }
    >
  >(() => {
    if (driverStandings.length > 0 || constructorStandings.length > 0) {
      return {
        2026: {
          driverStandings,
          constructorStandings,
          round: 'Live',
          verifiedAtIST: new Date()
            .toLocaleTimeString('en-IN', {
              timeZone: 'Asia/Kolkata',
              hour: '2-digit',
              minute: '2-digit',
              hour12: true,
            })
            .toUpperCase(),
        },
      };
    }
    const empty: Record<
      number,
      {
        driverStandings: F1DriverStandingRow[];
        constructorStandings: F1ConstructorStandingRow[];
        round: string;
        verifiedAtIST: string;
      }
    > = {};
    return empty;
  });
  const [isLoadingF1, setIsLoadingF1] = useState<boolean>(false);

  // Keep 2026 F1 cache updated when parent props arrive
  useEffect(() => {
    if (driverStandings.length > 0 || constructorStandings.length > 0) {
      setF1SeasonCache((prev) => ({
        ...prev,
        2026: {
          driverStandings:
            driverStandings.length > 0
              ? driverStandings
              : prev[2026]?.driverStandings || [],
          constructorStandings:
            constructorStandings.length > 0
              ? constructorStandings
              : prev[2026]?.constructorStandings || [],
          round: prev[2026]?.round || 'Live',
          verifiedAtIST:
            prev[2026]?.verifiedAtIST ||
            new Date()
              .toLocaleTimeString('en-IN', {
                timeZone: 'Asia/Kolkata',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
              })
              .toUpperCase(),
        },
      }));
    }
  }, [driverStandings, constructorStandings]);

  // Keep Football tables updated when parent props arrive
  useEffect(() => {
    setSyncedFootballTables((prev) => {
      const next = { ...prev };
      let updated = false;
      for (const tbl of footballLeagueTables) {
        if (tbl.rows && tbl.rows.length > 0) {
          const yr = tbl.seasonYear || 2026;
          const key = `${tbl.id}_${yr}`;
          if (!next[key] || next[key].rows.length === 0) {
            next[key] = tbl;
            updated = true;
          }
        }
      }
      return updated ? next : prev;
    });
  }, [footballLeagueTables]);

  const loadF1Season = useCallback(
    async (year: number, forceRefresh = false) => {
      setIsLoadingF1(true);
      try {
        const res = await fetchF1StandingsBySeason(year, forceRefresh);
        if (
          res.driverStandings.length > 0 ||
          res.constructorStandings.length > 0
        ) {
          setF1SeasonCache((prev) => ({
            ...prev,
            [year]: {
              driverStandings: res.driverStandings,
              constructorStandings: res.constructorStandings,
              round: res.round,
              verifiedAtIST: res.verifiedAtIST,
            },
          }));
        }
      } finally {
        setIsLoadingF1(false);
      }
    },
    []
  );

  // Fetch selected F1 season when year changes or cache is empty
  useEffect(() => {
    const existing = f1SeasonCache[selectedF1Season];
    if (
      !existing ||
      existing.driverStandings.length === 0 ||
      existing.constructorStandings.length === 0
    ) {
      void loadF1Season(selectedF1Season, false);
    }
  }, [selectedF1Season, f1SeasonCache, loadF1Season]);

  const loadFootballLeagueSeason = useCallback(
    async (leagueId: string, seasonYear: number, forceRefresh = false) => {
      setIsLoadingFootball(true);
      try {
        const table = await fetchESPNLeagueStandings(
          leagueId,
          seasonYear,
          forceRefresh
        );
        if (table && table.rows.length > 0) {
          setSyncedFootballTables((prev) => ({
            ...prev,
            [`${leagueId}_${seasonYear}`]: table,
          }));
        }
      } finally {
        setIsLoadingFootball(false);
      }
    },
    []
  );

  // Fetch selected Football league + season when selection changes
  useEffect(() => {
    const key = `${selectedLeagueId}_${selectedFootballSeason}`;
    const existing = syncedFootballTables[key];
    if (!existing || existing.rows.length === 0) {
      void loadFootballLeagueSeason(
        selectedLeagueId,
        selectedFootballSeason,
        false
      );
    }
  }, [
    selectedLeagueId,
    selectedFootballSeason,
    syncedFootballTables,
    loadFootballLeagueSeason,
  ]);

  const leagueSelectorList = useMemo(() => {
    return SUPPORTED_FOOTBALL_LEAGUE_CONFIGS.map((cfg) => {
      const fromProps = footballLeagueTables.find((l) => l.id === cfg.id);
      return (
        fromProps || {
          id: cfg.id,
          name: cfg.name,
          shortName: cfg.shortName,
          leagueName: cfg.leagueName,
          season: '2025/26',
          seasonLabel: '2025/26',
          seasonYear: 2025,
          country: cfg.country,
          competitionLogo: cfg.competitionLogo,
          espnSlug: cfg.espnSlug,
          matchweekLabel: 'Official Table',
          rows: [],
        }
      );
    });
  }, [footballLeagueTables]);

  const activeLeague: FootballLeagueTable = useMemo(() => {
    const key = `${selectedLeagueId}_${selectedFootballSeason}`;
    if (syncedFootballTables[key] && syncedFootballTables[key].rows.length > 0) {
      return syncedFootballTables[key];
    }
    const cfg =
      SUPPORTED_FOOTBALL_LEAGUE_CONFIGS.find((c) => c.id === selectedLeagueId) ||
      SUPPORTED_FOOTBALL_LEAGUE_CONFIGS[0];
    const seasonLabel =
      cfg.espnSlug === 'bra.1'
        ? `${selectedFootballSeason} Série A`
        : `${selectedFootballSeason}/${String(selectedFootballSeason + 1).slice(-2)}`;
    return {
      id: cfg.id,
      name: cfg.name,
      shortName: cfg.shortName,
      leagueName: cfg.leagueName,
      season: seasonLabel,
      seasonLabel,
      seasonYear: selectedFootballSeason,
      country: cfg.country,
      competitionLogo: cfg.competitionLogo,
      espnSlug: cfg.espnSlug,
      matchweekLabel: 'Official Table',
      rows: [],
    };
  }, [selectedLeagueId, selectedFootballSeason, syncedFootballTables]);

  const activeF1Data = f1SeasonCache[selectedF1Season];
  const activeF1Drivers = activeF1Data?.driverStandings || [];
  const activeF1Constructors = activeF1Data?.constructorStandings || [];

  // Merge active F1 grid with reserve drivers when enabled (for 2026)
  const displayedDrivers = useMemo(() => {
    const seenCodes = new Set<string>();
    const activeRows: F1DriverStandingRow[] = [];

    for (const d of activeF1Drivers) {
      const code = (d.driverCode || d.driverId).toUpperCase();
      const isReserveRow =
        d.status === 'FORMER / RESERVE' ||
        d.rosterStatus === 'FORMER' ||
        d.rosterStatus === 'RESERVE';
      if (isReserveRow || seenCodes.has(code)) continue;
      seenCodes.add(code);
      activeRows.push(d);
    }

    if (!showReserveDrivers || selectedF1Season !== 2026) return activeRows;

    const combined = [...activeRows];

    for (const res of F1_RESERVE_DRIVERS_2026) {
      const code = res.driverCode.toUpperCase();
      if (seenCodes.has(code)) continue;
      seenCodes.add(code);
      combined.push({
        ...res,
        position: combined.length + 1,
        rank: combined.length + 1,
        status: 'FORMER / RESERVE',
        rosterStatus: 'RESERVE',
      });
    }

    for (const profile of Object.values(driverCareerCache)) {
      const code = (profile.code || profile.id).toUpperCase();
      const isReserveOrFormer =
        profile.status === 'FORMER / RESERVE' ||
        profile.rosterStatus === 'FORMER' ||
        profile.rosterStatus === 'RESERVE';
      if (isReserveOrFormer && !seenCodes.has(code)) {
        seenCodes.add(code);
        combined.push({
          position: combined.length + 1,
          rank: combined.length + 1,
          driverId: profile.code || profile.id,
          driverCode: code,
          driverName: profile.name,
          driverNumber: profile.number,
          nationality: profile.nationality,
          flagUrl: profile.flagUrl || profile.countryFlagUrl || '',
          countryFlagUrl: profile.countryFlagUrl || profile.flagUrl,
          headshotUrl: profile.headshotUrl,
          status: 'FORMER / RESERVE',
          rosterStatus: 'RESERVE',
          constructorName: profile.constructorName,
          constructorCode: profile.constructorCode,
          constructorLogo: profile.constructorLogo,
          constructorColor: profile.constructorColor,
          points: profile.seasonPoints ?? 0,
          wins: profile.seasonWins ?? 0,
          podiums: profile.seasonPodiums ?? 0,
          poles: profile.seasonPoles ?? 0,
        });
      }
    }

    return combined;
  }, [activeF1Drivers, showReserveDrivers, selectedF1Season, driverCareerCache]);

  const handleOpenDriverProfile = (row: F1DriverStandingRow) => {
    const profile: F1DriverCareerStats =
      driverCareerCache[row.driverCode] ||
      driverCareerCache[row.driverId] ||
      DRIVER_CAREER_REGISTRY[row.driverCode] ||
      DRIVER_CAREER_REGISTRY[row.driverId] ||
      getBaselineDriverCareerProfile(row.driverCode);
    setSelectedDriverModal({
      ...profile,
      name: row.driverName || profile.name,
      seasonPosition: row.position,
      seasonPoints: row.points,
    });
  };

  return (
    <div className="pb-24 space-y-4">
      {/* Top Category Switcher: F1 Drivers (WDC) | F1 Teams (WCC) | Football Tables */}
      <div className="bg-[#121316] border-b border-[#1E2028] px-4 py-3 space-y-2.5">
        <div
          role="tablist"
          aria-label="Championship Standings Category"
          className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-[#0A0A0C] border border-[#1E2028]"
        >
          {(
            [
              { id: 'F1_WDC', label: 'F1 Drivers' },
              { id: 'F1_WCC', label: 'F1 Teams' },
              { id: 'FOOTBALL_LEAGUES', label: 'Football Tables' },
            ] as { id: StandingsPrimaryCategory; label: string }[]
          ).map((tab) => {
            const active = category === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setCategory(tab.id)}
                className={`min-h-[32px] px-2 py-1 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                  active
                    ? tab.id === 'FOOTBALL_LEAGUES'
                      ? 'bg-emerald-500 text-[#0A0A0C] font-bold'
                      : 'bg-[#E10600] text-[#F8FAFC] font-bold'
                    : 'text-[#8E95A5] hover:text-[#F8FAFC]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* VIEW 1: FORMULA 1 DRIVERS WORLD CHAMPIONSHIP (WDC) */}
      {category === 'F1_WDC' && (
        <section
          className="px-4 space-y-3"
          aria-label="Formula 1 World Drivers Championship"
        >
          {/* F1 Season Year Selector (2026 - 2021) */}
          <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar pb-0.5">
            <div className="flex items-center gap-1 p-1 rounded-xl bg-[#121316] border border-[#1E2028]">
              {F1_AVAILABLE_SEASONS.map((yr) => {
                const active = selectedF1Season === yr;
                return (
                  <button
                    key={yr}
                    type="button"
                    onClick={() => setSelectedF1Season(yr)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold tabular-nums transition-colors ${
                      active
                        ? 'bg-[#E10600] text-[#F8FAFC]'
                        : 'text-[#8E95A5] hover:text-[#F8FAFC]'
                    }`}
                  >
                    {yr}
                  </button>
                );
              })}
            </div>

            {activeF1Data?.verifiedAtIST && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-semibold text-emerald-400 shrink-0 tabular-nums">
                <CheckCircle2 className="w-3 h-3" />
                Verified Snapshot • {activeF1Data.verifiedAtIST} IST
              </span>
            )}
          </div>

          {/* Header + Roster & Seat Changes Button */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <OfficialLogo src={F1_LOGOS.F1_MAIN} alt="Formula 1" size="xs" />
              <div>
                <h2 className="font-display text-sm font-bold uppercase tracking-tight text-[#F8FAFC]">
                  {selectedF1Season} F1 Drivers Championship
                </h2>
                <p className="text-[11px] text-[#8E95A5]">
                  {activeF1Data?.round
                    ? `Official FIA Standings • Round ${activeF1Data.round}`
                    : 'Tap any driver for Official Career Profile'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {selectedF1Season === 2026 && (
                <button
                  type="button"
                  onClick={() => setShowReserveDrivers((prev) => !prev)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
                    showReserveDrivers
                      ? 'bg-amber-400/20 border-amber-400 text-amber-300'
                      : 'bg-[#121316] border-[#1E2028] text-[#8E95A5] hover:text-[#F8FAFC]'
                  }`}
                >
                  {showReserveDrivers ? 'Hide Reserve' : '+ Reserve'}
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowTransfersDrawer(true)}
                data-testid="roster-seat-changes-btn"
                className="px-3 py-1 rounded-lg bg-[#F8FAFC] text-[#0A0A0C] text-[11px] font-bold flex items-center gap-1.5 hover:bg-zinc-200 transition-colors"
              >
                <ArrowLeftRight className="w-3 h-3 stroke-[2]" />
                <span>Roster &amp; Seat Changes</span>
              </button>
            </div>
          </div>

          {/* Drivers Table */}
          <div className="rounded-xl border border-[#1E2028] bg-[#121316] overflow-hidden">
            <div className="px-4 py-2 bg-[#0A0A0C] border-b border-[#1E2028] flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[#8E95A5]">
              <span>POS / DRIVER</span>
              <div className="flex items-center gap-4">
                <span>W / POD</span>
                <span>PTS</span>
              </div>
            </div>

            {displayedDrivers.length === 0 ? (
              <div className="px-4 py-12 text-center space-y-3">
                <RefreshCw
                  className={`w-5 h-5 mx-auto text-[#8E95A5] ${
                    isLoadingF1 ? 'animate-spin text-[#E10600]' : ''
                  }`}
                />
                <div className="space-y-1">
                  <p className="text-xs font-bold text-[#F8FAFC]">
                    Syncing...
                  </p>
                  <p className="text-[11px] text-[#8E95A5]">
                    Syncing official {selectedF1Season} FIA Formula 1 standings...
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void loadF1Season(selectedF1Season, true)}
                  className="px-3 py-1.5 rounded-lg bg-[#181A20] border border-[#1E2028] text-xs font-semibold text-[#F8FAFC] hover:bg-[#1E2028] transition-colors"
                >
                  Retry Live Sync
                </button>
              </div>
            ) : (
              <div className="divide-y divide-[#1E2028]">
                {displayedDrivers.map((drv) => {
                  const isFollowedTeam = followedTeamCodes.includes(
                    drv.constructorCode
                  );
                  const profile =
                    driverCareerCache[drv.driverId] ||
                    driverCareerCache[drv.driverCode] ||
                    DRIVER_CAREER_REGISTRY[drv.driverId] ||
                    DRIVER_CAREER_REGISTRY[drv.driverCode];
                  const headshot = drv.headshotUrl || profile?.headshotUrl;
                  const number = drv.driverNumber ?? profile?.number ?? 0;
                  const pos = drv.rank ?? drv.position;
                  const isReserve =
                    drv.status === 'FORMER / RESERVE' ||
                    drv.rosterStatus === 'FORMER' ||
                    drv.rosterStatus === 'RESERVE';

                  return (
                    <button
                      key={`${selectedF1Season}-${drv.driverId}-${pos}`}
                      type="button"
                      onClick={() => handleOpenDriverProfile(drv)}
                      className={`w-full px-4 py-3 flex items-center justify-between gap-2 text-left transition-colors hover:bg-[#181A20] ${
                        isFollowedTeam ? 'bg-white/[0.02]' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-5 tabular-nums text-xs font-bold text-[#8E95A5]">
                          {pos}
                        </span>

                        <span
                          className="w-1 h-9 rounded-full shrink-0"
                          style={{ backgroundColor: drv.constructorColor }}
                        />

                        <F1DriverAvatar
                          src={headshot}
                          name={drv.driverName}
                          code={drv.driverCode}
                          teamColor={drv.constructorColor}
                          size="sm"
                        />

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-bold text-[#F8FAFC] truncate">
                              {drv.driverName}
                            </span>
                            {number > 0 && (
                              <span
                                className="font-display text-xs font-extrabold italic tabular-nums shrink-0"
                                style={{ color: drv.constructorColor }}
                              >
                                #{number}
                              </span>
                            )}
                            {isReserve && (
                              <span className="px-1.5 py-0.2 rounded-md bg-amber-500/20 text-amber-300 text-[9px] font-bold uppercase shrink-0">
                                RESERVE
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 text-[11px] text-[#8E95A5]">
                            <OfficialLogo
                              src={drv.constructorLogo}
                              alt={drv.constructorName}
                              size="xs"
                              fallbackCode={drv.constructorCode}
                            />
                            <span className="truncate">
                              {drv.constructorName}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 shrink-0 tabular-nums">
                        <div className="text-right text-xs text-[#8E95A5]">
                          <span className="text-[#F8FAFC] font-semibold">
                            {drv.wins}W
                          </span>{' '}
                          · {drv.podiums}P
                        </div>
                        <div className="min-w-[44px] px-2.5 py-1 rounded-md bg-[#181A20] border border-[#1E2028] text-center text-xs font-bold text-[#F8FAFC]">
                          {drv.points}
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

      {/* VIEW 2: FORMULA 1 WORLD CONSTRUCTORS CHAMPIONSHIP (WCC) */}
      {category === 'F1_WCC' && (
        <section
          className="px-4 space-y-3"
          aria-label="Formula 1 World Constructors Championship"
        >
          {/* F1 Season Year Selector (2026 - 2021) */}
          <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar pb-0.5">
            <div className="flex items-center gap-1 p-1 rounded-xl bg-[#121316] border border-[#1E2028]">
              {F1_AVAILABLE_SEASONS.map((yr) => {
                const active = selectedF1Season === yr;
                return (
                  <button
                    key={yr}
                    type="button"
                    onClick={() => setSelectedF1Season(yr)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold tabular-nums transition-colors ${
                      active
                        ? 'bg-[#E10600] text-[#F8FAFC]'
                        : 'text-[#8E95A5] hover:text-[#F8FAFC]'
                    }`}
                  >
                    {yr}
                  </button>
                );
              })}
            </div>

            {activeF1Data?.verifiedAtIST && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-semibold text-emerald-400 shrink-0 tabular-nums">
                <CheckCircle2 className="w-3 h-3" />
                Verified Snapshot • {activeF1Data.verifiedAtIST} IST
              </span>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <OfficialLogo src={F1_LOGOS.F1_MAIN} alt="Formula 1" size="xs" />
              <h2 className="font-display text-sm font-bold uppercase tracking-tight text-[#F8FAFC]">
                {selectedF1Season} F1 Constructors Championship
              </h2>
            </div>
            <span className="text-[11px] text-[#8E95A5]">
              {activeF1Data?.round ? `Round ${activeF1Data.round}` : 'Official FIA'}
            </span>
          </div>

          <div className="rounded-xl border border-[#1E2028] bg-[#121316] overflow-hidden">
            <div className="px-4 py-2 bg-[#0A0A0C] border-b border-[#1E2028] flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[#8E95A5]">
              <span>POS / CONSTRUCTOR</span>
              <div className="flex items-center gap-4">
                <span>W / POD / POLES</span>
                <span>PTS</span>
              </div>
            </div>

            {activeF1Constructors.length === 0 ? (
              <div className="px-4 py-12 text-center space-y-3">
                <RefreshCw
                  className={`w-5 h-5 mx-auto text-[#8E95A5] ${
                    isLoadingF1 ? 'animate-spin text-[#E10600]' : ''
                  }`}
                />
                <div className="space-y-1">
                  <p className="text-xs font-bold text-[#F8FAFC]">
                    Syncing...
                  </p>
                  <p className="text-[11px] text-[#8E95A5]">
                    Syncing official {selectedF1Season} FIA Constructors standings...
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void loadF1Season(selectedF1Season, true)}
                  className="px-3 py-1.5 rounded-lg bg-[#181A20] border border-[#1E2028] text-xs font-semibold text-[#F8FAFC] hover:bg-[#1E2028] transition-colors"
                >
                  Retry Live Sync
                </button>
              </div>
            ) : (
              <div className="divide-y divide-[#1E2028]">
                {activeF1Constructors.map((team) => {
                  const isFollowed = followedTeamCodes.includes(
                    team.constructorCode
                  );
                  const pos = team.rank ?? team.position;
                  return (
                    <div
                      key={`${selectedF1Season}-${team.constructorCode}-${pos}`}
                      className={`px-4 py-3.5 flex items-center justify-between gap-2 ${
                        isFollowed ? 'bg-[#E10600]/10' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-5 tabular-nums text-xs font-bold text-[#8E95A5]">
                          {pos}
                        </span>

                        <span
                          className="w-1 h-9 rounded-full shrink-0"
                          style={{ backgroundColor: team.constructorColor }}
                        />

                        <OfficialLogo
                          src={team.constructorLogo}
                          alt={team.constructorName}
                          size="sm"
                          fallbackCode={team.constructorCode}
                        />

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-bold text-[#F8FAFC] truncate">
                              {team.constructorName}
                            </span>
                            {isFollowed && (
                              <span className="px-1.5 py-0.2 rounded-md bg-[#E10600] text-[#F8FAFC] text-[9px] font-bold uppercase">
                                FAV
                              </span>
                            )}
                          </div>
                          {team.drivers.length > 0 && (
                            <div className="text-[11px] text-[#8E95A5] truncate">
                              {team.drivers.join(' • ')}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-4 shrink-0 tabular-nums">
                        <div className="text-right text-xs text-[#8E95A5]">
                          <span className="text-[#F8FAFC] font-semibold">
                            {team.wins}W
                          </span>{' '}
                          · {team.podiums}P · {team.poles}PL
                        </div>
                        <div className="min-w-[46px] px-2.5 py-1 rounded-md bg-[#181A20] border border-[#1E2028] text-center text-xs font-bold text-[#F8FAFC]">
                          {team.points}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}

      {/* VIEW 3: FOOTBALL LEAGUE TABLES (PREMIER LEAGUE, ISL, UCL, LA LIGA, SERIE A, BUNDESLIGA, BRASILEIRÃO) */}
      {category === 'FOOTBALL_LEAGUES' && (
        <section
          className="px-4 space-y-3"
          aria-label="Football League Standings"
        >
          {/* League Selector Strip */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
            {leagueSelectorList.map((lg) => {
              const active = lg.id === selectedLeagueId;
              const lgLabel = lg.name || lg.shortName || lg.leagueName;
              return (
                <button
                  key={lg.id}
                  type="button"
                  onClick={() => setSelectedLeagueId(lg.id)}
                  className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                    active
                      ? 'bg-[#F8FAFC] text-[#0A0A0C] font-bold'
                      : 'bg-[#121316] text-[#8E95A5] border border-[#1E2028] hover:text-[#F8FAFC]'
                  }`}
                >
                  <OfficialLogo
                    src={lg.competitionLogo}
                    alt={lgLabel}
                    size="xs"
                  />
                  <span>{lgLabel}</span>
                </button>
              );
            })}
          </div>

          {/* Football Season Year Selector (2026/27, 2025/26, 2024/25, 2023/24) + Verified Snapshot Badge */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1 p-1 rounded-xl bg-[#121316] border border-[#1E2028]">
              {FOOTBALL_AVAILABLE_SEASONS.map((s) => {
                const active = selectedFootballSeason === s.year;
                const label =
                  activeLeague.espnSlug === 'bra.1'
                    ? String(s.year)
                    : s.label;
                return (
                  <button
                    key={s.year}
                    type="button"
                    onClick={() => setSelectedFootballSeason(s.year)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold tabular-nums transition-colors ${
                      active
                        ? 'bg-emerald-400 text-[#0A0A0C]'
                        : 'text-[#8E95A5] hover:text-[#F8FAFC]'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {activeLeague.verifiedAtIST && activeLeague.rows.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-semibold text-emerald-400 shrink-0 tabular-nums">
                <CheckCircle2 className="w-3 h-3" />
                Verified Snapshot • {activeLeague.verifiedAtIST} IST
              </span>
            )}
          </div>

          <div className="rounded-xl border border-[#1E2028] bg-[#121316] overflow-hidden">
            {/* League Header */}
            <div className="px-4 py-3 border-b border-[#1E2028] bg-[#181A20]/70 flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 min-w-0">
                <OfficialLogo
                  src={activeLeague.competitionLogo}
                  alt={activeLeague.name || activeLeague.leagueName}
                  size="sm"
                />
                <div className="min-w-0">
                  <h2 className="font-display text-sm font-bold text-[#F8FAFC] truncate">
                    {activeLeague.name || activeLeague.leagueName}
                  </h2>
                  <p className="text-[11px] text-[#8E95A5]">
                    {activeLeague.country} •{' '}
                    {activeLeague.season || activeLeague.seasonLabel}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  void loadFootballLeagueSeason(
                    selectedLeagueId,
                    selectedFootballSeason,
                    true
                  )
                }
                title="Refresh Official League Table"
                className="p-1.5 rounded-lg bg-[#0A0A0C] border border-[#1E2028] text-[#8E95A5] hover:text-[#F8FAFC] transition-colors"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${
                    isLoadingFootball ? 'animate-spin text-emerald-400' : ''
                  }`}
                />
              </button>
            </div>

            {/* Table Column Header */}
            <div className="px-3 py-2 bg-[#0A0A0C] border-b border-[#1E2028] grid grid-cols-[24px_1fr_28px_28px_28px_28px_36px_38px] items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#8E95A5] tabular-nums">
              <span>#</span>
              <span>CLUB</span>
              <span className="text-center">P</span>
              <span className="text-center">W</span>
              <span className="text-center">D</span>
              <span className="text-center">L</span>
              <span className="text-center">GD</span>
              <span className="text-right">PTS</span>
            </div>

            {/* Table Rows or Syncing State */}
            {activeLeague.rows.length === 0 ? (
              <div className="px-4 py-12 text-center space-y-3">
                <RefreshCw
                  className={`w-5 h-5 mx-auto text-[#8E95A5] ${
                    isLoadingFootball ? 'animate-spin text-emerald-400' : ''
                  }`}
                />
                <div className="space-y-1">
                  <p className="text-xs font-bold text-[#F8FAFC]">
                    Syncing...
                  </p>
                  <p className="text-[11px] text-[#8E95A5]">
                    Syncing official league table...
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    void loadFootballLeagueSeason(
                      selectedLeagueId,
                      selectedFootballSeason,
                      true
                    )
                  }
                  className="px-3 py-1.5 rounded-lg bg-[#181A20] border border-[#1E2028] text-xs font-semibold text-[#F8FAFC] hover:bg-[#1E2028] transition-colors"
                >
                  Retry Live Sync
                </button>
              </div>
            ) : (
              <div className="divide-y divide-[#1E2028]">
                {activeLeague.rows.map((row, idx) => {
                  const isFavorite =
                    followedTeamCodes.includes(row.teamCode) ||
                    row.teamCode === 'SAN' ||
                    row.teamCode === 'MCI' ||
                    row.teamCode === 'KBFC';
                  const zone = row.zone ?? row.qualificationZone;
                  const pos = row.rank ?? row.position ?? idx + 1;

                  return (
                    <div
                      key={`${row.teamCode}-${pos}`}
                      className={`px-3 py-2.5 grid grid-cols-[24px_1fr_28px_28px_28px_28px_36px_38px] items-center gap-1 text-xs tabular-nums ${
                        isFavorite ? 'bg-emerald-500/10' : ''
                      }`}
                    >
                      <span
                        className={`font-bold ${
                          zone === 'CHAMPIONS_LEAGUE' || zone === 'LIBERTADORES'
                            ? 'text-emerald-400'
                            : zone === 'RELEGATION'
                            ? 'text-[#E10600]'
                            : 'text-[#8E95A5]'
                        }`}
                      >
                        {pos}
                      </span>

                      <div className="flex items-center gap-2 min-w-0 pr-1">
                        <OfficialLogo
                          src={row.teamLogo}
                          alt={row.teamName}
                          size="xs"
                          fallbackCode={row.teamCode}
                        />
                        <div className="min-w-0 flex items-center gap-1.5">
                          <span
                            className={`truncate ${
                              isFavorite
                                ? 'font-bold text-[#F8FAFC]'
                                : 'font-medium text-[#F8FAFC]/90'
                            }`}
                          >
                            {row.teamName}
                          </span>
                          {row.deductionPoints && row.deductionPoints > 0 && (
                            <span
                              title={
                                row.deductionNote ||
                                `${row.deductionPoints} pts deducted`
                              }
                              className="px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[9px] font-bold shrink-0"
                            >
                              -{row.deductionPoints}
                            </span>
                          )}
                        </div>
                      </div>

                      <span className="text-center text-[#F8FAFC]/80">
                        {row.played}
                      </span>
                      <span className="text-center text-[#F8FAFC]/80">
                        {row.won}
                      </span>
                      <span className="text-center text-[#8E95A5]">
                        {row.drawn}
                      </span>
                      <span className="text-center text-[#8E95A5]">
                        {row.lost}
                      </span>
                      <span
                        className={`text-center font-medium ${
                          row.goalDifference.startsWith('+')
                            ? 'text-emerald-400'
                            : row.goalDifference.startsWith('-')
                            ? 'text-[#E10600]'
                            : 'text-[#8E95A5]'
                        }`}
                      >
                        {row.goalDifference}
                      </span>
                      <span className="text-right font-bold text-[#F8FAFC]">
                        {row.points}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ROSTER & SEAT CHANGES DRAWER / MODAL */}
      {showTransfersDrawer && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="F1 Roster and Seat Changes Timeline"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
        >
          <div className="w-full max-w-[430px] max-h-[85vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-[#1E2028] bg-[#121316] text-[#F8FAFC] shadow-2xl pb-[env(safe-area-inset-bottom)]">
            <div className="px-4 py-3.5 border-b border-[#1E2028] bg-[#181A20] flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Users className="w-4 h-4 text-[#E10600] shrink-0" />
                <div className="min-w-0">
                  <h3 className="font-display text-base font-bold text-[#F8FAFC] truncate">
                    F1 Roster &amp; Seat Changes
                  </h3>
                  <p className="text-xs text-[#8E95A5] truncate">
                    Official FIA Driver Transfers, Swaps &amp; Rookie Promotions
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowTransfersDrawer(false)}
                aria-label="Close Roster Transfers Drawer"
                className="h-8 w-8 rounded-lg border border-[#1E2028] flex items-center justify-center text-[#8E95A5] hover:text-[#F8FAFC]"
              >
                <X className="w-4 h-4 stroke-[1.5]" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              {rosterTransfers.map((tr) => (
                <div
                  key={tr.id}
                  className="p-3.5 rounded-xl bg-[#181A20] border border-[#1E2028] space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[#F8FAFC]">
                      {tr.driverName} ({tr.driverCode})
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-[#E10600]/20 border border-[#E10600]/40 text-[10px] font-bold text-[#F8FAFC] uppercase">
                      {tr.changeType.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-[#F8FAFC]">
                    <span className="text-[#8E95A5]">
                      {tr.previousTeam || tr.fromTeam}
                    </span>
                    <span className="text-amber-400 font-bold">→</span>
                    <span className="font-semibold text-emerald-400">
                      {tr.newTeam || tr.toTeam}
                    </span>
                  </div>

                  <p className="text-xs text-[#8E95A5] leading-relaxed">
                    {tr.summary}
                  </p>

                  <div className="text-[10px] text-[#8E95A5] font-medium">
                    Effective: {tr.effectiveRound || tr.dateLabel} (
                    {tr.dateLabel})
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* OFFICIAL F1 APP DRIVER CAREER PROFILE MODAL */}
      <DriverCareerProfileModal
        driver={selectedDriverModal}
        isOnline={isOnline}
        onClose={() => setSelectedDriverModal(null)}
        onUpdateCachedDriver={onCacheDriverStats}
      />
    </div>
  );
};

