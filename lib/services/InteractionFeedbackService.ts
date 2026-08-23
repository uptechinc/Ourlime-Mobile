import * as Haptics from 'expo-haptics';

export type InteractionFeedbackKind = 'selection' | 'like' | 'comment' | 'share' | 'post' | 'message' | 'success' | 'warning';

export class InteractionFeedbackService {
  private static instance: InteractionFeedbackService | undefined;

  public static getInstance(): InteractionFeedbackService {
    if (!InteractionFeedbackService.instance) {
      InteractionFeedbackService.instance = new InteractionFeedbackService();
    }
    return InteractionFeedbackService.instance;
  }

  private constructor() {}

  public async play(kind: InteractionFeedbackKind): Promise<void> {
    try {
      if (kind === 'success') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        return;
      }
      if (kind === 'warning') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        return;
      }
      if (kind === 'like' || kind === 'post') {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        return;
      }
      if (kind === 'share' || kind === 'comment' || kind === 'message') {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        return;
      }
      await Haptics.selectionAsync();
    } catch {
      // Haptics can be unavailable in simulators, web, or low-power device modes.
    }
  }
}

export const interactionFeedbackService = InteractionFeedbackService.getInstance();
