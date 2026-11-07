import { useState, useEffect, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [otaCheckStatus, setOtaCheckStatus] = useState<'IDLE' | 'CHECKING' | 'UP_TO_DATE' | 'UPDATED'>('IDLE');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const ua = window.navigator.userAgent.toLowerCase();
    const ios = /iphone|ipad|ipod/.test(ua);
    setIsIOS(ios);

    if (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true
    ) {
      setIsInstalled(true);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<'ACCEPTED' | 'DISMISSED' | 'MANUAL_GUIDE'> => {
    if (!deferredPrompt) return 'MANUAL_GUIDE';
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setIsInstalled(true);
      return 'ACCEPTED';
    }
    return 'DISMISSED';
  }, [deferredPrompt]);

  const checkForOTAUpdateNow = useCallback(async (onSyncSportsData?: () => void) => {
    setOtaCheckStatus('CHECKING');
    onSyncSportsData?.();

    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          await reg.update();
          if (reg.waiting) {
            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
            setOtaCheckStatus('UPDATED');
            return;
          }
        }
      } catch {
        // Ignore in preview iframe
      }
    }

    setTimeout(() => {
      setOtaCheckStatus('UP_TO_DATE');
    }, 600);
  }, []);

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS,
    promptInstall,
    otaCheckStatus,
    checkForOTAUpdateNow,
  };
}
