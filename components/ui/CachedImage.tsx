import { Image, type ImageContentFit, type ImageStyle } from 'expo-image';

type CachedImageProps = {
  uri: string;
  style: ImageStyle;
  contentFit?: ImageContentFit;
  accessibilityLabel?: string;
  recyclingKey?: string;
  onError?: () => void;
};

const NEUTRAL_PLACEHOLDER = { blurhash: 'L3O2?a00~q%M00-;D%IU00Rj' };

export default function CachedImage({ uri, style, contentFit = 'cover', accessibilityLabel, recyclingKey, onError }: CachedImageProps) {
  return <Image source={{ uri }} placeholder={NEUTRAL_PLACEHOLDER} style={style} contentFit={contentFit} cachePolicy="memory-disk" recyclingKey={recyclingKey ?? uri} accessibilityLabel={accessibilityLabel} transition={120} onError={onError} />;
}
