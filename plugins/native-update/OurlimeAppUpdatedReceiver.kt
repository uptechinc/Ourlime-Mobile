package com.ourlime.app

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import java.io.File

/**
 * After Android replaces Ourlime (MY_PACKAGE_REPLACED; only the system can send it), posts a quiet "Ourlime updated,
 * tap to open" notification on its own low-importance channel, and removes the downloaded APK. The existing v3
 * message/call channels are not touched (channel settings are immutable once created).
 */
class OurlimeAppUpdatedReceiver : BroadcastReceiver() {
  companion object {
    private const val CHANNEL_ID = "ourlime-app-updates-v1"
    private const val NOTIFICATION_ID = 42_017
  }

  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != Intent.ACTION_MY_PACKAGE_REPLACED) return
    File(context.cacheDir, "updates").listFiles()?.forEach { file -> file.delete() }
    try {
      val notifications = NotificationManagerCompat.from(context)
      if (!notifications.areNotificationsEnabled()) return
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        val channel = NotificationChannel(CHANNEL_ID, "App updates", NotificationManager.IMPORTANCE_LOW).apply {
          description = "Lets you know when Ourlime has finished updating"
          setShowBadge(false)
        }
        context.getSystemService(NotificationManager::class.java)?.createNotificationChannel(channel)
      }
      val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName) ?: return
      launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
      val contentIntent = PendingIntent.getActivity(
        context,
        NOTIFICATION_ID,
        launchIntent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
      val iconId = context.resources.getIdentifier("notification_icon", "drawable", context.packageName)
        .takeIf { resourceId -> resourceId != 0 } ?: context.applicationInfo.icon
      val notification = NotificationCompat.Builder(context, CHANNEL_ID)
        .setSmallIcon(iconId)
        .setContentTitle("Ourlime updated")
        .setContentText("Tap to open the new version.")
        .setPriority(NotificationCompat.PRIORITY_LOW)
        .setAutoCancel(true)
        .setContentIntent(contentIntent)
        .build()
      notifications.notify(NOTIFICATION_ID, notification)
    } catch (_: SecurityException) {
      // POST_NOTIFICATIONS not granted: nothing to show.
    }
  }
}
