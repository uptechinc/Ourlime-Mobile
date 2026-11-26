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
import { profilePictureService } from '@/lib/services/ProfilePictureService';
import CachedImage from './CachedImage';

type UserAvatarProps = {
  profileImage?: string | null;
  /**
   * The member's id. Pass it wherever it is known: when profileImage is empty or fails to load, the avatar looks up the
   * member's chosen picture (profileImageSetAs → profileImages), which most user documents do not carry.
   */
  userId?: string | null;
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
  userId,
  firstName = 'User',
  size = 48,
  backgroundColor = '#10b981',
}: UserAvatarProps) {
  const memberId = userId?.trim() || '';
  const [failedSources, setFailedSources] = useState<string[]>([]);
  const [lookedUpImage, setLookedUpImage] = useState<string | null | undefined>(() => (memberId ? profilePictureService.peek(memberId) : undefined));
  const givenUsable = avatarService.resolve(profileImage).kind !== 'initial' && !failedSources.includes(profileImage ?? '');
  const needsLookup = Boolean(memberId) && !givenUsable;
  const source = givenUsable ? profileImage : lookedUpImage && !failedSources.includes(lookedUpImage) ? lookedUpImage : null;
  const resolution = avatarService.resolve(source);
  const normalizedName = firstName && !INVALID_NAMES.has(firstName.trim().toLowerCase()) ? firstName.trim() : 'User';
  const initial = (normalizedName || 'U').charAt(0).toUpperCase();

  useEffect(() => setFailedSources([]), [profileImage, memberId]);

  useEffect(() => {
    if (!needsLookup) return;
    let isActive = true;
    void profilePictureService.get(memberId).then((url) => {
      if (isActive) setLookedUpImage(url);
    });
    return () => {
      isActive = false;
    };
  }, [needsLookup, memberId]);

  const handleImageError = () => {
    diagnosticLogService.warn('UserAvatar', 'image-load', {
      firstName,
      sourceKind: resolution.kind,
      presetName: resolution.kind === 'preset' ? resolution.name : undefined,
    });
    if (source) setFailedSources((current) => (current.includes(source) ? current : [...current, source]));
  };

  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor, alignItems: 'center', justifyContent: 'center' }}>
      {resolution.kind !== 'initial' ? (
        <Text style={{ position: 'absolute', color: '#ffffff', fontSize: Math.max(14, size * 0.4), fontWeight: '800' }}>{initial}</Text>
      ) : null}
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
        <CachedImage uri={resolution.uri} recyclingKey={source ?? resolution.uri} accessibilityLabel={`${firstName} profile picture`} style={{ width: size, height: size, borderRadius: size / 2 }} onError={handleImageError} />
      ) : null}
      {resolution.kind === 'initial' ? (
        <Text style={{ color: '#ffffff', fontSize: Math.max(14, size * 0.4), fontWeight: '800' }}>{initial}</Text>
      ) : null}
    </View>
  );
}
