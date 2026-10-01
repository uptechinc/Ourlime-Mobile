package com.ourlime.app

import android.net.Uri
import android.os.Handler
import android.os.Looper
import androidx.annotation.OptIn
import androidx.media3.common.MediaItem
import androidx.media3.common.util.UnstableApi
import androidx.media3.transformer.Composition
import androidx.media3.transformer.EditedMediaItem
import androidx.media3.transformer.ExportException
import androidx.media3.transformer.ExportResult
import androidx.media3.transformer.ProgressHolder
import androidx.media3.transformer.Transformer
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.io.File

/**
 * Cuts a video down to [startMs, endMs] on the device (Lime / feed-post trimmer), so only the chosen part is
 * uploaded. Uses AndroidX Media3 Transformer (same Media3 version expo-video ships). With trim optimisation the
 * untouched middle of the video is copied without re-encoding, so it is fast and keeps quality.
 * Output: an MP4 in the app cache; JavaScript uploads it and the OS can clear it later.
 */
@OptIn(UnstableApi::class)
class OurlimeVideoTrimModule(
  private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {

  companion object {
    private const val MODULE_NAME = "OurlimeVideoTrim"
    private const val PROGRESS_EVENT = "OurlimeVideoTrimProgress"
    private const val PROGRESS_INTERVAL_MS = 250L
  }

  private val mainHandler = Handler(Looper.getMainLooper())
  private var activeTransformer: Transformer? = null

  override fun getName(): String = MODULE_NAME

  @ReactMethod
  fun trimVideo(inputUri: String, startMs: Double, endMs: Double, promise: Promise) {
    val start = startMs.toLong().coerceAtLeast(0L)
    val end = endMs.toLong()
    if (end <= start) {
      promise.reject("VIDEO_TRIM_INVALID_RANGE", "The end of the trim must be after the start.")
      return
    }
    // Transformer must be created and driven on a thread with a Looper: use the main thread.
    mainHandler.post {
      if (activeTransformer != null) {
        promise.reject("VIDEO_TRIM_BUSY", "Another video is already being trimmed.")
        return@post
      }
      try {
        val output = File(reactContext.cacheDir, "ourlime-trim-${System.currentTimeMillis()}.mp4")
        val mediaItem = MediaItem.Builder()
          .setUri(Uri.parse(inputUri))
          .setClippingConfiguration(
            MediaItem.ClippingConfiguration.Builder()
              .setStartPositionMs(start)
              .setEndPositionMs(end)
              .build(),
          )
          .build()
        val progressHolder = ProgressHolder()
        lateinit var progressTick: Runnable

        val transformer = Transformer.Builder(reactContext)
          .experimentalSetTrimOptimizationEnabled(true)
          .addListener(object : Transformer.Listener {
            override fun onCompleted(composition: Composition, exportResult: ExportResult) {
              mainHandler.removeCallbacks(progressTick)
              activeTransformer = null
              emitProgress(1.0)
              promise.resolve(Arguments.createMap().apply {
                putString("uri", Uri.fromFile(output).toString())
                putDouble("durationMs", (if (exportResult.durationMs > 0) exportResult.durationMs else end - start).toDouble())
                putDouble("sizeBytes", output.length().toDouble())
              })
            }

            override fun onError(composition: Composition, exportResult: ExportResult, exportException: ExportException) {
              mainHandler.removeCallbacks(progressTick)
              activeTransformer = null
              output.delete()
              promise.reject("VIDEO_TRIM_FAILED", exportException.message ?: "The video could not be trimmed.", exportException)
            }
          })
          .build()

        progressTick = Runnable {
          val current = activeTransformer ?: return@Runnable
          if (current.getProgress(progressHolder) == Transformer.PROGRESS_STATE_AVAILABLE) {
            emitProgress(progressHolder.progress / 100.0)
          }
          mainHandler.postDelayed(progressTick, PROGRESS_INTERVAL_MS)
        }

        activeTransformer = transformer
        transformer.start(EditedMediaItem.Builder(mediaItem).build(), output.absolutePath)
        mainHandler.postDelayed(progressTick, PROGRESS_INTERVAL_MS)
      } catch (error: Throwable) {
        activeTransformer = null
        promise.reject("VIDEO_TRIM_FAILED", error.message ?: "The video could not be trimmed.", error)
      }
    }
  }

  @ReactMethod
  fun cancelTrim(promise: Promise) {
    mainHandler.post {
      activeTransformer?.cancel()
      activeTransformer = null
      promise.resolve(null)
    }
  }

  @ReactMethod
  fun addListener(eventName: String) = Unit

  @ReactMethod
  fun removeListeners(count: Int) = Unit

  private fun emitProgress(progress: Double) {
    if (!reactContext.hasActiveReactInstance()) return
    reactContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit(PROGRESS_EVENT, Arguments.createMap().apply { putDouble("progress", progress.coerceIn(0.0, 1.0)) })
  }
}
