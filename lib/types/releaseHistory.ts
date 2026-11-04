/** 'app' is a new build (APK or Play bundle, new versionCode); 'ota' is an over-the-air update to the same build. */
export type ReleaseKind = 'app' | 'ota';

export type AppRelease = {
  /** Unique: the version for an app release, `<version>-ota-<date>` (plus a suffix if needed) for an OTA. */
  id: string;
  version: string;
  versionCode: number;
  kind: ReleaseKind;
  /** YYYY-MM-DD, the day it was published. */
  date: string;
  notes: string[];
};

export type ReleaseHistoryFile = { releases: AppRelease[] };
