/**
 * @format
 */

import { AppRegistry } from 'react-native';
import notifee from '@notifee/react-native';
import BackgroundFetch from 'react-native-background-fetch';
import App from './App';
import { name as appName } from './app.json';
import { handleNotificationEvent } from './src/services/notifications';
import { headlessTask } from './src/services/backgroundTasks';

// Register Notifee background event handler.
// This runs when the app is in the background or killed, handling
// notification delivery, "Mark Done" actions, and trigger replenishment.
notifee.onBackgroundEvent(handleNotificationEvent);

// Register BackgroundFetch headless task for Android.
// This runs nightly streak recalculation even when the app is terminated.
BackgroundFetch.registerHeadlessTask(headlessTask);

AppRegistry.registerComponent(appName, () => App);
