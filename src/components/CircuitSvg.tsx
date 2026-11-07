import React, { useState } from 'react';
import { CircuitSvgId, TyreCompound } from '../types/sports';
import { F1_DRIVER_HEADSHOTS } from '../services/f1AutoSync';

interface CircuitSvgProps {
  circuitId: CircuitSvgId | string;
  className?: string;
  strokeColorClass?: string;
}

const CIRCUIT_PATHS: Record<string, string> = {
  interlagos:
    'M 12 34 C 8 24, 15 10, 32 11 C 48 12, 66 16, 68 28 C 70 39, 50 44, 38 38 C 30 34, 35 23, 46 25 C 55 26, 52 36, 33 42 C 20 45, 14 40, 12 34 Z',
  vegas:
    'M 10 38 L 64 38 C 72 38, 74 26, 66 21 L 48 21 C 42 21, 40 12, 28 12 C 18 12, 12 19, 12 28 Z',
  lusail:
    'M 12 38 L 62 38 C 70 38, 70 24, 58 24 L 45 24 C 39 24, 42 12, 32 12 C 21 12, 24 26, 16 26 C 10 26, 9 38, 12 38 Z',
  yas_marina:
    'M 10 35 L 46 35 L 52 14 L 68 14 L 65 38 L 28 41 L 12 24 Z',
  monaco:
    'M 10 35 C 16 20, 32 12, 50 14 C 65 16, 70 24, 62 32 C 50 39, 32 34, 21 40 C 13 43, 8 40, 10 35 Z',
  silverstone:
    'M 16 38 L 32 12 L 56 15 L 68 29 L 51 40 L 32 35 Z',
  monza:
    'M 10 35 L 62 35 C 70 35, 70 21, 59 18 L 24 15 C 13 15, 8 26, 10 35 Z',
  bahrain:
    'M 12 38 L 62 38 L 66 24 L 46 14 L 28 24 L 38 30 L 18 30 L 14 16 L 10 28 Z',
  jeddah:
    'M 10 34 C 24 28, 44 20, 68 16 C 72 18, 66 26, 48 32 C 30 37, 16 40, 10 34 Z',
  albert_park:
    'M 14 34 C 18 18, 38 12, 58 18 C 68 22, 66 36, 48 38 C 32 40, 18 39, 14 34 Z',
  suzuka:
    'M 12 32 C 20 16, 36 16, 42 26 C 48 36, 64 34, 68 22 C 64 12, 46 14, 38 24 C 30 34, 18 40, 12 32 Z',
  shanghai:
    'M 12 36 L 62 36 L 64 20 L 36 22 C 26 22, 26 12, 36 12 C 44 12, 44 20, 36 26 L 14 26 Z',
  miami:
    'M 10 30 L 42 28 L 66 22 C 70 26, 66 36, 52 36 L 26 36 C 14 36, 8 34, 10 30 Z',
  imola:
    'M 10 34 L 36 26 L 64 20 L 68 30 L 40 36 L 14 38 Z',
  montreal:
    'M 10 32 L 58 24 L 68 28 L 54 36 L 20 38 Z',
  barcelona:
    'M 12 36 L 62 36 C 68 32, 64 18, 50 18 L 24 20 C 14 22, 10 30, 12 36 Z',
  red_bull_ring:
    'M 14 36 L 60 34 L 64 16 L 38 20 L 28 14 L 14 24 Z',
  hungaroring:
    'M 14 36 L 56 36 C 64 32, 62 18, 48 16 C 36 14, 34 26, 24 22 C 14 20, 10 28, 14 36 Z',
  spa:
    'M 14 38 L 28 14 L 58 18 L 66 32 L 42 36 L 26 28 Z',
  zandvoort:
    'M 14 36 L 54 36 C 64 32, 64 16, 48 16 C 36 16, 38 28, 26 26 L 14 28 Z',
  baku:
    'M 10 36 L 66 36 L 66 18 L 42 18 L 40 28 L 16 28 L 10 36 Z',
  marina_bay:
    'M 12 36 L 58 36 L 64 20 L 42 16 L 36 26 L 16 24 Z',
  cota:
    'M 12 36 L 36 14 L 66 26 L 52 38 L 28 32 Z',
  mexico:
    'M 12 36 L 62 36 L 64 24 L 40 24 L 38 14 L 22 18 L 22 30 L 12 30 Z',
  portimao:
    'M 12 36 L 60 36 C 66 30, 62 16, 48 16 L 32 24 L 22 16 L 12 26 Z',
  madrid:
    'M 12 34 L 46 34 C 58 34, 68 24, 62 16 C 54 10, 38 16, 32 24 L 14 24 Z',
  istanbul:
    'M 14 36 L 54 36 L 64 22 L 46 14 L 32 22 L 18 18 L 12 28 Z',
};

export const CircuitSvg: React.FC<CircuitSvgProps> = ({
  circuitId,
  className = 'w-12 h-9',
  strokeColorClass = 'text-white',
}) => {
  const dPath = CIRCUIT_PATHS[circuitId] || CIRCUIT_PATHS.interlagos;

  return (
    <svg
      viewBox="0 0 80 50"
      fill="none"
      className={className}
      aria-label={`${circuitId} circuit layout`}
    >
      <path
        d={dPath}
        stroke="currentColor"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={strokeColorClass}
      />
      <circle cx="16" cy="35" r="2.6" className="fill-[#E10600]" />
    </svg>
  );
};

/**
 * Official F1 App White Circuit Layout Map (`w-24 h-16`).
 * Renders the official F1 media track carbon icon filtered to crisp white,
 * and falls back seamlessly to the custom white SVG track path when offline.
 */
export const WhiteTrackMap: React.FC<{
  circuitId: CircuitSvgId | string;
  trackMapUrl?: string;
  hostName?: string;
  alt?: string;
  className?: string;
}> = ({
  circuitId,
  trackMapUrl,
  hostName,
  alt = 'Circuit layout',
  className = 'w-24 h-16',
}) => {
  const [imgFailed, setImgFailed] = useState(false);
  const normalizedHostForF1Media = hostName
    ? hostName
        .split(' - ')[0]
        .replace('Spain (Barcelona)', 'Spain')
        .replace('Mexico City', 'Mexico')
        .replace('Türkiye', 'Turkey')
        .replace('Sakhir', 'Bahrain')
        .trim()
    : '';
  const hasOfficialCarbonPng =
    Boolean(normalizedHostForF1Media) &&
    !hostName?.includes('Madrid');
  const resolvedTrackUrl =
    trackMapUrl ||
    (hasOfficialCarbonPng
      ? `https://media.formula1.com/image/upload/f_auto,c_limit,w_300,q_auto/content/dam/fom-website/2018-redesign-assets/Track%20icons%204x3/${encodeURIComponent(
          normalizedHostForF1Media
        )}%20carbon.png`
      : undefined);

  return (
    <div className={`relative flex items-center justify-center shrink-0 ${className}`}>
      {resolvedTrackUrl && !imgFailed ? (
        <img
          src={resolvedTrackUrl}
          alt={alt}
          referrerPolicy="no-referrer"
          loading="lazy"
          onError={() => setImgFailed(true)}
          className="w-full h-full object-contain brightness-0 invert opacity-95 select-none"
        />
      ) : (
        <CircuitSvg
          circuitId={circuitId}
          className="w-full h-full"
          strokeColorClass="text-white"
        />
      )}
    </div>
  );
};

/**
 * Official F1 Driver Headshot Avatar with team color accent & offline fallback.
 */
export const F1DriverAvatar: React.FC<{
  driverCode?: string;
  code?: string;
  driverName?: string;
  name?: string;
  driverNumber?: number;
  headshotUrl?: string;
  src?: string;
  teamColor?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}> = ({
  driverCode,
  code,
  driverName,
  name,
  driverNumber,
  headshotUrl,
  src,
  teamColor = '#E10600',
  size = 'md',
  className = '',
}) => {
  const [imgFailed, setImgFailed] = useState(false);
  const resolvedCode = (driverCode || code || 'F1').toUpperCase();
  const resolvedName = driverName || name || resolvedCode;
  const candidateSrc = headshotUrl || src || '';
  const isLegacyBrokenUrl =
    candidateSrc.includes('/drivers/A/ANDANT01') ||
    candidateSrc.includes('/drivers/C/CARSAI01');
  const resolvedSrc =
    (!isLegacyBrokenUrl && candidateSrc) ||
    F1_DRIVER_HEADSHOTS[resolvedCode] ||
    '';

  const sizeMap = {
    sm: 'w-8 h-8 text-[10px]',
    md: 'w-10 h-10 text-xs',
    lg: 'w-14 h-14 text-sm',
    xl: 'w-24 h-24 text-xl',
  };

  return (
    <div
      className={`relative rounded-full overflow-hidden bg-[#1F1F2B] border border-white/10 flex items-end justify-center shrink-0 ${sizeMap[size]} ${className}`}
      style={{ borderBottomColor: teamColor, borderBottomWidth: '2px' }}
    >
      {resolvedSrc && !imgFailed ? (
        <img
          src={resolvedSrc}
          alt={resolvedName}
          referrerPolicy="no-referrer"
          loading="lazy"
          onLoad={(e) => {
            if (e.currentTarget.naturalWidth > 0 && e.currentTarget.naturalWidth <= 100) {
              setImgFailed(true);
            }
          }}
          onError={() => setImgFailed(true)}
          className="w-full h-full object-cover object-top select-none"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center font-display font-bold text-white tracking-tight">
          {driverNumber ? `#${driverNumber}` : resolvedCode}
        </div>
      )}
    </div>
  );
};

interface TyreBadgeProps {
  compound: TyreCompound;
  ageLaps?: number;
}

export const TyreCompoundBadge: React.FC<TyreBadgeProps> = ({
  compound,
  ageLaps,
}) => {
  const ringColors: Record<TyreCompound, string> = {
    S: 'border-[#E10600] text-[#E10600]',
    M: 'border-[#F59E0B] text-[#F59E0B]',
    H: 'border-zinc-300 text-zinc-100',
    I: 'border-[#00D66C] text-[#00D66C]',
    W: 'border-[#3B82F6] text-[#3B82F6]',
  };

  return (
    <div className="inline-flex items-center gap-1 tabular-nums">
      <span
        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-[10px] font-bold bg-[#15151E] ${ringColors[compound]}`}
        title={`Tyre Compound ${compound}`}
      >
        {compound}
      </span>
      {typeof ageLaps === 'number' && (
        <span className="text-[11px] text-zinc-400">{ageLaps}L</span>
      )}
    </div>
  );
};
