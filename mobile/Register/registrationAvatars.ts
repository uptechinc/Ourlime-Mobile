import type { ImageSourcePropType } from 'react-native';

export type RegistrationAvatar = { id: string; name: string; image: ImageSourcePropType };

export const cartoonAvatars: RegistrationAvatar[] = [
  { id: 'cartoonAvatarBlackBoy', name: 'Black boy cartoon', image: require('@/assets/images/avatars/cartoonAvatarBlackBoy.png') },
  { id: 'cartoonAvatarWhiteBoy', name: 'White boy cartoon', image: require('@/assets/images/avatars/cartoonAvatarWhiteBoy.png') },
  { id: 'cartoonAvatarBlackGirl', name: 'Black girl cartoon', image: require('@/assets/images/avatars/cartoonAvatarBlackGirl.png') },
  { id: 'cartoonAvatarWhiteGirl', name: 'White girl cartoon', image: require('@/assets/images/avatars/cartoonAvatarWhiteGirl.png') },
];

export const realisticAvatars: RegistrationAvatar[] = [
  { id: 'realisticAvatarWhiteMan', name: 'White man', image: require('@/assets/images/avatars/realisticAvatarWhiteMan.png') },
  { id: 'realisticAvatarBlackWoman', name: 'Black woman', image: require('@/assets/images/avatars/realisticAvatarBlackWoman.png') },
];
