/**
 * ============================================================================
 * PRODUCTION RESILIENCE & API SAFEGUARDS ENGINE (src/services/apiClient.ts)
 * ============================================================================
 * - Request Deduplication & In-Memory TTL Cache (5 min live / 24h schedules & rosters)
 * - Smart Polling Gatekeeper (0 req/s when no event is actively in progress)
 * - Rate Limit (429) Recovery with silent localStorage fallback (`apex_pitch_verified_cache_v2`)
 * - CORS Error Prevention & Automatic Fallback Routing
 * - Precise IST Timezone & DST Conversion via Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata' })
 * - Self-Healing Logo & Circuit Map Resolver via Wikipedia REST API
 */

export const TTL_LIVE_MS = 5 * 60 * 1000; // 5 minutes for live scores & telemetry
export const TTL_SCHEDULE_ROSTER_MS = 12 * 60 * 60 * 1000; // 12 hours for schedules & standings
export const MASTER_CACHE_KEY = 'apex_pitch_verified_v5_api_master';
const WIKI_ASSET_CACHE_KEY = 'apex_pitch_verified_v5_wiki_assets';

interface MemoryCacheItem<T = unknown> {
  data: T;
  expiresAt: number;
  cachedAtISO: string;
}

const memoryCache = new Map<string, MemoryCacheItem>();
const inFlightRequests = new Map<string, Promise<unknown>>();

export function clearApiClientMemoryCache(): void {
  memoryCache.clear();
}

type RateLimitListener = (isRateLimited: boolean) => void;
const rateLimitListeners = new Set<RateLimitListener>();
let rateLimitRecoveryActive = false;

export function subscribeRateLimitStatus(listener: RateLimitListener): () => void {
  rateLimitListeners.add(listener);
  listener(rateLimitRecoveryActive);
  return () => {
    rateLimitListeners.delete(listener);
  };
}

export function subscribeRateLimitBanner(
  listener: (state: { active: boolean; message: string }) => void
): () => void {
  return subscribeRateLimitStatus((active) => {
    listener({
      active,
      message: active
        ? 'API Rate Limit Reached — Serving Verified Offline Cache'
        : '',
    });
  });
}

export function setRateLimitStatus(active: boolean): void {
  if (rateLimitRecoveryActive === active) return;
  rateLimitRecoveryActive = active;
  for (const listener of rateLimitListeners) {
    listener(active);
  }
}

export function isRateLimitRecoveryActive(): boolean {
  return rateLimitRecoveryActive;
}

/**
 * ============================================================================
 * PRECISE IST TIMEZONE & DAYLIGHT SAVING (DST) CONVERSION
 * ============================================================================
 * Uses JavaScript's native Intl.DateTimeFormat locked strictly to
 * 'Asia/Kolkata' so UK/Europe/US DST shifts never cause offset drift.
 * Renders clean, readable times like "1:30 AM" or "7:30 PM" without repeating
 * "IST" or "ASIA/KOLKATA" on every card.
 */
export const formatIST = (utcString: string): string => {
  const dateObj = new Date(utcString);
  if (Number.isNaN(dateObj.getTime())) {
    return '12:00 PM';
  }
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
    .format(dateObj)
    .toUpperCase();
};

/**
 * Strips any trailing "IST" or "ASIA/KOLKATA" from a time label and normalizes
 * to clean 12-hour format (e.g., "01:30 AM IST" -> "1:30 AM", "19:30 IST" -> "7:30 PM").
 * If the match time is not yet declared by the league (isTimeTBD or "TBD"), returns "TBD".
 */
export function formatSimpleCardTime(
  timeLabelOrISO: string,
  fallbackISO?: string,
  isTimeTBD?: boolean
): string {
  if (isTimeTBD || /\bTBD\b|NOT DECLARED/i.test(timeLabelOrISO || '')) {
    return 'TBD';
  }

  if (fallbackISO) {
    const d = new Date(fallbackISO);
    if (!Number.isNaN(d.getTime())) {
      return formatIST(fallbackISO);
    }
  }

  const asIsoDate = new Date(timeLabelOrISO);
  if (
    timeLabelOrISO &&
    timeLabelOrISO.includes('T') &&
    !Number.isNaN(asIsoDate.getTime())
  ) {
    return formatIST(timeLabelOrISO);
  }

  const trimmed = (timeLabelOrISO || '')
    .replace(/\s*(IST|ASIA\/KOLKATA|UTC\+5:30)\b/gi, '')
    .trim();

  if (/^\d{1,2}:\d{2}\s*(AM|PM)$/i.test(trimmed)) {
    return trimmed.replace(/^0(\d:)/, '$1').toUpperCase();
  }

  const match24 = trimmed.match(/^(\d{1,2}):(\d{2})/);
  if (match24) {
    const h24 = parseInt(match24[1], 10);
    const mins = match24[2];
    const period = h24 >= 12 ? 'PM' : 'AM';
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    return `${h12}:${mins} ${period}`;
  }

  return trimmed || 'TBD';
}

export function formatISTDateShort(utcString: string): string {
  const dateObj = new Date(utcString);
  if (Number.isNaN(dateObj.getTime())) return 'TUE, 03 NOV';
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  }).formatToParts(dateObj);
  const weekday = (parts.find((p) => p.type === 'weekday')?.value ?? 'SUN').toUpperCase();
  const day = (parts.find((p) => p.type === 'day')?.value ?? '01').padStart(2, '0');
  const month = (parts.find((p) => p.type === 'month')?.value ?? 'NOV').toUpperCase();
  return `${weekday}, ${day} ${month}`;
}

/**
 * ============================================================================
 * STRICT REAL-TIME CREDIBILITY GATEKEEPER (NO FAKE LIVE MATCHES)
 * ============================================================================
 * Compares every Football fixture and F1 session against Date.now() and live
 * API state (`status.type.state === 'in'`).
 * - If `now < eventStartTimeUTC`, status MUST be `'UPCOMING'`.
 * - An event can ONLY show as `'LIVE'` if `now >= eventStartTimeUTC && now <= eventEndTimeUTC`
 *   AND the live API reports it is actively in progress (`apiState === 'in'`).
 */
export type VerifiedEventRuntimeState = 'UPCOMING' | 'LIVE' | 'FINAL';

export function evaluateStrictEventStatus(
  startTimeOrParams:
    | string
    | {
        startTimeISO: string;
        durationMinutes?: number;
        apiState?: 'pre' | 'in' | 'post' | string;
        nowMs?: number;
      },
  durationMinutesArg?: number,
  apiReportsLiveArg?: boolean,
  isCompletedArg?: boolean,
  nowMsArg?: number
): VerifiedEventRuntimeState {
  const startTimeISO =
    typeof startTimeOrParams === 'string'
      ? startTimeOrParams
      : startTimeOrParams.startTimeISO;
  const durationMinutes =
    typeof startTimeOrParams === 'string'
      ? durationMinutesArg
      : startTimeOrParams.durationMinutes;
  const apiState =
    typeof startTimeOrParams === 'string'
      ? apiReportsLiveArg
        ? 'in'
        : isCompletedArg
        ? 'post'
        : 'pre'
      : startTimeOrParams.apiState;
  const now =
    (typeof startTimeOrParams === 'string'
      ? nowMsArg
      : startTimeOrParams.nowMs) ?? Date.now();

  const startMs = new Date(startTimeISO).getTime();
  if (Number.isNaN(startMs)) return 'UPCOMING';

  const durationMs = (durationMinutes ?? 120) * 60 * 1000;
  const endMs = startMs + durationMs;

  // Rule 1: Future events are NEVER live
  if (now < startMs) {
    return 'UPCOMING';
  }

  // Rule 2: Only show LIVE if within active window AND live API confirms 'in'
  if (now >= startMs && now <= endMs && apiState === 'in') {
    return 'LIVE';
  }

  // If past end time, or explicitly completed
  if (now > endMs || apiState === 'post') {
    return 'FINAL';
  }

  return 'UPCOMING';
}

/**
 * Smart Polling Gatekeeper:
 * Returns true ONLY if at least one event is verified as actively in progress right now.
 * If no matches or races are live right now, polling stays completely idle (0 req/s).
 */
export function shouldActivateLivePolling(
  events: Array<{
    startTimeISO: string;
    durationMinutes?: number;
    apiState?: string;
  }>,
  nowMs: number = Date.now()
): boolean {
  return events.some(
    (ev) =>
      evaluateStrictEventStatus({
        startTimeISO: ev.startTimeISO,
        durationMinutes: ev.durationMinutes,
        apiState: ev.apiState,
        nowMs,
      }) === 'LIVE'
  );
}

/**
 * ============================================================================
 * ROBUST FETCH WRAPPER WITH DEDUPLICATION, TTL CACHE & CORS PROXY FALLBACK
 * ============================================================================
 */
function readPersistentSlice<T>(cacheKey: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(MASTER_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, MemoryCacheItem<T>>;
    const entry = parsed?.[cacheKey];
    return entry?.data ?? null;
  } catch {
    return null;
  }
}

function writePersistentSlice<T>(cacheKey: string, data: T, ttlMs: number): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(MASTER_CACHE_KEY);
    const parsed: Record<string, MemoryCacheItem<unknown>> = raw ? JSON.parse(raw) : {};
    parsed[cacheKey] = {
      data,
      expiresAt: Date.now() + ttlMs,
      cachedAtISO: new Date().toISOString(),
    };
    window.localStorage.setItem(MASTER_CACHE_KEY, JSON.stringify(parsed));
  } catch {
    // Ignore localStorage quota limits
  }
}

export async function fetchWithResilience<T>(
  url: string,
  options?: {
    ttlMs?: number;
    cacheKey?: string;
    forceRefresh?: boolean;
    timeoutMs?: number;
    fallbackData?: T;
  }
): Promise<T | null> {
  const key = options?.cacheKey || url;
  const ttlMs = options?.ttlMs ?? TTL_LIVE_MS;
  const forceRefresh = options?.forceRefresh ?? false;
  const timeoutMs = options?.timeoutMs ?? 4500;

  // 1. Check in-memory TTL cache first
  if (!forceRefresh) {
    const mem = memoryCache.get(key) as MemoryCacheItem<T> | undefined;
    if (mem && Date.now() < mem.expiresAt) {
      return mem.data;
    }
  }

  // 2. If offline, return persistent localStorage slice or fallback immediately
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    const cached = readPersistentSlice<T>(key);
    return cached ?? options?.fallbackData ?? null;
  }

  // 3. Deduplicate simultaneous in-flight requests to the same endpoint
  if (!forceRefresh && inFlightRequests.has(key)) {
    return (inFlightRequests.get(key) as Promise<T | null>);
  }

  const requestPromise = (async (): Promise<T | null> => {
    const attemptFetch = async (targetUrl: string): Promise<Response> => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        return await fetch(targetUrl, {
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        });
      } finally {
        clearTimeout(timer);
      }
    };

    try {
      let response: Response;
      try {
        response = await attemptFetch(url);
      } catch {
        // Automatic CORS / network fallback routing via clean public CORS proxy
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
        response = await attemptFetch(proxyUrl);
      }

      if (response.status === 429) {
        // Rate limit recovery: silently fall back to localStorage cache
        setRateLimitStatus(true);
        const cached = readPersistentSlice<T>(key);
        return cached ?? options?.fallbackData ?? null;
      }

      if (!response.ok) {
        const cached = readPersistentSlice<T>(key);
        return cached ?? options?.fallbackData ?? null;
      }

      const json = (await response.json()) as T;
      setRateLimitStatus(false);

      const item: MemoryCacheItem<T> = {
        data: json,
        expiresAt: Date.now() + ttlMs,
        cachedAtISO: new Date().toISOString(),
      };
      memoryCache.set(key, item);
      writePersistentSlice(key, json, ttlMs);
      return json;
    } catch {
      // Never throw red console errors on network/CORS blockages; serve cached slice cleanly
      const cached = readPersistentSlice<T>(key);
      return cached ?? options?.fallbackData ?? null;
    } finally {
      inFlightRequests.delete(key);
    }
  })();

  inFlightRequests.set(key, requestPromise);
  return requestPromise;
}

/**
 * ============================================================================
 * SELF-HEALING LOGO & CIRCUIT MAP RESOLVER (Wikipedia REST API)
 * ============================================================================
 * Queries `https://en.wikipedia.org/api/rest_v1/page/summary/{Name}` for any
 * newly debuted constructor, club, or Grand Prix circuit not in the static CDN
 * map and caches the resolved thumbnail URL in localStorage.
 */
export async function resolveDynamicAssetViaWikipedia(
  entityName: string,
  fallbackUrl: string
): Promise<string> {
  if (!entityName) return fallbackUrl;
  const normalizedKey = entityName.trim().toLowerCase();

  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(WIKI_ASSET_CACHE_KEY);
      if (raw) {
        const map = JSON.parse(raw) as Record<string, string>;
        if (map[normalizedKey]) return map[normalizedKey];
      }
    } catch {
      // Ignore
    }
  }

  const wikiTitle = encodeURIComponent(entityName.trim().replace(/\s+/g, '_'));
  const summary = await fetchWithResilience<{
    thumbnail?: { source?: string };
    originalimage?: { source?: string };
  }>(`https://en.wikipedia.org/api/rest_v1/page/summary/${wikiTitle}`, {
    ttlMs: TTL_SCHEDULE_ROSTER_MS,
    cacheKey: `wiki_asset_${normalizedKey}`,
    timeoutMs: 3500,
  });

  const resolvedUrl = summary?.thumbnail?.source || summary?.originalimage?.source || fallbackUrl;

  if (resolvedUrl && typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(WIKI_ASSET_CACHE_KEY);
      const map: Record<string, string> = raw ? JSON.parse(raw) : {};
      map[normalizedKey] = resolvedUrl;
      window.localStorage.setItem(WIKI_ASSET_CACHE_KEY, JSON.stringify(map));
    } catch {
      // Ignore
    }
  }

  return resolvedUrl;
}
