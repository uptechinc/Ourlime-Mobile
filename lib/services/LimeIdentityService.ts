export type LimeAuthorIdentityInput = {
  recordOwnerUserId: string;
  isRepost: boolean;
  repostedFromUserId?: string;
  embeddedUserId?: string;
};

export class LimeIdentityService {
  private static instance: LimeIdentityService;

  private constructor() {}

  public static getInstance(): LimeIdentityService {
    if (!LimeIdentityService.instance) {
      LimeIdentityService.instance = new LimeIdentityService();
    }
    return LimeIdentityService.instance;
  }

  public resolveAuthorUserId(input: LimeAuthorIdentityInput): string {
    if (!input.isRepost) return input.recordOwnerUserId;
    return input.repostedFromUserId?.trim()
      || input.embeddedUserId?.trim()
      || input.recordOwnerUserId;
  }
}

export const limeIdentityService = LimeIdentityService.getInstance();
