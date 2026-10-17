package com.ourlime.app

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInfo
import android.content.pm.PackageInstaller
import android.content.pm.PackageManager
import android.net.ConnectivityManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.pm.PackageInfoCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import okhttp3.Call
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.IOException
import java.lang.ref.WeakReference
import java.security.MessageDigest
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

/**
 * In-app APK updates for sideloaded builds (JS: lib/services/NativeAppUpdateService.ts).
 *
 * downloadApk streams the published APK into cacheDir/updates with HTTP Range resume, hashing as it goes, and refuses
 * a file whose size or SHA-256 doesn't match siteConfig/mobileApp. verifyApk checks package name, a higher
 * versionCode and the installed app's signing certificate before Android ever sees the file. installApk writes it into
 * a PackageInstaller session; Android shows its own confirmation and replaces the app (the process ends on success).
 *
 * Every method has a single signature (no overloads, AGENTS §5) and rejects with an UPDATE_* code and a readable message.
 */
class OurlimeAppUpdateModule(
  private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {

  companion object {
    private const val MODULE_NAME = "OurlimeAppUpdate"
    private const val PROGRESS_EVENT = "OurlimeAppUpdateProgress"
    private const val INSTALL_EVENT = "OurlimeAppUpdateInstallStatus"
    private const val UPDATES_DIRECTORY = "updates"
    private const val PROGRESS_INTERVAL_MS = 200L
    private const val SPACE_HEADROOM_BYTES = 50L * 1024L * 1024L
    private const val BUFFER_SIZE = 64 * 1024
    const val ACTION_INSTALL_STATUS = "com.ourlime.app.APP_UPDATE_INSTALL_STATUS"

    private var activeModule: WeakReference<OurlimeAppUpdateModule>? = null

    /** Called by OurlimeAppUpdateReceiver with the PackageInstaller result. */
    fun emitInstallStatus(status: String, message: String) {
      activeModule?.get()?.emitEvent(INSTALL_EVENT, status, message)
    }
  }

  private val executor = Executors.newSingleThreadExecutor()
  private val isDownloading = AtomicBoolean(false)
  private val isCancelled = AtomicBoolean(false)
  @Volatile private var activeCall: Call? = null
  private val httpClient: OkHttpClient by lazy {
    OkHttpClient.Builder()
      .connectTimeout(20, TimeUnit.SECONDS)
      .readTimeout(60, TimeUnit.SECONDS)
      .retryOnConnectionFailure(true)
      .build()
  }

  init {
    activeModule = WeakReference(this)
  }

  override fun getName(): String = MODULE_NAME

  // Required by NativeEventEmitter on the JS side.
  @ReactMethod
  fun addListener(eventName: String) = Unit

  @ReactMethod
  fun removeListeners(count: Int) = Unit

  // ── Installed build ─────────────────────────────────────────────────────────

  @ReactMethod
  fun getInstalledInfo(promise: Promise) {
    try {
      val info = installedPackageInfo()
      promise.resolve(Arguments.createMap().apply {
        putString("versionName", info.versionName ?: "")
        putDouble("versionCode", PackageInfoCompat.getLongVersionCode(info).toDouble())
        putString("signingCertSha256", signerHashes(info).firstOrNull() ?: "")
      })
    } catch (error: Exception) {
      promise.reject("UPDATE_UNAVAILABLE", "The installed version could not be read.", error)
    }
  }

  @ReactMethod
  fun canInstallPackages(promise: Promise) {
    promise.resolve(canRequestInstalls())
  }

  @ReactMethod
  fun openInstallPermissionSettings(promise: Promise) {
    try {
      val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${reactContext.packageName}"))
      } else {
        Intent(Settings.ACTION_SECURITY_SETTINGS)
      }
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      (reactContext.currentActivity ?: reactContext).startActivity(intent)
      promise.resolve(null)
    } catch (error: Exception) {
      promise.reject("UPDATE_INSTALL_PERMISSION", "Android settings could not be opened. Allow Ourlime under Settings → Apps → Special app access → Install unknown apps.", error)
    }
  }

  @ReactMethod
  fun isMeteredConnection(promise: Promise) {
    try {
      val connectivity = reactContext.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
      promise.resolve(connectivity.isActiveNetworkMetered)
    } catch (_: Exception) {
      promise.resolve(false)
    }
  }

  // ── Download ────────────────────────────────────────────────────────────────

  @ReactMethod
  fun downloadApk(url: String, expectedSha256: String, expectedSizeBytes: Double, promise: Promise) {
    val expectedHash = expectedSha256.lowercase()
    val expectedSize = expectedSizeBytes.toLong()
    if (!url.startsWith("https://") || !Regex("^[a-f0-9]{64}$").matches(expectedHash) || expectedSize <= 0L) {
      promise.reject("UPDATE_INVALID_APK", "The published update details are incomplete.")
      return
    }
    if (!isDownloading.compareAndSet(false, true)) {
      promise.reject("UPDATE_BUSY", "An update is already downloading.")
      return
    }
    isCancelled.set(false)
    executor.execute {
      try {
        val apk = download(url, expectedHash, expectedSize)
        promise.resolve(Arguments.createMap().apply {
          putString("path", apk.absolutePath)
          putDouble("sizeBytes", apk.length().toDouble())
          putString("sha256", expectedHash)
        })
      } catch (error: UpdateException) {
        promise.reject(error.code, error.message, error)
      } catch (error: Exception) {
        if (isCancelled.get()) {
          promise.reject("UPDATE_CANCELLED", "The download was cancelled.", error)
        } else {
          promise.reject("UPDATE_NETWORK", "The download was interrupted. Check your connection and try again; it continues where it stopped.", error)
        }
      } finally {
        activeCall = null
        isDownloading.set(false)
      }
    }
  }

  @ReactMethod
  fun cancelDownload(promise: Promise) {
    isCancelled.set(true)
    activeCall?.cancel()
    promise.resolve(null)
  }

  @ReactMethod
  fun clearDownloads(promise: Promise) {
    if (isDownloading.get()) {
      promise.resolve(null)
      return
    }
    updatesDirectory().listFiles()?.forEach { file -> file.delete() }
    promise.resolve(null)
  }

  private class UpdateException(val code: String, message: String) : Exception(message)

  private fun updatesDirectory(): File = File(reactContext.cacheDir, UPDATES_DIRECTORY).apply { mkdirs() }

  private fun download(url: String, expectedHash: String, expectedSize: Long): File {
    val directory = updatesDirectory()
    val fileStem = "ourlime-${expectedHash.take(16)}"
    val apk = File(directory, "$fileStem.apk")
    val partial = File(directory, "$fileStem.part")
    // Only this release's files stay; older or abandoned downloads are removed.
    directory.listFiles()?.filter { file -> file != apk && file != partial }?.forEach { file -> file.delete() }

    if (apk.exists()) {
      if (apk.length() == expectedSize && sha256Of(apk) == expectedHash) return apk
      apk.delete()
    }
    if (partial.length() > expectedSize) partial.delete()

    val remaining = expectedSize - partial.length()
    if (directory.usableSpace < remaining + SPACE_HEADROOM_BYTES) {
      val neededMb = (remaining + SPACE_HEADROOM_BYTES) / (1024L * 1024L)
      throw UpdateException("UPDATE_NO_SPACE", "Not enough free space. The update needs about $neededMb MB; free some space and try again.")
    }

    val digest = MessageDigest.getInstance("SHA-256")
    var received = 0L
    if (partial.exists() && partial.length() > 0L) {
      received = partial.length()
      FileInputStream(partial).use { input -> updateDigest(digest, input) }
    }

    val requestBuilder = Request.Builder().url(url)
    if (received in 1 until expectedSize) requestBuilder.header("Range", "bytes=$received-")
    val call = httpClient.newCall(requestBuilder.build())
    activeCall = call
    if (isCancelled.get()) throw IOException("cancelled")

    call.execute().use { response ->
      val append = response.code == 206 && received > 0L
      if (!response.isSuccessful) {
        if (response.code == 416) partial.delete()
        throw UpdateException("UPDATE_HTTP", "The update could not be downloaded (HTTP ${response.code}). Try again later.")
      }
      if (!append && received > 0L) {
        // The server ignored the Range header: start over.
        received = 0L
        digest.reset()
      }
      val body = response.body ?: throw UpdateException("UPDATE_HTTP", "The update server sent an empty response.")
      FileOutputStream(partial, append).use { output ->
        body.byteStream().use { input ->
          val buffer = ByteArray(BUFFER_SIZE)
          var lastEmit = 0L
          while (true) {
            if (isCancelled.get()) throw IOException("cancelled")
            val count = input.read(buffer)
            if (count < 0) break
            output.write(buffer, 0, count)
            digest.update(buffer, 0, count)
            received += count
            if (received > expectedSize) {
              throw UpdateException("UPDATE_SIZE", "The download is larger than the published update. It was discarded.")
            }
            val now = System.currentTimeMillis()
            if (now - lastEmit >= PROGRESS_INTERVAL_MS) {
              lastEmit = now
              emitProgress(received, expectedSize)
            }
          }
          output.fd.sync()
        }
      }
    }
    emitProgress(received, expectedSize)

    if (received != expectedSize) {
      partial.delete()
      throw UpdateException("UPDATE_SIZE", "The download is incomplete or the wrong size. Try again.")
    }
    val actualHash = digest.digest().toHex()
    if (actualHash != expectedHash) {
      partial.delete()
      throw UpdateException("UPDATE_CHECKSUM", "The download doesn't match the published update (checksum mismatch). It was discarded.")
    }
    if (!partial.renameTo(apk)) throw UpdateException("UPDATE_NO_SPACE", "The update could not be saved. Free some space and try again.")
    return apk
  }

  // ── Verify ──────────────────────────────────────────────────────────────────

  @ReactMethod
  fun verifyApk(path: String, promise: Promise) {
    executor.execute {
      try {
        val apk = requireUpdateFile(path)
        val archive = archivePackageInfo(apk)
          ?: throw UpdateException("UPDATE_INVALID_APK", "The downloaded file isn't a valid Android app.")
        if (archive.packageName != reactContext.packageName) {
          throw UpdateException("UPDATE_WRONG_PACKAGE", "The download is a different app, not Ourlime. It was not installed.")
        }
        val installed = installedPackageInfo()
        val archiveVersion = PackageInfoCompat.getLongVersionCode(archive)
        val installedVersion = PackageInfoCompat.getLongVersionCode(installed)
        if (archiveVersion <= installedVersion) {
          throw UpdateException("UPDATE_NOT_NEWER", "This download (build $archiveVersion) isn't newer than the installed Ourlime (build $installedVersion).")
        }
        val installedSigners = signerHashes(installed)
        val archiveSigners = signerHashes(archive)
        if (installedSigners.isEmpty() || archiveSigners.none { hash -> hash in installedSigners }) {
          throw UpdateException("UPDATE_WRONG_SIGNATURE", "The download isn't signed with Ourlime's key, so Android would refuse it. It was not installed.")
        }
        promise.resolve(Arguments.createMap().apply {
          putDouble("versionCode", archiveVersion.toDouble())
          putString("versionName", archive.versionName ?: "")
        })
      } catch (error: UpdateException) {
        promise.reject(error.code, error.message, error)
      } catch (error: Exception) {
        promise.reject("UPDATE_INVALID_APK", "The downloaded file couldn't be checked.", error)
      }
    }
  }

  // ── Install ─────────────────────────────────────────────────────────────────

  @ReactMethod
  fun installApk(path: String, promise: Promise) {
    if (!canRequestInstalls()) {
      promise.reject("UPDATE_INSTALL_PERMISSION", "Allow Ourlime to install updates first.")
      return
    }
    executor.execute {
      try {
        val apk = requireUpdateFile(path)
        val installer = reactContext.packageManager.packageInstaller
        val params = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL).apply {
          setAppPackageName(reactContext.packageName)
          setSize(apk.length())
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED)
          }
        }
        val sessionId = installer.createSession(params)
        installer.openSession(sessionId).use { session ->
          session.openWrite("ourlime-update.apk", 0, apk.length()).use { output ->
            FileInputStream(apk).use { input -> input.copyTo(output, BUFFER_SIZE) }
            session.fsync(output)
          }
          val statusIntent = Intent(reactContext, OurlimeAppUpdateReceiver::class.java)
            .setAction(ACTION_INSTALL_STATUS)
            .setPackage(reactContext.packageName)
          // PackageInstaller fills in the status extras, so the PendingIntent must be mutable (explicit component).
          val flags = PendingIntent.FLAG_UPDATE_CURRENT or
            (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) PendingIntent.FLAG_MUTABLE else 0)
          val pendingIntent = PendingIntent.getBroadcast(reactContext, sessionId, statusIntent, flags)
          session.commit(pendingIntent.intentSender)
        }
        promise.resolve(null)
      } catch (error: UpdateException) {
        promise.reject(error.code, error.message, error)
      } catch (error: Exception) {
        promise.reject("UPDATE_INSTALL_FAILED", "Android couldn't start the installation. Try again.", error)
      }
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private fun canRequestInstalls(): Boolean =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) reactContext.packageManager.canRequestPackageInstalls() else true

  /** Only files this module downloaded can be verified or installed. */
  private fun requireUpdateFile(path: String): File {
    val apk = File(path).canonicalFile
    val directory = updatesDirectory().canonicalFile
    if (apk.parentFile != directory || !apk.isFile || !apk.name.endsWith(".apk")) {
      throw UpdateException("UPDATE_INVALID_APK", "The update file is missing. Download it again.")
    }
    return apk
  }

  @Suppress("DEPRECATION")
  private fun signingFlags(): Int =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) PackageManager.GET_SIGNING_CERTIFICATES else PackageManager.GET_SIGNATURES

  @Suppress("DEPRECATION")
  private fun installedPackageInfo(): PackageInfo =
    reactContext.packageManager.getPackageInfo(reactContext.packageName, signingFlags())

  @Suppress("DEPRECATION")
  private fun archivePackageInfo(apk: File): PackageInfo? =
    reactContext.packageManager.getPackageArchiveInfo(apk.absolutePath, signingFlags())

  /** SHA-256 of every certificate in the signing lineage (current signer first). */
  @Suppress("DEPRECATION")
  private fun signerHashes(info: PackageInfo): List<String> {
    val certificates = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      val signingInfo = info.signingInfo ?: return emptyList()
      if (signingInfo.hasMultipleSigners()) {
        signingInfo.apkContentsSigners.toList()
      } else {
        signingInfo.signingCertificateHistory.toList().reversed()
      }
    } else {
      info.signatures?.toList() ?: emptyList()
    }
    return certificates.map { signature -> MessageDigest.getInstance("SHA-256").digest(signature.toByteArray()).toHex() }
  }

  private fun updateDigest(digest: MessageDigest, input: FileInputStream) {
    val buffer = ByteArray(BUFFER_SIZE)
    while (true) {
      val count = input.read(buffer)
      if (count < 0) break
      digest.update(buffer, 0, count)
    }
  }

  private fun sha256Of(file: File): String {
    val digest = MessageDigest.getInstance("SHA-256")
    FileInputStream(file).use { input -> updateDigest(digest, input) }
    return digest.digest().toHex()
  }

  private fun ByteArray.toHex(): String = joinToString("") { byte -> "%02x".format(byte) }

  private fun emitProgress(bytesReceived: Long, totalBytes: Long) {
    try {
      reactContext
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit(PROGRESS_EVENT, Arguments.createMap().apply {
          putDouble("bytesReceived", bytesReceived.toDouble())
          putDouble("totalBytes", totalBytes.toDouble())
        })
    } catch (_: Exception) {
      // JS not ready (e.g. reloading); the next tick catches up.
    }
  }

  fun emitEvent(eventName: String, status: String, message: String) {
    try {
      reactContext
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit(eventName, Arguments.createMap().apply {
          putString("status", status)
          putString("message", message)
        })
    } catch (_: Exception) {
      // JS not ready; the app is about to be replaced anyway.
    }
  }
}
