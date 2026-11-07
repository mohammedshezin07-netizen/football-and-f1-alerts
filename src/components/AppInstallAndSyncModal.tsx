import React, { useState } from 'react';
import {
  Copy,
  Download,
  RefreshCw,
  Smartphone,
  Share2,
  X,
  Check,
  ChevronDown,
  ChevronUp,
  FileCode2,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const SHARED_APP_LIVE_URL =
  'https://ais-pre-dw5db665fbgjhdkaynpsxx-936929881539.asia-southeast1.run.app';

interface AppInstallAndSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onForceLiveSync: () => void;
  lastVerifiedIST?: string;
}

type SyncModalSectionId =
  | 'install_phone'
  | 'share_url'
  | 'apk_builder'
  | 'ota_sync';

export const AppInstallAndSyncModal: React.FC<AppInstallAndSyncModalProps> = ({
  isOpen,
  onClose,
  onForceLiveSync,
  lastVerifiedIST,
}) => {
  const {
    isInstallable,
    isInstalled,
    isIOS,
    promptInstall,
    otaCheckStatus,
    checkForOTAUpdateNow,
  } = usePWAInstall();

  const [activeSection, setActiveSection] =
    useState<SyncModalSectionId | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [installGuideMessage, setInstallGuideMessage] = useState<string | null>(
    null
  );

  if (!isOpen) return null;

  const toggleSection = (id: SyncModalSectionId) => {
    setActiveSection((prev) => (prev === id ? null : id));
  };

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

  const handleDirectInstall = async () => {
    const result = await promptInstall();
    if (result === 'MANUAL_GUIDE') {
      setInstallGuideMessage(
        isIOS
          ? 'On iPhone or iPad Safari: Tap the Share button at the bottom of the screen, then tap "Add to Home Screen".'
          : 'Open the Shared App Link in Chrome on your Android phone, tap the menu (top-right), and select "Install app" or "Add to Home screen".'
      );
    }
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
        {/* Compact Modal Header */}
        <div className="px-4 py-3 border-b border-[#1E2028] bg-[#0A0A0C] flex items-center justify-between gap-2 sticky top-0 z-10">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-[#E10600] flex items-center justify-center shrink-0">
              <Smartphone className="w-3.5 h-3.5 text-white stroke-[2]" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-xs font-bold tracking-wider uppercase text-[#F8FAFC] truncate">
                Install App &amp; Share Link
              </h2>
              <p className="text-[11px] text-[#8E95A5] truncate">
                Select any option below to expand
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {activeSection && (
              <button
                type="button"
                onClick={() => setActiveSection(null)}
                className="px-2 py-1 rounded-md bg-[#181A20] border border-[#1E2028] text-[10px] font-semibold text-[#8E95A5] hover:text-[#F8FAFC] transition-colors"
              >
                Collapse
              </button>
            )}
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
        </div>

        <div className="p-4 space-y-3 text-xs">
          {/* Compact 2x2 Grid of Individual Expandable Buttons */}
          <div className="grid grid-cols-2 gap-2">
            {/* Button 1: Install on Phone */}
            <button
              type="button"
              onClick={() => toggleSection('install_phone')}
              aria-expanded={activeSection === 'install_phone'}
              data-testid="sync-hub-btn-install-phone"
              className={`flex items-center justify-between gap-2 p-2.5 rounded-xl border text-left transition-all ${
                activeSection === 'install_phone'
                  ? 'bg-[#E10600]/15 border-[#E10600] text-[#F8FAFC]'
                  : 'bg-[#181A20] border-[#1E2028] text-[#F8FAFC] hover:border-white/20'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-[#E10600]/15 border border-[#E10600]/30 flex items-center justify-center shrink-0">
                  <Download className="w-3.5 h-3.5 text-[#E10600]" />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-bold text-[#F8FAFC] truncate">
                    Phone Install
                  </div>
                  <div className="text-[10px] text-[#8E95A5] truncate">
                    {isInstalled ? 'Installed' : 'Home Screen App'}
                  </div>
                </div>
              </div>
              {activeSection === 'install_phone' ? (
                <ChevronUp className="w-3.5 h-3.5 text-[#8E95A5] shrink-0" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-[#8E95A5] shrink-0" />
              )}
            </button>

            {/* Button 2: Share Live URL */}
            <button
              type="button"
              onClick={() => toggleSection('share_url')}
              aria-expanded={activeSection === 'share_url'}
              data-testid="sync-hub-btn-share-url"
              className={`flex items-center justify-between gap-2 p-2.5 rounded-xl border text-left transition-all ${
                activeSection === 'share_url'
                  ? 'bg-amber-400/15 border-amber-400/50 text-[#F8FAFC]'
                  : 'bg-[#181A20] border-[#1E2028] text-[#F8FAFC] hover:border-white/20'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-amber-400/15 border border-amber-400/30 flex items-center justify-center shrink-0">
                  <Share2 className="w-3.5 h-3.5 text-amber-400" />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-bold text-[#F8FAFC] truncate">
                    Share Link
                  </div>
                  <div className="text-[10px] text-[#8E95A5] truncate">
                    {copiedUrl ? 'Copied' : 'Invite Friends'}
                  </div>
                </div>
              </div>
              {activeSection === 'share_url' ? (
                <ChevronUp className="w-3.5 h-3.5 text-[#8E95A5] shrink-0" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-[#8E95A5] shrink-0" />
              )}
            </button>

            {/* Button 3: Refresh Live Schedules */}
            <button
              type="button"
              onClick={() => toggleSection('ota_sync')}
              aria-expanded={activeSection === 'ota_sync'}
              data-testid="sync-hub-btn-ota-sync"
              className={`flex items-center justify-between gap-2 p-2.5 rounded-xl border text-left transition-all ${
                activeSection === 'ota_sync'
                  ? 'bg-emerald-500/15 border-emerald-500/50 text-[#F8FAFC]'
                  : 'bg-[#181A20] border-[#1E2028] text-[#F8FAFC] hover:border-white/20'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
                  <RefreshCw
                    className={`w-3.5 h-3.5 text-emerald-400 ${
                      otaCheckStatus === 'CHECKING' ? 'animate-spin' : ''
                    }`}
                  />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-bold text-[#F8FAFC] truncate">
                    Refresh Data
                  </div>
                  <div className="text-[10px] text-emerald-400 truncate tabular-nums">
                    {lastVerifiedIST ? lastVerifiedIST : 'Live Sync'}
                  </div>
                </div>
              </div>
              {activeSection === 'ota_sync' ? (
                <ChevronUp className="w-3.5 h-3.5 text-[#8E95A5] shrink-0" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-[#8E95A5] shrink-0" />
              )}
            </button>

            {/* Button 4: Android .APK Package */}
            <button
              type="button"
              onClick={() => toggleSection('apk_builder')}
              aria-expanded={activeSection === 'apk_builder'}
              data-testid="sync-hub-btn-apk-builder"
              className={`flex items-center justify-between gap-2 p-2.5 rounded-xl border text-left transition-all ${
                activeSection === 'apk_builder'
                  ? 'bg-sky-500/15 border-sky-500/50 text-[#F8FAFC]'
                  : 'bg-[#181A20] border-[#1E2028] text-[#F8FAFC] hover:border-white/20'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-sky-500/15 border border-sky-500/30 flex items-center justify-center shrink-0">
                  <FileCode2 className="w-3.5 h-3.5 text-sky-400" />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-bold text-[#F8FAFC] truncate">
                    Android .APK
                  </div>
                  <div className="text-[10px] text-[#8E95A5] truncate">
                    Package Steps
                  </div>
                </div>
              </div>
              {activeSection === 'apk_builder' ? (
                <ChevronUp className="w-3.5 h-3.5 text-[#8E95A5] shrink-0" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-[#8E95A5] shrink-0" />
              )}
            </button>
          </div>

          {/* EXPANDED SECTION 1: Instant Phone App Install */}
          {activeSection === 'install_phone' && (
            <div className="rounded-xl bg-[#0A0A0C] border border-[#1E2028] p-3.5 space-y-2.5">
              <div className="font-bold text-[#F8FAFC] flex items-center justify-between">
                <span>Add to Home Screen</span>
                {isInstalled && (
                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-[10px] text-emerald-400 font-bold">
                    INSTALLED
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#8E95A5] leading-relaxed">
                Install APEX PITCH on your Android or iPhone home screen for a
                full-screen standalone experience with automatic schedule
                updates.
              </p>
              <button
                type="button"
                onClick={handleDirectInstall}
                data-testid="trigger-pwa-install-btn"
                className="w-full py-2.5 px-3 rounded-xl bg-[#E10600] hover:bg-[#c40500] text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>
                  {isInstallable
                    ? 'Install App on This Device'
                    : 'Show Phone Install Instructions'}
                </span>
              </button>
              {installGuideMessage && (
                <div className="p-2.5 rounded-lg bg-amber-400/10 border border-amber-400/30 text-amber-200 text-[11px] leading-relaxed">
                  {installGuideMessage}
                </div>
              )}
            </div>
          )}

          {/* EXPANDED SECTION 2: Share Link with Friends & Family */}
          {activeSection === 'share_url' && (
            <div className="rounded-xl bg-[#0A0A0C] border border-[#1E2028] p-3.5 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-[#F8FAFC]">
                  Share Live Web Link
                </span>
                <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-md">
                  AUTO-SYNC
                </span>
              </div>

              <p className="text-[11px] text-[#8E95A5] leading-relaxed">
                Share this link with friends and family. When they add it to
                their home screen, their app stays automatically updated.
              </p>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={SHARED_APP_LIVE_URL}
                  aria-label="Shared Live App URL"
                  className="flex-1 bg-[#121316] border border-[#1E2028] rounded-lg px-2.5 py-2 text-[11px] font-mono text-[#F8FAFC] select-all"
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
                      <span>Copy Link</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* EXPANDED SECTION 3: Refresh Live Schedules */}
          {activeSection === 'ota_sync' && (
            <div className="rounded-xl bg-[#0A0A0C] border border-[#1E2028] p-3.5 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-[#F8FAFC]">
                  Refresh Schedules &amp; Standings
                </span>
                {lastVerifiedIST && (
                  <span className="text-[10px] text-[#8E95A5] tabular-nums">
                    Updated {lastVerifiedIST}
                  </span>
                )}
              </div>

              <p className="text-[11px] text-[#8E95A5] leading-relaxed">
                Fetch the latest Football fixtures, league tables, and Formula 1
                session times in Indian Standard Time (IST).
              </p>

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
          )}

          {/* EXPANDED SECTION 4: Build Android .APK File */}
          {activeSection === 'apk_builder' && (
            <div className="rounded-xl bg-[#0A0A0C] border border-[#1E2028] p-3.5 space-y-2">
              <div className="font-bold text-[#F8FAFC]">
                Create an Android <code className="text-amber-400">.apk</code>{' '}
                Package
              </div>
              <ol className="space-y-1.5 text-[11px] text-[#8E95A5] list-decimal pl-4 leading-relaxed">
                <li>
                  Copy the live link from the{' '}
                  <strong className="text-[#F8FAFC]">Share Link</strong> option.
                </li>
                <li>
                  Open <strong className="text-amber-400">pwabuilder.com</strong>
                  , paste the link, and choose{' '}
                  <strong className="text-[#F8FAFC]">
                    Package for Stores → Android → Download APK
                  </strong>
                  .
                </li>
                <li>
                  Share the <code className="text-amber-300">.apk</code> with
                  friends on WhatsApp or Telegram for native installation with
                  automatic live updates.
                </li>
              </ol>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

