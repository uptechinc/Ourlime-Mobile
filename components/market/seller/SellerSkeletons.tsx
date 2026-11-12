import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SkeletonBox } from '@/components/ui/Skeleton';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { SkeletonIcon, SkeletonLine } from '../MarketSkeletons';

/** Text widths of the listing status filter chips: All, Published, Pending, Rejected, Unpublished, Draft. */
const LISTING_FILTER_TEXT_WIDTHS = [16, 58, 48, 52, 72, 30] as const;

/**
 * SellerListingsScreen body while listings load (rendered inside the real SellerScreenFrame header):
 * Add product / Orders buttons, four stat tiles, catalogue search, status filter chips, listing cards.
 */
export function SellerListingsSkeleton({ count = 3 }: { count?: number }): ReactNode {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return <ScrollView scrollEnabled={false} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
    <View style={styles.actionsRow}>
      <View style={styles.flex}><SkeletonBox height={46} borderRadius={13} /></View>
      <View style={[styles.secondaryButton, styles.flex]}><SkeletonIcon size={17} /><SkeletonLine fontSize={14} width={50} /></View>
    </View>
    <View style={styles.stats}>
      {[0, 1, 2, 3].map((statIndex) => <View key={statIndex} style={styles.stat}>
        <SkeletonLine fontSize={10} width="72%" />
        <SkeletonLine fontSize={24} width={34} style={{ marginTop: 4 }} />
      </View>)}
    </View>
    <View style={styles.searchBox}><SkeletonIcon size={19} /><SkeletonLine fontSize={15} width="58%" /></View>
    <View style={styles.filters}>
      {LISTING_FILTER_TEXT_WIDTHS.map((textWidth, chipIndex) => <View key={chipIndex} style={styles.filter}><SkeletonLine fontSize={12} width={textWidth} /></View>)}
    </View>
    {Array.from({ length: count }, (_, cardIndex) => <View key={cardIndex} style={styles.card}>
      <View style={styles.cardTop}>
        <SkeletonBox width={72} height={72} borderRadius={14} />
        <View style={styles.flex}>
          <SkeletonLine fontSize={15} width="78%" />
          <SkeletonLine fontSize={12} width="55%" style={{ marginTop: 3 }} />
          <View style={styles.metaRow}>
            <SkeletonLine fontSize={14} width={52} />
            <SkeletonLine fontSize={12} width={58} />
            <SkeletonBox width={74} height={21} borderRadius={999} style={{ marginTop: 4 }} />
          </View>
        </View>
      </View>
      <View style={styles.cardActions}>
        <View style={styles.iconButton}><SkeletonIcon size={17} /></View>
        <View style={styles.iconButton}><SkeletonIcon size={17} /></View>
        <View style={styles.iconButton}><SkeletonIcon size={17} /></View>
        <View style={styles.compactButton}><SkeletonIcon size={15} /><SkeletonLine fontSize={14} width={70} /></View>
        <View style={styles.iconButton}><SkeletonIcon size={17} /></View>
      </View>
    </View>)}
  </ScrollView>;
}

/**
 * SellerOrdersScreen body while orders load (inside the real SellerScreenFrame header):
 * order cards with number, buyer meta, status badge, item row, total and address strip, action buttons.
 */
export function SellerOrdersSkeleton({ count = 2 }: { count?: number }): ReactNode {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return <ScrollView scrollEnabled={false} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
    {Array.from({ length: count }, (_, orderIndex) => <View key={orderIndex} style={styles.card}>
      <View style={styles.orderHead}>
        <View style={styles.flex}>
          <SkeletonLine fontSize={15} width="42%" />
          <SkeletonLine fontSize={12} lineHeight={17} width="72%" style={{ marginTop: 2 }} />
        </View>
        <SkeletonBox width={88} height={23} borderRadius={999} />
      </View>
      <View style={styles.item}>
        <SkeletonBox width={46} height={46} borderRadius={11} />
        <View style={styles.flex}>
          <SkeletonLine fontSize={13} width="70%" />
          <SkeletonLine fontSize={12} lineHeight={17} width="45%" style={{ marginTop: 2 }} />
        </View>
        <SkeletonLine fontSize={13} width={54} />
      </View>
      <View style={styles.totalRow}>
        <SkeletonLine fontSize={12} lineHeight={17} width="55%" />
        <SkeletonLine fontSize={16} width={64} />
      </View>
      <View style={styles.address}>
        <SkeletonIcon size={14} />
        <View style={styles.flex}>
          <SkeletonLine fontSize={12} lineHeight={17} width="100%" />
          <SkeletonLine fontSize={12} lineHeight={17} width="60%" />
        </View>
      </View>
      <View style={styles.cardActions}>
        <View style={styles.compactButton}><SkeletonIcon size={15} /><SkeletonLine fontSize={14} width={104} /></View>
        <SkeletonBox width={128} height={40} borderRadius={11} />
      </View>
    </View>)}
  </ScrollView>;
}

/** Text widths of LISTING_STEPS labels (fontSize 12, weight 800): Basic info, Media, Pricing & details, Review. */
const LISTING_STEP_TEXT_WIDTHS = [58, 34, 94, 42] as const;
/** DEFAULT_LISTING_CATEGORIES chip labels (fontSize 12, weight 700), Electronics … Automotive. */
const LISTING_CATEGORY_TEXT_WIDTHS = [66, 44, 82, 108, 150, 86, 82, 66] as const;
/** LISTING_CONDITIONS chip labels: New, Like new, Good, Fair, Refurbished. */
const LISTING_CONDITION_TEXT_WIDTHS = [26, 52, 30, 24, 72] as const;

type SkeletonWidth = number | `${number}%`;

type EditorFieldSkeletonProps = {
  /** Width of the "Label *" text (fontSize 14). */
  labelWidth: number;
  /** Hint line widths under the label (fontSize 12, lineHeight 17). */
  hintWidths?: readonly SkeletonWidth[];
  children: ReactNode;
};

/** SellerField: bold label, optional hint lines, then the control, 7 apart. */
function EditorFieldSkeleton({ labelWidth, hintWidths = [], children }: EditorFieldSkeletonProps): ReactNode {
  return <View style={{ gap: 7 }}>
    <SkeletonLine fontSize={14} width={labelWidth} />
    {hintWidths.length ? <View>{hintWidths.map((hintWidth, hintIndex) => <SkeletonLine key={hintIndex} fontSize={12} lineHeight={17} width={hintWidth} />)}</View> : null}
    {children}
  </View>;
}

type EditorInputSkeletonProps = {
  labelWidth: number;
  hintWidths?: readonly SkeletonWidth[];
  /** Placeholder text width; omitted for inputs without a placeholder. */
  placeholderWidth?: SkeletonWidth;
  multiline?: boolean;
  /** Width of the "0/100" counter under the input. */
  counterWidth?: number;
};

/** ListingInput: 48 px (or 120 px multiline) input box with its placeholder and optional character counter. */
function EditorInputSkeleton({ labelWidth, hintWidths, placeholderWidth, multiline, counterWidth }: EditorInputSkeletonProps): ReactNode {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return <EditorFieldSkeleton labelWidth={labelWidth} hintWidths={hintWidths}>
    <View style={[styles.input, multiline ? styles.inputMultiline : null]}>
      {placeholderWidth !== undefined ? <SkeletonLine fontSize={15} lineHeight={20} width={placeholderWidth} /> : null}
    </View>
    {counterWidth ? <SkeletonLine fontSize={11} width={counterWidth} style={{ alignSelf: 'flex-end' }} /> : null}
  </EditorFieldSkeleton>;
}

/** OptionChips: wrapping 38 px chips. */
function EditorChipsSkeleton({ textWidths }: { textWidths: readonly number[] }): ReactNode {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return <View style={styles.optionChips}>
    {textWidths.map((textWidth, chipIndex) => <View key={chipIndex} style={styles.optionChip}><SkeletonLine fontSize={12} width={textWidth} /></View>)}
  </View>;
}

/** ListingSection header: 16 px title over its description, 3 apart. */
function EditorSectionHeadingSkeleton({ titleWidth, descriptionWidths }: { titleWidth: number; descriptionWidths: readonly SkeletonWidth[] }): ReactNode {
  return <View style={{ gap: 3 }}>
    <SkeletonLine fontSize={16} width={titleWidth} />
    <View>{descriptionWidths.map((descriptionWidth, lineIndex) => <SkeletonLine key={lineIndex} fontSize={12} lineHeight={17} width={descriptionWidth} />)}</View>
  </View>;
}

/**
 * SellerListingEditorScreen body while the seller check, listing and categories load (inside the real
 * SellerScreenFrame header): step header pills, the Basic info step's Product details and Contact
 * information sections at their real field sizes, then the Cancel / Continue footer.
 */
export function SellerListingEditorSkeleton(): ReactNode {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return <ScrollView scrollEnabled={false} showsVerticalScrollIndicator={false} contentContainerStyle={styles.editorContent}>
    <View style={styles.steps}>
      {LISTING_STEP_TEXT_WIDTHS.map((textWidth, stepIndex) => <View key={stepIndex} style={styles.step}>
        <View style={styles.stepNumber}><SkeletonLine fontSize={11} width={6} /></View>
        <SkeletonLine fontSize={12} width={textWidth} />
      </View>)}
    </View>
    <View style={{ gap: 16 }}>
      <View style={styles.section}>
        <EditorSectionHeadingSkeleton titleWidth={118} descriptionWidths={['100%', '22%']} />
        <EditorInputSkeleton labelWidth={100} placeholderWidth={160} counterWidth={32} />
        <EditorFieldSkeleton labelWidth={72}><EditorChipsSkeleton textWidths={LISTING_CATEGORY_TEXT_WIDTHS} /></EditorFieldSkeleton>
        <EditorFieldSkeleton labelWidth={78}><EditorChipsSkeleton textWidths={LISTING_CONDITION_TEXT_WIDTHS} /></EditorFieldSkeleton>
        <EditorInputSkeleton labelWidth={130} hintWidths={['76%']} placeholderWidth={210} counterWidth={32} />
        <EditorInputSkeleton labelWidth={150} hintWidths={['100%', '18%']} placeholderWidth="86%" multiline />
        <View style={styles.formRow}>
          <View style={styles.flex}><EditorInputSkeleton labelWidth={42} /></View>
          <View style={styles.flex}><EditorInputSkeleton labelWidth={30} /></View>
        </View>
        <EditorFieldSkeleton labelWidth={34}>
          <View style={styles.tagBox}>
            <View style={styles.tagInputRow}>
              <View style={styles.tagInput}><SkeletonLine fontSize={15} lineHeight={20} width={70} /></View>
              <View style={styles.tagAddButton}><SkeletonLine fontSize={13} width={26} /></View>
            </View>
          </View>
        </EditorFieldSkeleton>
      </View>
      <View style={styles.section}>
        <EditorSectionHeadingSkeleton titleWidth={150} descriptionWidths={['100%', '52%']} />
        <EditorInputSkeleton labelWidth={42} placeholderWidth={168} />
        <EditorInputSkeleton labelWidth={38} placeholderWidth={170} />
        <EditorInputSkeleton labelWidth={58} placeholderWidth={176} />
      </View>
    </View>
    <View style={styles.editorFooter}>
      <View style={[styles.secondaryButton, styles.flex]}><SkeletonLine fontSize={14} width={46} /></View>
      <View style={styles.flex}><SkeletonBox height={46} borderRadius={13} /></View>
    </View>
  </ScrollView>;
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  content: { padding: 14, paddingBottom: 40, gap: 14 },
  actionsRow: { flexDirection: 'row', gap: 10 },
  secondaryButton: { minHeight: 46, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 13, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  compactButton: { minHeight: 40, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 11, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: { width: '47%', flexGrow: 1, padding: 14, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  searchBox: { minHeight: 50, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  filters: { flexDirection: 'row', gap: 8, overflow: 'hidden' },
  filter: { minHeight: 40, paddingHorizontal: 15, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  card: { padding: 14, gap: 12, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  cardTop: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  metaRow: { marginTop: 6, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  cardActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 11, borderWidth: 1, borderColor: colors.border },
  orderHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border },
  address: { flexDirection: 'row', alignItems: 'flex-start', gap: 7, padding: 10, borderRadius: 12, backgroundColor: colors.control },
  // Listing editor: SellerListingEditorScreen, ListingFormParts and EHubSellerFormParts values.
  editorContent: { padding: 14, paddingBottom: 40, gap: 16 },
  steps: { flexDirection: 'row', gap: 8, paddingVertical: 2, overflow: 'hidden' },
  step: { minHeight: 44, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, backgroundColor: colors.control },
  stepNumber: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: colors.surface },
  section: { padding: 16, gap: 14, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  input: { minHeight: 48, paddingHorizontal: 14, paddingVertical: 11, justifyContent: 'center', borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input },
  inputMultiline: { minHeight: 120, justifyContent: 'flex-start' },
  optionChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionChip: { minHeight: 38, paddingHorizontal: 13, alignItems: 'center', justifyContent: 'center', borderRadius: 19, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  formRow: { flexDirection: 'row', gap: 10 },
  tagBox: { padding: 8, gap: 8, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input },
  tagInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tagInput: { flex: 1, minWidth: 0, minHeight: 42, paddingHorizontal: 8, justifyContent: 'center' },
  tagAddButton: { minHeight: 40, paddingHorizontal: 14, justifyContent: 'center', borderRadius: 10, backgroundColor: colors.control },
  editorFooter: { paddingTop: 14, flexDirection: 'row', gap: 10, borderTopWidth: 1, borderTopColor: colors.border },
});
