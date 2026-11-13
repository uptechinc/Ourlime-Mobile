import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SkeletonBox, SkeletonCircle, SkeletonText } from '@/components/ui/Skeleton';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { useEHubLayout } from '@/components/ehub/EHubParts';

/**
 * Loading placeholders for every E-Hub screen. Each one mirrors the real screen's StyleSheet (sizes, radii, paddings,
 * gaps, grid columns and surfaces) so the page keeps its shape while data loads. Text becomes bars sized from the
 * real font size and line height; line counts are estimated from the real copy length and the available width.
 */

type SkeletonWidth = number | `${number}%`;
type TextWeight = 'regular' | 'bold';
type EHubLayout = ReturnType<typeof useEHubLayout>;

/** Bars on the dark hero, "How EHub works" and footer surfaces. */
const ON_DARK = 'rgba(255,255,255,0.22)';
const DARK_SURFACE = '#020617';
const BRAND_GREEN = '#059669';

/** Default React Native line height for a font size (no explicit lineHeight in the style). */
function defaultLineHeight(fontSize: number): number {
  return Math.round(fontSize * 1.33);
}

function barHeightFor(fontSize: number): number {
  return Math.max(6, Math.round(fontSize * 0.75));
}

/** Same breakpoints as useEHubLayout's product and provider grids. */
function productColumnsFor(width: number): number {
  return width >= 1024 ? 4 : width >= 640 ? 3 : 2;
}

function providerColumnsFor(width: number): number {
  return width >= 1024 ? 3 : width >= 600 ? 2 : 1;
}

type LineProps = { fontSize: number; lineHeight?: number; width: SkeletonWidth; tint?: string; style?: StyleProp<ViewStyle> };

/** One line of text: a row as tall as the real line with a bar as tall as the glyphs. */
function Line({ fontSize, lineHeight, width, tint, style }: LineProps) {
  const barHeight = barHeightFor(fontSize);
  return <View style={[{ height: lineHeight ?? defaultLineHeight(fontSize), justifyContent: 'center' }, style]}>
    <SkeletonText width={width} height={barHeight} borderRadius={barHeight / 2} style={tint ? { backgroundColor: tint } : undefined} />
  </View>;
}

type TextBlockProps = {
  /** Length of the real copy, used to estimate how many lines it wraps to. */
  chars: number;
  fontSize: number;
  lineHeight?: number;
  /** Width the text wraps in. */
  width: number;
  weight?: TextWeight;
  maxLines?: number;
  minLines?: number;
  tint?: string;
  align?: 'left' | 'center';
  style?: StyleProp<ViewStyle>;
};

/** A paragraph: as many lines as the copy wraps to at this width, the last one shorter. */
function TextBlock({ chars, fontSize, lineHeight, width, weight = 'regular', maxLines, minLines = 1, tint, align = 'left', style }: TextBlockProps) {
  const usableWidth = Math.max(24, width);
  const textWidth = chars * fontSize * (weight === 'bold' ? 0.6 : 0.5);
  const lineCount = Math.min(maxLines ?? 99, Math.max(minLines, Math.ceil(textWidth / usableWidth)));
  const fullWidth = Math.round(usableWidth * 0.95);
  const lastWidth = lineCount === 1
    ? Math.round(Math.min(textWidth, fullWidth))
    : Math.round(Math.min(fullWidth, Math.max(usableWidth * 0.35, textWidth - usableWidth * (lineCount - 1))));
  return <View style={[align === 'center' ? { alignItems: 'center' } : null, style]}>
    {Array.from({ length: lineCount }, (_, lineIndex) => <Line key={lineIndex} fontSize={fontSize} lineHeight={lineHeight} tint={tint}
      width={lineIndex === lineCount - 1 ? lastWidth : fullWidth} />)}
  </View>;
}

/** A pressable icon slot (e.g. a 40×40 header button) holding an icon-sized placeholder. */
function IconSlot({ box, size, tint }: { box: number; size: number; tint?: string }) {
  return <View style={{ width: box, height: box, alignItems: 'center', justifyContent: 'center' }}>
    <IconBox size={size} tint={tint} />
  </View>;
}

function IconBox({ size, tint, style }: { size: number; tint?: string; style?: StyleProp<ViewStyle> }) {
  return <SkeletonBox width={size} height={size} borderRadius={Math.round(size / 4)} style={[tint ? { backgroundColor: tint } : null, style]} />;
}

function useSkeletonStyles() {
  const { colors } = useAppTheme();
  const layout = useEHubLayout();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return { colors, layout, styles };
}

/* ------------------------------------------------------------------ Shared E-Hub pieces (EHubParts.tsx) */

type SectionHeadingSkeletonProps = { width: number; titleChars: number; descriptionChars?: number; actionWidth?: number };

/** EHubSectionHeading: eyebrow, 22/27 title, 13/19 description and an optional EHubLinkButton on the right. */
export function EHubSectionHeadingSkeleton({ width, titleChars, descriptionChars, actionWidth }: SectionHeadingSkeletonProps) {
  const { styles } = useSkeletonStyles();
  const textWidth = actionWidth ? width - actionWidth - 12 : width;
  return <View style={styles.heading}>
    <View style={styles.flex}>
      <Line fontSize={11} lineHeight={15} width={96} />
      <TextBlock chars={titleChars} fontSize={22} lineHeight={27} weight="bold" width={textWidth} style={styles.marginTop4} />
      {descriptionChars ? <TextBlock chars={descriptionChars} fontSize={13} lineHeight={19} width={textWidth} style={styles.marginTop4} /> : null}
    </View>
    {actionWidth ? <View style={styles.linkButton}><Line fontSize={13} width={actionWidth - 19} /><IconBox size={15} /></View> : null}
  </View>;
}

type ProductCardSkeletonProps = { width: number; isCompact?: boolean; withCompare?: boolean };

/** EHubProductCard: square image with stock badge and heart, store, two-line title, price, cart and compare buttons. */
export function EHubProductCardSkeleton({ width, isCompact = false, withCompare = true }: ProductCardSkeletonProps) {
  const { styles } = useSkeletonStyles();
  const bodyWidth = width - 22;
  return <View style={[styles.productCard, { width }]}>
    <View>
      <SkeletonBox width="100%" height={width} borderRadius={0} />
      <View style={styles.stockBadge}><Line fontSize={10} lineHeight={13} width={58} tint={ON_DARK} /></View>
    </View>
    <View style={styles.productBody}>
      <Line fontSize={10} lineHeight={14} width={Math.round(bodyWidth * 0.55)} />
      <View style={styles.productTitle}>
        <Line fontSize={13} lineHeight={18} width={Math.round(bodyWidth * 0.95)} />
        <Line fontSize={13} lineHeight={18} width={Math.round(bodyWidth * 0.6)} />
      </View>
      <Line fontSize={16} width={Math.min(96, Math.round(bodyWidth * 0.6))} style={styles.marginTop3} />
    </View>
    {isCompact ? null : <>
      <View style={styles.heartButton}><IconBox size={17} /></View>
      <View style={styles.productActions}>
        <SkeletonBox height={42} borderRadius={12} style={styles.flex} />
        {withCompare ? <View style={styles.compareButton}><IconBox size={16} /></View> : null}
      </View>
    </>}
  </View>;
}

type ProductGridSkeletonProps = { count?: number; width?: number; isCompact?: boolean; withCompare?: boolean };

/** A product grid with the screen's own column count (two rows unless count is given). */
export function EHubProductGridSkeleton({ count, width, isCompact, withCompare }: ProductGridSkeletonProps) {
  const { layout, styles } = useSkeletonStyles();
  const cardCount = count ?? productColumnsFor(layout.width) * 2;
  return <View style={[styles.grid, { gap: layout.gap }]}>
    {Array.from({ length: cardCount }, (_, cardIndex) => <EHubProductCardSkeleton key={cardIndex} width={width ?? layout.productWidth} isCompact={isCompact} withCompare={withCompare} />)}
  </View>;
}

type ProviderCardSkeletonProps = { width: number };

/** EHubProviderCard: 128 cover with kind badge, overlapping 64 logo, name, place, two-line description, tags, action pill. */
export function EHubProviderCardSkeleton({ width }: ProviderCardSkeletonProps) {
  const { styles } = useSkeletonStyles();
  const textWidth = width - 36;
  return <View style={[styles.providerCard, { width }]}>
    <View style={styles.providerCover}>
      <SkeletonBox width="100%" height={128} borderRadius={0} />
      <View style={styles.kindBadge}><Line fontSize={10} lineHeight={13} width={66} tint={ON_DARK} /></View>
    </View>
    <View style={styles.providerBody}>
      <View style={styles.providerLogo}><SkeletonBox width="100%" height="100%" borderRadius={13} /></View>
      <Line fontSize={16} lineHeight={20} width={Math.round(textWidth * 0.62)} />
      <View style={styles.placeRow}><IconBox size={13} style={styles.marginTop2} /><Line fontSize={12} lineHeight={18} width={Math.round(textWidth * 0.4)} /></View>
      <View style={styles.providerDescription}>
        <Line fontSize={12} lineHeight={18} width={Math.round(textWidth * 0.95)} />
        <Line fontSize={12} lineHeight={18} width={Math.round(textWidth * 0.7)} />
      </View>
      <View style={styles.tags}>
        <SkeletonBox width={74} height={21} borderRadius={999} />
        <SkeletonBox width={58} height={21} borderRadius={999} />
      </View>
      <View style={styles.providerAction}><Line fontSize={14} width={92} /><IconBox size={15} /></View>
    </View>
  </View>;
}

type ProviderGridSkeletonProps = { count?: number; width?: number };

/** A provider grid with the screen's own column count (one row unless count is given). */
export function EHubProviderGridSkeleton({ count, width }: ProviderGridSkeletonProps) {
  const { layout, styles } = useSkeletonStyles();
  const cardCount = count ?? providerColumnsFor(layout.width);
  return <View style={[styles.grid, { gap: layout.gap }]}>
    {Array.from({ length: cardCount }, (_, cardIndex) => <EHubProviderCardSkeleton key={cardIndex} width={width ?? layout.providerWidth} />)}
  </View>;
}

/** EHubChip: 40 tall, radius 13, 15 horizontal padding around 13/800 text. */
function ChipSkeleton({ textWidth }: { textWidth: number }) {
  return <SkeletonBox width={textWidth + 30} height={40} borderRadius={13} />;
}

/* ------------------------------------------------------------------ E-Hub home (EHubScreen.tsx) */

const HOME_NAV_TEXT_WIDTHS = [34, 29, 60, 36];
const HOME_SORT_CHIP_TEXT_WIDTHS = [88, 116, 118, 38];
const HOME_PATH_DESCRIPTION_CHARS = [59, 63, 59, 96, 59];
const HOME_FAQ_QUESTION_CHARS = [31, 28, 23];
const HOME_FOOTER_LINK_WIDTHS = [[60, 74, 84], [108, 64, 82], [80, 70, 88]];

/** The E-Hub home header: back, "E-Hub" brand, saved/cart/enquiries buttons, then Shop/Hire/Discover/Grow. */
function EHubHomeHeaderSkeleton() {
  const { styles } = useSkeletonStyles();
  return <SafeAreaView edges={['top', 'left', 'right']} style={styles.homeHeader}>
    <View style={styles.homeHeaderRow}>
      <IconSlot box={40} size={24} />
      <View style={styles.flex}><Line fontSize={21} lineHeight={28} width={58} /></View>
      <View style={styles.row}>
        <View style={[styles.row, styles.gap2]}><IconSlot box={40} size={21} /><IconSlot box={40} size={21} /></View>
        <IconSlot box={40} size={21} />
      </View>
    </View>
    <View style={styles.homeNav}>
      {HOME_NAV_TEXT_WIDTHS.map((textWidth) => <View key={textWidth} style={styles.homeNavItem}><Line fontSize={14} width={textWidth} /></View>)}
    </View>
  </SafeAreaView>;
}

/** The rotating hero: dark slide with eyebrow, three-line title, body, two buttons and the slide dots. */
function EHubHomeHeroSkeleton({ layout }: { layout: EHubLayout }) {
  const { styles } = useSkeletonStyles();
  const contentWidth = layout.contentWidth - (layout.gutter + 6) * 2;
  const titleSize = layout.isTablet ? 44 : 32;
  return <View style={[styles.hero, { minHeight: layout.isTablet ? 460 : 430 }]}>
    <View style={{ width: layout.contentWidth, maxWidth: '100%', paddingHorizontal: layout.gutter + 6, paddingTop: 40, paddingBottom: 88 }}>
      <Line fontSize={11} lineHeight={15} width={128} tint={ON_DARK} />
      <TextBlock chars={56} fontSize={titleSize} lineHeight={layout.isTablet ? 48 : 36} weight="bold" width={Math.min(contentWidth, 620)} tint={ON_DARK} style={styles.marginTop12} />
      <TextBlock chars={100} fontSize={14} lineHeight={22} width={Math.min(contentWidth, 520)} tint={ON_DARK} style={styles.marginTop14} />
      <View style={styles.heroActions}>
        <SkeletonBox width={170} height={46} borderRadius={13} style={{ backgroundColor: 'rgba(163,230,53,0.55)' }} />
        <View style={styles.heroSecondary}><Line fontSize={14} width={88} tint={ON_DARK} /></View>
      </View>
    </View>
    <View style={styles.heroDots}>
      <IconSlot box={34} size={18} tint={ON_DARK} />
      <View style={[styles.dot, styles.dotActive]} />
      <View style={styles.dot} />
      <View style={styles.dot} />
      <IconSlot box={34} size={18} tint={ON_DARK} />
    </View>
  </View>;
}

/** The four "ways to use E-Hub" cards that overlap the hero. */
function EHubHomePathsSkeleton({ layout }: { layout: EHubLayout }) {
  const { styles } = useSkeletonStyles();
  const cardWidth = layout.isWide ? layout.columnWidth(4) : layout.isTablet ? layout.columnWidth(2) : layout.innerWidth;
  const textWidth = cardWidth - 32 - 2 - 44 - 14;
  return <View style={[styles.paths, { width: layout.contentWidth, paddingHorizontal: layout.gutter, gap: layout.isTablet ? 14 : 10 }]}>
    {HOME_PATH_DESCRIPTION_CHARS.map((descriptionChars, cardIndex) => <View key={cardIndex} style={[styles.pathCard, { width: cardWidth }]}>
      <SkeletonBox width={44} height={44} borderRadius={13} />
      <View style={styles.flex}>
        <Line fontSize={11} lineHeight={15} width={52} />
        <Line fontSize={15} lineHeight={20} width={Math.round(Math.min(textWidth * 0.85, 190))} style={styles.marginVertical2} />
        <TextBlock chars={descriptionChars} fontSize={12} lineHeight={17} width={textWidth} />
      </View>
    </View>)}
  </View>;
}

/** The body of the E-Hub home, from the search box to the enquiries card, with the catalog and providers loading. */
function EHubHomeBodySkeleton({ layout }: { layout: EHubLayout }) {
  const { styles } = useSkeletonStyles();
  const inner = layout.innerWidth;
  const howWidth = inner - (layout.isTablet ? 60 : 44);
  const stepTextWidth = layout.isTablet ? Math.floor((howWidth - 20) / 3) - 34 : howWidth - 34;
  const faqWidth = layout.isWide ? inner - 360 - 24 : inner;
  const safetyWidth = (layout.isWide ? 360 : inner) - 46;
  return <View style={[styles.homeBody, { width: layout.contentWidth, paddingHorizontal: layout.gutter }]}>
    <View style={styles.searchBox}>
      <IconBox size={19} />
      <Line fontSize={15} width={96} />
    </View>

    <View style={styles.section}>
      <EHubSectionHeadingSkeleton width={inner} titleChars={31} descriptionChars={96} />
      <View style={styles.filterPanel}>
        <View style={styles.chipRow}><ChipSkeleton textWidth={18} /></View>
        <View style={styles.chipRow}>
          <Line fontSize={13} width={28} />
          {HOME_SORT_CHIP_TEXT_WIDTHS.map((textWidth) => <ChipSkeleton key={textWidth} textWidth={textWidth} />)}
        </View>
      </View>
      <EHubProductGridSkeleton />
    </View>

    <View style={styles.section}>
      <EHubSectionHeadingSkeleton width={inner} titleChars={17} descriptionChars={79} actionWidth={114} />
      <EHubProviderGridSkeleton />
    </View>

    <View style={styles.section}>
      <EHubSectionHeadingSkeleton width={inner} titleChars={22} descriptionChars={106} actionWidth={82} />
      <EHubProviderGridSkeleton />
    </View>

    <View style={[styles.howItWorks, { padding: layout.isTablet ? 30 : 22 }]}>
      <Line fontSize={11} lineHeight={15} width={160} tint={ON_DARK} />
      <Line fontSize={24} lineHeight={32} width={170} tint={ON_DARK} />
      <TextBlock chars={84} fontSize={13} lineHeight={20} width={howWidth} tint={ON_DARK} />
      <View style={[styles.steps, layout.isTablet ? styles.rowStretch : null]}>
        {[60, 72, 61].map((textChars, stepIndex) => <View key={stepIndex} style={[styles.step, layout.isTablet ? styles.flex : null]}>
          <IconBox size={22} tint={ON_DARK} />
          <Line fontSize={15} lineHeight={20} width={86} tint={ON_DARK} />
          <TextBlock chars={textChars} fontSize={13} lineHeight={20} width={stepTextWidth} tint={ON_DARK} />
        </View>)}
      </View>
    </View>

    <View style={[styles.faqLayout, layout.isWide ? styles.faqLayoutWide : null]}>
      <View style={[styles.section, layout.isWide ? styles.flex : null]}>
        <EHubSectionHeadingSkeleton width={faqWidth} titleChars={8} descriptionChars={52} />
        {HOME_FAQ_QUESTION_CHARS.map((questionChars) => <View key={questionChars} style={styles.faqItem}>
          <View style={styles.flex}><TextBlock chars={questionChars} fontSize={15} lineHeight={20} weight="bold" width={faqWidth - 38 - 28} /></View>
          <IconBox size={18} />
        </View>)}
      </View>
      <View style={[styles.safetyCard, layout.isWide ? styles.safetyCardWide : null]}>
        <IconBox size={32} />
        <Line fontSize={22} lineHeight={29} width={130} />
        <TextBlock chars={190} fontSize={13} lineHeight={20} width={safetyWidth} />
        <SkeletonBox width={164} height={44} borderRadius={13} />
      </View>
    </View>

    <View style={styles.inboxCard}>
      <IconBox size={24} />
      <View style={styles.flex}>
        <Line fontSize={16} width={120} />
        <TextBlock chars={50} fontSize={12} lineHeight={17} width={inner - 34 - 24 - 19 - 24} />
      </View>
      <IconBox size={19} />
    </View>
  </View>;
}

/** The dark footer: brand block, three link groups and the copyright line. */
function EHubHomeFooterSkeleton({ layout }: { layout: EHubLayout }) {
  const { styles } = useSkeletonStyles();
  const footerWidth = layout.contentWidth - (layout.gutter + 4) * 2;
  return <View style={styles.footer}>
    <View style={[styles.footerInner, { width: layout.contentWidth, paddingHorizontal: layout.gutter + 4 }]}>
      <View style={[styles.footerBrandBlock, layout.isTablet ? styles.footerColumn : null]}>
        <Line fontSize={24} lineHeight={32} width={64} tint={ON_DARK} />
        <TextBlock chars={70} fontSize={13} lineHeight={20} width={layout.isTablet ? 150 : footerWidth} tint={ON_DARK} />
      </View>
      {HOME_FOOTER_LINK_WIDTHS.map((linkWidths, groupIndex) => <View key={groupIndex} style={[styles.footerGroup, layout.isTablet ? styles.footerColumn : null]}>
        <Line fontSize={14} width={76} tint={ON_DARK} style={styles.marginBottom4} />
        {linkWidths.map((linkWidth) => <View key={linkWidth} style={styles.footerLink}><Line fontSize={13} lineHeight={20} width={linkWidth} tint={ON_DARK} /></View>)}
      </View>)}
    </View>
    <View style={[styles.copyright, { paddingHorizontal: layout.gutter + 4 }]}>
      <TextBlock chars={85} fontSize={12} width={footerWidth} tint={ON_DARK} align="center" />
    </View>
  </View>;
}

/**
 * The whole E-Hub home page while it (or page access) loads: header inside SafeAreaView with the real screen's
 * edges, hero, path cards, catalog, storefronts, professionals, how it works, FAQ, enquiries card and footer.
 * Renders full screen with no wrapper needed.
 */
export function EHubHomePageSkeleton() {
  const { layout, styles } = useSkeletonStyles();
  return <View style={styles.screen}>
    <EHubHomeHeaderSkeleton />
    <ScrollView scrollEnabled={false} showsVerticalScrollIndicator={false} contentContainerStyle={styles.homeScrollContent}>
      <EHubHomeHeroSkeleton layout={layout} />
      <EHubHomePathsSkeleton layout={layout} />
      <EHubHomeBodySkeleton layout={layout} />
      <EHubHomeFooterSkeleton layout={layout} />
    </ScrollView>
  </View>;
}

/* ------------------------------------------------------------------ Discover (EHubDiscoverScreen.tsx) */

/** The provider count line and two rows of provider cards. */
export function EHubDiscoverResultsSkeleton() {
  const { layout } = useSkeletonStyles();
  return <>
    <Line fontSize={13} width={78} />
    <EHubProviderGridSkeleton count={providerColumnsFor(layout.width) * 2} />
  </>;
}

/* ------------------------------------------------------------------ Enquiries (EHubEnquiryInboxScreen.tsx) */

type EnquiryMode = 'received' | 'sent';

/** Enquiry cards: type, counterpart, date and status pill, the message box and (when received) Mark read / Reply / Close. */
export function EHubEnquiryListSkeleton({ mode, count = 3 }: { mode: EnquiryMode; count?: number }) {
  const { layout, styles } = useSkeletonStyles();
  const cardInner = Math.min(layout.contentWidth, 820) - layout.gutter * 2 - 36;
  return <View style={styles.list14}>
    {Array.from({ length: count }, (_, cardIndex) => <View key={cardIndex} style={styles.enquiryCard}>
      <View style={styles.enquiryTop}>
        <View style={styles.flex}>
          <Line fontSize={11} lineHeight={15} width={64} />
          <Line fontSize={16} lineHeight={21} width={Math.round(cardInner * 0.48)} style={styles.marginTop3} />
          <Line fontSize={12} lineHeight={16} width={Math.round(Math.min(cardInner * 0.55, 190))} style={styles.marginTop2} />
        </View>
        <SkeletonBox width={52} height={26} borderRadius={999} />
      </View>
      <View style={styles.enquiryMessage}>
        <TextBlock chars={cardIndex % 2 === 0 ? 120 : 70} fontSize={14} lineHeight={21} width={cardInner - 26} />
      </View>
      {mode === 'received' ? <View style={styles.enquiryActions}>
        <SkeletonBox width={92} height={42} borderRadius={12} />
        <SkeletonBox width={86} height={42} borderRadius={12} />
        <SkeletonBox width={88} height={42} borderRadius={12} />
      </View> : null}
    </View>)}
  </View>;
}

/** The enquiries page body while the signed-in member loads: intro, Received/Sent switch and enquiry cards. */
export function EHubEnquiryInboxSkeleton({ mode }: { mode: EnquiryMode }) {
  const { layout, styles } = useSkeletonStyles();
  const textWidth = Math.min(layout.contentWidth, 820) - layout.gutter * 2;
  return <>
    <View>
      <Line fontSize={11} lineHeight={15} width={110} />
      <Line fontSize={27} lineHeight={36} width={Math.min(textWidth, 236)} style={styles.marginTop4} />
      <TextBlock chars={93} fontSize={13} lineHeight={19} width={textWidth} style={styles.marginTop4} />
    </View>
    <View style={styles.segmented}>
      <View style={[styles.segment, mode === 'received' ? styles.segmentActive : null]}><Line fontSize={14} width={62} /></View>
      <View style={[styles.segment, mode === 'sent' ? styles.segmentActive : null]}><Line fontSize={14} width={34} /></View>
    </View>
    <EHubEnquiryListSkeleton mode={mode} />
  </>;
}

/* ------------------------------------------------------------------ Product detail (EHubProductDetailScreen.tsx) */

/** The product page body under its header: gallery, buy card, details, policies and seller card. */
export function EHubProductDetailSkeleton() {
  const { layout, styles } = useSkeletonStyles();
  const galleryWidth = layout.isWide ? Math.floor((layout.innerWidth - 24) * 0.52) : layout.innerWidth;
  const buyCardInner = (layout.isWide ? layout.innerWidth - galleryWidth - 24 : layout.innerWidth) - 38;
  const sellerWidth = layout.isWide ? 340 : layout.innerWidth;
  const infoInner = (layout.isWide ? layout.innerWidth - sellerWidth - 24 : layout.innerWidth) - 38;
  return <ScrollView scrollEnabled={false} showsVerticalScrollIndicator={false} contentContainerStyle={styles.detailScrollContent}>
    <View style={[styles.detailBody, { width: layout.contentWidth, paddingHorizontal: layout.gutter }]}>
      <View style={[styles.top18, layout.isWide ? styles.topWide : null]}>
        <SkeletonBox width={galleryWidth} height={galleryWidth} borderRadius={24} />
        <View style={[styles.detailCard, layout.isWide ? styles.flex : null]}>
          <View style={styles.badges}>
            <SkeletonBox width={84} height={25} borderRadius={999} />
            <SkeletonBox width={150} height={25} borderRadius={999} />
          </View>
          <TextBlock chars={34} fontSize={27} lineHeight={32} weight="bold" width={buyCardInner} />
          <Line fontSize={28} lineHeight={37} width={150} />
          <View style={styles.row6}><SkeletonCircle size={10} /><Line fontSize={13} width={92} /></View>
          <View style={styles.row10}>
            <SkeletonBox height={48} borderRadius={14} style={styles.flex} />
            <SkeletonBox height={48} borderRadius={14} style={styles.flex} />
          </View>
          <View style={styles.row10}>
            <SkeletonBox height={48} borderRadius={14} style={styles.flex} />
            <SkeletonBox height={48} borderRadius={14} style={styles.flex} />
          </View>
          <View style={[styles.notice, styles.noticeWarning]}>
            <TextBlock chars={142} fontSize={13} lineHeight={19} width={buyCardInner - 26} />
          </View>
        </View>
      </View>

      <View style={[styles.top18, layout.isWide ? styles.topWide : null]}>
        <View style={[styles.stack14, layout.isWide ? styles.flex : null]}>
          <View style={styles.detailCard}>
            <Line fontSize={19} lineHeight={25} width={150} />
            <TextBlock chars={160} fontSize={14} lineHeight={22} width={infoInner} />
            <View style={styles.detailGrid}>
              {[96, 140].map((valueWidth) => <View key={valueWidth} style={[styles.detailItem, layout.isTablet ? styles.detailItemHalf : null]}>
                <Line fontSize={11} lineHeight={15} width={52} />
                <Line fontSize={14} width={valueWidth} />
              </View>)}
            </View>
          </View>
          <View style={styles.detailCard}>
            <Line fontSize={19} lineHeight={25} width={Math.min(infoInner, 270)} />
            <TextBlock chars={60} fontSize={14} lineHeight={22} width={infoInner} />
            <TextBlock chars={60} fontSize={14} lineHeight={22} width={infoInner} />
            <TextBlock chars={48} fontSize={13} weight="bold" width={infoInner} />
          </View>
        </View>
        <View style={[styles.detailCard, layout.isWide ? styles.sellerWide : null]}>
          <View style={styles.sellerTop}>
            <SkeletonBox width={62} height={62} borderRadius={18} />
            <View style={styles.flex}><Line fontSize={17} lineHeight={23} width={Math.round((sellerWidth - 38 - 75) * 0.7)} /></View>
          </View>
          <TextBlock chars={110} fontSize={14} lineHeight={22} width={sellerWidth - 38} />
          <View style={styles.row6}><IconBox size={14} /><Line fontSize={13} lineHeight={19} width={110} /></View>
          <SkeletonBox height={46} borderRadius={13} />
        </View>
      </View>
    </View>
  </ScrollView>;
}

/* ------------------------------------------------------------------ Provider profile (EHubProviderProfileScreen.tsx) */

const PROVIDER_ENQUIRY_TYPE_WIDTHS = [118, 140, 172, 156];

/** The provider page body under its header: profile card, then the enquiry form and catalog (side by side when wide). */
export function EHubProviderProfileSkeleton() {
  const { layout, styles } = useSkeletonStyles();
  const profileInner = layout.innerWidth - 42;
  const formWidth = layout.isWide ? 400 : layout.innerWidth;
  const formInner = formWidth - 38;
  const catalogInner = (layout.isWide ? layout.innerWidth - 400 - 22 : layout.innerWidth) - 38;
  const productWidth = layout.isTablet && !layout.isWide ? layout.columnWidth(2) - 18 : layout.isWide ? Math.floor((layout.innerWidth - 400 - 36) / 2) - 2 : layout.innerWidth - 36;

  const enquiryForm = <View key="form" style={[styles.detailCard, layout.isWide ? styles.formWide : null]}>
    <Line fontSize={20} lineHeight={27} width={Math.min(formInner, 210)} />
    <TextBlock chars={98} fontSize={13} lineHeight={19} width={formInner} />
    <Line fontSize={13} lineHeight={17} width={96} style={styles.marginTop4} />
    <View style={styles.typeGrid}>{PROVIDER_ENQUIRY_TYPE_WIDTHS.map((textWidth) => <ChipSkeleton key={textWidth} textWidth={textWidth} />)}</View>
    <Line fontSize={13} lineHeight={17} width={60} style={styles.marginTop4} />
    <View style={styles.messageInput}><Line fontSize={15} lineHeight={21} width={Math.round(formInner * 0.8)} /></View>
    <Line fontSize={12} lineHeight={16} width={180} style={styles.marginTopMinus4} />
    <View style={styles.acknowledgement}>
      <View style={styles.acknowledgementRow}>
        <SkeletonBox width={22} height={22} borderRadius={6} style={styles.marginTop1} />
        <View style={styles.flex}><TextBlock chars={180} fontSize={12} lineHeight={18} width={formInner - 28 - 33} /></View>
      </View>
      <View style={styles.termsLink}><Line fontSize={13} width={112} /></View>
    </View>
    <SkeletonBox height={50} borderRadius={14} />
  </View>;

  const catalog = <View key="catalog" style={[styles.detailCard, layout.isWide ? styles.flex : null]}>
    <Line fontSize={20} lineHeight={27} width={Math.min(catalogInner, 190)} />
    <View style={styles.productRows}>
      {[0, 1].map((rowIndex) => <View key={rowIndex} style={[styles.providerProductRow, { width: productWidth }]}>
        <SkeletonBox width={62} height={62} borderRadius={13} />
        <View style={styles.flex}>
          <Line fontSize={14} lineHeight={19} width={Math.round((productWidth - 105) * 0.8)} />
          <Line fontSize={14} lineHeight={19} width={78} style={styles.marginTop3} />
        </View>
      </View>)}
    </View>
    <TextBlock chars={45} fontSize={13} weight="bold" width={catalogInner} />
  </View>;

  return <ScrollView scrollEnabled={false} showsVerticalScrollIndicator={false} contentContainerStyle={styles.detailScrollContent}>
    <View style={[styles.providerBodyPage, { width: layout.contentWidth, paddingHorizontal: layout.gutter }]}>
      <View style={styles.profileCard}>
        <SkeletonBox width="100%" height={layout.isTablet ? 200 : 150} borderRadius={0} />
        <View style={styles.profileBody}>
          <View style={styles.profileLogo}><SkeletonBox width="100%" height="100%" borderRadius={22} /></View>
          <Line fontSize={26} lineHeight={31} width={Math.round(Math.min(profileInner * 0.65, 320))} />
          <TextBlock chars={130} fontSize={14} lineHeight={21} width={profileInner} />
          <View style={styles.metaList}>
            <View style={styles.row6}><IconBox size={15} /><Line fontSize={13} lineHeight={17} width={120} /></View>
            <View style={styles.row6}><IconBox size={15} /><Line fontSize={13} lineHeight={17} width={150} /></View>
          </View>
          <View style={styles.profileTags}>
            {[80, 96, 64].map((tagWidth) => <SkeletonBox key={tagWidth} width={tagWidth} height={28} borderRadius={999} />)}
          </View>
        </View>
      </View>
      <View style={[styles.columns, layout.isWide ? styles.columnsWide : null]}>
        {layout.isWide ? [catalog, enquiryForm] : [enquiryForm, catalog]}
      </View>
    </View>
  </ScrollView>;
}

/* ------------------------------------------------------------------ Seller Center (EHubSellerCenterScreen.tsx) */

type SellerSection = 'overview' | 'storefront' | 'products' | 'drafts' | 'settings';

const SELLER_NAV_ITEMS: { id: SellerSection | 'enquiries'; textWidth: number }[] = [
  { id: 'overview', textWidth: 64 },
  { id: 'storefront', textWidth: 96 },
  { id: 'products', textWidth: 62 },
  { id: 'drafts', textWidth: 42 },
  { id: 'settings', textWidth: 58 },
  { id: 'enquiries', textWidth: 68 },
];

/** Seller Center content while the workspace loads: the overview, or the selected section's heading and card. */
export function EHubSellerSectionSkeleton({ section }: { section: SellerSection }) {
  const { layout, styles } = useSkeletonStyles();
  const mainWidth = layout.isWide ? layout.innerWidth - 220 - 22 : layout.innerWidth;
  if (section !== 'overview') {
    return <View style={styles.sellerSection}>
      <View style={styles.sellerFormCard}>
        <View style={styles.sellerFormTop}>
          <View style={styles.flex}>
            <Line fontSize={11} lineHeight={15} width={90} />
            <Line fontSize={22} lineHeight={29} width={Math.min(mainWidth - 38, 230)} style={styles.marginTop3} />
          </View>
        </View>
        {[0, 1, 2].map((fieldIndex) => <View key={fieldIndex} style={styles.field}>
          <Line fontSize={14} lineHeight={19} width={[110, 90, 130][fieldIndex]} />
          <SkeletonBox height={fieldIndex === 1 ? 120 : 48} borderRadius={14} />
        </View>)}
        <SkeletonBox height={46} borderRadius={13} />
      </View>
    </View>;
  }
  return <View style={styles.sellerSection}>
    <View>
      <Line fontSize={11} lineHeight={15} width={150} />
      <Line fontSize={27} lineHeight={36} width={Math.min(mainWidth, 250)} style={styles.marginTop3} />
      <TextBlock chars={70} fontSize={14} lineHeight={20} width={mainWidth} style={styles.marginTop4} />
    </View>
    <View style={[styles.metrics, layout.isTablet ? styles.rowStretch : null]}>
      {[28, 28, 110].map((valueWidth, metricIndex) => <View key={metricIndex} style={styles.metric}>
        <IconBox size={20} />
        <Line fontSize={22} lineHeight={29} width={valueWidth} style={styles.marginTop4} />
        <Line fontSize={13} lineHeight={17} width={[66, 42, 70][metricIndex]} />
      </View>)}
    </View>
    <Line fontSize={18} lineHeight={24} width={190} style={styles.marginTop6} />
    <View style={styles.destinations}>
      {[[100, 230], [124, 200], [100, 250], [124, 150]].map(([titleWidth, descriptionWidth]) => <View key={`${titleWidth}-${descriptionWidth}`} style={styles.destination}>
        <IconBox size={20} />
        <View style={styles.flex}>
          <Line fontSize={16} lineHeight={21} width={titleWidth} />
          <Line fontSize={13} lineHeight={17} width={Math.min(descriptionWidth, mainWidth - 34 - 20 - 19 - 28)} />
        </View>
        <IconBox size={19} />
      </View>)}
    </View>
  </View>;
}

/** The Seller Center page body while the signed-in member loads: section tabs (or the wide rail) and the section. */
export function EHubSellerCenterSkeleton({ section }: { section: SellerSection }) {
  const { colors, layout, styles } = useSkeletonStyles();
  const navItems = SELLER_NAV_ITEMS.map((item) => {
    const isSelected = item.id === section;
    return <View key={item.id} style={[styles.sellerNavItem, isSelected ? styles.sellerNavItemActive : null]}>
      <IconBox size={17} tint={isSelected ? ON_DARK : undefined} />
      <Line fontSize={14} width={item.textWidth} tint={isSelected ? ON_DARK : undefined} />
    </View>;
  });
  return <View style={[styles.sellerBody, { width: layout.contentWidth, paddingHorizontal: layout.gutter }, layout.isWide ? styles.sellerBodyWide : null]}>
    {layout.isWide
      ? <View style={[styles.sellerRail, { borderColor: colors.border, backgroundColor: colors.surface }]}>
        <View style={styles.sellerRailLabel}><Line fontSize={11} lineHeight={15} width={100} /></View>
        {navItems}
      </View>
      : <View style={[styles.sellerTabs, { marginHorizontal: -layout.gutter, paddingHorizontal: layout.gutter }]}>{navItems}</View>}
    <View style={styles.sellerMain}><EHubSellerSectionSkeleton section={section} /></View>
  </View>;
}

/* ------------------------------------------------------------------ Business account (BusinessAccountScreen.tsx) */

const BUSINESS_FIELDS: { labelWidth: number; isMultiline?: boolean }[] = [
  { labelWidth: 104 },
  { labelWidth: 84, isMultiline: true },
];

function BusinessFieldSkeleton({ labelWidth, isMultiline }: { labelWidth: number; isMultiline?: boolean }) {
  const { styles } = useSkeletonStyles();
  return <View style={styles.field}>
    <Line fontSize={14} lineHeight={19} width={labelWidth} />
    <SkeletonBox height={isMultiline ? 120 : 48} borderRadius={14} />
  </View>;
}

/** The business account summary card (four stats, Seller Center button) and the details/contact form card. */
export function BusinessAccountSkeleton() {
  const { layout, styles } = useSkeletonStyles();
  const pair = (leftWidth: number, rightWidth: number) => <View style={[styles.businessGrid, layout.isTablet ? styles.rowStretch : null]}>
    <View style={layout.isTablet ? styles.flex : null}><BusinessFieldSkeleton labelWidth={leftWidth} /></View>
    <View style={layout.isTablet ? styles.flex : null}><BusinessFieldSkeleton labelWidth={rightWidth} /></View>
  </View>;
  return <>
    <View style={styles.businessCard}>
      <Line fontSize={11} lineHeight={15} width={124} style={styles.marginBottomMinus12} />
      <Line fontSize={24} lineHeight={32} width={200} />
      <View style={styles.stats}>
        {[[24, 96], [24, 72], [24, 98], [24, 96]].map(([valueWidth, labelWidth], statIndex) => <View key={statIndex} style={styles.stat}>
          <Line fontSize={20} lineHeight={27} width={valueWidth} />
          <Line fontSize={12} lineHeight={16} width={labelWidth} />
        </View>)}
      </View>
      <SkeletonBox height={46} borderRadius={13} />
    </View>
    <View style={styles.businessCard}>
      <Line fontSize={18} lineHeight={24} width={150} />
      {BUSINESS_FIELDS.map((field) => <BusinessFieldSkeleton key={field.labelWidth} labelWidth={field.labelWidth} isMultiline={field.isMultiline} />)}
      {pair(84, 66)}
      <Line fontSize={18} lineHeight={24} width={74} />
      {pair(40, 46)}
      <BusinessFieldSkeleton labelWidth={60} />
      <View style={styles.field}>
        <Line fontSize={14} lineHeight={19} width={78} />
        <View style={styles.chipBox}>
          <View style={styles.chipInputRow}>
            <View style={styles.chipInput}><Line fontSize={15} width={110} /></View>
            <SkeletonBox width={54} height={40} borderRadius={10} />
          </View>
        </View>
      </View>
      <SkeletonBox height={46} borderRadius={13} />
    </View>
  </>;
}

function createStyles(colors: AppThemeColors) {
  const card = { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border };
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.canvas },
    flex: { flex: 1, minWidth: 0 },
    row: { flexDirection: 'row', alignItems: 'center' },
    row6: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    row10: { flexDirection: 'row', gap: 10 },
    rowStretch: { flexDirection: 'row' },
    gap2: { gap: 2 },
    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    marginTop1: { marginTop: 1 },
    marginTop2: { marginTop: 2 },
    marginTop3: { marginTop: 3 },
    marginTop4: { marginTop: 4 },
    marginTop6: { marginTop: 6 },
    marginTop12: { marginTop: 12 },
    marginTop14: { marginTop: 14 },
    marginTopMinus4: { marginTop: -4 },
    marginBottom4: { marginBottom: 4 },
    marginBottomMinus12: { marginBottom: -12 },
    marginVertical2: { marginVertical: 2 },

    // EHubParts
    heading: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 },
    linkButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 4 },
    productCard: { overflow: 'hidden', borderRadius: 18, ...card },
    stockBadge: { position: 'absolute', left: 8, bottom: 8, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, backgroundColor: 'rgba(2,6,23,0.85)' },
    productBody: { padding: 11, gap: 3 },
    productTitle: { minHeight: 36 },
    heartButton: { position: 'absolute', top: 8, right: 8, width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.95)' },
    productActions: { flexDirection: 'row', gap: 8, paddingHorizontal: 11, paddingBottom: 11 },
    compareButton: { width: 42, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: colors.border },
    providerCard: { overflow: 'hidden', borderRadius: 24, ...card },
    providerCover: { height: 128, overflow: 'hidden' },
    kindBadge: { position: 'absolute', left: 16, top: 16, paddingHorizontal: 11, paddingVertical: 5, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'rgba(2,6,23,0.8)' },
    providerBody: { paddingHorizontal: 18, paddingBottom: 18, paddingTop: 44, gap: 8 },
    providerLogo: { position: 'absolute', top: -32, left: 18, width: 64, height: 64, overflow: 'hidden', borderRadius: 18, borderWidth: 4, borderColor: colors.surface, backgroundColor: colors.surface },
    placeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 5 },
    providerDescription: { minHeight: 36 },
    tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    providerAction: { marginTop: 4, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 13, borderWidth: 1, borderColor: '#a7f3d0', backgroundColor: colors.successSurface },
    chipRow: { flexDirection: 'row', gap: 8, alignItems: 'center', paddingHorizontal: 2, overflow: 'hidden' },

    // EHubScreen
    homeHeader: { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
    homeHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingTop: 6, paddingBottom: 4 },
    homeNav: { flexDirection: 'row', paddingHorizontal: 8, paddingBottom: 6 },
    homeNavItem: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center' },
    homeScrollContent: { alignItems: 'center' },
    hero: { width: '100%', justifyContent: 'center', alignItems: 'center', backgroundColor: DARK_SURFACE, overflow: 'hidden' },
    heroActions: { marginTop: 22, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    heroSecondary: { minHeight: 46, paddingHorizontal: 18, justifyContent: 'center', borderRadius: 13, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', backgroundColor: 'rgba(255,255,255,0.1)' },
    heroDots: { position: 'absolute', bottom: 36, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 5, borderRadius: 999, backgroundColor: 'rgba(2,6,23,0.5)' },
    dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.5)' },
    dotActive: { width: 26, backgroundColor: '#a3e635' },
    paths: { maxWidth: '100%', marginTop: -20, flexDirection: 'row', flexWrap: 'wrap' },
    pathCard: { padding: 16, flexDirection: 'row', alignItems: 'flex-start', gap: 14, borderRadius: 18, ...card, shadowColor: DARK_SURFACE, shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
    homeBody: { maxWidth: '100%', paddingTop: 24, paddingBottom: 40, gap: 34 },
    searchBox: { minHeight: 50, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 15, ...card },
    section: { gap: 14 },
    filterPanel: { padding: 10, gap: 8, borderRadius: 18, ...card },
    howItWorks: { gap: 6, borderRadius: 26, backgroundColor: DARK_SURFACE },
    steps: { marginTop: 12, gap: 10 },
    step: { padding: 16, gap: 8, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.05)' },
    faqLayout: { gap: 24 },
    faqLayoutWide: { flexDirection: 'row', alignItems: 'flex-start' },
    faqItem: { padding: 18, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 18, ...card },
    safetyCard: { padding: 22, gap: 10, borderRadius: 24, borderWidth: 1, borderColor: '#fcd34d', backgroundColor: colors.warningSurface },
    safetyCardWide: { width: 360 },
    inboxCard: { minHeight: 76, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, ...card },
    footer: { width: '100%', alignItems: 'center', paddingTop: 34, paddingBottom: 40, backgroundColor: DARK_SURFACE, borderTopWidth: 1, borderTopColor: '#1e293b' },
    footerInner: { maxWidth: '100%', flexDirection: 'row', flexWrap: 'wrap', gap: 26 },
    footerBrandBlock: { width: '100%', gap: 8 },
    footerColumn: { width: 'auto', flex: 1, minWidth: 150 },
    footerGroup: { minWidth: 140, gap: 6 },
    footerLink: { minHeight: 32, justifyContent: 'center' },
    copyright: { width: '100%', marginTop: 28, paddingTop: 18, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' },

    // EHubEnquiryInboxScreen
    list14: { gap: 14 },
    enquiryCard: { padding: 17, gap: 12, borderRadius: 22, ...card },
    enquiryTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    enquiryMessage: { padding: 13, borderRadius: 15, backgroundColor: colors.control },
    enquiryActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8 },
    segmented: { alignSelf: 'flex-start', flexDirection: 'row', padding: 4, gap: 4, borderRadius: 14, backgroundColor: colors.control },
    segment: { minHeight: 40, minWidth: 104, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', borderRadius: 11 },
    segmentActive: { backgroundColor: colors.surface },

    // EHubProductDetailScreen / EHubProviderProfileScreen
    detailScrollContent: { paddingBottom: 48, alignItems: 'center' },
    detailBody: { maxWidth: '100%', alignSelf: 'center', paddingTop: 16, gap: 22 },
    top18: { gap: 18 },
    topWide: { flexDirection: 'row', alignItems: 'flex-start', gap: 24 },
    stack14: { gap: 14 },
    detailCard: { padding: 18, gap: 12, borderRadius: 24, ...card },
    badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    notice: { padding: 13, borderRadius: 15, gap: 10 },
    noticeWarning: { backgroundColor: colors.warningSurface },
    detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.border },
    detailItem: { width: '100%', gap: 3 },
    detailItemHalf: { width: '47%' },
    sellerWide: { width: 340 },
    sellerTop: { flexDirection: 'row', alignItems: 'center', gap: 13 },
    providerBodyPage: { maxWidth: '100%', alignSelf: 'center', paddingTop: 16, gap: 18 },
    profileCard: { overflow: 'hidden', borderRadius: 24, ...card },
    profileBody: { paddingHorizontal: 20, paddingBottom: 22, gap: 12 },
    profileLogo: { width: 92, height: 92, marginTop: -50, overflow: 'hidden', borderRadius: 26, borderWidth: 4, borderColor: colors.surface, backgroundColor: colors.control },
    metaList: { gap: 7 },
    profileTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
    columns: { gap: 18 },
    columnsWide: { flexDirection: 'row', alignItems: 'flex-start', gap: 22 },
    formWide: { width: 400 },
    typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    messageInput: { minHeight: 140, padding: 13, borderRadius: 15, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input },
    acknowledgement: { padding: 13, gap: 6, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.control },
    acknowledgementRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
    termsLink: { marginLeft: 33, minHeight: 32, justifyContent: 'center' },
    productRows: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    providerProductRow: { padding: 10, flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 16, borderWidth: 1, borderColor: colors.border },

    // EHubSellerCenterScreen
    sellerBody: { alignSelf: 'center', paddingTop: 16, gap: 16 },
    sellerBodyWide: { flexDirection: 'row', alignItems: 'flex-start', gap: 22 },
    sellerMain: { flex: 1, minWidth: 0, gap: 16 },
    sellerTabs: { flexDirection: 'row', gap: 8, overflow: 'hidden' },
    sellerRail: { width: 220, padding: 10, gap: 4, borderRadius: 20, borderWidth: 1 },
    sellerRailLabel: { paddingHorizontal: 10, paddingVertical: 8 },
    sellerNavItem: { minHeight: 44, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 13, ...card },
    sellerNavItemActive: { backgroundColor: BRAND_GREEN, borderColor: BRAND_GREEN },
    sellerSection: { gap: 16 },
    sellerFormCard: { padding: 18, gap: 18, borderRadius: 24, ...card },
    sellerFormTop: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
    metrics: { gap: 10 },
    metric: { flex: 1, padding: 16, gap: 6, borderRadius: 20, ...card },
    destinations: { gap: 10 },
    destination: { minHeight: 76, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 20, ...card },

    // BusinessAccountScreen / EHubSellerFormParts
    businessCard: { padding: 20, gap: 16, borderRadius: 24, ...card },
    stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    stat: { flexGrow: 1, flexBasis: '40%', minWidth: 120, padding: 12, gap: 2, borderRadius: 16, backgroundColor: colors.control },
    businessGrid: { gap: 16 },
    field: { gap: 7 },
    chipBox: { padding: 8, gap: 8, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input },
    chipInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    chipInput: { flex: 1, minWidth: 0, minHeight: 42, paddingHorizontal: 8, justifyContent: 'center' },
  });
}
