package com.ourlime.app

import android.app.Activity
import android.app.PictureInPictureParams
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import android.util.Rational
import androidx.annotation.RequiresApi

/**
 * Picture-in-picture for calls (WhatsApp-style): while a video call is live, pressing Home shrinks the app into a
 * small floating window that keeps showing both people.
 *
 * JavaScript turns it on/off with OurlimeIncomingCall.setPictureInPictureEnabled (only during a live video call).
 * Android 12+ enters automatically (autoEnterEnabled); older versions enter from MainActivity.onUserLeaveHint.
 * Mode changes are forwarded to JavaScript, which swaps the call screen for a compact, control-free view.
 */
object OurlimePictureInPicture {
  private const val TAG = "OurlimePiP"
  private val CALL_ASPECT_RATIO = Rational(9, 16)

  @Volatile
  private var isEnabled = false
  private var modeListener: ((Boolean) -> Unit)? = null

  fun setModeListener(listener: ((Boolean) -> Unit)?) {
    modeListener = listener
  }

  fun isSupported(activity: Activity): Boolean =
    Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
      activity.packageManager.hasSystemFeature(PackageManager.FEATURE_PICTURE_IN_PICTURE)

  /** Called from JavaScript (on the UI thread) when a video call starts or stops. */
  fun setEnabled(activity: Activity, enabled: Boolean) {
    isEnabled = enabled
    if (!isSupported(activity)) return
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      try {
        activity.setPictureInPictureParams(buildParams(enabled))
      } catch (error: IllegalStateException) {
        Log.w(TAG, "setPictureInPictureParams failed", error)
      }
    }
  }

  /** Enters picture-in-picture right away (e.g. from a button). Returns false when unavailable. */
  fun enter(activity: Activity): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O || !isSupported(activity) || activity.isInPictureInPictureMode) return false
    return try {
      activity.enterPictureInPictureMode(buildParams(isEnabled))
    } catch (error: IllegalStateException) {
      Log.w(TAG, "enterPictureInPictureMode failed", error)
      false
    }
  }

  /** Android 8 to 11 have no auto-enter: MainActivity forwards the Home press here. */
  fun onUserLeaveHint(activity: Activity) {
    if (!isEnabled || Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) return
    enter(activity)
  }

  fun onModeChanged(isInPictureInPicture: Boolean) {
    modeListener?.invoke(isInPictureInPicture)
  }

  @RequiresApi(Build.VERSION_CODES.O)
  private fun buildParams(autoEnter: Boolean): PictureInPictureParams {
    val builder = PictureInPictureParams.Builder().setAspectRatio(CALL_ASPECT_RATIO)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      builder.setAutoEnterEnabled(autoEnter)
      builder.setSeamlessResizeEnabled(false)
    }
    return builder.build()
  }
}
