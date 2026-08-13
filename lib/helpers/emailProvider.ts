import { Linking, Platform } from 'react-native';

export type EmailProvider = {
  name: string;
  buttonLabel: string;
  iosScheme: string;
  androidIntent: string;
};

export function getEmailProvider(emailAddress: string): EmailProvider {
  const email = emailAddress.trim().toLowerCase();

  if (/@(gmail|googlemail)\.com$/i.test(email)) {
    return {
      name: 'Gmail',
      buttonLabel: 'Open Gmail',
      iosScheme: 'googlegmail://',
      androidIntent: 'intent:#Intent;action=android.intent.action.MAIN;category=android.intent.category.LAUNCHER;package=com.google.android.gm;end',
    };
  }

  if (/@(outlook|hotmail|live|msn)\.(com|co\.[a-z]{2}|[a-z]{2})$/i.test(email)) {
    return {
      name: 'Outlook',
      buttonLabel: 'Open Outlook',
      iosScheme: 'ms-outlook://',
      androidIntent: 'intent:#Intent;action=android.intent.action.MAIN;category=android.intent.category.LAUNCHER;package=com.microsoft.office.outlook;end',
    };
  }

  if (/@(yahoo|ymail|myyahoo)\.(com|co\.[a-z]{2}|[a-z]{2})$/i.test(email)) {
    return {
      name: 'Yahoo Mail',
      buttonLabel: 'Open Yahoo Mail',
      iosScheme: 'ymail://',
      androidIntent: 'intent:#Intent;action=android.intent.action.MAIN;category=android.intent.category.LAUNCHER;package=com.yahoo.mobile.client.android.mail;end',
    };
  }

  if (/@(icloud|me|mac)\.com$/i.test(email)) {
    return {
      name: 'iCloud Mail',
      buttonLabel: 'Open Apple Mail',
      iosScheme: 'message://',
      androidIntent: 'intent:#Intent;action=android.intent.action.MAIN;category=android.intent.category.APP_EMAIL;end',
    };
  }

  if (/@(proton|protonmail)\.(com|me)$/i.test(email)) {
    return {
      name: 'Proton Mail',
      buttonLabel: 'Open Proton Mail',
      iosScheme: 'protonmail://',
      androidIntent: 'intent:#Intent;action=android.intent.action.MAIN;category=android.intent.category.LAUNCHER;package=ch.protonmail.android;end',
    };
  }

  return {
    name: 'Email',
    buttonLabel: 'Open Email App',
    iosScheme: 'message://',
    androidIntent: 'intent:#Intent;action=android.intent.action.MAIN;category=android.intent.category.APP_EMAIL;end',
  };
}

export async function openEmailApp(emailAddress: string): Promise<void> {
  const provider = getEmailProvider(emailAddress);
  const targetUrl = Platform.OS === 'android' ? provider.androidIntent : provider.iosScheme;

  // 1. Try launching main inbox activity via launcher intent / scheme
  try {
    const canOpen = await Linking.canOpenURL(targetUrl).catch(() => false);
    if (canOpen) {
      await Linking.openURL(targetUrl);
      return;
    }
  } catch {
    // Ignore error
  }

  // 2. Try generic email main view intent on Android or iOS message:// scheme
  const genericInboxUrl = Platform.OS === 'android'
    ? 'intent:#Intent;action=android.intent.action.MAIN;category=android.intent.category.APP_EMAIL;end'
    : 'message://';

  try {
    const canOpenGeneric = await Linking.canOpenURL(genericInboxUrl).catch(() => false);
    if (canOpenGeneric) {
      await Linking.openURL(genericInboxUrl);
      return;
    }
  } catch {
    // Ignore error
  }

  // 3. Fallback to mailto: only if launcher intents are unsupported
  try {
    await Linking.openURL('mailto:');
  } catch {
    // Native mail app not available on device
  }
}
