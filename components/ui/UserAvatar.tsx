import { useEffect, useState } from 'react';
import { Image, Text, View } from 'react-native';
import { SvgUri } from 'react-native-svg';
import cartoonAvatarBlackBoy from '@/assets/images/avatars/cartoonAvatarBlackBoy.png';
import cartoonAvatarWhiteBoy from '@/assets/images/avatars/cartoonAvatarWhiteBoy.png';
import cartoonAvatarBlackGirl from '@/assets/images/avatars/cartoonAvatarBlackGirl.png';
import cartoonAvatarWhiteGirl from '@/assets/images/avatars/cartoonAvatarWhiteGirl.png';
import realisticAvatarWhiteMan from '@/assets/images/avatars/realisticAvatarWhiteMan.png';
import realisticAvatarBlackWoman from '@/assets/images/avatars/realisticAvatarBlackWoman.png';
import { AvatarService, type PresetAvatarName } from '@/lib/services/AvatarService';
import { DiagnosticLogService } from '@/lib/services/DiagnosticLogService';
import CachedImage from './CachedImage';

type UserAvatarProps = {
  profileImage?: string | null;
  firstName?: string;
  size?: number;
  backgroundColor?: string;
};

const avatarService = AvatarService.getInstance();
const diagnosticLogService = DiagnosticLogService.getInstance();
const presetAvatarImages: Record<PresetAvatarName, number> = {
  cartoonAvatarBlackBoy,
  cartoonAvatarWhiteBoy,
  cartoonAvatarBlackGirl,
  cartoonAvatarWhiteGirl,
  realisticAvatarWhiteMan,
  realisticAvatarBlackWoman,
};

const INVALID_NAMES = new Set(['null', 'undefined']);

export default function UserAvatar({
  profileImage,
  firstName = 'User',
  size = 48,
  backgroundColor = '#10b981',
}: UserAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const resolution = imageFailed ? { kind: 'initial' as const } : avatarService.resolve(profileImage);
  const normalizedName = firstName && !INVALID_NAMES.has(firstName.trim().toLowerCase()) ? firstName.trim() : 'User';
  const initial = (normalizedName || 'U').charAt(0).toUpperCase();

  useEffect(() => setImageFailed(false), [profileImage]);

  const handleImageError = () => {
    diagnosticLogService.warn('UserAvatar', 'image-load', {
      firstName,
      sourceKind: resolution.kind,
      presetName: resolution.kind === 'preset' ? resolution.name : undefined,
    });
    setImageFailed(true);
  };

  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor, alignItems: 'center', justifyContent: 'center' }}>
      {resolution.kind === 'preset' ? (
        <Image
          source={presetAvatarImages[resolution.name]}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          resizeMode="cover"
          onError={handleImageError}
        />
      ) : null}
      {resolution.kind === 'remote-svg' ? (
        <SvgUri width={size} height={size} uri={resolution.uri} onError={handleImageError} />
      ) : null}
      {resolution.kind === 'remote-raster' ? (
        <CachedImage uri={resolution.uri} recyclingKey={profileImage ?? resolution.uri} accessibilityLabel={`${firstName} profile picture`} style={{ width: size, height: size, borderRadius: size / 2 }} onError={handleImageError} />
      ) : null}
      {resolution.kind === 'initial' ? (
        <Text style={{ color: '#ffffff', fontSize: Math.max(14, size * 0.4), fontWeight: '800' }}>{initial}</Text>
      ) : null}
    </View>
  );
}
