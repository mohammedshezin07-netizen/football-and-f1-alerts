import React, { useState } from 'react';

interface OfficialLogoProps {
  src: string;
  alt: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  shape?: 'rounded' | 'Flag';
  className?: string;
  fallbackCode?: string;
}

/**
 * Reusable <OfficialLogo src={url} alt={name} /> component that renders official
 * Football club crests, league badges, Formula 1 constructor logos, and country flags
 * inside a clean, high-contrast badge container so dark logos (Juventus, Champions League,
 * Mercedes) remain 100% legible in #090A0C OLED Dark Mode.
 */
export const OfficialLogo: React.FC<OfficialLogoProps> = ({
  src,
  alt,
  size = 'md',
  shape = 'rounded',
  className = '',
  fallbackCode,
}) => {
  const [hasError, setHasError] = useState(false);

  const sizeMap = {
    xs: 'w-5 h-5 p-0.5',
    sm: 'w-6 h-6 p-1',
    md: 'w-8 h-8 p-1',
    lg: 'w-10 h-10 p-1.5',
  };

  const flagSizeMap = {
    xs: 'w-5 h-3.5',
    sm: 'w-6 h-4',
    md: 'w-7 h-5',
    lg: 'w-9 h-6',
  };

  const initials = (
    fallbackCode ||
    alt
      .replace(/[^A-Za-z0-9 ]/g, '')
      .split(' ')
      .filter(Boolean)
      .map((w) => w[0])
      .join('')
      .slice(0, 3)
  ).toUpperCase();

  const isFerrariSvg = src.includes('Scuderia_Ferrari_Logo.svg');
  const isRedBullSvg = src.includes('Red_Bull_Racing_logo.svg');
  const isAlpineSvg = src.includes('cdn.simpleicons.org/alpine');

  if (shape === 'Flag') {
    return (
      <span
        className={`inline-flex items-center justify-center overflow-hidden rounded-[3px] border border-[#E2E5EC] dark:border-[#2A303C] bg-[#FFFFFF] shrink-0 ${flagSizeMap[size]} ${className}`}
      >
        {!hasError ? (
          <img
            src={src}
            alt={alt}
            referrerPolicy="no-referrer"
            loading="eager"
            onError={() => setHasError(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="font-mono text-[9px] font-bold text-[#0D0F12] tracking-tighter">
            {initials.slice(0, 2)}
          </span>
        )}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center justify-center rounded-md bg-[#F8FAFC] dark:bg-[#F1F5F9] border border-[#E2E5EC] dark:border-[#2E3442] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] shrink-0 ${sizeMap[size]} ${className}`}
      title={alt}
    >
      {isFerrariSvg ? (
        <svg viewBox="0 0 24 24" className="w-full h-full" aria-label={alt}>
          <path d="M4 3h16v11c0 4.5-3.5 7.5-8 9-4.5-1.5-8-4.5-8-9V3z" fill="#FFF200" stroke="#0D0F12" strokeWidth="1.5" />
          <path d="M4 3h16v2.5H4z" fill="#009246" />
          <path d="M4 5.5h16v2H4z" fill="#E10600" />
          <text x="12" y="16.5" textAnchor="middle" fill="#0D0F12" fontSize="6.5" fontWeight="900" fontFamily="monospace">SF</text>
        </svg>
      ) : isRedBullSvg ? (
        <svg viewBox="0 0 24 24" className="w-full h-full" aria-label={alt}>
          <rect x="2" y="4" width="20" height="16" rx="3" fill="#1E293B" />
          <circle cx="12" cy="12" r="4.5" fill="#FACC15" />
          <path d="M5 13l5-2v3L5 13zm14 0l-5-2v3l5-1z" fill="#E10600" />
        </svg>
      ) : isAlpineSvg ? (
        <svg viewBox="0 0 24 24" className="w-full h-full" aria-label={alt}>
          <rect x="2" y="4" width="20" height="16" rx="3" fill="#0090FF" />
          <path d="M6 16l6-8 4 8H6zm5-2h3l-1.5-3L11 14z" fill="#FFFFFF" />
        </svg>
      ) : !hasError ? (
        <img
          src={src}
          alt={alt}
          referrerPolicy="no-referrer"
          loading="eager"
          onError={() => setHasError(true)}
          className="w-full h-full object-contain select-none"
        />
      ) : (
        <span className="font-mono text-[9px] font-bold text-[#0D0F12] tracking-tighter leading-none">
          {initials}
        </span>
      )}
    </span>
  );
};
