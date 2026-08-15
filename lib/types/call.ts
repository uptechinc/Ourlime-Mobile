export type CallType = 'voice' | 'video';

export type CallState = 'ringing' | 'connecting' | 'active' | 'ended';

export type CallEndReason =
  | 'declined'
  | 'canceled'
  | 'missed'
  | 'remote_ended'
  | 'failed'
  | 'answered_elsewhere';

export type CallAction = 'answer' | 'connected' | 'decline' | 'cancel' | 'expire' | 'end' | 'fail';

export type CallParticipant = {
  userId: string;
  displayName: string;
  userName: string;
  profilePicture?: string;
};

export type CallSession = {
  id: string;
  channelName: string;
  caller: CallParticipant;
  callee: CallParticipant;
  type: CallType;
  state: CallState;
  endReason: CallEndReason | null;
  answeredByDeviceId: string | null;
  createdAtMs: number;
  expiresAtMs: number;
  answeredAtMs: number | null;
  endedAtMs: number | null;
};

export type AgoraParticipantCredentials = {
  appId: string;
  token: string;
  channelName: string;
  uid: number;
  expiresAtMs: number;
};

export type CallDeviceTransport = 'expo' | 'fcm' | 'apns_voip';

export type CallDeviceToken = {
  token: string;
  platform: 'android' | 'ios';
  transport: CallDeviceTransport;
  deviceId: string;
};

export type CallPushPayload = {
  type: 'incoming_call' | 'call_state';
  callId: string;
  callType: CallType;
  callerId: string;
  callerName: string;
  callerUserName: string;
  callerProfilePicture?: string;
  expiresAtMs: number;
  state?: CallState;
  endReason?: CallEndReason | null;
};

export type CallEventMessage = {
  kind: 'call';
  callId: string;
  callType: CallType;
  state: CallState;
  endReason: CallEndReason | null;
};

export type CreateCallInput = {
  calleeId: string;
  type: CallType;
  deviceId: string;
};

export type UpdateCallInput = {
  action: CallAction;
  deviceId: string;
};
