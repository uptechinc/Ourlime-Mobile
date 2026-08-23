import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Linking,
  Modal,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, PackageSearch, Search, SlidersHorizontal, X } from 'lucide-react-native';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { marketService, type MarketCatalogData } from '@/lib/services/MarketService';
import { auth } from '@/lib/firebaseConfig';
import { messagingService } from '@/lib/messaging/MessagingService';
import type { ContactInfoItem, Product, ProductVariant } from '@/types/productTypes';
import SwipeDismissSurface from '@/components/ui/SwipeDismissSurface';
import { interactionFeedbackService } from '@/lib/services/InteractionFeedbackService';

const PAGE_SIZE = 20;

export default function MarketScreen() {
  const router = useRouter();
  const { product: requestedProductId } = useLocalSearchParams<{ product?: string }>();
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const [catalog, setCatalog] = useState<MarketCatalogData | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedImage, setSelectedImage] = useState('');
  const [selectedColorVariantId, setSelectedColorVariantId] = useState('');
  const [selectedSizeVariantId, setSelectedSizeVariantId] = useState('');
  const [sendingInquiry, setSendingInquiry] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const columnCount = width >= 760 ? 3 : 2;

  const loadCatalog = useCallback(async (options: { refresh?: boolean } = {}) => {
    if (options.refresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const nextCatalog = await marketService.fetchCatalog({
        category: selectedCategory,
        searchTerm: submittedQuery,
        cursor: null,
        limit: PAGE_SIZE,
      });
      setCatalog(nextCatalog);
      setProducts(nextCatalog.products);
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : 'The marketplace could not be loaded.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedCategory, submittedQuery]);

  const handleLoadMore = useCallback(async () => {
    if (!catalog?.pagination.hasMore || !catalog.pagination.nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const nextCatalog = await marketService.fetchCatalog({
        category: selectedCategory,
        searchTerm: submittedQuery,
        cursor: catalog.pagination.nextCursor,
        limit: PAGE_SIZE,
      });
      setCatalog(nextCatalog);
      setProducts((currentProducts) => [
        ...currentProducts,
        ...nextCatalog.products.filter((product) => !currentProducts.some((currentProduct) => currentProduct.id === product.id)),
      ]);
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : 'More marketplace products could not be loaded.');
    } finally {
      setLoadingMore(false);
    }
  }, [catalog, loadingMore, selectedCategory, submittedQuery]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    if (!requestedProductId || products.length === 0) return;
    const requestedProduct = products.find((product) => product.id === requestedProductId);
    if (requestedProduct) setSelectedProduct(requestedProduct);
  }, [products, requestedProductId]);

  const handleSearch = () => setSubmittedQuery(query.trim());
  const handleClearFilters = () => {
    setQuery('');
    setSubmittedQuery('');
    setSelectedCategory(undefined);
  };

  const getProductPrice = useCallback((productId: string): string => {
    const prices = (catalog?.variants ?? [])
      .filter((variant: ProductVariant) => variant.productId === productId && variant.status !== 'inactive')
      .map((variant: ProductVariant) => variant.price)
      .filter((price) => Number.isFinite(price));
    if (prices.length === 0) return 'Contact seller';
    const minimum = Math.min(...prices);
    const maximum = Math.max(...prices);
    return minimum === maximum ? `$${minimum.toFixed(2)}` : `$${minimum.toFixed(2)} – $${maximum.toFixed(2)}`;
  }, [catalog?.variants]);

  const productColorVariants = useMemo(() => selectedProduct ? (catalog?.colorVariants ?? []).filter((variant) => variant.productId === selectedProduct.id) : [], [catalog?.colorVariants, selectedProduct]);
  const productSizeVariants = useMemo(() => selectedProduct ? (catalog?.sizeVariants ?? []).filter((variant) => variant.productId === selectedProduct.id) : [], [catalog?.sizeVariants, selectedProduct]);
  const productVariants = useMemo(() => selectedProduct ? (catalog?.variants ?? []).filter((variant) => variant.productId === selectedProduct.id && variant.status !== 'inactive') : [], [catalog?.variants, selectedProduct]);
  const productImages = useMemo(() => selectedProduct ? [selectedProduct.thumbnailImage, ...(catalog?.subImages ?? []).filter((image) => image.productId === selectedProduct.id).map((image) => image.imageName)].filter(Boolean) : [], [catalog?.subImages, selectedProduct]);
  const productOwnership = useMemo(() => selectedProduct ? (catalog?.ownership ?? []).find((ownership) => ownership.productId === selectedProduct.id) : undefined, [catalog?.ownership, selectedProduct]);
  const selectedVariant = useMemo(() => productVariants.find((variant) => {
    if (productColorVariants.length && variant.colorVariantId !== selectedColorVariantId) return false;
    if (productSizeVariants.length && variant.sizeVariantId !== selectedSizeVariantId) return false;
    return true;
  }) ?? productVariants[0], [productColorVariants.length, productSizeVariants.length, productVariants, selectedColorVariantId, selectedSizeVariantId]);
  const selectedPrice = selectedVariant ? `$${selectedVariant.price.toFixed(2)}` : selectedProduct ? getProductPrice(selectedProduct.id) : '';

  useEffect(() => {
    setSelectedImage(selectedProduct?.thumbnailImage ?? '');
    setSelectedColorVariantId(productColorVariants[0]?.id ?? '');
    setSelectedSizeVariantId(productSizeVariants[0]?.id ?? '');
  }, [productColorVariants, productSizeVariants, selectedProduct]);

  const handleContact = async (contact: ContactInfoItem) => {
    const prefix = contact.type === 'phone' ? 'tel:' : contact.type === 'email' ? 'mailto:' : '';
    const url = `${prefix}${contact.value}`;
    if (await Linking.canOpenURL(url)) await Linking.openURL(url);
  };

  const handleProductInquiry = async () => {
    if (!selectedProduct || !productOwnership?.userId) {
      Alert.alert('Seller unavailable', 'Use the product contact details to reach this seller.');
      return;
    }
    const currentUserId = auth.currentUser?.uid;
    if (!currentUserId) {
      Alert.alert('Sign in required', 'Sign in before messaging a seller.');
      return;
    }
    const selectedColor = productColorVariants.find((variant) => variant.id === selectedColorVariantId)?.colorVariantName;
    const selectedSize = productSizeVariants.find((variant) => variant.id === selectedSizeVariantId)?.sizeVariantName;
    const variantDescription = `${selectedColor ? ` in ${selectedColor}` : ''}${selectedSize ? `${selectedColor ? ',' : ''} size ${selectedSize}` : ''}`;
    setSendingInquiry(true);
    try {
      await messagingService.sendMessage(productOwnership.userId, `Hi, I'm interested in ${selectedProduct.title}${variantDescription}. Is this available?`, currentUserId);
      void interactionFeedbackService.play('success');
      setSelectedProduct(null);
      router.push({ pathname: '/chat/[id]', params: { id: productOwnership.userId } });
    } catch (inquiryError: unknown) {
      Alert.alert('Message not sent', inquiryError instanceof Error ? inquiryError.message : 'The seller could not be contacted.');
    } finally {
      setSendingInquiry(false);
    }
  };

  const renderProduct = ({ item }: { item: Product }) => (
    <TouchableOpacity
      onPress={() => setSelectedProduct(item)}
      activeOpacity={0.82}
      style={{
        flex: 1,
        margin: 6,
        overflow: 'hidden',
        borderRadius: 18,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
      }}
    >
      {item.thumbnailImage ? (
        <Image source={{ uri: item.thumbnailImage }} style={{ width: '100%', aspectRatio: 1 }} resizeMode="cover" />
      ) : (
        <View style={{ width: '100%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.control }}>
          <PackageSearch size={34} color={colors.mutedText} />
        </View>
      )}
      <View style={{ padding: 12 }}>
        <Text numberOfLines={1} style={{ color: colors.text, fontSize: 15, fontWeight: '900' }}>{item.title}</Text>
        <Text numberOfLines={1} style={{ marginTop: 3, color: colors.mutedText, fontSize: 12 }}>{item.category}</Text>
        <Text style={{ marginTop: 8, color: colors.accentText, fontWeight: '900' }}>{getProductPrice(item.id)}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.canvas }}>
      <View style={{ height: 56, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border, paddingHorizontal: 12, backgroundColor: colors.surface }}>
        <TouchableOpacity accessibilityLabel="Go back" onPress={() => router.back()} style={{ padding: 8 }}><ArrowLeft size={23} color={colors.icon} /></TouchableOpacity>
        <Text style={{ flex: 1, color: colors.text, fontSize: 20, fontWeight: '900' }}>Marketplace</Text>
        <SlidersHorizontal size={20} color={colors.icon} />
      </View>

      <View style={{ flexDirection: 'row', margin: 12, borderRadius: 15, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input }}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
          placeholder="Search live products"
          placeholderTextColor={colors.mutedText}
          style={{ flex: 1, paddingHorizontal: 14, paddingVertical: 12, color: colors.text }}
        />
        <TouchableOpacity accessibilityLabel="Search marketplace" onPress={handleSearch} style={{ padding: 12 }}><Search size={21} color={colors.accent} /></TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 8 }}>
        <TouchableOpacity onPress={() => setSelectedCategory(undefined)} style={{ marginRight: 8, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: !selectedCategory ? colors.accent : colors.control }}>
          <Text style={{ color: !selectedCategory ? colors.onAccent : colors.secondaryText, fontWeight: '800' }}>All</Text>
        </TouchableOpacity>
        {(catalog?.categories ?? []).map((category) => (
          <TouchableOpacity key={category} onPress={() => setSelectedCategory(category)} style={{ marginRight: 8, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: selectedCategory === category ? colors.accent : colors.control }}>
            <Text style={{ color: selectedCategory === category ? colors.onAccent : colors.secondaryText, fontWeight: '800' }}>{category}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator size="large" color={colors.accent} /><Text style={{ marginTop: 12, color: colors.secondaryText }}>Loading live marketplace…</Text></View>
      ) : error && products.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 }}><PackageSearch size={46} color={colors.mutedText} /><Text style={{ marginTop: 14, color: colors.text, fontSize: 18, fontWeight: '900' }}>Marketplace unavailable</Text><Text style={{ marginTop: 7, color: colors.secondaryText, textAlign: 'center' }}>{error}</Text><TouchableOpacity onPress={() => void loadCatalog()} style={{ marginTop: 16, borderRadius: 14, backgroundColor: colors.accent, paddingHorizontal: 20, paddingVertical: 12 }}><Text style={{ color: colors.onAccent, fontWeight: '900' }}>Try again</Text></TouchableOpacity></View>
      ) : (
        <FlatList
          key={columnCount}
          data={products}
          numColumns={columnCount}
          keyExtractor={(product) => product.id}
          renderItem={renderProduct}
          contentContainerStyle={{ padding: 6, paddingBottom: 36, flexGrow: products.length === 0 ? 1 : undefined }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadCatalog({ refresh: true })} tintColor={colors.accent} />}
          onEndReached={() => void handleLoadMore()}
          onEndReachedThreshold={0.35}
          ListEmptyComponent={<View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 }}><PackageSearch size={46} color={colors.mutedText} /><Text style={{ marginTop: 12, color: colors.text, fontSize: 18, fontWeight: '900' }}>No products found</Text><Text style={{ marginTop: 5, color: colors.secondaryText, textAlign: 'center' }}>Try another search or category. No sample products are substituted.</Text><TouchableOpacity onPress={handleClearFilters} style={{ marginTop: 14, padding: 12 }}><Text style={{ color: colors.accentText, fontWeight: '900' }}>Clear filters</Text></TouchableOpacity></View>}
          ListFooterComponent={loadingMore ? <ActivityIndicator style={{ padding: 18 }} color={colors.accent} /> : null}
        />
      )}

      <Modal visible={Boolean(selectedProduct)} transparent statusBarTranslucent navigationBarTranslucent animationType="none" presentationStyle="overFullScreen" onRequestClose={() => setSelectedProduct(null)}>
        <SwipeDismissSurface visible={Boolean(selectedProduct)} onDismiss={() => setSelectedProduct(null)} handleColor={colors.border} disabled={sendingInquiry} accessibilityLabel="Swipe down to close product details" style={{ flex: 1, backgroundColor: colors.canvas }}>
        <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.canvas }}>
          <View style={{ height: 56, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border, paddingHorizontal: 14, backgroundColor: colors.surface }}><Text style={{ flex: 1, color: colors.text, fontSize: 19, fontWeight: '900' }}>Product details</Text><TouchableOpacity onPress={() => setSelectedProduct(null)} style={{ padding: 8 }}><X size={23} color={colors.icon} /></TouchableOpacity></View>
          {selectedProduct ? (
            <ScrollView contentContainerStyle={{ paddingBottom: 42 }}>
              {selectedImage ? <Image source={{ uri: selectedImage }} style={{ width: '100%', aspectRatio: 1.25 }} resizeMode="cover" /> : null}
              {productImages.length > 1 ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 14, paddingTop: 12 }}>{productImages.map((imageUrl) => <TouchableOpacity key={imageUrl} onPress={() => setSelectedImage(imageUrl)} style={{ overflow: 'hidden', borderRadius: 10, borderWidth: 2, borderColor: selectedImage === imageUrl ? colors.accent : colors.border }}><Image source={{ uri: imageUrl }} style={{ width: 66, height: 66 }} resizeMode="cover" /></TouchableOpacity>)}</ScrollView> : null}
              <View style={{ padding: 18 }}>
                <Text style={{ color: colors.text, fontSize: 25, fontWeight: '900' }}>{selectedProduct.title}</Text>
                <Text style={{ marginTop: 5, color: colors.mutedText }}>{selectedProduct.category}</Text>
                <Text style={{ marginTop: 13, color: colors.accentText, fontSize: 20, fontWeight: '900' }}>{selectedPrice}</Text>
                {productColorVariants.length ? <View style={{ marginTop: 18 }}><Text style={{ color: colors.text, fontSize: 12, fontWeight: '900', marginBottom: 8 }}>COLOR</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{productColorVariants.filter((colorVariant) => productVariants.some((variant) => variant.colorVariantId === colorVariant.id && variant.quantity > 0)).map((colorVariant) => <TouchableOpacity key={colorVariant.id} onPress={() => setSelectedColorVariantId(colorVariant.id)} style={{ borderRadius: 999, borderWidth: 1, borderColor: selectedColorVariantId === colorVariant.id ? colors.accent : colors.border, backgroundColor: selectedColorVariantId === colorVariant.id ? colors.accent : colors.control, paddingHorizontal: 13, paddingVertical: 8 }}><Text style={{ color: selectedColorVariantId === colorVariant.id ? colors.onAccent : colors.secondaryText, fontWeight: '800' }}>{colorVariant.colorVariantName}</Text></TouchableOpacity>)}</ScrollView></View> : null}
                {productSizeVariants.length ? <View style={{ marginTop: 16 }}><Text style={{ color: colors.text, fontSize: 12, fontWeight: '900', marginBottom: 8 }}>SIZE</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{productSizeVariants.filter((sizeVariant) => productVariants.some((variant) => variant.sizeVariantId === sizeVariant.id && variant.quantity > 0)).map((sizeVariant) => <TouchableOpacity key={sizeVariant.id} onPress={() => setSelectedSizeVariantId(sizeVariant.id)} style={{ minWidth: 43, alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: selectedSizeVariantId === sizeVariant.id ? colors.accent : colors.border, backgroundColor: selectedSizeVariantId === sizeVariant.id ? colors.accent : colors.control, paddingHorizontal: 11, paddingVertical: 8 }}><Text style={{ color: selectedSizeVariantId === sizeVariant.id ? colors.onAccent : colors.secondaryText, fontWeight: '800' }}>{sizeVariant.sizeVariantName}</Text></TouchableOpacity>)}</ScrollView></View> : null}
                {selectedVariant ? <Text style={{ marginTop: 12, color: selectedVariant.quantity > 0 ? colors.accentText : '#c64d53', fontSize: 12, fontWeight: '800' }}>{selectedVariant.quantity > 0 ? `${selectedVariant.quantity} available` : 'Out of stock'}</Text> : null}
                <Text style={{ marginTop: 18, color: colors.secondaryText, fontSize: 15, lineHeight: 23 }}>{selectedProduct.longDescription || selectedProduct.shortDescription}</Text>
                {productOwnership ? <View style={{ marginTop: 18, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 14 }}><Text style={{ color: colors.text, fontSize: 15, fontWeight: '900' }}>{productOwnership.businessDetails?.name || productOwnership.businessOwner?.name || (productOwnership.sellerType === 'business' ? 'Business seller' : 'Ourlime seller')}</Text>{productOwnership.businessDetails?.location ? <Text style={{ marginTop: 4, color: colors.mutedText, fontSize: 12 }}>{productOwnership.businessDetails.location}</Text> : null}{typeof productOwnership.businessProfile?.rating?.overall === 'number' ? <Text style={{ marginTop: 4, color: colors.accentText, fontSize: 12, fontWeight: '800' }}>★ {productOwnership.businessProfile.rating.overall.toFixed(1)} · {productOwnership.businessProfile.reviews?.total ?? 0} reviews</Text> : null}</View> : null}
                {productOwnership?.userId ? <TouchableOpacity disabled={sendingInquiry || selectedVariant?.quantity === 0} onPress={() => void handleProductInquiry()} style={{ marginTop: 16, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.accent, opacity: sendingInquiry || selectedVariant?.quantity === 0 ? 0.5 : 1 }}>{sendingInquiry ? <ActivityIndicator color={colors.onAccent} /> : <Text style={{ color: colors.onAccent, fontWeight: '900' }}>Message Seller</Text>}</TouchableOpacity> : null}
                {(selectedProduct.contactInfo ?? []).map((contact) => <TouchableOpacity key={`${contact.type}-${contact.value}`} onPress={() => void handleContact(contact)} style={{ marginTop: 10, borderRadius: 14, backgroundColor: colors.control, padding: 13 }}><Text style={{ color: colors.accentText, fontWeight: '800', textTransform: 'capitalize' }}>{contact.type}: {contact.value}</Text></TouchableOpacity>)}
              </View>
            </ScrollView>
          ) : null}
        </SafeAreaView>
        </SwipeDismissSurface>
      </Modal>
    </SafeAreaView>
  );
}
