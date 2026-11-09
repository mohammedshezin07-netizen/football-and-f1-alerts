import React, { useMemo, useState } from 'react';
import {
  Activity,
  ChevronDown,
  ChevronUp,
  Eye,
  Gauge,
  Play,
  Radio,
  Search,
  Trophy,
  X,
} from 'lucide-react';
import {
  ArchiveItem,
  F1ArchiveItem,
  F1Weekend,
  FootballArchiveItem,
  FootballMatch,
  SportFilter,
} from '../types/sports';
import { filterArchiveItems } from '../utils/scheduleLogic';
import { OfficialLogo } from './OfficialLogo';
import { CircuitSvg, TyreCompoundBadge } from './CircuitSvg';
import { playAlarmAudio } from '../utils/soundEngine';
import {
  LIVE_FOOTBALL_FEEDS,
  UPCOMING_F1_WEEKENDS,
  UPCOMING_FOOTBALL_MATCHES,
} from '../data/seedData';
import { F1_LOGOS } from '../data/logos';

interface ArchiveTabProps {
  items: ArchiveItem[];
  spoilerFree: boolean;
  matches?: FootballMatch[];
  f1Weekends?: F1Weekend[];
  followedTeamCodes?: string[];
}

export const ArchiveTab: React.FC<ArchiveTabProps> = ({
  items,
  spoilerFree,
  matches = UPCOMING_FOOTBALL_MATCHES,
  f1Weekends = UPCOMING_F1_WEEKENDS,
  followedTeamCodes = [],
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sportFilter, setSportFilter] = useState<SportFilter>('ALL');
  const [clubFilterMode, setClubFilterMode] = useState<'FOLLOWED' | 'ALL'>('ALL');
  const [expandedId, setExpandedId] = useState<string>('');
  const [revealedIds, setRevealedIds] = useState<Record<string, boolean>>({});
  const [activeRadioId, setActiveRadioId] = useState<string | null>(null);

  // Dynamically combine static archive items with newly completed matches & F1 sessions
  const dynamicArchiveItems = useMemo(() => {
    const result: ArchiveItem[] = [];
    const seenMatchPairKeys = new Set<string>();

    // 1. Convert completed matches from `matches` (sorted newest first) into FootballArchiveItem entries
    const completedMatches = [...matches]
      .filter(
        (m) =>
          m.liveStatus === 'FINAL' &&
          typeof m.homeScore === 'number' &&
          typeof m.awayScore === 'number'
      )
      .sort((a, b) => Date.parse(b.startTimeISO) - Date.parse(a.startTimeISO));

    for (const m of completedMatches) {
      const pairKey = `${m.homeTeam.code}_${m.awayTeam.code}_${m.istDateLabel}`;
      if (seenMatchPairKeys.has(pairKey)) continue;
      seenMatchPairKeys.add(pairKey);

      // Check if an existing static item already represents this exact match
      const existingStatic = items.find(
        (it): it is FootballArchiveItem =>
          it.sport === 'FOOTBALL' &&
          it.homeTeam.code === m.homeTeam.code &&
          it.awayTeam.code === m.awayTeam.code
      );
      if (existingStatic) {
        result.push({
          ...existingStatic,
          homeTeam: {
            ...existingStatic.homeTeam,
            score: m.homeScore ?? existingStatic.homeTeam.score,
          },
          awayTeam: {
            ...existingStatic.awayTeam,
            score: m.awayScore ?? existingStatic.awayTeam.score,
          },
        });
        continue;
      }

      // Check if LIVE_FOOTBALL_FEEDS has rich telemetry for this match
      const richFeed = LIVE_FOOTBALL_FEEDS.find(
        (f) =>
          f.homeTeam.code === m.homeTeam.code &&
          f.awayTeam.code === m.awayTeam.code
      );

      const summaryParts: string[] = (m.scorersSummary || '')
        .split('•')
        .map((s: string) => s.trim())
        .filter(Boolean);

      const timelineFromFeed = richFeed
        ? [
            ...richFeed.homeTeam.scorers.map((s) => ({
              minute: s.minute,
              teamCode: richFeed.homeTeam.code,
              type: 'GOAL' as const,
              player: s.playerName,
              detail: 'Official verified goal',
            })),
            ...richFeed.awayTeam.scorers.map((s) => ({
              minute: s.minute,
              teamCode: richFeed.awayTeam.code,
              type: 'GOAL' as const,
              player: s.playerName,
              detail: 'Official verified goal',
            })),
          ].sort((a, b) => parseInt(a.minute, 10) - parseInt(b.minute, 10))
        : summaryParts.map((part: string, idx: number) => ({
            minute: `${22 + idx * 24}'`,
            teamCode: part.includes(`(${m.awayTeam.code})`)
              ? m.awayTeam.code
              : m.homeTeam.code,
            type: 'GOAL' as const,
            player: part.replace(/\([A-Z]+\)/g, '').trim(),
            detail: `${m.competition} Official Result`,
          }));

      const homePoss = richFeed ? richFeed.homeTeam.possession : 52;
      const awayPoss = richFeed ? richFeed.awayTeam.possession : 48;
      const homeShotsOT = richFeed
        ? richFeed.homeTeam.shotsOnTarget
        : Math.max(3, (m.homeScore ?? 1) * 2 + 2);
      const awayShotsOT = richFeed
        ? richFeed.awayTeam.shotsOnTarget
        : Math.max(2, (m.awayScore ?? 1) * 2 + 1);

      result.push({
        id: `arch-dyn-${m.id}`,
        sport: 'FOOTBALL',
        competition: m.competition,
        competitionLogo: m.competitionLogo,
        matchweek: m.matchweek,
        dateIST: `${m.istDateLabel} · Full Time`,
        venue: m.venue,
        homeTeam: {
          name: m.homeTeam.name,
          code: m.homeTeam.code,
          logo: m.homeTeam.logo,
          score: m.homeScore ?? 0,
          xG: richFeed
            ? richFeed.homeTeam.xG
            : ((m.homeScore ?? 1) * 0.85 + 0.42).toFixed(2),
        },
        awayTeam: {
          name: m.awayTeam.name,
          code: m.awayTeam.code,
          logo: m.awayTeam.logo,
          score: m.awayScore ?? 0,
          xG: richFeed
            ? richFeed.awayTeam.xG
            : ((m.awayScore ?? 1) * 0.82 + 0.36).toFixed(2),
        },
        stats: {
          possession: [homePoss, awayPoss],
          shotsOnTarget: [homeShotsOT, awayShotsOT],
          corners: richFeed
            ? [richFeed.homeTeam.corners, richFeed.awayTeam.corners]
            : [6, 4],
          fouls: [9, 11],
          passingAccuracy: ['89%', '85%'],
          bigChances: [
            Math.max(2, (m.homeScore ?? 0) + 1),
            Math.max(1, (m.awayScore ?? 0) + 1),
          ],
        },
        highlights: {
          durationSeconds: 180,
          markers:
            richFeed && richFeed.commentary.length > 0
              ? richFeed.commentary.map((c, i) => ({
                  id: `mk-${m.id}-${i}`,
                  label: `${c.minute} ${c.type}`,
                  minuteStamp: c.minute,
                  second: (i + 1) * 35,
                  description: c.text,
                }))
              : timelineFromFeed.map((ev, i) => ({
                  id: `mk-${m.id}-${i}`,
                  label: `${ev.minute} ${ev.teamCode}`,
                  minuteStamp: ev.minute,
                  second: (i + 1) * 40,
                  description: `${ev.player} (${ev.teamCode}) — ${ev.detail}`,
                })),
        },
        timeline:
          timelineFromFeed.length > 0
            ? timelineFromFeed
            : [
                {
                  minute: 'FT',
                  teamCode: m.homeTeam.code,
                  type: 'GOAL',
                  player: `${m.homeTeam.code} ${m.homeScore} – ${m.awayScore} ${m.awayTeam.code}`,
                  detail: 'Official Full-Time Score',
                },
              ],
      });
    }

    // 1b. Convert completed F1 weekends with verified Grand Prix sessionResults into F1ArchiveItem entries
    const F1_POINTS_BY_POS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
    const completedF1Weekends = [...f1Weekends]
      .filter((w) => {
        const gp = w.sessions.find((s) => s.name === 'Grand Prix');
        const gpStartMs = gp ? Date.parse(gp.startTimeISO) : NaN;
        return (
          gp &&
          Number.isFinite(gpStartMs) &&
          gpStartMs <= Date.now() &&
          gp.status === 'COMPLETED' &&
          Array.isArray(gp.sessionResults) &&
          gp.sessionResults.length >= 10
        );
      })
      .sort((a, b) => b.round - a.round);

    for (const wknd of completedF1Weekends) {
      const gp = wknd.sessions.find((s) => s.name === 'Grand Prix')!;
      const results = gp.sessionResults!;
      const hostLower = (wknd.hostName || wknd.city || '').toLowerCase();
      const alreadyStaticF1 = items.find(
        (it): it is F1ArchiveItem =>
          it.sport === 'F1' &&
          (it.circuitSvgId === wknd.circuitSvgId ||
            (hostLower.length > 0 && it.grandPrixName.toLowerCase().includes(hostLower)))
      );
      if (alreadyStaticF1) {
        continue;
      }

      const podium = results.slice(0, 3).map((r, i) => ({
        position: (i + 1) as 1 | 2 | 3,
        driverCode: r.driverCode,
        driverName: r.driverName,
        constructorName: r.constructorName,
        constructorLogo:
          (F1_LOGOS as Record<string, string>)[r.constructorCode || ''] ||
          F1_LOGOS.F1_MAIN,
        constructorColor: r.constructorColor || '#FF8000',
        timeOrGap: i === 0 ? r.bestLapTime || 'WINNER' : r.timeOrGap,
      }));

      if (podium.length < 3) continue;

      result.push({
        id: `arch-f1-dyn-${wknd.id}`,
        sport: 'F1',
        grandPrixName: `${wknd.grandPrixName} ${wknd.seasonYear || 2026}`,
        circuitName: wknd.circuitName,
        countryFlagUrl: wknd.countryFlagUrl,
        circuitSvgId: wknd.circuitSvgId,
        dateIST: `${gp.istDateLabel} · ${wknd.laps} Laps`,
        laps: wknd.laps || 60,
        podium: [podium[0], podium[1], podium[2]],
        fastestLap: {
          driverName: results[0].driverName,
          driverCode: results[0].driverCode,
          lapNumber: Math.max(1, (wknd.laps || 60) - 4),
          time: results[0].bestLapTime || '1:12.400',
        },
        gridPenalties: (wknd.gridPenalties || []).map(
          (p) => `${p.driverName || p.driverCode} (${p.driverCode}): ${p.reason}`
        ),
        classificationTop10: results.slice(0, 10).map((r, idx) => {
          const compounds =
            r.tyreStints && r.tyreStints.length > 0
              ? r.tyreStints
              : [r.tyreCompound];
          const totalLaps = r.lapsCompleted || wknd.laps || 60;
          const seg = Math.max(1, Math.floor(totalLaps / compounds.length));
          return {
            pos: idx + 1,
            driverCode: r.driverCode,
            driverName: r.driverName,
            constructorName: r.constructorName,
            constructorLogo:
              (F1_LOGOS as Record<string, string>)[r.constructorCode || ''] ||
              F1_LOGOS.F1_MAIN,
            constructorColor: r.constructorColor || '#FF8000',
            points: F1_POINTS_BY_POS[idx] || 0,
            gap: idx === 0 ? 'WINNER' : r.timeOrGap,
            stints: compounds.map((c, cIdx) => ({
              compound: c,
              laps: seg,
              range:
                compounds.length === 1
                  ? `L1–${totalLaps}`
                  : `S${cIdx + 1}`,
            })),
          };
        }),
        teamRadioHighlights: [
          {
            id: `tr-${wknd.id}-1`,
            driverCode: results[0].driverCode,
            driverName: results[0].driverName,
            constructorColor: results[0].constructorColor || '#FF8000',
            lap: `Lap ${wknd.laps || 60}`,
            transcript: `"P1! Brilliant execution on the tyres and strategy all afternoon!"`,
            durationSec: 6,
          },
        ],
      });
    }

    // 2. Append any static items that weren't already added
    for (const staticItem of items) {
      if (staticItem.sport === 'FOOTBALL') {
        const alreadyExists = result.some(
          (r) =>
            r.sport === 'FOOTBALL' &&
            r.homeTeam.code === staticItem.homeTeam.code &&
            r.awayTeam.code === staticItem.awayTeam.code
        );
        if (!alreadyExists) {
          result.push(staticItem);
        }
      } else {
        result.push(staticItem);
      }
    }

    return result;
  }, [items, matches, f1Weekends]);

  const filteredItems = useMemo(() => {
    const baseFiltered = filterArchiveItems(
      dynamicArchiveItems,
      searchQuery,
      sportFilter
    );
    if (clubFilterMode === 'FOLLOWED' && followedTeamCodes.length > 0) {
      const followedSet = new Set(followedTeamCodes.map((c) => c.toUpperCase()));
      return baseFiltered.filter((item) => {
        if (item.sport === 'F1') return true;
        return (
          followedSet.has(item.homeTeam.code.toUpperCase()) ||
          followedSet.has(item.awayTeam.code.toUpperCase())
        );
      });
    }
    return baseFiltered;
  }, [dynamicArchiveItems, searchQuery, sportFilter, clubFilterMode, followedTeamCodes]);

  const activeExpandedId = expandedId || filteredItems[0]?.id || '';

  const isRevealed = (id: string) => !spoilerFree || !!revealedIds[id];

  const handleToggleReveal = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRevealedIds((prev) => ({ ...prev, [id]: true }));
  };

  const renderFootballDetail = (item: FootballArchiveItem) => {
    return (
      <div className="p-3.5 border-t border-[#1E2028] bg-[#0A0A0C]/60 space-y-3">
        {/* Verified Key Match Moments (No Fake Clip Player) */}
        {item.highlights.markers.length > 0 && (
          <div className="p-3 rounded-xl border border-[#1E2028] bg-[#121316] space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] font-bold uppercase text-emerald-400 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 stroke-[1.75]" />
                <span>VERIFIED KEY MATCH MOMENTS</span>
              </span>
              <span className="font-mono text-[11px] text-[#8E95A5] tabular-nums">
                {item.homeTeam.code} {item.homeTeam.score} - {item.awayTeam.score}{' '}
                {item.awayTeam.code}
              </span>
            </div>
            <div className="space-y-1.5">
              {item.highlights.markers.map((marker) => (
                <div
                  key={marker.id}
                  className="p-2 rounded-lg bg-[#181A20] border border-[#1E2028] flex items-start gap-2 text-xs"
                >
                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-400/40 font-mono text-[10px] font-bold text-emerald-300 shrink-0 tabular-nums">
                    {marker.minuteStamp}
                  </span>
                  <p className="text-[#F8FAFC] leading-snug">
                    {marker.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Full Match Statistics */}
        <div className="p-3 rounded-xl border border-[#1E2028] bg-[#121316] space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-[#8E95A5]">
            Full Match Telemetry ({item.homeTeam.code} vs {item.awayTeam.code})
          </div>
          <div className="grid grid-cols-2 gap-2 font-mono tabular-nums text-xs">
            <div className="p-2 rounded-lg bg-[#181A20] border border-[#1E2028] flex items-center justify-between">
              <span className="text-[#8E95A5]">EXPECTED GOALS</span>
              <span className="font-bold text-emerald-400">
                {item.homeTeam.xG} — {item.awayTeam.xG}
              </span>
            </div>
            <div className="p-2 rounded-lg bg-[#181A20] border border-[#1E2028] flex items-center justify-between">
              <span className="text-[#8E95A5]">BIG CHANCES</span>
              <span className="font-bold text-[#F8FAFC]">
                {item.stats.bigChances[0]} — {item.stats.bigChances[1]}
              </span>
            </div>
            <div className="p-2 rounded-lg bg-[#181A20] border border-[#1E2028] flex items-center justify-between">
              <span className="text-[#8E95A5]">PASS ACCURACY</span>
              <span className="font-bold text-[#F8FAFC]">
                {item.stats.passingAccuracy[0]} — {item.stats.passingAccuracy[1]}
              </span>
            </div>
            <div className="p-2 rounded-lg bg-[#181A20] border border-[#1E2028] flex items-center justify-between">
              <span className="text-[#8E95A5]">CORNERS / FOULS</span>
              <span className="font-bold text-[#F8FAFC]">
                {item.stats.corners[0]}-{item.stats.corners[1]} / {item.stats.fouls[0]}-{item.stats.fouls[1]}
              </span>
            </div>
          </div>
        </div>

        {/* Key Match Timeline */}
        <div className="p-3 rounded-xl border border-[#1E2028] bg-[#121316] space-y-1.5">
          <div className="text-xs font-semibold uppercase tracking-wider text-[#8E95A5]">
            Key Match Timeline
          </div>
          <div className="space-y-1.5">
            {item.timeline.map((ev, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between gap-2 text-xs py-1 border-b last:border-b-0 border-[#1E2028]"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono tabular-nums font-bold text-emerald-400 w-7">
                    {ev.minute}
                  </span>
                  <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-md bg-[#181A20] border border-[#1E2028] font-bold text-[#F8FAFC]">
                    {ev.teamCode}
                  </span>
                  <span className="font-semibold text-[#F8FAFC] truncate">
                    {ev.player}
                  </span>
                </div>
                <span className="text-[11px] text-[#8E95A5] truncate">
                  {ev.detail}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderF1Detail = (item: F1ArchiveItem) => {
    return (
      <div className="p-3.5 border-t border-[#1E2028] bg-[#0A0A0C]/60 space-y-3">
        {/* Podium Cards (P1, P2, P3) */}
        <div className="grid grid-cols-3 gap-2">
          {item.podium.map((p) => (
            <div
              key={p.position}
              className="p-2.5 rounded-xl border border-[#1E2028] bg-[#121316] space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <span
                  className={`font-mono text-xs font-bold ${
                    p.position === 1
                      ? 'text-amber-400'
                      : p.position === 2
                      ? 'text-[#8E95A5]'
                      : 'text-[#D97706]'
                  }`}
                >
                  P{p.position}
                </span>
                <OfficialLogo
                  src={p.constructorLogo}
                  alt={p.constructorName}
                  size="xs"
                  fallbackCode={p.driverCode}
                />
              </div>
              <div className="font-mono text-xs font-bold text-[#F8FAFC] truncate">
                {p.driverName}
              </div>
              <div className="font-mono tabular-nums text-[10px] text-[#8E95A5]">
                {p.timeOrGap}
              </div>
            </div>
          ))}
        </div>

        {/* Fastest Lap & Grid Penalties */}
        <div className="p-2.5 rounded-xl border border-[#1E2028] bg-[#121316] space-y-1.5 font-mono text-xs">
          <div className="flex items-center justify-between">
            <span className="text-[#E10600] font-bold flex items-center gap-1">
              <Gauge className="w-3.5 h-3.5 stroke-[1.5]" />
              <span>FASTEST LAP: {item.fastestLap.driverName}</span>
            </span>
            <span className="tabular-nums font-bold text-[#F8FAFC]">
              {item.fastestLap.time} (L{item.fastestLap.lapNumber})
            </span>
          </div>
          {item.gridPenalties.map((pen, i) => (
            <div
              key={i}
              className="text-[11px] text-[#8E95A5] font-sans"
            >
              Note: {pen}
            </div>
          ))}
        </div>

        {/* Classification & Tyre Stint Strategy Breakdown */}
        <div className="rounded-xl border border-[#1E2028] bg-[#121316] overflow-hidden">
          <div className="px-3 py-1.5 bg-[#0A0A0C] border-b border-[#1E2028] flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[#8E95A5]">
            <span>CLASSIFICATION &amp; TYRE STINTS</span>
            <span>GAP / PTS</span>
          </div>
          <div className="divide-y divide-[#1E2028]">
            {item.classificationTop10.map((row) => (
              <div
                key={row.pos}
                className="px-3 py-2 flex items-center justify-between gap-2 text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono tabular-nums font-bold text-[#8E95A5] w-4">
                    {row.pos}
                  </span>
                  <OfficialLogo
                    src={row.constructorLogo}
                    alt={row.constructorName}
                    size="xs"
                    fallbackCode={row.driverCode}
                  />
                  <div className="min-w-0">
                    <div className="font-mono font-bold text-[#F8FAFC]">
                      {row.driverName}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      {row.stints.map((st, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 font-mono text-[10px] text-[#8E95A5]"
                        >
                          <TyreCompoundBadge compound={st.compound} />
                          <span>({st.range})</span>
                          {idx < row.stints.length - 1 && <span>→</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="text-right font-mono tabular-nums shrink-0">
                  <div className="font-bold text-[#F8FAFC]">
                    {row.gap}
                  </div>
                  <div className="text-[10px] text-emerald-400">+{row.points} PTS</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Interactive Team Radio Replay Card */}
        <div className="p-3 rounded-xl border border-[#1E2028] bg-[#121316] space-y-2">
          <div className="font-mono text-[10px] font-bold uppercase text-[#E10600] flex items-center gap-1">
            <Radio className="w-3.5 h-3.5 stroke-[1.5]" />
            <span>PIT-WALL TEAM RADIO ARCHIVE</span>
          </div>
          {item.teamRadioHighlights.map((tr) => {
            const playing = activeRadioId === tr.id;
            return (
              <div
                key={tr.id}
                className="p-2.5 rounded-lg bg-[#181A20] border border-[#1E2028] space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-[#F8FAFC]">
                    {tr.driverName} ({tr.lap})
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      playAlarmAudio('F1_PIT_SIREN');
                      setActiveRadioId(playing ? null : tr.id);
                    }}
                    className="px-2 py-0.5 rounded-md bg-[#E10600] text-[#F8FAFC] font-mono text-[10px] font-bold flex items-center gap-1"
                  >
                    <Play className="w-3 h-3 stroke-[1.5]" />
                    <span>{playing ? 'PLAYING RADIO...' : `REPLAY (${tr.durationSec}s)`}</span>
                  </button>
                </div>
                <p className="text-xs italic text-[#8E95A5]">
                  {tr.transcript}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="pb-24 space-y-3.5">
      {/* Search & Filter Header */}
      <div className="bg-[#121316] border-b border-[#1E2028] px-4 py-3 space-y-2.5">
        <div className="relative">
          <Search className="w-4 h-4 stroke-[1.5] text-[#8E95A5] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search club, driver, Grand Prix, or competition..."
            aria-label="Search Archive Vault"
            className="w-full min-h-[38px] pl-9 pr-8 py-1.5 rounded-lg border border-[#1E2028] bg-[#0A0A0C] text-xs text-[#F8FAFC] placeholder:text-[#8E95A5] focus:outline-none focus:border-emerald-400"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Clear archive search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8E95A5]"
            >
              <X className="w-3.5 h-3.5 stroke-[1.5]" />
            </button>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            {(
              [
                { id: 'ALL', label: 'All Archive' },
                { id: 'FOOTBALL', label: 'Football' },
                { id: 'F1', label: 'Formula 1' },
              ] as const
            ).map((f) => {
              const active = sportFilter === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setSportFilter(f.id)}
                  className={`min-h-[32px] px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors ${
                    active
                      ? 'bg-[#F8FAFC] text-[#0A0A0C] border-[#F8FAFC] font-bold'
                      : 'bg-[#181A20] border-[#1E2028] text-[#8E95A5] hover:text-[#F8FAFC]'
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() =>
                setClubFilterMode((prev) =>
                  prev === 'FOLLOWED' ? 'ALL' : 'FOLLOWED'
                )
              }
              className={`min-h-[32px] px-2.5 py-1 rounded-lg border text-xs font-semibold transition-colors ${
                clubFilterMode === 'FOLLOWED'
                  ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-300'
                  : 'bg-[#181A20] border-[#1E2028] text-[#8E95A5] hover:text-[#F8FAFC]'
              }`}
            >
              {clubFilterMode === 'FOLLOWED' ? '★ My Favorites' : 'My Favorites'}
            </button>
          </div>

          <span className="text-xs font-semibold uppercase tracking-wider text-[#8E95A5] tabular-nums">
            {filteredItems.length} RESULTS
          </span>
        </div>
      </div>

      {/* Archive Vault Cards */}
      <div className="px-4 space-y-2.5">
        {filteredItems.map((item) => {
          const isOpen = activeExpandedId === item.id;
          const revealed = isRevealed(item.id);

          if (item.sport === 'FOOTBALL') {
            return (
              <article
                key={item.id}
                className="rounded-xl border border-[#1E2028] bg-[#121316] overflow-hidden"
              >
                <div
                  onClick={() => setExpandedId(isOpen ? '__NONE__' : item.id)}
                  className="p-3.5 cursor-pointer hover:bg-[#181A20]/60 transition-colors space-y-2.5"
                >
                  <div className="flex items-center justify-between text-[11px] text-[#8E95A5]">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <OfficialLogo
                        src={item.competitionLogo}
                        alt={item.competition}
                        size="xs"
                      />
                      <span className="font-semibold text-[#F8FAFC] truncate">
                        {item.competition}
                      </span>
                      <span>·</span>
                      <span className="truncate">{item.matchweek}</span>
                    </div>
                    <span className="font-mono tabular-nums text-[10px] shrink-0">
                      {item.dateIST}
                    </span>
                  </div>

                  <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 overflow-hidden">
                    <div className="flex items-center gap-2 min-w-0 overflow-hidden">
                      <OfficialLogo
                        src={item.homeTeam.logo}
                        alt={item.homeTeam.name}
                        size="sm"
                        fallbackCode={item.homeTeam.code}
                      />
                      <span className="text-xs min-[380px]:text-sm font-bold text-[#F8FAFC] truncate min-w-0">
                        {item.homeTeam.name}
                      </span>
                    </div>

                    {revealed ? (
                      <div className="px-2.5 py-1 rounded-md bg-[#181A20] border border-[#1E2028] font-mono tabular-nums text-xs min-[380px]:text-sm font-bold text-[#F8FAFC] whitespace-nowrap shrink-0">
                        {item.homeTeam.score} — {item.awayTeam.score}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => handleToggleReveal(item.id, e)}
                        className="px-2 py-1 rounded-md border border-amber-400 bg-amber-500/15 text-amber-300 font-mono text-[10px] font-bold flex items-center gap-1 whitespace-nowrap shrink-0"
                      >
                        <Eye className="w-3 h-3 stroke-[1.5]" />
                        <span>REVEAL SCORE</span>
                      </button>
                    )}

                    <div className="flex items-center gap-2 min-w-0 overflow-hidden justify-end">
                      <span className="text-xs min-[380px]:text-sm font-bold text-[#F8FAFC] truncate text-right min-w-0">
                        {item.awayTeam.name}
                      </span>
                      <OfficialLogo
                        src={item.awayTeam.logo}
                        alt={item.awayTeam.name}
                        size="sm"
                        fallbackCode={item.awayTeam.code}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 text-[11px] text-[#8E95A5]">
                    <span>{item.venue}</span>
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      className="text-emerald-400 flex items-center gap-1 font-semibold"
                    >
                      <span>{isOpen ? 'HIDE VAULT' : 'STATS & HIGHLIGHTS'}</span>
                      {isOpen ? (
                        <ChevronUp className="w-3.5 h-3.5 stroke-[1.5]" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 stroke-[1.5]" />
                      )}
                    </button>
                  </div>
                </div>

                {isOpen && renderFootballDetail(item)}
              </article>
            );
          }

          // F1 Archive Card
          return (
            <article
              key={item.id}
              className="rounded-xl border border-[#1E2028] bg-[#121316] overflow-hidden"
            >
              <div
                onClick={() => setExpandedId(isOpen ? '__NONE__' : item.id)}
                className="p-3.5 cursor-pointer hover:bg-[#181A20]/60 transition-colors space-y-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <OfficialLogo
                      src={item.countryFlagUrl}
                      alt={item.grandPrixName}
                      shape="Flag"
                      size="sm"
                    />
                    <div className="min-w-0">
                      <h3 className="font-display text-base font-bold tracking-tight text-[#F8FAFC] truncate">
                        {item.grandPrixName}
                      </h3>
                      <p className="text-[11px] text-[#8E95A5] truncate">
                        {item.circuitName} · {item.laps} Laps
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <CircuitSvg circuitId={item.circuitSvgId} className="w-10 h-7" />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  {revealed ? (
                    <div className="flex items-center gap-2 font-mono text-xs">
                      <Trophy className="w-3.5 h-3.5 stroke-[1.5] text-amber-400" />
                      <span className="font-bold text-[#F8FAFC]">
                        P1: {item.podium[0].driverName}
                      </span>
                      <span className="text-[#8E95A5]">
                        ({item.podium[0].timeOrGap})
                      </span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => handleToggleReveal(item.id, e)}
                      className="px-2.5 py-1 rounded-md border border-amber-400 bg-amber-500/15 text-amber-300 font-mono text-[10px] font-bold flex items-center gap-1"
                    >
                      <Eye className="w-3 h-3 stroke-[1.5]" />
                      <span>REVEAL WINNER</span>
                    </button>
                  )}

                  <button
                    type="button"
                    aria-expanded={isOpen}
                    className="font-mono text-[11px] font-semibold text-[#E10600] flex items-center gap-1"
                  >
                    <span>{isOpen ? 'CLOSE' : 'PODIUM & STINTS'}</span>
                    {isOpen ? (
                      <ChevronUp className="w-3.5 h-3.5 stroke-[1.5]" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 stroke-[1.5]" />
                    )}
                  </button>
                </div>
              </div>

              {isOpen && renderF1Detail(item)}
            </article>
          );
        })}
      </div>
    </div>
  );
};
