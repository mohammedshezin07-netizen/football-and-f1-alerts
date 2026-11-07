import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, Moon, Share2, Sun, WifiOff } from 'lucide-react';
import { subscribeRateLimitBanner } from '../services/apiClient';

interface TopUtilityBarProps {
  isOnline: boolean;
  onToggleOnline?: () => void;
  spoilerFree: boolean;
  onToggleSpoilerFree: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
  lastVerifiedIST?: string;
  onOpenInstallAndSyncModal?: () => void;
}

export const TopUtilityBar: React.FC<TopUtilityBarProps> = ({
  isOnline,
  spoilerFree,
  onToggleSpoilerFree,
  isDark,
  onToggleTheme,
  onOpenInstallAndSyncModal,
}) => {
  const [rateLimitMessage, setRateLimitMessage] = useState<string | null>(null);

  useEffect(() => {
    return subscribeRateLimitBanner((state) => {
      setRateLimitMessage(state.active ? state.message : null);
    });
  }, []);

  const showOfflineSnackbar = !isOnline || Boolean(rateLimitMessage);

  return (
    <header className="sticky top-0 z-30 pt-[env(safe-area-inset-top)] bg-[#0A0A0C]/95 backdrop-blur-md border-b border-[#1E2028]">
      {/* Primary Brand & Utility Bar */}
      <div className="px-4 h-13 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-display text-base font-bold tracking-tight text-[#F8FAFC] whitespace-nowrap">
            APEX PITCH
          </span>
          <span className="px-1.5 py-0.5 rounded-md bg-[#121316] border border-[#1E2028] text-[10px] font-semibold uppercase tracking-wider text-[#8E95A5] tabular-nums">
            IST
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onToggleSpoilerFree}
            data-testid="avoid-spoilers-change-btn"
            aria-pressed={spoilerFree}
            title="Toggle Avoid Spoilers Mode"
            className={`h-8 px-2.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0 ${
              spoilerFree
                ? 'border-amber-400/50 bg-amber-400/15 text-amber-300'
                : 'border-[#1E2028] bg-[#121316] text-[#8E95A5] hover:text-[#F8FAFC]'
            }`}
          >
            {spoilerFree ? (
              <>
                <EyeOff className="w-3.5 h-3.5 stroke-[1.75] text-amber-400" />
                <span>No Spoilers</span>
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5 stroke-[1.75]" />
                <span>Scores On</span>
              </>
            )}
          </button>

          {onOpenInstallAndSyncModal && (
            <button
              type="button"
              onClick={onOpenInstallAndSyncModal}
              data-testid="open-apk-ota-modal-btn"
              title="Install App & Share Link"
              className="h-8 px-2.5 rounded-lg border border-[#1E2028] bg-[#121316] text-[#F8FAFC] hover:border-white/25 text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0"
            >
              <Share2 className="w-3.5 h-3.5 stroke-[1.75] text-[#E10600]" />
              <span>App / Share</span>
            </button>
          )}

          <button
            type="button"
            onClick={onToggleTheme}
            data-testid="theme-toggle-btn"
            aria-pressed={!isDark}
            aria-label={isDark ? 'Switch to Daylight Mode' : 'Switch to Night Mode'}
            className="h-8 w-8 rounded-lg border border-[#1E2028] bg-[#121316] text-[#8E95A5] hover:text-[#F8FAFC] flex items-center justify-center transition-colors shrink-0"
          >
            {isDark ? (
              <Sun className="w-3.5 h-3.5 stroke-[1.75] text-amber-400" />
            ) : (
              <Moon className="w-3.5 h-3.5 stroke-[1.75] text-slate-700" />
            )}
          </button>
        </div>
      </div>

      {/* Subtle Non-Intrusive Offline / Rate-Limit Snackbar */}
      {showOfflineSnackbar && (
        <div
          role="status"
          data-testid="offline-cache-snackbar"
          className="px-4 py-1.5 bg-[#121316] border-t border-[#1E2028] text-[11px] text-[#8E95A5] font-medium flex items-center justify-center gap-1.5"
        >
          <WifiOff className="w-3 h-3 text-amber-400 shrink-0" />
          <span>Using offline cache — live sync pending</span>
        </div>
      )}
    </header>
  );
};

