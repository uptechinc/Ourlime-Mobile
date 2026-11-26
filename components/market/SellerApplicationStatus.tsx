import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import type { SellerApplication, SellerApplicationReview, SellerApplicationStatus } from '@/lib/types/reliability';

type Tone = 'pending' | 'positive' | 'caution' | 'negative';
type LockedStatus = Exclude<SellerApplicationStatus, 'draft'>;
type StatusCopy = { icon: string; tone: Tone; eyebrow: string; title: string; body: string; decision: string };

// Wording shared with the website: keep the eyebrows and titles identical.
const STATUS_COPY: Record<LockedStatus, StatusCopy> = {
  submitted: { icon: 'clock', tone: 'pending', eyebrow: 'Submitted', title: 'Your application is in review', body: 'An Ourlime administrator is checking your details and documents. You will get an in-app notification when there is a decision.', decision: 'Decision' },
  approved: { icon: 'check-circle', tone: 'positive', eyebrow: 'Approved', title: "You're an approved seller", body: 'Your store can list products on Lime Market. Payments and payouts are not available yet.', decision: 'Approved' },
  changes_requested: { icon: 'edit-3', tone: 'caution', eyebrow: 'Action needed', title: 'Changes requested', body: 'The reviewer needs a few updates before approving.', decision: 'Changes requested' },
  rejected: { icon: 'x-circle', tone: 'negative', eyebrow: 'Not approved', title: 'Your application was not approved', body: 'You can apply again with a revised application.', decision: 'Not approved' },
  suspended: { icon: 'pause-circle', tone: 'negative', eyebrow: 'Paused', title: 'Selling is paused', body: 'Your seller account is suspended. Contact Ourlime support if you think this is a mistake.', decision: 'Paused' },
};

/** Human words for a status ("Changes requested"), used in the "Status changed to …" confirmation. */
export function describeSellerStatus(status: SellerApplicationStatus): string {
  if (status === 'draft') return 'Draft';
  return status === 'submitted' ? 'In review' : STATUS_COPY[status].decision;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "26 Nov 2026", without relying on Hermes Intl data. */
function formatDay(ms: number | null): string | null {
  if (ms === null) return null;
  const date = new Date(ms);
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

function toneColors(colors: AppThemeColors, tone: Tone) {
  if (tone === 'positive') return { surface: colors.successSurface, border: colors.successBorder, text: colors.successText };
  if (tone === 'negative') return { surface: colors.destructiveSurface, border: colors.destructiveBorder, text: colors.destructiveText };
  return { surface: colors.warningSurface, border: colors.warningBorder, text: colors.warningText };
}

type HeroProps = { status: LockedStatus; reason: string | null };

/** The big answer to "where is my application?": icon, status, one line of what it means, and the reviewer's note. */
export function SellerStatusHero({ status, reason }: HeroProps) {
  const { colors } = useAppTheme();
  const copy = STATUS_COPY[status];
  const tone = toneColors(colors, copy.tone);
  return <View accessibilityLiveRegion="polite" style={{ gap: 14, padding: 20, borderRadius: 20, borderWidth: 1, borderColor: tone.border, backgroundColor: tone.surface }}>
    <View style={{ width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: tone.border }}>
      <Icon name={copy.icon} size={28} color={tone.text} />
    </View>
    <View style={{ gap: 6 }}>
      <Text style={{ color: tone.text, fontSize: 12, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' }}>{copy.eyebrow}</Text>
      <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 22, fontWeight: '900', lineHeight: 28 }}>{copy.title}</Text>
      <Text style={{ color: colors.secondaryText, fontSize: 15, lineHeight: 21 }}>{copy.body}</Text>
    </View>
    {reason && status !== 'submitted' ? <View style={{ gap: 4, padding: 12, borderRadius: 12, backgroundColor: colors.surface, borderLeftWidth: 3, borderLeftColor: tone.text }}>
      <Text style={{ color: colors.mutedText, fontSize: 12, fontWeight: '800', textTransform: 'uppercase' }}>Reviewer&apos;s note</Text>
      <Text style={{ color: colors.text, fontSize: 15, lineHeight: 21 }}>{reason}</Text>
    </View> : null}
  </View>;
}

type TimelineProps = { status: LockedStatus; review: SellerApplicationReview | null };
type StepState = 'done' | 'current' | 'upcoming';

/** Submitted → In review → Decision, with the dates the server recorded. */
export function SellerReviewTimeline({ status, review }: TimelineProps) {
  const { colors } = useAppTheme();
  const copy = STATUS_COPY[status];
  const isDecided = status !== 'submitted';
  const decisionTone = toneColors(colors, copy.tone);
  const steps: { title: string; detail: string | null; state: StepState }[] = [
    { title: 'Submitted', detail: formatDay(review?.submittedAtMs ?? null), state: 'done' },
    { title: 'In review', detail: isDecided ? 'Reviewed by an administrator' : 'An administrator is reviewing', state: isDecided ? 'done' : 'current' },
    { title: isDecided ? copy.decision : 'Decision', detail: isDecided ? formatDay(review?.decidedAtMs ?? null) : "You'll be notified when it's decided", state: isDecided ? 'done' : 'upcoming' },
  ];
  return <View style={{ padding: 16, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
    <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 16, fontWeight: '800', marginBottom: 12 }}>Review progress</Text>
    {steps.map((step, index) => {
      const isLast = index === steps.length - 1;
      // Done steps share the accent; only a non-approval decision takes its own tone (amber or red).
      const dotColor = step.state === 'upcoming' ? colors.border : isLast && isDecided && copy.tone !== 'positive' ? decisionTone.text : step.state === 'current' ? colors.warning : colors.accent;
      const stateWords = step.state === 'done' ? 'done' : step.state === 'current' ? 'in progress' : 'not yet';
      return <View key={step.title} accessible accessibilityLabel={`${step.title}, ${stateWords}${step.detail ? `, ${step.detail}` : ''}`} style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ alignItems: 'center', width: 24 }}>
          <View style={{ width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: step.state === 'upcoming' ? colors.surface : dotColor, borderWidth: 2, borderColor: dotColor }}>
            {step.state === 'done' ? <Icon name={isLast && (status === 'rejected' || status === 'suspended') ? 'x' : 'check'} size={13} color={colors.surface} />
              : step.state === 'current' ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.surface }} /> : null}
          </View>
          {isLast ? null : <View style={{ flex: 1, width: 2, minHeight: 18, backgroundColor: steps[index + 1].state === 'upcoming' ? colors.border : colors.accent }} />}
        </View>
        <View style={{ flex: 1, paddingBottom: isLast ? 0 : 16, gap: 2 }}>
          <Text style={{ color: step.state === 'upcoming' ? colors.mutedText : colors.text, fontSize: 15, fontWeight: '700' }}>{step.title}</Text>
          {step.detail ? <Text style={{ color: colors.mutedText, fontSize: 13 }}>{step.detail}</Text> : null}
        </View>
      </View>;
    })}
  </View>;
}

type SummaryProps = { application: SellerApplication };

/** What was sent for review: store, seller type, categories, documents and revision. */
export function SellerSubmittedSummary({ application }: SummaryProps) {
  const { colors } = useAppTheme();
  const documents = application.files.length;
  const rows: [string, string, string][] = [
    ['shopping-bag', 'Store name', application.storeName || 'Not given'],
    ['user', 'Seller type', application.isBusiness ? 'Registered business' : 'Individual seller'],
    ['tag', 'Categories', application.categories.join(', ') || 'None'],
    ['paperclip', 'Documents', `${documents === 1 ? '1 document' : `${documents} documents`}, stored privately`],
    // The revision number only means something once there has been more than one.
    ...(application.revision > 1 ? [['git-commit', 'Revision', String(application.revision)] as [string, string, string]] : []),
  ];
  return <View style={{ padding: 16, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, gap: 4 }}>
    <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 16, fontWeight: '800', marginBottom: 6 }}>What you submitted</Text>
    {rows.map(([icon, label, value]) => <View key={label} accessible accessibilityLabel={`${label}: ${value}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 36 }}>
      <Icon name={icon} size={16} color={colors.icon} />
      <Text style={{ color: colors.mutedText, fontSize: 14, width: 96 }}>{label}</Text>
      <Text numberOfLines={2} style={{ flex: 1, color: colors.text, fontSize: 14, fontWeight: '600' }}>{value}</Text>
    </View>)}
  </View>;
}

export type SellerRefreshState =
  | { phase: 'idle' | 'checking'; checkedAtMs: number | null }
  | { phase: 'current'; checkedAtMs: number }
  | { phase: 'changed'; checkedAtMs: number; statusLabel: string }
  | { phase: 'failed'; checkedAtMs: number | null; message: string };

/** "just now", "5 min ago", "2 h ago", or the day. */
function describeCheckedAt(checkedAtMs: number, nowMs: number): string {
  const minutes = Math.floor((nowMs - checkedAtMs) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)} h ago`;
  return formatDay(checkedAtMs) ?? '';
}

type RefreshProps = {
  state: SellerRefreshState; nowMs: number; onRefresh: () => void;
  /** `button` while a decision is pending; a quiet `link` once the decision is final. */
  variant?: 'button' | 'link';
};

/** "Check review status" with a spinner while checking and the outcome underneath, also announced to screen readers. */
export function SellerRefreshPanel({ state, nowMs, onRefresh, variant = 'button' }: RefreshProps) {
  const { colors } = useAppTheme();
  const isChecking = state.phase === 'checking';
  const lastChecked = state.checkedAtMs !== null ? `Last checked ${describeCheckedAt(state.checkedAtMs, nowMs)}` : null;
  const line = state.phase === 'checking' ? { icon: null, color: colors.secondaryText, text: 'Checking…' }
    : state.phase === 'changed' ? { icon: 'bell', color: colors.successText, text: `Status changed to ${state.statusLabel}` }
    : state.phase === 'current' ? { icon: 'check', color: colors.successText, text: `Up to date · checked ${describeCheckedAt(state.checkedAtMs, nowMs)}` }
    : state.phase === 'failed' ? { icon: 'wifi-off', color: colors.destructiveText, text: state.message }
    : lastChecked ? { icon: 'clock', color: colors.mutedText, text: `${lastChecked} · pull down to refresh` }
    : { icon: 'clock', color: colors.mutedText, text: 'Pull down or tap to check for a decision' };
  const isLink = variant === 'link';
  return <View style={{ gap: isLink ? 2 : 8, alignItems: isLink ? 'center' : 'stretch' }}>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={isChecking ? 'Checking review status' : 'Check review status'} accessibilityState={{ busy: isChecking, disabled: isChecking }} disabled={isChecking} onPress={onRefresh}
      style={isLink ? { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8 }
        : { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, borderWidth: 1, borderColor: colors.successBorder, backgroundColor: colors.successSurface }}>
      {isChecking ? <ActivityIndicator size="small" color={colors.accentText} /> : <Icon name="refresh-cw" size={isLink ? 14 : 16} color={colors.accentText} />}
      <Text style={{ color: colors.accentText, fontWeight: isLink ? '700' : '800', fontSize: isLink ? 14 : 15, textDecorationLine: isLink && !isChecking ? 'underline' : 'none' }}>{isChecking ? 'Checking…' : 'Check review status'}</Text>
    </TouchableOpacity>
    {/* The link already says "Checking…" while it runs, so its line stays empty (but keeps its height, so nothing jumps). */}
    <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 20 }}>
      {isLink && isChecking ? null : <>
        {line.icon ? <Icon name={line.icon} size={14} color={line.color} /> : null}
        <Text accessibilityRole={state.phase === 'failed' ? 'alert' : 'text'} style={{ color: line.color, fontSize: 13, fontWeight: state.phase === 'idle' ? '500' : '700', textAlign: 'center', flexShrink: 1 }}>{line.text}</Text>
      </>}
    </View>
    {/* A failed check keeps the last good time on screen. */}
    {state.phase === 'failed' && lastChecked ? <Text style={{ color: colors.mutedText, fontSize: 12, textAlign: 'center' }}>{lastChecked}</Text> : null}
  </View>;
}

type NoteProps = { icon: string; text: string };

/** A quiet one-line fact with an icon (the payments disclaimer), instead of loose body text. */
export function SellerInfoNote({ icon, text }: NoteProps) {
  const { colors } = useAppTheme();
  return <View style={{ flexDirection: 'row', gap: 10, padding: 12, borderRadius: 12, backgroundColor: colors.control }}>
    <Icon name={icon} size={16} color={colors.icon} style={{ marginTop: 2 }} />
    <Text style={{ flex: 1, color: colors.secondaryText, fontSize: 13, lineHeight: 19 }}>{text}</Text>
  </View>;
}

export type SellerSaveState = 'saving' | 'saved' | 'failed';

type DraftHeaderProps = { revision: number; saveState: SellerSaveState };

/** Draft badge on the left, the quiet autosave state on the right ("Saved on this device"). */
export function SellerDraftHeader({ revision, saveState }: DraftHeaderProps) {
  const { colors } = useAppTheme();
  const save = saveState === 'saving' ? { icon: null, color: colors.mutedText, text: 'Saving…' }
    : saveState === 'failed' ? { icon: 'alert-circle', color: colors.destructiveText, text: 'Not saved' }
    : { icon: 'check-circle', color: colors.mutedText, text: 'Saved on this device' };
  return <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: colors.control }}>
      <Icon name="edit-2" size={12} color={colors.icon} />
      <Text style={{ color: colors.secondaryText, fontSize: 12, fontWeight: '800' }}>{revision > 0 ? 'Revised draft' : 'Draft'}</Text>
    </View>
    <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      {/* A still dot while saving: a spinner icon that does not spin reads as broken. */}
      {save.icon ? <Icon name={save.icon} size={13} color={save.color} /> : <View style={{ width: 7, height: 7, borderRadius: 4, marginHorizontal: 3, backgroundColor: colors.warning }} />}
      <Text style={{ color: save.color, fontSize: 12, fontWeight: '600' }}>{save.text}</Text>
    </View>
  </View>;
}
