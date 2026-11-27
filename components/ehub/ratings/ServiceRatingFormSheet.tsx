import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import { HelpCircle, ThumbsDown, ThumbsUp, X } from 'lucide-react-native';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { StarRatingInput } from '@/components/reviews/RatingStars';
import { RequiredLabel, ReviewField, ReviewFooter, ReviewSheet, ReviewSuccess } from '@/components/reviews/ReviewSheet';
import { reportRatingError } from '@/lib/services/EHubRatingService';
import { DeleteReviewConfirm } from '@/components/reviews/DeleteReviewConfirm';
import {
  RATING_LIMITS, SERVICE_REVIEW_CRITERIA, SERVICE_REVIEW_CRITERIA_LABELS, type ServiceReview, type ServiceReviewCriteriaScores, type SubmitServiceReviewRequest,
} from '@/lib/types/ratings';

const NO_SCORES: ServiceReviewCriteriaScores = { attitude: null, punctuality: null, presentation: null, quality: null, communication: null, value: null };
type RecommendAnswer = { value: boolean | null; label: string; spoken: string };
const RECOMMEND_ANSWERS: RecommendAnswer[] = [
  { value: true, label: 'Yes', spoken: 'Yes, I would recommend them' },
  { value: false, label: 'No', spoken: 'No, I would not recommend them' },
  { value: null, label: 'Not sure', spoken: 'Not sure' },
];

type ServiceRatingFormSheetProps = {
  visible: boolean;
  providerName: string;
  /** The provider's listed services, offered as one-tap answers for "Service used". */
  services: string[];
  existing: ServiceReview | null;
  onSubmit: (request: Omit<SubmitServiceReviewRequest, 'providerId'>) => Promise<unknown>;
  onDelete: () => Promise<void>;
  /** After a delete from the sheet: the sheet closes and the section shows this message. */
  onDeleted: (message: string) => void;
  onClose: () => void;
};

function readMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

/**
 * Rate a provider: overall rating (required) first, then six optional one-row areas (tap a star; tap it again to
 * clear), would-recommend Yes / No / Not sure, the service used (one tap from the provider's services) and a comment.
 */
export default function ServiceRatingFormSheet({ visible, providerName, services, existing, onSubmit, onDelete, onDeleted, onClose }: ServiceRatingFormSheetProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [overall, setOverall] = useState(0);
  const [criteria, setCriteria] = useState<ServiceReviewCriteriaScores>(NO_SCORES);
  const [wouldRecommend, setWouldRecommend] = useState<boolean | null>(null);
  const [serviceUsed, setServiceUsed] = useState('');
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const existingRef = useRef(existing);
  existingRef.current = existing;

  // Each opening starts from the member's current rating (or blank); saving does not reset the open sheet.
  useEffect(() => {
    if (!visible) return;
    const start = existingRef.current;
    setOverall(start?.overall ?? 0); setCriteria(start ? { ...NO_SCORES, ...start.criteria } : NO_SCORES);
    setWouldRecommend(start?.wouldRecommend ?? null); setServiceUsed(start?.serviceUsed ?? ''); setComment(start?.comment ?? '');
    setError(null); setDone(null); setIsConfirmingDelete(false); setIsEditing(Boolean(start));
  }, [visible]);

  const ratedCount = SERVICE_REVIEW_CRITERIA.filter((key) => criteria[key] !== null).length;
  const suggestions = services.filter((service) => service.length <= RATING_LIMITS.serviceUsed).slice(0, 6);

  const handleSubmit = async () => {
    if (overall < 1) { setError('Choose an overall rating.'); AccessibilityInfo.announceForAccessibility('Choose an overall rating.'); return; }
    Keyboard.dismiss();
    setIsSubmitting(true); setError(null);
    try {
      await onSubmit({ overall, criteria, wouldRecommend, serviceUsed: serviceUsed.trim() || null, comment: comment.trim() });
      const message = isEditing ? 'Your rating is updated.' : 'Thanks — your rating is posted.';
      setDone(message);
      AccessibilityInfo.announceForAccessibility(message);
    } catch (submitError: unknown) {
      const message = readMessage(submitError, 'Ratings are not available right now. Please try again later.');
      reportRatingError('ServiceRatingFormSheet.handleSubmit', submitError);
      setError(message);
      AccessibilityInfo.announceForAccessibility(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleted = () => {
    setIsConfirmingDelete(false);
    AccessibilityInfo.announceForAccessibility('Your rating was deleted.');
    onDeleted('Your rating was deleted.');
    onClose();
  };

  const recommendOption = (answer: RecommendAnswer) => {
    const isOn = wouldRecommend === answer.value;
    const Icon = answer.value === true ? ThumbsUp : answer.value === false ? ThumbsDown : HelpCircle;
    const onStyle = answer.value === true ? styles.choiceYes : answer.value === false ? styles.choiceNo : styles.choiceUnsure;
    const onColor = answer.value === true ? colors.successText : answer.value === false ? colors.destructiveText : colors.text;
    return <Pressable key={answer.label} accessibilityRole="radio" accessibilityState={{ checked: isOn }} accessibilityLabel={answer.spoken}
      onPress={() => setWouldRecommend(answer.value)} style={[styles.choice, isOn && onStyle]}>
      <Icon size={17} color={isOn ? onColor : colors.icon} />
      <Text numberOfLines={1} style={[styles.choiceText, isOn && { color: onColor }]}>{answer.label}</Text>
    </Pressable>;
  };

  return <ReviewSheet visible={visible} title={isEditing ? 'Edit your rating' : 'Rate this provider'} subtitle={providerName} isBusy={isSubmitting} onClose={onClose}
    footer={done ? null : <ReviewFooter submitLabel={isEditing ? 'Save changes' : 'Post rating'} busyLabel={isEditing ? 'Saving…' : 'Posting…'} isSubmitting={isSubmitting} isDisabled={false}
      error={error} onSubmit={() => void handleSubmit()} onDelete={isEditing ? () => setIsConfirmingDelete(true) : undefined} />}>
    {done ? <ReviewSuccess title={done} onDone={onClose} /> : <>
      <View style={styles.block}>
        <RequiredLabel text="Overall rating" />
        <StarRatingInput value={overall} onChange={(value) => { setOverall(value); setError(null); }} label="Overall rating" size={36} showWord />
      </View>

      <View style={styles.block}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>Rate specific areas</Text>
          {ratedCount ? <Pressable accessibilityRole="button" accessibilityLabel="Clear all rated areas" onPress={() => setCriteria(NO_SCORES)} style={styles.clearAll}><Text style={styles.clearText}>Clear all</Text></Pressable> : null}
        </View>
        <Text style={styles.hint}>Optional. Rate only what applies.{ratedCount ? ` · ${ratedCount} of 6 rated` : ''}</Text>
        <View style={styles.criteria}>
          {SERVICE_REVIEW_CRITERIA.map((key, index) => <View key={key} style={[styles.criterionRow, index > 0 && styles.criterionDivider]}>
            <View style={styles.criterionHead}>
              <Text style={[styles.criterionLabel, criteria[key] !== null && styles.criterionLabelSet]}>{SERVICE_REVIEW_CRITERIA_LABELS[key]}</Text>
              {criteria[key] !== null ? <Pressable accessibilityRole="button" accessibilityLabel={`Clear ${SERVICE_REVIEW_CRITERIA_LABELS[key]}`} hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                onPress={() => setCriteria((current) => ({ ...current, [key]: null }))} style={styles.rowClear}>
                <X size={14} color={colors.mutedText} /><Text style={styles.rowClearText}>Clear</Text>
              </Pressable> : null}
            </View>
            <StarRatingInput value={criteria[key] ?? 0} label={SERVICE_REVIEW_CRITERIA_LABELS[key]} size={26} isClearable showWord
              onChange={(value) => setCriteria((current) => ({ ...current, [key]: value || null }))} />
          </View>)}
        </View>
      </View>

      <View style={styles.block}>
        <Text style={styles.label}>Would you recommend {providerName}?</Text>
        <View accessibilityRole="radiogroup" style={styles.choices}>{RECOMMEND_ANSWERS.map(recommendOption)}</View>
      </View>

      <View style={styles.block}>
        <ReviewField label="Service used" value={serviceUsed} onChangeText={setServiceUsed} maxLength={RATING_LIMITS.serviceUsed} isOptional placeholder="e.g. Kitchen repair" />
        {suggestions.length ? <View style={styles.suggestions}>{suggestions.map((service) => {
          const isOn = serviceUsed.trim().toLowerCase() === service.toLowerCase();
          return <Pressable key={service} accessibilityRole="button" accessibilityState={{ selected: isOn }} accessibilityLabel={`Service used: ${service}`}
            onPress={() => setServiceUsed(isOn ? '' : service)} style={[styles.suggestion, isOn && styles.suggestionOn]}>
            <Text numberOfLines={1} style={[styles.suggestionText, isOn && styles.suggestionTextOn]}>{service}</Text>
          </Pressable>;
        })}</View> : null}
      </View>

      <ReviewField label="Comment" value={comment} onChangeText={setComment} maxLength={RATING_LIMITS.serviceComment} isOptional multiline placeholder="What went well? What could be better?" />
    </>}
    <DeleteReviewConfirm visible={isConfirmingDelete} kind="rating" onDelete={onDelete} onDeleted={handleDeleted} onCancel={() => setIsConfirmingDelete(false)}
      onError={(message) => { setIsConfirmingDelete(false); setError(message); }} />
  </ReviewSheet>;
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  block: { gap: 6 },
  labelRow: { minHeight: 44, marginVertical: -10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  label: { flexShrink: 1, color: colors.text, fontSize: 14, fontWeight: '800' },
  hint: { color: colors.mutedText, fontSize: 12, lineHeight: 17 },
  clearAll: { minHeight: 44, minWidth: 44, alignItems: 'flex-end', justifyContent: 'center' },
  clearText: { color: colors.accentText, fontSize: 13, fontWeight: '800' },
  criteria: { marginTop: 4, paddingHorizontal: 12, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.canvas },
  criterionRow: { paddingTop: 8, paddingBottom: 2 },
  criterionHead: { minHeight: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  rowClear: { minHeight: 28, paddingHorizontal: 4, flexDirection: 'row', alignItems: 'center', gap: 3 },
  rowClearText: { color: colors.mutedText, fontSize: 12, fontWeight: '700' },
  criterionDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  criterionLabel: { flex: 1, color: colors.secondaryText, fontSize: 13, lineHeight: 17, fontWeight: '600' },
  criterionLabelSet: { color: colors.text, fontWeight: '800' },
  choices: { flexDirection: 'row', gap: 8 },
  choice: { flex: 1, minHeight: 48, paddingHorizontal: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  choiceYes: { borderColor: colors.accent, backgroundColor: colors.successSurface },
  choiceNo: { borderColor: colors.destructiveBorder, backgroundColor: colors.destructiveSurface },
  choiceUnsure: { borderColor: colors.mutedText, backgroundColor: colors.control },
  choiceText: { flexShrink: 1, color: colors.text, fontSize: 14, fontWeight: '800' },
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  suggestion: { maxWidth: '100%', minHeight: 44, paddingHorizontal: 14, justifyContent: 'center', borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  suggestionOn: { borderColor: colors.accent, backgroundColor: colors.successSurface },
  suggestionText: { color: colors.secondaryText, fontSize: 13, fontWeight: '700' },
  suggestionTextOn: { color: colors.successText, fontWeight: '800' },
});
