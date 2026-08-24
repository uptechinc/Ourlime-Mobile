package com.ourlime.app

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.Ringtone
import android.media.RingtoneManager
import android.os.Build
import android.provider.Settings
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.Person
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import org.json.JSONObject
import java.lang.ref.WeakReference

class OurlimeIncomingCallModule(
  private val applicationContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(applicationContext) {

  private var activeRingtone: Ringtone? = null

  companion object {
    private const val MODULE_NAME = "OurlimeIncomingCall"
    private const val CHANNEL_ID = "ourlime-calls-v3"
    private const val CHANNEL_NAME = "Ourlime incoming calls"
    private const val EVENT_NAME = "OurlimeIncomingCallInteraction"
    private const val PREFERENCES_NAME = "ourlime_incoming_call"
    private const val PENDING_INTERACTION_KEY = "pending_interaction"
    private const val ACTION_OPEN = "com.ourlime.app.INCOMING_CALL_OPEN"
    private const val ACTION_ANSWER = "com.ourlime.app.INCOMING_CALL_ANSWER"
    private const val ACTION_DECLINE = "com.ourlime.app.INCOMING_CALL_DECLINE"

    private var activeContext = WeakReference<ReactApplicationContext>(null)

    fun captureIntent(context: Context, intent: Intent?) {
      val interactionAction = when (intent?.action) {
        ACTION_ANSWER -> "answer"
        ACTION_DECLINE -> "decline"
        ACTION_OPEN -> "open"
        else -> return
      }
      val callId = intent.getStringExtra("callId") ?: return
      val payload = JSONObject().apply {
        put("action", interactionAction)
        put("type", intent.getStringExtra("type") ?: "incoming_call")
        put("callId", callId)
        put("callType", intent.getStringExtra("callType") ?: "voice")
        put("callerId", intent.getStringExtra("callerId") ?: "")
        put("callerName", intent.getStringExtra("callerName") ?: "Ourlime caller")
        put("callerUserName", intent.getStringExtra("callerUserName") ?: "")
        put("callerProfilePicture", intent.getStringExtra("callerProfilePicture") ?: "")
        put("expiresAtMs", intent.getLongExtra("expiresAtMs", 0L))
      }
      context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
        .edit()
        .putString(PENDING_INTERACTION_KEY, payload.toString())
        .apply()
      activeContext.get()?.takeIf { it.hasActiveReactInstance() }?.let { reactContext ->
        reactContext
          .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
          .emit(EVENT_NAME, jsonToWritableMap(payload))
      }
    }

    private fun jsonToWritableMap(payload: JSONObject): WritableMap = Arguments.createMap().apply {
      putString("action", payload.optString("action", "open"))
      putString("type", payload.optString("type", "incoming_call"))
      putString("callId", payload.optString("callId", ""))
      putString("callType", payload.optString("callType", "voice"))
      putString("callerId", payload.optString("callerId", ""))
      putString("callerName", payload.optString("callerName", "Ourlime caller"))
      putString("callerUserName", payload.optString("callerUserName", ""))
      val profilePicture = payload.optString("callerProfilePicture", "")
      if (profilePicture.isNotEmpty()) putString("callerProfilePicture", profilePicture)
      putDouble("expiresAtMs", payload.optLong("expiresAtMs", 0L).toDouble())
    }
  }

  init {
    activeContext = WeakReference(applicationContext)
  }

  override fun getName(): String = MODULE_NAME

  override fun invalidate() {
    if (activeContext.get() === applicationContext) activeContext.clear()
    super.invalidate()
  }

  @ReactMethod
  fun displayIncomingCall(payload: ReadableMap, promise: Promise) {
    try {
      val callId = payload.requiredString("callId")
      val expiresAtMs = payload.requiredDouble("expiresAtMs").toLong()
      if (expiresAtMs <= System.currentTimeMillis()) {
        promise.resolve(null)
        return
      }

      createIncomingCallChannel()
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
        ContextCompat.checkSelfPermission(applicationContext, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
      ) {
        promise.reject("NOTIFICATION_PERMISSION_REQUIRED", "Notification permission is required for incoming calls")
        return
      }

      val callerName = payload.optionalString("callerName")
        ?: payload.optionalString("callerUserName")
        ?: "Ourlime caller"
      val isVideo = payload.optionalString("callType") == "video"
      val openIntent = createActivityIntent(payload, ACTION_OPEN, 0)
      val answerIntent = createActivityIntent(payload, ACTION_ANSWER, 1)
      val declineIntent = createActivityIntent(payload, ACTION_DECLINE, 2)
      val remainingMs = (expiresAtMs - System.currentTimeMillis()).coerceAtLeast(1L)

      val builder = NotificationCompat.Builder(applicationContext, CHANNEL_ID)
        .setSmallIcon(R.mipmap.ic_launcher)
        .setColor(0xFF10B981.toInt())
        .setContentTitle(if (isVideo) "Incoming video call" else "Incoming voice call")
        .setContentText("$callerName is calling you")
        .setCategory(NotificationCompat.CATEGORY_CALL)
        .setPriority(NotificationCompat.PRIORITY_MAX)
        .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
        .setContentIntent(openIntent)
        .setFullScreenIntent(openIntent, true)
        .setOngoing(true)
        .setAutoCancel(false)
        .setTimeoutAfter(remainingMs)
        .setSound(defaultRingtoneUri())
        .setVibrate(longArrayOf(0L, 700L, 350L, 700L, 350L, 700L))

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        val caller = Person.Builder().setName(callerName).setImportant(true).build()
        builder.setStyle(NotificationCompat.CallStyle.forIncomingCall(caller, declineIntent, answerIntent))
      } else {
        builder
          .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Decline", declineIntent)
          .addAction(android.R.drawable.sym_action_call, "Answer", answerIntent)
      }

      val notification = builder.build().apply {
        flags = flags or Notification.FLAG_INSISTENT
      }
      NotificationManagerCompat.from(applicationContext).notify(callId.hashCode(), notification)
      promise.resolve(null)
    } catch (error: Throwable) {
      promise.reject("INCOMING_CALL_DISPLAY_FAILED", error.message, error)
    }
  }

  @ReactMethod
  fun cancelIncomingCall(callId: String, promise: Promise) {
    try {
      stopRingtoneInternal()
      clearIncomingCallWindowFlags()
      NotificationManagerCompat.from(applicationContext).cancel(callId.hashCode())
      promise.resolve(null)
    } catch (error: Throwable) {
      promise.reject("INCOMING_CALL_CANCEL_FAILED", error.message, error)
    }
  }

  @ReactMethod
  fun startRingtone(promise: Promise) {
    try {
      if (activeRingtone?.isPlaying == true) {
        promise.resolve(null)
        return
      }
      activeRingtone = RingtoneManager.getRingtone(applicationContext, defaultRingtoneUri())?.apply {
        audioAttributes = AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
          .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
          .build()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) isLooping = true
        play()
      }
      promise.resolve(null)
    } catch (error: Throwable) {
      promise.reject("INCOMING_CALL_RINGTONE_FAILED", error.message, error)
    }
  }

  @ReactMethod
  fun stopRingtone(promise: Promise) {
    try {
      stopRingtoneInternal()
      promise.resolve(null)
    } catch (error: Throwable) {
      promise.reject("INCOMING_CALL_RINGTONE_STOP_FAILED", error.message, error)
    }
  }

  @ReactMethod
  fun openNotificationSettings(promise: Promise) {
    try {
      val intent = Intent(Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS).apply {
        putExtra(Settings.EXTRA_APP_PACKAGE, applicationContext.packageName)
        putExtra(Settings.EXTRA_CHANNEL_ID, CHANNEL_ID)
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      applicationContext.startActivity(intent)
      promise.resolve(null)
    } catch (error: Throwable) {
      promise.reject("NOTIFICATION_SETTINGS_FAILED", error.message, error)
    }
  }

  @ReactMethod
  fun canPlayNotificationAudio(promise: Promise) {
    try {
      val audioManager = applicationContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager
      val notificationManager = applicationContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      val interruptionAllowsAudio = Build.VERSION.SDK_INT < Build.VERSION_CODES.M ||
        notificationManager.currentInterruptionFilter == NotificationManager.INTERRUPTION_FILTER_ALL
      promise.resolve(audioManager.ringerMode == AudioManager.RINGER_MODE_NORMAL && interruptionAllowsAudio)
    } catch (error: Throwable) {
      promise.reject("NOTIFICATION_AUDIO_POLICY_FAILED", error.message, error)
    }
  }

  @ReactMethod
  fun consumePendingInteraction(promise: Promise) {
    try {
      val preferences = applicationContext.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
      val rawPayload = preferences.getString(PENDING_INTERACTION_KEY, null)
      preferences.edit().remove(PENDING_INTERACTION_KEY).apply()
      if (rawPayload.isNullOrBlank()) {
        promise.resolve(null)
        return
      }
      promise.resolve(jsonToWritableMap(JSONObject(rawPayload)))
    } catch (error: Throwable) {
      promise.reject("INCOMING_CALL_INTERACTION_FAILED", error.message, error)
    }
  }

  @ReactMethod
  fun addListener(eventName: String) = Unit

  @ReactMethod
  fun removeListeners(count: Int) = Unit

  private fun createIncomingCallChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = applicationContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    val ringtoneUri = defaultRingtoneUri()
    val audioAttributes = AudioAttributes.Builder()
      .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
      .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
      .build()
    val channel = NotificationChannel(CHANNEL_ID, CHANNEL_NAME, NotificationManager.IMPORTANCE_HIGH).apply {
      description = "Incoming Ourlime voice and video calls"
      lockscreenVisibility = Notification.VISIBILITY_PUBLIC
      enableVibration(true)
      vibrationPattern = longArrayOf(0L, 700L, 350L, 700L, 350L, 700L)
      setSound(ringtoneUri, audioAttributes)
      setShowBadge(false)
    }
    manager.createNotificationChannel(channel)
  }

  private fun defaultRingtoneUri() =
    RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
      ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)

  private fun stopRingtoneInternal() {
    activeRingtone?.takeIf { it.isPlaying }?.stop()
    activeRingtone = null
  }

  private fun clearIncomingCallWindowFlags() {
    applicationContext.currentActivity?.runOnUiThread {
      val activity = applicationContext.currentActivity ?: return@runOnUiThread
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
        activity.setShowWhenLocked(false)
        activity.setTurnScreenOn(false)
      }
      activity.window.clearFlags(
        android.view.WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
          android.view.WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
          android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON,
      )
    }
  }

  private fun createActivityIntent(payload: ReadableMap, action: String, offset: Int): PendingIntent {
    val callId = payload.requiredString("callId")
    val intent = Intent(applicationContext, MainActivity::class.java).apply {
      this.action = action
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
      putExtra("type", payload.optionalString("type") ?: "incoming_call")
      putExtra("callId", callId)
      putExtra("callType", payload.optionalString("callType") ?: "voice")
      putExtra("callerId", payload.optionalString("callerId") ?: "")
      putExtra("callerName", payload.optionalString("callerName") ?: "Ourlime caller")
      putExtra("callerUserName", payload.optionalString("callerUserName") ?: "")
      putExtra("callerProfilePicture", payload.optionalString("callerProfilePicture") ?: "")
      putExtra("expiresAtMs", payload.requiredDouble("expiresAtMs").toLong())
    }
    return PendingIntent.getActivity(
      applicationContext,
      callId.hashCode() + offset,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  private fun ReadableMap.requiredString(key: String): String =
    optionalString(key) ?: throw IllegalArgumentException("Missing incoming-call field: $key")

  private fun ReadableMap.optionalString(key: String): String? =
    if (hasKey(key) && !isNull(key)) getString(key)?.takeIf { it.isNotBlank() } else null

  private fun ReadableMap.requiredDouble(key: String): Double =
    if (hasKey(key) && !isNull(key)) getDouble(key) else throw IllegalArgumentException("Missing incoming-call field: $key")
}
