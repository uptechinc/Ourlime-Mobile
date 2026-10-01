package com.ourlime.app

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat

/**
 * Foreground service that keeps an active Agora call alive (microphone, and camera for video)
 * while the user switches to another app. Without it Android silences capture and may kill the process.
 */
class OurlimeOngoingCallService : Service() {

  companion object {
    private const val CHANNEL_ID = "ourlime-ongoing-call"
    private const val CHANNEL_NAME = "Ongoing Ourlime calls"
    private const val NOTIFICATION_ID = 0x0C411
    private const val EXTRA_PEER_NAME = "peerName"
    private const val EXTRA_IS_VIDEO = "isVideo"

    fun start(context: Context, peerName: String, isVideo: Boolean) {
      val intent = Intent(context, OurlimeOngoingCallService::class.java).apply {
        putExtra(EXTRA_PEER_NAME, peerName)
        putExtra(EXTRA_IS_VIDEO, isVideo)
      }
      ContextCompat.startForegroundService(context, intent)
    }

    fun stop(context: Context) {
      context.stopService(Intent(context, OurlimeOngoingCallService::class.java))
    }
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val peerName = intent?.getStringExtra(EXTRA_PEER_NAME)?.takeIf { it.isNotBlank() } ?: "Ourlime call"
    val isVideo = intent?.getBooleanExtra(EXTRA_IS_VIDEO, false) ?: false
    createChannel()

    val openIntent = PendingIntent.getActivity(
      this,
      NOTIFICATION_ID,
      // addFlags, not "flags =": inside onStartCommand "flags" means the method's own parameter.
      Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
    val notification = NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(R.mipmap.ic_launcher)
      .setColor(0xFF10B981.toInt())
      .setContentTitle(if (isVideo) "Ongoing video call" else "Ongoing voice call")
      .setContentText("With $peerName · Tap to return")
      .setCategory(NotificationCompat.CATEGORY_CALL)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .setOngoing(true)
      .setUsesChronometer(true)
      .setContentIntent(openIntent)
      .build()

    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        startForeground(NOTIFICATION_ID, notification, resolveServiceTypes(isVideo))
      } else {
        startForeground(NOTIFICATION_ID, notification)
      }
    } catch (error: Throwable) {
      stopSelf()
    }
    return START_NOT_STICKY
  }

  override fun onTaskRemoved(rootIntent: Intent?) {
    stopSelf()
    super.onTaskRemoved(rootIntent)
  }

  private fun resolveServiceTypes(isVideo: Boolean): Int {
    var types = 0
    if (hasPermission(Manifest.permission.RECORD_AUDIO)) types = types or ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
    if (isVideo && hasPermission(Manifest.permission.CAMERA)) types = types or ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA
    return if (types == 0) ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE else types
  }

  private fun hasPermission(permission: String): Boolean =
    ContextCompat.checkSelfPermission(this, permission) == PackageManager.PERMISSION_GRANTED

  private fun createChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    val channel = NotificationChannel(CHANNEL_ID, CHANNEL_NAME, NotificationManager.IMPORTANCE_LOW).apply {
      description = "Shown while an Ourlime voice or video call is in progress"
      setSound(null, null)
      enableVibration(false)
      setShowBadge(false)
    }
    manager.createNotificationChannel(channel)
  }
}
