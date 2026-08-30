export type DeviceInfo = {
  platform: 'web' | 'ios' | 'android' | 'desktop';
  browser?: string;
  ip?: string;
  location?: string;
  userAgent?: string;
};

export type QRLoginSession = {
  sessionId: string;
  shortCode: string;
  token?: string;
  status: 'pending' | 'scanned' | 'confirmed' | 'rejected' | 'expired' | 'consumed';
  createdAt: string;
  expiresAt: string;
  deviceInfo: DeviceInfo;
  authenticatedUser?: {
    userId: string;
    email?: string;
    userName?: string;
    confirmedAt: string;
    customToken?: string;
  };
  scannerDeviceInfo?: DeviceInfo;
  rejectionReason?: string;
};

export type ActiveDeviceSession = {
  id: string;
  userId: string;
  platform: 'web' | 'ios' | 'android' | 'desktop';
  browser?: string;
  ip?: string;
  location?: string;
  createdAt: string;
  lastActiveAt: string;
};