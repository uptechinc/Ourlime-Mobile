package com.ourlime.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import android.os.Build

/**
 * PackageInstaller session results for in-app updates. STATUS_PENDING_USER_ACTION launches Android's confirm screen;
 * everything else is forwarded to JavaScript (OurlimeAppUpdateInstallStatus). On success the system replaces the
 * app and ends this process, so "success" is rarely seen by JS.
 */
class OurlimeAppUpdateReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != OurlimeAppUpdateModule.ACTION_INSTALL_STATUS) return
    val status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE)
    val message = intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE) ?: ""
    when (status) {
      PackageInstaller.STATUS_PENDING_USER_ACTION -> {
        val confirmIntent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
          intent.getParcelableExtra(Intent.EXTRA_INTENT, Intent::class.java)
        } else {
          @Suppress("DEPRECATION")
          intent.getParcelableExtra(Intent.EXTRA_INTENT)
        }
        if (confirmIntent == null) {
          OurlimeAppUpdateModule.emitInstallStatus("failure", "Android didn't open the installer. Try again.")
          return
        }
        confirmIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        try {
          context.startActivity(confirmIntent)
          OurlimeAppUpdateModule.emitInstallStatus("pending_user_action", "")
        } catch (_: Exception) {
          OurlimeAppUpdateModule.emitInstallStatus("failure", "Android didn't open the installer. Try again.")
        }
      }
      PackageInstaller.STATUS_SUCCESS -> OurlimeAppUpdateModule.emitInstallStatus("success", "")
      PackageInstaller.STATUS_FAILURE_ABORTED -> OurlimeAppUpdateModule.emitInstallStatus("aborted", "")
      PackageInstaller.STATUS_FAILURE_STORAGE ->
        OurlimeAppUpdateModule.emitInstallStatus("failure", "Not enough storage to install the update. Free some space and try again.")
      PackageInstaller.STATUS_FAILURE_CONFLICT, PackageInstaller.STATUS_FAILURE_INCOMPATIBLE ->
        OurlimeAppUpdateModule.emitInstallStatus("failure", "Android couldn't install this update over the current app. ${message}".trim())
      else -> OurlimeAppUpdateModule.emitInstallStatus("failure", message.ifBlank { "Android couldn't install the update." })
    }
  }
}
