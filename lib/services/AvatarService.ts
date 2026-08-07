export type PresetAvatarName =
  | 'cartoonAvatarBlackBoy'
  | 'cartoonAvatarWhiteBoy'
  | 'cartoonAvatarBlackGirl'
  | 'cartoonAvatarWhiteGirl'
  | 'realisticAvatarWhiteMan'
  | 'realisticAvatarBlackWoman';

export type AvatarResolution =
  | { kind: 'preset'; name: PresetAvatarName }
  | { kind: 'remote-svg'; uri: string }
  | { kind: 'remote-raster'; uri: string }
  | { kind: 'initial' };

const presetAvatarNames: PresetAvatarName[] = [
  'cartoonAvatarBlackBoy',
  'cartoonAvatarWhiteBoy',
  'cartoonAvatarBlackGirl',
  'cartoonAvatarWhiteGirl',
  'realisticAvatarWhiteMan',
  'realisticAvatarBlackWoman',
];

export class AvatarService {
  private static instance: AvatarService;

  private constructor() {}

  public static getInstance(): AvatarService {
    if (!AvatarService.instance) AvatarService.instance = new AvatarService();
    return AvatarService.instance;
  }

  public resolve(profileImage?: string | null): AvatarResolution {
    const normalizedValue = profileImage?.trim();
    if (!normalizedValue) return { kind: 'initial' };
    const decodedValue = this.safeDecode(normalizedValue).toLowerCase();
    const presetName = presetAvatarNames.find((name) => decodedValue.includes(name.toLowerCase()));
    if (presetName) return { kind: 'preset', name: presetName };
    if (decodedValue.includes('.svg')) return { kind: 'remote-svg', uri: normalizedValue };
    if (/^(https?:|file:|content:|data:image)/i.test(normalizedValue)) {
      return { kind: 'remote-raster', uri: normalizedValue };
    }
    return { kind: 'initial' };
  }

  public getPresetNames(): readonly PresetAvatarName[] {
    return presetAvatarNames;
  }

  private safeDecode(value: string): string {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
}

export const avatarService = AvatarService.getInstance();
