import BackgroundFetch, {
  BackgroundFetchStatus,
} from 'react-native-background-fetch';
import {recalculateAllStreaks} from './streakEngine';
import {replenishAllReminders} from './notifications';

const TASK_ID = 'com.lfg.nightly-streak-recalc';

/**
 * Configures the background fetch scheduler.
 * Should be called once on app launch (inside a top-level useEffect).
 *
 * On iOS, the OS decides the actual execution time (typically overnight
 * when the device is charging). On Android, BackgroundFetch uses
 * JobScheduler / AlarmManager.
 *
 * We request a 15-minute minimum interval, but the OS may throttle this.
 * The actual work (streak recalculation) is lightweight and fast.
 */
export async function configureBackgroundFetch(): Promise<void> {
  const onEvent = async (taskId: string) => {
    console.log('[BackgroundFetch] event received:', taskId);
    try {
      await recalculateAllStreaks();
      await replenishAllReminders();
    } catch (error) {
      console.error('[BackgroundFetch] task error:', error);
    }
    // Signal completion to the OS
    BackgroundFetch.finish(taskId);
  };

  const onTimeout = (taskId: string) => {
    console.warn('[BackgroundFetch] TIMEOUT:', taskId);
    BackgroundFetch.finish(taskId);
  };

  const status: BackgroundFetchStatus = await BackgroundFetch.configure(
    {
      minimumFetchInterval: 15, // minutes — OS may increase this
      stopOnTerminate: false,
      startOnBoot: true,
      enableHeadless: true,
      // Android-specific
      requiredNetworkType: BackgroundFetch.NETWORK_TYPE_NONE,
      requiresCharging: false,
      requiresDeviceIdle: false,
      requiresBatteryNotLow: false,
      requiresStorageNotLow: false,
    },
    onEvent,
    onTimeout,
  );

  console.log('[BackgroundFetch] configure status:', status);

  // Also schedule a dedicated nightly task using scheduleTask,
  // which gives us more control over timing.
  await BackgroundFetch.scheduleTask({
    taskId: TASK_ID,
    delay: getDelayUntilMidnight(),
    periodic: true,
    stopOnTerminate: false,
    startOnBoot: true,
    enableHeadless: true,
    requiresNetworkConnectivity: false,
    requiresCharging: false,
  });
}

/**
 * Headless task handler for Android.
 * Must be registered in index.js with BackgroundFetch.registerHeadlessTask.
 */
export async function headlessTask(event: {taskId: string; timeout: boolean}) {
  const {taskId, timeout} = event;
  if (timeout) {
    console.warn('[BackgroundFetch Headless] TIMEOUT:', taskId);
    BackgroundFetch.finish(taskId);
    return;
  }

  console.log('[BackgroundFetch Headless] event:', taskId);
  try {
    await recalculateAllStreaks();
    await replenishAllReminders();
  } catch (error) {
    console.error('[BackgroundFetch Headless] error:', error);
  }
  BackgroundFetch.finish(taskId);
}

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Returns the number of milliseconds until the next midnight (local time).
 * Used as the initial delay for the nightly scheduled task.
 */
function getDelayUntilMidnight(): number {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setDate(midnight.getDate() + 1);
  midnight.setHours(0, 0, 0, 0);
  return midnight.getTime() - now.getTime();
}
