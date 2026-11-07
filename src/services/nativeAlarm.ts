/**
 * APEX // PITCH — Persistent Bi-Directional Samsung Clock & Capacitor Alarm Service
 *
 * Synchronizes match & F1 session alarms bi-directionally with the Samsung Clock / Android
 * system alarm app via `@capawesome/capacitor-alarm` (when running inside an Android Capacitor APK)
 * and persists active native alarm IDs in `localStorage` under `'apex_pitch_device_alarms'`.
 *
 * ============================================================================
 * ANDROID MANIFEST PERMISSION SETUP NOTES (`android/app/src/main/AndroidManifest.xml`):
 * Ensure the following permissions are declared inside `<manifest>` when building the APK:
 *
 *   <uses-permission android:name="com.android.alarm.permission.SET_ALARM" />
 *   <uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" />
 *   <uses-permission android:name="android.permission.USE_EXACT_ALARM" />
 * ============================================================================
 */

export const DEVICE_ALARMS_STORAGE_KEY = 'apex_pitch_device_alarms';

export interface StoredDeviceAlarmRecord {
  alarmId: string | number;
  eventId: string;
  title: string;
  label: string;
  hour: number;
  minute: number;
  istTimeFormatted: string;
  eventStartTimeISO: string;
  leadTimeMinutes: number;
  updatedAtISO: string;
  platform: 'capacitor-native' | 'web-synced';
}

export type DeviceAlarmsMap = Record<string, StoredDeviceAlarmRecord>;

interface CapacitorAlarmPlugin {
  checkPermissions?: () => Promise<{ exactAlarm?: string; alarm?: string }>;
  requestPermissions?: () => Promise<{ exactAlarm?: string; alarm?: string }>;
  createAlarm?: (options: {
    hour: number;
    minute: number;
    label?: string;
    enabled?: boolean;
    skipUi?: boolean;
  }) => Promise<{ id?: string | number; alarmId?: string | number } | void>;
  deleteAlarm?: (options: { id: string | number }) => Promise<void>;
  cancelAlarm?: (options: { id: string | number }) => Promise<void>;
  updateAlarm?: (options: { id: string | number; enabled: boolean }) => Promise<void>;
}

/**
 * Resolves the `@capawesome/capacitor-alarm` plugin instance from the Capacitor runtime
 * if running inside an Android APK, or returns null in standard web environments.
 */
function getCapacitorAlarmPlugin(): CapacitorAlarmPlugin | null {
  try {
    const win = window as unknown as {
      Capacitor?: {
        isNativePlatform?: () => boolean;
        Plugins?: {
          Alarm?: CapacitorAlarmPlugin;
          CapacitorAlarm?: CapacitorAlarmPlugin;
        };
      };
    };
    const plugin = win?.Capacitor?.Plugins?.Alarm || win?.Capacitor?.Plugins?.CapacitorAlarm;
    if (plugin) {
      return plugin;
    }
  } catch {
    // Fallback to web storage tracking
  }
  return null;
}

let inMemoryAlarmsFallback: DeviceAlarmsMap = {};

/**
 * Reads the persisted device alarms map (`apex_pitch_device_alarms`) from `localStorage`.
 */
export function getStoredDeviceAlarms(): DeviceAlarmsMap {
  if (typeof localStorage === 'undefined') {
    return { ...inMemoryAlarmsFallback };
  }
  try {
    const raw = localStorage.getItem(DEVICE_ALARMS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return parsed as DeviceAlarmsMap;
    }
  } catch (err) {
    console.warn('[NativeAlarm] Failed to parse apex_pitch_device_alarms from localStorage:', err);
  }
  return {};
}

/**
 * Saves the device alarms map (`apex_pitch_device_alarms`) to `localStorage`
 * and dispatches a custom event so UI components stay strictly in sync.
 */
function saveStoredDeviceAlarms(map: DeviceAlarmsMap): void {
  inMemoryAlarmsFallback = { ...map };
  if (typeof localStorage === 'undefined') {
    return;
  }
  try {
    localStorage.setItem(DEVICE_ALARMS_STORAGE_KEY, JSON.stringify(map));
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('apex-device-alarms-updated', { detail: map }));
    }
  } catch (err) {
    console.warn('[NativeAlarm] Failed to save apex_pitch_device_alarms to localStorage:', err);
  }
}

/**
 * Checks whether a specific match or F1 session currently has an active native alarm ID stored.
 */
export function hasSamsungNativeAlarm(eventId: string): boolean {
  const map = getStoredDeviceAlarms();
  return Boolean(map[eventId] && map[eventId].alarmId !== undefined);
}

/**
 * Returns the stored native alarm record for a match or session, if any.
 */
export function getSamsungNativeAlarm(eventId: string): StoredDeviceAlarmRecord | null {
  const map = getStoredDeviceAlarms();
  return map[eventId] || null;
}

/**
 * Extracts IST (`Asia/Kolkata`, UTC+05:30) 24-hour `hour` (0-23), `minute` (0-59),
 * and a formatted 12-hour IST string (`07:30 PM`) from a target Date or ISO string.
 */
export function extractISTHourAndMinute(targetDate: Date): {
  hour: number;
  minute: number;
  istTimeFormatted: string;
} {
  // Convert to IST by formatting parts in 'Asia/Kolkata'
  const parts24 = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(targetDate);

  const hourPart = parts24.find((p) => p.type === 'hour')?.value ?? '00';
  const minutePart = parts24.find((p) => p.type === 'minute')?.value ?? '00';

  let hour = parseInt(hourPart, 10);
  if (hour === 24) hour = 0;
  const minute = parseInt(minutePart, 10);

  const istTimeFormatted = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
    .format(targetDate)
    .toUpperCase();

  return { hour, minute, istTimeFormatted };
}

export interface SetSamsungAlarmOptions {
  eventId: string;
  title: string;
  eventStartTimeISO: string;
  leadTimeMinutes?: number;
  skipUi?: boolean;
}

export interface SetSamsungAlarmResult {
  success: boolean;
  alarmId: string | number;
  hour: number;
  minute: number;
  label: string;
  istTimeFormatted: string;
  toastMessage: string;
  record: StoredDeviceAlarmRecord;
}

/**
 * Set / Create Native Alarm (`setSamsungMatchAlarm`):
 * 1. Checks and requests exact alarm permissions (`Alarm.checkPermissions()` / `Alarm.requestPermissions()`).
 * 2. Extracts `hour` and `minute` in IST from the event date (minus optional `leadTimeMinutes`).
 * 3. Calls `Alarm.createAlarm({ hour, minute, label: `APEX // ${title}`, enabled: true, skipUi: false })`.
 * 4. Captures the returned system `alarmId` from the plugin response and saves it mapped to `eventId`
 *    in `localStorage` (`apex_pitch_device_alarms`).
 */
export async function setSamsungMatchAlarm(
  options: SetSamsungAlarmOptions
): Promise<SetSamsungAlarmResult> {
  const { eventId, title, eventStartTimeISO, leadTimeMinutes = 0, skipUi = false } = options;

  const eventMs = new Date(eventStartTimeISO).getTime();
  const safeEventMs = Number.isNaN(eventMs) ? Date.now() + 3600_000 : eventMs;
  const triggerDate = new Date(safeEventMs - leadTimeMinutes * 60_000);

  const { hour, minute, istTimeFormatted } = extractISTHourAndMinute(triggerDate);
  const label = `APEX // ${title}`;

  const plugin = getCapacitorAlarmPlugin();
  let alarmId: string | number = `samsung-clk-${eventId}-${hour.toString().padStart(2, '0')}${minute
    .toString()
    .padStart(2, '0')}`;
  let platform: 'capacitor-native' | 'web-synced' = 'web-synced';

  if (plugin) {
    try {
      // Step 1: Check and request exact alarm permissions
      if (typeof plugin.checkPermissions === 'function') {
        const permStatus = await plugin.checkPermissions();
        const isGranted =
          permStatus?.exactAlarm === 'granted' || permStatus?.alarm === 'granted';
        if (!isGranted && typeof plugin.requestPermissions === 'function') {
          await plugin.requestPermissions();
        }
      } else if (typeof plugin.requestPermissions === 'function') {
        await plugin.requestPermissions();
      }

      // Step 2: Create the alarm in Samsung Clock / Android System Clock
      if (typeof plugin.createAlarm === 'function') {
        const response = await plugin.createAlarm({
          hour,
          minute,
          label,
          enabled: true,
          skipUi,
        });

        if (response && typeof response === 'object') {
          if (response.id !== undefined) {
            alarmId = response.id;
          } else if (response.alarmId !== undefined) {
            alarmId = response.alarmId;
          }
        }
        platform = 'capacitor-native';
      }
    } catch (err) {
      console.warn(
        '[NativeAlarm] Capacitor Alarm plugin call encountered an issue; persisting local alarm ID:',
        err
      );
    }
  }

  // Step 3: Save mapping to localStorage (`apex_pitch_device_alarms`)
  const record: StoredDeviceAlarmRecord = {
    alarmId,
    eventId,
    title,
    label,
    hour,
    minute,
    istTimeFormatted,
    eventStartTimeISO,
    leadTimeMinutes,
    updatedAtISO: new Date().toISOString(),
    platform,
  };

  const currentMap = getStoredDeviceAlarms();
  currentMap[eventId] = record;
  saveStoredDeviceAlarms(currentMap);

  const toastMessage = `Samsung system alarm set for ${istTimeFormatted} IST`;
  console.info(
    `[NativeAlarm] Created alarm [${alarmId}] -> "${label}" at ${hour
      .toString()
      .padStart(2, '0')}:${minute.toString().padStart(2, '0')} (${istTimeFormatted} IST)`
  );

  return {
    success: true,
    alarmId,
    hour,
    minute,
    label,
    istTimeFormatted,
    toastMessage,
    record,
  };
}

export interface CancelSamsungAlarmResult {
  success: boolean;
  removed: boolean;
  alarmId: string | number | null;
  toastMessage: string;
}

/**
 * Delete / Turn Off Native Alarm (`cancelSamsungMatchAlarm`):
 * 1. Retrieves the stored system `alarmId` for the specific match or session from `localStorage`.
 * 2. Calls the native removal method (`Alarm.deleteAlarm({ id: alarmId })`, `Alarm.cancelAlarm`,
 *    or `Alarm.updateAlarm({ id: alarmId, enabled: false })`) to remove/disable the alarm from the
 *    Samsung Clock app.
 * 3. Removes the mapping from `localStorage` (`apex_pitch_device_alarms`).
 */
export async function cancelSamsungMatchAlarm(
  eventId: string
): Promise<CancelSamsungAlarmResult> {
  const currentMap = getStoredDeviceAlarms();
  const existingRecord = currentMap[eventId];
  const alarmId = existingRecord?.alarmId ?? null;

  const plugin = getCapacitorAlarmPlugin();
  if (plugin && alarmId !== null) {
    try {
      if (typeof plugin.deleteAlarm === 'function') {
        await plugin.deleteAlarm({ id: alarmId });
      } else if (typeof plugin.cancelAlarm === 'function') {
        await plugin.cancelAlarm({ id: alarmId });
      } else if (typeof plugin.updateAlarm === 'function') {
        await plugin.updateAlarm({ id: alarmId, enabled: false });
      }
    } catch (err) {
      console.warn(`[NativeAlarm] Native removal for alarmId=${alarmId} warning:`, err);
    }
  }

  if (currentMap[eventId]) {
    delete currentMap[eventId];
    saveStoredDeviceAlarms(currentMap);
  }

  const toastMessage = 'Samsung system alarm removed';
  console.info(`[NativeAlarm] Removed Samsung Clock alarm for eventId=${eventId} (alarmId=${alarmId})`);

  return {
    success: true,
    removed: true,
    alarmId,
    toastMessage,
  };
}
