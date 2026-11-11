import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Eye, FilePenLine, ImagePlus, Package, PackagePlus, Save, Trash2, Upload } from 'lucide-react-native';
import CachedImage from '@/components/ui/CachedImage';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import type { EHubSellerCenter } from '@/lib/hooks/useEHubSellerCenter';
import type { EHubPublicationState, EHubSellerProduct } from '@/lib/types/ehubSeller';
import { EHubChip, formatEHubPrice } from '@/components/ehub/EHubParts';
import {
  SellerButton, SellerChipField, SellerImageField, SellerNumberField, SellerSaveIndicator, SellerStepHeader, SellerTextField, SellerToggleRow, formatSavedTime,
} from '@/components/ehub/EHubSellerFormParts';

const PRODUCT_STEPS = ['Basic information', 'Images & media', 'Pricing & stock', 'Variants & options', 'Delivery & pickup', 'Review & publish'];
type ProductFilter = 'all' | EHubPublicationState;

type ProductsProps = {
  center: EHubSellerCenter;
  isTablet: boolean;
  /** Opens straight into the editor (a resumed draft may have no title yet). */
  startEditing?: boolean;
  onPreview: (productId: string) => void;
  onRequestStateChange: (product: EHubSellerProduct, state: EHubPublicationState) => void;
  onRequestDelete: (product: EHubSellerProduct) => void;
};

/** The website's Products section: the owner's catalog, and a six-step editor for new and existing products. */
export default function EHubSellerProducts({ center, isTablet, startEditing, onPreview, onRequestStateChange, onRequestDelete }: ProductsProps) {
  const { productForm: form } = center;
  const [isEditing, setIsEditing] = useState(Boolean(startEditing || form.productId || form.title));
  useEffect(() => { if (form.productId || form.title) setIsEditing(true); }, [form.productId, form.title]);

  if (!isEditing) {
    return <ProductList products={center.workspace?.products ?? []} isWorking={center.isWorking} isTablet={isTablet}
      onNew={() => { center.startNewProduct(); setIsEditing(true); }}
      onEdit={(product) => { center.editProduct(product); setIsEditing(true); }}
      onPreview={onPreview} onRequestStateChange={onRequestStateChange} onRequestDelete={onRequestDelete} />;
  }
  return <ProductEditor center={center} isTablet={isTablet} onClose={() => setIsEditing(false)} />;
}

type ProductListProps = Omit<ProductsProps, 'center' | 'startEditing'> & { products: EHubSellerProduct[]; isWorking: boolean; onNew: () => void; onEdit: (product: EHubSellerProduct) => void };

function ProductList({ products, isWorking, isTablet, onNew, onEdit, onPreview, onRequestStateChange, onRequestDelete }: ProductListProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [filter, setFilter] = useState<ProductFilter>('all');
  const publishedCount = products.filter((product) => product.publicationState === 'published').length;
  const filters: { id: ProductFilter; label: string }[] = [
    { id: 'all', label: `All (${products.length})` },
    { id: 'published', label: `Published (${publishedCount})` },
    { id: 'hidden', label: `Unpublished (${products.length - publishedCount})` },
  ];
  const visibleProducts = products.filter((product) => filter === 'all' || product.publicationState === filter);

  return <View style={styles.section}>
    <View style={styles.top}>
      <View style={styles.flex}><Text style={styles.eyebrow}>Catalog</Text><Text style={styles.pageTitle}>Products</Text></View>
      <SellerButton label="Create product" icon={<PackagePlus size={17} color="#ffffff" />} onPress={onNew} />
    </View>
    <View style={styles.filters}>{filters.map((option) => <EHubChip key={option.id} label={option.label} selected={filter === option.id} onPress={() => setFilter(option.id)} />)}</View>
    {visibleProducts.length === 0 ? <View style={styles.empty}>
      <Package size={38} color={colors.mutedText} />
      <Text style={styles.emptyTitle}>No {filter === 'all' ? '' : filter === 'hidden' ? 'unpublished ' : 'published '}products yet</Text>
      <Text style={styles.muted}>Create a draft and publish when every required detail is ready.</Text>
    </View> : <View style={styles.list}>{visibleProducts.map((product) => {
      const isPublished = product.publicationState === 'published';
      return <View key={product.id} style={[styles.row, isTablet ? styles.rowTablet : null]}>
        <View style={[styles.rowMain, isTablet ? styles.flex : null]}>
          <View style={styles.thumb}>{product.imageUrl ? <CachedImage uri={product.imageUrl} style={styles.fill} accessibilityLabel={product.title} /> : <ImagePlus size={20} color={colors.mutedText} />}</View>
          <View style={styles.flex}>
            <Text numberOfLines={2} style={styles.productTitle}>{product.title}</Text>
            <Text style={styles.small}>Updated {formatSavedTime(product.updatedAt)}</Text>
            <View style={styles.meta}>
              <Text style={styles.price}>{formatEHubPrice(product.salePrice ?? product.price)}</Text>
              <Text style={styles.small}>{product.inventory} in stock</Text>
              <Text style={[styles.status, isPublished ? styles.statusPublished : null]}>{isPublished ? 'Published' : 'Unpublished'}</Text>
            </View>
          </View>
        </View>
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${product.title}`} onPress={() => onEdit(product)} style={styles.iconButton}><FilePenLine size={17} color={colors.text} /></Pressable>
          {isPublished ? <Pressable accessibilityRole="link" accessibilityLabel={`Preview ${product.title}`} onPress={() => onPreview(product.id)} style={styles.iconButton}><Eye size={17} color={colors.text} /></Pressable> : null}
          <SellerButton compact variant="secondary" label={isPublished ? 'Unpublish' : 'Publish'} disabled={isWorking} onPress={() => onRequestStateChange(product, isPublished ? 'hidden' : 'published')} />
          <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${product.title}`} onPress={() => onRequestDelete(product)} style={[styles.iconButton, styles.iconDanger]}><Trash2 size={17} color={colors.destructiveText} /></Pressable>
        </View>
      </View>;
    })}</View>}
  </View>;
}

type ProductEditorProps = { center: EHubSellerCenter; isTablet: boolean; onClose: () => void };

function ProductEditor({ center, isTablet, onClose }: ProductEditorProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [step, setStep] = useState(0);
  const { productForm: form, updateProductForm: onChange } = center;
  const canPublish = Boolean(center.workspace?.store) && !center.workspace?.eligibility.reason;
  const isComplete = form.title.trim().length >= 2 && form.description.trim().length >= 20 && Boolean(form.category.trim());
  const completedSteps = [
    isComplete,
    Boolean(form.imageUrl),
    Number.isFinite(form.price) && form.price >= 0 && Number.isSafeInteger(form.inventory) && form.inventory >= 0,
    form.variants.length > 0 || form.sizes.length > 0 || form.colours.length > 0,
    form.deliveryAvailable || form.pickupAvailable || Boolean(form.warrantyInformation.trim()),
    canPublish,
  ];

  const handleSave = async (state: EHubPublicationState) => {
    if (await center.saveProduct(state)) { setStep(0); onClose(); }
  };

  return <View style={styles.card}>
    <View style={styles.top}>
      <View style={styles.flex}><Text style={styles.eyebrow}>Products</Text><Text style={styles.title}>{form.productId ? 'Edit product' : 'Create product'}</Text></View>
      <SellerSaveIndicator status={center.saveStatus} savedAt={center.lastSavedAt} />
    </View>
    <SellerStepHeader steps={PRODUCT_STEPS} currentStep={step} completedSteps={completedSteps} onStepChange={setStep} />
    <View style={styles.body}>
      {step === 0 ? <>
        <SellerTextField label="Product name" required maxLength={160} value={form.title} onChangeText={(title) => onChange({ title })} />
        <SellerTextField label="Description" required hint="At least 20 characters." multiline maxLength={5000} value={form.description} onChangeText={(description) => onChange({ description })} />
        <View style={[styles.grid, isTablet ? styles.gridRow : null]}>
          <View style={styles.flex}><SellerTextField label="Category" required maxLength={100} value={form.category} onChangeText={(category) => onChange({ category })} /></View>
          <View style={styles.flex}><SellerTextField label="Brand" maxLength={120} value={form.brand} onChangeText={(brand) => onChange({ brand })} /></View>
        </View>
      </> : null}
      {step === 1 ? <SellerImageField label="Primary product image" imageUrl={form.imageUrl} aspect={[1, 1]} isUploading={center.isUploading} onPick={(uri) => void center.uploadImage(uri, 'product')} /> : null}
      {step === 2 ? <View style={[styles.grid, isTablet ? styles.gridWrap : null]}>
        <View style={isTablet ? styles.half : null}><SellerNumberField label="Price (TTD)" required value={form.price} onChangeValue={(price) => onChange({ price: price ?? 0 })} /></View>
        <View style={isTablet ? styles.half : null}><SellerNumberField label="Sale price (TTD)" allowEmpty value={form.salePrice} onChangeValue={(salePrice) => onChange({ salePrice })} /></View>
        <View style={isTablet ? styles.half : null}><SellerNumberField label="Stock" required isInteger value={form.inventory} onChangeValue={(inventory) => onChange({ inventory: inventory ?? 0 })} /></View>
        <View style={isTablet ? styles.half : null}><SellerTextField label="SKU" maxLength={120} value={form.sku} onChangeText={(sku) => onChange({ sku })} /></View>
      </View> : null}
      {step === 3 ? <>
        <SellerChipField label="Variants" values={form.variants} onChange={(variants) => onChange({ variants })} placeholder="Add variant" />
        <SellerChipField label="Sizes" values={form.sizes} onChange={(sizes) => onChange({ sizes })} placeholder="Add size" />
        <SellerChipField label="Colours" values={form.colours} onChange={(colours) => onChange({ colours })} placeholder="Add colour" />
      </> : null}
      {step === 4 ? <>
        <SellerToggleRow label="Delivery available" description="The seller can arrange delivery directly with the buyer." value={form.deliveryAvailable} onChange={(deliveryAvailable) => onChange({ deliveryAvailable })} />
        <SellerToggleRow label="Pickup available" description="The buyer can arrange pickup directly with the seller." value={form.pickupAvailable} onChange={(pickupAvailable) => onChange({ pickupAvailable })} />
        <SellerTextField label="Warranty information" multiline maxLength={1000} value={form.warrantyInformation} onChangeText={(warrantyInformation) => onChange({ warrantyInformation })} />
      </> : null}
      {step === 5 ? <>
        <View style={styles.preview}>
          <View style={styles.previewImage}>{form.imageUrl ? <CachedImage uri={form.imageUrl} style={styles.fill} accessibilityLabel="Product preview" /> : <Package size={36} color={colors.mutedText} />}</View>
          <View style={styles.previewBody}>
            <Text style={styles.eyebrow}>{form.category || 'Category'}</Text>
            <Text style={styles.productTitle}>{form.title || 'Product title'}</Text>
            <Text style={styles.previewPrice}>{formatEHubPrice(form.salePrice ?? form.price)}</Text>
            <Text style={styles.small}>{form.inventory} available</Text>
          </View>
        </View>
        {!canPublish ? <Text style={styles.warning}>Publish your storefront (and meet the seller eligibility checks) before publishing products. You can still save this product unpublished.</Text> : null}
        <View style={[styles.grid, isTablet ? styles.gridRow : null]}>
          <View style={isTablet ? styles.flex : null}><SellerButton label="Save unpublished" variant="secondary" icon={<Save size={17} color={colors.text} />} disabled={center.isWorking || center.isUploading} onPress={() => void handleSave('hidden')} /></View>
          <View style={isTablet ? styles.flex : null}><SellerButton label="Publish product" icon={<Upload size={17} color="#ffffff" />} isLoading={center.isWorking} disabled={!canPublish || !isComplete || center.isUploading} onPress={() => void handleSave('published')} /></View>
        </View>
      </> : null}
    </View>
    <View style={styles.footer}>
      <SellerButton label={step === 0 ? 'Back to products' : 'Previous'} variant="secondary" onPress={() => { if (step === 0) onClose(); else setStep(step - 1); }} />
      {step < PRODUCT_STEPS.length - 1 ? <SellerButton label="Continue" onPress={() => setStep(step + 1)} /> : null}
    </View>
  </View>;
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  fill: { width: '100%', height: '100%' },
  section: { gap: 16 },
  card: { padding: 18, gap: 18, borderRadius: 24, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  top: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  eyebrow: { color: colors.accentText, fontSize: 11, fontWeight: '900', letterSpacing: 1.4, textTransform: 'uppercase' },
  pageTitle: { marginTop: 3, color: colors.text, fontSize: 27, fontWeight: '900' },
  title: { marginTop: 3, color: colors.text, fontSize: 22, fontWeight: '900' },
  muted: { color: colors.mutedText, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  small: { color: colors.mutedText, fontSize: 12 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  empty: { paddingVertical: 44, paddingHorizontal: 20, alignItems: 'center', gap: 8, borderRadius: 22, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, backgroundColor: colors.surface },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: '900' },
  list: { overflow: 'hidden', borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  row: { padding: 14, gap: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowTablet: { flexDirection: 'row', alignItems: 'center' },
  rowMain: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumb: { width: 60, height: 60, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.control },
  productTitle: { color: colors.text, fontSize: 15, fontWeight: '900' },
  meta: { marginTop: 5, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  price: { color: colors.text, fontSize: 14, fontWeight: '900' },
  status: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, overflow: 'hidden', backgroundColor: colors.control, color: colors.secondaryText, fontSize: 11, fontWeight: '800' },
  statusPublished: { backgroundColor: colors.successSurface, color: colors.successText },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 11, borderWidth: 1, borderColor: colors.border },
  iconDanger: { borderColor: colors.destructive, backgroundColor: colors.destructiveSurface },
  body: { minHeight: 260, gap: 18 },
  grid: { gap: 14 },
  gridRow: { flexDirection: 'row' },
  gridWrap: { flexDirection: 'row', flexWrap: 'wrap' },
  half: { width: '48%', flexGrow: 1 },
  preview: { width: '100%', maxWidth: 360, alignSelf: 'center', overflow: 'hidden', borderRadius: 18, borderWidth: 1, borderColor: colors.border },
  previewImage: { aspectRatio: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.control },
  previewBody: { padding: 14, gap: 4 },
  previewPrice: { marginTop: 4, color: colors.text, fontSize: 18, fontWeight: '900' },
  warning: { padding: 14, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.warningSurface, color: colors.warningText, fontSize: 13, lineHeight: 19 },
  footer: { paddingTop: 16, flexDirection: 'row', justifyContent: 'space-between', gap: 10, borderTopWidth: 1, borderTopColor: colors.border },
});
