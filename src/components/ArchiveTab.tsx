import React, { useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Eye,
  Gauge,
  Pause,
  Play,
  Radio,
  Search,
  Trophy,
  X,
} from 'lucide-react';
import {
  ArchiveItem,
  F1ArchiveItem,
  FootballArchiveItem,
  SportFilter,
} from '../types/sports';
import { filterArchiveItems } from '../utils/scheduleLogic';
import { OfficialLogo } from './OfficialLogo';
import { CircuitSvg, TyreCompoundBadge } from './CircuitSvg';
import { playAlarmAudio } from '../utils/soundEngine';

interface ArchiveTabProps {
  items: ArchiveItem[];
  spoilerFree: boolean;
}

export const ArchiveTab: React.FC<ArchiveTabProps> = ({
  items,
  spoilerFree,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sportFilter, setSportFilter] = useState<SportFilter>('ALL');
  const [expandedId, setExpandedId] = useState<string>(items[0]?.id || 'arch-fb-1');
  const [revealedIds, setRevealedIds] = useState<Record<string, boolean>>({});
  const [scrubberState, setScrubberState] = useState<
    Record<
      string,
      { currentSecond: number; isPlaying: boolean; activeCaption: string }
    >
  >({});
  const [activeRadioId, setActiveRadioId] = useState<string | null>(null);

  const filteredItems = useMemo(
    () => filterArchiveItems(items, searchQuery, sportFilter),
    [items, searchQuery, sportFilter]
  );

  const isRevealed = (id: string) => !spoilerFree || !!revealedIds[id];

  const handleToggleReveal = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRevealedIds((prev) => ({ ...prev, [id]: true }));
  };

  const handleJumpToMarker = (
    item: FootballArchiveItem,
    marker: FootballArchiveItem['highlights']['markers'][number]
  ) => {
    setScrubberState((prev) => ({
      ...prev,
      [item.id]: {
        currentSecond: marker.second,
        isPlaying: true,
        activeCaption: `${marker.minuteStamp} — ${marker.description}`,
      },
    }));
  };

  const renderFootballDetail = (item: FootballArchiveItem) => {
    const state = scrubberState[item.id] || {
      currentSecond: item.highlights.markers[0]?.second || 22,
      isPlaying: false,
      activeCaption: item.highlights.markers[0]
        ? `${item.highlights.markers[0].minuteStamp} — ${item.highlights.markers[0].description}`
        : 'Select a highlight timestamp below.',
    };
    const progressPct = Math.min(
      100,
      Math.round((state.currentSecond / item.highlights.durationSeconds) * 100)
    );

    return (
      <div className="p-3.5 border-t border-[#1E2028] bg-[#0A0A0C]/60 space-y-3">
        {/* Interactive Match Highlights Player Card */}
        <div className="p-3 rounded-xl border border-[#1E2028] bg-[#121316] space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] font-bold uppercase text-emerald-400 flex items-center gap-1">
              <Play className="w-3 h-3 stroke-[1.5]" />
              <span>MATCH HIGHLIGHTS VAULT PLAYER</span>
            </span>
            <span className="font-mono tabular-nums text-[10px] text-[#8E95A5]">
              {Math.floor(state.currentSecond / 60)}:
              {String(state.currentSecond % 60).padStart(2, '0')} / 03:00
            </span>
          </div>

          {/* Broadcast Frame */}
          <div className="p-2.5 rounded-lg bg-[#0A0A0C] border border-[#1E2028] text-[#F8FAFC] space-y-2">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() =>
                  setScrubberState((prev) => ({
                    ...prev,
                    [item.id]: {
                      ...state,
                      isPlaying: !state.isPlaying,
                    },
                  }))
                }
                aria-label={state.isPlaying ? 'Pause Highlights' : 'Play Highlights'}
                className="min-h-[32px] px-2.5 py-1 rounded-md bg-emerald-400 text-[#0A0A0C] font-mono text-[11px] font-bold flex items-center gap-1"
              >
                {state.isPlaying ? (
                  <>
                    <Pause className="w-3.5 h-3.5 stroke-[1.5]" />
                    <span>PAUSE</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 stroke-[1.5]" />
                    <span>PLAY CLIP</span>
                  </>
                )}
              </button>
              <span className="font-mono text-[11px] text-[#8E95A5] tabular-nums">
                {item.homeTeam.code} {item.homeTeam.score} - {item.awayTeam.score}{' '}
                {item.awayTeam.code}
              </span>
            </div>

            <p className="text-xs text-[#F8FAFC] font-medium leading-snug">
              {state.activeCaption}
            </p>

            {/* Video Scrubber Bar */}
            <div className="h-1.5 w-full rounded-md bg-[#181A20] overflow-hidden">
              <div
                className="h-full bg-emerald-400 transition-all duration-150"
                style={{ width: `${progressPct}%` }}
              />
            </div>

            {/* Key Timestamp Scrubber Markers */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {item.highlights.markers.map((marker) => {
                const active = state.currentSecond === marker.second;
                return (
                  <button
                    key={marker.id}
                    type="button"
                    onClick={() => handleJumpToMarker(item, marker)}
                    className={`px-2 py-1 rounded-md border font-mono text-[10px] font-semibold transition-colors ${
                      active
                        ? 'bg-emerald-400 border-emerald-400 text-[#0A0A0C]'
                        : 'bg-[#121316] border-[#1E2028] text-[#F8FAFC] hover:border-emerald-400'
                    }`}
                  >
                    {marker.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

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

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
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
          </div>

          <span className="text-xs font-semibold uppercase tracking-wider text-[#8E95A5] tabular-nums">
            {filteredItems.length} RESULTS
          </span>
        </div>
      </div>

      {/* Archive Vault Cards */}
      <div className="px-4 space-y-2.5">
        {filteredItems.map((item) => {
          const isOpen = expandedId === item.id;
          const revealed = isRevealed(item.id);

          if (item.sport === 'FOOTBALL') {
            return (
              <article
                key={item.id}
                className="rounded-xl border border-[#1E2028] bg-[#121316] overflow-hidden"
              >
                <div
                  onClick={() => setExpandedId(isOpen ? '' : item.id)}
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

                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <OfficialLogo
                        src={item.homeTeam.logo}
                        alt={item.homeTeam.name}
                        size="sm"
                        fallbackCode={item.homeTeam.code}
                      />
                      <span className="text-sm font-bold text-[#F8FAFC] truncate">
                        {item.homeTeam.name}
                      </span>
                    </div>

                    {revealed ? (
                      <div className="px-2.5 py-1 rounded-md bg-[#181A20] border border-[#1E2028] font-mono tabular-nums text-sm font-bold text-[#F8FAFC]">
                        {item.homeTeam.score} — {item.awayTeam.score}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => handleToggleReveal(item.id, e)}
                        className="px-2.5 py-1 rounded-md border border-amber-400 bg-amber-500/15 text-amber-300 font-mono text-[10px] font-bold flex items-center gap-1"
                      >
                        <Eye className="w-3 h-3 stroke-[1.5]" />
                        <span>REVEAL SCORE</span>
                      </button>
                    )}

                    <div className="flex items-center gap-2 min-w-0 justify-end">
                      <span className="text-sm font-bold text-[#F8FAFC] truncate">
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
                onClick={() => setExpandedId(isOpen ? '' : item.id)}
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
