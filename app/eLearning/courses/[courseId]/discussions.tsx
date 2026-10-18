import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MessageCircle, Send, X } from 'lucide-react-native';
import PageHeader from '@/components/ui/PageHeader';
import MentionText from '@/components/ui/MentionText';
import MentionSuggestionList from '@/components/ui/MentionSuggestionList';
import { useMentionAutocomplete } from '@/lib/hooks/useMentionAutocomplete';
import { useAppData } from '@/lib/contexts/AppDataContext';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { courseInteractionService } from '@/lib/services/CourseInteractionService';
import type { CourseDiscussion, CourseDiscussionReply, DiscussionCursor } from '@/lib/types/course';

export default function CourseDiscussionsScreen() {
  const router = useRouter();
  const { courseId } = useLocalSearchParams<{ courseId: string }>();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = createStyles(colors);
  const { activeUserId, nativeSession, retryNativeSession } = useAppData();
  const [items, setItems] = useState<CourseDiscussion[]>([]);
  const [cursor, setCursor] = useState<DiscussionCursor | null>(null);
  const [body, setBody] = useState('');
  const mention = useMentionAutocomplete({ value: body, onChangeText: setBody });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [replies, setReplies] = useState<Record<string, CourseDiscussionReply[]>>({});
  const [loadingRepliesId, setLoadingRepliesId] = useState<string | null>(null);
  const [replyError, setReplyError] = useState<string | null>(null);
  const requestGenerationRef = useRef(0);
  const operationIdRef = useRef('discussion_' + Date.now().toString(36));
  const replyOperationIdRef = useRef('reply_' + Date.now().toString(36));

  const loadPage = useCallback(async (pageCursor: DiscussionCursor | null, replace: boolean) => {
    if (!courseId || !activeUserId || nativeSession.status !== 'ready' || nativeSession.uid !== activeUserId) return;
    const generation = ++requestGenerationRef.current;
    if (replace) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    setError(null);
    try {
      const page = await courseInteractionService.getDiscussions(courseId, pageCursor);
      if (generation !== requestGenerationRef.current) return;
      setItems((currentItems) => replace ? page.items : [...currentItems, ...page.items.filter((nextItem) => !currentItems.some((currentItem) => currentItem.id === nextItem.id))]);
      setCursor(page.cursor);
    } catch (loadError) {
      console.error('[CourseDiscussionsScreen] Load failed:', loadError);
      if (generation === requestGenerationRef.current) setError('Discussions could not be loaded. Check your connection and try again.');
    } finally {
      if (generation === requestGenerationRef.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [activeUserId, courseId, nativeSession.status, nativeSession.uid]);

  useEffect(() => {
    void loadPage(null, true);
    return () => { requestGenerationRef.current += 1; };
  }, [loadPage]);

  const loadReplies = useCallback(async (discussionId: string) => {
    setLoadingRepliesId(discussionId);
    setReplyError(null);
    try {
      const discussionReplies = await courseInteractionService.getReplies(discussionId);
      setReplies((currentReplies) => ({ ...currentReplies, [discussionId]: discussionReplies }));
    } catch (loadError) {
      console.error('[CourseDiscussionsScreen] Replies failed:', loadError);
      setReplyError('Replies could not be loaded. Tap the discussion to try again.');
    } finally {
      setLoadingRepliesId((currentId) => currentId === discussionId ? null : currentId);
    }
  }, []);

  const handleToggleDiscussion = (discussionId: string) => {
    if (expandedId === discussionId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(discussionId);
    if (!replies[discussionId]) void loadReplies(discussionId);
  };

  const handleSend = async () => {
    const message = body.trim();
    if (!message || !courseId || sending) return;
    setSending(true);
    try {
      if (expandedId) {
        await courseInteractionService.createReply(expandedId, message, replyOperationIdRef.current);
        replyOperationIdRef.current = 'reply_' + Date.now().toString(36);
        setItems((currentItems) => currentItems.map((discussion) => discussion.id === expandedId ? { ...discussion, replyCount: discussion.replyCount + 1 } : discussion));
        setBody('');
        await loadReplies(expandedId);
      } else {
        await courseInteractionService.createDiscussion(courseId, message, operationIdRef.current);
        operationIdRef.current = 'discussion_' + Date.now().toString(36);
        setBody('');
        await loadPage(null, true);
      }
    } catch (sendError) {
      console.error('[CourseDiscussionsScreen] Send failed:', sendError);
      setError('Your message was not confirmed. Your text is still here so you can retry.');
    } finally {
      setSending(false);
    }
  };

  const expandedDiscussion = expandedId ? items.find((discussion) => discussion.id === expandedId) : undefined;

  const renderDiscussion = ({ item }: { item: CourseDiscussion }) => {
    const isExpanded = item.id === expandedId;
    const discussionReplies = replies[item.id] ?? [];
    return (
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={isExpanded ? 'Hide replies' : 'Show replies'} activeOpacity={0.85} onPress={() => handleToggleDiscussion(item.id)} style={[styles.card, isExpanded && styles.cardExpanded]}>
        <View style={styles.row}><Text style={styles.author}>{item.authorName ?? 'Account unavailable'}</Text><Text style={styles.date}>{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'Sending'}</Text></View>
        {item.title ? <Text style={styles.discussionTitle}>{item.title}</Text> : null}
        <MentionText content={item.body} style={styles.body} />
        <Text style={styles.replyCount}>{item.replyCount} {item.replyCount === 1 ? 'reply' : 'replies'}{isExpanded ? '' : ' · Tap to view'}</Text>
        {isExpanded ? (
          <View style={styles.replies}>
            {loadingRepliesId === item.id ? <ActivityIndicator color={colors.accent} /> : null}
            {loadingRepliesId !== item.id && replyError ? <Text style={styles.errorText}>{replyError}</Text> : null}
            {loadingRepliesId !== item.id && !replyError && discussionReplies.length === 0 ? <Text style={styles.muted}>No replies yet. Be the first to respond.</Text> : null}
            {discussionReplies.map((reply) => (
              <View key={reply.id} style={styles.reply}>
                <View style={styles.row}><Text style={styles.replyAuthor}>{reply.authorName ?? 'Account unavailable'}</Text><Text style={styles.date}>{reply.createdAt ? new Date(reply.createdAt).toLocaleDateString() : ''}</Text></View>
                <MentionText content={reply.body} style={styles.replyBody} />
              </View>
            ))}
          </View>
        ) : null}
      </TouchableOpacity>
    );
  };

  const connecting = Boolean(activeUserId) && (nativeSession.status === 'idle' || nativeSession.status === 'bridging');
  return (
    <View style={styles.container}>
      <PageHeader title="Course discussions" onBackPress={() => router.back()} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.content}>
        {connecting ? <View style={styles.center}><ActivityIndicator color={colors.accent} /><Text style={styles.muted}>Connecting your secure learning session…</Text></View> : null}
        {nativeSession.status === 'retryable_failure' ? <View style={styles.center}><Text style={styles.errorText}>The secure learning session could not connect.</Text><TouchableOpacity onPress={retryNativeSession} style={styles.retryButton}><Text style={styles.buttonText}>Try Again</Text></TouchableOpacity></View> : null}
        {!connecting && nativeSession.status !== 'retryable_failure' ? (
          <FlatList
            data={items}
            keyExtractor={(discussion) => discussion.id}
            contentContainerStyle={items.length ? styles.list : styles.emptyList}
            refreshing={loading && items.length > 0}
            onRefresh={() => void loadPage(null, true)}
            onEndReached={() => { if (cursor && !loadingMore) void loadPage(cursor, false); }}
            onEndReachedThreshold={0.4}
            ListEmptyComponent={loading ? <ActivityIndicator color={colors.accent} /> : <View style={styles.center}><MessageCircle size={42} color={colors.mutedText} /><Text style={styles.title}>{error ? 'Discussions unavailable' : 'No discussions yet'}</Text><Text style={styles.muted}>{error ?? 'Ask the first question about this course.'}</Text>{error ? <TouchableOpacity onPress={() => void loadPage(null, true)} style={styles.retryButton}><Text style={styles.buttonText}>Try Again</Text></TouchableOpacity> : null}</View>}
            ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.accent} /> : null}
            extraData={{ expandedId, replies, loadingRepliesId, replyError }}
            renderItem={renderDiscussion}
          />
        ) : null}
        {nativeSession.status === 'ready' && expandedDiscussion ? <View style={styles.replyingBar}><Text numberOfLines={1} style={styles.replyingText}>Replying to {expandedDiscussion.authorName ?? 'this discussion'}</Text><TouchableOpacity accessibilityRole="button" accessibilityLabel="Stop replying" onPress={() => setExpandedId(null)} hitSlop={10}><X size={18} color={colors.mutedText} /></TouchableOpacity></View> : null}
        {nativeSession.status === 'ready' ? <><View style={{ paddingHorizontal: 12 }}><MentionSuggestionList suggestions={mention.suggestions} isSearching={mention.isSearching} onSelect={mention.handleSelectSuggestion} /></View><View style={[styles.composer, { paddingBottom: Math.max(12, insets.bottom) }]}><TextInput value={body} onChangeText={setBody} onFocus={mention.handleFocus} onBlur={mention.handleBlur} onSelectionChange={mention.handleSelectionChange} selection={mention.selection} editable={!sending} multiline maxLength={expandedDiscussion ? 2000 : 4000} placeholder={expandedDiscussion ? 'Write a reply' : 'Ask a question or start a discussion'} placeholderTextColor={colors.mutedText} style={styles.input} /><TouchableOpacity accessibilityRole="button" accessibilityLabel={expandedDiscussion ? 'Send reply' : 'Send discussion'} onPress={() => void handleSend()} disabled={!body.trim() || sending} style={[styles.sendButton, (!body.trim() || sending) && styles.disabled]}>{sending ? <ActivityIndicator color={colors.onAccent} /> : <Send size={20} color={colors.onAccent} />}</TouchableOpacity></View></> : null}
      </KeyboardAvoidingView>
    </View>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas }, content: { flex: 1 }, list: { padding: 16, gap: 12, paddingBottom: 24 }, emptyList: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  center: { alignItems: 'center', justifyContent: 'center', gap: 10, padding: 20 }, title: { color: colors.text, fontSize: 18, fontWeight: '800', textAlign: 'center' }, muted: { color: colors.mutedText, fontSize: 13, lineHeight: 19, textAlign: 'center' }, errorText: { color: colors.destructiveText, textAlign: 'center' },
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 16, padding: 15, gap: 9 }, row: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 }, author: { color: colors.text, fontWeight: '800', flex: 1 }, date: { color: colors.mutedText, fontSize: 12 }, body: { color: colors.text, fontSize: 15, lineHeight: 22 }, replyCount: { color: colors.accentText, fontSize: 12, fontWeight: '700' },
  cardExpanded: { borderColor: colors.accent }, discussionTitle: { color: colors.text, fontSize: 16, fontWeight: '800' }, replies: { gap: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border }, reply: { backgroundColor: colors.canvas, borderRadius: 12, padding: 11, gap: 4 }, replyAuthor: { color: colors.text, fontWeight: '700', fontSize: 13, flex: 1 }, replyBody: { color: colors.text, fontSize: 14, lineHeight: 20 },
  replyingBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingHorizontal: 14, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface }, replyingText: { flex: 1, color: colors.accentText, fontSize: 12, fontWeight: '700' },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, padding: 12, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface }, input: { flex: 1, minHeight: 44, maxHeight: 120, color: colors.text, backgroundColor: colors.input, borderColor: colors.border, borderWidth: 1, borderRadius: 15, paddingHorizontal: 14, paddingVertical: 11 }, sendButton: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }, disabled: { opacity: 0.45 }, retryButton: { minHeight: 44, justifyContent: 'center', backgroundColor: colors.accent, borderRadius: 12, paddingHorizontal: 18 }, buttonText: { color: colors.onAccent, fontWeight: '800' },
});
