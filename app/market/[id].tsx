import { useLocalSearchParams } from 'expo-router';
import ProductDetailsScreen from '@/components/market/details/ProductDetailsScreen';

export default function MarketProductRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ProductDetailsScreen key={id} productId={typeof id === 'string' ? id : ''} />;
}
