import React, { useState } from 'react';
import {
  Copy,
  RefreshCw,
  Share2,
  X,
  Check,
  HelpCircle,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const SHARED_APP_LIVE_URL =
  'https://football-and-f1-alerts-kg7j.vercel.app';

interface AppInstallAndSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onForceLiveSync: () => void;
  lastVerifiedIST?: string;
}

export const AppInstallAndSyncModal: React.FC<AppInstallAndSyncModalProps> = ({
  isOpen,
  onClose,
  onForceLiveSync,
  lastVerifiedIST,
}) => {
  const { otaCheckStatus, checkForOTAUpdateNow } = usePWAInstall();

  const [copiedUrl, setCopiedUrl] = useState(false);
  const [showHowToInstallDescription, setShowHowToInstallDescription] =
    useState(false);

  if (!isOpen) return null;

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(SHARED_APP_LIVE_URL);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2500);
    } catch {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2500);
    }
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'APEX // PITCH — IST Football & F1 Companion',
          text: 'Live Football & Formula 1 schedules, standings, and IST alerts:',
          url: SHARED_APP_LIVE_URL,
        });
        return;
      } catch {
        // Fallback to copy
      }
    }
    await handleCopyUrl();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="App Install & Share Hub"
      data-testid="apk-ota-sync-modal"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      <div className="w-full max-w-[430px] max-h-[88vh] overflow-y-auto rounded-t-2xl sm:rounded-xl border border-[#1E2028] bg-[#121316] text-[#F8FAFC] shadow-2xl pb-[env(safe-area-inset-bottom)]">
        {/* Compact Modal Header with Uploaded App Logo */}
        <div className="px-4 py-3 border-b border-[#1E2028] bg-[#0A0A0C] flex items-center justify-between gap-2 sticky top-0 z-10">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src="/assets/aistudio/Gemini_Generated_Image_rawui5rawui5rawu_94856f7b.png"
              alt="APEX PITCH Logo"
              className="w-8 h-8 rounded-lg object-cover border border-[#1E2028] shrink-0"
            />
            <div className="min-w-0">
              <h2 className="font-display text-xs font-bold tracking-wider uppercase text-[#F8FAFC] truncate">
                Share App &amp; Live Data Sync
              </h2>
              <p className="text-[11px] text-[#8E95A5] truncate">
                APEX PITCH • Web &amp; Home Screen App
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            data-testid="close-apk-ota-modal-btn"
            aria-label="Close App Install and Share Modal"
            className="w-7 h-7 rounded-lg bg-[#181A20] border border-[#1E2028] hover:border-white/25 flex items-center justify-center text-[#8E95A5] hover:text-[#F8FAFC]"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="p-4 space-y-3 text-xs">
          {/* 1. Share PWA Vercel Link + Compact Expandable Info Icon */}
          <div className="rounded-xl bg-[#0A0A0C] border border-[#1E2028] p-3.5 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-amber-400/15 border border-amber-400/30 flex items-center justify-center shrink-0">
                  <Share2 className="w-3.5 h-3.5 text-amber-400" />
                </div>
                <span className="font-bold text-[#F8FAFC] truncate">
                  Share App Link
                </span>
              </div>

              {/* Small Icon Button to Expand Install / Shortcut Instructions Only When Pressed */}
              <button
                type="button"
                data-testid="toggle-install-help-icon-btn"
                onClick={() =>
                  setShowHowToInstallDescription((prev) => !prev)
                }
                aria-expanded={showHowToInstallDescription}
                aria-label="How to install or create shortcut"
                title="How to install or create shortcut"
                className={`h-7 px-2 rounded-lg border text-[10px] font-semibold flex items-center gap-1 transition-colors shrink-0 ${
                  showHowToInstallDescription
                    ? 'bg-amber-400 text-[#0A0A0C] border-amber-400 font-bold'
                    : 'bg-[#181A20] border-[#1E2028] text-[#8E95A5] hover:text-[#F8FAFC]'
                }`}
              >
                <HelpCircle className="w-3.5 h-3.5 shrink-0" />
                <span>How to Install</span>
              </button>
            </div>

            {/* Expandable Description (Hidden by default; expands only when small icon button is pressed) */}
            {showHowToInstallDescription && (
              <div
                data-testid="expanded-install-shortcut-guide"
                className="p-2.5 rounded-lg bg-[#121316] border border-amber-400/30 text-[11px] text-[#F8FAFC] leading-relaxed"
              >
                Share this link and open it in your browser, then tap the{' '}
                <strong className="text-amber-400">three dots (⋮)</strong> menu
                and select{' '}
                <strong className="text-emerald-400">
                  Install app / Add to Home screen / Create shortcut
                </strong>
                .
              </div>
            )}

            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={SHARED_APP_LIVE_URL}
                aria-label="Shared Live App URL"
                className="flex-1 bg-[#121316] border border-[#1E2028] rounded-lg px-2.5 py-2 text-[11px] font-mono text-[#F8FAFC] select-all min-w-0"
              />
              <button
                type="button"
                onClick={handleCopyUrl}
                data-testid="copy-shared-url-btn"
                className="px-3 py-2 rounded-lg bg-[#F8FAFC] text-[#0A0A0C] font-bold text-[11px] flex items-center gap-1.5 shrink-0 hover:bg-zinc-200 transition-colors"
              >
                {copiedUrl ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleNativeShare}
                aria-label="Share Link"
                className="p-2 rounded-lg bg-[#181A20] border border-[#1E2028] text-[#F8FAFC] hover:border-amber-400/50 transition-colors shrink-0"
              >
                <Share2 className="w-3.5 h-3.5 text-amber-400" />
              </button>
            </div>
          </div>

          {/* 2. Refresh Data (Live Schedules & Standings Sync) */}
          <div className="rounded-xl bg-[#0A0A0C] border border-[#1E2028] p-3.5 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
                  <RefreshCw
                    className={`w-3.5 h-3.5 text-emerald-400 ${
                      otaCheckStatus === 'CHECKING' ? 'animate-spin' : ''
                    }`}
                  />
                </div>
                <span className="font-bold text-[#F8FAFC] truncate">
                  Refresh Data
                </span>
              </div>
              {lastVerifiedIST && (
                <span className="text-[10px] text-[#8E95A5] tabular-nums shrink-0">
                  {lastVerifiedIST}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => checkForOTAUpdateNow(onForceLiveSync)}
              data-testid="check-ota-update-now-btn"
              className="w-full py-2.5 px-3 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 font-bold text-xs flex items-center justify-center gap-2 transition-colors"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${
                  otaCheckStatus === 'CHECKING' ? 'animate-spin' : ''
                }`}
              />
              <span>
                {otaCheckStatus === 'CHECKING'
                  ? 'Refreshing Schedules & Standings...'
                  : otaCheckStatus === 'UP_TO_DATE'
                  ? 'Schedules & Standings Up to Date'
                  : otaCheckStatus === 'UPDATED'
                  ? 'Update Applied'
                  : 'Refresh All Sports Data Now'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
