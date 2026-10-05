import { cacheDirectory, downloadAsync } from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { ensureMediaUrl } from '@/lib/helpers/mediaUrl';

/**
 * Saves/shares a chat file through the system share sheet ("Save to Files", Drive, WhatsApp, …) instead of opening
 * the link in a browser.
 */
export class ChatFileShareService {
  private static instance: ChatFileShareService;
  private readonly inFlight = new Set<string>();

  private constructor() {}

  public static getInstance(): ChatFileShareService {
    if (!ChatFileShareService.instance) ChatFileShareService.instance = new ChatFileShareService();
    return ChatFileShareService.instance;
  }

  public async share(url: string, fileName: string, mimeType?: string): Promise<void> {
    if (this.inFlight.has(url)) return;
    this.inFlight.add(url);
    try {
      if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');
      const safeName = (fileName || 'file').replace(/[^\w.\- ]+/g, '_').slice(-120) || 'file';
      const target = `${cacheDirectory ?? ''}chat-${Date.now()}-${safeName}`;
      const result = await downloadAsync(ensureMediaUrl(url) || url, target);
      if (result.status < 200 || result.status >= 300) throw new Error('The file could not be downloaded.');
      await Sharing.shareAsync(result.uri, { mimeType: mimeType || undefined, dialogTitle: safeName });
    } finally {
      this.inFlight.delete(url);
    }
  }
}

export const chatFileShareService = ChatFileShareService.getInstance();
