package com.lfg

import android.content.Intent
import android.provider.AlarmClock
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReadableArray

class AlarmModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "AlarmModule"

    /**
     * Creates a system alarm using the AlarmClock ACTION_SET_ALARM intent.
     * This creates a visible alarm in the device's clock/alarm app.
     *
     * @param hour     Hour (0-23)
     * @param minute   Minute (0-59)
     * @param message  Alarm label / description
     * @param days     Optional array of days (Calendar.MONDAY=2..Calendar.SUNDAY=1)
     *                 for recurring alarms. Empty for one-time.
     */
    @ReactMethod
    fun setAlarm(hour: Int, minute: Int, message: String, days: ReadableArray?, promise: Promise) {
        try {
            val intent = Intent(AlarmClock.ACTION_SET_ALARM).apply {
                putExtra(AlarmClock.EXTRA_HOUR, hour)
                putExtra(AlarmClock.EXTRA_MINUTES, minute)
                putExtra(AlarmClock.EXTRA_MESSAGE, message)
                putExtra(AlarmClock.EXTRA_SKIP_UI, true) // Don't show alarm app UI
            }

            // Add recurring days if provided
            if (days != null && days.size() > 0) {
                val daysList = ArrayList<Int>()
                for (i in 0 until days.size()) {
                    daysList.add(days.getInt(i))
                }
                intent.putIntegerArrayListExtra(AlarmClock.EXTRA_DAYS, daysList)
            }

            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)

            // Check that a handler exists before launching — prevents
            // ActivityNotFoundException crashes on devices without a clock app.
            if (intent.resolveActivity(reactContext.packageManager) != null) {
                val activity = reactContext.currentActivity
                if (activity != null) {
                    activity.startActivity(intent)
                    promise.resolve(true)
                } else {
                    // Fallback: launch from application context
                    reactContext.startActivity(intent)
                    promise.resolve(true)
                }
            } else {
                promise.resolve(false) // No alarm app — silently skip
            }
        } catch (e: Exception) {
            promise.reject("ALARM_ERROR", e.message, e)
        }
    }
}
