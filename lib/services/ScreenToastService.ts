import { toast } from 'sonner-native';

/**
 * Toasts that belong to the screen they came from (e.g. "Repost removed"): each has a stable id, so repeated taps
 * replace one toast instead of stacking, and they're dismissed when the user moves to another screen.
 */
export class ScreenToastService {
  private static instance: ScreenToastService;
  private readonly activeIds = new Set<string>();

  private constructor() {}

  public static getInstance(): ScreenToastService {
    if (!ScreenToastService.instance) ScreenToastService.instance = new ScreenToastService();
    return ScreenToastService.instance;
  }

  public success(id: string, message: string): void {
    this.activeIds.add(id);
    toast.success(message, { id, onDismiss: () => this.activeIds.delete(id), onAutoClose: () => this.activeIds.delete(id) });
  }

  /** Called by the toast host when the route changes. */
  public dismissAll(): void {
    this.activeIds.forEach((id) => toast.dismiss(id));
    this.activeIds.clear();
  }
}

export const screenToastService = ScreenToastService.getInstance();
