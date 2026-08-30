import { useEffect, useMemo, useState } from 'react';
import {
  Dimensions,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Icon from 'react-native-vector-icons/Feather';
import PageHeader from '@/components/ui/PageHeader';
import CustomModal from '@/components/ui/CustomModal';
import SwipeDismissHandle from '@/components/ui/SwipeDismissHandle';
import { useSwipeDismiss } from '@/lib/hooks/useSwipeDismiss';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { CATEGORIES, FREELANCERS, PRODUCTS, type Freelancer, type Product } from '@/lib/ehub/products';

type CartItem = {
  product: Product;
  quantity: number;
};

const HERO_DEALS = [
  { title: 'Flash Sale', subtitle: 'Up to 70% OFF on Top Electronics', emoji: '⚡', color: '#f59e0b' },
  { title: 'Free Shipping', subtitle: 'On all orders over $50 today!', emoji: '🚚', color: '#10b981' },
  { title: 'New Arrivals', subtitle: 'Fresh high-demand products added daily', emoji: '✨', color: '#8b5cf6' },
];

export default function EHubScreen() {
  const router = useRouter();
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [currentDealIndex, setCurrentDealIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<'products' | 'freelancers'>('products');
  const [cart, setCart] = useState<Record<string, CartItem>>({});
  const [cartOpen, setCartOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ title: string; message: string; type?: 'info' | 'success' | 'warning' | 'danger' } | null>(null);
  const [selectedFreelancer, setSelectedFreelancer] = useState<Freelancer | null>(null);
  const [hireModalOpen, setHireModalOpen] = useState(false);

  const cartSwipeDismiss = useSwipeDismiss({ visible: cartOpen, onDismiss: () => setCartOpen(false) });
  const hireSwipeDismiss = useSwipeDismiss({ visible: hireModalOpen, onDismiss: () => setHireModalOpen(false) });

  // Auto-rotate hero deals
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDealIndex((prev) => (prev + 1) % HERO_DEALS.length);
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return PRODUCTS.filter((product) => {
      const matchesSearch = !searchQuery || product.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'All' || product.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, selectedCategory]);

  const handleCategorySelect = (categoryName: string) => {
    if (categoryName === 'Freelancers') {
      setActiveTab('freelancers');
      setSelectedCategory('Freelancers');
    } else {
      setActiveTab('products');
      setSelectedCategory(categoryName);
    }
  };

  // Cart operations
  const handleAddToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev[product.id];
      const quantity = existing ? existing.quantity + 1 : 1;
      return {
        ...prev,
        [product.id]: { product, quantity },
      };
    });
    setFeedback({ title: 'Added to Cart', message: `${product.name} has been added to your cart.`, type: 'success' });
  };

  const handleUpdateQuantity = (productId: string, delta: number) => {
    setCart((prev) => {
      const existing = prev[productId];
      if (!existing) return prev;
      const nextQuantity = existing.quantity + delta;
      if (nextQuantity <= 0) {
        const next = { ...prev };
        delete next[productId];
        return next;
      }
      return {
        ...prev,
        [productId]: { ...existing, quantity: nextQuantity },
      };
    });
  };

  const totalCartCount = useMemo(() => {
    return Object.values(cart).reduce((sum, item) => sum + item.quantity, 0);
  }, [cart]);

  const totalCartPrice = useMemo(() => {
    return Object.values(cart).reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  }, [cart]);

  const handleCheckout = () => {
    setCartOpen(false);
    setCart({});
    setFeedback({
      title: 'Order Placed!',
      message: 'Thank you for your order! Your confirmation and tracking will be sent to your email.',
      type: 'success',
    });
  };

  const handleHireFreelancer = (freelancer: Freelancer) => {
    setSelectedFreelancer(freelancer);
    setHireModalOpen(true);
  };

  const handleConfirmHire = () => {
    setHireModalOpen(false);
    setFeedback({
      title: 'Proposal Submitted',
      message: `Your project proposal has been sent to ${selectedFreelancer?.name}. They will respond shortly.`,
      type: 'success',
    });
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <PageHeader
        title="E-Hub Market"
        onBackPress={() => router.back()}
        rightComponent={
          <TouchableOpacity onPress={() => setCartOpen(true)} style={styles.cartHeaderBtn}>
            <Icon name="shopping-bag" size={20} color={colors.text} />
            {totalCartCount > 0 ? (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{totalCartCount}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        }
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Animated Hero Deals Card */}
        <View style={[styles.heroCard, { backgroundColor: HERO_DEALS[currentDealIndex].color }]}>
          <View style={styles.heroRow}>
            <Text style={styles.heroEmoji}>{HERO_DEALS[currentDealIndex].emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroTitle}>{HERO_DEALS[currentDealIndex].title}</Text>
              <Text style={styles.heroSubtitle}>{HERO_DEALS[currentDealIndex].subtitle}</Text>
            </View>
          </View>
          <View style={styles.heroIndicators}>
            {HERO_DEALS.map((_, index) => (
              <View
                key={index}
                style={[styles.heroDot, index === currentDealIndex && styles.heroDotActive]}
              />
            ))}
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchBar}>
          <Icon name="search" size={17} color={colors.mutedText} style={{ marginRight: 8 }} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={activeTab === 'freelancers' ? 'Search freelancers by skill...' : 'Search products on E-Hub...'}
            placeholderTextColor={colors.mutedText}
            style={styles.searchInput}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Icon name="x" size={16} color={colors.mutedText} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Category Filter Pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryPills}>
          {CATEGORIES.map((cat) => {
            const isSelected = (cat.name === 'Freelancers' && activeTab === 'freelancers') || (activeTab === 'products' && selectedCategory === cat.name);
            return (
              <TouchableOpacity
                key={cat.name}
                onPress={() => handleCategorySelect(cat.name)}
                style={[styles.categoryPill, isSelected && styles.categoryPillActive]}
              >
                <Text style={[styles.categoryPillText, isSelected && styles.categoryPillTextActive]}>
                  {cat.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Content Tabs */}
        {activeTab === 'freelancers' ? (
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Top Freelancers ({FREELANCERS.length})</Text>
              <Text style={styles.sectionSubtitle}>Hire vetted professionals for your tasks</Text>
            </View>

            <View style={styles.freelancersList}>
              {FREELANCERS.map((freelancer) => (
                <View key={freelancer.id} style={styles.freelancerCard}>
                  <View style={styles.freelancerHeader}>
                    <Image source={{ uri: freelancer.image }} style={styles.freelancerAvatar} />
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Text style={styles.freelancerName}>{freelancer.name}</Text>
                        <Text style={styles.freelancerRate}>${freelancer.hourlyRate}/hr</Text>
                      </View>
                      <Text style={styles.freelancerRole}>{freelancer.title}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                        <Icon name="star" size={12} color="#f59e0b" />
                        <Text style={styles.ratingText}>{freelancer.rating} ({freelancer.reviews})</Text>
                        <Text style={styles.bulletText}>·</Text>
                        <Text style={styles.completedText}>{freelancer.completedJobs} completed</Text>
                      </View>
                    </View>
                  </View>

                  {/* Skills tags */}
                  <View style={styles.skillsRow}>
                    {freelancer.skills.map((skill) => (
                      <View key={skill} style={styles.skillBadge}>
                        <Text style={styles.skillBadgeText}>{skill}</Text>
                      </View>
                    ))}
                  </View>

                  <TouchableOpacity onPress={() => handleHireFreelancer(freelancer)} style={styles.hireButton}>
                    <Text style={styles.hireButtonText}>Hire {freelancer.name.split(' ')[0]}</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                {searchQuery ? `Results for "${searchQuery}"` : selectedCategory === 'All' ? 'Featured Products' : selectedCategory}
              </Text>
              <Text style={styles.sectionSubtitle}>{filteredProducts.length} items available</Text>
            </View>

            {filteredProducts.length === 0 ? (
              <View style={styles.noItemsCard}>
                <Icon name="search" size={38} color={colors.mutedText} />
                <Text style={styles.noItemsTitle}>No products found</Text>
                <Text style={styles.noItemsSubtitle}>Try searching for something else or clearing filters.</Text>
                <TouchableOpacity onPress={() => { setSearchQuery(''); setSelectedCategory('All'); }} style={styles.clearBtn}>
                  <Text style={styles.clearBtnText}>Reset Search</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.productGrid}>
                {filteredProducts.map((product) => {
                  const cartItem = cart[product.id];
                  return (
                    <View key={product.id} style={styles.productCard}>
                      <View style={styles.productImageContainer}>
                        <Image source={{ uri: product.image }} style={styles.productImage} resizeMode="cover" />
                        {product.discountPercentage ? (
                          <View style={styles.discountBadge}>
                            <Text style={styles.discountText}>-{product.discountPercentage}%</Text>
                          </View>
                        ) : null}
                      </View>

                      <View style={styles.productContent}>
                        <Text style={styles.productCategory}>{product.category}</Text>
                        <Text numberOfLines={2} style={styles.productTitle}>{product.name}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                          <Icon name="star" size={12} color="#f59e0b" />
                          <Text style={styles.ratingText}>{product.rating} ({product.reviews})</Text>
                        </View>

                        <View style={styles.productFooter}>
                          <Text style={styles.productPrice}>${product.price.toFixed(2)}</Text>
                          {cartItem ? (
                            <View style={styles.quantityRow}>
                              <TouchableOpacity onPress={() => handleUpdateQuantity(product.id, -1)} style={styles.qtyBtn}>
                                <Icon name="minus" size={12} color={colors.text} />
                              </TouchableOpacity>
                              <Text style={styles.qtyValue}>{cartItem.quantity}</Text>
                              <TouchableOpacity onPress={() => handleUpdateQuantity(product.id, 1)} style={styles.qtyBtn}>
                                <Icon name="plus" size={12} color={colors.text} />
                              </TouchableOpacity>
                            </View>
                          ) : (
                            <TouchableOpacity onPress={() => handleAddToCart(product)} style={styles.addCartBtn}>
                              <Icon name="plus" size={14} color="#ffffff" />
                              <Text style={styles.addCartBtnText}>Add</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Floating Cart Button */}
      {totalCartCount > 0 && !cartOpen ? (
        <TouchableOpacity onPress={() => setCartOpen(true)} style={styles.floatingCartBar}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={styles.floatingCartBadge}>
              <Text style={styles.floatingCartBadgeText}>{totalCartCount}</Text>
            </View>
            <Text style={styles.floatingCartText}>View Cart</Text>
          </View>
          <Text style={styles.floatingCartPrice}>${totalCartPrice.toFixed(2)}</Text>
        </TouchableOpacity>
      ) : null}

      {/* Cart Modal */}
      <Modal visible={cartOpen} transparent animationType="none" onRequestClose={cartSwipeDismiss.dismissWithAnimation}>
        <View style={styles.modalBackdrop}>
          <Animated.View style={[styles.modalSheet, cartSwipeDismiss.animatedStyle]}>
            <SwipeDismissHandle gesture={cartSwipeDismiss.gesture} color={colors.border} animatedStyle={cartSwipeDismiss.handleAnimatedStyle} accessibilityLabel="Swipe down to close cart" />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.modalHeading}>Your Shopping Cart ({totalCartCount})</Text>
              <TouchableOpacity onPress={() => setCartOpen(false)} style={{ padding: 4 }}>
                <Icon name="x" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>

            {Object.values(cart).length === 0 ? (
              <View style={styles.emptyCartCard}>
                <Icon name="shopping-bag" size={44} color={colors.mutedText} />
                <Text style={styles.emptyCartTitle}>Your cart is empty</Text>
                <Text style={styles.emptyCartSubtitle}>Explore our products and deals to start shopping.</Text>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
                {Object.values(cart).map(({ product, quantity }) => (
                  <View key={product.id} style={styles.cartItemRow}>
                    <Image source={{ uri: product.image }} style={styles.cartItemImage} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text numberOfLines={1} style={styles.cartItemName}>{product.name}</Text>
                      <Text style={styles.cartItemPrice}>${product.price.toFixed(2)} each</Text>
                    </View>
                    <View style={styles.quantityRow}>
                      <TouchableOpacity onPress={() => handleUpdateQuantity(product.id, -1)} style={styles.qtyBtn}>
                        <Icon name="minus" size={12} color={colors.text} />
                      </TouchableOpacity>
                      <Text style={styles.qtyValue}>{quantity}</Text>
                      <TouchableOpacity onPress={() => handleUpdateQuantity(product.id, 1)} style={styles.qtyBtn}>
                        <Icon name="plus" size={12} color={colors.text} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}

            {Object.values(cart).length > 0 ? (
              <View style={styles.cartSummary}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={styles.totalLabel}>Total (including tax):</Text>
                  <Text style={styles.totalValue}>${totalCartPrice.toFixed(2)}</Text>
                </View>
                <TouchableOpacity onPress={handleCheckout} style={styles.checkoutBtn}>
                  <Text style={styles.checkoutBtnText}>Checkout (${totalCartPrice.toFixed(2)})</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </Animated.View>
        </View>
      </Modal>

      {/* Hire Modal */}
      <Modal visible={hireModalOpen} transparent animationType="none" onRequestClose={hireSwipeDismiss.dismissWithAnimation}>
        <View style={styles.modalBackdrop}>
          <Animated.View style={[styles.modalSheet, hireSwipeDismiss.animatedStyle]}>
            <SwipeDismissHandle gesture={hireSwipeDismiss.gesture} color={colors.border} animatedStyle={hireSwipeDismiss.handleAnimatedStyle} accessibilityLabel="Swipe down to close hire modal" />
            <Text style={styles.modalHeading}>Hire {selectedFreelancer?.name}</Text>
            <Text style={styles.hireDesc}>Rate: ${selectedFreelancer?.hourlyRate}/hour · {selectedFreelancer?.title}</Text>
            <TextInput
              placeholder="Describe your project requirements, deliverables, and timeline..."
              placeholderTextColor={colors.mutedText}
              multiline
              style={[styles.modalInput, { minHeight: 90, textAlignVertical: 'top' }]}
            />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
              <TouchableOpacity onPress={() => setHireModalOpen(false)} style={styles.cancelBtn}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleConfirmHire} style={styles.confirmHireBtn}>
                <Text style={styles.confirmHireBtnText}>Send Proposal</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>

      <CustomModal
        visible={feedback !== null}
        type={feedback?.type ?? 'info'}
        title={feedback?.title ?? ''}
        message={feedback?.message ?? ''}
        onClose={() => setFeedback(null)}
      />
    </SafeAreaView>
  );
}

const screenWidth = Dimensions.get('window').width;

const createStyles = (colors: AppThemeColors, isDark: boolean) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.canvas },
    scrollContent: { padding: 16, paddingBottom: 60, gap: 16 },
    cartHeaderBtn: { padding: 6, position: 'relative' },
    cartBadge: {
      position: 'absolute',
      top: 0,
      right: 0,
      width: 17,
      height: 17,
      borderRadius: 9,
      backgroundColor: '#ef4444',
      alignItems: 'center',
      justifyContent: 'center',
    },
    cartBadgeText: { color: '#ffffff', fontSize: 10, fontWeight: '900' },
    heroCard: {
      borderRadius: 20,
      padding: 16,
      gap: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 10,
      elevation: 4,
    },
    heroRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    heroEmoji: { fontSize: 32 },
    heroTitle: { fontSize: 18, fontWeight: '900', color: '#ffffff' },
    heroSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.9)', marginTop: 2, fontWeight: '600' },
    heroIndicators: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
    heroDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.4)' },
    heroDotActive: { width: 18, backgroundColor: '#ffffff' },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      height: 44,
    },
    searchInput: { flex: 1, color: colors.text, fontSize: 14 },
    categoryPills: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
    categoryPill: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    categoryPillActive: { backgroundColor: '#10b981', borderColor: '#10b981' },
    categoryPillText: { fontSize: 12, fontWeight: '700', color: colors.mutedText },
    categoryPillTextActive: { color: '#ffffff', fontWeight: '800' },
    sectionContainer: { gap: 12 },
    sectionHeader: { gap: 2 },
    sectionTitle: { fontSize: 18, fontWeight: '900', color: colors.text },
    sectionSubtitle: { fontSize: 12, color: colors.mutedText },
    productGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      gap: 12,
    },
    productCard: {
      width: (screenWidth - 44) / 2,
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    productImageContainer: {
      width: '100%',
      height: 130,
      backgroundColor: isDark ? '#0f172a' : '#f1f5f9',
      position: 'relative',
    },
    productImage: { width: '100%', height: '100%' },
    discountBadge: {
      position: 'absolute',
      top: 8,
      left: 8,
      backgroundColor: '#ef4444',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
    },
    discountText: { color: '#ffffff', fontSize: 10, fontWeight: '900' },
    productContent: { padding: 10, gap: 4 },
    productCategory: { fontSize: 10, fontWeight: '700', color: '#10b981', textTransform: 'uppercase' },
    productTitle: { fontSize: 13, fontWeight: '700', color: colors.text, height: 34 },
    ratingText: { fontSize: 11, fontWeight: '600', color: colors.mutedText },
    bulletText: { fontSize: 11, color: colors.mutedText },
    completedText: { fontSize: 11, color: colors.mutedText },
    productFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 6,
      paddingTop: 6,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    productPrice: { fontSize: 14, fontWeight: '900', color: colors.text },
    addCartBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: '#10b981',
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 10,
    },
    addCartBtnText: { color: '#ffffff', fontSize: 11, fontWeight: '800' },
    quantityRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.control,
      borderRadius: 10,
      paddingHorizontal: 4,
      paddingVertical: 2,
    },
    qtyBtn: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
    qtyValue: { fontSize: 12, fontWeight: '800', color: colors.text },
    freelancersList: { gap: 12 },
    freelancerCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      gap: 10,
    },
    freelancerHeader: { flexDirection: 'row', gap: 12 },
    freelancerAvatar: { width: 52, height: 52, borderRadius: 26 },
    freelancerName: { fontSize: 15, fontWeight: '800', color: colors.text },
    freelancerRate: { fontSize: 14, fontWeight: '900', color: '#10b981' },
    freelancerRole: { fontSize: 12, color: colors.mutedText, marginTop: 1 },
    skillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    skillBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
      backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
    },
    skillBadgeText: { fontSize: 11, color: colors.text, fontWeight: '600' },
    hireButton: {
      backgroundColor: '#10b981',
      borderRadius: 12,
      paddingVertical: 9,
      alignItems: 'center',
    },
    hireButtonText: { color: '#ffffff', fontSize: 13, fontWeight: '800' },
    noItemsCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 32,
      alignItems: 'center',
      gap: 8,
    },
    noItemsTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
    noItemsSubtitle: { fontSize: 12, color: colors.mutedText, textAlign: 'center' },
    clearBtn: {
      marginTop: 8,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 12,
      backgroundColor: '#10b981',
    },
    clearBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 12 },
    floatingCartBar: {
      position: 'absolute',
      bottom: 24,
      left: 16,
      right: 16,
      backgroundColor: '#10b981',
      borderRadius: 16,
      paddingHorizontal: 18,
      paddingVertical: 14,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.25,
      shadowRadius: 12,
      elevation: 8,
    },
    floatingCartBadge: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: '#ffffff',
      alignItems: 'center',
      justifyContent: 'center',
    },
    floatingCartBadgeText: { color: '#10b981', fontSize: 12, fontWeight: '900' },
    floatingCartText: { color: '#ffffff', fontSize: 15, fontWeight: '800' },
    floatingCartPrice: { color: '#ffffff', fontSize: 15, fontWeight: '900' },
    modalBackdrop: { flex: 1, backgroundColor: colors.modalScrim, justifyContent: 'flex-end' },
    modalSheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 20,
      paddingBottom: 40,
      gap: 14,
    },
    modalHeading: { fontSize: 18, fontWeight: '900', color: colors.text },
    emptyCartCard: { alignItems: 'center', paddingVertical: 28, gap: 6 },
    emptyCartTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
    emptyCartSubtitle: { fontSize: 12, color: colors.mutedText },
    cartItemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    cartItemImage: { width: 44, height: 44, borderRadius: 8 },
    cartItemName: { fontSize: 13, fontWeight: '700', color: colors.text },
    cartItemPrice: { fontSize: 12, color: colors.mutedText },
    cartSummary: { gap: 10, paddingTop: 10 },
    totalLabel: { fontSize: 14, fontWeight: '700', color: colors.mutedText },
    totalValue: { fontSize: 18, fontWeight: '900', color: colors.text },
    checkoutBtn: {
      backgroundColor: '#10b981',
      borderRadius: 14,
      paddingVertical: 12,
      alignItems: 'center',
    },
    checkoutBtnText: { color: '#ffffff', fontSize: 15, fontWeight: '800' },
    hireDesc: { fontSize: 13, color: colors.mutedText },
    modalInput: {
      backgroundColor: colors.control,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontSize: 14,
      color: colors.text,
    },
    cancelBtn: {
      flex: 1,
      height: 44,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelBtnText: { color: colors.text, fontWeight: '700' },
    confirmHireBtn: {
      flex: 1,
      height: 44,
      borderRadius: 12,
      backgroundColor: '#10b981',
      alignItems: 'center',
      justifyContent: 'center',
    },
    confirmHireBtnText: { color: '#ffffff', fontWeight: '800' },
  });
