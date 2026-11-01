import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ArchiveRestore, Trash2 } from 'lucide-react-native';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import type { EHubDraft } from '@/lib/types/ehubSeller';
import { SellerButton, formatSavedTime } from '@/components/ehub/EHubSellerFormParts';

type DraftsProps = {
  activeDrafts: EHubDraft[];
  deletedDrafts: EHubDraft[];
  isWorking: boolean;
  onResume: (draft: EHubDraft) => void;
  onRequestDelete: (draft: EHubDraft, permanent: boolean) => void;
  onRestore: (draft: EHubDraft) => void;
};

/** The website's Drafts section: autosaved storefront and product drafts, and Recently Deleted (30-day recovery). */
export default function EHubSellerDrafts({ activeDrafts, deletedDrafts, isWorking, onResume, onRequestDelete, onRestore }: DraftsProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return <View style={styles.section}>
    <View>
      <Text style={styles.eyebrow}>Recovery</Text>
      <Text style={styles.pageTitle}>Drafts</Text>
      <Text style={styles.muted}>Autosaved work stays private until you explicitly publish it.</Text>
    </View>
    <DraftGroup title="Saved drafts" drafts={activeDrafts} emptyText="No active drafts." styles={styles} actions={(draft) => <>
      <SellerButton compact label="Resume editing" onPress={() => onResume(draft)} />
      <SellerButton compact variant="secondary" label="Delete" icon={<Trash2 size={15} color={colors.text} />} onPress={() => onRequestDelete(draft, false)} />
    </>} />
    <DraftGroup title="Recently Deleted" drafts={deletedDrafts} emptyText="No recently deleted drafts." styles={styles} actions={(draft) => <>
      <SellerButton compact label="Restore" icon={<ArchiveRestore size={15} color="#ffffff" />} disabled={isWorking} onPress={() => onRestore(draft)} />
      <SellerButton compact variant="danger" label="Delete permanently" onPress={() => onRequestDelete(draft, true)} />
    </>} />
  </View>;
}

type DraftGroupProps = { title: string; drafts: EHubDraft[]; emptyText: string; styles: ReturnType<typeof createStyles>; actions: (draft: EHubDraft) => ReactNode };

function DraftGroup({ title, drafts, emptyText, styles, actions }: DraftGroupProps) {
  return <View style={styles.group}>
    <Text style={styles.groupTitle}>{title}</Text>
    {drafts.length === 0 ? <Text style={styles.empty}>{emptyText}</Text> : drafts.map((draft) => <View key={draft.id} style={styles.card}>
      <Text style={styles.type}>{draft.type === 'storefront' ? 'Storefront' : 'Product'}</Text>
      <Text style={styles.cardTitle}>{draft.title}</Text>
      <Text style={styles.small}>Updated {formatSavedTime(draft.updatedAt)} · {draft.completion}% complete</Text>
      {draft.recoverUntil ? <Text style={styles.recover}>Recoverable until {formatSavedTime(draft.recoverUntil)}</Text> : null}
      <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: draft.completion }} style={styles.track}><View style={[styles.bar, { width: `${draft.completion}%` }]} /></View>
      <View style={styles.actions}>{actions(draft)}</View>
    </View>)}
  </View>;
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  section: { gap: 22 },
  eyebrow: { color: colors.accentText, fontSize: 11, fontWeight: '900', letterSpacing: 1.4, textTransform: 'uppercase' },
  pageTitle: { marginTop: 3, color: colors.text, fontSize: 27, fontWeight: '900' },
  muted: { marginTop: 4, color: colors.mutedText, fontSize: 14, lineHeight: 20 },
  group: { gap: 10 },
  groupTitle: { color: colors.text, fontSize: 18, fontWeight: '900' },
  empty: { padding: 26, borderRadius: 18, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, backgroundColor: colors.surface, color: colors.mutedText, fontSize: 14, textAlign: 'center', overflow: 'hidden' },
  card: { padding: 16, gap: 5, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  type: { color: colors.accentText, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '900' },
  small: { color: colors.mutedText, fontSize: 12 },
  recover: { color: colors.warningText, fontSize: 12, fontWeight: '700' },
  track: { height: 6, marginTop: 6, overflow: 'hidden', borderRadius: 3, backgroundColor: colors.control },
  bar: { height: '100%', borderRadius: 3, backgroundColor: '#059669' },
  actions: { marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
